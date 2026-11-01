import {panchangAtSunrise,kundali,kundaliSvg} from '@grahan/vedic';
import {julianDayFromDate,moonPhase,moonPosition,equatorialFromEcliptic,trueObliquity,localSiderealTime} from '@grahan/core';

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
if(state.liveCoordinates && Number.isFinite(state.liveCoordinates.lat) && Number.isFinite(state.liveCoordinates.lon)){
 CITIES.gps={label:'Device GPS',lat:state.liveCoordinates.lat,lon:state.liveCoordinates.lon,zone:state.liveCoordinates.zone||Intl.DateTimeFormat().resolvedOptions().timeZone,altitude:state.liveCoordinates.altitude};
}
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

/* Soma v0.2: opt-in location/weather, geocentric sky bearing, and local solar telemetry. */
const degrees=r=>r*180/Math.PI;
const radians=d=>d*Math.PI/180;
const numberOrNull=x=>x==null||!Number.isFinite(Number(x))?null:Number(x);
const displayNumber=(x,suffix='',digits=0)=>numberOrNull(x)==null?'—':Number(x).toFixed(digits)+suffix;
const geoValid=x=>x&&Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&Math.abs(x.lat)<=90&&Math.abs(x.lon)<=180;
function solarClockOffset(c){
  const instant=new Date(),parts=new Intl.DateTimeFormat('en-GB',{timeZone:c.zone,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(instant);
  const p=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
  const wall=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);
  const utcFloor=Math.floor(instant.getTime()/60000)*60000;
  const offsetMin=Math.round((wall-utcFloor)/60000);
  return Math.round(c.lon*4-offsetMin);
}
function moonBearing(c){
  const jd=julianDayFromDate(new Date()),moon=moonPosition(jd);
  const eq=equatorialFromEcliptic(moon.apparentLongitude,moon.latitude,trueObliquity(jd));
  const H=radians(localSiderealTime(jd,c.lon)-eq.rightAscension),lat=radians(c.lat),dec=radians(eq.declination);
  const alt=degrees(Math.asin(Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(H)));
  const az=(degrees(Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(lat)-Math.tan(dec)*Math.cos(lat)))+180+360)%360;
  return {az,alt};
}
function upcomingSolarEvent(p,d){
  const now=Date.now();
  const events=[p.sunrise&&{label:'Sunrise',at:p.sunrise},p.sunset&&{label:'Sunset',at:p.sunset}].filter(Boolean);
  try{const nd=getDay(nextDay(d,1));if(nd.sunrise)events.push({label:'Tomorrow sunrise',at:nd.sunrise});}catch{}
  return events.filter(e=>e.at.getTime()>now).sort((a,b)=>a.at-b.at)[0]||null;
}
const countDown=t=>{
  if(!t)return '—';
  const min=Math.max(0,Math.ceil((t.getTime()-Date.now())/60000));
  return min>60?Math.floor(min/60)+'h '+(min%60)+'m':min+'m';
};
function updateWidgetWeather(w){
  try{
    if(!window.SomaNative?.updateAtmosphere)return;
    if(!w||!w.current){window.SomaNative.updateAtmosphere('—','Weather off','Tap app for conditions');return;}
    const t=displayNumber(w.current.temperature_2m,'°C');
    const cloud=displayNumber(w.current.cloud_cover,'% cloud');
    const age=Math.round((Date.now()-(w.fetchedAt||Date.now()))/60000);
    window.SomaNative.updateAtmosphere(t,cloud,'From last request'+(age>=1?' · '+age+'m ago':''));
  }catch(e){console.warn('Weather widget',e);}
}
function weatherForCurrent(){
  const w=state.weather,c=city();
  return w&&Math.abs(w.lat-c.lat)<0.01&&Math.abs(w.lon-c.lon)<0.01?w:null;
}
function showWeather(){
  const w=weatherForCurrent();
  if(!w||!w.current){
    $('weatherCurrent').textContent='Weather is off';
    $('weatherStatus').textContent='Tap “Get weather” to share these coordinates with Open-Meteo.';
    $('weatherDetails').innerHTML='';
    $('tattvaValues').innerHTML='<p class="muted">Five-element reflections appear when you request weather data.</p>';
    $('sadhana').textContent='Check conditions before heading outside';
    updateWidgetWeather(null);return;
  }
  const a=w.current,unit=w.current_units||{};
  const values=[
    ['Feels like',displayNumber(a.apparent_temperature,'°C')],
    ['Cloud cover',displayNumber(a.cloud_cover,'%')],
    ['Wind',displayNumber(a.wind_speed_10m,' km/h')],
    ['Wind direction',displayNumber(a.wind_direction_10m,'°')],
    ['Humidity',displayNumber(a.relative_humidity_2m,'%')],
    ['UV index',displayNumber(a.uv_index)],
    ['Pressure',displayNumber(a.surface_pressure,' hPa')],
    ['Precipitation',displayNumber(a.precipitation,' mm',1)]
  ];
  $('weatherCurrent').textContent=displayNumber(a.temperature_2m,'°C');
  $('weatherStatus').textContent='Modelled conditions · fetched '+new Intl.DateTimeFormat('en-IN',{hour:'numeric',minute:'2-digit'}).format(new Date(w.fetchedAt));
  $('weatherDetails').innerHTML=values.map(([label,val])=>'<div class="weatherStat"><span>'+escape(label)+'</span><b>'+escape(val)+'</b></div>').join('');
  const cloud=numberOrNull(a.cloud_cover),wind=numberOrNull(a.wind_speed_10m),uv=numberOrNull(a.uv_index),rain=numberOrNull(a.precipitation);
  let suggestion='Check local conditions before going out';
  if((wind!=null&&wind>=30)||(rain!=null&&rain>0.2)||(uv!=null&&uv>=8))suggestion='Indoor practice may be more comfortable';
  else if(cloud!=null&&cloud<=25)suggestion='Lower cloud cover: consider Moon gazing';
  $('sadhana').textContent=suggestion;
  const pairs=[
    ['Agni · fire','Temperature '+displayNumber(a.temperature_2m,'°C')+' · UV '+displayNumber(a.uv_index)],
    ['Jala · water','Humidity '+displayNumber(a.relative_humidity_2m,'%')+' · Dewpoint '+displayNumber(a.dew_point_2m,'°C')],
    ['Vayu · air','Wind '+displayNumber(a.wind_speed_10m,' km/h')+' · '+displayNumber(a.surface_pressure,' hPa')],
    ['Prithvi · earth','Soil moisture: not sampled'],
    ['Akasha · space','Cloud cover '+displayNumber(a.cloud_cover,'%')+' · actual sky visibility unverified']
  ];
  $('tattvaValues').innerHTML=pairs.map(([label,value])=>'<div class="tattva"><b>'+escape(label)+'</b><span>'+escape(value)+'</span></div>').join('');
  updateWidgetWeather(w);
}
function renderTelemetry(){
  const c=city(),d=today();
  const gps=state.location==='gps'&&state.liveCoordinates;
  $('telemetryName').textContent=c.label;
  $('telemetryPosition').textContent=c.lat.toFixed(4)+'°, '+c.lon.toFixed(4)+'°';
  $('telemetryAltitude').textContent=gps&&Number.isFinite(gps.altitude)?Math.round(gps.altitude)+'m device altitude':'Altitude not measured';
  $('telemetrySolarOffset').textContent='Mean solar offset '+(solarClockOffset(c)>=0?'+':'')+solarClockOffset(c)+'m';
  $('gpsStatus').textContent=gps?'GPS active · '+(Number.isFinite(gps.accuracy)?Math.round(gps.accuracy)+'m reported accuracy':'accuracy unknown'):'Manual city coordinates';
  $('telemetryZone').textContent='Zone '+c.zone+(gps?' (device setting)':'');
  try{
    const p=getDay(d);
    const duration=p.sunrise&&p.sunset?Math.round((p.sunset-p.sunrise)/60000):null;
    $('daylightDuration').textContent=duration==null?'—':Math.floor(duration/60)+'h '+pad(duration%60)+'m';
    $('solarMidpoint').textContent=p.sunrise&&p.sunset?clock(new Date((p.sunrise.getTime()+p.sunset.getTime())/2)):'—';
    const upcoming=upcomingSolarEvent(p,d);
    $('nextSolar').textContent=upcoming?upcoming.label+' in '+countDown(upcoming.at):'Not available';
    const now=Date.now();
    $('rahuCountdown').textContent=p.rahuKaal&&p.rahuKaal.start&&p.rahuKaal.start.getTime()>now?'Rahu Kaal starts in '+countDown(p.rahuKaal.start):'Rahu Kaal times in Panchang';
  }catch(e){$('nextSolar').textContent='Solar timing unavailable';}
  try{
    const m=moonBearing(c);
    $('moonAzimuth').textContent=Math.round(m.az)+'° from north';
    $('moonAltitude').textContent=Math.round(m.alt)+'° altitude · '+(m.alt>0?'above geometric horizon':'below geometric horizon');
    $('moonDirection').style.transform='rotate('+m.az+'deg)';
  }catch(e){$('moonAzimuth').textContent='Moon position unavailable';}
  showWeather();
}
const originalShowToday=showToday;
showToday=function(){originalShowToday();renderTelemetry();};
function initTelemetry(){
  $('useGPS').onclick=()=>{
    if(!window.SomaNative?.requestLocation){$('gpsStatus').textContent='GPS requires the Android app';return;}
    $('gpsStatus').textContent='Requesting one-time location fix…';
    window.SomaNative.requestLocation();
  };
  $('refreshWeather').onclick=()=>{
    if(!window.SomaNative?.fetchWeather){$('weatherStatus').textContent='Weather requires the Android app';return;}
    $('weatherStatus').textContent='Requesting modelled conditions from Open-Meteo…';
    const c=city();window.SomaNative.fetchWeather(c.lat,c.lon);
  };
  window.somaReceiveLocation=payload=>{
    if(payload.startsWith('ERROR:')){$('gpsStatus').textContent=payload;return;}
    try{
      const obj=JSON.parse(payload);
      if(!geoValid(obj))throw Error('Invalid GPS coordinates');
      const gps={lat:obj.lat,lon:obj.lon,zone:obj.zone||Intl.DateTimeFormat().resolvedOptions().timeZone,
        altitude:numberOrNull(obj.altitude),accuracy:numberOrNull(obj.accuracy)};
      state.liveCoordinates=gps;
      CITIES.gps={label:'Device GPS',...gps};
      state.location='gps';save();
      if(!$('location').querySelector('option[value="gps"]')){
        const option=document.createElement('option');option.value='gps';option.textContent='Device GPS';$('location').appendChild(option);
      }
      $('location').value='gps';selected=today();month={...selected,day:1};
      showToday();showCalendar();
    }catch(e){$('gpsStatus').textContent='Could not use GPS: '+e.message;}
  };
  window.somaReceiveWeather=payload=>{
    if(payload.startsWith('ERROR:')){$('weatherStatus').textContent=payload;return;}
    try{
      const body=JSON.parse(payload);
      if(!body.current)throw Error('Missing current conditions');
      const c=city();
      state.weather={lat:body.latitude??c.lat,lon:body.longitude??c.lon,
        current:body.current,current_units:body.current_units,fetchedAt:Date.now()};
      // Weather models may snap to nearby grid coordinates; store the requested observation point.
      state.weather.lat=c.lat;state.weather.lon=c.lon;
      save();showWeather();
    }catch(e){$('weatherStatus').textContent='Could not display weather: '+e.message;}
  };
  renderTelemetry();
}

init();
initTelemetry();
