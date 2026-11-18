'use strict';
const $=id=>document.getElementById(id);const APP_VERSION='v2.10.0';let pdf=null,worker=null,abort=false;const MAX_BYTES=15*1024*1024,MAX_PAGES=20;
const known={"2026-7chinjou.pdf":{number:'送付8-7',committee:'企画総務委員会',date:'令和8年2月20日',title:'新宿区において顕在化した事例を受けて、政党機関紙の庁舎内勧誘行為に関する早期の実態把握と再発防止を求める陳情'},"2026-9chinjou.pdf":{number:'送付8-9',committee:'企画総務委員会',date:'令和8年3月11日',title:'アキバ文化を守るためにAIによる日本のIP侵害への対策を求める陳情'},"2026-3chinjou.pdf":{number:'送付8-3',committee:'企画総務委員会',date:'令和8年2月9日',title:'陳情書　旧永田町小学校・校舎を残して下さい。'}};
function status(s){$('status').textContent=s}function progress(v){$('bar').style.width=Math.max(0,Math.min(100,v))+'%'}
function libs(){if(!window.pdfjsLib||!window.Tesseract||!window.docx)throw Error('必要なライブラリが読み込めません。インターネット接続と広告ブロック設定を確認してください。');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'}
function selectFile(f){if(window.StampMask)StampMask.reset();$('detectStamps').disabled=!f;pdf=null;$('preview').replaceChildren();progress(0);$('extract').disabled=true;if(!f)return;if(!/\.pdf$/i.test(f.name)||f.size>MAX_BYTES){status('PDF形式・15MB以下のファイルを選択してください。');return} $('fileinfo').textContent=`${f.name} / ${(f.size/1024).toFixed(0)} KB`;$('extract').disabled=false;let m=known[f.name];if(m)for(let k of ['number','committee','date','title'])$(k).value=m[k];status('PDFを選択しました。読み取り方法を選んで実行してください。')}
$('file').addEventListener('change',e=>selectFile(e.target.files[0]));$('drop').addEventListener('dragover',e=>{e.preventDefault()});$('drop').addEventListener('drop',e=>{e.preventDefault();let f=e.dataTransfer.files[0];if(f){$('file').files=e.dataTransfer.files;selectFile(f)}});
$('cancel').onclick=()=>{abort=true;status('中止を要求しました。現在のページの処理終了後に停止します。')};
function normalize(items){let a=items.filter(i=>typeof i.str==='string'&&i.str.trim());let lines=[],lastY=null,current='';for(let i of a){let y=Math.round(i.transform?.[5]||0);if(lastY!==null&&Math.abs(y-lastY)>5){lines.push(current.trim());current=''}current+=i.str+(i.hasEOL?'\n':' ');lastY=y}if(current.trim())lines.push(current.trim());return lines.join('\n').replace(/ {2,}/g,' ').trim()}
function proposeMetadata(cover){
 const compact=cover.replace(/[\t ]+/g,' ').replace(/\s*[-－ー]\s*/g,'－');
 const n=compact.match(/送付\s*[０-９0-9]+\s*[－-]\s*[０-９0-9]+/);
 if(n&&!$('number').value.trim())$('number').value=n[0].replace(/\s/g,'');
 const d=compact.match(/(?:令和|平成)\s*[０-９0-9]+\s*年\s*[０-９0-9]+\s*月\s*[０-９0-9]+\s*日/);
 if(d&&!$('date').value.trim())$('date').value=d[0].replace(/\s/g,'');
 const lines=cover.split('\n').map(x=>x.trim()).filter(Boolean);
 if(!$('title').value.trim()){
  const idx=lines.findIndex(x=>/陳情|請願/.test(x)&&!/(受付|提出者|陳情者|送付)/.test(x));
  if(idx>=0)$('title').value=lines[idx].replace(/^件\s*名\s*/,'').trim();
 }
 const c=lines.find(x=>/委員会/.test(x));if(c&&c.length<45)$('committee').value=c.replace(/送付.*$/,'').trim();
}
function cleanOCRText(s){return s.replace(/([^\x00-\x7F]) +(?=[^\x00-\x7F])/g,'$1').replace(/ {2,}/g,' ').replace(/\n{4,}/g,'\n\n\n')}
async function getWorker(){if(worker)return worker;status('日本語OCRモデルを準備中。初回はダウンロードに時間がかかります…');worker=await Tesseract.createWorker('jpn+eng',1,{logger:m=>{if(m.status==='recognizing text')status('画像OCR中… '+Math.round((m.progress||0)*100)+'%')}});return worker}
async function render(page,scale=1.55){const vp=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport:vp}).promise;return canvas}
$('extract').onclick=async()=>{abort=false;$('extract').disabled=true;$('cancel').disabled=false;try{libs();let file=$('file').files[0];if(!file)throw Error('PDFを選択してください');let data=await file.arrayBuffer();pdf=await pdfjsLib.getDocument({data:new Uint8Array(data)}).promise;if(pdf.numPages>MAX_PAGES)throw Error(`ページ数が多すぎます（${pdf.numPages}ページ）。最大${MAX_PAGES}ページです。`);let start=$('skipCover').checked?2:1;if(start>pdf.numPages)throw Error('読み取り対象ページがありません。');// Read the council cover separately to propose metadata without including it in body.
 const cover=normalize((await (await pdf.getPage(1)).getTextContent()).items);proposeMetadata(cover);
 if(!$('number').value.trim()){let m=cover.match(/送付\s*[８8]\s*[-－ー]\s*[０-９0-9]+/);if(m)$('number').value=m[0].replace(/\s/g,'');}
 if(!$('date').value.trim()){let m=cover.match(/(?:令和|平成)\s*[０-９0-9]+\s*年\s*[０-９0-9]+\s*月\s*[０-９0-9]+\s*日/);if(m)$('date').value=m[0].replace(/\s/g,'');}
 let texts=[];$('preview').replaceChildren();for(let p=start;p<=pdf.numPages;p++){if(abort)throw Error('ユーザーが処理を中止しました');status(`ページ ${p}/${pdf.numPages} を解析中…`);const page=await pdf.getPage(p);const content=await page.getTextContent();let text=normalize(content.items);let forced=$('forceOCR').checked;let stampBoxes=window.StampMask?StampMask.get(p):[];let isHandwritten=/2026-3chinjou\.pdf$/i.test(file.name);let shouldOCR=forced||isHandwritten||stampBoxes.length>0||text.replace(/\s/g,'').length<35;if(shouldOCR){const canvas=await render(page);if($('maskTop')?.checked){const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height*0.12)}if(stampBoxes.length){StampMask.apply(canvas,stampBoxes)}let thumb=document.createElement('canvas');let scale=Math.min(1,180/canvas.width);thumb.width=Math.round(canvas.width*scale);thumb.height=Math.round(canvas.height*scale);thumb.getContext('2d').drawImage(canvas,0,0,thumb.width,thumb.height);thumb.title=`${p}ページ目`;thumb.setAttribute('aria-label',`${p}ページ目のプレビュー`);$('preview').append(thumb);const w=await getWorker();const res=await w.recognize(canvas);text=res.data.text||''}texts.push(`【${p}ページ】\n${cleanOCRText(text.trim())}`);progress(((p-start+1)/(pdf.numPages-start+1))*100)}$('bodytext').value=texts.join('\n\n');status(`完了：${texts.length}ページを読み取りました。手書きOCRは精度が低く、原文との照合・修正が必須です。`)}catch(e){status('処理できませんでした：'+e.message)}finally{$('extract').disabled=false;$('cancel').disabled=true}};
function txt(s,bold=false,size=20){return new docx.TextRun({text:String(s||''),bold,size,font:'Yu Mincho'})}function p(s,opt={}){return new docx.Paragraph({children:[txt(s,opt.bold,opt.size||20)],spacing:{after:opt.after??120},...opt})}function cell(s,w=100,opts={}){return new docx.TableCell({width:{size:w,type:docx.WidthType.PERCENTAGE},verticalAlign:docx.VerticalAlign.CENTER,children:[p(s,{after:0})],margins:{top:120,bottom:120,left:130,right:130},...opts})}
// v2: page-sized body frames. Each page has an independent table with an EXACT
// row height, so the bottom border stays near the printable page bottom.
// Pagination is conservative and deliberately editable; final visual check is required.
function makeParagraph(s,options={}){
  return new docx.Paragraph({children:[new docx.TextRun({text:s||' ',font:'Yu Mincho',size:20,bold:!!options.bold})],spacing:{before:0,after:options.after??35,line:290},keepTogether:true});
}
function splitTextLines(text,maxUnits=46){
  // Approximate Japanese fullwidth characters as 1 unit and Latin as 0.55.
  const units=c=>/[\u0000-\u007f\uff61-\uff9f]/.test(c)?0.55:1;
  const out=[];
  for(const raw of text.replace(/\r/g,'').split('\n')){
    if(!raw){out.push('');continue;}
    let part='',count=0;
    for(const c of raw){let n=units(c);if(part&&count+n>maxUnits){out.push(part);part='';count=0;}part+=c;count+=n;}
    out.push(part);
  }
  return out;
}
function paginateBody(text,firstLines=27,otherLines=39){
  let lines=splitTextLines(text),pages=[],capacity=firstLines;
  while(lines.length){pages.push(lines.splice(0,capacity));capacity=otherLines;}
  return pages.length?pages:[['']];
}
function frameTable(lines,heightTwips){
  const D=docx;
  const content=lines.map(s=>makeParagraph(s));
  const borders={top:{style:D.BorderStyle.SINGLE,size:8,color:'111827'},bottom:{style:D.BorderStyle.SINGLE,size:8,color:'111827'},left:{style:D.BorderStyle.SINGLE,size:8,color:'111827'},right:{style:D.BorderStyle.SINGLE,size:8,color:'111827'}};
  return new D.Table({width:{size:100,type:D.WidthType.PERCENTAGE},layout:D.TableLayoutType.FIXED,
    rows:[new D.TableRow({cantSplit:true,height:{value:heightTwips,rule:D.HeightRule.EXACT},children:[new D.TableCell({children:content,verticalAlign:D.VerticalAlign.TOP,margins:{top:140,bottom:90,left:170,right:170},borders})]})]});
}
// Ota Ward reference: committee is an independent right-aligned box;
// first metadata row contains number/date side-by-side, followed by title and petitioner.
function metadataTable(){
 const D=docx,b={style:D.BorderStyle.SINGLE,size:7,color:'222222'};
 const borders={top:b,bottom:b,left:b,right:b};
 const c=(value,width,opts={})=>new D.TableCell({width:{size:width,type:D.WidthType.DXA},borders,children:[new D.Paragraph({children:[txt(value,false,19)],spacing:{after:0},alignment:opts.align||D.AlignmentType.LEFT})],margins:{top:90,bottom:90,left:130,right:110}});
 const rows=[
  new D.TableRow({cantSplit:true,children:[c('受理番号',1350),c($('number').value,3100),c('受理年月日',1500),c($('date').value,3850)]}),
  new D.TableRow({cantSplit:true,children:[c('件　名',1350),new D.TableCell({columnSpan:3,borders,children:[p($('title').value||'（件名未入力）',{after:0})],margins:{top:130,bottom:130,left:130,right:110}})]}),
  new D.TableRow({cantSplit:true,children:[c('提 出 者',1350),new D.TableCell({columnSpan:3,borders,children:[p($('petitioner').value,{after:0})],margins:{top:130,bottom:130,left:130,right:110}})]})
 ];
 return new D.Table({width:{size:9800,type:D.WidthType.DXA},columnWidths:[1350,3100,1500,3850],layout:D.TableLayoutType.FIXED,rows});
}
function committeeTable(){
 const D=docx,b={style:D.BorderStyle.SINGLE,size:7,color:'222222'};
 const make=(t,w)=>new D.TableCell({width:{size:w,type:D.WidthType.DXA},borders:{top:b,bottom:b,left:b,right:b},children:[p(t,{after:0})],margins:{top:60,bottom:60,left:110,right:90}});
 return new D.Table({alignment:D.AlignmentType.RIGHT,width:{size:5400,type:D.WidthType.DXA},columnWidths:[1600,3800],layout:D.TableLayoutType.FIXED,rows:[new D.TableRow({children:[make('付託委員会',1600),make($('committee').value,3800)]})]});
}
function bodyFrame(lines, height){
 const D=docx,b={style:D.BorderStyle.SINGLE,size:7,color:'222222'};
 return new D.Table({width:{size:9800,type:D.WidthType.DXA},columnWidths:[9800],layout:D.TableLayoutType.FIXED,rows:[new D.TableRow({cantSplit:true,height:{value:height,rule:D.HeightRule.EXACT},children:[new D.TableCell({borders:{top:b,bottom:b,left:b,right:b},margins:{top:140,bottom:110,left:150,right:150},children:lines.map(t=>makeParagraph(t))})]})]});
}
$('download').onclick=async()=>{
 try{
  if(!window.docx)throw Error('Word生成ライブラリを読み込めません');
  const D=docx,heading=$('title').value.trim()||'（件名未入力）';
  let body=$('bodytext').value.replace(/\r/g,'').trim();
  if(!body&&!$('purpose').value.trim())throw Error('本文または趣旨を入力してください');
  body=body.replace(/^【\d+ページ】\s*\n?/gm,'').trim();
  const full=($('purpose').value.trim()?'【趣　旨】\n'+$('purpose').value.trim()+'\n\n':'')+'【理　由】\n'+body;
  // Conservative line counts: keep content inside fixed frames rather than allowing Word
  // to spill a table row to the next page. Each physical page is a separate section.
  const pages=paginateBody(full,27,39);
  const page={size:{width:11906,height:16838},margin:{top:680,right:1053,bottom:720,left:1053}};
  const sections=pages.map((lines,i)=>{
   const children=[];
   if(i===0){
    children.push(committeeTable());
    children.push(new D.Paragraph({text:'',spacing:{after:60},run:{size:2}}));
    children.push(metadataTable());
    children.push(new D.Paragraph({text:'',spacing:{after:0},run:{size:2}}));
   }
   children.push(bodyFrame(lines,i===0?13100:15000));
   return {properties:{type:i===0?D.SectionType.CONTINUOUS:D.SectionType.NEXT_PAGE,page},children};
  });
  const wordDocument=new D.Document({creator:'議会文書表 変換ラボ v2.10（非公式実験版）',title:heading,sections});
  const blob=await D.Packer.toBlob(wordDocument);
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
  a.download='陳情文書表_v2_6_'+($('number').value||'変換結果').replace(/[^\w\u3040-\u30ff\u3400-\u9fff-]/g,'_')+'.docx';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  $('outstatus').textContent=`v2.10：Wordを生成しました（${pages.length}ページ想定）。下枠・ページ数をWordで確認してください。`;
 }catch(e){$('outstatus').textContent='出力できませんでした：'+e.message;}
};
$('clear').onclick=()=>{if(!confirm('入力内容をすべて消去しますか？'))return;for(let k of ['number','date','title','purpose','bodytext'])$(k).value='';$('petitioner').value='提出者 1名';$('committee').value='企画総務委員会';$('outstatus').textContent='';status('入力をクリアしました。')};
window.addEventListener('load',()=>{if($('buildVersion'))$('buildVersion').textContent='プログラム版：'+APP_VERSION+'（読み込み済み）';try{libs();status('v2.10 準備完了。PDFを選択してください。')}catch(e){status(e.message)}});

$('detectStamps').onclick=async()=>{try{libs();const file=$('file').files[0];if(!file)throw Error('PDFを選択してください');$('detectStamps').disabled=true;$('stampStatus').textContent='収受印候補を検出中…';const data=await file.arrayBuffer();const doc=await pdfjsLib.getDocument({data:new Uint8Array(data)}).promise;await StampMask.review(doc,render);$('stampStatus').textContent='候補を確認してチェックを入れるか、画像上をドラッグして除外範囲を指定してください。';}catch(e){$('stampStatus').textContent='検出エラー：'+e.message}finally{$('detectStamps').disabled=false}};
$('clearStamps').onclick=()=>{StampMask.reset();$('stampStatus').textContent='除外範囲をクリアしました。'};

