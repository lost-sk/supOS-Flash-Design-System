
(() => {
 const byId = id => document.getElementById(id);
 const guide = byId('guide-dialog'), opener = byId('open-guide');
 const tabs = [...guide.querySelectorAll('[role="tab"]')], panels = [...guide.querySelectorAll('[role="tabpanel"]')];
 const scroller = guide.querySelector('.connection-scroll');
 const imageDialog = byId('guide-image-dialog');
 let step = 0, shot = 0, imageOpener = null;
 const isPreviewHost = /^(localhost|127(?:\.\d+){3}|\[::1\]|0\.0\.0\.0)$/i.test(location.hostname) || location.hostname.endsWith('.localhost');
 const hosted = /^https?:$/.test(location.protocol) && !isPreviewHost;
 const origin = hosted ? location.origin : 'https://v4on.flash.devcloud.supos.net';
 const mcpUrl = origin + '/os/toolkit/supos-mcp/mcp';
 byId('open-platform-design').href = origin + '/#/os/home';
 const configText = JSON.stringify({mcpServers:{'supos-trial':{type:'streamableHttp',url:mcpUrl,headers:{Authorization:'Bearer YOUR_APP_KEY'}}}},null,2).replace(/"headers": \{\n\s+"Authorization": ("[^"]+")\n\s+\}/, '"headers": { "Authorization": $1 }');
 byId('environment-mcp').textContent = mcpUrl;
 const tokenOffset = configText.indexOf('YOUR_APP_KEY');
 const tokenHighlight = document.createElement('mark');
 tokenHighlight.className = 'config-replace-token';
 tokenHighlight.textContent = 'YOUR_APP_KEY';
 byId('workbuddy-config').replaceChildren(document.createTextNode(configText.slice(0,tokenOffset)),tokenHighlight,document.createTextNode(configText.slice(tokenOffset+'YOUR_APP_KEY'.length)));
 byId('environment-badge').textContent = hosted ? '当前平台环境' : 'V4 示例环境';
 byId('environment-help').textContent = hosted ? '已按当前平台的域名与端口生成，无需手动填写地址。' : '当前连接地址为 V4 环境，可直接复制配置。';
 function selectStep(index, focus = false) {
  step = Math.max(0,Math.min(2,index));
  tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===step));tab.tabIndex=i===step?0:-1;panels[i].hidden=i!==step;});
  byId('connection-previous').disabled = step===0;
  byId('connection-next').textContent = ['下一步：颁发凭证','下一步：验证连接','返回地图，开始体验'][step];
  byId('connection-step-caption').textContent = `第 ${step+1} 步 / 共 3 步`;
  scroller.scrollTop = 0;
  if(focus) tabs[step].focus({preventScroll:true});
 }
 function selectShot(index) {
  shot = Math.max(0,Math.min(3,index));
  guide.querySelectorAll('[data-credential-step]').forEach((button,i)=>{button.setAttribute('aria-pressed',String(i===shot));byId('credential-shot-'+i).hidden=i!==shot;});
  byId('credential-shot-previous').disabled=shot===0;
  byId('credential-shot-next').disabled=shot===3;
  byId('credential-shot-count').textContent=`截图 ${shot+1} / 4`;
 }
 async function copyText(text,source,feedback,message) {
  let copied=false;
  try { await navigator.clipboard.writeText(text);copied=true; } catch(_) {
   const active=document.activeElement, area=document.createElement('textarea');
   area.value=text;area.setAttribute('readonly','');area.style.cssText='position:fixed;top:0;left:0;opacity:0;width:1px;height:1px;pointer-events:none';
   guide.appendChild(area);area.select();try{copied=document.execCommand('copy');}catch(_){}
   area.remove();if(active)active.focus({preventScroll:true});
  }
  feedback.textContent=copied?message:'自动复制未成功，已选中内容，请按 Ctrl+C（Mac 按 ⌘C）复制。';
  if(!copied){source.focus({preventScroll:true});const r=document.createRange();r.selectNodeContents(source);const s=window.getSelection();s.removeAllRanges();s.addRange(r);}
 }
 tabs.forEach((tab,i)=>{
  tab.addEventListener('click',()=>selectStep(i));
  tab.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(i+1)%3;if(e.key==='ArrowLeft')next=(i+2)%3;if(e.key==='Home')next=0;if(e.key==='End')next=2;if(next!==undefined){e.preventDefault();selectStep(next,true);}});
 });
 guide.querySelectorAll('[data-credential-step]').forEach((button,i)=>button.addEventListener('click',()=>selectShot(i)));
 byId('credential-shot-previous').addEventListener('click',()=>selectShot(shot-1));
 byId('credential-shot-next').addEventListener('click',()=>selectShot(shot+1));
 guide.querySelectorAll('[data-workbuddy-step]').forEach((button,i)=>button.addEventListener('click',()=>{
  guide.querySelectorAll('[data-workbuddy-step]').forEach((other,j)=>{other.setAttribute('aria-pressed',String(i===j));byId('workbuddy-shot-'+j).hidden=i!==j;});
 }));
 guide.querySelectorAll('.guide-shot').forEach(button=>button.addEventListener('click',()=>{
  imageOpener=button;
  byId('guide-full-image').src=button.querySelector('image').getAttribute('href');
  byId('guide-full-image').alt=button.querySelector('svg').getAttribute('aria-label');
  byId('guide-image-title').textContent=button.querySelector('svg').getAttribute('aria-label');
  imageDialog.showModal();imageDialog.querySelector('.guide-image-scroll').scrollTo(0,0);
 }));
 byId('close-guide-image').addEventListener('click',()=>imageDialog.close());
 imageDialog.addEventListener('close',()=>{if(imageOpener)imageOpener.focus({preventScroll:true});});
 opener.addEventListener('click',()=>{selectStep(0);selectShot(0);document.body.classList.add('modal-open');guide.showModal();});
 byId('close-guide').addEventListener('click',()=>guide.close());
 byId('guide-understood').addEventListener('click',()=>guide.close());
 byId('connection-previous').addEventListener('click',()=>selectStep(step-1,true));
 byId('connection-next').addEventListener('click',()=>step<2?selectStep(step+1,true):guide.close());
 guide.addEventListener('close',()=>{document.body.classList.remove('modal-open');opener.focus({preventScroll:true});});
 [guide,imageDialog].forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}));
 byId('copy-mcp-address').addEventListener('click',()=>copyText(mcpUrl,byId('environment-mcp'),byId('config-copy-status'),'MCP 地址已复制。'));
 byId('copy-mcp-config').addEventListener('click',()=>copyText(configText,byId('workbuddy-config'),byId('config-copy-status'),'JSON 已复制，请先粘贴到 WorkBuddy；再到第二步获取凭证，替换 YOUR_APP_KEY 后保存。'));
 guide.querySelectorAll('[data-copy-verification]').forEach(button=>button.addEventListener('click',()=>{
  const source=byId(button.dataset.copyVerification), feedback=byId(button.dataset.copyFeedback);
  copyText(source.textContent,source,feedback,'提示词已复制，请在 WorkBuddy 中发送。');
 }));
})();

document.querySelectorAll('[data-guide-step]').forEach(button => button.addEventListener('click', () => {
 document.getElementById('open-guide').click();
 document.querySelectorAll('#guide-dialog [role="tab"]')[Number(button.dataset.guideStep)].click();
}));

// Journey hover motion: preserve the current rotation while changing speed.
(() => {
 const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
 const tweens = new WeakMap();
 const controls = [];

 function changeSpeed(animation, speed, immediate = false) {
  if (typeof animation.updatePlaybackRate !== 'function') return;
  const previous = tweens.get(animation);
  if (previous) cancelAnimationFrame(previous.frame);
  if (immediate || Math.abs(animation.playbackRate - speed) < .001) {
   animation.updatePlaybackRate(speed);
   tweens.delete(animation);
   return;
  }
  const from = animation.playbackRate, start = performance.now();
  const duration = speed > from ? 320 : 500;
  const tween = {frame: 0};
  function step(now) {
   const t = Math.min(1, (now - start) / duration);
   const eased = t * t * (3 - 2 * t);
   animation.updatePlaybackRate(from + (speed - from) * eased);
   if (t < 1) tween.frame = requestAnimationFrame(step);
   else tweens.delete(animation);
  }
  tweens.set(animation, tween);
  tween.frame = requestAnimationFrame(step);
 }

 function connect(target, selectors) {
  let hovered = false;
  function refresh(immediate = false) {
   const focused = target.matches(':focus-visible');
   const active = !preference.matches && !document.hidden && (hovered || focused);
   for (const [selector, name, speed] of selectors) {
    const element = target.querySelector(selector);
    for (const animation of element?.getAnimations() || []) {
     if (animation.animationName === name) changeSpeed(animation, active ? speed : 1, immediate);
    }
   }
  }
  target.addEventListener('pointerenter', event => {
   if (event.pointerType === 'touch') return;
   hovered = true; refresh();
  });
  target.addEventListener('pointerleave', () => { hovered = false; refresh(); });
  target.addEventListener('pointercancel', () => { hovered = false; refresh(); });
  target.addEventListener('focus', () => refresh());
  target.addEventListener('blur', () => refresh());
  controls.push(() => { hovered = false; refresh(true); });
 }

 document.querySelectorAll('.map-node').forEach(node => {
  connect(node, [['.node-orbit', 'node-orbit', 5]]);
 });
 document.querySelectorAll('.brand-planet').forEach(planet => {
  connect(planet, [['.planet-satellite', 'planet-orbit', 5], ['.planet-float', 'planet-float', 1.6]]);
 });
 function renderMotion() {
  document.body.classList.toggle('motion-paused', preference.matches);
  controls.forEach(reset => reset());
 }
 preference.addEventListener('change', renderMotion);
 document.addEventListener('visibilitychange', () => { if (document.hidden) controls.forEach(reset => reset()); });
 renderMotion();
})();
// End journey hover motion.


(() => {
 const viewer=document.getElementById('mes-image-dialog'), opener=document.getElementById('mes-process-open');
 if(!viewer || !opener) return;
 const zoom=document.getElementById('mes-image-zoom');
 opener.addEventListener('click',()=>{
  document.getElementById('mes-image-full').src=opener.querySelector('img').src;
  viewer.classList.remove('is-zoomed'); zoom.textContent='放大查看'; viewer.showModal();
 });
 zoom.addEventListener('click',()=>{ const expanded=viewer.classList.toggle('is-zoomed'); zoom.textContent=expanded?'适应窗口':'放大查看'; });
 document.getElementById('mes-image-close').addEventListener('click',()=>viewer.close());
 viewer.addEventListener('close',()=>opener.focus({preventScroll:true}));
 viewer.addEventListener('click',e=>{ if(e.target!==viewer)return; const r=viewer.getBoundingClientRect(); if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)viewer.close(); });
})();

const trialVideoSources = {"1.1":"./assets/videos/task-1-1.mp4","1.2":"./assets/videos/task-1-2.mp4","1.3":"./assets/videos/task-1-3.mp4","2.1":"./assets/videos/task-2-1.mp4","2.2":"./assets/videos/task-2-2.mp4","2.3":"./assets/videos/task-2-3.mp4","3.1":"./assets/videos/task-3-1.mp4","3.2":"./assets/videos/task-3-2.mp4","3.3":"./assets/videos/task-3-3.mp4","4.1":"./assets/videos/task-4-1.mp4","4.2":"./assets/videos/task-4-2.mp4","4.3":"./assets/videos/task-4-3.mp4","5.1":"./assets/videos/task-5-1.mp4?v=a55fc746367a","5.2":"./assets/videos/task-5-2.mp4","5.3":"./assets/videos/task-5-3.mp4","6.1":"./assets/videos/task-6-1.mp4","6.2":"./assets/videos/task-6-2.mp4","6.3":"./assets/videos/task-6-3.mp4?v=fbbcfdda69dc"};

(() => {
 const data=JSON.parse(document.getElementById('journey-data').textContent),tasks=data.stages.flatMap(s=>s.tasks);
 const player=document.getElementById('task-video'), frame=document.getElementById('task-video-frame');
 const dialog=document.getElementById('stage-dialog');
 const heading=document.querySelector('.video-heading'),caption=document.querySelector('.video-caption');
 const note=document.getElementById('video-help'), error=document.getElementById('task-video-error');
 let activeTask=null, loadedSource=null;
 const sourceFor=code=>tasks.find(t=>t.code===code)?.videoUrl||trialVideoSources[code]||null;
 window.trialVideo={hasVideo:code=>Boolean(sourceFor(code))};
 window.updateTrialTaskVideo = code => {
  const task=tasks.find(t=>t.code===code),source=sourceFor(code),available=Boolean(source),watchTask=task?.completion==='video';
  if(activeTask!==code){player.pause();if(Number.isFinite(player.duration))player.currentTime=0;}
  activeTask=code;frame.hidden=!available;heading.hidden=!available;caption.hidden=!available;
  player.setAttribute('aria-label',`${task?.title||'任务'}视频教程`);
  note.textContent=watchTask?'观看教程，了解功能与操作方法。':'观看本任务的操作演示。';
  error.hidden=true;
  if(source!==loadedSource){
   loadedSource=source;player.preload=available?'metadata':'none';
   if(available)player.src=source;else player.removeAttribute('src');
   player.load();
  }
 };
 player.addEventListener('timeupdate',()=>{
  if(dialog.open&&!frame.hidden&&!player.paused&&player.readyState>=2&&player.currentTime>0&&loadedSource===sourceFor(activeTask))window.trialProgress?.videoStarted(activeTask);
 });
 player.addEventListener('playing',()=>{
  if(!dialog.open||frame.hidden||player.paused||player.readyState<2||loadedSource!==sourceFor(activeTask))return;
  window.trialProgress?.videoStarted(activeTask);
 });
 player.addEventListener('error',()=>{error.hidden=frame.hidden||!loadedSource;});
 dialog.addEventListener('close',()=>player.pause());
 document.addEventListener('visibilitychange',()=>{ if(document.hidden)player.pause(); });
})();
