import assert from 'node:assert/strict';
import { reminderBatch, numericId, REMINDER_LIMIT } from '../src/redesign/native.js';
// Off-device the adapter installs nothing, so app.js keeps its browser fallbacks.
assert.equal(globalThis.SomaNative, undefined);
const now = 1_800_000_000_000;
const list = [{ id: 'past', at: now - 1, title: 'x' }, { id: 'dup', at: now + 5e3, title: 'a' }, { id: 'dup', at: now + 6e3, title: 'b' }, { id: '', at: now + 9e3 }];
for (let i = 0; i < 100; i++) list.push({ id: 'd' + i, at: now + (200 - i) * 6e4, title: 't', body: 'b' });
const batch = reminderBatch(list, now);
assert.equal(batch.length, REMINDER_LIMIT);
assert.ok(REMINDER_LIMIT < 64, 'iOS keeps at most 64 pending notifications');
assert.equal(batch[0].extra.somaId, 'dup');
assert.equal(batch.filter(n => n.extra.somaId === 'dup').length, 1);
assert.ok(!batch.some(n => n.extra.somaId === 'past'));
assert.deepEqual(batch.map(n => +n.schedule.at), batch.map(n => +n.schedule.at).sort((a, b) => a - b));
assert.ok(batch.every(n => Number.isInteger(n.id) && n.id > 0 && n.id <= 2 ** 31 && n.channelId === 'soma_reminders'));
assert.equal(new Set(batch.map(n => n.id)).size, batch.length, 'numeric ids stay unique');
assert.equal(numericId('eve-ekadashi-2026-11-20'), numericId('eve-ekadashi-2026-11-20'));
assert.deepEqual(reminderBatch('nope', now), []);
console.log('PASS: native adapter reminder batching (future, unique, soonest 60, integer ids)');
