import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),W=require('../src/redesign/widget.js');
const en=(w,i,night)=>W.CHOG[night?W.chogNightIndex(w,i):W.chogDayIndex(w,i)].en;
// Standard Choghadiya tables: first and last slot of each weekday's day and night.
assert.deepEqual([0,1,2,3,4,5,6].map(w=>en(w,0)),['Udveg','Amrit','Rog','Labh','Shubh','Char','Kaal']);
assert.deepEqual([0,1,2,3,4,5,6].map(w=>en(w,0,1)),['Shubh','Char','Kaal','Udveg','Amrit','Rog','Labh']);
assert.deepEqual([0,1,2,3,4,5,6,7].map(i=>en(6,i)),['Kaal','Shubh','Rog','Udveg','Char','Labh','Amrit','Kaal']);
assert.deepEqual([0,1,2,3,4,5,6,7].map(i=>en(6,i,1)),['Labh','Udveg','Shubh','Amrit','Char','Rog','Kaal','Labh']);
const jam={name:'Jamnagar',lat:22.4707,lon:70.0577,zone:'Asia/Kolkata'};
const f=W.build(jam,new Date('2026-11-14T03:00Z'),[{date:'2026-11-15',n:'લાભ પાંચમ',en:'Labh Pancham',d:'Open new account books.'}]);
const ist=x=>new Date(x).toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'});
const sat=f.days.find(d=>d.date==='2026-11-14');
assert.equal(sat.vaar,'શનિવાર');
// Saturday Rahu Kaal is the third eighth of daylight (about 09:47–11:10 in Jamnagar).
assert.equal(ist(sat.rahu[0]),'09:47');assert.equal(ist(sat.rahu[1]),'11:10');
// The week is covered without gaps, so the widget always has a value for "now".
for(const key of ['chog','tithi','nak'])for(let i=1;i<f[key].length;i++)assert.ok(Math.abs(f[key][i].s-f[key][i-1].e)<=2000,key+' gap at '+i);
assert.ok(f.chog[0].s<=Date.parse('2026-11-14T00:00Z')&&f.chog.at(-1).e>=Date.parse('2026-11-21T00:00Z'));
assert.ok(f.tithi.at(-1).e>=Date.parse('2026-11-21T18:00Z')&&f.nak.at(-1).e>=Date.parse('2026-11-21T18:00Z'));
// Prabodhini Ekadashi 2026 is a kshaya tithi at Jamnagar sunrise and is kept on 20 Nov; Kartik Purnima on 24 Nov.
// A festival module's list replaces the built-in vrats.
assert.equal(f.vrat.length,1);assert.equal(f.vrat[0].date,'2026-11-15');assert.equal(f.vrat[0].en,'Labh Pancham');
const own=W.build(jam,new Date('2026-11-14T03:00Z'));
assert.ok(own.vrat.some(v=>v.date==='2026-11-20'&&v.en==='Ekadashi fast'));
assert.ok(own.vrat.some(v=>v.date==='2026-11-24'&&v.en==='Purnima'));
assert.ok(JSON.stringify(f).length<60000);
// Polar night: no sunrise means no Choghadiya, but tithi and nakshatra still flow.
const polar=W.build({name:'Tromsø',lat:69.65,lon:18.96,zone:'Europe/Oslo'},new Date('2026-12-20T12:00Z'));
assert.equal(polar.chog.length,0);assert.ok(polar.tithi.length>5);
console.log('PASS: Choghadiya tables, Rahu Kaal, gapless week of intervals, vrat dates incl. kshaya Ekadashi, festival merge, polar night');
