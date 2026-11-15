import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
const base='android/app/src/main/assets/';
const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(readFileSync(base+'index.html','utf8'),{runScripts:'dangerously',url:'https://soma.local',virtualConsole:vc});
const w=dom.window;
w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},createImageData:(x,y)=>({data:new Uint8ClampedArray(x*y*4)}),putImageData(){}});
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.scrollTo=()=>{};
const feeds=[];w.SomaNative={updateWidgetFeed(j){feeds.push(JSON.parse(j))},scheduleReminders(){},requestNotifications(){},appReady(){},appFailure(){},addCalendarEvent(){}};
for(const f of ['astronomy.js','clock.js','core.js','panchang.js','meanings.js','festivals.js','widget.js','i18n.js','natal.js','places.js','dial.js','weather.js','app.js']){const script=w.document.createElement('script');script.textContent=readFileSync(base+f,'utf8');w.document.body.appendChild(script);}
assert.equal(w.SomaPrototype.health().ready,true);
// First launch: guided setup asks for language, then a place by name (never coordinates), then optional birth details.
assert.ok(w.document.querySelector('#onboard').classList.contains('open'));
w.onboard(2);w.placeSearch('jamn','loc');assert.ok(w.document.querySelector('#locResults').textContent.includes('Jamnagar'));w.pickPlace(0,'loc');
assert.ok(w.document.querySelector('#onboard .months'),'the calendar step (month system, festivals) follows the place step');w.onboard(4);assert.ok(w.document.querySelector('#onboard #birthDate'),'birth step follows the calendar step');w.finishOnboard('today');assert.ok(!w.document.querySelector('#onboard').classList.contains('open'));
assert.ok(w.document.querySelector('#app .dial'),'Today shows the Kaal Chakra dial');
for(const lay of ['sky','folio','dial']){w.setLayout(lay);assert.ok(w.document.querySelector('#app h1'),lay+' layout renders');{const g=[...w.document.querySelectorAll('#app .sunstrip [role=group]')].map(e=>e.getAttribute('aria-label')).join('|');assert.ok(/Sunrise.*\d.*\|Sunset.*\d/.test(g),lay+' shows sunrise and sunset: '+g);assert.ok(w.document.querySelector('#app .sunstrip svg'),'sun times use icons');}assert.ok(!/\d{4}-\d{2}-\d{2}/.test(w.document.querySelector('.datepick span').textContent),'date bar shows a readable date');}
{w.setLayout('sky');const hero=w.document.querySelector('.skyhero'),h1=hero.querySelector('h1').textContent;assert.equal(hero.textContent.split(h1).length-1,1,'sky headline is not repeated');w.setLayout('dial');}

// Midnight rollover: when the clock crosses into a new local day, Today follows it.
{w.show('today');const today=w.document.querySelector('#app input[type=date]').value;w.SomaClock.advance(864e5);w.SomaClock.tick();const next=w.Kaal.addDay(today,1);assert.equal(w.document.querySelector('#app input[type=date]').value,next);w.SomaClock.reset();w.SomaClock.tick();}
for(const view of ['today','calendar','muhurat','moon','learn','personal']){w.show(view);assert.ok(w.document.querySelector('#app h1'));}
w.show('calendar');w.plan();w.document.querySelector('#eventTitle').value='<family & friends>';w.saveEvent({preventDefault(){}});assert.ok(w.document.querySelector('#app').textContent.includes('<family & friends>'));assert.equal(JSON.parse(w.localStorage.getItem('soma-redesign-v1')).events.length,1);assert.equal(w.document.querySelector('family'),null);
w.show('personal');w.editProfile();w.document.querySelector('#birthDate').value='1993-08-18';w.document.querySelector('#birthTime').value='10:45';
// No birthplace picked: the chart is not made from wherever the phone is now; the form asks for the place instead.
assert.equal(w.document.querySelector('#birthTime').defaultValue,'','birth time starts empty, never a made-up 12:00');
w.saveProfile({preventDefault(){}});assert.ok(/birthplace/i.test(w.document.querySelector('#birthErr').textContent),'missing birthplace is named');assert.ok(!JSON.parse(w.localStorage.getItem('soma-redesign-v1')).profile.date,'nothing saved without a birthplace');
w.placeSearch('Rajkot','birth');w.pickPlace(0,'birth');w.birthPreview();assert.ok(/Born .*1993.*Rajkot \(IST\)/.test(w.document.querySelector('#birthConfirm').textContent),'details are read back: '+w.document.querySelector('#birthConfirm').textContent);
w.saveProfile({preventDefault(){}});assert.ok(w.document.querySelector('.natal svg'));assert.equal(JSON.parse(w.localStorage.getItem('soma-redesign-v1')).profile.zone,'Asia/Kolkata');assert.ok(JSON.parse(w.localStorage.getItem('soma-redesign-v1')).profile.date);
// Unknown birth time: rashi and nakshatra stay, the lagna-based kundali is not drawn.
{const keep=w.localStorage.getItem('soma-redesign-v1');w.editProfile();w.document.querySelector('#birthDate').value='1990-01-01';w.document.querySelector('#birthUnknown').checked=true;w.saveProfile({preventDefault(){}});assert.equal(w.document.querySelector('.natal svg'),null);assert.ok(w.document.querySelector('#app').textContent.includes('lagna'));w.editProfile();w.document.querySelector('#birthDate').value='1993-08-18';w.document.querySelector('#birthUnknown').checked=false;w.document.querySelector('#birthTime').disabled=false;w.document.querySelector('#birthTime').value='10:45';w.saveProfile({preventDefault(){}});assert.ok(w.document.querySelector('.natal svg'));void keep;}
// Small towns are in the offline list, and switching place keeps Today on today in the new time zone.
{w.settings();w.placeSearch('La Ronge','loc');assert.ok(w.document.querySelector('#locResults').textContent.includes('Saskatchewan'));w.pickPlace(0,'loc');w.show('today');assert.equal(w.document.querySelector('#app input[type=date]').value,w.Kaal.dateKey(new w.Date(),'America/Regina'));assert.ok(!w.document.querySelector('.datebar .now'),'no Today button on today');}
w.settings();w.placeSearch('Regina','loc');w.pickPlace(0,'loc');assert.ok(w.document.querySelector('#location').textContent.includes('Regina'));assert.equal(JSON.parse(w.localStorage.getItem('soma-redesign-v1')).profile.zone,'Asia/Kolkata');
w.settings();w.document.querySelector('#zone').value='Not/AZone';w.saveLocation();assert.ok(w.document.querySelector('#modal').open);assert.ok(w.document.querySelector('#toast').textContent.includes('valid'));
// Believer-facing content: verdict, Rahu Kaal, choghadiya and festivals render; no in-flow disclaimers remain.
w.show('today');{const txt=w.document.querySelector('#app').textContent;assert.ok(/Rahu Kaal/.test(txt));assert.ok(/Coming up/.test(txt));assert.ok(!/not (a )?scientific|NOT SCIENCE|not validated/i.test(txt));}
w.show('muhurat');assert.equal(w.document.querySelectorAll('.chog .timeline').length,16);
// Festival filters and language switch persist.
w.show('calendar');{const had=w.eval("prefs.sets.includes('gujarati')");w.toggleSet('gujarati');assert.equal(JSON.parse(w.localStorage.getItem('soma-redesign-v1')).prefs.sets.includes('gujarati'),!had);}
w.settings();w.document.querySelector('#langPick').value='gu';w.document.querySelector('#monthPick').value='purnimanta';w.savePrefs();assert.ok(w.document.querySelector('#nav').textContent.includes('આજ'));assert.equal(w.document.documentElement.lang,'gu');assert.equal(JSON.parse(w.localStorage.getItem('soma-redesign-v1')).prefs.month,'purnimanta');
// Reminders: the plan handed to Android is a list of future alarms with titles.
{const plan=w.reminderPlan();assert.ok(plan.length>0);assert.ok(plan.every(r=>r.at>Date.now()&&r.title&&r.id));}
// Planning an event shows a muhurat check for the chosen time.
w.show('today');w.plan();assert.ok(w.document.querySelector('#timingCheck').textContent.length>10);
// A time before sunrise is checked against the previous Vedic day, so it gets a real Choghadiya.
w.document.querySelector('#eventTime').value='03:00';w.timingCheck();assert.ok(!/Choghadiya: —|ચોઘડિયું: —/.test(w.document.querySelector('#timingCheck').textContent));w.document.querySelector('#modal').close();
// The widget feed follows the chosen place and carries the festival list.
await new Promise(r=>setTimeout(r,600));assert.ok(feeds.length>=1&&feeds.at(-1).city==='Regina'&&feeds.at(-1).chog.length>50&&feeds.at(-1).vrat.length>0,'widget feed pushed for the chosen place');
// Preview updates: off unless the native shell says so; when on, You lists Updates, a newer build shows a gentle note, and Install hands off to native.
{w.setLang('en');w.show('personal');w.setYouTab('settings');assert.ok(!/Updates/.test(w.document.querySelector('#app').textContent),'no update row without the native updater');
let checks=0,installs=0;Object.assign(w.SomaNative,{updateInfo:()=>JSON.stringify({enabled:true,versionCode:1040,versionName:'0.8.0-b40'}),checkForUpdate(){checks++},installUpdate(){installs++}});
w.show('personal');assert.ok(/Updates/.test(w.document.querySelector('#app').textContent));
w.autoCheckUpdate();assert.equal(checks,1);w.somaReceiveUpdate(JSON.stringify({state:'available',versionCode:1042,versionName:'0.8.0-b42',notes:'Fix <b>widget</b>'}));
const note=w.document.querySelector('#updateNote');assert.ok(note&&note.style.display==='flex'&&/0\.8\.0-b42/.test(note.textContent));
w.updateSheet();assert.ok(/Fix <b>widget<\/b>/.test(w.document.querySelector('#updateBody').textContent));assert.equal(w.document.querySelector('#updateBody b'),null);
w.installUpdate();assert.equal(installs,1);w.somaReceiveUpdate(JSON.stringify({state:'downloading',progress:40}));assert.ok(/40%/.test(w.document.querySelector('#updateBody').textContent));
w.somaReceiveUpdate(JSON.stringify({state:'latest',versionCode:1040,versionName:'0.8.0-b40'}));assert.ok(/newest build/.test(w.document.querySelector('#updateBody').textContent));w.document.querySelector('#modal').close();
// The banner appears by itself for a newer build; one tap on it installs, it shows progress, and ✕ only hides that build for a while.
w.somaReceiveUpdate(JSON.stringify({state:'available',versionCode:1043,versionName:'0.8.0-b43'}));assert.equal(note.style.display,'flex');assert.ok(/b43/.test(note.textContent));
note.querySelector('.body').click();assert.equal(installs,2,'tapping the banner installs');
w.somaReceiveUpdate(JSON.stringify({state:'downloading',progress:10}));assert.ok(/10%/.test(note.textContent));assert.equal(note.querySelector('.go'),null);
w.somaReceiveUpdate(JSON.stringify({state:'error',message:'Network down'}));assert.equal(note.style.display,'flex');assert.ok(note.querySelector('.go'),'after an error the banner offers Update again');assert.ok(/Network down/.test(note.textContent),'an install started from the banner keeps its error');
note.querySelector('.x').click();assert.equal(note.style.display,'none');
w.somaReceiveUpdate(JSON.stringify({state:'available',versionCode:1043,versionName:'0.8.0-b43'}));assert.equal(note.style.display,'none','snoozed build stays hidden');
w.somaReceiveUpdate(JSON.stringify({state:'available',versionCode:1044,versionName:'0.8.0-b44'}));assert.equal(note.style.display,'flex','a newer build shows again');
assert.equal(JSON.parse(w.localStorage.getItem('soma-redesign-v1')).prefs.updateFeed.versionCode,1044,'last answer kept for the next launch');
w.show('personal');assert.ok(w.document.querySelector('#app .newdot'),'Updates row is marked New');
// A return to the app looks again (not once per 12 hours).
{const c=checks;w.somaReceiveUpdate(JSON.stringify({state:'latest',versionCode:1040,versionName:'0.8.0-b40'}));const RealNow=w.Date.now;w.Date.now=()=>RealNow()+120000;w.somaClockChanged('resume');w.Date.now=RealNow;assert.equal(checks,c+1,'resume triggers a check');}
w.somaReceiveUpdate(JSON.stringify({state:'latest',versionCode:1040,versionName:'0.8.0-b40'}));}
assert.deepEqual(errors,[]);dom.window.close();console.log('PASS: six screens, verdict and festivals without disclaimers, choghadiya, filters, language, reminders, muhurat check, escaped event creation/persistence, natal rendering, location independence and validation, midnight rollover, preview updates');
