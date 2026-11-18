'use strict';
/* Geometric stamp candidates are advisory only. User must explicitly select. */
window.StampMask=(()=>{
 const selected=new Map();
 const reviewEl=()=>document.getElementById('stampReview');
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function reset(){selected.clear();if(reviewEl())reviewEl().replaceChildren()}
 function get(page){return (selected.get(page)||[]).map(x=>({...x}))}
 function apply(canvas,boxes){const ctx=canvas.getContext('2d');ctx.save();ctx.fillStyle='#fff';for(const b of boxes)ctx.fillRect(Math.floor(b.x*canvas.width),Math.floor(b.y*canvas.height),Math.ceil(b.w*canvas.width),Math.ceil(b.h*canvas.height));ctx.restore()}
 function candidates(canvas){
  // Limit analysis to the upper 55%: stamps elsewhere can be manually marked.
  const w=600,h=Math.round(canvas.height*600/canvas.width),cv=document.createElement('canvas');cv.width=w;cv.height=h;
  const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(canvas,0,0,w,h);
  const data=cx.getImageData(0,0,w,h).data;const ink=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];ink[y*w+x]=(Math.min(r,g,b)<155 || (r>g*1.35&&r>b*1.2&&r<240))?1:0}
  const at=(x,y)=>x>=0&&x<w&&y>=0&&y<h?ink[y*w+x]:0;
  function densityH(x,y,len){let sum=0;for(let k=0;k<len;k+=2)sum+=at(x+k,y);return sum/Math.ceil(len/2)}
  function densityV(x,y,len){let sum=0;for(let k=0;k<len;k+=2)sum+=at(x,y+k);return sum/Math.ceil(len/2)}
  const found=[];
  // Rectangle candidates: long top/bottom horizontal lines plus side strokes.
  for(let y=8;y<Math.min(h*.55,420);y+=3){for(let x=10;x<w-65;x+=6){
   if(!at(x,y))continue;
   for(let side=54;side<=180;side+=14){if(x+side>=w)break;
    const top=densityH(x,y,side);if(top<.72)continue;
    for(let ht=36;ht<=Math.min(150,side*1.5);ht+=12){if(y+ht>=h*.62)break;
     const bot=densityH(x,y+ht,side),left=densityV(x,y,ht),right=densityV(x+side,y,ht);
     if(bot>.66&&left>.54&&right>.54){const score=(top+bot+left+right)/4;
      if(score>.72)found.push({x:x/w,y:y/h,w:side/w,h:ht/h,kind:'四角',score});}
    }
   }
  }}
  // Circle candidates: radial samples over a narrow annulus, tolerant of imperfect ink.
  const angles=Array.from({length:32},(_,i)=>i*Math.PI/16);
  for(let cy=32;cy<Math.min(h*.52,400);cy+=9)for(let cx0=34;cx0<w-34;cx0+=9){
   for(let rad=21;rad<=80;rad+=6){if(cx0-rad<0||cx0+rad>=w||cy-rad<0||cy+rad>=h*.62)continue;
    let hits=0;for(const a of angles){let yes=false;for(const rr of [rad-2,rad,rad+2]){const xx=Math.round(cx0+Math.cos(a)*rr),yy=Math.round(cy+Math.sin(a)*rr);if(at(xx,yy)){yes=true;break}}if(yes)hits++}
    const score=hits/angles.length;if(score>=.81)found.push({x:(cx0-rad)/w,y:(cy-rad)/h,w:2*rad/w,h:2*rad/h,kind:'丸',score});
   }
  }
  found.sort((a,b)=>b.score-a.score);
  const keep=[];for(const b of found){const cx=b.x+b.w/2,cy=b.y+b.h/2;if(keep.some(k=>Math.abs(cx-k.x-k.w/2)<Math.min(b.w,k.w)*.38&&Math.abs(cy-k.y-k.h/2)<Math.min(b.h,k.h)*.38))continue;keep.push(b);if(keep.length>=8)break}
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
  function draw(){overlay.replaceChildren();for(const b of active){const r=document.createElementNS('http://www.w3.org/2000/svg','rect');r.setAttribute('x',b.x*1000);r.setAttribute('y',b.y*1000);r.setAttribute('width',b.w*1000);r.setAttribute('height',b.h*1000);r.setAttribute('class',b.kind==='手動'?'stamp-manual':'stamp-mark');overlay.append(r)}if(draft){const r=document.createElementNS('http://www.w3.org/2000/svg','rect');for(const [key,val] of Object.entries({x:draft.x*1000,y:draft.y*1000,width:draft.w*1000,height:draft.h*1000}))r.setAttribute(key,val);r.setAttribute('class','stamp-draft');overlay.append(r)}}
  detected.forEach((b,i)=>{const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';label.append(check);label.append(document.createTextNode(` ${b.kind}型候補 ${i+1}（信頼度目安 ${Math.round(b.score*100)}%）`));list.append(label);check.onchange=()=>{if(check.checked)active.push(b);else{const ix=active.indexOf(b);if(ix>=0)active.splice(ix,1)}draw()}});
  if(!detected.length){const span=document.createElement('span');span.textContent='候補なし。画像上でドラッグして手動指定できます。';list.append(span)}
  const clear=document.createElement('button');clear.type='button';clear.className='secondary';clear.textContent='このページの手動枠を消す';clear.onclick=()=>{for(const b of manual){const ix=active.indexOf(b);if(ix>=0)active.splice(ix,1)}manual=[];draw()};wrap.append(clear);
  let start=null;
  function pt(e){const r=surface.getBoundingClientRect();return{x:clamp((e.clientX-r.left)/r.width,0,1),y:clamp((e.clientY-r.top)/r.height,0,1)}}
  surface.addEventListener('pointerdown',e=>{start=pt(e);surface.setPointerCapture(e.pointerId);e.preventDefault()});
  surface.addEventListener('pointermove',e=>{if(!start)return;const end=pt(e);draft={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(start.x-end.x),h:Math.abs(start.y-end.y)};draw()});
  surface.addEventListener('pointerup',e=>{if(!start)return;const end=pt(e);const b={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(start.x-end.x),h:Math.abs(start.y-end.y),kind:'手動'};start=null;draft=null;if(b.w>.01&&b.h>.01){active.push(b);manual.push(b)}draw()});
  draw();
 }}
 return {reset,get,apply,review,candidates};
})();
