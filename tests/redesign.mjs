import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),K=require('../src/redesign/core.js'),A=require('astronomy-engine');
for(const [day,zone,hours] of [['2026-03-08','America/Toronto',23],['2026-11-01','America/Toronto',25],['2026-11-07','Asia/Kolkata',24]]){assert.equal((K.instant(K.addDay(day,1),'00:00',zone)-K.instant(day,'00:00',zone))/36e5,hours)}
for(const zone of ['Asia/Kolkata','America/Regina','Asia/Kathmandu']){const d=K.instant('2026-11-07','12:30',zone);const p=K.parts(d,zone);assert.equal(p.hour+':'+p.minute,'12:30')}
// Published NASA eclipse new/full phase instants, with generous five-minute tolerance.
assert.ok(Math.abs(A.SearchMoonPhase(0,new Date('2024-04-08T00:00Z'),2).date-new Date('2024-04-08T18:21Z'))<5*60000);
assert.ok(Math.abs(A.SearchMoonPhase(180,new Date('2024-03-25T00:00Z'),2).date-new Date('2024-03-25T07:00Z'))<5*60000);
for(let m=0;m<12;m++)for(let d=1;d<=28;d+=3){const date=new Date(Date.UTC(2026,m,d,12)),t=K.tithi(date);assert.ok(t.start<=date&&t.end>date);assert.equal(K.tithi(new Date(+t.end+2000)).index,(t.index+1)%30);assert.ok(t.end-t.start>15*36e5&&t.end-t.start<30*36e5)}
const india={lat:22.4707,lon:70.0577,zone:'Asia/Kolkata'},regina={lat:50.4452,lon:-104.6189,zone:'America/Regina'};
assert.ok(K.dayData('2026-11-07',india).sunrise);assert.ok(K.dayData('2026-11-07',regina).sunrise);
assert.equal(K.dayData('2026-06-21',{lat:80,lon:20,zone:'Europe/Oslo'}).sunrise,null);
assert.equal(K.reduce('1994-03-14'),4);assert.equal(K.reduce('14'),5);
assert.equal(K.month(new Date('2026-11-10T12:00Z')),'કારતક');
console.log('PASS: phase fixtures, 120 tithi boundaries, DST days, fractional zones, polar handling, Gujarati month and numerology');
