(function(){
'use strict';
const $=id=>document.getElementById(id);
const core=window.KWCore;
const STORE='KW_BODRUM_MANUEL_JSON_PANEL_V2';
const number=n=>new Intl.NumberFormat('tr-TR').format(n);
const percent=(n,total)=>total?`%${new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n*100/total)}`:'%0,00';
let published=core.normalizeSnapshot(JSON.parse($('fallbackData').textContent));
let current=published;
let pending=null;
let activeOrigin='baseline';
function notify(message,type='success'){
  const div=$('alert');div.textContent=message;div.className='alert '+type;div.hidden=false;
}
function labelPeriodType(){
  const mode=$('periodType').value;
  $('periodValue').disabled=mode==='all';
  const prev=$('periodValue').value;
  $('periodValue').replaceChildren();
  const options=core.periodList(current,mode);
  for(const o of options)$('periodValue').add(new Option(o.label,o.value));
  if(options.some(o=>o.value===prev))$('periodValue').value=prev;
}
function populate(table,rows,total){
  const dest=$(table);dest.replaceChildren();
  if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.className='empty-row';td.textContent='Bu dönemde kayıt yok';tr.append(td);dest.append(tr);return}
  for(const [name,count] of rows){
    const tr=document.createElement('tr');
    for(const v of [name,number(count),`(${percent(count,total)})`]){const td=document.createElement('td');td.textContent=v;tr.append(td)}
    dest.append(tr);
  }
}
function render(){
  const mode=$('periodType').value;
  const chosen=$('periodValue').value;
  const s=core.forPeriod(current,mode,chosen);
  $('viewTitle').textContent=mode==='all'?'Tüm dönemler':$('periodValue').selectedOptions[0]?.textContent||'—';
  $('total').textContent=number(s.total);
  $('estimateBadge').hidden=!s.estimated;
  for(const [key,num,pct,bar] of [['positive','positive','positivePct','positiveBar'],['negative','negative','negativePct','negativeBar'],['pending','pending','pendingPct','pendingBar']]){
    $(num).textContent=number(s[key]);$(pct).textContent=percent(s[key],s.total);
    $(bar).style.width=s.total?`${Math.min(100,s[key]*100/s.total)}%`:'0%';
  }
  for(const [name,table,badge,suffix] of [['people','peopleRows','peopleCount','kişi'],['regions','regionsRows','regionsCount','bölge'],['budgets','budgetsRows','budgetsCount','bütçe']]){
    populate(table,s[name],s.total);$(badge).textContent=`${s[name].length} ${suffix}`;
  }
  $('sourceLabel').textContent=activeOrigin==='local'?'Yerel önizleme':activeOrigin==='published'?'GitHub yayın verisi':'Başlangıç raporu';
  const dt=current.generatedAt?new Date(current.generatedAt):null;
  $('updatedAt').textContent=dt&&!Number.isNaN(dt.valueOf())?`Son rapor: ${dt.toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})}`:'İlk hafta yüklü';
}
function applySnapshot(snapshot,source){
  current=core.normalizeSnapshot(snapshot);activeOrigin=source;
  labelPeriodType();render();
}
async function load(){
  try{
    const resp=await fetch('./data/rapor.json?t='+Date.now(),{cache:'no-store'});
    if(resp.ok){published=core.normalizeSnapshot(await resp.json());activeOrigin='published'}
  }catch(e){/* file:// önizleme için gömülü başlangıç verisi kullanılır. */}
  try{
    const raw=localStorage.getItem(STORE);
    if(raw){const local=core.normalizeSnapshot(JSON.parse(raw));
      if(Date.parse(local.generatedAt||'')>Date.parse(published.generatedAt||'')){
        applySnapshot(local,'local');return;
      }
    }
  }catch(e){console.warn('Yerel önizleme okunamadı',e)}
  applySnapshot(published,activeOrigin);
}
function downloadFile(filename,text){
  const blob=new Blob([text],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
async function onFile(event){
  const file=event.target.files?.[0];event.target.value='';
  if(!file)return;
  if(file.size>25*1024*1024){notify('Dosya 25 MB sınırını aşıyor.','error');return}
  try{
    const json=JSON.parse(await file.text());
    const result=core.importExtension(current,json);
    if(result.summary.unchanged){notify(`Yeni hafta bulunamadı. Başlangıç dönemine ait ${result.summary.ignoredOld} kayıt atlandı. 26–31 Ekim haftasının 63 arayışı raporda zaten mevcut.`, 'error');return}
    pending=result;
    const s=result.summary;
    $('importTitle').textContent=`${file.name} · İçe aktarım önizlemesi`;
    $('importSummary').textContent=`${number(s.imported)} yeni dönem kaydı değerlendirildi. Güncellenecek dönemler: ${s.changedWeeks.map(w=>w.label).join(', ')}.`;
    $('importDetail').textContent=`Başlangıç haftasıyla çakıştığı için atlanan: ${s.ignoredOld} · Hatalı tarihli: ${s.ignoredBad} · Dosya içi tekrar: ${s.duplicate}. Seçili haftaların önceki toplamları, bu JSON'daki tam kayıtlarla DEĞİŞTİRİLİR; toplanmaz.`;
    $('importReview').hidden=false;$('alert').hidden=true;
    $('importReview').scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(err){notify('İçe aktarılamadı: '+(err?.message||err),'error')}
}
function confirmImport(){
  if(!pending)return;
  try{
    localStorage.setItem(STORE,JSON.stringify(pending.snapshot));
    const changed=pending.summary.changedWeeks;
    applySnapshot(pending.snapshot,'local');
    $('periodType').value='week';labelPeriodType();
    if(changed.length)$('periodValue').value=changed[changed.length-1].start;
    render();
    notify('Veriler bu tarayıcıda güncellendi. Diğer cihazlarda da görünmesi için “Yayın JSON’unu indir” düğmesinden rapor.json dosyasını indirip GitHub deposundaki data/rapor.json dosyasının yerine yüklemelisin.');
    pending=null;$('importReview').hidden=true;
  }catch(e){notify('Yerel kayıt yapılamadı: '+e.message,'error')}
}
function downloadPublish(){
  downloadFile('rapor.json',core.toPublicDownload(current));
  notify('rapor.json indirildi. GitHub deposundaki data/rapor.json dosyasını bununla değiştirerek siteyi tüm cihazlarda güncelleyebilirsin. Ham arayış metinleri bu dosyada yoktur; gönderen adları ve toplu istatistikler vardır.');
}
$('periodType').addEventListener('change',()=>{labelPeriodType();render()});
$('periodValue').addEventListener('change',render);
$('fileInput').addEventListener('change',onFile);
$('confirmImport').addEventListener('click',confirmImport);
$('cancelImport').addEventListener('click',()=>{pending=null;$('importReview').hidden=true});
$('downloadPublic').addEventListener('click',downloadPublish);
load();
})();
