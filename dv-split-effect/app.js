const $ = (s) => document.querySelector(s);
const canvas = $('#canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const W = canvas.width, H = canvas.height;
let topMedia = null, bottomMedia = null, raf = 0, startedAt = performance.now();
let ffmpeg = null;
let ffmpegLoadPromise = null;
let lastFFmpegLog = '';

const EXPORT_SECONDS = 6;
const FFMPEG_CORE_URL = new URL('vendor/ffmpeg/ffmpeg-core.js', location.href).href;
const FFMPEG_WASM_URL = new URL('vendor/ffmpeg/ffmpeg-core.wasm', location.href).href;

const controls = ['warm','grain','vignette'];
controls.forEach(id => { const el=$('#'+id), out=$('#'+id+'Out'); el.addEventListener('input',()=>out.value=el.value); });

function setStatus(text, tone=''){
  const status=$('#status');
  status.textContent=text;
  status.className=`status ${tone}`.trim();
}
function setProgress(percent,title,detail){
  const value=Math.max(0,Math.min(100,Math.round(percent)));
  $('#exportProgress').hidden=false;
  $('#progressTitle').textContent=title;
  $('#progressPercent').textContent=`${value}%`;
  $('#progressBar').style.width=`${value}%`;
  $('#progressTrack').setAttribute('aria-valuenow',String(value));
  $('#progressDetail').textContent=detail;
}
function hideProgress(){ $('#exportProgress').hidden=true; }
function mediaFromFile(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const isVideo=file.type.startsWith('video/');
    const el=document.createElement(isVideo?'video':'img');
    if(isVideo){ el.muted=true; el.loop=true; el.playsInline=true; el.preload='auto'; }
    el.onload=()=>resolve({el,type:'image',url});
    el.onloadeddata=()=>resolve({el,type:'video',url});
    el.onerror=reject; el.src=url;
  });
}
async function bindInput(input, key){
  const file=input.files?.[0]; if(!file)return;
  setStatus('正在读取素材…');
  try{
    const media=await mediaFromFile(file);
    if(key==='top'){ if(topMedia)URL.revokeObjectURL(topMedia.url); topMedia=media; $('#topName').textContent=file.name; }
    else { if(bottomMedia)URL.revokeObjectURL(bottomMedia.url); bottomMedia=media; $('#bottomName').textContent=file.name; }
    startedAt=performance.now(); draw(); setStatus('素材已加载，可以预览或导出');
  }catch(e){ setStatus('素材读取失败，请换一个文件','error'); }
}
$('#topInput').addEventListener('change',e=>bindInput(e.target,'top'));
$('#bottomInput').addEventListener('change',e=>bindInput(e.target,'bottom'));

function sourceSize(m){ return m.type==='video'?[m.el.videoWidth,m.el.videoHeight]:[m.el.naturalWidth,m.el.naturalHeight]; }
function drawCover(m,x,y,w,h,mirror=false){
  if(!m)return;
  const [sw,sh]=sourceSize(m); if(!sw||!sh)return;
  const scale=Math.max(w/sw,h/sh), dw=sw*scale, dh=sh*scale, dx=x+(w-dw)/2, dy=y+(h-dh)/2;
  ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  if(mirror){ ctx.translate(x+w,y); ctx.scale(-1,1); ctx.drawImage(m.el,dx-x,dy,dw,dh); }
  else ctx.drawImage(m.el,dx,dy,dw,dh);
  ctx.restore();
}
function roundedRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function overlay(){
  if(!$('#recOverlay').checked)return;
  ctx.save(); ctx.strokeStyle='rgba(255,255,255,.88)'; ctx.fillStyle='rgba(255,255,255,.9)'; ctx.lineWidth=4;
  const m=38,l=74;
  [[m,m,1,1],[W-m,m,-1,1],[m,H-m,1,-1],[W-m,H-m,-1,-1]].forEach(([x,y,sx,sy])=>{ctx.beginPath();ctx.moveTo(x+sx*l,y);ctx.lineTo(x,y);ctx.lineTo(x,y+sy*l);ctx.stroke();});
  ctx.font='700 27px ui-monospace,monospace'; ctx.fillText('REC',58,91); ctx.fillStyle='#ff3b30';ctx.beginPath();ctx.arc(36,82,9,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.85)';ctx.strokeRect(W-112,54,60,28);ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(W-47,62,6,12);ctx.fillRect(W-106,60,40,16);
  ctx.strokeStyle='rgba(255,255,255,.65)';ctx.lineWidth=2;ctx.strokeRect(W/2-56,H/2-56,112,112);
  ctx.font='18px ui-monospace,monospace';ctx.fillStyle='rgba(255,255,255,.82)';ctx.fillText('ISO 400   F2.8   1/60',52,H-62);
  ctx.restore();
}
function grade(t){
  const warm=+$('#warm').value/100;
  ctx.save();ctx.globalCompositeOperation='soft-light';ctx.fillStyle=`rgba(255,132,44,${warm*.42})`;ctx.fillRect(0,0,W,H);ctx.restore();
  const vig=+$('#vignette').value/100;const g=ctx.createRadialGradient(W/2,H/2,H*.12,W/2,H/2,H*.72);g.addColorStop(.45,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${vig})`);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  const grain=+$('#grain').value; if(grain){const count=Math.floor(grain*180);ctx.save();for(let i=0;i<count;i++){const a=Math.random()*.14;ctx.fillStyle=`rgba(255,255,255,${a})`;ctx.fillRect(Math.random()*W,Math.random()*H,Math.random()*2+1,Math.random()*2+1);}ctx.restore();}
  if($('#introBlur').checked && t<900){const a=1-t/900;ctx.save();ctx.globalAlpha=a*.52;ctx.filter=`blur(${Math.max(1,a*18)}px)`;ctx.drawImage(canvas,-18*a,-32*a,W+36*a,H+64*a);ctx.restore();}
}
function placeholder(){
  ctx.fillStyle='#0b0b0b';ctx.fillRect(0,0,W,H);ctx.fillStyle='#2b2721';roundedRect(70,310,W-140,520,28);ctx.fill();ctx.fillStyle='#c9b99d';ctx.textAlign='center';ctx.font='700 34px system-ui';ctx.fillText('上传图片或视频',W/2,530);ctx.font='22px system-ui';ctx.fillStyle='#8e8578';ctx.fillText('自动生成 DV 上下分屏特效',W/2,580);ctx.textAlign='start';
}
function draw(){
  const t=performance.now()-startedAt;
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
  if(!topMedia){ placeholder(); }
  else{
    const lower=bottomMedia||topMedia;
    drawCover(topMedia,0,0,W,H/2-3,$('#mirrorTop').checked);
    drawCover(lower,0,H/2+3,W,H/2-3,$('#mirrorBottom').checked);
    ctx.fillStyle='#090909';ctx.fillRect(0,H/2-3,W,6);grade(t);overlay();
  }
  raf=requestAnimationFrame(draw);
}
draw();

async function playAll(){
  for(const m of [topMedia,bottomMedia]) if(m?.type==='video'){m.el.currentTime=0;await m.el.play().catch(()=>{});} startedAt=performance.now();setStatus('正在预览');
}
$('#playBtn').addEventListener('click',playAll);
$('#imageBtn').addEventListener('click',()=>{
  if(!topMedia)return setStatus('请先上传素材');
  canvas.toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='dv-split-cover.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);},'image/png');
  setStatus('封面图已导出','success');
});

function getRecorderMimeType(){
  const candidates=[
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4'
  ];
  if(!MediaRecorder.isTypeSupported)return '';
  return candidates.find(type=>MediaRecorder.isTypeSupported(type))||'';
}

function recordCanvas(){
  return new Promise(async(resolve,reject)=>{
    let timer=0;
    let progressTimer=0;
    let stream=null;
    try{
      await playAll();
      stream=canvas.captureStream(30);
      const mime=getRecorderMimeType();
      const options=mime?{mimeType:mime,videoBitsPerSecond:6_000_000}:{videoBitsPerSecond:6_000_000};
      const chunks=[];
      const recorder=new MediaRecorder(stream,options);
      const began=performance.now();

      recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      recorder.onerror=event=>reject(event.error||new Error('浏览器录制失败'));
      recorder.onstop=()=>{
        clearTimeout(timer);
        clearInterval(progressTimer);
        stream.getTracks().forEach(track=>track.stop());
        if(!chunks.length)return reject(new Error('没有生成临时视频数据'));
        const type=recorder.mimeType||mime||'video/webm';
        resolve(new Blob(chunks,{type}));
      };

      recorder.start(250);
      setStatus('正在生成 6 秒画面，请保持页面在前台…');
      setProgress(1,'正在生成画面','第 1/3 步：实时录制 6 秒分屏特效。');
      progressTimer=setInterval(()=>{
        const ratio=Math.min(1,(performance.now()-began)/(EXPORT_SECONDS*1000));
        setProgress(1+ratio*29,'正在生成画面',`第 1/3 步：已录制 ${(ratio*EXPORT_SECONDS).toFixed(1)} / ${EXPORT_SECONDS} 秒。`);
      },120);
      timer=setTimeout(()=>recorder.stop(),EXPORT_SECONDS*1000);
    }catch(error){
      clearTimeout(timer);
      clearInterval(progressTimer);
      stream?.getTracks().forEach(track=>track.stop());
      reject(error);
    }
  });
}

async function ensureFFmpeg(){
  if(ffmpeg?.loaded)return ffmpeg;
  if(ffmpegLoadPromise)return ffmpegLoadPromise;
  if(!window.FFmpegWASM?.FFmpeg)throw new Error('转码组件脚本未加载，请确认 vendor/ffmpeg 文件夹已完整上传');

  ffmpegLoadPromise=(async()=>{
    setProgress(32,'首次加载转码核心','第 2/3 步：正在加载约 31 MB 的 ffmpeg.wasm，首次会较慢。');
    setStatus('首次导出：正在加载约 31 MB 的转码核心…');
    ffmpeg=new FFmpegWASM.FFmpeg();
    ffmpeg.on('log',({message})=>{lastFFmpegLog=message||lastFFmpegLog;});
    ffmpeg.on('progress',({progress,time})=>{
      if(!Number.isFinite(progress))return;
      const ratio=Math.max(0,Math.min(1,progress));
      const seconds=Number.isFinite(time)?Math.max(0,time/1_000_000):0;
      setProgress(55+ratio*43,'正在转成 H.264 MP4',`第 3/3 步：已处理约 ${seconds.toFixed(1)} 秒画面，请勿关闭页面。`);
    });
    await ffmpeg.load({coreURL:FFMPEG_CORE_URL,wasmURL:FFMPEG_WASM_URL});
    setProgress(52,'转码核心已就绪','第 2/3 步完成，正在写入临时视频。');
    return ffmpeg;
  })().catch(error=>{
    ffmpeg=null;
    ffmpegLoadPromise=null;
    throw error;
  });
  return ffmpegLoadPromise;
}

async function transcodeToAppleMp4(inputBlob){
  const engine=await ensureFFmpeg();
  const stamp=Date.now();
  const inputExt=inputBlob.type.includes('mp4')?'mp4':'webm';
  const inputName=`input-${stamp}.${inputExt}`;
  const outputName=`output-${stamp}.mp4`;
  lastFFmpegLog='';

  try{
    setProgress(54,'正在准备转码','第 3/3 步：正在把临时视频写入本机转码器。');
    await engine.writeFile(inputName,new Uint8Array(await inputBlob.arrayBuffer()));
    const exitCode=await engine.exec([
      '-i',inputName,
      '-an',
      '-c:v','libx264',
      '-preset','ultrafast',
      '-crf','23',
      '-pix_fmt','yuv420p',
      '-r','30',
      '-movflags','+faststart',
      outputName
    ]);
    if(exitCode!==0)throw new Error(`H.264 转码失败（代码 ${exitCode}）${lastFFmpegLog?`：${lastFFmpegLog}`:''}`);
    const data=await engine.readFile(outputName);
    if(!data?.length)throw new Error('转码完成但没有生成 MP4 文件');
    return new Blob([data.buffer],{type:'video/mp4'});
  }finally{
    await engine.deleteFile(inputName).catch(()=>{});
    await engine.deleteFile(outputName).catch(()=>{});
  }
}

function downloadBlob(blob,filename){
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}

function friendlyExportError(error){
  const message=String(error?.message||error||'未知错误');
  if(/memory|abort\(|out of bounds|allocation/i.test(message))return '设备内存不足。请关闭其他页面后重试；较旧的 iPhone/iPad 可能无法完成浏览器端转码。';
  if(/fetch|network|load|Failed to fetch/i.test(message))return '转码核心加载失败。请确认网络正常，并检查 vendor/ffmpeg 文件夹是否完整上传。';
  if(/libx264|encoder/i.test(message))return 'H.264 编码器未能启动。请确认使用本项目随附的 ffmpeg-core 文件，不要替换为精简版。';
  return `MP4 导出失败：${message}`;
}

$('#recordBtn').addEventListener('click',async()=>{
  if(!topMedia)return setStatus('请先上传素材','error');
  if(!window.MediaRecorder||!canvas.captureStream)return setStatus('当前浏览器不支持画布视频录制，请升级 Safari、Chrome 或 Edge。','error');

  const btn=$('#recordBtn');
  btn.disabled=true;
  $('#playBtn').disabled=true;
  $('#imageBtn').disabled=true;

  try{
    const recorded=await recordCanvas();
    const mp4=await transcodeToAppleMp4(recorded);
    setProgress(100,'MP4 已生成','H.264 + yuv420p + faststart，可用于苹果相册和常见社交平台。');
    downloadBlob(mp4,'dv-split-effect.mp4');
    setStatus('苹果兼容 MP4 已导出','success');
  }catch(error){
    console.error(error);
    setProgress(0,'导出未完成','可以检查提示后重新点击导出。');
    setStatus(friendlyExportError(error),'error');
  }finally{
    btn.disabled=false;
    $('#playBtn').disabled=false;
    $('#imageBtn').disabled=false;
  }
});
