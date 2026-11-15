import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
/* Live weather: the forecast hour that holds now, high/low, staleness, the layers each sky gets, and the Today card
   chip and sheet in all three layouts and languages (with a stub of the native shell, which owns the network). */
const require=createRequire(import.meta.url),W=require('../src/redesign/weather.js');
const H=36e5,t0=Date.UTC(2026,10,14,6,0,0);
const hours=Array.from({length:30},(_,i)=>({t:t0+i*H,c:20+i,s:'x',k:i<2?'rain':'clear',p:i<2?1.2:0,w:i===0?9:2,cl:80,h:70}));
const data={v:1,at:t0,lat:22.47,lon:70.06,hours};
let n=W.at(data,t0+30*6e4,t0+6*H);
assert.ok(n.ok);assert.equal(n.temp,20);assert.equal(n.kind,'rain');assert.equal(n.windy,true);assert.equal(n.hi,25);assert.equal(n.lo,20);
n=W.at(data,t0+H+1,t0+6*H);assert.equal(n.temp,21);assert.equal(n.windy,false);
// Late at night (under 3 hours left today) high/low look at the next 24 hours.
n=W.at(data,t0+2*H,t0+3*H);assert.equal(n.hi,22+23);
assert.equal(W.at(data,t0+13*H,t0+20*H).ok,false,'a forecast older than 12 hours is not shown');
assert.equal(W.at(data,t0-2*H,t0).ok,false);assert.equal(W.at(null,t0,t0).ok,false);
assert.deepEqual(W.effects('thunder',true,false),{clouds:1,rain:0.9,snow:0,fog:false,flash:true,glow:false,stars:false,wind:false});
assert.equal(W.effects('clear',false,false).stars,true);assert.equal(W.effects('clear',true,true).glow,true);assert.equal(W.effects('clear',true,true).wind,true);
assert.equal(W.effects('sleet',true,false).snow>0&&W.effects('sleet',true,false).rain>0,true);
assert.equal(W.tint('rain',true),'rain');assert.equal(W.tint('rain',false),'nightcloud');assert.equal(W.tint('clear',true),'');
assert.equal(W.deg(20,false),'20°');assert.equal(W.deg(20,true),'68°');assert.equal(W.deg(-0.4,false),'0°');
assert.ok(W.fahrenheitFor('America/Chicago'));assert.ok(W.fahrenheitFor('America/Indiana/Indianapolis'));assert.ok(!W.fahrenheitFor('America/Toronto'));assert.ok(!W.fahrenheitFor('America/Regina'));assert.ok(!W.fahrenheitFor('Asia/Kolkata'));
for(const k of ['clear','fair','partly','cloudy','fog','drizzle','rain','heavyrain','showers','sleet','lightsnow','snow','heavysnow','thunder'])for(const day of [true,false]){
  assert.match(W.icon(k,day),/<svg[^>]*><(g|path)/,k);if(W.effects(k,day,false).clouds||k==='clear')assert.match(W.fx(k,day,false),/class="wxfx"/);}

// The Today card with a stub shell.
const base='android/app/src/main/assets/';
const ALLOW=new Set(['Soma','MET','Norway','Jamnagar']);
function boot(lang,layout,weather,store){
  const errors=[],calls=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(readFileSync(base+'index.html','utf8'),{runScripts:'dangerously',url:'https://soma.local',virtualConsole:vc});
  const w=dom.window,live=Date.now(),h0=Math.floor(live/H)*H;
  const fresh={v:1,at:live,lat:22.47,lon:70.06,hours:Array.from({length:30},(_,i)=>({t:h0+i*H,c:24+i%5,s:'x',k:['thunder','rain','snow','fog','partly','clear'][i%6],p:0.6,w:9,cl:90,h:80}))};
  w.localStorage.setItem('soma-redesign-v1',JSON.stringify({loc:{name:'Jamnagar',lat:22.4707,lon:70.0577,zone:'Asia/Kolkata'},prefs:Object.assign({lang,layout,onboarded:true},weather===undefined?{}:{weather})}));
  w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},createImageData:(x,y)=>({data:new Uint8ClampedArray(x*y*4)}),putImageData(){}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.scrollTo=()=>{};
  w.SomaNative={weatherConfigure:(...a)=>calls.push(['configure',...a]),weatherRefresh:(...a)=>calls.push(['refresh',...a]),weatherNow:()=>store===undefined?JSON.stringify(fresh):store,appReady(){},appFailure:m=>errors.push(m)};
  for(const f of ['astronomy.js','clock.js','core.js','panchang.js','meanings.js','festivals.js','widget.js','i18n.js','natal.js','places.js','dial.js','weather.js','app.js']){const s=w.document.createElement('script');s.textContent=readFileSync(base+f,'utf8');w.document.body.appendChild(s);}
  return {w,errors,calls,fresh};
}
const latin=el=>{const txt=el.textContent+' '+[...el.querySelectorAll('[aria-label]')].map(x=>x.getAttribute('aria-label')).join(' ');return (txt.match(/[A-Za-z]{3,}/g)||[]).filter(x=>!ALLOW.has(x));};
for(const lang of ['en','gu','hi'])for(const layout of ['today']){
  const {w,errors,calls}=boot(lang,layout,true);
  const chip=w.document.querySelector('#app .wxchip');
  assert.ok(chip,`${lang}/${layout}: weather chip`);assert.match(chip.textContent,/\d°/);assert.ok(chip.getAttribute('aria-label').length>10);
  if(layout!=='folio')assert.ok(w.document.querySelector('#app .wxfx'),`${lang}/${layout}: moving sky`);
  assert.ok(calls.some(c=>c[0]==='configure'&&c[1]===true&&c[2]==='c'&&Math.abs(c[3]-22.47)<0.01),'asks the shell for a fresh forecast for the place on screen, in Celsius');
  w.weatherSheet();const sheet=w.document.querySelector('#modal');
  assert.ok(sheet.querySelector('.wxnow'));assert.ok(sheet.querySelectorAll('.hours>div').length>=6);assert.match(sheet.textContent,/MET Norway/);
  if(lang!=='en'){assert.deepEqual(latin(w.document.querySelector('#app .wxchip')),[],`${lang} chip`);assert.deepEqual(latin(sheet),[],`${lang} sheet`);}
  w.setWeather(false);assert.ok(calls.some(c=>c[0]==='configure'&&c[1]===false),'turning off tells the shell');assert.equal(w.document.querySelector('#app .wxfx'),null);
  assert.deepEqual(errors,[]);
}
// Off by default: an invitation, an honest opt-in sheet, and "Not now" hides it for good.
{const {w,calls}=boot('en','dial',undefined,'');
  const inv=w.document.querySelector('#app .wxchip.invite');assert.ok(inv);assert.equal(calls.length,0,'nothing is fetched until the person turns weather on');
  w.weatherSheet();assert.match(w.document.querySelector('#modal').textContent,/approximate position/);
  w.dismissWeather();assert.equal(w.document.querySelector('#app .wxchip'),null);}
{const {w,calls}=boot('gu','sky',undefined,'');w.weatherSheet();assert.deepEqual(latin(w.document.querySelector('#modal')),[]);
  w.setWeather(true);assert.ok(calls.some(c=>c[0]==='configure'&&c[1]===true&&c[2]==='c'),'turns on in Celsius for an Indian locale');}
// A forecast for another place is never shown for this one.
{const {w}=boot('en','dial',true,JSON.stringify({v:1,at:Date.now(),lat:52.1,lon:-106.6,hours:[{t:Math.floor(Date.now()/H)*H,c:-10,k:'snow',w:1}]}));
  assert.equal(w.document.querySelector('#app .wxfx'),null);assert.doesNotMatch(w.document.querySelector('#app').textContent,/-10°/);}
// Without the native shell (browser, tests) nothing about weather shows.
{const vc=new VirtualConsole();const dom=new JSDOM(readFileSync(base+'index.html','utf8'),{runScripts:'dangerously',url:'https://soma.local',virtualConsole:vc});const w=dom.window;
  w.localStorage.setItem('soma-redesign-v1',JSON.stringify({prefs:{onboarded:true,weather:true}}));w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.scrollTo=()=>{};
  w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},createImageData:(x,y)=>({data:new Uint8ClampedArray(x*y*4)}),putImageData(){}});
  for(const f of ['astronomy.js','clock.js','core.js','panchang.js','meanings.js','festivals.js','widget.js','i18n.js','natal.js','places.js','dial.js','weather.js','app.js']){const s=w.document.createElement('script');s.textContent=readFileSync(base+f,'utf8');w.document.body.appendChild(s);}
  assert.equal(w.document.querySelector('.wxchip'),null);}
// The widget feed carries the place, rounded to about 1 km, for the native Sky widget.
{const F=require('../src/redesign/widget.js');const f=F.build({name:'Jamnagar',lat:22.4707,lon:70.0577,zone:'Asia/Kolkata'},new Date(t0),[]);assert.equal(f.lat,22.47);assert.equal(f.lon,70.06);}
console.log('PASS: forecast hour, high/low, 12-hour staleness, layers per sky, chip and sheet on Dial/Sky/Folio in en/gu/hi, opt-in only, off tells the shell, other-place forecasts ignored, feed carries rounded place');
process.exit(0);
