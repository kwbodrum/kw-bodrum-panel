/* KW Bodrum | statik JSON aktarımının veri katmanı. Ağ isteği yapmaz. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  root.KWCore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const CUTOFF='2026-11-02';
const moneyFormat=new Intl.NumberFormat('tr-TR');
const dateFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'});
const trCollator=new Intl.Collator('tr-TR');
function isoDate(ms){
  const n=Number(ms);
  if(!Number.isFinite(n)||n<1e11||n>4e12) return null;
  const pieces=Object.fromEntries(dateFormatter.formatToParts(new Date(n)).filter(x=>['year','month','day'].includes(x.type)).map(x=>[x.type,x.value]));
  return `${pieces.year}-${pieces.month}-${pieces.day}`;
}
function dateUtc(iso){return new Date(`${iso}T00:00:00.000Z`)}
function plusDays(iso,n){let d=dateUtc(iso);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function trDate(iso){return iso?.split('-').reverse().join('.')||'—'}
function weekOf(date){
  const weekday=dateUtc(date).getUTCDay();
  if(weekday===0)return {start:date,end:date,label:`${trDate(date)} · Pazar`};
  const start=plusDays(date,1-weekday);
  return {start,end:plusDays(start,5),label:`${trDate(start)} – ${trDate(plusDays(start,5))}`};
}
function sanitizeSender(raw){
  const s=String(raw||'Gönderen okunamadı').replace(/\s+/g,' ').trim()||'Gönderen okunamadı';
  const digits=s.replace(/\D/g,'');
  if(digits.length>=10 && /^\+?[\d\s()\-]+$/.test(s))return `Telefon •••• ${digits.slice(-4)}`;
  return s.slice(0,130);
}
function add(map,key,amount=1){map.set(key,(map.get(key)||0)+amount)}
function sortEntries(map){return [...map].filter(([k,n])=>k&&n>0).sort((a,b)=>b[1]-a[1]||trCollator.compare(a[0],b[0]));}
function sumEntries(arr){return (arr||[]).reduce((n,row)=>n+(Number(row?.[1])||0),0)}
function normalizeEntries(value){
  const result=new Map();
  for(const entry of Array.isArray(value)?value:[]){
    if(!Array.isArray(entry)||entry.length<2)continue;
    const name=String(entry[0]||'').trim();const count=Number(entry[1]);
    if(!name||!Number.isSafeInteger(count)||count<0)continue;
    add(result,name,count);
  }
  return sortEntries(result);
}
function normStats(w){
  return {
    ...w,
    total:Number(w.total)||0,
    positive:Number(w.positive)||0,
    negative:Number(w.negative)||0,
    pending:Number(w.pending)||0,
    estimated:!!w.estimated,
    people:normalizeEntries(w.people),
    regions:normalizeEntries(w.regions),
    budgets:normalizeEntries(w.budgets)
  };
}
function blank(){return {total:0,positive:0,negative:0,pending:0,people:[],regions:[],budgets:[],estimated:false}}
function normalizeSnapshot(v){
  if(!v||v.schemaVersion!==2||!Array.isArray(v.historicalWeeks)||!Array.isArray(v.days))throw new Error('Yayın dosyasının veri yapısı tanınmadı.');
  return {
    schemaVersion:2,
    type:'KW_BODRUM_PUBLIC_DASHBOARD_SNAPSHOT',
    generatedAt:typeof v.generatedAt==='string'?v.generatedAt:null,
    cutoff:CUTOFF,
    historicalWeeks:v.historicalWeeks.filter(w=>/^\d{4}-\d{2}-\d{2}$/.test(w.start)&&/^\d{4}-\d{2}-\d{2}$/.test(w.end)).map(normStats),
    days:v.days.filter(w=>/^\d{4}-\d{2}-\d{2}$/.test(w.date)&&w.date>=CUTOFF).map(normStats),
    coverages:Array.isArray(v.coverages)?v.coverages.filter(w=>w&&/^\d{4}-\d{2}-\d{2}$/.test(w.start)).map(w=>({start:w.start,end:w.end,importedAt:w.importedAt||null})):[]
  };
}
function budgetLabel(b){
  const n=Number(b?.tutar);
  if(!b||!Number.isFinite(n)||n<=0)return 'Üst bütçe belirtilmemiş';
  const unit=['USD','EUR'].includes(b.birim)?b.birim:'TL';
  return `${moneyFormat.format(Math.round(n))} ${unit}`;
}
function recordKey(r){
  // Dışa aktarımda ham WhatsApp mesaj ID'si bulunmadığından bu değişmeyen alanlarla eşsizleştiriyoruz.
  return [r.kaynakGrup||'',r.kisiAnahtari||r.gonderen||'',r.tespitZamaniMs||'',r.mesajZamaniMs||''].join('|');
}
function aggregateRecords(rows,date){
  let positive=0,negative=0;
  const people=new Map(),regions=new Map(),budgets=new Map();
  for(const r of rows){
    if(r.teslimatDurumu==='gonderildi' && r.eslesmeDurumu==='olumlu')positive++;
    else if(r.teslimatDurumu==='gonderildi' && r.eslesmeDurumu==='olumsuz')negative++;
    add(people,sanitizeSender(r.gonderen));
    const rs=new Set((Array.isArray(r.bolgeler)?r.bolgeler:[]).map(x=>String(x||'').trim()).filter(Boolean));
    for(const reg of rs.size?rs:['Bölge belirtilmemiş'])add(regions,reg);
    add(budgets,budgetLabel(r.maksimumButce));
  }
  return {date,total:rows.length,positive,negative,pending:rows.length-positive-negative,people:sortEntries(people),regions:sortEntries(regions),budgets:sortEntries(budgets),estimated:false};
}
function importExtension(snapshot,ext){
  if(!ext||ext.tur!=='KW_BODRUM_DASHBOARD_VERISI'||!Array.isArray(ext.kayitlar)){
    throw new Error('Bu JSON, eklentinin “İstatistik Kontrolü > JSON indir” dosyası değil.');
  }
  if(ext.kayitlar.length>50000)throw new Error('JSON çok fazla kayıt içeriyor.');
  const base=normalizeSnapshot(snapshot);
  const dayRows=new Map();const keys=new Set();const touched=new Map();
  let ignoredOld=0,ignoredBad=0,duplicate=0;
  for(const r of ext.kayitlar){
    if(!r||typeof r!=='object'){ignoredBad++;continue}
    const date=isoDate(r.tespitZamaniMs);
    if(!date){ignoredBad++;continue}
    if(date<CUTOFF){ignoredOld++;continue}
    const key=recordKey(r);
    if(keys.has(key)){duplicate++;continue}keys.add(key);
    if(!dayRows.has(date))dayRows.set(date,[]);
    dayRows.get(date).push(r);
    const week=weekOf(date);touched.set(week.start,week);
  }
  // Eklentinin boş bu-hafta/geçen-hafta dışa aktarımları da o haftayı sıfırlayabilsin.
  const exportDate=isoDate(ext.disaAktarildiMs);
  if(exportDate && (ext.donem==='thisWeek'||ext.donem==='lastWeek')){
    let reference=exportDate;
    if(ext.donem==='lastWeek')reference=plusDays(reference,-7);
    const weekday=dateUtc(reference).getUTCDay();
    const monday=plusDays(reference,weekday===0?-6:1-weekday);
    if(monday>=CUTOFF)touched.set(monday,weekOf(monday));
    // Pazar exportunda yalnız o güne ait veriler de ayrıca görülebilir.
    if(weekday===0 && ext.donem==='thisWeek' && reference>=CUTOFF)touched.set(reference,weekOf(reference));
  }
  if(!touched.size){return {snapshot:base,summary:{imported:0,ignoredOld,ignoredBad,duplicate,changedWeeks:[],unchanged:true}}}
  const unchangedDays=base.days.filter(d=>!touched.has(weekOf(d.date).start));
  const changedDays=[...dayRows].map(([date,rows])=>aggregateRecords(rows,date));
  const now=new Date().toISOString();
  const newCoverages=base.coverages.filter(c=>!touched.has(c.start));
  for(const week of touched.values())newCoverages.push({start:week.start,end:week.end,importedAt:now});
  return {
    snapshot:normalizeSnapshot({...base,days:[...unchangedDays,...changedDays].sort((a,b)=>a.date.localeCompare(b.date)),coverages:newCoverages.sort((a,b)=>a.start.localeCompare(b.start)),generatedAt:now}),
    summary:{imported:[...dayRows.values()].reduce((n,r)=>n+r.length,0),ignoredOld,ignoredBad,duplicate,changedWeeks:[...touched.values()].sort((a,b)=>a.start.localeCompare(b.start)),unchanged:false,exportMode:ext.donem||'all'}
  };
}
function aggregateStats(items){
  const out=blank();const maps={people:new Map(),regions:new Map(),budgets:new Map()};
  for(const i of items){
    for(const k of ['total','positive','negative','pending'])out[k]+=Number(i[k])||0;
    out.estimated ||= !!i.estimated;
    for(const k of ['people','regions','budgets'])for(const [name,count] of i[k]||[])add(maps[k],name,Number(count)||0);
  }
  for(const k of Object.keys(maps))out[k]=sortEntries(maps[k]);
  return out;
}
function periodList(snapshot,kind){
  const x=normalizeSnapshot(snapshot);
  if(kind==='all')return [{value:'all',label:'Tüm dönemler'}];
  if(kind==='week'){
    const wm=new Map();
    for(const h of x.historicalWeeks)wm.set(h.start,{value:h.start,label:`${trDate(h.start)} – ${trDate(h.end)}`});
    for(const d of x.days){const w=weekOf(d.date);wm.set(w.start,{value:w.start,label:w.label})}
    for(const c of x.coverages)wm.set(c.start,{value:c.start,label: c.end===c.start?`${trDate(c.start)} · Pazar`:`${trDate(c.start)} – ${trDate(c.end)}`});
    if(!wm.has('2026-11-02'))wm.set('2026-11-02',{value:'2026-11-02',label:'02.11.2026 – 07.11.2026'});
    return [...wm.values()].sort((a,b)=>b.value.localeCompare(a.value));
  }
  const labels=new Set();
  for(const h of x.historicalWeeks)labels.add(kind==='month'?h.start.slice(0,7):h.start.slice(0,4));
  for(const d of x.days)labels.add(kind==='month'?d.date.slice(0,7):d.date.slice(0,4));
  for(const c of x.coverages)labels.add(kind==='month'?c.start.slice(0,7):c.start.slice(0,4));
  labels.add(kind==='month'?'2026-11':'2026');
  return [...labels].sort().reverse().map(val=>({value:val,label:kind==='month'?val.split('-').reverse().join('.'):val}));
}
function forPeriod(snapshot,kind,value){
  const x=normalizeSnapshot(snapshot);
  const match=date=>kind==='all'||(kind==='week'?weekOf(date).start===value:kind==='month'?date.slice(0,7)===value:date.slice(0,4)===value);
  const parts=[...x.days.filter(d=>match(d.date))];
  for(const h of x.historicalWeeks){
    if(kind==='all'||(kind==='week'&&h.start===value)||(kind==='month'&&h.start.slice(0,7)===value)||(kind==='year'&&h.start.slice(0,4)===value))parts.push(h);
  }
  return aggregateStats(parts);
}
function toPublicDownload(snapshot){return JSON.stringify(normalizeSnapshot({...snapshot,generatedAt:new Date().toISOString()}),null,2)+'\n'}
return {CUTOFF,isoDate,weekOf,trDate,sortEntries,normalizeSnapshot,importExtension,aggregateStats,periodList,forPeriod,toPublicDownload,sanitizeSender,sumEntries};
});
