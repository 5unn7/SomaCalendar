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
function boot(loc,prefs,opt={}){
  const dom=new JSDOM(readFileSync(base+'index.html','utf8'),{runScripts:'dangerously',url:opt.url||'https://soma.local'}),w=dom.window;
  if(opt.native)w.SomaNative=opt.native;
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
  w.festivalSheet('dhuleti','2026-03-03');assert.match(w.document.querySelector('#modal').textContent,/In India: Wed, 4 Mar|In India: Wed 4 Mar/);dom.window.close();}
// Background refresh (app closed): the off-screen run hands over a widget week in the app language and 30 days of reminders, then says it is done.
{const got={};const native={fontScale:()=>1,appReady(){},appFailure(m){got.fail=m},updateWidgetFeed(j){got.feed=JSON.parse(j)},scheduleReminders(j){got.rem=JSON.parse(j)},bgDone(){got.done=(got.done||0)+1}};
  const dom=boot({name:'Ahmedabad',lat:23.0225,lon:72.5714,zone:'Asia/Kolkata'},{onboarded:true,lang:'gu',custom:true,sets:['gujarati','india','vrat'],reminders:{vrat:true}},{url:'https://soma.local/index.html?bg=1',native}),w=dom.window;
  assert.equal(got.done,1,'background run finishes once');assert.ok(!got.fail,got.fail);
  assert.equal(got.feed.lang,'gu');assert.equal(got.feed.t.wOpenOnce,'સોમ એક વાર ખોલો');assert.ok(got.feed.t.until.includes('{x}'));
  assert.ok(got.feed.chog.every(c=>c.l&&!/^[A-Za-z]/.test(c.l)),'Choghadiya names in Gujarati');assert.ok(got.feed.tithi[0].l);
  assert.ok((got.feed.vrat||[]).length&&got.feed.vrat.every(x=>x.l),'festival names in Gujarati');assert.ok(Array.isArray(got.rem));dom.window.close();}
{const got={};const dom=boot({name:'Ahmedabad',lat:23.0225,lon:72.5714,zone:'Asia/Kolkata'},{lang:'en'},{url:'https://soma.local/index.html?bg=1',native:{fontScale:()=>1,appReady(){},appFailure(){},updateWidgetFeed(){got.feed=1},scheduleReminders(){},bgDone(){got.done=1}}});
  assert.ok(got.done,'before setup the background run still finishes');dom.window.close();}
// "Remind me" on one festival works with festival reminders off: the evening before, and half an hour before moonrise for Karwa Chauth.
{const dom=boot({name:'Toronto',lat:43.65,lon:-79.38,zone:'America/Toronto'},{onboarded:true,lang:'en',custom:true,sets:['india','vrat'],reminders:{vrat:false,parana:false}}),w=dom.window;
  w.SomaClock.set(new Date('2026-10-20T14:00:00Z'));w.SomaClock.tick('clock');w.show('today');
  const kd=w.eval("observances(todayKey(),40).find(x=>x.key==='karwa').day");w.festivalSheet('karwa',kd);
  assert.match(w.document.querySelector('dialog .remind').textContent,/Remind me/);w.toggleRemind('karwa|'+kd,'karwa',kd);
  assert.equal(w.document.querySelector('dialog .remind').getAttribute('aria-pressed'),'true');
  const plan=w.eval('reminderPlan()'),mine=plan.find(r=>r.id.startsWith('mine-karwa')),eve=plan.find(r=>r.id.startsWith('eve-karwa'));
  assert.ok(mine&&eve,'two Karwa Chauth reminders');assert.match(mine.body,/^Moonrise /);
  const mr=w.eval("vedicDay('"+kd+"').frame.data.moonrise");assert.equal(+mr-mine.at,30*6e4);
  w.toggleRemind('karwa|'+kd,'karwa',kd);assert.ok(!w.eval('reminderPlan()').some(r=>r.id.includes('karwa')),'turned off again');dom.window.close();}
// Weather on the days that matter: cloud at Karwa Chauth moonrise in the sheet and its reminder, and a storm flag on a travel day.
{const at=Date.parse('2026-10-27T12:00:00Z'),hours=[],six=[];for(let i=0;i<48;i++)hours.push({t:at+i*36e5,c:5,k:'cloudy',w:4,cl:90,h:70,p:0});
  for(let i=0;i<30;i++)six.push({t:at+48*36e5+i*6*36e5,c:3,k:i>10&&i<14?'thunder':'partly',w:5,cl:40,h:60,p:0});
  const data={v:1,at,lat:43.65,lon:-79.38,hours,six};
  const native={fontScale:()=>1,appReady(){},appFailure(){},weatherConfigure(){},weatherNow:()=>JSON.stringify(data),scheduleReminders(){},updateWidgetFeed(){}};
  const dom=boot({name:'Toronto',lat:43.65,lon:-79.38,zone:'America/Toronto'},{onboarded:true,lang:'en',custom:true,sets:['india','vrat'],weather:true,remind:{karwa:true}},{native}),w=dom.window;
  w.SomaClock.set(new Date(at+60e3));w.SomaClock.tick('clock');w.show('today');
  const kd=w.eval("observances(todayKey(),40).find(x=>x.key==='karwa').day");w.festivalSheet('karwa',kd);
  assert.match(w.document.querySelector('dialog .skyline').textContent,/Clouds may hide the moon at 7:39 pm \(90% cloud\)/);
  assert.ok(w.eval("reminderPlan()").some(r=>/clouds may hide the moon \(90%\)/.test(r.body)),'the Karwa Chauth reminder carries the cloud');
  assert.match(w.eval("wxStorm('2026-11-01')"),/Thunderstorm/);assert.equal(w.eval("wxStorm('2026-11-02')"),'');
  w.eval("prefs.weather=false");assert.equal(w.eval("festSky(findObs('karwa','"+kd+"'))"),'','weather off: no sky lines');dom.window.close();}
// A rebuilt plan just after midnight keeps the Shivratri nishita reminder (the festival is dated the day before).
{const dom=boot({name:'New Delhi',lat:28.61,lon:77.21,zone:'Asia/Kolkata'},{onboarded:true,lang:'en',custom:true,sets:['india','vrat'],reminders:{vrat:false,parana:false},remind:{shivratri:true}}),w=dom.window;
  w.SomaClock.set(new Date('2026-02-15T18:31:00Z'));w.SomaClock.tick('clock');
  const r=w.eval('reminderPlan()').find(x=>x.id==='mine-shivratri-2026-02-15');assert.ok(r,'nishita reminder survives midnight');assert.equal(hm(new Date(r.at),'Asia/Kolkata'),'00:09');
  // You always speaks for today, whatever day Calendar had open.
  w.eval("profile={date:'1990-03-12',time:'06:40',zone:'Asia/Kolkata',lat:22.47,lon:70.06,place:'Jamnagar'}");w.setDay('2026-09-01');w.show('personal');
  const nf=w.document.querySelector('#app .nextfav button');if(nf)assert.ok(!/Sep/.test(nf.textContent),'next favourable day counts from today: '+nf.textContent);dom.window.close();}
// You is two short pages: Your sky (birth, today for you, favourable days, kundali and numerology folded) and Settings.
{const dom=boot({name:'La Ronge',lat:55.1,lon:-105.28,zone:'America/Regina'},{onboarded:true,lang:'en'}),w=dom.window;
  w.eval("profile={date:'1990-03-12',time:'06:40',zone:'Asia/Kolkata',lat:22.47,lon:70.06,place:'Jamnagar'}");w.show('personal');
  const app=()=>w.document.querySelector('#app');assert.ok(app().querySelector('.card.me'));assert.ok(!app().querySelector('.switch'),'settings not on Your sky');
  assert.equal(app().querySelectorAll('details.fold').length,2);assert.ok([...app().querySelectorAll('details.fold')].every(d=>!d.open),'kundali and numerology start folded');
  w.push('settings');assert.ok(!app().querySelector('.card.me'));assert.ok(app().querySelector('.switch'),'settings save as they change');assert.ok(app().querySelector('.pagebar .back'),'settings has a back button');
  w.appearanceSheet();w.setTheme('dark');assert.ok(w.document.querySelector('#modal').open&&w.document.querySelector('#dialogBody .appearance'),'sheet stays open after a change');
  w.setLang('gu');assert.match(w.document.querySelector('#dialogBody .appearance h2').textContent,/[\u0A80-\u0AFF]/,'sheet follows the new language');dom.window.close();}
console.log('PASS: Shivratri night kept until sunrise, Gujarati defaults by language, month system in setup, polar note, India dates abroad, background refresh in the app language, Remind me per festival, moonrise cloud and travel storm flag');
console.log('PASS: sunset after midnight far north, La Ronge winter day, Asia/Calcutta defaults, nishita kaal width, Janmashtami nishita');
