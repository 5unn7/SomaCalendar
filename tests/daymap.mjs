import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
/* Day at a glance: Dur Muhurta and Bhadra are right, the Muhurat map and Today strip render, and the Calendar's
   "Coming up" never lists a festival that has already gone. */
const require=createRequire(import.meta.url);
globalThis.Astronomy=require('astronomy-engine');globalThis.Kaal=require('../src/redesign/core.js');
const K=globalThis.Kaal,P=require('../src/redesign/panchang.js');
const loc={lat:23.0225,lon:72.5714,zone:'Asia/Kolkata'};
// Dur Muhurta: one or two per weekday; Saturday's two touch and are printed as one stretch; Tuesday has a night one.
for(let i=0;i<7;i++){const key=K.addDay('2026-11-15',i),d=P.day(key,loc),dur=d.periods.dur;
  assert.ok(dur.length>=1&&dur.length<=2,key);
  for(const p of dur)assert.ok(p.end>p.start&&p.start>=d.frame.sunrise&&p.end<=d.frame.nextSunrise,key+' inside the Vedic day');
  if(d.frame.weekday===6){assert.equal(dur.length,1);assert.ok(Math.abs((dur[0].end-dur[0].start)-2*(d.frame.sunset-d.frame.sunrise)/15)<1000,'Saturday: first two muhurtas');}
  if(d.frame.weekday===2)assert.ok(dur.some(p=>p.night),'Tuesday night Dur Muhurta');}
// Bhadra: every interval is Vishti karana and touches its Vedic day; Kartik Purnima 2026 has Bhadra in its first half.
let seen=0;
for(let i=0;i<120;i++){const key=K.addDay('2026-09-01',i),d=P.day(key,loc);
  for(const b of d.periods.bhadra){seen++;assert.ok(b.end>b.start,key);assert.ok(b.end>d.frame.sunrise&&b.start<d.frame.nextSunrise,key+' touches the day');
    assert.ok(b.end-b.start>6*36e5&&b.end-b.start<16*36e5,key+' about half a tithi');
    assert.equal(P.karana(new Date((+b.start+ +b.end)/2)).index,6,key+' is Vishti');}}
assert.ok(seen>25,'Bhadra comes about eight times a lunar month');
{const d=P.day('2026-11-24',loc);assert.equal(d.periods.bhadra.length,1);assert.ok(d.periods.bhadra[0].start<d.frame.sunrise);}
// Strict good windows never touch any kaal period or Bhadra.
for(let i=0;i<30;i++){const d=P.day(K.addDay('2026-11-01',i),loc),bad=[d.periods.rahu,d.periods.yamaganda,d.periods.gulika,...d.periods.dur,...d.periods.bhadra];
  for(const w of P.goodWindows(d,d.frame.sunrise,{strict:true}))for(const b of bad)assert.ok(!P.overlaps(w,b));}

// Screens.
const base='android/app/src/main/assets/',errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(readFileSync(base+'index.html','utf8'),{runScripts:'dangerously',url:'https://soma.local',virtualConsole:vc});
const w=dom.window;w.localStorage.setItem('soma-redesign-v1',JSON.stringify({loc:{name:'Ahmedabad',...loc},prefs:{onboarded:true}}));
w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},createImageData:(x,y)=>({data:new Uint8ClampedArray(x*y*4)}),putImageData(){}});
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.scrollTo=()=>{};
w.SomaNative={updateWidgetFeed(){},scheduleReminders(){},requestNotifications(){},appReady(){},appFailure(){}};
for(const f of ['astronomy.js','clock.js','core.js','panchang.js','meanings.js','festivals.js','widget.js','i18n.js','natal.js','places.js','dial.js','app.js']){const s=w.document.createElement('script');s.textContent=readFileSync(base+f,'utf8');w.document.body.appendChild(s);}
const $$=s=>[...w.document.querySelectorAll(s)];
w.SomaClock.set(Date.parse('2026-11-14T06:30:00Z'));w.SomaClock.tick();   // noon in Ahmedabad
w.setDay('2026-11-14');w.show('muhurat');w.setMuhuratTab('times');
const B='#app .boardsec ';
assert.equal($$(B+'.ctile').length,16,'all 16 Choghadiya on the board');
assert.ok($$(B+'.bcol.bad .brow').some(b=>/Rahu/.test(b.textContent)),'Rahu Kaal in the Avoid column');
assert.ok($$(B+'.bcol.bad .brow').some(b=>/Dur Muhurta/.test(b.textContent)),'Dur Muhurta in the Avoid column');
assert.ok($$(B+'.bcol.good .brow').some(b=>/Abhijit/.test(b.textContent)),'Abhijit in the Shubh column');
assert.ok(!$$(B+'.bcol.good .brow').some(b=>/Rahu|Yamaganda|Gulika/.test(b.textContent)),'nothing to avoid in the Shubh column');
assert.ok(w.document.querySelector(B+'.ribbon .now'),'now marker on the ribbon');
assert.ok($$(B+'.ctile.current').length===1,'running Choghadiya marked');
$$(B+'.bcol.bad .brow')[0].click();assert.ok(w.document.querySelector('#modal').open);assert.ok(/What to do/.test(w.document.querySelector('#modal').textContent));w.document.querySelector('#modal').close();
$$(B+'.ctile')[0].click();assert.ok(/Choghadiya/.test(w.document.querySelector('#sheetTitle').textContent));w.document.querySelector('#modal').close();
w.setDay('2026-11-24');w.show('muhurat');assert.ok($$(B+'.bcol.bad .brow').some(b=>/Bhadra/.test(b.textContent)),'Bhadra on Kartik Purnima');assert.ok(w.document.querySelector(B+'.ribbon .m.bh'),'Bhadra on the ribbon');
w.setDay('2026-11-14');
w.show('today');assert.ok(w.document.querySelector('#app .dialbox .dial-hand'),'Today dial shows now');
assert.ok(!w.document.querySelector('#app .boardsec'),'Today has one day at a glance: the dial, not the Muhurat board');
// The redesign drops the "At a glance" heading so Today fits one phone screen; the dial card is the one day at a glance.
assert.equal(w.document.querySelectorAll('#app .dialbox').length,1,'one day at a glance on Today: the dial card');
assert.ok((w.document.querySelector('#app').textContent.match(/At a glance/g)||[]).length<=1,'at most one "At a glance" heading on Today');
// Before sunrise the night still running is yesterday's: the board and strip show it, with the now marker.
w.SomaClock.set(Date.parse('2026-11-13T20:30:00Z'));w.SomaClock.tick();w.setDay('2026-11-14');   // 2:00 am in Ahmedabad
w.show('muhurat');assert.ok(w.document.querySelector(B+'.ribbon .now'),'pre-dawn: now marker on last night');assert.ok($$(B+'.ctile.current').length===1,'pre-dawn: running Choghadiya marked');
$$(B+'.ctile')[0].click();assert.ok(/13/.test(w.document.querySelector('#modal .eyebrow').textContent),'sheet names the Vedic day it belongs to');w.document.querySelector('#modal').close();
w.show('today');assert.ok(w.document.querySelector('#app .dialbox .dial-hand'),'pre-dawn: Today dial shows now');
w.SomaClock.set(Date.parse('2026-11-14T06:30:00Z'));w.SomaClock.tick();w.setDay('2026-11-14');
// Calendar: "Coming up" starts today; the month's earlier festivals are folded away.
w.show('calendar');
const rows=$$('#app .section .list > .rowbtn').filter(r=>!r.closest('details'));
assert.ok(rows.length>0);
for(const r of rows){const d=/(?:setDay|festivalSheet)\([^)]*'(\d{4}-\d\d-\d\d)'\)/.exec(r.getAttribute('onclick'))[1];assert.ok(d>='2026-11-14','coming up never lists a past day: '+d);}
assert.ok($$('#app .weekhead').length>0,'coming up is grouped by week');
w.changeMonth(-1);assert.equal($$('#app .weekhead + .list > .rowbtn').filter(r=>!r.classList.contains('gone')).length,0,'a past month lists its festivals as gone');
w.changeMonth(2);assert.equal($$('#app .rowbtn.gone').length,0,'a future month lists nothing as gone');
assert.deepEqual(errors,[]);dom.window.close();
console.log('PASS: Dur Muhurta and Bhadra, strict good windows, Muhurat day board (columns, ribbon, Choghadiya grid, pre-dawn night, sheets), Today strip, Calendar coming up starts today');
