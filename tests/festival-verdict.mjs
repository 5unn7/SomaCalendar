import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
/* For a believer the festival is the muhurat. On every 2026 festival day (Ahmedabad and Toronto), Today must never call
   the day mixed or take-care, never tell the reader to avoid ceremonies or new ventures, and must name the festival in the hero. */
const base='android/app/src/main/assets/';
const BAN=/ceremon|new venture|new beginning|purchases|weddings|auspicious beginnings|government work only/i;
let checked=0,windows=0;
for(const loc of [{name:'Ahmedabad',lat:23.0225,lon:72.5714,zone:'Asia/Kolkata'},{name:'Toronto',lat:43.6532,lon:-79.3832,zone:'America/Toronto'}]){
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(readFileSync(base+'index.html','utf8'),{runScripts:'dangerously',url:'https://soma.local',virtualConsole:vc});
  const w=dom.window;w.localStorage.setItem('soma-redesign-v1',JSON.stringify({loc,prefs:{onboarded:true,lang:'en',custom:true,sets:['gujarati','india','international','vrat']}}));
  w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},createImageData:(x,y)=>({data:new Uint8ClampedArray(x*y*4)}),putImageData(){}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.scrollTo=()=>{};
  for(const f of ['astronomy.js','clock.js','core.js','panchang.js','meanings.js','festivals.js','widget.js','i18n.js','natal.js','places.js','dial.js','app.js']){const s=w.document.createElement('script');s.textContent=readFileSync(base+f,'utf8');w.document.body.appendChild(s);}
  const fests=w.eval("Fe.visible(Fe.list('2026-01-01',365,loc),Fe.SETS)").filter(f=>f.kind==='festival');
  assert.ok(fests.length>30,'a year of festivals: '+fests.length);
  for(const f of fests){
    w.setDay(f.day);
    const v=w.eval(`verdict(vedicDay('${f.day}'))`);
    assert.ok(v.parva,`${f.en} ${f.day} ${loc.name} is a parva day`);
    assert.ok(!BAN.test(v.avoid),`${f.en} ${f.day}: avoid text contradicts the festival: ${v.avoid}`);
    for(const lay of ['dial','sky','folio']){
      w.setLayout(lay);const hero=w.document.querySelector('#app .lead').textContent;
      assert.ok(!/A mixed day|Take care|A day for care/i.test(hero),`${lay} hero on ${f.en} calls the day mixed or care: ${hero.slice(0,200)}`);
      assert.ok(hero.includes(w.eval('L').festName(w.eval(`verdict(vedicDay('${f.day}'))`).festival)),`${lay} hero names the festival on ${f.day}`);
    }
    if(v.win&&typeof v.festival.tithi==='number'){const vf=v.festival,ti=w.Kaal.tithi(v.win.start).index;assert.equal(ti,vf.tithi,`${f.en} ${f.day}: puja window ${v.win.start.toISOString()} falls in tithi ${ti}, not ${vf.en}'s ${vf.tithi}`);
      const fr=w.eval(`vedicDay('${f.day}').frame`);if(vf.rule==='sunset'||vf.rule==='midnight')assert.ok(v.win.start>=fr.sunset,`${vf.en} ${f.day}: ${vf.rule} festival puja window is after sunset`);else assert.ok(v.win.end<=fr.sunset,`${f.en}: daytime window`);windows++;}
    const full=w.document.querySelector('.card.verdict').textContent;assert.ok(!BAN.test(full),`Full panchang on ${f.en} ${f.day}: ${full}`);
    checked++;
  }
  const dw=fests.find(f=>f.key==='diwali');if(dw&&loc.name==='Ahmedabad'){const v=w.eval(`verdict(vedicDay('${dw.day}'))`);assert.ok(!v.win||v.win.start>=w.eval(`vedicDay('${dw.day}').frame.sunset`),'Diwali puja time is in the evening');}
  // Labh Pancham itself: the hero gives the puja window.
  const lp=fests.find(f=>f.key==='labhpancham');if(lp){w.setDay(lp.day);w.setLayout('dial');assert.match(w.document.querySelector('.daytitle').textContent,/Best time for puja: .+ · (Amrit|Shubh|Labh)/);}
  assert.deepEqual(errors,[]);dom.window.close();
}
console.log(`PASS: ${checked} festival days (${windows} with a puja time inside the festival's own tithi and timing rule) in 2026 (Ahmedabad, Toronto) lead with the festival and never contradict it`);
