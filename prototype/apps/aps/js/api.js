/*
 * api.js —— APS 前端数据适配层（业务数据的唯一出入口）
 *
 * 设计要点（与 APS后端化方案.md 一致）：
 *   1. rows() 必须保持同步 —— 启动时一次性装载全部白名单表到内存，之后读走内存
 *   2. 写入走队列 —— insert/update/remove 先改内存再入队，后台合并成批 POST /api/bulk
 *   3. 失败必须可见 —— 任何一条写不进去，都要在顶栏留计数，不能静默吞掉
 *   4. 后端不可用时降级 —— 自动退回 localStorage 模式，页面仍然可用（本地演示）
 *
 * 为什么写入要合并成批：
 *   排程引擎一次生成几百行 SCH_TASK / SCH_DAY_PLAN，逐条 POST 会打几百个请求，
 *   在真实网关上要几十秒。队列按业务键合并同一条记录的多次改动，再按批提交。
 *
 * 为什么这里不做乐观锁：
 *   队列是「最终一致」通道，同一条记录可能被连续改多次，携带旧 VER_NO 必然 409。
 *   乐观锁保留在 /api/<表>/<键> 的 PUT 单条通道上，供外部调用方使用。
 */
(function (global) {
  'use strict';

  /* 应用根目录：用本脚本自身的 URL 反推，避免门户深链（/t-bas-demand）改变相对路径基准 */
  var SELF = document.currentScript && document.currentScript.src ? document.currentScript.src : '';
  var ROOT = SELF ? SELF.replace(/js\/api\.js(\?.*)?$/, '') : '/';
  var API = ROOT + 'api/';

  var CFG = {
    flushDelay: 500,      // 改动合并窗口（ms）
    flushMax: 50,         // 单批上限：服务端每个 op 要查重 + 写入，50 条约 5~10 秒，避免网关超时
    retries: 2,           // 网络类失败重试次数
    timeout: 60000,       // 单次批量提交超时
    persistKey: 'aps.pending.v1',
    persistMax: 2 * 1024 * 1024   // 队列持久化上限，超过就不再写 localStorage（避免撑爆配额）
  };

  var st = {
    mode: 'init',         // init | server | local
    user: '',
    error: '',
    tables: {},           // 表名 → 行数组（UPPER 字段口径，与前端原有数据完全一致）
    known: {},            // 表名 → { 业务键: 1 }，判断某行是「后端已有」还是「本地新建」
    meta: null,           // meta.json：alias / keys / keyCodes
    pending: [],          // 待提交 op 队列（保序）
    index: {},            // 业务键 → 队列中的 op，用于合并
    failed: [],           // 提交失败的 op（带原因）
    unsynced: 0,          // 无法同步的行数（缺业务主键等）
    lastAt: null,
    inflight: false,
    timer: null,
    listeners: []
  };

  /* ---------- 小工具 ---------- */
  function nowMs() { return Date.now(); }
  function emit() {
    st.listeners.forEach(function (fn) { try { fn(snapshot()); } catch (e) { } });
    paint();
  }
  function snapshot() {
    return {
      mode: st.mode, user: st.user, error: st.error,
      pending: st.pending.length, failed: st.failed.length,
      unsynced: st.unsynced, lastAt: st.lastAt, inflight: st.inflight
    };
  }

  /* ---------- 会话令牌（服务端开启 APS_DEMO_LOCK 时必需） ----------
   * 服务端在首屏 HTML 里注入一次性握手值 window.__APS_HANDSHAKE__，
   * 页面拿它换会话令牌，之后每个请求都带 X-APS-Session。
   * 令牌只存内存，不落 localStorage —— 刷新页面重新握手，令牌不跨标签页复用。
   * 服务端没开演示锁时，/api/session 会 404，这里静默跳过，行为与之前一致。 */
  var SESSION = null;
  var sessionPending = null;

  function acquireSession() {
    var hs = (typeof window !== 'undefined' && window.__APS_HANDSHAKE__) || null;
    if (!hs) return Promise.resolve(null);
    if (SESSION) return Promise.resolve(SESSION);
    if (sessionPending) return sessionPending;
    sessionPending = fetch(API + 'session', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ handshake: hs })
    }).then(function (r) {
      return r.text().then(function (txt) {
        var j = null;
        try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
        if (j && j.ok && j.token) { SESSION = j.token; return SESSION; }
        return null;
      });
    }, function () { return null; }).then(function (v) {
      sessionPending = null;
      return v;
    });
    return sessionPending;
  }

  function req(url, opt) {
    opt = opt || {};
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, opt.timeout || CFG.timeout);
    var headers = Object.assign({ 'Accept': 'application/json' }, opt.body ? { 'Content-Type': 'application/json' } : {});
    if (SESSION) headers['X-APS-Session'] = SESSION;
    var init = {
      method: opt.method || 'GET',
      headers: headers,
      credentials: 'same-origin',
      signal: ctrl ? ctrl.signal : undefined
    };
    if (opt.body) init.body = JSON.stringify(opt.body);
    return fetch(url, init).then(function (r) {
      clearTimeout(to);
      return r.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
        if (!r.ok) {
          var msg = (data && (data.error || data.message)) || ('HTTP ' + r.status);
          var err = new Error(msg);
          err.status = r.status;
          err.code = (data && data.code) || null;
          err.data = data;
          throw err;
        }
        return data;
      });
    }, function (e) {
      clearTimeout(to);
      var err = new Error(e && e.name === 'AbortError' ? '请求超时' : '网络不可达');
      err.status = 0;
      throw err;
    });
  }

  /* ---------- 业务键 ---------- */
  function metaOf(t) { return st.meta && st.meta.tables ? st.meta.tables[t] : null; }

  /* 行 → 后端定位键（"k1|k2"）。缺任一键值返回 null：没有键就无法定位与重试 */
  function keyOf(t, row) {
    var m = metaOf(t);
    if (!m || !m.keys || !m.keyCodes || !row) return null;
    var parts = [];
    for (var i = 0; i < m.keys.length; i++) {
      var v = row[m.keyCodes[i]];
      if (v === undefined || v === null || v === '') return null;
      parts.push(String(v));
    }
    return parts.join('|');
  }

  /* ---------- 队列 ---------- */
  function opId(t, key) { return t + '\u0000' + key; }

  function schedule() {
    if (st.timer) return;
    st.timer = setTimeout(function () { st.timer = null; flush(); }, CFG.flushDelay);
  }

  /* ---------- 队列持久化 ----------
   * 引擎一次生成几百行时，队列可能要几十秒才刷完。若此时刷新页面 / 跳转，
   * 存在内存里的改动就没了。这里把未提交的 op 落到 localStorage，下次启动先重放。
   * getItem 之外不碰 localStorage，避免污染业务数据结构。
   */
  var saveTimer = null;
  function savePending() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      try {
        if (!st.pending.length) { localStorage.removeItem(CFG.persistKey); return; }
        var txt = JSON.stringify(st.pending);
        if (txt.length > CFG.persistMax) {
          console.warn('[APS] 待同步数据过大（' + Math.round(txt.length / 1024) + 'KB），不再持久化到本地');
          return;
        }
        localStorage.setItem(CFG.persistKey, txt);
      } catch (e) { /* 隐私模式/配额不足：不因为存不了本地而中断业务 */ }
    }, 300);
  }

  function loadPending() {
    try {
      var txt = localStorage.getItem(CFG.persistKey);
      if (!txt) return 0;
      var arr = JSON.parse(txt);
      if (!Array.isArray(arr)) return 0;
      var n = 0;
      arr.forEach(function (op) {
        if (!op || !op.t || !op.key) return;
        if (!metaOf(op.t)) return;                       // 表已不在白名单：丢弃
        var id = opId(op.t, op.key);
        if (st.index[id]) return;                        // 已有更新的改动
        /* 按当前服务端状态重算 isNew：上次没提交成功的新行，这次仍然是新行 */
        op.isNew = op.action === 'upsert' ? !(st.known[op.t] && st.known[op.t][op.key]) : false;
        st.pending.push(op);
        st.index[id] = op;
        n++;
      });
      return n;
    } catch (e) { return 0; }
  }

  /*
   * 入队。action: 'upsert' | 'delete'
   * 合并规则（后写覆盖前写，upsert 合并字段）：
   *   upsert → upsert：字段合并，保持一次提交
   *   upsert → delete：变成 delete（新建后立刻删掉，等于没建）
   *   delete → upsert：变成 upsert（删掉后又改回来）
   */
  function enqueue(t, action, row) {
    if (st.mode !== 'server') return null;
    if (!metaOf(t)) return null;                    // 不在白名单（RF_* / RPT_*）：本地派生，不落库
    var key = keyOf(t, row);
    if (!key) {
      st.unsynced++;
      st.failed.push({ t: t, key: null, error: '缺少业务主键，无法写入：' + t, code: 'KEY_MISSING' });
      emit();
      return null;
    }
    var id = opId(t, key);
    var cur = st.index[id];

    if (action === 'delete') {
      if (cur && cur.action === 'upsert' && cur.isNew) {
        /* 本地新建又立刻删除：后端从未见过这条，直接撤销，不必发请求 */
        removeOp(cur);
        emit();
        savePending();
        return id;
      }
      if (cur) { cur.action = 'delete'; cur.body = null; }
      else {
        cur = { t: t, action: 'delete', key: key, body: null, isNew: false, at: nowMs() };
        st.pending.push(cur); st.index[id] = cur;
      }
    } else {
      if (cur && cur.action === 'upsert') {
        cur.body = pickBody(t, row);
        cur.at = nowMs();
      } else if (cur) {
        cur.action = 'upsert'; cur.body = pickBody(t, row); cur.at = nowMs();
      } else {
        cur = {
          t: t, action: 'upsert', key: key, body: pickBody(t, row),
          isNew: !(st.known[t] && st.known[t][key]), at: nowMs()
        };
        st.pending.push(cur); st.index[id] = cur;
      }
    }
    emit();
    savePending();
    schedule();
    return id;
  }

  function removeOp(op) {
    var i = st.pending.indexOf(op);
    if (i >= 0) st.pending.splice(i, 1);
    var id = opId(op.t, op.key);
    if (st.index[id] === op) delete st.index[id];
  }

  /* 提交体：去掉纯前端字段，避免把 ID / REMOTE 之类的展示字段送给后端 */
  var DROP = { ID: 1, REMOTE: 1, __FROM_SERVER: 1, __SYNC: 1, __ERR: 1 };
  function pickBody(t, row) {
    var out = {};
    Object.keys(row || {}).forEach(function (k) {
      if (DROP[k]) return;
      if (k.indexOf('__') === 0) return;
      out[k] = row[k];
    });
    return out;
  }

  /* ---------- 刷盘 ---------- */
  function flush(done) {
    if (st.mode !== 'server') { if (done) done(null); return Promise.resolve(null); }
    if (st.inflight) { if (done) done(null); return Promise.resolve(null); }
    if (!st.pending.length) { if (done) done(null); return Promise.resolve(null); }

    var batch = st.pending.splice(0, Math.min(CFG.flushMax, st.pending.length));
    batch.forEach(function (op) {
      var id = opId(op.t, op.key);
      if (st.index[id] === op) delete st.index[id];
    });
    st.inflight = true;
    emit();
    savePending();   // 已出队的 op 也要同步更新本地快照，避免重放已提交的数据

    var payload = {
      ops: batch.map(function (op) {
        var m = metaOf(op.t);
        return { t: m.alias, op: op.action, key: op.key, body: op.body };
      })
    };

    var attempt = 0;
    function run() {
      attempt++;
      return req(API + 'bulk', { method: 'POST', body: payload }).then(function (res) {
        st.inflight = false;
        st.lastAt = new Date().toISOString();
        var results = (res && res.results) || [];
        results.forEach(function (r, i) {
          var op = batch[i];
          if (!op) return;
          if (r.ok) {
            /* 记入 known：同一条记录后续改动就走 update 语义，不会重复创建 */
            if (!st.known[op.t]) st.known[op.t] = {};
            st.known[op.t][op.key] = 1;
            return;
          }
          st.failed.push({
            t: op.t, key: op.key, action: op.action,
            code: r.code || 'FAILED', error: r.error || '写入失败'
          });
        });
        emit();
        savePending();
        maybeReport();
        /* 还有积压就立刻续刷，不必等下一个合并窗口 */
        if (st.pending.length) setTimeout(function () { flush(); }, 0);
        if (done) done(res);
        return res;
      }).catch(function (e) {
        var retryable = e.status === 0 || e.status === 502 || e.status === 503 || e.status === 504;
        if (retryable && attempt <= CFG.retries) {
          /* 网络抖动：整批回队，等下一轮。upsert 语义天然幂等，重发不会产生重复行 */
          batch.forEach(function (op) {
            var id = opId(op.t, op.key);
            if (!st.index[id]) { st.pending.unshift(op); st.index[id] = op; }
          });
          st.inflight = false;
          emit();
          savePending();
          setTimeout(run, 800 * attempt);
          return null;
        }
        st.inflight = false;
        batch.forEach(function (op) {
          st.failed.push({ t: op.t, key: op.key, action: op.action, code: 'NETWORK', error: String(e.message || e) });
        });
        emit();
        savePending();
        maybeReport();
        if (done) done(null);
        return null;
      });
    }
    return run();
  }

  /* 失败提示：只在数量变化时提示一次，避免刷屏 */
  var lastReported = -1;
  function maybeReport() {
    var n = st.failed.length;
    if (n && n !== lastReported) {
      lastReported = n;
      if (global.APS_TOAST) global.APS_TOAST('有 ' + n + ' 条数据未能保存到服务器（详见顶栏状态）');
      else console.warn('[APS] 未同步条目：', n, st.failed.slice(-5));
    }
    if (!n) lastReported = -1;
  }

  /* ---------- 启动装载 ---------- */
  /* 表结构来源：优先 /api/meta/schema；该接口异常时退回静态 js/meta.json。
   * 两者是同一个文件，静态托管总是可用的 —— 不能因为一个接口出错就把整站退成本地演示模式。 */
  function loadMeta() {
    return req(API + 'meta/schema').catch(function (e) {
      return fetch(ROOT + 'js/meta.json', { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw e;
        return r.json();
      }).then(function (meta) {
        if (!meta || !meta.tables) throw e;
        console.warn('[APS] /api/meta/schema 不可用，已改用静态 js/meta.json：' + e.message);
        return meta;
      });
    });
  }

  function boot() {
    /* 先换会话令牌再拉数据：服务端若开了演示锁，没有令牌的请求一律 401 */
    return acquireSession().then(function () {
      return loadMeta();
    }).then(function (meta) {
      st.meta = meta;
      return req(API + 'bulk');
    }).then(function (res) {
      st.tables = (res && res.tables) || {};
      st.mode = 'server';
      st.error = '';
      /* 记录后端已有的业务键：区分「新建」与「修改」，也用于新建后立即删除的撤销优化 */
      st.known = {};
      Object.keys(st.tables).forEach(function (t) {
        var m = metaOf(t);
        if (!m) return;
        var set = {};
        (st.tables[t] || []).forEach(function (row) {
          var k = keyOf(t, row);
          if (k) set[k] = 1;
        });
        st.known[t] = set;
      });
      /* 单表装载失败要在控制台留痕：这些表在页面上会显示为空，不能让人误判成「没有数据」 */
      var errs = (res && res.errors) || {};
      var bad = Object.keys(errs);
      if (bad.length) console.warn('[APS] 以下表装载失败，页面将显示为空：', errs);
      if (res && res.truncated && res.truncated.length) {
        console.warn('[APS] 以下表数据量超过单次装载上限，已截断：', res.truncated);
      }
      return req(API + 'whoami').then(function (w) {
        st.user = (w && w.user) || '';
        return snapshot();
      }, function () { return snapshot(); });
    }).then(function (snap) {
      /* 上次没来得及提交的改动先重放，再让界面渲染 —— 否则用户会看到「刚改的东西没了」 */
      var replay = loadPending();
      if (replay) {
        applyPendingToTables();
        console.info('[APS] 重放上次未提交的改动 ' + replay + ' 条');
        schedule();
      }
      emit();
      return snap;
    }).catch(function (e) {
      /* 后端不可用 → 降级本地模式，页面照常可用 */
      st.mode = 'local';
      st.error = String(e.message || e);
      console.warn('[APS] 后端不可用，退回本地演示模式：', e.message);
      emit();
      return snapshot();
    });
  }

  /* 把未提交的 op 套到装载结果上：
   * 装载拿到的是服务端旧值，而这个浏览器还有没提交的改动。不套上去的话，
   * 界面会先闪回旧值、几十秒后才「变回来」，看起来像丢了数据。 */
  function applyPendingToTables() {
    st.pending.forEach(function (op) {
      var arr = st.tables[op.t] || (st.tables[op.t] = []);
      var idx = -1;
      for (var i = 0; i < arr.length; i++) {
        if (keyOf(op.t, arr[i]) === op.key) { idx = i; break; }
      }
      if (op.action === 'delete') {
        if (idx >= 0) arr[idx].DEL_FLAG = 1;
        return;
      }
      if (idx >= 0) {
        Object.keys(op.body || {}).forEach(function (k) { arr[idx][k] = op.body[k]; });
      } else {
        var row = Object.assign({ ID: op.key, DEL_FLAG: 0, VER_NO: 1 }, op.body || {});
        arr.push(row);
      }
    });
  }

  /* ---------- 状态条 ---------- */
  function paint() {
    var el = document.getElementById('apsSync');
    if (!el) return;
    var s = snapshot();
    var color = '#8a94a6', text = '';
    if (s.mode === 'init') { text = '数据源连接中…'; }
    else if (s.mode === 'local') { color = '#d98800'; text = '本地演示数据（后端不可用）'; }
    else {
      if (s.failed || s.unsynced) { color = '#e11d48'; text = '服务器 · ' + (s.failed + s.unsynced) + ' 条未保存'; }
      else if (s.inflight || s.pending) { color = '#3b6ef5'; text = '服务器 · 保存中(' + (s.pending) + ')'; }
      else { color = '#18a058'; text = '服务器 · 已同步'; }
      if (s.user) text += ' · ' + s.user;
    }
    el.textContent = text;
    el.style.color = color;
    el.title = s.error ? ('后端错误：' + s.error) : '数据保存在 supOS UNS 关系表';
  }

  function mountBadge() {
    if (document.getElementById('apsSync')) return;
    var host = document.querySelector('.topright') || document.body;
    var el = document.createElement('span');
    el.id = 'apsSync';
    el.className = 'aps-sync';
    el.style.cssText = 'font-size:12px;line-height:1;padding:6px 10px;border-radius:10px;background:rgba(127,127,127,.12);white-space:nowrap';
    host.insertBefore(el, host.firstChild);
    paint();
  }

  /* 离开页面前尽量把队列刷完：keepalive 让请求在卸载后继续 */
  global.addEventListener('pagehide', function () {
    if (!st.pending.length || st.mode !== 'server') return;
    try {
      fetch(API + 'bulk', {
        method: 'POST', keepalive: true, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ops: st.pending.slice(0, CFG.flushMax).map(function (op) {
            var m = metaOf(op.t);
            return { t: m.alias, op: op.action, key: op.key, body: op.body };
          })
        })
      });
    } catch (e) { }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBadge);
  else mountBadge();

  global.APS_API = {
    boot: boot,
    flush: flush,
    enqueue: enqueue,
    keyOf: keyOf,
    metaOf: metaOf,
    status: snapshot,
    on: function (fn) { st.listeners.push(fn); },
    tables: function () { return st.tables; },
    isServer: function () { return st.mode === 'server'; },
    clearFailed: function () { st.failed = []; st.unsynced = 0; emit(); },
    failures: function () { return st.failed.slice(); }
  };
})(window);
