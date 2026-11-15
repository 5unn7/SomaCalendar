import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
/* Chandra rashi on Today and the user's favourable days on Calendar: the rashi and its end time are right, the
   favourable list matches the calendar dots, Chandrashtama days are flagged, and without birth details both screens
   offer a way to add them. */
const require=createRequire(import.meta.url);
globalThis.Astronomy=require('astronomy-engine');globalThis.Kaal=require('../src/redesign/core.js');
const K=globalThis.Kaal,P=require('../src/redesign/panchang.js'),M=require('../src/redesign/meanings.js');
const loc={lat:23.0225,lon:72.5714,zone:'Asia/Kolkata'};
const profile={date:'1990-05-15',time:'08:30',timeUnknown:false,zone:'Asia/Kolkata',lat:22.3039,lon:70.8022,place:'Rajkot, Gujarat, India'};
// Every rashi has a lord and guidance with both translations.
assert.equal(M.RASHI.length,12);
for(const r of M.RASHI){assert.ok(M.PLANET[r.lord],r.en+' lord');for(const l of ['gu','hi'])assert.notEqual(M.tr(r.good,l),r.good,r.en+' '+l);}
// Rashi end times: the Moon crosses into the next rashi at the time shown.
for(let h=0;h<24*30;h+=17){const at=new Date(Date.parse('2026-11-01T00:00:00Z')+h*36e5),r=Math.floor(P.moonSid(at)/30),end=P.crossing(P.moonSid,at,((r+1)%12)*30,72);
  assert.ok(end&&end>at&&end-at<62*36e5,'next rashi within about 2.5 days');
  assert.equal(Math.floor(P.moonSid(new Date(+end+120000))/30),(r+1)%12);assert.equal(Math.floor(P.moonSid(new Date(+end-120000))/30),r);}

function boot(store){
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const base='android/app/src/main/assets/',dom=new JSDOM(readFileSync(base+'index.html','utf8'),{runScripts:'dangerously',url:'https://soma.local',virtualConsole:vc});
  const w=dom.window;w.localStorage.setItem('soma-redesign-v1',JSON.stringify(store));
  w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},createImageData:(x,y)=>({data:new Uint8ClampedArray(x*y*4)}),putImageData(){}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.scrollTo=()=>{};
  w.SomaNative={updateWidgetFeed(){},scheduleReminders(){},requestNotifications(){},appReady(){},appFailure(){}};
  for(const f of ['astronomy.js','clock.js','core.js','panchang.js','meanings.js','festivals.js','widget.js','i18n.js','natal.js','places.js','dial.js','app.js']){const s=w.document.createElement('script');s.textContent=readFileSync(base+f,'utf8');w.document.body.appendChild(s);}
  w.SomaClock.set(Date.parse('2026-11-14T06:30:00Z'));w.SomaClock.tick();w.setDay('2026-11-14');
  return {w,errors,$:s=>w.document.querySelector(s),$$:s=>[...w.document.querySelectorAll(s)]};
}
const keyOf=el=>el.getAttribute('onclick').match(/\d{4}-\d{2}-\d{2}/)[0];
// With birth details.
{const {w,errors,$,$$}=boot({loc:{name:'Ahmedabad',...loc},profile,prefs:{onboarded:true}});
  w.show('personal');
  const card=$('#app .rashicard');assert.ok(card,'You shows the Chandra rashi card');
  const r=Math.floor(P.moonSid(new Date(Date.parse('2026-11-14T06:30:00Z')))/30);
  assert.ok(card.closest('section').querySelector('h2').textContent.includes(M.RASHI[r].en),'names the rashi the Moon is in now');
  assert.ok(/until .*, then /.test(card.textContent),'says until when and which rashi is next');
  assert.equal($$('#app .rring path').length,12);assert.equal($$('#app .rring path.on').length,1);assert.equal($$('#app .rring path.mine').length,1,'janma rashi ringed');
  assert.ok($('#app .card.me + .personalDay'),'personal line follows the birth card');
  w.show('calendar');
  const fav=$$('#app .favdays .chip.fav'),dots=$$('#app .calendar button.mine');
  assert.ok(fav.length>=3,'a handful of favourable days');assert.equal(fav.length,dots.length,'list matches calendar dots');
  const bm=K.sidereal(K.instant(profile.date,profile.time,profile.zone)),care=$$('#app .favdays .chip.care');
  assert.ok(care.length>=1,'Chandrashtama days listed');
  for(const c of care)assert.equal(P.personal(bm,K.dayData(keyOf(c),loc).sunrise).chandraCount,8,'care chips are Chandrashtama');
  const last=fav[fav.length-1],lastKey=keyOf(last);last.click();assert.equal(w.eval('day'),lastKey,'tapping a day opens it');
  // A Chandrashtama day: the Today card says so.
  {const k=keyOf(care[0]);assert.ok(/Chandrashtama/.test(w.eval(`personalLine(vedicDay('${k}'),'${k}')`)),'Chandrashtama named on its day');}
  w.setDay('2026-11-14');w.show('personal');assert.ok(/Next favourable day/.test($('#app .personalDay').textContent),'next favourable day offered');
  assert.deepEqual(errors,[]);}
// Without birth details: CTA on Calendar and Today; saving stays on Calendar.
{const {w,errors,$,$$}=boot({loc:{name:'Ahmedabad',...loc},prefs:{onboarded:true}});
  w.show('personal');assert.ok($('#app .rashicard'),'rashi card needs no birth details');assert.equal($$('#app .rring path.mine').length,0);
  assert.ok(/favourable/i.test($('#app .card.me.empty').textContent),'You CTA mentions favourable days');
  w.show('calendar');const cta=$('#app .favcta button');assert.ok(cta,'Calendar CTA');assert.equal($$('#app .favdays').length,0);
  cta.click();assert.ok($('#modal').open,'CTA opens the birth form');
  $('#birthDate').value=profile.date;$('#birthTime').value=profile.time;$('#birthZone').value=profile.zone;$('#birthLat').value=profile.lat;$('#birthLon').value=profile.lon;$('#birthPlace').value=profile.place;
  $('#modal form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  assert.ok(!$('#modal').open,'sheet closes');assert.ok($('#app .favdays .chip.fav'),'favourable days appear on the Calendar right away');
  assert.deepEqual(errors,[]);}
console.log('PASS: Chandra rashi card (rashi, end time, ring), favourable days match the calendar dots, Chandrashtama days, next favourable day, CTA without birth details and saving returns to Calendar');
process.exit(0);
