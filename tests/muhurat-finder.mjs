import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
/* The Muhurat finder reads the panchang at each window, not only at sunrise, and says why today is ruled out.
   Saskatoon, Friday 2026-11-27: Krishna Chaturthi (Rikta) holds all daylight, so today is no vehicle muhurat. The old
   sunrise-only check skipped Wed 2 Dec (Rikta Navami at sunrise, Dashami by afternoon) and Thu 3 Dec (Bhadra at sunrise,
   clear by noon), so every event showed Fri 4 Dec first. */
const base='android/app/src/main/assets/';
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(readFileSync(base+'index.html','utf8'),{runScripts:'dangerously',url:'https://soma.local',virtualConsole:vc}),w=dom.window;
w.localStorage.setItem('soma-redesign-v1',JSON.stringify({loc:{name:'Saskatoon',lat:52.1332,lon:-106.67,zone:'America/Regina'},prefs:{onboarded:true,lang:'en'}}));
w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},createImageData:(x,y)=>({data:new Uint8ClampedArray(x*y*4)}),putImageData(){}});
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.scrollTo=()=>{};
for(const f of ['astronomy.js','clock.js','core.js','panchang.js','meanings.js','festivals.js','widget.js','i18n.js','natal.js','places.js','dial.js','weather.js','app.js']){const s=w.document.createElement('script');s.textContent=readFileSync(base+f,'utf8');w.document.body.appendChild(s);}
w.SomaClock.set(new Date('2026-11-27T17:40:00Z'));w.SomaClock.tick('clock');w.setDay('2026-11-27');
const $=s=>w.document.querySelector(s);
assert.equal(w.eval('todayKey()'),'2026-11-27');
const hits=ev=>w.eval(`muhuratDaysNow('${ev}',todayKey(),60).map(x=>x.key)`);
const veh=hits('vehicle');
assert.ok(!veh.includes('2026-11-27'),'Rikta tithi all day: today is no vehicle muhurat');
assert.equal(veh[0],'2026-12-02','an afternoon after a Rikta tithi ends counts');
assert.ok(veh.includes('2026-12-03'),'a day whose Bhadra ends by noon counts');
assert.ok(new Set(['griha','vehicle','business','property','learning','travel','mundan'].map(e=>hits(e)[0])).size>1,'events do not all share one first day');
// Each window sits where the panchang suits the event and clear of Bhadra and Dur Muhurta.
for(const ev of ['vehicle','griha','travel'])for(const x of w.eval(`muhuratDaysNow('${ev}',todayKey(),60)`)){
  const mid=new Date((+x.win.start+ +x.win.end)/2),e=w.eval(`M.EVENTS.find(e=>e.key==='${ev}')`);
  assert.equal(w.eval(`muhuratFault(M.EVENTS.find(e=>e.key==='${ev}'),K.tithi(new Date(${+mid})).index,P.nakshatra(new Date(${+mid})).index,P.yoga(new Date(${+mid})).index)`),'',`${ev} ${x.key}: panchang suits the window`);
  for(const p of (x.d.periods.bhadra||[]).concat(x.d.periods.dur||[]))assert.ok(!(x.win.start<p.end&&p.start<x.win.end),`${ev} ${x.key}: window clear of Bhadra and Dur Muhurta`);
  assert.ok(e&&x.win.end-x.win.start>=20*6e4);
}
// The finder says so in words, and points to the next good day.
w.show('muhurat');w.eval("muhuratEvent='vehicle'");w.muhuratView();
const card=$('#app .mtoday');assert.ok(card,'a Today card when today is not a muhurat');
assert.match(card.textContent,/Not a muhurat for this today/);assert.match(card.textContent,/Chaturthi.*Rikta/);assert.match(card.textContent,/Next good day: Wed/);
// On a good day the top row is labelled Today and no card shows.
w.SomaClock.set(new Date('2026-12-02T15:00:00Z'));w.SomaClock.tick('clock');w.setDay('2026-12-02');w.show('muhurat');w.eval("muhuratEvent='vehicle'");w.muhuratView();
assert.equal($('#app .mtoday'),null);assert.match($('#app .rowbtn strong').textContent,/^Today · /);
for(const lang of ['gu','hi']){w.setLang(lang);w.SomaClock.set(new Date('2026-11-27T17:40:00Z'));w.SomaClock.tick('clock');w.setDay('2026-11-27');w.show('muhurat');w.muhuratView();assert.ok($('#app .mtoday')&&!/Not a muhurat|Rikta|tithi/.test($('#app .mtoday').textContent),lang+': Today card is translated: '+$('#app .mtoday')?.textContent);}
assert.deepEqual(errors,[]);
console.log('muhurat finder: ok');
process.exit(0);
