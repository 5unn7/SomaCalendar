import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
/* One answer to "is now a good time?" (design review P0-1). Inside Rahu Kaal, Yamaganda or Gulika on every weekday the
   Today hero, the Plan sheet and the Muhurat summary all say Avoid, whatever Choghadiya is running; the widget feed carries
   the same three periods. Also: the first-run steps (Skip guesses a place from the time zone, birth date lists), and the
   gazetteer loading only when a search needs it. */
const base='android/app/src/main/assets/';
function boot(prefs,opt={}){
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(readFileSync(base+'index.html','utf8'),{runScripts:'dangerously',url:'https://soma.local',virtualConsole:vc}),w=dom.window;
  w.localStorage.setItem('soma-redesign-v1',JSON.stringify({loc:{name:'Ahmedabad',lat:23.0225,lon:72.5714,zone:'Asia/Kolkata'},prefs:Object.assign({onboarded:true,lang:'en'},prefs)}));
  w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},createImageData:(x,y)=>({data:new Uint8ClampedArray(x*y*4)}),putImageData(){}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.scrollTo=()=>{};
  if(opt.native)w.SomaNative=opt.native;
  for(const f of opt.files||['astronomy.js','clock.js','core.js','panchang.js','meanings.js','festivals.js','widget.js','i18n.js','natal.js','places.js','dial.js','weather.js','app.js']){const s=w.document.createElement('script');s.textContent=readFileSync(base+f,'utf8');w.document.body.appendChild(s);}
  return {w,errors,dom,$:s=>w.document.querySelector(s)};
}
{const {w,errors,dom,$}=boot();
  let checked=0;
  // A week from Sunday 2026-11-15, the middle of each kaal.
  for(let i=0;i<7;i++){
    const key=w.Kaal.addDay('2026-11-15',i),d=w.eval(`vedicDay('${key}')`);
    for(const k of ['rahu','yamaganda','gulika']){
      const p=d.periods[k],mid=new Date((+p.start+ +p.end)/2);
      w.SomaClock.set(mid);w.SomaClock.tick('clock');w.setDay(key);w.show('today');
      const ns=w.eval(`nowState(now())`);assert.equal(ns.level,'bad',`${key} ${k}: nowState says avoid`);assert.equal(ns.kaal.k,k);
      const pill=$('#app .skyhero.today .pill');assert.ok(pill.classList.contains('bad'),`${key} ${k}: hero pill is Avoid, not ${pill.className}`);
      assert.match($('#app .skyhero.today h1.big').textContent,k==='rahu'?/Rahu Kaal/:k==='yamaganda'?/Yamaganda/:/Gulika/,`${key} ${k}: hero names the kaal`);
      assert.ok(!/Good time/.test($('#app .skyhero.today .status').textContent),`${key} ${k}: never "Good time" in a kaal`);
      // The Plan sheet checks the same minute the same way.
      const hhmm=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(mid);
      w.plan(hhmm);w.timingCheck();assert.match($('#timingCheck').textContent,/Avoid/,`${key} ${k}: Plan sheet says Avoid at ${hhmm}`);w.closeSheet();
      checked++;
    }
  }
  assert.equal(checked,21);
  // Outside every kaal, a good Choghadiya reads Good time.
  {const d=w.eval(`vedicDay('2026-11-16')`),kl=w.eval(`kaalsOf(vedicDay('2026-11-16'))`);
   const c=d.choghadiya.find(c=>!c.night&&c.nature==='good'&&!kl.some(p=>p.start<c.end&&c.start<p.end));
   if(c){w.SomaClock.set(new Date((+c.start+ +c.end)/2));w.SomaClock.tick('clock');w.setDay('2026-11-16');w.show('today');assert.ok($('#app .skyhero.today .pill').classList.contains('good'),'clean shubh Choghadiya reads Good');}}
  // A pradosh puja ends with its tithi (Ahmedabad 2026-03-01: Trayodashi ends in the evening).
  {const r=w.eval("(()=>{const f=observances('2026-02-25',10).find(x=>x.day==='2026-03-01'&&Fe.pujaOf(x)==='pradosh');if(!f)return null;const win=festWindow(vedicDay(f.day),f);return win&&{s:+win.start,e:+win.end,te:+K.tithi(win.start).end,ok:K.tithi(win.start).index===f.tithi}})()");
   if(r){assert.ok(r.ok,'pradosh starts in the tithi');assert.ok(r.e<=r.te,'pradosh window ends by the tithi end');}}
  // After 11:45 pm the Plan sheet's default time stays on the chosen day, not tomorrow's midnight.
  {w.SomaClock.set(new Date('2026-11-15T18:20:00Z'));w.SomaClock.tick('clock');w.setDay(w.eval('todayKey()'));w.plan();
   assert.equal($('#eventTime').value,'23:59','late default stays today');w.closeSheet();}
  // Back walks out: sheet, then page, then Today.
  w.push('panchang');w.termSheet('tithi');assert.ok($('#modal').open);assert.equal(w.somaBack(),true);assert.ok(!$('#modal').open,'Back closes the sheet');
  assert.equal(w.somaBack(),true);assert.equal(w.eval('view'),'today','Back leaves the pushed page');
  w.show('calendar');assert.equal(w.somaBack(),true);assert.equal(w.eval('view'),'today','Back from a tab returns to Today');
  assert.equal(w.somaBack(),false,'Back on Today leaves the app');
  // ⓘ tips open a sheet that says what the term is.
  for(const k of ['tithi','nakshatra','yoga','karana','vaar','rahu','abhijit']){w.termSheet(k);assert.ok($('#modal .leadline').textContent.length>20,k+' explained');w.closeSheet();}
  assert.deepEqual(errors,[]);dom.window.close();}
// Widget feed: Yamaganda and Gulika ride along with Rahu Kaal for the native widgets.
{const feeds=[];const {w,errors,dom}=boot({},{native:{updateWidgetFeed:j=>feeds.push(JSON.parse(j)),scheduleReminders(){},appReady(){},appFailure(){},fontScale:()=>1}});
  await new Promise(r=>setTimeout(r,700));const f=feeds.at(-1);assert.ok(f&&f.days.every(d=>d.rahu&&d.yama&&d.gulika),'every widget day has rahu, yama and gulika');
  assert.deepEqual(errors,[]);dom.window.close();}
// First run: Skip on the place step guesses from the phone's time zone and says so; the birth date lists fill the form.
{const {w,errors,dom,$}=boot({onboarded:false});
  assert.ok($('#onboard .obbar .obskip'),'Skip sits in the top bar');assert.match($('#onboard .obstep').textContent,/1/);
  w.onboard(2);w.skipPlace();assert.match($('#toast').textContent,/Change it any time/);assert.ok($('#onboard .months'),'Skip moves on to the calendar step');
  w.onboard(4);$('#dobD').value='18';$('#dobM').value='8';$('#dobY').value='1993';w.syncDob();assert.equal($('#birthDate').value,'1993-08-18');
  $('#dobD').value='31';$('#dobM').value='2';w.syncDob();assert.equal($('#birthDate').value,'','31 February is not a date');
  w.finishOnboard('today');assert.equal(w.eval('view'),'today','setup lands on Today');
  assert.deepEqual(errors,[]);dom.window.close();}
// The 2.8 MB gazetteer is not in the page; the first search loads it.
{const html=readFileSync(base+'index.html','utf8');assert.ok(!/places\.js/.test(html),'places.js is not loaded at launch');
  const {w,errors,dom}=boot({},{files:['astronomy.js','clock.js','core.js','panchang.js','meanings.js','festivals.js','widget.js','i18n.js','natal.js','dial.js','weather.js','app.js']});
  assert.equal(w.Places,undefined);w.locationSheet();w.placeSearch('Surat','loc');
  const sc=[...w.document.querySelectorAll('script[src]')].find(s=>/places\.js$/.test(s.getAttribute('src')));assert.ok(sc,'search asks for places.js');
  assert.deepEqual(errors,[]);dom.window.close();}
console.log('PASS: Rahu Kaal, Yamaganda and Gulika read Avoid on all 7 weekdays in hero and Plan sheet; clean shubh reads Good; Back order; info tips; widget feed kaals; onboarding Skip and birth date; lazy gazetteer');
