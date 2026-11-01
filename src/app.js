import {panchangAtSunrise,kundali,kundaliSvg} from '@grahan/vedic';
import {julianDayFromDate,moonPhase} from '@grahan/core';

const $=id=>document.getElementById(id);
const CITIES={
  delhi:{label:'New Delhi',lat:28.6139,lon:77.209,zone:'Asia/Kolkata'},
  mumbai:{label:'Mumbai',lat:19.076,lon:72.8777,zone:'Asia/Kolkata'},
  pune:{label:'Pune',lat:18.5204,lon:73.8567,zone:'Asia/Kolkata'},
  bengaluru:{label:'Bengaluru',lat:12.9716,lon:77.5946,zone:'Asia/Kolkata'},
  chennai:{label:'Chennai',lat:13.0827,lon:80.2707,zone:'Asia/Kolkata'},
  hyderabad:{label:'Hyderabad',lat:17.385,lon:78.4867,zone:'Asia/Kolkata'},
  kolkata:{label:'Kolkata',lat:22.5726,lon:88.3639,zone:'Asia/Kolkata'},
  kathmandu:{label:'Kathmandu',lat:27.7172,lon:85.324,zone:'Asia/Kathmandu'},
  regina:{label:'Regina',lat:50.4452,lon:-104.6189,zone:'America/Regina'},
  toronto:{label:'Toronto',lat:43.6532,lon:-79.3832,zone:'America/Toronto'}
};
const STORE='soma-local-v01';
let state={location:'delhi',profile:{},notes:{}};
try{
  const loaded=JSON.parse(localStorage.getItem(STORE)||'{}');
  state={...state,...loaded,profile:loaded.profile||{},notes:loaded.notes||{}};
}catch(e){console.warn('Local storage unavailable',e);}
if(!CITIES[state.location])state.location='delhi';
const city=()=>CITIES[state.location];
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty=s=>String(s||'').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const pad=n=>String(n).padStart(2,'0');
const key=d=>d.year+'-'+pad(d.month)+'-'+pad(d.day);
const utc=d=>new Date(Date.UTC(d.year,d.month-1,d.day,12));
const same=(a,b)=>key(a)===key(b);
const nextDay=(d,n)=>{const x=new Date(Date.UTC(d.year,d.month-1,d.day+n,12));return {year:x.getUTCFullYear(),month:x.getUTCMonth()+1,day:x.getUTCDate()};};
const zonedDate=(instant,zone)=>{
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant);
  const v=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
  return {year:v.year,month:v.month,day:v.day};
};
const today=()=>zonedDate(new Date(),city().zone);
const format=(instant,options={})=>new Intl.DateTimeFormat('en-IN',{timeZone:city().zone,...options}).format(instant);
const displayDate=d=>new Intl.DateTimeFormat('en-IN',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(utc(d));
const clock=date=>date instanceof Date&&!isNaN(date)?format(date,{hour:'numeric',minute:'2-digit',hour12:true}):'—';
const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(state));}catch(e){console.warn('Could not save',e);}};
const getDay=d=>panchangAtSunrise({year:d.year,month:d.month,day:d.day,latitude:city().lat,longitude:city().lon,timezone:city().zone});
const phaseAt=d=>moonPhase(julianDayFromDate(utc(d)));
const phaseEmoji={new:'🌑','waxing-crescent':'🌒','first-quarter':'🌓','waxing-gibbous':'🌔',full:'🌕','waning-gibbous':'🌖','last-quarter':'🌗','waning-crescent':'🌘'};
let month={...today(),day:1},selected=today();
const transition=list=>(list||[]).map((v,i)=>'<div class="transition"><div><b>'+escape(v.name)+'</b><span>'+escape(pretty(v.paksha||''))+(v.pada?' · Pada '+v.pada:'')+'</span></div><small>'+(i===0?'Until ':'Then until ')+clock(v.endsAt)+'</small></div>').join('')||'<p class="muted">Not available</p>';
function widget(date,p){
  if(!window.SomaNative?.updateWidget)return;
  try{window.SomaNative.updateWidget(
    new Intl.DateTimeFormat('en-IN',{timeZone:'UTC',day:'numeric',month:'short'}).format(utc(date)),
    pretty(p.moonPhase.phaseName),
    (p.tithi[0]?.name||'—')+' · '+pretty(p.tithi[0]?.paksha),
    city().label
  );}catch(e){console.warn('Widget update failed',e);}
}
function showToday(){
  const d=today();
  $('todayDate').textContent=displayDate(d);
  $('todayLocation').textContent=city().label;
  $('greeting').textContent=state.profile.name?'In rhythm, '+state.profile.name+'.':'In rhythm with today.';
  try{
    const p=getDay(d);
    $('moonGlyph').textContent=phaseEmoji[p.moonPhase.phaseName]||'◕';
    $('moonPhase').textContent=pretty(p.moonPhase.phaseName);
    $('moonIllumination').textContent=Math.round(p.moonPhase.illuminatedFraction*100)+'% illuminated';
    $('tithi').innerHTML=transition(p.tithi);
    $('nakshatra').innerHTML=transition(p.nakshatra);
    $('yoga').innerHTML=transition(p.yoga);
    $('karana').innerHTML=transition(p.karana);
    $('sunrise').textContent=clock(p.sunrise);
    $('sunset').textContent=clock(p.sunset);
    $('weekday').textContent=p.vaar.name;
    $('rahu').textContent=p.rahuKaal?clock(p.rahuKaal.start)+' – '+clock(p.rahuKaal.end):'Unavailable';
    $('calcStatus').textContent=p.daylight==='normal'?'Panchang at local sunrise · calculated offline by Grahan':'No normal sunrise · using Grahan fallback';
    widget(d,p);
  }catch(e){
    $('calcStatus').textContent='Unable to calculate: '+String(e.message||e);
    $('moonPhase').textContent='Unavailable';$('moonGlyph').textContent='◌';$('moonIllumination').textContent='—';
    for(const id of ['tithi','nakshatra','yoga','karana'])$(id).textContent='Please check the selected location.';
    for(const id of ['sunrise','sunset','weekday','rahu'])$(id).textContent='—';
  }
}
function showCalendar(){
  $('monthTitle').textContent=new Intl.DateTimeFormat('en-IN',{timeZone:'UTC',month:'long',year:'numeric'}).format(utc(month));
  const first=new Date(Date.UTC(month.year,month.month-1,1)).getUTCDay();
  const now=today();let cells='';
  for(let i=0;i<42;i++){
    const d=nextDay(month,i-first);
    let phase={phaseName:'',illuminatedFraction:0};
    try{phase=phaseAt(d);}catch{}
    const current=same(now,d)?' current':'',chosen=same(selected,d)?' selected':'',other=d.month===month.month?'':' other';
    cells+='<button class="day'+current+chosen+other+'" data-day="'+key(d)+'" aria-label="'+key(d)+' '+escape(pretty(phase.phaseName))+'"><b>'+d.day+'</b><span class="phaseDot" style="--lit:'+Math.round(phase.illuminatedFraction*100)+'%"></span></button>';
  }
  $('calendarDays').innerHTML=cells;
  document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{
    const [year,monthNum,day]=b.dataset.day.split('-').map(Number);
    selected={year,month:monthNum,day};month={...selected,day:1};showCalendar();
  });
  $('selectedDate').textContent=displayDate(selected);
  try{
    const p=getDay(selected);
    $('selectedDetails').textContent=(p.tithi[0]?.name||'—')+' · '+(p.nakshatra[0]?.name||'—')+' · '+pretty(p.moonPhase.phaseName);
  }catch(e){$('selectedDetails').textContent='Panchang unavailable: '+e.message;}
  showNotes();
}
function showNotes(){
  const notes=state.notes[key(selected)]||[];
  $('notes').innerHTML=notes.map((v,i)=>'<div class="note"><span>'+escape(v)+'</span><button data-delete="'+i+'" aria-label="Remove note">×</button></div>').join('')||'<p class="muted">Nothing planned here yet.</p>';
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{
    state.notes[key(selected)].splice(Number(b.dataset.delete),1);save();showNotes();
  });
}
function birthInstant(day,time,zone){
  const [y,m,d]=day.split('-').map(Number),[hh,mm]=time.split(':').map(Number);
  const wall=Date.UTC(y,m-1,d,hh,mm);let guess=wall;
  for(let i=0;i<5;i++){
    const p=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(guess));
    const values=Object.fromEntries(p.filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
    const apparent=Date.UTC(values.year,values.month-1,values.day,values.hour%24,values.minute);
    if(apparent===wall)break;
    guess+=wall-apparent;
  }
  return new Date(guess);
}
function showBirth(){
  const p=state.profile;
  if(!p.birthday||!p.birthtime||!CITIES[p.birthCity]){
    $('birthResult').innerHTML='<p class="muted">Add your birth date, time and birthplace to explore the traditional Jyotisha chart.</p>';return;
  }
  try{
    const c=CITIES[p.birthCity],date=birthInstant(p.birthday,p.birthtime,c.zone);
    const k=kundali({date,latitude:c.lat,longitude:c.lon}),moon=k.grahas.find(x=>x.graha==='moon');
    $('birthResult').innerHTML='<div class="birthGrid"><div><small>MOON RASHI</small><strong>'+escape(moon?.rashiName)+'</strong></div><div><small>JANMA NAKSHATRA</small><strong>'+escape(moon?.nakshatra?.name)+'</strong></div><div><small>LAGNA</small><strong>'+escape(k.lagna.rashiName)+'</strong></div></div><div class="chart">'+kundaliSvg(k,{style:'north',size:340})+'</div><p class="muted tiny">Traditional cultural interpretation, not a scientific prediction. Birthplaces use approximate city centre coordinates.</p>';
  }catch(e){$('birthResult').textContent='Could not calculate birth chart: '+e.message;}
}
function showProfile(){
  const p=state.profile;
  for(const id of ['name','birthday','birthtime'])$(id).value=p[id]||'';
  $('birthCity').value=CITIES[p.birthCity]?p.birthCity:'pune';
  showBirth();
}
function go(page){
  document.querySelectorAll('main>section').forEach(s=>s.classList.toggle('active',s.id==='tab-'+page));
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  if(page==='today')showToday();
  if(page==='calendar')showCalendar();
  if(page==='sky')showBirth();
  window.scrollTo(0,0);
}
function init(){
  const opts=Object.entries(CITIES).map(([id,v])=>'<option value="'+id+'">'+escape(v.label)+'</option>').join('');
  $('location').innerHTML=opts;$('birthCity').innerHTML=opts;$('location').value=state.location;
  $('location').onchange=e=>{state.location=e.target.value;save();selected=today();month={...selected,day:1};showToday();showCalendar();};
  $('prevMonth').onclick=()=>{month=nextDay(month,-1);month.day=1;showCalendar();};
  $('nextMonth').onclick=()=>{month=nextDay({year:month.year,month:month.month+1,day:1},0);month.day=1;showCalendar();};
  $('jumpToday').onclick=()=>{selected=today();month={...selected,day:1};showCalendar();};
  $('addNote').onclick=()=>{const v=prompt('Your private note for '+key(selected));if(!v?.trim())return;(state.notes[key(selected)]??=[]).push(v.trim().slice(0,200));save();showNotes();};
  $('profileForm').onsubmit=e=>{e.preventDefault();const p={};for(const id of ['name','birthday','birthtime'])p[id]=$(id).value.trim();p.birthCity=$('birthCity').value;state.profile=p;save();$('saveStatus').textContent='Saved on this device';showToday();showBirth();};
  $('clearData').onclick=()=>{if(confirm('Delete your birth details and all saved notes on this device?')){state.profile={};state.notes={};save();showProfile();showCalendar();$('saveStatus').textContent='Deleted';}};
  document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>go(b.dataset.page));
  showProfile();showToday();showCalendar();go('today');
}
init();
