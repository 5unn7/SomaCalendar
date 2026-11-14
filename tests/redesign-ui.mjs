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
for(const f of ['astronomy.js','core.js','panchang.js','meanings.js','festivals.js','widget.js','i18n.js','natal.js','app.js']){const script=w.document.createElement('script');script.textContent=readFileSync(base+f,'utf8');w.document.body.appendChild(script);}
assert.equal(w.SomaPrototype.health().ready,true);
// Midnight rollover: when the clock crosses into a new local day, Today follows it.
{const RealDate=w.Date,shift=864e5;w.show('today');const today=w.document.querySelector('#app input[type=date]').value;w.Date=class extends RealDate{constructor(...a){a.length?super(...a):super(RealDate.now()+shift)}static now(){return RealDate.now()+shift}};w.tick();const next=w.Kaal.addDay(today,1);assert.equal(w.document.querySelector('#app input[type=date]').value,next);w.Date=RealDate;w.tick();}
for(const view of ['today','calendar','muhurat','moon','learn','personal']){w.show(view);assert.ok(w.document.querySelector('#app h1'));}
w.show('calendar');w.plan();w.document.querySelector('#eventTitle').value='<family & friends>';w.saveEvent({preventDefault(){}});assert.ok(w.document.querySelector('#app').textContent.includes('<family & friends>'));assert.equal(JSON.parse(w.localStorage.getItem('soma-redesign-v1')).events.length,1);assert.equal(w.document.querySelector('family'),null);
w.show('personal');w.editProfile();w.document.querySelector('#birthDate').value='1993-08-18';w.document.querySelector('#birthTime').value='10:45';w.saveProfile({preventDefault(){}});assert.ok(w.document.querySelector('.natal svg'));assert.ok(JSON.parse(w.localStorage.getItem('soma-redesign-v1')).profile.date);
w.settings();w.fillCity('3');w.saveLocation();assert.ok(w.document.querySelector('#location').textContent.includes('Regina'));assert.equal(JSON.parse(w.localStorage.getItem('soma-redesign-v1')).profile.zone,'Asia/Kolkata');
w.settings();w.document.querySelector('#zone').value='Not/AZone';w.saveLocation();assert.ok(w.document.querySelector('#modal').open);assert.ok(w.document.querySelector('#toast').textContent.includes('valid'));
// Believer-facing content: verdict, Rahu Kaal, choghadiya and festivals render; no in-flow disclaimers remain.
w.show('today');{const txt=w.document.querySelector('#app').textContent;assert.ok(/Rahu Kaal/.test(txt));assert.ok(/Coming up/.test(txt));assert.ok(!/not (a )?scientific|NOT SCIENCE|not validated/i.test(txt));}
w.show('muhurat');assert.equal(w.document.querySelectorAll('.chog .timeline').length,16);
// Festival filters and language switch persist.
w.show('calendar');{const had=w.eval("prefs.sets.includes('gujarati')");w.toggleSet('gujarati');assert.equal(JSON.parse(w.localStorage.getItem('soma-redesign-v1')).prefs.sets.includes('gujarati'),!had);}
w.settings();w.document.querySelector('#langPick').value='gu';w.document.querySelector('#monthPick').value='purnimanta';w.savePrefs();assert.ok(w.document.querySelector('#nav').textContent.includes('આજ'));assert.equal(JSON.parse(w.localStorage.getItem('soma-redesign-v1')).prefs.month,'purnimanta');
// Reminders: the plan handed to Android is a list of future alarms with titles.
{const plan=w.reminderPlan();assert.ok(plan.length>0);assert.ok(plan.every(r=>r.at>Date.now()&&r.title&&r.id));}
// Planning an event shows a muhurat check for the chosen time.
w.show('today');w.plan();assert.ok(w.document.querySelector('#timingCheck').textContent.length>10);
// A time before sunrise is checked against the previous Vedic day, so it gets a real Choghadiya.
w.document.querySelector('#eventTime').value='03:00';w.timingCheck();assert.ok(!/Choghadiya: —|ચોઘડિયું: —/.test(w.document.querySelector('#timingCheck').textContent));w.document.querySelector('#modal').close();
// The widget feed follows the chosen place and carries the festival list.
await new Promise(r=>setTimeout(r,600));assert.ok(feeds.length>=1&&feeds.at(-1).city==='Regina'&&feeds.at(-1).chog.length>50&&feeds.at(-1).vrat.length>0,'widget feed pushed for the chosen place');
assert.deepEqual(errors,[]);dom.window.close();console.log('PASS: six screens, verdict and festivals without disclaimers, choghadiya, filters, language, reminders, muhurat check, escaped event creation/persistence, natal rendering, location independence and validation, midnight rollover');
