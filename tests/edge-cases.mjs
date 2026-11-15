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
function boot(loc){
  const dom=new JSDOM(readFileSync(base+'index.html','utf8'),{runScripts:'dangerously',url:'https://soma.local'}),w=dom.window;
  w.localStorage.setItem('soma-redesign-v1',JSON.stringify({loc,prefs:{onboarded:true,lang:'en',custom:true,sets:['gujarati','india','international','vrat']}}));
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
console.log('PASS: sunset after midnight far north, La Ronge winter day, Asia/Calcutta defaults, nishita kaal width, Janmashtami nishita');
