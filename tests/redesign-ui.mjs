import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
const base='android/app/src/main/assets/';
const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(readFileSync(base+'index.html','utf8'),{runScripts:'dangerously',url:'https://soma.local',virtualConsole:vc});
const w=dom.window;
w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},createImageData:(x,y)=>({data:new Uint8ClampedArray(x*y*4)}),putImageData(){}});
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.scrollTo=()=>{};
for(const f of ['astronomy.js','core.js','natal.js','app.js']){const script=w.document.createElement('script');script.textContent=readFileSync(base+f,'utf8');w.document.body.appendChild(script);}
assert.equal(w.SomaPrototype.health().ready,true);
for(const view of ['today','calendar','moon','learn','personal']){w.show(view);assert.ok(w.document.querySelector('#app h1'));}
w.show('calendar');w.plan();w.document.querySelector('#eventTitle').value='<family & friends>';w.saveEvent({preventDefault(){}});assert.ok(w.document.querySelector('#app').textContent.includes('<family & friends>'));assert.equal(JSON.parse(w.localStorage.getItem('soma-redesign-v1')).events.length,1);assert.equal(w.document.querySelector('family'),null);
w.show('personal');w.editProfile();w.document.querySelector('#birthDate').value='1993-08-18';w.document.querySelector('#birthTime').value='10:45';w.saveProfile({preventDefault(){}});assert.ok(w.document.querySelector('.natal svg'));assert.ok(JSON.parse(w.localStorage.getItem('soma-redesign-v1')).profile.date);
w.settings();w.fillCity('3');w.saveLocation();assert.ok(w.document.querySelector('#location').textContent.includes('Regina'));assert.equal(JSON.parse(w.localStorage.getItem('soma-redesign-v1')).profile.zone,'Asia/Kolkata');
w.settings();w.document.querySelector('#zone').value='Not/AZone';w.saveLocation();assert.ok(w.document.querySelector('#modal').open);assert.ok(w.document.querySelector('#toast').textContent.includes('valid'));
assert.deepEqual(errors,[]);dom.window.close();console.log('PASS: five screens, escaped event creation/persistence, natal rendering, location independence and validation');
