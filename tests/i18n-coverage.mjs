import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
/* Gujarati and Hindi readers must never meet English sentences. Render every screen, sheet and lesson in gu and hi
   and fail on any run of 3+ Latin letters that is not a name on the allow-list (brand, sources, city names). */
const require=createRequire(import.meta.url),M=require('../src/redesign/meanings.js');
const base='android/app/src/main/assets/';
const ALLOW=new Set(['Soma','Preview','Drik','Lahiri','Astronomy','Engine','GeoNames','Asia','Kolkata','Jamnagar','Rajkot','Gujarat','India','IST','Install','unknown','apps','Update','Android','GitHub','English','MET','Norway','MIT','NLOD','Instrument','Serif','Manrope','Noto','SIL','OFL']);
function boot(lang){
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const store={loc:{name:'Jamnagar',lat:22.4707,lon:70.0577,zone:'Asia/Kolkata'},profile:{date:'1990-05-15',time:'08:30',timeUnknown:false,zone:'Asia/Kolkata',lat:22.3039,lon:70.8022,place:'Rajkot, Gujarat, India'},events:[{id:'x',title:'ગૃહપ્રવેશ',day:'2026-11-20',time:'10:00',start:'2026-11-20T04:30:00.000Z',end:'2026-11-20T05:30:00.000Z',zone:'Asia/Kolkata',place:'Jamnagar',tithi:'—',muhurat:''}],prefs:{lang,onboarded:true}};
  const dom=new JSDOM(readFileSync(base+'index.html','utf8'),{runScripts:'dangerously',url:'https://soma.local',virtualConsole:vc});
  const w=dom.window;w.localStorage.setItem('soma-redesign-v1',JSON.stringify(store));
  w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},createImageData:(x,y)=>({data:new Uint8ClampedArray(x*y*4)}),putImageData(){}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.scrollTo=()=>{};
  for(const f of ['astronomy.js','clock.js','core.js','panchang.js','meanings.js','festivals.js','widget.js','i18n.js','natal.js','places.js','dial.js','weather.js','app.js']){const s=w.document.createElement('script');s.textContent=readFileSync(base+f,'utf8');w.document.body.appendChild(s);}
  return {w,errors,dom};
}
const visible=el=>{const tw=el.ownerDocument.createTreeWalker(el,4),parts=[];while(tw.nextNode())parts.push(tw.currentNode.nodeValue);for(const n of el.querySelectorAll('[aria-label],[placeholder],[title]'))parts.push(n.getAttribute('aria-label')||'',n.getAttribute('placeholder')||'',n.getAttribute('title')||'');for(const o of el.querySelectorAll('option'))parts.push(o.textContent);return parts.join(' \n ');};
const latin=txt=>(txt.match(/[A-Za-z]{3,}/g)||[]).filter(x=>!ALLOW.has(x));
const problems=[];
for(const lang of ['gu','hi']){
  const {w,errors,dom}=boot(lang);
  const check=(where,el)=>{const bad=latin(visible(el));if(bad.length)problems.push(`${lang} ${where}: ${[...new Set(bad)].slice(0,12).join(', ')}`);};
  // Days that stress the copy: a festival day, an Ekadashi, an ordinary day and an eclipse season day.
  for(const d of ['2026-11-14','2026-11-20','2026-12-01','2026-08-28','2026-03-03']){
    w.setDay(d);
    w.show('today');check('today/'+d,w.document.querySelector('#app'));w.push('panchang');check('panchang/'+d,w.document.querySelector('#app'));w.back();
    for(const v of ['calendar','muhurat','moon']){w.show(v);check(v+'/'+d,w.document.querySelector('#app'));}w.show('muhurat');w.setMuhuratTab('times');check('muhurat times/'+d,w.document.querySelector('#app'));w.setMuhuratTab('find');
  }
  for(const v of ['learn','personal','settings']){w.show('personal');if(v!=='personal')w.push(v);check(v,w.document.querySelector('#app'));}w.show('today');
  check('nav',w.document.querySelector('#nav'));check('header',w.document.querySelector('header'));
  const sheets={appearance:()=>w.appearanceSheet(),notify:()=>w.notifyPrimer(),chog:()=>w.chogSheet('amrit'),day:()=>w.daySheet('2026-11-08'),about:()=>w.aboutSheet(),plan:()=>{w.show('today');w.plan();},birth:()=>w.editProfile(),location:()=>w.locationSheet(),story:()=>{w.show('today');const f=w.eval("observances('2026-11-01',30)").find(x=>x.kind==='festival');w.festivalSheet(f.key,f.day);},diwali:()=>w.festivalSheet('diwali','2026-11-08'),erase:()=>w.eraseProfile(),chogInfo:()=>{w.setDay('2026-11-24');w.boardInfo(0);},nightChogInfo:()=>w.boardInfo(10),info16:()=>w.boardInfo(16),info17:()=>w.boardInfo(17),info18:()=>w.boardInfo(18),info19:()=>w.boardInfo(19),info20:()=>w.boardInfo(20),info21:()=>w.boardInfo(21),info22:()=>w.boardInfo(22),info23:()=>w.boardInfo(23),info24:()=>w.boardInfo(24),info25:()=>w.boardInfo(25)};
  for(let i=0;i<9;i++)sheets['lesson'+i]=()=>w.lesson(i);
  for(const k of ['tithi','nakshatra','yoga','karana','vaar','amanta','rahu','yamaganda','gulika','dur','bhadra','abhijit','brahma'])sheets['term '+k]=()=>w.termSheet(k);
  for(const [k,open] of Object.entries(sheets)){open();check('sheet '+k,w.document.querySelector('#modal'));w.document.querySelector('#modal').close();}
  // Onboarding steps too.
  for(const step of [1,2,3,4]){w.onboard(step);check('onboard '+step,w.document.querySelector('#onboard'));}
  w.finishOnboard('today');
  // Reminders the phone will show.
  for(const r of w.reminderPlan()){const bad=latin(r.title+' '+r.body);if(bad.length)problems.push(`${lang} reminder: ${bad.join(', ')}`);}
  assert.deepEqual(errors,[],lang+' renders without errors');dom.window.close();
}
// Every guidance string in Meanings has both translations.
const strings=new Set();const walk=o=>{if(typeof o==='string')strings.add(o);else if(o&&typeof o==='object')for(const [k,v] of Object.entries(o))if(!['en','gu','hi','key','kind','nature','lord','mantra','chog','hora'].includes(k)||k==='en'&&false)walk(v);};
for(let i=0;i<30;i++){const t=M.tithi(i);['deity','note','good','avoid','group'].forEach(k=>strings.add(t[k]));}
for(let i=0;i<27;i++){const n=M.nakshatra(i);['deity','good','avoid','group'].forEach(k=>strings.add(n[k]));}
for(const v of M.VAAR)['deity','good','avoid'].forEach(k=>strings.add(v[k]));
for(const c of Object.values(M.CHOG))strings.add(c.good);for(const p of Object.values(M.PLANET))strings.add(p.good);for(const t of Object.values(M.TARA))strings.add(t);for(const e of M.EVENTS)strings.add(e.en);for(const r of M.RASHI)strings.add(r.good);
for(const s of strings)for(const l of ['gu','hi'])if(M.tr(s,l)===s)problems.push(`missing ${l} for meaning: ${s}`);
if(problems.length){console.error(problems.slice(0,60).join('\n'));console.error(problems.length+' untranslated spots');process.exit(1);}
console.log('PASS: every screen, sheet, lesson, onboarding step and reminder in ગુજરાતી and हिन्दी has no stray English; every meaning has both translations');
