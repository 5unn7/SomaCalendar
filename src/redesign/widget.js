/* Home-screen widget feed.
 * Precomputes the next WIDGET_DAYS of Panchang as plain time intervals so the
 * native widget can show what is true *now* (tithi, nakshatra, Choghadiya,
 * Rahu Kaal, next vrat) without waking the WebView. Everything is offline.
 * Written in ES2017 on purpose: older Android WebViews reject `??` and `?.`.
 */
(function(root){
'use strict';
var A=typeof Astronomy!=='undefined'?Astronomy:require('astronomy-engine');
var K=root.Kaal||(typeof require!=='undefined'?require('./core.js'):null);
var WIDGET_DAYS=7, VRAT_SCAN_DAYS=60, NAK_SPAN=360/27;

/* Choghadiya cycle, index order used by both day and night tables. */
var CHOG=[
  {gu:'ઉદ્વેગ',en:'Udveg',q:'bad'},
  {gu:'ચલ',en:'Char',q:'ok'},
  {gu:'લાભ',en:'Labh',q:'good'},
  {gu:'અમૃત',en:'Amrit',q:'good'},
  {gu:'કાળ',en:'Kaal',q:'bad'},
  {gu:'શુભ',en:'Shubh',q:'good'},
  {gu:'રોગ',en:'Rog',q:'bad'}
];
/* Weekday 0 = Sunday. Day starts at (3w)%7 and steps +1; night starts at (5+3w)%7 and steps -2. */
function chogDayIndex(w,i){return (w*3+i)%7;}
function chogNightIndex(w,i){return ((5+w*3-2*i)%7+70)%7;}
/* Eighth-of-daylight slots (0-based) for Rahu Kaal, Yamaganda and Gulika, by weekday. */
var RAHU=[7,1,6,4,5,3,2], YAMA=[4,3,2,1,0,6,5], GULIKA=[6,5,4,3,2,1,0];
var VAAR=['રવિવાર','સોમવાર','મંગળવાર','બુધવાર','ગુરુવાર','શુક્રવાર','શનિવાર'];

/* Vrats keyed by tithi index (0..29) and the moment that decides the day:
 * sunrise for Ekadashi/Purnima/Amavasya, dusk for Pradosh, moonrise for Sankashti. */
var VRATS=[
  {i:10,at:'rise',gu:'સુદ અગિયારસ',en:'Ekadashi fast',d:'Fast or eat light; chant Vishnu’s name.'},
  {i:25,at:'rise',gu:'વદ અગિયારસ',en:'Ekadashi fast',d:'Fast or eat light; chant Vishnu’s name.'},
  {i:14,at:'rise',gu:'પૂનમ',en:'Purnima',d:'Satyanarayan katha, charity, moon arghya.'},
  {i:29,at:'rise',gu:'અમાસ',en:'Amavasya',d:'Remember ancestors; offer til and water.'},
  {i:12,at:'set',gu:'પ્રદોષ',en:'Pradosh',d:'Shiva puja at dusk.'},
  {i:27,at:'set',gu:'પ્રદોષ',en:'Pradosh',d:'Shiva puja at dusk.'},
  {i:18,at:'moon',gu:'સંકષ્ટી ચોથ',en:'Sankashti Chaturthi',d:'Ganesh vrat; break the fast after moonrise.'}
];

function sunEvent(obs,dir,from,limitDays){var r=A.SearchRiseSet('Sun',obs,dir,from,limitDays);return r?r.date:null;}
function weekday(day){return new Date(day+'T12:00:00Z').getUTCDay();}
function nakIndex(d){return Math.floor(K.sidereal(d)/NAK_SPAN)%27;}
/* Next nakshatra change after d: step 1h until the index changes, then bisect to ~30s. */
function nakEnd(d){
  var i=nakIndex(d),lo=+d,hi=lo;
  do{lo=hi;hi+=36e5;}while(nakIndex(new Date(hi))===i&&hi-+d<3*864e5);
  while(hi-lo>3e4){var mid=(lo+hi)/2;if(nakIndex(new Date(mid))===i)lo=mid;else hi=mid;}
  return new Date(hi);
}
function round(d){return d?Math.round(+d/1000)*1000:0;}

/* One local civil day: sunrise..next sunrise split into the day's Choghadiya and kaal windows. */
function dayWindows(day,loc,obs,out){
  var start=K.instant(day,'00:00',loc.zone),end=K.instant(K.addDay(day,1),'00:00',loc.zone);
  var rise=sunEvent(obs,1,start,1.2);if(!rise||rise>=end)return null;
  var set=sunEvent(obs,-1,rise,1.2);
  var next=sunEvent(obs,1,new Date(+rise+36e5),1.5);
  if(!set||!next||set>=next)return null;
  var w=weekday(day),dayLen=(set-rise)/8,nightLen=(next-set)/8,i;
  for(i=0;i<8;i++){
    var c=CHOG[chogDayIndex(w,i)];
    out.chog.push({s:round(+rise+i*dayLen),e:round(+rise+(i+1)*dayLen),n:c.gu,en:c.en,q:c.q,day:1});
  }
  for(i=0;i<8;i++){
    var c2=CHOG[chogNightIndex(w,i)];
    out.chog.push({s:round(+set+i*nightLen),e:round(+set+(i+1)*nightLen),n:c2.gu,en:c2.en,q:c2.q,day:0});
  }
  var slot=function(k){return [round(+rise+k*dayLen),round(+rise+(k+1)*dayLen)];};
  var noon=(+rise+ +set)/2,muhurta=(set-rise)/15;
  out.days.push({
    date:day,vaar:VAAR[w],rise:round(rise),set:round(set),next:round(next),
    rahu:slot(RAHU[w]),yama:slot(YAMA[w]),gulika:slot(GULIKA[w]),
    /* Abhijit muhurta is traditionally not used on Wednesday. */
    abhijit:w===3?null:[round(noon-muhurta/2),round(noon+muhurta/2)]
  });
  return rise;
}

function upcomingVrats(loc,obs,fromDay,limit,extra){
  /* The festival module already covers vrats (with parana), so its list replaces the built-in one. */
  if(extra&&extra.length)return merge([],extra,fromDay,limit);
  var list=[],prev={},seenOn={},day=fromDay;
  for(var n=0;n<VRAT_SCAN_DAYS&&list.length<limit+4;n++,day=K.addDay(day,1)){
    var start=K.instant(day,'00:00',loc.zone),noon=K.instant(day,'12:00',loc.zone);
    var rise=sunEvent(obs,1,start,1.2)||noon,set=sunEvent(obs,-1,rise,1.2)||noon;
    var mr=A.SearchRiseSet('Moon',obs,1,start,1.2),moon=mr?mr.date:noon;
    var at={rise:K.tithi(rise).index,set:K.tithi(set).index,moon:K.tithi(moon).index};
    VRATS.forEach(function(v,k){
      var date=at[v.at]===v.i?day:null,before=prev[v.at];
      /* A tithi that never touches its deciding moment (kshaya) is observed on the day it begins. */
      if(!date&&before!==undefined&&((at[v.at]-before+30)%30)===2&&(before+1)%30===v.i)date=K.addDay(day,-1);
      if(!date||date<fromDay)return;
      /* When a tithi touches two days' deciding moments (vriddhi), keep the first. */
      if(seenOn[k]&&seenOn[k]>=K.addDay(date,-1))return;
      seenOn[k]=date;
      list.push({k:k,date:date,n:v.gu,en:v.en,d:v.d});
    });
    prev=at;
  }
  list=list.map(function(x){return {date:x.date,n:x.n,en:x.en,d:x.d};});
  return merge(list,extra,fromDay,limit);
}
function merge(list,extra,fromDay,limit){
  /* Festivals from the festival module (when present) are merged in by date. */
  (extra||[]).forEach(function(f){if(f&&f.date>=fromDay)list.push({date:f.date,n:f.n||f.name||'',en:f.en||'',d:f.d||f.note||''});});
  list.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0;});
  var seen={};
  return list.filter(function(x){var k=x.date+x.n;if(seen[k])return false;seen[k]=1;return true;}).slice(0,limit);
}

/* Build the full widget feed. `now` defaults to the current instant; `festivals` is an optional [{date,n,en,d}] list. */
function build(loc,now,festivals){
  now=now||new Date();
  var obs=new A.Observer(loc.lat,loc.lon,0),today=K.dateKey(now,loc.zone);
  var out={v:1,city:loc.name||'',zone:loc.zone,gen:+now,days:[],chog:[],tithi:[],nak:[],vrat:[]};
  /* Start a day early so the hours before today's sunrise are covered by yesterday's night. */
  var first=K.addDay(today,-1);
  for(var n=0;n<=WIDGET_DAYS;n++)dayWindows(K.addDay(first,n),loc,obs,out);
  var from=K.instant(first,'00:00',loc.zone),until=+K.instant(K.addDay(today,WIDGET_DAYS+1),'00:00',loc.zone);
  var cursor=from,guard=0;
  while(+cursor<until&&guard++<20){
    var t=K.tithi(cursor);
    out.tithi.push({s:round(t.start),e:round(t.end),n:t.label,m:K.month(cursor),p:t.index<15?'સુદ':'વદ'});
    cursor=new Date(+t.end+1000);
  }
  cursor=from;guard=0;
  while(+cursor<until&&guard++<20){
    var e=nakEnd(cursor),i=nakIndex(cursor);
    out.nak.push({s:round(cursor),e:round(e),n:K.nak[i]});
    cursor=new Date(+e+1000);
  }
  out.vrat=upcomingVrats(loc,obs,today,6,festivals);
  return out;
}

var api={build:build,CHOG:CHOG,chogDayIndex:chogDayIndex,chogNightIndex:chogNightIndex,RAHU:RAHU,nakEnd:nakEnd,WIDGET_DAYS:WIDGET_DAYS};
if(typeof module!=='undefined')module.exports=api;
root.SomaWidgetFeed=api;
})(typeof window!=='undefined'?window:globalThis);
