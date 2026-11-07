/* Kaal calculation layer. Astronomy Engine 2.1.19; times rounded to minutes. */
(function(root){
const A=typeof Astronomy!=='undefined'?Astronomy:require('astronomy-engine');
const names=['પડવો','બીજ','ત્રીજ','ચોથ','પાંચમ','છઠ','સાતમ','આઠમ','નોમ','દશમ','અગિયારસ','બારસ','તેરસ','ચૌદશ','પૂનમ'];
const months=['ચૈત્ર','વૈશાખ','જેઠ','અષાઢ','શ્રાવણ','ભાદરવો','આસો','કારતક','માગશર','પોષ','મહા','ફાગણ'];
const nak=['અશ્વિની','ભરણી','કૃત્તિકા','રોહિણી','મૃગશીર્ષ','આર્દ્રા','પુનર્વસુ','પુષ્ય','આશ્લેષા','મઘા','પૂર્વા ફાલ્ગુની','ઉત્તરા ફાલ્ગુની','હસ્ત','ચિત્રા','સ્વાતિ','વિશાખા','અનુરાધા','જ્યેષ્ઠા','મૂળ','પૂર્વાષાઢા','ઉત્તરાષાઢા','શ્રવણ','ધનિષ્ઠા','શતભિષા','પૂર્વા ભાદ્રપદા','ઉત્તરા ભાદ્રપદા','રેવતી'];
const mod=x=>(x%360+360)%360;
function parts(d,z){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:z,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));}
function instant(day,time,z){const target=Date.parse(day+'T'+time+':00Z');let t=target;for(let i=0;i<4;i++){const p=parts(new Date(t),z);t+=target-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);}return new Date(t);}
function dateKey(d,z){const p=parts(d,z);return `${p.year}-${p.month}-${p.day}`;}
function addDay(day,n){return new Date(Date.parse(day+'T12:00Z')+n*864e5).toISOString().slice(0,10);}
function tithi(d){const angle=A.MoonPhase(d),index=Math.floor(angle/12);return {angle,index,label:(index<15?'સુદ ':'વદ ')+(index===29?'અમાસ':names[index%15]),end:A.SearchMoonPhase(((index+1)*12)%360,d,3).date,start:A.SearchMoonPhase(index*12,new Date(+d-3*864e5),4).date};}
function ayan(d){return 23.85675+(+d-Date.UTC(2000,0,1,12))/864e5/365.2425*0.013968;}
function sidereal(d){return mod(A.EclipticGeoMoon(d).lon-ayan(d));}
function month(d){const prev=A.SearchMoonPhase(0,new Date(+d-32*864e5),35);let p=prev.date;let next=A.SearchMoonPhase(0,new Date(+p+864e5),35).date;if(next<=d){p=next;next=A.SearchMoonPhase(0,new Date(+p+864e5),35).date;}const sign=x=>Math.floor(mod(A.SunPosition(x).elon-ayan(x))/30);const s=sign(next);return (s===sign(p)?'અધિક ':'')+months[s];}
function dayData(day,loc){const start=instant(day,'00:00',loc.zone),end=instant(addDay(day,1),'00:00',loc.zone),obs=new A.Observer(loc.lat,loc.lon,0);const rise=(body,dir)=>{const r=A.SearchRiseSet(body,obs,dir,start,1.2);return r&&r.date<end?r.date:null;};const sunrise=rise('Sun',1),sunset=rise('Sun',-1);let cursor=start,items=[];while(cursor<end&&items.length<4){const t=tithi(cursor);items.push(t);cursor=new Date(+t.end+1000);}return {start,end,sunrise,sunset,moonrise:rise('Moon',1),moonset:rise('Moon',-1),atSunrise:sunrise?tithi(sunrise):null,items};}
function reduce(s){let n=String(s).replace(/\D/g,'').split('').reduce((a,b)=>a+Number(b),0);while(n>9)n=String(n).split('').reduce((a,b)=>a+Number(b),0);return n;}
const api={names,nak,mod,parts,instant,dateKey,addDay,tithi,month,sidereal,ayan,dayData,reduce};if(typeof module!=='undefined')module.exports=api;root.Kaal=api;
})(typeof window!=='undefined'?window:globalThis);
