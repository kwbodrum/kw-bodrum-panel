(() => {
'use strict';
const $ = id => document.getElementById(id);
const formatN = n => new Intl.NumberFormat('tr-TR').format(n);
const percent = (n, total) => total ? '%' + new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2, maximumFractionDigits:2}).format(n*100/total) : '%0,00';
const formatDate = d => d.split('-').reverse().join('.');
const apiBase = String(window.KW_CONFIG?.apiBase || '').replace(/\/$/, '');
let token = '';
try { token = sessionStorage.getItem('kw_panel_read_token') || ''; } catch {}
let source = {historicalWeeks: [], records: [], generatedAt: null};
let activeSource = 'none';
let timer = null;
let buckets = [];
function byMonth(iso) { return iso.slice(0,7); }
function istanbulDate(ts) { // TR sabit UTC+3; tarih dilimlemesi cihaz saat diliminden bağımsız.
  return new Date(ts + 3 * 3600000).toISOString().slice(0,10);
}
function asUtcDate(iso){return new Date(iso+'T00:00:00Z');}
function toISO(d){return d.toISOString().slice(0,10);}
function shift(iso,n){const d=asUtcDate(iso);d.setUTCDate(d.getUTCDate()+n);return toISO(d);}
function workWeek(iso){
  const day=asUtcDate(iso).getUTCDay();
  if(day===0)return {start:iso,end:iso,label:formatDate(iso)+' · Pazar'};
  const start=shift(iso,1-day);
  return {start,end:shift(start,5),label:formatDate(start)+' – '+formatDate(shift(start,5))};
}
function blank(start,end){return {start,end,total:0,positive:0,negative:0,pending:0,people:[],regions:[],budgets:[],estimated:false};}
function budgetLabel(b){
  if(!b || !Number.isFinite(Number(b.amount)) || Number(b.amount)<=0)return 'Üst bütçe belirtilmemiş';
  return formatN(Number(b.amount))+' '+(b.currency==='TRY'?'TL':b.currency||'TL');
}
function add(map,label,qty=1){label=String(label||'').trim();if(!label)return;map.set(label,(map.get(label)||0)+qty);}
function toList(map){return [...map].filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'tr'));}
function buildData(input=source, addEmptyWeek=true){
  const map = new Map();
  function ensure(start,end){if(!map.has(start))map.set(start,{...blank(start,end),_p:new Map(),_r:new Map(),_b:new Map()});return map.get(start)}
  for(const w of input.historicalWeeks||[]){
    if(!w || !w.start || w.total==null)continue;
    const dest=ensure(w.start,w.end);
    dest.total+=Number(w.total)||0;
    dest.positive+=Number(w.positive)||0;
    dest.negative+=Number(w.negative)||0;
    dest.pending+=Number(w.pending)||0;
    dest.estimated ||= !!w.estimated;
    for(const [label,n] of w.people||[])add(dest._p,label,Number(n)||0);
    for(const [label,n] of w.regions||[])add(dest._r,label,Number(n)||0);
    for(const [label,n] of w.budgets||[])add(dest._b,label,Number(n)||0);
  }
  const ids=new Set();
  for(const rec of input.records||[]){
    if(!rec || !Number.isFinite(Number(rec.eventMs)) || ids.has(rec.id))continue;
    ids.add(rec.id);
    const d=istanbulDate(Number(rec.eventMs)), w=workWeek(d), dest=ensure(w.start,w.end);
    dest.total++;
    if(rec.deliveryStatus==='gonderildi' && rec.matchStatus==='olumlu')dest.positive++;
    else if(rec.deliveryStatus==='gonderildi' && rec.matchStatus==='olumsuz')dest.negative++;
    else dest.pending++;
    add(dest._p,rec.sender || 'Gönderen okunamadı');
    const regions=[...new Set((Array.isArray(rec.regions)?rec.regions:[]).map(x=>String(x).trim()).filter(Boolean))];
    for(const region of regions.length?regions:['Bölge belirtilmemiş'])add(dest._r,region);
    add(dest._b,budgetLabel(rec.maxBudget));
  }
  // İlk ve yeni haftayı ayrı göstermek için boş dönem bile filtrede bulunur.
  if(addEmptyWeek)ensure('2026-11-02','2026-11-07');
  return [...map.values()].map(w=>({...w, people:toList(w._p),regions:toList(w._r),budgets:toList(w._b)}))
    .sort((a,b)=>a.start.localeCompare(b.start));
}
function buildOptions(){
  const mode=$('mode').value;
  const old=$('period').value;
  const period=$('period');period.replaceChildren();
  period.disabled=(mode==='all');
  let opts=[];
  if(mode==='week')opts=buckets.map(w=>({value:w.start,label:workWeek(w.start).label}));
  else if(mode==='month')opts=[...new Set([...buckets.map(w=>byMonth(w.start)),...(source.records||[]).map(r=>istanbulDate(Number(r.eventMs)).slice(0,7))])].sort().map(k=>({value:k,label:k.split('-').reverse().join('.')}));
  else if(mode==='year')opts=[...new Set([...buckets.map(w=>w.start.slice(0,4)),...(source.records||[]).map(r=>istanbulDate(Number(r.eventMs)).slice(0,4))])].sort().map(k=>({value:k,label:k}));
  else opts=[{value:'all',label:'Tüm dönemler'}];
  opts.forEach(o=>period.add(new Option(o.label,o.value)));
  if(opts.some(o=>o.value===old))period.value=old;
}
function currentBuckets(){
  const mode=$('mode').value, choice=$('period').value;
  if(mode==='week')return buckets.filter(w=>w.start===choice);
  if(mode==='month')return buckets.filter(w=>byMonth(w.start)===choice);
  if(mode==='year')return buckets.filter(w=>w.start.slice(0,4)===choice);
  return buckets;
}
function aggregate(ws){
  let stats={total:0,positive:0,negative:0,pending:0,estimated:false};
  const maps={people:new Map(),regions:new Map(),budgets:new Map()};
  for(const w of ws){
    for(const key of ['total','positive','negative','pending'])stats[key]+=w[key];
    stats.estimated ||= w.estimated;
    for(const key of Object.keys(maps))for(const [label,n] of w[key]||[])add(maps[key],label,n);
  }
  for(const key of Object.keys(maps))stats[key]=toList(maps[key]);
  return stats;
}
function drawRows(container,rows,total){
  const tbody=$(container);tbody.replaceChildren();
  if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.className='empty';td.textContent='Bu dönem için kayıt bulunmuyor.';tr.append(td);tbody.append(tr);return;}
  for(const [label,n] of rows){
    const tr=document.createElement('tr');
    for(const value of [label,formatN(n),'('+percent(n,total)+')']){const td=document.createElement('td');td.textContent=value;tr.append(td)}
    tbody.append(tr);
  }
}
function render(){
  const mode=$('mode').value;
  let stats;
  if(mode==='month'||mode==='year'){
    const chosen=$('period').value;
    const marker=(date)=>mode==='month'?date.slice(0,7):date.slice(0,4);
    const filtered={
      historicalWeeks:(source.historicalWeeks||[]).filter(w=>marker(w.start)===chosen),
      // Ay/yıl verisi canlı kaydın kendi tarihinden alınır, haftanın başlangıcından DEĞİL.
      records:(source.records||[]).filter(r=>marker(istanbulDate(Number(r.eventMs)))===chosen)
    };
    stats=aggregate(buildData(filtered,false));
  } else stats=aggregate(currentBuckets());
  $('periodLabel').textContent=mode==='all'?'TÜM DÖNEMLER':$('period').selectedOptions[0]?.textContent.toUpperCase()||'—';
  const loaded=activeSource!=='none';
  $('total').textContent=loaded?formatN(stats.total):'—';
  $('quality').textContent=!loaded?'Bağlantı bekleniyor':stats.estimated?'Tarihsel dönüşlerde tahmin kullanılıyor':'Eklentiden gerçek kayıtlar';
  for(const [key,field] of [['positive','positive'],['negative','negative'],['pending','pending']]){
    $(field).textContent=loaded?formatN(stats[key]):'—';
    $(field+'Pct').textContent=loaded?percent(stats[key],stats.total):'—';
    $(field+'Bar').style.width=stats.total ? `${Math.min(100,100*stats[key]/stats.total)}%` : '0%';
  }
  for(const [list,tbody,badge,suffix] of [['people','peopleRows','personCount','kişi'],['regions','regionRows','regionCount','bölge'],['budgets','budgetRows','budgetCount','bütçe']]){
    drawRows(tbody,stats[list],stats.total);$(badge).textContent=stats[list].length+' '+suffix;
  }
  $('lastUpdate').textContent=source.generatedAt?'Son API sorgusu: '+new Date(source.generatedAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'';
}
function recalc(){buckets=buildData();buildOptions();render();}
async function fetchApi(quiet=false){
  if(!apiBase || apiBase.includes('API_ADRESINIZ')){
    $('loginStatus').textContent='Önce web/config.js içindeki API adresi tanımlanmalı.';
    return;
  }
  if(!token){$('loginStatus').textContent='Yetkili panel okuma anahtarını girin.';return;}
  try{
    const res=await fetch(apiBase+'/v1/report',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
    const body=await res.json();
    if(!res.ok||!body.ok)throw Error(body.error||`HTTP ${res.status}`);
    if(body.schemaVersion!==1 || !Array.isArray(body.records)|| !Array.isArray(body.historicalWeeks))throw Error('Desteklenmeyen API sürümü');
    source=body;activeSource='api';recalc();
    $('connectBadge').textContent='● API bağlantısı açık';$('connectBadge').style.color='#7ce4ab';
    $('refreshBtn').disabled=false;$('loginStatus').className='minor ok';
    if(!quiet)$('loginStatus').textContent='Canlı API bağlantısı kuruldu.';
  }catch(error){
    $('connectBadge').textContent='● API bağlantısı yok';$('connectBadge').style.color='#ff8796';
    if(!quiet)$('loginStatus').textContent='Bağlantı hatası: '+error.message;
  }
}
$('connectBtn').addEventListener('click',()=>{token=$('readToken').value.trim();try{sessionStorage.setItem('kw_panel_read_token',token)}catch{}fetchApi()});
$('refreshBtn').addEventListener('click',()=>fetchApi());
$('filePreview').addEventListener('change',async (e)=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    const payload=JSON.parse(await file.text());
    if(payload.schemaVersion!==1 || !Array.isArray(payload.weeks))throw Error('Geçersiz özel tarihsel dosya');
    source={historicalWeeks:payload.weeks,records:[],generatedAt:null};activeSource='preview';recalc();
    $('connectBadge').textContent='● Yerel önizleme';$('connectBadge').style.color='#ffda8a';
    $('loginStatus').className='minor ok';$('loginStatus').textContent='Tarihsel dosya yalnızca tarayıcınızda açıldı; herhangi bir sunucuya gönderilmedi.';
  }catch(err){$('loginStatus').textContent='Önizleme dosyası hatalı: '+err.message}
  finally{e.target.value=''}
});
$('mode').addEventListener('change',()=>{buildOptions();render()});
$('period').addEventListener('change',render);
recalc();
if(token){$('readToken').value=token;void fetchApi(true)}
const poll=Math.max(30,Number(window.KW_CONFIG?.pollSeconds)||60);
timer=setInterval(()=>{if(activeSource==='api')void fetchApi(true)},poll*1000);
})();
