import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const K=require('../src/redesign/core.js'),P=require('../src/redesign/panchang.js'),M=require('../src/redesign/meanings.js'),Fe=require('../src/redesign/festivals.js'),I=require('../src/redesign/i18n.js');
const amd={lat:23.0225,lon:72.5714,zone:'Asia/Kolkata'};
const hm=(d,z='Asia/Kolkata')=>{const p=K.parts(d,z);return p.hour+':'+p.minute};

// Saturday 14 Nov 2026, Ahmedabad: Labh Pancham (Kartik Shukla Panchami).
const d=P.day('2026-11-14',amd);
assert.equal(d.frame.weekday,6);assert.equal(d.sunriseLimbs.tithi.index,4);assert.equal(d.sunriseLimbs.month.index,7);
// Choghadiya order for a Saturday: day Kaal…Kaal, night Labh…Labh.
assert.deepEqual(d.choghadiya.filter(c=>!c.night).map(c=>c.key),['kaal','shubh','rog','udveg','char','labh','amrit','kaal']);
assert.deepEqual(d.choghadiya.filter(c=>c.night).map(c=>c.key),['labh','udveg','shubh','amrit','char','rog','kaal','labh']);
// Sunday and Monday day sequences.
for(const [day,first] of [['2026-11-15','udveg'],['2026-11-16','amrit'],['2026-11-17','rog'],['2026-11-18','labh'],['2026-11-19','shubh'],['2026-11-20','char']])assert.equal(P.day(day,amd).choghadiya[0].key,first);
// Rahu Kaal is the 3rd eighth of daytime on Saturday, Yamaganda the 6th, Gulika the 1st.
const eighth=(d.frame.sunset-d.frame.sunrise)/8;
assert.ok(Math.abs(d.periods.rahu.start-(+d.frame.sunrise+2*eighth))<1000);assert.ok(Math.abs(d.periods.gulika.start-d.frame.sunrise)<1000);assert.ok(Math.abs(d.periods.yamaganda.start-(+d.frame.sunrise+5*eighth))<1000);
// Hora starts with the weekday lord and follows the Chaldean order.
assert.deepEqual(d.hora.slice(0,8).map(h=>h.lord),['saturn','jupiter','mars','sun','venus','mercury','moon','saturn']);
// Limb end times are after sunrise and within about a day.
for(const k of ['nakshatra','yoga','karana'])assert.ok(d.sunriseLimbs[k].end>d.frame.sunrise&&d.sunriseLimbs[k].end-d.frame.sunrise<30*36e5,k);
// Good windows never touch Rahu Kaal, Yamaganda or Gulika.
for(const w of P.goodWindows(d,d.frame.sunrise))for(const k of ['rahu','yamaganda','gulika'])assert.ok(!P.overlaps(w,d.periods[k]),k);

// Festival dates for Ahmedabad, 2026 (as published in Drik-style panchangs).
const list=Fe.list('2026-01-01',364,amd),on=key=>list.filter(x=>x.key===key).map(x=>x.day);
const expect={sankranti:'2026-01-14',shivratri:'2026-02-15',dhuleti:'2026-03-04',ramnavami:'2026-03-26',rakhi:'2026-08-28',janmashtami:'2026-09-04',ganesh:'2026-09-14',navratri:'2026-10-11',dussehra:'2026-10-20',dhanteras:'2026-11-06',diwali:'2026-11-08',bestuvaras:'2026-11-10',bhaidooj:'2026-11-11',labhpancham:'2026-11-14'};
for(const [k,v] of Object.entries(expect))assert.deepEqual(on(k),[v],k+' '+on(k));
// 24 Ekadashis a year, each with a parana window after the next sunrise and before Dwadashi ends.
const ek=list.filter(x=>x.key==='ekadashi');assert.ok(ek.length>=24&&ek.length<=26,ek.length);
for(const e of ek){assert.equal(e.parana.day,K.addDay(e.day,1));assert.ok(e.parana.start<e.parana.end);if(e.parana.dwadashiEnd>e.parana.start)assert.ok(e.parana.end<=e.parana.dwadashiEnd);/* When Dwadashi ends before sunrise, parana is simply after sunrise. */}
assert.ok(ek.some(e=>e.en==='Prabodhini (Dev Uthi) Ekadashi'&&e.day==='2026-11-20'));
// Kshaya Ekadashi (20 Nov 2026 begins after sunrise): parana waits for the real Hari Vasara, which ends about 12:09 on 21 Nov.
{const e=ek.find(x=>x.day==='2026-11-20');assert.ok(hm(e.parana.start)>='12:00',hm(e.parana.start));}
// Sets and location defaults.
assert.deepEqual(Fe.defaultSets(amd),['gujarati','india','vrat']);assert.deepEqual(Fe.defaultSets({lat:43.65,lon:-79.38,zone:'America/Toronto'}),['india','international','vrat']);
assert.equal(Fe.defaultMonthSystem(amd),'amanta');assert.equal(Fe.defaultMonthSystem({lat:28.61,lon:77.2,zone:'Asia/Kolkata'}),'purnimanta');
assert.ok(Fe.visible(list,['gujarati']).every(x=>x.sets.indexOf('gujarati')>=0));
// Diaspora: dates follow the local sunrise, so Bestu Varas falls a day earlier in Toronto.
assert.deepEqual(Fe.list('2026-11-01',20,{lat:43.6532,lon:-79.3832,zone:'America/Toronto'}).filter(x=>x.key==='bestuvaras').map(x=>x.day),['2026-11-09']);
// Widget feed shape.
const feed=Fe.upcoming(amd,'2026-11-14',30);assert.ok(feed.length>3);for(const f of feed)assert.ok(/^\d{4}-\d\d-\d\d$/.test(f.date)&&f.n&&f.en&&typeof f.d==='string');

// Month names: purnimanta moves the Krishna paksha to the next month.
const names=I.make('en').monthNames;
assert.equal(P.monthName(new Date('2026-11-14T06:00Z'),'amanta',names),'Kartik');
assert.equal(P.monthName(new Date('2026-11-30T06:00Z'),'amanta',names),'Kartik');assert.equal(P.monthName(new Date('2026-11-30T06:00Z'),'purnimanta',names),'Margashirsha');
assert.equal(P.samvat(new Date('2026-11-09T02:00Z'),'gujarati'),2082);assert.equal(P.samvat(new Date('2026-11-11T02:00Z'),'gujarati'),2083);

// Chandrabalam / Tarabalam: same nakshatra = Janma tara, 1st from rashi.
const p=P.personal(P.moonSid(new Date('2026-11-14T06:00Z')),new Date('2026-11-14T06:00Z'));
assert.equal(p.chandraCount,1);assert.equal(p.tara.key,'janma');assert.equal(p.chandraGood,true);
const q=P.personal(K.mod(P.moonSid(new Date('2026-11-14T06:00Z'))-360/27),new Date('2026-11-14T06:00Z'));assert.equal(q.tara.key,'sampat');

// Meaning content is complete in all three languages.
for(let i=0;i<30;i++){const t=M.tithi(i);assert.ok(t.deity&&t.good&&t.avoid&&t.nature);for(const l of ['en','gu','hi'])assert.ok(I.make(l).tithiName(i));}
for(let i=0;i<27;i++){const n=M.nakshatra(i);assert.ok(n.deity&&n.good&&n.nature);for(const l of ['en','gu','hi'])assert.ok(I.make(l).nakName(i)&&I.make(l).yogaName(i));}
for(const l of ['en','gu','hi'])for(const k of Object.keys(I.STR.en))assert.ok(I.STR[l][k]!=null,l+' '+k);
console.log('PASS: choghadiya, hora, rahu/yama/gulika, limb end times, 14 festival dates, ekadashi parana, sets, diaspora dates, month systems, samvat, tarabalam, i18n coverage');
