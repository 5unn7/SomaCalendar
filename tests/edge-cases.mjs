import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),K=require('../src/redesign/core.js'),P=require('../src/redesign/panchang.js'),Fe=require('../src/redesign/festivals.js');
const hm=(d,z)=>new Intl.DateTimeFormat('en-GB',{timeZone:z,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);

// Far north in summer the sunset comes after local midnight. The day must still run sunrise to that sunset,
// not fall back to a made-up 6 pm (Reykjavik 21 June 2026: sunrise 02:55, sunset 00:04 the next night).
for(const [n,lat,lon,zone] of [['Reykjavik',64.15,-21.94,'Atlantic/Reykjavik'],['Fairbanks',64.84,-147.72,'America/Anchorage']]){
  const loc={lat,lon,zone},f=P.frame('2026-06-21',loc);
  assert.ok(f.sunset>f.sunrise&&f.sunset-f.sunrise>20*36e5,`${n}: a 20+ hour day, got ${hm(f.sunrise,zone)}–${hm(f.sunset,zone)}`);
  assert.equal(K.dateKey(f.sunset,zone),'2026-06-22',`${n}: sunset falls after midnight`);
  const s=Fe.samples('2026-06-21',1,loc)[0];assert.equal(+s.sunset,+f.sunset,`${n}: festival day samples use the same sunset`);
}
// La Ronge in deep winter (Sunny's area): short days still frame normally.
{const f=P.frame('2026-12-21',{lat:55.1,lon:-105.28,zone:'America/Regina'});assert.equal(hm(f.sunrise,'America/Regina'),'09:24');assert.equal(hm(f.sunset,'America/Regina'),'16:33');assert.ok(!f.polar);}

// India's zone has an old name that browsers and some phones still report: Asia/Calcutta must get India's defaults.
assert.deepEqual(Fe.defaultSets({lat:19.07,lon:72.88,zone:'Asia/Calcutta'}),Fe.defaultSets({lat:19.07,lon:72.88,zone:'Asia/Kolkata'}));
assert.equal(Fe.defaultMonthSystem({lat:28.61,lon:77.21,zone:'Asia/Calcutta'}),'purnimanta');

// Nishita kaal is the 8th of 15 night muhurtas, and a midnight festival always gets its own night's nishita.
const base='android/app/src/main/assets/';
function boot(loc,prefs){
  const dom=new JSDOM(readFileSync(base+'index.html','utf8'),{runScripts:'dangerously',url:'https://soma.local'}),w=dom.window;
  w.localStorage.setItem('soma-redesign-v1',JSON.stringify({loc,prefs:prefs||{onboarded:true,lang:'en',custom:true,sets:['gujarati','india','international','vrat']}}));
  w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},createImageData:(x,y)=>({data:new Uint8ClampedArray(x*y*4)}),putImageData(){}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.scrollTo=()=>{};
  for(const f of ['astronomy.js','clock.js','core.js','panchang.js','meanings.js','festivals.js','widget.js','i18n.js','natal.js','places.js','dial.js','weather.js','app.js']){const s=w.document.createElement('script');s.textContent=readFileSync(base+f,'utf8');w.document.body.appendChild(s);}
  return dom;
}
{const dom=boot({name:'New Delhi',lat:28.61,lon:77.21,zone:'Asia/Kolkata'}),w=dom.window;
  w.setDay('2026-02-15');const v=w.eval("verdict(vedicDay('2026-02-15'))");
  assert.equal(v.festival.key,'shivratri');assert.equal(hm(v.win.start,'Asia/Kolkata'),'00:09');assert.equal(hm(v.win.end,'Asia/Kolkata'),'01:00');dom.window.close();}
{const dom=boot({name:'Ahmedabad',lat:23.0225,lon:72.5714,zone:'Asia/Kolkata'}),w=dom.window;
  w.setDay('2026-09-04');const v=w.eval("verdict(vedicDay('2026-09-04'))");
  assert.equal(v.festival.key,'janmashtami');assert.ok(v.win&&v.win.key==='nishita','Janmashtami offers its nishita puja time');
  assert.equal(hm(v.win.start,'Asia/Kolkata'),'00:15');dom.window.close();}

// Shivratri night: at 12:53 am, inside nishita, Today still names Shivratri (the Vedic day runs until sunrise).
{const dom=boot({name:'New Delhi',lat:28.61,lon:77.21,zone:'Asia/Kolkata'}),w=dom.window;
  w.SomaClock.set(new Date('2026-02-15T19:23:00Z'));w.SomaClock.tick('clock');
  assert.equal(w.eval('day'),'2026-02-16');
  for(const lay of ['dial','sky','folio']){w.setLayout(lay);const hero=w.document.querySelector('#app .lead').textContent;
    assert.ok(hero.includes('Maha Shivratri'),lay+' hero keeps Shivratri at 12:53 am: '+hero.slice(0,160));assert.match(hero,/until sunrise/);}
  // After nishita ends the hero moves on to the new day.
  w.SomaClock.set(new Date('2026-02-15T20:30:00Z'));w.SomaClock.tick('clock');w.setLayout('dial');
  assert.ok(!w.document.querySelector('#app .lead').textContent.includes('until sunrise'),'after nishita the night line goes');dom.window.close();}
// A Gujarati reader in Mumbai keeps Gujarati festivals and the Kartikadi Samvat by default.
{const dom=boot({name:'Mumbai',lat:19.07,lon:72.88,zone:'Asia/Kolkata'},{onboarded:true,lang:'gu'}),w=dom.window;
  assert.ok(w.eval('prefs.sets').includes('gujarati'));assert.equal(w.eval('samvatSystem()'),'gujarati');
  w.setLang('en');assert.ok(!w.eval('prefs.sets').includes('gujarati'),'English reader in Mumbai: pan-Indian defaults');dom.window.close();}
// Setup asks for the month system and the answer survives a change of place.
{const dom=boot({name:'Toronto',lat:43.65,lon:-79.38,zone:'America/Toronto'},{lang:'en'}),w=dom.window;
  w.onboard(3);assert.ok(w.document.querySelector('#onboard .months'));w.setMonthSys('purnimanta');
  assert.equal(w.eval('prefs.month'),'purnimanta');w.eval("setLoc({name:'Ahmedabad',lat:23.02,lon:72.57,zone:'Asia/Kolkata'});applyLocationDefaults()");
  assert.equal(w.eval('prefs.month'),'purnimanta','a chosen month system is kept');dom.window.close();}
// Polar night says so instead of showing a made-up sunrise as real.
{const dom=boot({name:'Tromsø',lat:69.65,lon:18.96,zone:'Europe/Oslo'},{onboarded:true,lang:'en'}),w=dom.window;
  w.SomaClock.set(new Date('2026-12-21T11:00:00Z'));w.SomaClock.tick('clock');
  assert.match(w.document.querySelector('#app').textContent,/No sunrise or sunset here today/);dom.window.close();}
// Abroad, a festival card names India's date when it differs: Holi 2026 is 3 March in La Ronge, 4 March in India.
{const dom=boot({name:'La Ronge',lat:55.1,lon:-105.28,zone:'America/Regina'},{onboarded:true,lang:'en'}),w=dom.window;
  const h=w.eval("Fe.list('2026-02-25',15,loc).find(x=>x.key==='dhuleti')");assert.equal(h.day,'2026-03-03');
  w.SomaClock.set(new Date('2026-03-03T18:00:00Z'));w.SomaClock.tick('clock');
  assert.match(w.document.querySelector('#app .festival').textContent,/In India: Wed, 4 Mar|In India: Wed 4 Mar/);dom.window.close();}
console.log('PASS: Shivratri night kept until sunrise, Gujarati defaults by language, month system in setup, polar note, India dates abroad');
console.log('PASS: sunset after midnight far north, La Ronge winter day, Asia/Calcutta defaults, nishita kaal width, Janmashtami nishita');
