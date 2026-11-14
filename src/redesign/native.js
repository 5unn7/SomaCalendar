/* window.SomaNative on Capacitor (Android and iOS).
 * app.js talks to the phone only through window.SomaNative. This file builds that object from Capacitor plugins
 * plus Soma's own small native plugin ("Soma": widget feed, add-to-calendar and preview self-updates), so app.js runs unchanged in a
 * browser, in the jsdom tests and in both apps. Bundled by scripts/build-redesign.mjs to an es2017 IIFE.
 * Nothing here talks to the network: Soma is offline.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const Soma = registerPlugin('Soma');
/* iOS keeps at most 64 pending local notifications per app; stay under it on both platforms. */
export const REMINDER_LIMIT = 60;

/* Reminder ids from app.js are strings ("eve-ekadashi-2026-11-20"); notification ids must be 32-bit integers. */
export function numericId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

/* Future, de-duplicated, soonest first, capped. */
export function reminderBatch(list, now = Date.now()) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .filter(r => r && r.id && Number.isFinite(r.at) && r.at > now && !seen.has(r.id) && seen.add(r.id))
    .sort((a, b) => a.at - b.at)
    .slice(0, REMINDER_LIMIT)
    .map(r => ({
      id: numericId(String(r.id)),
      title: String(r.title || 'Soma').slice(0, 120),
      body: String(r.body || '').slice(0, 300),
      schedule: { at: new Date(r.at), allowWhileIdle: true },
      channelId: 'soma_reminders',
      extra: { somaId: String(r.id) },
    }));
}

let channelReady = null;
function ensureChannel() {
  if (Capacitor.getPlatform() !== 'android') return Promise.resolve();
  if (!channelReady) channelReady = LocalNotifications.createChannel({
    id: 'soma_reminders', name: 'Vrat and muhurat reminders', description: 'Vrat, parana, daily panchang and Rahu Kaal',
    importance: 4, visibility: 1,
  }).catch(() => {});
  return channelReady;
}

let reminderQueue = Promise.resolve();
async function scheduleReminders(json) {
  let list = [];
  try { list = JSON.parse(json || '[]'); } catch (e) { return; }
  const batch = reminderBatch(list);
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') return;
  await ensureChannel();
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
  if (batch.length) await LocalNotifications.schedule({ notifications: batch });
}

async function requestLocation() {
  const reply = o => window.somaReceiveLocation && window.somaReceiveLocation(JSON.stringify(o));
  try {
    let perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') perm = await Geolocation.requestPermissions({ permissions: ['coarseLocation'] });
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') return reply({ error: 'Location permission denied. Manual city selection still works.' });
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
    reply({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, zone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  } catch (e) {
    reply({ error: /denied|permission/i.test(String(e && e.message)) ? 'Location permission denied. Manual city selection still works.' : 'No location fix received. Try again.' });
  }
}

function haptic(kind) {
  if (kind === 'success') return Haptics.notification({ type: NotificationType.Success });
  if (kind === 'warning') return Haptics.notification({ type: NotificationType.Warning });
  if (kind === 'select') return Haptics.selectionChanged();
  return Haptics.impact({ style: ImpactStyle.Light });
}

function log(level, message) { (level === 'error' ? console.error : console.log)('SomaJS ' + message); }
const quiet = p => { if (p && p.catch) p.catch(e => log('error', (e && e.message) || String(e))); };

/* app.js reads updateInfo() synchronously; Capacitor calls are async, so ask once at start-up and keep the answer.
 * Only Android preview (debug) builds have an update feed; iOS and store builds stay {enabled:false}. */
let updateInfoJson = '{"enabled":false}';
function loadUpdates(root) {
  if (Capacitor.getPlatform() !== 'android') return;
  quiet(Soma.updateInfo().then(r => { if (r && r.json) updateInfoJson = String(r.json); }));
  quiet(Soma.addListener('update', e => root.somaReceiveUpdate && root.somaReceiveUpdate(String((e && e.json) || '{}'))));
}

export function install(root) {
  if (!Capacitor.isNativePlatform() || root.SomaNative) return;
  loadUpdates(root);
  const api = {
    platform: Capacitor.getPlatform(),
    appReady() {
      log('info', 'Astronomical app initialized');
      try { log('info', 'Horizon health ' + JSON.stringify(root.SomaPrototype && root.SomaPrototype.health())); } catch (e) {}
    },
    appFailure(detail) { log('error', 'App initialization error: ' + detail); },
    requestLocation() { quiet(requestLocation()); },
    requestNotifications() { quiet(ensureChannel().then(() => LocalNotifications.requestPermissions())); },
    scheduleReminders(json) { reminderQueue = reminderQueue.then(() => scheduleReminders(json)).catch(e => log('error', 'reminders: ' + e.message)); },
    updateWidgetFeed(json) { quiet(Soma.setWidgetFeed({ json: String(json || '') })); },
    addCalendarEvent(title, start, end, place, notes) { quiet(Soma.addCalendarEvent({ title, start, end, place, notes })); },
    haptic(kind) { quiet(haptic(kind)); },
    updateInfo() { return updateInfoJson; },
    checkForUpdate() { quiet(Soma.checkForUpdate()); },
    installUpdate() { quiet(Soma.installUpdate()); },
    updateWidget() {}, updateAtmosphere() {},
  };
  Object.defineProperty(root, 'SomaNative', { value: Object.freeze(api), configurable: false, writable: false });
}

install(typeof window !== 'undefined' ? window : globalThis);
