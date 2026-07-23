const $ = (s) => document.querySelector(s);
const canvas = $('#canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const W = canvas.width, H = canvas.height;
let topMedia = null, bottomMedia = null, raf = 0, startedAt = performance.now();

const controls = ['warm','grain','vignette'];
controls.forEach(id => { const el=$('#'+id), out=$('#'+id+'Out'); el.addEventListener('input',()=>out.value=el.value); });

function setStatus(text){ $('#status').textContent=text; }
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
  }catch(e){ setStatus('素材读取失败，请换一个文件'); }
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
  setStatus('封面图已导出');
});
$('#recordBtn').addEventListener('click',async()=>{
  if(!topMedia)return setStatus('请先上传素材');
  if(!window.MediaRecorder||!canvas.captureStream)return setStatus('当前浏览器不支持视频导出，请使用最新版 Chrome 或 Edge；Safari 可先导出封面图');
  await playAll();
  const btn=$('#recordBtn');btn.disabled=true;
  const stream=canvas.captureStream(30);
  const candidates=['video/mp4;codecs=h264','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
  const mime=candidates.find(x=>MediaRecorder.isTypeSupported?.(x))||'';
  const chunks=[];const rec=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:6_000_000}:undefined);
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  rec.onstop=()=>{const type=rec.mimeType||mime||'video/webm';const ext=type.includes('mp4')?'mp4':'webm';const blob=new Blob(chunks,{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`dv-split-effect.${ext}`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);btn.disabled=false;setStatus(`视频已导出（${ext.toUpperCase()}）`);};
  rec.start(250);setStatus('正在生成 6 秒视频…');setTimeout(()=>rec.stop(),6000);
});
