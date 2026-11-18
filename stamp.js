'use strict';
/* Geometric stamp candidates are advisory only. User must explicitly select. */
window.StampMask=(()=>{
 const selected=new Map();
 // Measured from three official Chiyoda petition PDFs: 2026-3, 2026-7, 2026-9, page 2.
 // Approximate round stamp outer diameter 8.2% of A4 page width; allow scanning/resizing variance.
 const STAMP_DIAMETER_RATIO=0.082;
 // Detection remains based on the outer circular ring; masking is 50% larger.
 const AUTO_MASK_SCALE=1.50;
 // Shift only the automatic circular-stamp OCR mask upward by roughly one text character.
 const AUTO_MASK_UP_SHIFT=0.018; // 1.8% of PDF page height
 const MIN_RATIO=0.068,MAX_RATIO=0.100;
 const sizeStatus=()=>document.getElementById('stampSizeStatus');
 function calibration(){return STAMP_DIAMETER_RATIO;}
 function clearCalibration(){if(sizeStatus())sizeStatus().textContent='収受印の想定直径：約8.2%（PDF幅比）。アプリ内に設定済み。';}
 const reviewEl=()=>document.getElementById('stampReview');
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function reset(){selected.clear();if(reviewEl())reviewEl().replaceChildren()}
 function get(page){return (selected.get(page)||[]).map(x=>({...x}))}
 function expandedMaskBox(b){
  // Only enlarge detected circular stamps. Manually drawn rectangles stay exact.
  if(b.kind!=='丸')return {...b};
  const cx=b.x+b.w/2,cy=b.y+b.h/2;
  const x0=clamp(cx-b.w*AUTO_MASK_SCALE/2,0,1),y0=clamp(cy-b.h*AUTO_MASK_SCALE/2-AUTO_MASK_UP_SHIFT,0,1);
  const x1=clamp(cx+b.w*AUTO_MASK_SCALE/2,0,1),y1=clamp(cy+b.h*AUTO_MASK_SCALE/2-AUTO_MASK_UP_SHIFT,0,1);
  return {...b,x:x0,y:y0,w:x1-x0,h:y1-y0};
 }
 function apply(canvas,boxes){const ctx=canvas.getContext('2d');ctx.save();ctx.fillStyle='#fff';for(const raw of boxes){const b=expandedMaskBox(raw);ctx.fillRect(Math.floor(b.x*canvas.width),Math.floor(b.y*canvas.height),Math.ceil(b.w*canvas.width),Math.ceil(b.h*canvas.height));}ctx.restore()}
 function candidates(canvas){
  // Chiyoda's circular reception stamp in the three reference PDFs is at the bottom of the petition page.
  // Analyze the bottom 32% only. Normalized dimensions make the rule independent of scan DPI.
  const w=600,h=Math.round(canvas.height*600/canvas.width),cv=document.createElement('canvas');
  cv.width=w;cv.height=h;const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,w,h);
  const d=ctx.getImageData(0,0,w,h).data,ink=new Uint8Array(w*h);
  for(let i=0;i<ink.length;i++){const j=i*4,r=d[j],g=d[j+1],b=d[j+2];ink[i]=(Math.min(r,g,b)<175)?1:0;}
  const at=(x,y)=>x>=0&&x<w&&y>=0&&y<h?ink[y*w+x]:0;
  const angles=Array.from({length:48},(_,i)=>i*Math.PI/24),found=[];
  const radii=[];for(let r=Math.round(w*MIN_RATIO/2);r<=Math.round(w*MAX_RATIO/2);r+=2)radii.push(r);
  const y0=Math.round(h*.68),y1=Math.round(h*.98);
  for(let cy=y0;cy<y1;cy+=4)for(let cx=35;cx<w-35;cx+=4){
   for(const rad of radii){if(cx-rad<0||cx+rad>=w||cy-rad<0||cy+rad>=h)continue;
    let hits=0;for(const a of angles){const xx=cx+Math.cos(a)*rad,yy=cy+Math.sin(a)*rad;
     if(at(Math.round(xx),Math.round(yy))||at(Math.round(cx+Math.cos(a)*(rad-2)),Math.round(cy+Math.sin(a)*(rad-2)))||at(Math.round(cx+Math.cos(a)*(rad+2)),Math.round(cy+Math.sin(a)*(rad+2))))hits++;
    }
    const score=hits/angles.length;
    // Require a mostly complete circular outline; text alone generally does not pass this threshold.
    if(score>=.78)found.push({x:(cx-rad-4)/w,y:(cy-rad-4)/h,w:(rad*2+8)/w,h:(rad*2+8)/h,kind:'丸',score});
   }
  }
  found.sort((a,b)=>b.score-a.score);
  const keep=[];
  for(const b of found){const bx=b.x+b.w/2,by=b.y+b.h/2;
   if(keep.some(k=>Math.hypot((bx-k.x-k.w/2)*w,(by-k.y-k.h/2)*h)<24))continue;
   keep.push(b);if(keep.length>=5)break;
  }
  return keep;
 }
 async function review(pdf,render){reset();const root=reviewEl();for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
  const page=await pdf.getPage(pageNo),source=await render(page,1.25),detected=candidates(source);
  const wrap=document.createElement('div');wrap.className='stamp-page';
  const h4=document.createElement('h4');h4.textContent=`${pageNo}ページ目｜候補 ${detected.length}件`;wrap.append(h4);
  const surface=document.createElement('div');surface.className='stamp-surface';
  const view=document.createElement('canvas');view.width=source.width;view.height=source.height;view.getContext('2d').drawImage(source,0,0);surface.append(view);
  const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');overlay.classList.add('stamp-overlay');overlay.setAttribute('viewBox','0 0 1000 1000');overlay.setAttribute('preserveAspectRatio','none');surface.append(overlay);wrap.append(surface);
  const list=document.createElement('div');list.className='stamp-list';wrap.append(list);root.append(wrap);
  const active=[];selected.set(pageNo,active);let manual=[];let draft=null;
  function draw(){overlay.replaceChildren();for(const raw of active){const b=expandedMaskBox(raw);const r=document.createElementNS('http://www.w3.org/2000/svg','rect');r.setAttribute('x',b.x*1000);r.setAttribute('y',b.y*1000);r.setAttribute('width',b.w*1000);r.setAttribute('height',b.h*1000);r.setAttribute('class',b.kind==='手動'?'stamp-manual':'stamp-mark');overlay.append(r)}if(draft){const r=document.createElementNS('http://www.w3.org/2000/svg','rect');for(const [key,val] of Object.entries({x:draft.x*1000,y:draft.y*1000,width:draft.w*1000,height:draft.h*1000}))r.setAttribute(key,val);r.setAttribute('class','stamp-draft');overlay.append(r)}}
  detected.forEach((b,i)=>{const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';label.append(check);label.append(document.createTextNode(` ${b.kind}型候補 ${i+1}（信頼度目安 ${Math.round(b.score*100)}%／除外枠は直径の約1.5倍・約1文字分上へ）`));list.append(label);check.onchange=()=>{if(check.checked)active.push(b);else{const ix=active.indexOf(b);if(ix>=0)active.splice(ix,1)}draw()}});
  if(!detected.length){const span=document.createElement('span');span.textContent='候補なし。画像上でドラッグして手動指定できます。';list.append(span)}
  const clear=document.createElement('button');clear.type='button';clear.className='secondary';clear.textContent='このページの手動枠を消す';clear.onclick=()=>{for(const b of manual){const ix=active.indexOf(b);if(ix>=0)active.splice(ix,1)}manual=[];draw()};wrap.append(clear);
  let start=null;
  function pt(e){const r=surface.getBoundingClientRect();return{x:clamp((e.clientX-r.left)/r.width,0,1),y:clamp((e.clientY-r.top)/r.height,0,1)}}
  surface.addEventListener('pointerdown',e=>{start=pt(e);surface.setPointerCapture(e.pointerId);e.preventDefault()});
  surface.addEventListener('pointermove',e=>{if(!start)return;const end=pt(e);draft={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(start.x-end.x),h:Math.abs(start.y-end.y)};draw()});
  surface.addEventListener('pointerup',e=>{if(!start)return;const end=pt(e);const b={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(start.x-end.x),h:Math.abs(start.y-end.y),kind:'手動'};start=null;draft=null;if(b.w>.01&&b.h>.01){active.push(b);manual.push(b)}draw()});
  draw();
 }}
 return {reset,get,apply,review,candidates,calibration,clearCalibration};
})();
