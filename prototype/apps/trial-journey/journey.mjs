import { IdentityError, loadIdentity, substitute, needsIdentity, previewTemplate } from './identity.mjs';
import { connectTaskRoute } from './route.mjs';
function boot() {

  const data = JSON.parse(document.getElementById('journey-data').textContent);
  const stages = data.stages;
  const appBase = window.__SUPOS_BASE__ || './';
  let identity = null, identityState = 'loading', identityMessage = '正在读取当前登录账号…', identityRequest = 0, identityController;
  const resolved = text => identity ? substitute(text, identity) : previewTemplate(text);
  const $ = id => document.getElementById(id);
  const dialog = $('stage-dialog');
  connectTaskRoute(document.querySelector('.levels-grid'));
  let currentStage = 0, currentTask = 0, currentVariant = 0, opener = null, copyTimer;
  const detail = () => {
    const task = stages[currentStage].tasks[currentTask];
    return task.variants ? task.variants[currentVariant] : task;
  };
  function fillList(target, items, expected = false) {
    target.replaceChildren();
    items.forEach(text => {
      const li = document.createElement('li');
      if (expected) {
        const mark = document.createElement('span'); mark.className = 'expected-mark'; mark.textContent = '✓'; mark.setAttribute('aria-hidden','true');
        const span = document.createElement('span'); span.textContent = text;
        li.append(mark,span);
      } else li.textContent = text;
      target.append(li);
    });
  }
  function renderDetail() {
    clearTimeout(copyTimer);
    const t = stages[currentStage].tasks[currentTask], d = detail();
    $('task-code').textContent = '体验任务';
    $('task-title').textContent = t.title;
    $('knowledge-experience').hidden = t.code !== '2.3';
    $('mes-process-figure').hidden = t.code !== '5.1';
    $('dialog-desc').textContent = d.desc || t.desc;
    $('task-source').textContent = '试用操作指引';
    $('prompt-text').textContent = resolved(d.prompt);
    const personalized = needsIdentity(d.prompt);
    $('copy-button').disabled = personalized && (!identity || identityState !== 'ready');
    $('task-notice').textContent = d.notice || '';
    $('task-notice').hidden = !d.notice;
    fillList($('task-tips'), (d.tips || []).map(resolved));
    const isMes = t.presentation === 'experience';
    document.querySelector('.prompt-box').hidden = isMes;
    $('copy-feedback').hidden = isMes;
    document.querySelector('.tips-heading').hidden = isMes;
    $('task-tips').hidden = isMes;
    $('expected-title').textContent = isMes ? '体验指引' : '预期成果';
    $('expected-intro').hidden = !isMes;
    $('expected-intro').textContent = isMes ? t.experienceIntro : '';
    fillList($('expected-list'), isMes ? t.experienceSteps : (d.expected || []).map(resolved), !isMes);
    $('expected-list').classList.toggle('mes-experience-list', isMes);
    window.updateTrialTaskVideo?.(t.code);
    $('video-task').textContent = `${t.title}${t.variants ? ' · ' + d.title : ''}`;
    $('copy-label').textContent = '复制提示词';
    $('copy-feedback').className = 'copy-feedback';
    $('copy-feedback').textContent = !personalized ? '本段不涉及账号，可直接复制使用。' : identity ? '已自动填入当前账号，可复制到 WorkBuddy 使用。' : `${identityMessage} 以下为模板预览，账号确认后可复制。`;
    $('next-task').hidden = currentTask === stages[currentStage].tasks.length - 1 && currentStage === stages.length - 1;
    $('next-task').textContent = currentTask === stages[currentStage].tasks.length - 1 && currentStage < stages.length - 1 ? '下一站：' + stages[currentStage + 1].title : '下一项任务';
    $('variant-switch').hidden = !t.variants?.length;
    $('variant-switch').replaceChildren();
    (t.variants || []).forEach((v, i) => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'variant-button' + (i === currentVariant ? ' active' : '');
      b.setAttribute('aria-pressed',String(i === currentVariant)); b.textContent = v.title;
      b.addEventListener('click', () => { currentVariant = i; renderDetail(); $('variant-switch').children[i].focus({preventScroll:true}); });
      $('variant-switch').append(b);
    });
    window.trialProgress?.showTask(t.code);
  }
  function selectTask(index, focus = false) {
    currentTask = index; currentVariant = 0;
    Array.from($('task-tabs').children).forEach((b,i) => {
      b.classList.toggle('active',i === index);
      b.setAttribute('aria-selected',String(i === index));
      b.tabIndex = i === index ? 0 : -1;
    });
    $('task-reading').setAttribute('aria-labelledby', $('task-tabs').children[index].id);
    renderDetail();
    $('task-reading').scrollTop = 0;
    $('dialog-workspace').scrollTop = 0;
    if (focus) $('task-tabs').children[index].focus({preventScroll:true});
  }
  function openStage(index, taskIndex, from) {
    if(window.trialProgress?.canOpenStage(index)!==true)return false;
    currentStage = index; opener = from;
    const s = stages[index];
    $('dialog-stage').textContent = 'supOS工业AI之旅';
    $('dialog-title').textContent = s.title;
    $('task-tabs').replaceChildren();
    s.tasks.forEach((t,i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'task-tab';
      b.id = `task-tab-${t.code}`; b.setAttribute('role','tab'); b.setAttribute('aria-controls','task-reading');
      const code = document.createElement('span'); code.className = 'task-step-number'; code.textContent = String(i+1).padStart(2,'0'); code.setAttribute('aria-hidden','true');
      const copy = document.createElement('div'); copy.className = 'task-step-copy';
      const name = document.createElement('strong'); name.textContent = t.title.split(' · ')[0];
      const status = document.createElement('small'); status.className = 'task-step-status'; status.textContent = t.completion === 'video' ? '观看视频' : '查看任务';
      copy.append(name,status); b.append(code,copy); b.addEventListener('click', () => selectTask(i));
      b.addEventListener('keydown', e => {
        let next = i;
        if(e.key === 'ArrowRight') next = (i + 1) % s.tasks.length;
        else if(e.key === 'ArrowLeft') next = (i - 1 + s.tasks.length) % s.tasks.length;
        else if(e.key === 'Home') next = 0;
        else if(e.key === 'End') next = s.tasks.length - 1;
        else return;
        e.preventDefault(); selectTask(next,true);
      });
      $('task-tabs').append(b);
    });
    selectTask(taskIndex);
    window.trialProgress?.showTask(stages[currentStage].tasks[currentTask].code);
    document.body.classList.add('modal-open');
    if (!dialog.open) dialog.showModal();
    return true;
  }
  document.querySelectorAll('.level-card:not(.preparation-node)').forEach((card, i) => {
    card.addEventListener('click', e => {
      if (e.target.closest('.map-node') || !e.target.closest('.task-link')) return;
      const taskButton = e.target.closest('.task-link');
      openStage(i, taskButton ? Number(taskButton.dataset.task) : 0, e.target.closest('button') || card.querySelector('.map-node'));
    });
    card.querySelectorAll('svg').forEach(svg => svg.setAttribute('aria-hidden','true'));
  });
  document.querySelectorAll('.map-node[data-stage]').forEach(b => b.addEventListener('click', () => openStage(Number(b.dataset.stage),0,b)));
  $('next-task').addEventListener('click', () => { if($('next-task').disabled)return; if(currentTask < stages[currentStage].tasks.length - 1) selectTask(currentTask+1,true); else if(currentStage < stages.length-1&&openStage(currentStage+1,0,opener)) $('task-tabs').children[0].focus({preventScroll:true}); });
  const close = () => dialog.close();
  dialog.querySelector('.dialog-close').addEventListener('click',close);
  dialog.querySelector('.dialog-confirm')?.remove();
  dialog.setAttribute('closedby','none');
  dialog.addEventListener('cancel', e => e.preventDefault());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    opener?.focus({preventScroll:true});
  });
  $('copy-button').addEventListener('click', async () => {
    const selectedPrompt = detail().prompt;
    const personalized = needsIdentity(selectedPrompt);
    if (personalized) {
      if (!identity || identityState !== 'ready') return;
      const previous = identity;
      $('copy-button').disabled = true;
      $('copy-label').textContent = '确认账号…';
      if (!(await refreshIdentity(false))) return;
      if (previous.username !== identity.username || previous.userId !== identity.userId) {
        $('copy-feedback').textContent = '登录账号已切换，提示词已更新。请确认后重新复制。';
        return;
      }
    }
    if (detail().prompt !== selectedPrompt || !dialog.open) return;
    const text = resolved(selectedPrompt);
    let copied = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); copied = true; } } catch {}
    if (!copied) {
      const box = document.createElement('textarea'); box.value = text; box.setAttribute('readonly',''); box.style.cssText = 'position:fixed;left:-9999px;top:0';
      dialog.append(box); box.select();
      try { copied = document.execCommand('copy'); } catch {}
      box.remove(); $('copy-button').focus({preventScroll:true});
    }
    if (copied) {
      $('copy-label').textContent = '已复制'; $('copy-feedback').className = 'copy-feedback success';
      $('copy-feedback').textContent = personalized ? `已复制 ${identity.username} 的提示词，可粘贴到 WorkBuddy。` : '提示词已复制，可粘贴到 WorkBuddy。';
    } else {
      const range = document.createRange(); range.selectNodeContents($('prompt-text'));
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      $('copy-feedback').textContent = '已选中提示词，请按 Ctrl+C（Mac 使用 ⌘C）复制。';
    }
  });
  function renderIdentity() {
    $('current-account').textContent = identity ? identity.username : (identityState === 'loading' ? '读取中…' : '未确认');
    $('current-account').title = identity ? `${identity.displayName} (${identity.username})` : identityMessage;
    $('identity-status').dataset.state = identityState;
    $('identity-message').textContent = identity ? `当前账号：${identity.username} · 资源前缀：${identity.userKey}_` : identityMessage;
    $('identity-retry').hidden = identityState !== 'error';
    if (dialog.open) renderDetail();
  }
  async function refreshIdentity(showLoading = true) {
    const sequence = ++identityRequest;
    identityController?.abort();
    const controller = new AbortController();
    identityController = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    identityState = 'loading';
    if (showLoading) { identity = null; identityMessage = '正在读取当前登录账号…'; renderIdentity(); }
    try {
      const next = await loadIdentity(appBase, controller.signal);
      if (sequence !== identityRequest) return false;
      identity = next; identityState = 'ready';
      window.trialCurrentIdentity=identity;
      window.dispatchEvent(new CustomEvent('trial-identity',{detail:identity}));
      renderIdentity(); return true;
    } catch (error) {
      if (sequence !== identityRequest) return false;
      identity = null; identityState = 'error';
      window.trialCurrentIdentity=null;
      window.dispatchEvent(new CustomEvent('trial-identity',{detail:null}));
      identityMessage = error instanceof IdentityError ? error.message : '账号信息暂时无法读取，请检查网络后重试。';
      renderIdentity(); return false;
    } finally { clearTimeout(timeout); }
  }
  $('identity-retry').addEventListener('click', () => refreshIdentity());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshIdentity(); });
  window.addEventListener('pageshow', event => { if (event.persisted) refreshIdentity(); });
  setInterval(() => { if (!document.hidden && identityState !== 'loading') refreshIdentity(false); }, 60000);
  renderIdentity();
  refreshIdentity();

}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
