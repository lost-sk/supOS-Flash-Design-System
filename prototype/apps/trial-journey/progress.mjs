/* first-six-validation-v1: server-owned completion, isolated by current visitor. */
(() => {
 const data=JSON.parse(document.getElementById('journey-data').textContent);
 const stages=data.stages, cards=[...document.querySelectorAll('.level-card:not(.preparation-node)')];
 const guide=document.querySelector('.preparation-node'), cue=document.getElementById('guide-first-step');
 const guideOpener=document.getElementById('open-guide');
 const completed=new Set(), allTasks=stages.flatMap(s=>s.tasks), firstCode=stages[0].tasks[0].code;
 const dialog=document.getElementById('stage-dialog'), note=document.getElementById('dialog-note');
 const svg=paths=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
 const check=svg('<path d="m5 12 4 4L19 6"/>');
 const flame=svg('<path d="M12 3c1 4 5 5 5 9 1-1 2-2 2-3 3 8-1 12-7 12S3 17 5 11c1 2 2 2 3 2-1-5 2-7 4-10Z"/><path d="M12 12c-3 4-3 6 0 7 3-1 3-3 0-7Z"/>');
 const verifyIcon=svg('<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>');
 const lockIcon=svg('<rect x="5" y="10" width="14" height="11" rx="3"/><path class="lock-shackle" d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/>');
 let activeCode=null;
 let account=null,epoch=0,latest=new Map(),revision=-1,loaded=false,videoMedia=null,videoSending=false;
 const busy=new Map();
 let lastVideoAttempt=0,feedbackTimer;
 const supported=new Set(allTasks.filter(t=>t.completion!=='video').map(t=>t.code));
 const base=window.__SUPOS_BASE__||'./';
 const notices=new Map();
 let previousAccess=null;
 const pendingUnlocks=new Set(),unlockTimers=new Map();
 const unlockAnnouncement=document.createElement('p');
 unlockAnnouncement.className='sr-only';unlockAnnouncement.setAttribute('role','status');
 document.querySelector('.levels-grid').after(unlockAnnouncement);
 // Later themes share the same nine-task gate, rather than unlocking each other.
 function canOpenStage(index){
  if(!Number.isInteger(index)||index<0||index>=stages.length)return false;
  if(index===0)return true;
  if(!account||!loaded)return false;
  if(index===1)return stages[0].tasks.every(t=>completed.has(t.code));
  return completed.has('2.2');
 }
 function canOpenTask(code){return canOpenStage(stages.findIndex(s=>s.tasks.some(t=>t.code===code)));}
 function gateHint(index){return !loaded?'请先读取当前账号的任务进度':index===1?'请先完成数据连接的全部任务':'请先完成 2.2 创建工厂模型';}
 function flushUnlocks(){
  if(dialog.open||document.getElementById('guide-dialog').open||document.hidden||!pendingUnlocks.size)return;
  const opened=[...pendingUnlocks].filter(canOpenStage);pendingUnlocks.clear();
  opened.forEach(i=>{
   const card=cards[i];card.classList.add('is-unlocking');
   clearTimeout(unlockTimers.get(i));
   unlockTimers.set(i,setTimeout(()=>{card.classList.remove('is-unlocking');unlockTimers.delete(i);paintMap();},1600));
  });
  unlockAnnouncement.textContent=opened.length?opened.map(i=>stages[i].title).join('、')+'已解锁':'';
  if(opened.length)paintMap();
 }
 function resetUnlocks(){
  previousAccess=null;pendingUnlocks.clear();unlockTimers.forEach(clearTimeout);unlockTimers.clear();
  cards.forEach(card=>card.classList.remove('is-unlocking'));unlockAnnouncement.textContent='';
 }
 const incompleteMessage='校验未通过，您还没有完成当前任务';
 const resultToast=document.createElement('div');
 resultToast.id='validation-result-toast';resultToast.hidden=true;
 resultToast.setAttribute('role','status');resultToast.setAttribute('aria-live','polite');
 const topLayerToast=typeof resultToast.showPopover==='function';
 if(topLayerToast)resultToast.setAttribute('popover','manual');
 document.body.append(resultToast);let resultToastTimer;
 function hideResultToast(){
  clearTimeout(resultToastTimer);
  if(topLayerToast&&resultToast.matches(':popover-open'))resultToast.hidePopover();
  resultToast.hidden=true;
 }
 function showValidationResult(code,result=latest.get(code)||{}){
  if(completed.has(code))notices.delete(code);
  else {
   // Prerequisites and unavailable evidence need actionable explanations;
   // only unmet business conditions use the generic incomplete message.
   let message=incompleteMessage;
   if(result.status==='pending')message=result.summary||'前置任务尚未完成，请先完成前置任务。';
   else if(result.status==='unknown'&&!result.checks?.some(c=>c.status==='failed'))message=result.summary||'暂时无法校验，请稍后重试。';
   notices.set(code,{message,expiresAt:Date.now()+10000});
  }
  hideResultToast();
  const passed=completed.has(code);
  resultToast.textContent=passed?'任务已完成':notices.get(code).message;
  if(dialog.open&&code!==activeCode)resultToast.textContent=`${code} ${allTasks.find(t=>t.code===code)?.title||''}：${resultToast.textContent}`;
  // A modal dialog is in the browser top layer: z-index on body cannot cover it.
  // Keep the live region inside the modal for accessibility, then promote it
  // after the dialog so the message paints above both dialog and backdrop.
  (dialog.open?dialog:document.body).append(resultToast);
  resultToast.classList.toggle('is-failed',!passed);resultToast.hidden=false;
  if(topLayerToast)resultToast.showPopover();
  resultToastTimer=setTimeout(hideResultToast,passed?5000:10000);
  paintDialog();
 }
 async function request(route,body){
  const r=await fetch(new URL(route,new URL(base,location.origin)),{method:body?'POST':'GET',credentials:'same-origin',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),
   headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-Trial-Request':'journey-v1'}:{})},body:body?JSON.stringify(body):undefined});
  if(!r.ok)throw new Error(r.status===401?'登录已失效，请重新登录。':r.status===403?'当前账号无权读取校验证据。':r.status===429?'当前校验请求较多，请稍后重试。':'暂时无法读取或保存进度，请稍后重试。');
  const p=await r.json();if(!p.ok)throw new Error('进度服务暂不可用。');return p;
 }
 function accept(p,seq){
  if(seq!==epoch||!account)return false;
  if(p.user?.userId!==account.userId){window.trialProgress.setIdentity(null);document.getElementById('identity-retry')?.click();return false;}
  // Parallel task responses must not replace newer persisted progress.
  if(Number.isSafeInteger(p.revision)&&p.revision<revision)return true;
  revision=p.revision??revision;
  completed.clear();latest.clear();
  p.tasks.forEach(t=>{if(t.completion_locked)completed.add(t.task_code);if(t.latest_validation)latest.set(t.task_code,t.latest_validation);});
  videoMedia=p.video_media||videoMedia;loaded=true;paintMap();paintDialog();return true;
 }
 async function refresh(){const seq=epoch;try{
  const p=await request('api/progress');if(!accept(p,seq))return;
  for(const job of p.active_validations||(p.active_validation?[p.active_validation]:[])){
   if(!busy.has(job.task_code)){busy.set(job.task_code,job);poll(job,seq);}
  }
  paintDialog();
 }catch(e){if(seq===epoch){loaded=false;paintDialog();}}}
 async function poll(job,seq){
  try{
   for(let n=0;n<180;n++){
    if(seq!==epoch)return;await new Promise(r=>setTimeout(r,1500));if(seq!==epoch)return;
    const p=await request('api/validation/jobs/'+job.validation_id);
    if(seq!==epoch)return;
    if(p.status!=='running'){if(p.progress&&!accept(p.progress,seq))return;showValidationResult(job.task_code,p.result);return;}
   }
   showValidationResult(job.task_code,{status:'unknown',summary:'校验仍在进行，请稍后查看结果。'});
  }catch(e){if(seq===epoch)showValidationResult(job.task_code,{status:'unknown',summary:e.message});}
  finally{if(seq===epoch&&busy.get(job.task_code)===job){busy.delete(job.task_code);paintDialog();}}
 }
 const verify=document.createElement('button');
 verify.type='button';verify.id='verify-task';verify.className='verify-task';
 dialog.querySelector('.dialog-actions').prepend(verify);
 const noteWrap=document.createElement('div');noteWrap.className='verification-note';
 note.before(noteWrap);noteWrap.append(note);
 note.setAttribute('role','status');note.setAttribute('aria-live','polite');note.setAttribute('aria-atomic','true');
 const taskIcons=new Map();
 cards.forEach((card,i)=>{
  const frame=document.createElement('span');frame.className='stage-focus-frame';frame.setAttribute('aria-hidden','true');
  const badge=document.createElement('div');badge.className='stage-status-badge';badge.hidden=true;
  card.prepend(frame,badge);
  const circle=card.querySelector('.node-circle');
  card.querySelector('.node-face').insertAdjacentHTML('beforeend',`<span class="node-access-lock" aria-hidden="true">${lockIcon}</span>`);
  circle.insertAdjacentHTML('beforeend','<span class="stage-unlock-glow" aria-hidden="true"></span>');
  circle.insertAdjacentHTML('beforeend',`<span class="stage-water stage-water-one"></span><span class="stage-water stage-water-two"></span><svg class="node-progress-ring" viewBox="0 0 120 120" aria-hidden="true">${[0,1,2].map(n=>`<circle class="progress-segment" cx="60" cy="60" r="54" pathLength="300" stroke-dasharray="90 210" stroke-dashoffset="${-n*100}"/>`).join('')}</svg><span class="node-done-tick">${check}</span>`);
  card.querySelectorAll('.task-link').forEach((button,j)=>taskIcons.set(stages[i].tasks[j].code,button.querySelector('.task-icon').innerHTML));
 });
 const guideTaskIcons=[...guide.querySelectorAll('.task-icon')].map(icon=>icon.innerHTML);
 guide.querySelector('.node-circle').insertAdjacentHTML('beforeend',`<span class="node-done-tick">${check}</span>`);
 function paintMap(){
  const access=stages.map((_,i)=>canOpenStage(i));
  if(loaded){
   if(previousAccess)access.forEach((open,i)=>{if(open&&!previousAccess[i])pendingUnlocks.add(i);});
   previousAccess=access;
  }
  const connected=stages[0].tasks.some(task=>completed.has(task.code));
  const current=connected?stages.findIndex(s=>s.tasks.some(t=>!completed.has(t.code))):-1;
  guide.classList.toggle('is-introducing',!connected);
  guide.classList.toggle('is-complete',connected);
  cue.hidden=false;
  cue.querySelector('span').textContent=connected?'已接入':'第一步 · 从这里开始';
  guideOpener.setAttribute('aria-label',connected?'智能体接入，已接入，查看接入指引':'智能体接入，第一步，查看接入指引');
  if(cue.hidden)guideOpener.removeAttribute('aria-describedby');else guideOpener.setAttribute('aria-describedby','guide-first-step');
  guide.querySelectorAll('.guide-step-link').forEach((button,j)=>{
   button.classList.toggle('is-verified',connected);
   button.querySelector('.task-icon').innerHTML=connected?check:guideTaskIcons[j];
  });
  cards.forEach((card,i)=>{
   const done=stages[i].tasks.filter(t=>completed.has(t.code)).length, total=stages[i].tasks.length;
   const finished=done===total,locked=!access[i],isCurrent=!locked&&i===current;
   if(finished){clearTimeout(unlockTimers.get(i));unlockTimers.delete(i);pendingUnlocks.delete(i);card.classList.remove('is-unlocking');}
   const unlocking=card.classList.contains('is-unlocking');
   card.classList.toggle('is-locked',locked);
   card.dataset.access=locked?'locked':'unlocked';
   card.classList.toggle('is-current',isCurrent);
   card.classList.toggle('is-complete',finished);
   card.classList.toggle('has-progress',done>0);
   card.dataset.completed=String(done);
   const badge=card.querySelector('.stage-status-badge');
   badge.hidden=!locked&&!unlocking&&!isCurrent&&!finished;
   badge.innerHTML=locked?`${lockIcon}<span>待解锁</span>`:unlocking?`${lockIcon}<span>已解锁</span>`:finished?`${check}<span>已完成</span>`:`${flame}<span>NOW</span><small>${done}/${total}</small>`;
   const node=card.querySelector('.map-node');
   node.disabled=locked;node.setAttribute('aria-disabled',String(locked));
   node.title=locked?gateHint(i):'';
   node.setAttribute('aria-label',`${stages[i].title}，${locked?'待解锁，'+gateHint(i):finished?'已完成':isCurrent?'当前任务':'查看任务'}，已完成${done}/${total}`);
   card.querySelectorAll('.progress-segment').forEach((part,j)=>part.classList.toggle('segment-complete',completed.has(stages[i].tasks[j].code)));
   card.querySelectorAll('.task-link').forEach((button,j)=>{
    const task=stages[i].tasks[j],isDone=completed.has(task.code);
    button.disabled=locked;button.setAttribute('aria-disabled',String(locked));button.title=locked?gateHint(i):'';
    button.classList.toggle('is-verified',isDone);
    button.querySelector('.task-icon').innerHTML=locked?lockIcon:isDone?check:taskIcons.get(task.code);
    button.setAttribute('aria-label',`${task.title}，${locked?'待解锁，'+gateHint(i):isDone?'已完成':task.completion==='video'?'待观看':'待校验'}`);
   });
  });
  document.querySelector('.map-heading>p').innerHTML=`<strong>6</strong> 个主题<span class="meta-dot">·</span>已完成 <strong>${completed.size}/${allTasks.length}</strong> 项任务`;
  if(pendingUnlocks.size&&!dialog.open&&!document.hidden)flushUnlocks();
 }
 function paintDialog(){
  const activeStage=stages.find(stage=>stage.tasks.some(task=>task.code===activeCode));
  const activeTask=allTasks.find(task=>task.code===activeCode),watchTask=activeTask?.completion==='video';
  dialog.dataset.stageComplete=String(Boolean(activeStage&&activeStage.tasks.every(task=>completed.has(task.code))));
  dialog.dataset.completionMode=watchTask?'video':'validation';
  const done=completed.has(activeCode);
  verify.hidden=watchTask;
  verify.disabled=!supported.has(activeCode)||!canOpenTask(activeCode)||!account||!loaded||busy.has(activeCode)||done;verify.setAttribute('aria-disabled',String(verify.disabled));
  verify.setAttribute('aria-busy',String(busy.has(activeCode)));
  verify.innerHTML=`${verifyIcon}<span>${busy.has(activeCode)?'正在校验…':done?'已完成':'校验任务完成'}</span>`;
  clearTimeout(feedbackTimer);
  const notice=notices.get(activeCode),remaining=(notice?.expiresAt||0)-Date.now();
  const failed=!done&&!busy.has(activeCode)&&remaining>0;
  note.textContent=done?'已完成':failed?notice.message:'';
  // Keep the live region and footer geometry stable when the 10-second notice expires.
  note.classList.toggle('is-passed',done);
  note.classList.toggle('is-failed',failed);
  if(failed)feedbackTimer=setTimeout(paintDialog,remaining);
  const stageIndex=stages.indexOf(activeStage),next=document.getElementById('next-task');
  const crossingStage=activeStage?.tasks.at(-1)?.code===activeCode&&stageIndex<stages.length-1;
  next.disabled=Boolean(crossingStage&&!canOpenStage(stageIndex+1));
  next.setAttribute('aria-disabled',String(next.disabled));next.title=next.disabled?gateHint(stageIndex+1):'';
  if(crossingStage)next.textContent=next.disabled?'下一节点未解锁':'下一站：'+stages[stageIndex+1].title;
  dialog.querySelectorAll('.task-tab').forEach((tab,index)=>{
   const code=tab.id.replace('task-tab-',''), verified=completed.has(code), task=allTasks.find(t=>t.code===code);
   const status=verified?'已完成':tab.getAttribute('aria-selected')==='true'?'当前任务':task?.completion==='video'?'观看视频':'查看任务';
   tab.classList.toggle('is-verified',verified);
   const number=tab.querySelector('.task-step-number');
   if(number)number.innerHTML=verified?check:String(index+1).padStart(2,'0');
   const label=tab.querySelector('.task-step-status');if(label)label.textContent=status;
   tab.setAttribute('aria-label',`${task?.title||code}，${status}`);
  });
 }
 window.trialProgress={
  refresh,
  canOpenStage,
  showTask(code){activeCode=code;paintDialog();},
  setIdentity(identity){
   if(identity?.userId===account?.userId&&identity?.username===account?.username)return;
   hideResultToast();
   account=identity;epoch++;revision=-1;completed.clear();latest.clear();notices.clear();loaded=false;busy.clear();videoMedia=null;videoSending=false;resetUnlocks();paintMap();paintDialog();
   if(account)refresh();
  },
  async videoStarted(code){
   if(code!==activeCode||!canOpenTask(code)||!dialog.open||completed.has(code)||allTasks.find(task=>task.code===code)?.completion!=='video')return;
   const player=document.getElementById('task-video');
   if(!account||!loaded||!videoMedia?.[code]||videoSending||player.paused||player.currentTime<=0||Date.now()-lastVideoAttempt<10000)return;
   const seq=epoch;videoSending=true;lastVideoAttempt=Date.now();
   try{const p=await request('api/validation/video-start',{...videoMedia[code],event_id:crypto.randomUUID(),position_ms:Math.floor(player.currentTime*1000)});if(accept(p,seq))showValidationResult(code,{status:'passed'});}
   catch(e){if(seq===epoch)showValidationResult(code,{status:'unknown',summary:e.message});}
   finally{if(seq===epoch){videoSending=false;paintDialog();}}
  }
 };
 verify.addEventListener('click',async()=>{
  if(verify.disabled)return;const code=activeCode,seq=epoch;busy.set(code,{task_code:code});notices.delete(code);hideResultToast();paintDialog();
  try{const p=await request('api/validation/start',{task_code:code});if(seq!==epoch)return;
   if(p.status==='finished'){busy.delete(code);if(!accept(p.progress,seq))return;showValidationResult(code,p.result);}
   else{busy.set(code,p);paintDialog();poll(p,seq);}
  }catch(e){if(seq===epoch){busy.delete(code);showValidationResult(code,{status:'unknown',summary:e.message});}}
 });
 window.addEventListener('focus',()=>{if(account)refresh();});
 dialog.addEventListener('close',()=>{hideResultToast();requestAnimationFrame(flushUnlocks);});
 document.getElementById('guide-dialog').addEventListener('close',()=>requestAnimationFrame(flushUnlocks));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)flushUnlocks();});
 window.addEventListener('trial-identity',event=>window.trialProgress.setIdentity(event.detail));
 if(window.trialCurrentIdentity)window.trialProgress.setIdentity(window.trialCurrentIdentity);
 paintMap();
})();
