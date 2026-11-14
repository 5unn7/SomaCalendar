// Time awareness: move the shared clock and check every screen follows it, in the chosen place's time zone, not the device's.
process.env.TZ = 'Asia/Tokyo'; // a device zone different from every place used below
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
const base='android/app/src/main/assets/';
const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(readFileSync(base+'index.html','utf8'),{runScripts:'dangerously',url:'https://soma.local',virtualConsole:vc});
const w=dom.window,doc=w.document,$=s=>doc.querySelector(s),txt=s=>($(s)||{}).textContent||'';
w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},createImageData:(x,y)=>({data:new Uint8ClampedArray(x*y*4)}),putImageData(){}});
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};w.scrollTo=()=>{};
const feeds=[],plans=[];w.SomaNative={updateWidgetFeed(j){feeds.push(JSON.parse(j))},scheduleReminders(j){plans.push(JSON.parse(j))},requestNotifications(){},appReady(){},appFailure(e){errors.push(e)},addCalendarEvent(){}};
const JAM={name:'Jamnagar',lat:22.4707,lon:70.0577,zone:'Asia/Kolkata'};
w.localStorage.setItem('soma-redesign-v1',JSON.stringify({loc:JAM,prefs:{onboarded:true,lang:'en',layout:'dial'}}));
// Start the app at a known instant: 14 Nov 2026, 10:00 in Jamnagar.
const load=f=>{const s=doc.createElement('script');s.textContent=readFileSync(base+f,'utf8');doc.body.appendChild(s);};
load('clock.js');w.SomaClock.set(new Date('2026-11-14T04:30:00Z'));
for(const f of ['astronomy.js','core.js','panchang.js','meanings.js','festivals.js','widget.js','i18n.js','natal.js','places.js','dial.js','app.js'])load(f);
const C=w.SomaClock,K=w.Kaal,P=w.Panchang;
const go=(d,why)=>{C.set(d);w.somaClockChanged(why||'clock');};
const step=ms=>{C.advance(ms);C.tick();};
const dateShown=()=>$('#app input[type=date]').value;
const fmt=d=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'numeric',minute:'2-digit'}).format(d);

// The clock module on its own: date keys follow the zone asked for, and set/advance move "now".
{assert.equal(C.dateKey('Asia/Kolkata',new Date('2026-11-14T19:00:00Z')),'2026-11-15');assert.equal(C.dateKey('America/Toronto',new Date('2026-11-14T19:00:00Z')),'2026-11-14');
 const a=C.ms();C.advance(5*6e4);assert.ok(Math.abs(C.ms()-a-3e5)<50);C.advance(-5*6e4);}

assert.equal(dateShown(),'2026-11-14','app opens on the place\'s date');
const f=P.frame('2026-11-14',JAM),fNext=P.frame('2026-11-15',JAM);

// Sunrise countdown ticks down minute by minute.
go(new Date(+f.sunrise-10*6e4));
assert.match(txt('.sunstrip .sunrise small'),/in 10 min/);
step(6e4);assert.match(txt('.sunstrip .sunrise small'),/in 9 min/,'countdown moves with the minute tick');

// The hour before sunrise is dawn, not night (the Vedic day in force is still yesterday's).
assert.equal($('.sky').dataset.sky,'dawn');
go(new Date(+f.sunrise-3*36e5));assert.equal($('.sky').dataset.sky,'night');
go(new Date(+f.sunrise+3*36e5));assert.equal($('.sky').dataset.sky,'day');

// The running Choghadiya on the dial and in its headline changes when a boundary passes.
{const day=P.choghadiya(f).filter(c=>!c.night);go(new Date(+day[2].end-30e3));
 const before=txt('.dialcore');assert.match(before,new RegExp('until '+fmt(day[2].end).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 step(6e4);const after=txt('.dialcore');assert.notEqual(after,before,'Choghadiya headline moves on at the boundary');assert.match(after,new RegExp('until '+fmt(day[3].end).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 // The dial hand is redrawn for the new minute.
 assert.ok($('.dial .dial-hand'));}

// Now and next: Rahu Kaal greys out once it has passed.
{const r=P.periods(f).rahu;go(new Date(+r.start-5*6e4));const row=()=>[...doc.querySelectorAll('.nn')].find(x=>/Rahu Kaal/.test(x.textContent));
 assert.match(row().textContent,/in 5 min/);assert.ok(!row().classList.contains('past'));
 go(new Date(+r.end+6e4));assert.ok(row().classList.contains('past'),'Rahu Kaal marked past after it ends');}

// After sunset the sunrise slot looks ahead to tomorrow's sunrise.
go(new Date(+f.sunset+30*6e4));assert.match($('.sunstrip .sunrise').getAttribute('aria-label'),/Sunrise tomorrow/,'after sunset the sunrise slot names tomorrow');assert.match(txt('.sunstrip .sunrise b'),new RegExp(fmt(fNext.sunrise)));

// A "More times" panel the reader opened stays open across the minute tick.
{const d=$('#app details');d.open=true;step(6e4);assert.ok($('#app details').open,'open details survive a repaint');}

// Midnight in the chosen place, with the device in another zone: Today rolls over at the place's midnight.
go(new Date('2026-11-14T18:29:30Z'));assert.equal(dateShown(),'2026-11-14');
step(6e4);assert.equal(dateShown(),'2026-11-15','rolls over at Jamnagar midnight');
await new Promise(r=>setTimeout(r,500));assert.ok(plans.length>0,'reminders re-planned');

// Another day the reader picked stays put across midnight; only "today" follows the clock.
w.setDay('2026-12-01');step(864e5);assert.equal(dateShown(),'2026-12-01');w.setDay(w.eval('todayKey()'));

// A Canadian place: the date and "today" follow Toronto, not India and not the device.
{w.setLoc({name:'Toronto',lat:43.7,lon:-79.42,zone:'America/Toronto'});go(new Date('2026-11-15T03:00:00Z'));
 assert.equal(dateShown(),'2026-11-14','10 pm in Toronto is still the 14th');
 go(new Date('2026-11-15T05:01:00Z'));assert.equal(dateShown(),'2026-11-15','Toronto midnight rolls Today over');
 w.setLoc(JAM);go(new Date('2026-11-15T06:30:00Z'));assert.equal(dateShown(),'2026-11-15');}

// Coming back from the background hours later repaints whatever screen is showing.
{w.show('calendar');const todayCell=()=>$('.calendar button.today').getAttribute('onclick');const was=todayCell();
 C.advance(864e5);w.somaClockChanged('resume');assert.notEqual(todayCell(),was,'calendar moves its Today ring on resume');}

// Muhurat: the running Choghadiya is highlighted for now, earlier ones are past; today drops out of the good-day list once its windows have gone.
{go(new Date('2026-11-16T06:30:00Z'));w.show('muhurat');const cur=()=>txt('.chog .timeline.current');const a=cur();assert.ok(a.length>0);
 assert.ok(doc.querySelectorAll('.chog .timeline.past').length>0);
 const g=P.choghadiya(P.frame('2026-11-16',JAM)).filter(c=>!c.night);const i=g.findIndex(c=>c.start<=C.now()&&C.now()<c.end);
 C.set(new Date(+g[i].end+6e4));C.tick();assert.notEqual(cur(),a,'current Choghadiya row follows the clock');
 for(const ev of ['griha','vehicle','business','travel']){const late=w.muhuratDays(ev,'2026-11-16',30),fs=P.frame('2026-11-16',JAM);
   C.set(new Date(+fs.nextSunrise-6e4));assert.ok(!w.muhuratDays(ev,'2026-11-16',30).some(x=>x.key==='2026-11-16'&&x.win.end<=C.now()),'no past window offered for today: '+ev);void late;}}

// Moon page: follows the clock on today, stops following once the reader scrubs, and starts again on a new visit.
{go(new Date('2026-11-16T08:00:00Z'));w.show('moon');assert.equal(txt('#scrubTime'),fmt(C.now()));assert.match(txt('#app label'),/Now/);
 step(2*36e5);assert.equal(txt('#scrubTime'),fmt(C.now()),'moon time moves with the clock');
 w.eval('hour=6;moonView()');step(6e4);assert.match(txt('#scrubTime'),/6:00/);assert.doesNotMatch(txt('#app label'),/Now/);
 w.show('today');w.show('moon');assert.equal(txt('#scrubTime'),fmt(C.now()));}

// An open sheet is never repainted under the reader; closing it catches up.
{w.show('today');go(new Date('2026-11-16T09:00:00Z'));w.plan();const before=$('#app').innerHTML;step(36e5);assert.equal($('#app').innerHTML,before,'no repaint while a sheet is open');
 $('#modal').close();assert.notEqual($('#app').innerHTML,before,'repaints when the sheet closes');}

// The widget feed is rebuilt for the new local day without opening Today.
{w.show('calendar');const n=feeds.length;go(new Date('2026-11-18T08:00:00Z'));await new Promise(r=>setTimeout(r,600));
 assert.ok(feeds.length>n,'widget feed pushed after the clock moved');assert.equal(feeds.at(-1).days.some(d=>d.date==='2026-11-18'),true);}

assert.deepEqual(errors,[]);dom.window.close();
console.log('PASS: shared clock, countdowns, sky phase at dawn, Choghadiya rollover, Rahu past, after-dark sunrise, open panels kept, place-zone midnight (India and Canada) with a foreign device zone, resume repaint, muhurat now and past, moon page live time, no repaint under sheets, widget feed on day change');
