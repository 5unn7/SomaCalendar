"use strict";
/* Soma 0.8 · Kaal Chakra. A daily panchang in the believer's own voice: the day as a dial, what today is,
   when the good times are, which vrat is next. Works offline; nothing leaves the phone. */
const $ = id => document.getElementById(id), K = Kaal, A = Astronomy, P = Panchang, M = Meanings, Fe = Festivals, Clock = SomaClock;
/* Every "now" in the app comes from the shared clock (clock.js), so tests can move it and every screen agrees. */
const now = () => Clock.now();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const DEFAULT_LOC = { name: 'Jamnagar', lat: 22.4707, lon: 70.0577, zone: 'Asia/Kolkata' };
const STORE = 'soma-redesign-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) {}
let loc = saved.loc || DEFAULT_LOC, profile = saved.profile || {}, events = saved.events || [];
let prefs = Object.assign({ lang: 'en', theme: 'auto', layout: 'dial', month: null, sets: null, custom: false, reminders: { vrat: true, parana: true, daily: false, rahu: false } }, saved.prefs || {});
// People who already set a place before the guided setup existed skip it.
if (saved.loc && prefs.onboarded == null) prefs.onboarded = true;
// hour: the Moon page's scrubbed time of day; null means "follow the clock" on today and noon on other days.
let view = 'today', day = K.dateKey(now(), loc.zone), lastToday = day, monthView = day.slice(0, 7), hour = null, practice = null, muhuratEvent = 'griha', muhuratTab = 'find', mHits = [];
let L = I18n.make(prefs.lang);
const t = (k, v) => L.t(k, v);
function applyLocationDefaults() {
  if (!prefs.custom || !prefs.sets) {
    prefs.sets = Fe.defaultSets(loc);
    // A Gujarati reader keeps the Gujarati festivals wherever they live (Mumbai, Kolkata, abroad).
    if (prefs.lang === 'gu' && prefs.sets.indexOf('gujarati') < 0) prefs.sets.unshift('gujarati');
  }
  if ((!prefs.custom && !prefs.monthChosen) || !prefs.month) prefs.month = Fe.defaultMonthSystem(loc);
}
applyLocationDefaults();
window.SomaFestivalSets = prefs.sets;

function persist() {
  window.SomaFestivalSets = prefs.sets;
  try { localStorage.setItem(STORE, JSON.stringify({ loc, profile, events, prefs })); return true; }
  catch (e) { toast(t('errStorage')); return false; }
}
let toastTimer = 0;
let toastAct = null;
function toast(s, action, fn) {
  const el = $('toast'); el.textContent = ''; el.appendChild(document.createTextNode(s));
  toastAct = fn || null;
  if (action && fn) { const b = document.createElement('button'); b.textContent = action; b.onclick = () => { el.style.display = 'none'; const f = toastAct; toastAct = null; if (f) f(); }; el.appendChild(b); }
  el.style.display = 'flex'; clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.style.display = 'none'), action ? 6000 : 4000);
}
function haptic(kind) { try { if (window.SomaNative && SomaNative.haptic) SomaNative.haptic(kind || 'select'); } catch (e) {} }
/* Dates and times speak the reader's language: "3:09 pm", "3:09 બપોરે", "दोपहर 3:09". Digits stay 0-9 unless the reader
   turns on Gujarati or Devanagari digits (You > Appearance). Formatters are cached: the dial and lists format hundreds of times. */
const locale = () => (L.lang === 'gu' ? 'gu-IN' : L.lang === 'hi' ? 'hi-IN' : 'en-IN') + '-u-nu-' + (prefs.digits === 'native' && L.lang !== 'en' ? (L.lang === 'gu' ? 'gujr' : 'deva') : 'latn');
const fmtCache = new Map();
function fmtIn(d, zone, opts) {
  if (!d) return '—';
  const key = locale() + '|' + zone + '|' + JSON.stringify(opts || {});
  let f = fmtCache.get(key);
  if (!f) { f = new Intl.DateTimeFormat(locale(), Object.assign({ timeZone: zone, hour: 'numeric', minute: '2-digit' }, L.lang === 'en' ? {} : { dayPeriod: 'short' }, opts || {})); if (fmtCache.size > 200) fmtCache.clear(); fmtCache.set(key, f); }
  return f.format(d);
}
const fmt = (d, opts) => fmtIn(d, loc.zone, opts);
const num = n => L.lang === 'en' || prefs.digits !== 'native' ? String(n) : new Intl.NumberFormat(locale(), { useGrouping: false }).format(n);
const until = d => t('untilT', { time: fmt(d) });
const span = p => p ? fmt(p.start) + ' – ' + fmt(p.end) : '—';
const full = d => fmt(d, { day: 'numeric', month: 'short' });
const tr = x => L.tr(x);
const dayLabel = (key, opts) => new Intl.DateTimeFormat(locale(), Object.assign({ timeZone: loc.zone, weekday: 'short', day: 'numeric', month: 'short' }, opts || {})).format(K.instant(key, '12:00', loc.zone));
const titleDay = d => new Intl.DateTimeFormat(locale(), { timeZone: loc.zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(K.instant(d, '12:00', loc.zone));
const todayKey = () => K.dateKey(now(), loc.zone);
const isToday = () => day === todayKey();
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00Z') - Date.parse(a + 'T12:00Z')) / 864e5);
/* Status never rides on colour alone: words on badges, and dots carry a shape (circle shubh, ring neutral, diamond avoid). */
const badge = n => `<span class="nature ${n}">${esc(L.nature(n))}</span>`;
const hourOf = d => { const p = K.parts(d, loc.zone); return +p.hour + p.minute / 60 + p.second / 3600; };
const methodChip = () => `<button class="chip method" onclick="settings()">${esc(t('methodBase'))} · ${esc(t(prefs.month === 'purnimanta' ? 'purnimantaShort' : 'amantaShort'))} · ${esc(placeName(loc.name))}</button>`;
const emph = s => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
/* "in 35 min", "in 2 h 5 min" or "ends in 12 min" for a period, relative to now. Empty when it is over or the day is not today. */
function rel(p, now) {
  if (!p || !now) return '';
  const mins = ms => Math.max(1, Math.round(ms / 6e4));
  if (now < p.start) { const m = mins(p.start - now); return m < 60 ? t('inMin', { n: m }) : t('inHr', { h: Math.floor(m / 60), m: m % 60 }); }
  if (now < p.end) return t('endsIn', { n: mins(p.end - now) });
  return '';
}
const ICON = {
  cloud: '<path d="M7 18.5a4 4 0 0 1-.6-7.95A6 6 0 0 1 17.6 9.4a4.6 4.6 0 0 1 .4 9.1z"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v3.5h3.5M4 13a8 8 0 0 0 14.6 4.5M20 20v-3.5h-3.5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  muhurat: '<path d="M12 3.2l2.3 5.4 5.8.6-4.4 3.9 1.3 5.7L12 15.9l-5 2.9 1.3-5.7-4.4-3.9 5.8-.6z"/>',
  moon: '<path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z"/>',
  personal: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c1.4-3.8 4.2-5.6 7.5-5.6s6.1 1.8 7.5 5.6"/>',
  sunrise: '<path d="M3 19h18M6.5 19a5.5 5.5 0 0 1 11 0M12 3.5v6M9.2 6.3 12 3.5l2.8 2.8M4.6 12.6l1.5 1.5M19.4 12.6l-1.5 1.5"/>',
  sunset: '<path d="M3 19h18M6.5 19a5.5 5.5 0 0 1 11 0M12 3.5v6M9.2 6.7 12 9.5l2.8-2.8M4.6 12.6l1.5 1.5M19.4 12.6l-1.5 1.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/><circle cx="12" cy="12" r="6.2"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  home: '<path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5"/>',
  car: '<path d="M4 16v-3.5L6 7.5h12l2 5V16M4 16h16v2.5h-3V16M4 16v2.5h3V16"/><circle cx="7.5" cy="13" r=".8"/><circle cx="16.5" cy="13" r=".8"/>',
  shop: '<path d="M4 9l1.5-5h13L20 9M4 9h16v1.5a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0 2.7 2.7 0 0 1-5.3 0zM5.5 12.5V20h13v-7.5M10 20v-4h4v4"/>',
  plane: '<path d="M10.5 13.5L3 11l1.5-1.5 8 .5 4.5-4.5a1.8 1.8 0 0 1 2.5 2.5L15 12.5l.5 8L14 22l-2.5-7.5-3 3V20l-1.5 1-1-3-3-1 1-1.5h2.5z"/>',
  sparkle: '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/>'
};
// City names people read in their own script. Unknown places keep the name they were saved with.
const CITY = {
  Jamnagar: ['જામનગર', 'जामनगर'], Ahmedabad: ['અમદાવાદ', 'अहमदाबाद'], Surat: ['સુરત', 'सूरत'], Vadodara: ['વડોદરા', 'वडोदरा'], Rajkot: ['રાજકોટ', 'राजकोट'],
  Bhavnagar: ['ભાવનગર', 'भावनगर'], Junagadh: ['જૂનાગઢ', 'जूनागढ़'], Gandhinagar: ['ગાંધીનગર', 'गांधीनगर'], Anand: ['આણંદ', 'आणंद'], Bhuj: ['ભુજ', 'भुज'],
  Dwarka: ['દ્વારકા', 'द्वारका'], Porbandar: ['પોરબંદર', 'पोरबंदर'], Morbi: ['મોરબી', 'मोरबी'], Navsari: ['નવસારી', 'नवसारी'], Valsad: ['વલસાડ', 'वलसाड'],
  Mumbai: ['મુંબઈ', 'मुंबई'], Delhi: ['દિલ્હી', 'दिल्ली'], 'New Delhi': ['નવી દિલ્હી', 'नई दिल्ली'], Kolkata: ['કોલકાતા', 'कोलकाता'], Chennai: ['ચેન્નઈ', 'चेन्नई'],
  Bengaluru: ['બેંગલુરુ', 'बेंगलुरु'], Bangalore: ['બેંગલુરુ', 'बेंगलुरु'], Hyderabad: ['હૈદરાબાદ', 'हैदराबाद'], Pune: ['પુણે', 'पुणे'], Jaipur: ['જયપુર', 'जयपुर'],
  Varanasi: ['વારાણસી', 'वाराणसी'], Ujjain: ['ઉજ્જૈન', 'उज्जैन'], Indore: ['ઇન્દોર', 'इंदौर'], Lucknow: ['લખનઉ', 'लखनऊ'], Nagpur: ['નાગપુર', 'नागपुर'],
  London: ['લંડન', 'लंदन'], 'New York': ['ન્યૂ યોર્ક', 'न्यूयॉर्क'], Toronto: ['ટોરન્ટો', 'टोरंटो'], Dubai: ['દુબઈ', 'दुबई'], Nairobi: ['નૈરોબી', 'नैरोबी'],
  Sydney: ['સિડની', 'सिडनी'], Singapore: ['સિંગાપોર', 'सिंगापुर'], Leicester: ['લેસ્ટર', 'लेस्टर'], Edison: ['એડિસન', 'एडिसन'], Chicago: ['શિકાગો', 'शिकागो']
};
const placeName = n => {
  const name = String(n || '');
  if (L.lang === 'en') return name;
  const head = name.split(',')[0].trim(), hit = CITY[head];
  return hit ? hit[L.lang === 'gu' ? 0 : 1] : name;
};
const icon = (k, cls) => `<svg viewBox="0 0 24 24" class="${cls || ''}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

// ---- Cached calculations ----------------------------------------------------------------------
const memo = new Map();
function cached(key, fn) { if (!memo.has(key)) { if (memo.size > 400) memo.clear(); memo.set(key, fn()); } return memo.get(key); }
const locKey = () => [loc.lat, loc.lon, loc.zone].join(',');
const vedicDay = key => cached('day|' + key + '|' + locKey(), () => P.day(key, loc));
/* Gujarati (Kartikadi) Vikram Samvat for anyone keeping the Gujarati calendar or reading in Gujarati; Chaitradi otherwise. */
const samvatSystem = () => prefs.sets.indexOf('gujarati') >= 0 || L.lang === 'gu' ? 'gujarati' : 'north';
/* The same observance's date in India (Ahmedabad), shown on festival cards abroad when it falls on another day. */
const INDIA_REF = { lat: 23.0225, lon: 72.5714, zone: 'Asia/Kolkata' };
function indiaDay(f) {
  if (!f || !f.day || /^Asia\/(Kolkata|Calcutta)$/.test(loc.zone)) return null;
  const m0 = f.day.slice(0, 7) + '-01', list = cached('india|' + m0, () => Fe.list(K.addDay(m0, -5), 45, INDIA_REF));
  const near = list.filter(x => x.key === f.key && x.en === f.en).sort((a, b) => Math.abs(daysBetween(a.day, f.day)) - Math.abs(daysBetween(b.day, f.day)))[0];
  return near && near.day !== f.day && Math.abs(daysBetween(near.day, f.day)) <= 2 ? near.day : null;
}
const indiaLine = f => { const d = indiaDay(f); return d ? `<p class="caption india">${esc(t('inIndia', { d: dayLabel(d) }))}</p>` : ''; };
const observances = (from, days) => Fe.visible(cached('fest|' + from + '|' + days + '|' + locKey(), () => Fe.list(from, days, loc)), prefs.sets);
const birthMoon = () => profile.date ? K.sidereal(K.instant(profile.date, profile.time || '12:00', profile.zone || 'Asia/Kolkata')) : null;
/* The Vedic day runs sunrise to sunrise, so a time before today's sunrise belongs to yesterday's Choghadiya and Hora. */
function frameFor(at) { const d = vedicDay(day); return at < d.frame.sunrise ? vedicDay(K.addDay(day, -1)) : d; }

// ---- Shell ------------------------------------------------------------------------------------
function applyTheme() {
  const root = document.documentElement;
  const close = document.querySelector('#modal > .close'); if (close) { close.setAttribute('aria-label', t('close')); }
  $('nav').setAttribute('aria-label', t('mainNav'));
  if (prefs.theme === 'light' || prefs.theme === 'dark') root.setAttribute('data-theme', prefs.theme); else root.removeAttribute('data-theme');
  root.lang = L.lang;
}
/* Navigation. Four tabs; Moon, Panchang, Learn and Settings are pages pushed over a tab, with ‹ to go back. One Back
   path (somaBack) serves Android's Back key and gesture, Escape and iOS's edge swipe: it closes a sheet, pops a page,
   steps back in setup, returns to Today, then to today's date, and only then lets the app close. */
let pages = [];
function show(v) { if (v !== view || pages.length) { haptic('select'); if (v === 'moon') hour = null; } pages = []; view = v; render(); window.scrollTo(0, 0); }
function push(v) { if (v === view) return; haptic('select'); if (v === 'moon') hour = null; pages.push({ view, y: window.scrollY || 0 }); view = v; render(); window.scrollTo(0, 0); }
function back() { if (!pages.length) return false; haptic('select'); const p = pages.pop(); view = p.view; render(); window.scrollTo(0, p.y); return true; }
const TAB_LABEL = { today: 'today', calendar: 'calendar', muhurat: 'muhurat', personal: 'you', panchang: 'todayTitle', moon: 'moon', learn: 'learnMore', settings: 'settings', festivals: 'allFestivals' };
/* The top of a pushed page: ‹ and where it goes back to, then the page's own title. */
const pageBar = (title, sub) => `<div class="pagebar"><button class="back" onclick="back()"><span aria-hidden="true">‹</span> ${esc(t(TAB_LABEL[pages.length ? pages[pages.length - 1].view : 'today']))}</button></div><h1>${esc(title)}</h1>${sub ? `<p class="pagesub">${esc(sub)}</p>` : ''}`;
window.somaBack = function () {
  if (onboardStep > 1) { onboard(onboardStep - 1); return true; }
  if (onboardStep === 1) return false;
  if ($('modal').open) { closeSheet(); return true; }
  if (back()) return true;
  if (view !== 'today') { show('today'); return true; }
  if (!isToday()) { setDay(todayKey()); return true; }
  return false;
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modal').open && window.somaBack()) e.preventDefault(); });
function setDay(d) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < '1900-01-01' || d > '2100-12-31') return; if (d !== day) { hour = null; haptic('select'); } day = d; monthView = d.slice(0, 7); render(); }
/* Open a date on Today (from a festival page, a favourable day or a muhurat result). */
function openDay(d) { pages = []; view = 'today'; setDay(d); window.scrollTo(0, 0); }
function datebar() {
  const label = new Intl.DateTimeFormat(locale(), { timeZone: loc.zone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(K.instant(day, '12:00', loc.zone));
  return `<div class="datebar"><button aria-label="${esc(t('prevDay'))}" onclick="setDay(K.addDay(day,-1))">‹</button><label class="datepick">${icon('calendar')}<span>${esc(label)}</span><input aria-label="${esc(t('pickDate'))}" type="date" min="1900-01-01" max="2100-12-31" value="${day}" onchange="setDay(this.value)"></label><button aria-label="${esc(t('nextDay'))}" onclick="setDay(K.addDay(day,1))">›</button>${isToday() ? '' : `<button class="now" onclick="setDay(todayKey())">${esc(t('today2'))}</button>`}</div>`;
}
/* Swipe Today's hero left or right for the next or previous day. */
let swipe0 = null;
document.addEventListener('touchstart', e => { const h = e.target.closest && e.target.closest('.skyhero.today'); swipe0 = h && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null; }, { passive: true });
document.addEventListener('touchend', e => {
  if (!swipe0 || view !== 'today') return; const c = e.changedTouches[0], dx = c.clientX - swipe0.x, dy = c.clientY - swipe0.y; const ok = Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy) && Date.now() - swipe0.t < 600; swipe0 = null;
  if (ok) setDay(K.addDay(day, dx < 0 ? 1 : -1));
}, { passive: true });
let lastPaint = '';
function render() {
  applyTheme();
  $('location').innerHTML = icon('pin') + '<span>' + esc(placeName(loc.name)) + '</span>';
  $('location').setAttribute('aria-label', t('changePlace') + ': ' + placeName(loc.name));
  const tabs = [['today', 'today'], ['calendar', 'calendar'], ['muhurat', 'muhurat'], ['personal', 'you']];
  const tabOf = view === 'moon' && (!pages.length || pages[pages.length - 1].view === 'today') ? 'moon' : pages.length ? pages[0].view : view;
  // Tapping the tab you are on goes back to its top (and pops any pushed page), as on iOS and Android.
  // Phones: the four tabs in a bar on the bottom edge (UITabBar / Material navigation bar). Tablets: a sidebar
  // (UISplitViewController / navigation drawer) that also carries Moon, what is coming up, and the place.
  const tb = (v, label, cls) => `<button class="${tabOf === v ? 'active' : ''}${cls ? ' ' + cls : ''}" aria-current="${tabOf === v ? 'page' : 'false'}" onclick="${v === 'moon' ? "pages=[];view='today';push('moon')" : `show('${v}')`}">${icon(v)}<span>${esc(t(label))}</span></button>`;
  const soon = []; observances(todayKey(), 30).forEach(f => { if (soon.length < 3 && !soon.some(x => x.day === f.day) && f.day >= todayKey()) soon.push(f); });
  $('nav').innerHTML = `<div class="sideonly sbrand"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="2"/><path d="M16 2a14 14 0 0 1 0 28a8 14 0 0 0 0-28z" fill="currentColor"/></svg><span>Soma</span></div>`
    + tabs.map(([v, label]) => tb(v, label)).join('') + tb('moon', 'moon', 'sideonly')
    + `<div class="sideonly sup"><div class="eyebrow">${esc(t('comingUp'))}</div>${soon.map(f => { const n = daysBetween(todayKey(), f.day); return `<button onclick="festivalSheet('${f.key}','${f.day}')"><i class="dot ${f.kind}" aria-hidden="true"></i><span><b>${esc(L.festName(f))}</b><small>${esc(n === 0 ? t('todayWord') : n === 1 ? t('tomorrow') : t('inDays', { n: num(n) }))}</small></span></button>`; }).join('')}</div>`
    + `<button class="sideonly sloc" onclick="locationSheet()">${icon('pin')}<span>${esc(placeName(loc.name))}</span></button>`;
  document.body.dataset.view = view;
  // Entrance motion only when the screen changes, not on the minute tick.
  const paint = view + '|' + day + '|' + L.lang + '|' + (view === 'muhurat' ? muhuratTab : '');
  // A repaint of the same screen (the minute tick) keeps whatever the reader had opened.
  const opened = paint === lastPaint ? Array.from($('app').querySelectorAll('details')).map(x => x.open) : [];
  ({ today: todayView, calendar: calendarView, muhurat: muhuratView, moon: moonView, learn: learnView, personal: personalView, panchang: panchangView, settings: settingsView, festivals: festivalsView })[view]();
  const app = $('app');
  app.classList.remove('enter', 'still');
  if (paint !== lastPaint) { void app.offsetWidth; app.classList.add('enter'); } else app.classList.add('still');
  app.querySelectorAll('details').forEach((x, i) => { if (opened[i]) x.open = true; });
  lastPaint = paint;
  scheduleWidgetFeed();
  saveSnapshot();
}
/* A copy of Today as last drawn, painted by index.html before any script loads, so launch shows the day at once
   instead of a blank screen. It is only used on the same date in the same place; the live render replaces it. */
let snapTimer = null;
function saveSnapshot() {
  if (view !== 'today' || pages.length || onboardStep || !isToday()) return;
  clearTimeout(snapTimer);
  snapTimer = setTimeout(() => {
    try {
      const a = $('app').innerHTML;
      if (a.length < 400000) localStorage.setItem('soma-snap', JSON.stringify({ d: todayKey(), z: loc.zone, l: L.lang, t: prefs.theme, a, n: $('nav').innerHTML, h: $('location').innerHTML }));
    } catch (e) { /* storage full or blocked: launch simply waits for the render */ }
  }, 1500);
}

// ---- Today --------------------------------------------------------------------------------------
/* What kind of day it is, built from the tithi, nakshatra and yoga at sunrise, in the reader's language.
   A festival day is a sacred day whatever its limbs say: the festival *is* the muhurat. It is never "mixed" or "take care",
   and its avoid line only keeps the timing (do not begin the puja in Rahu Kaal), never the activity the festival exists for. */
function verdict(d) {
  const l = d.sunriseLimbs, ti = M.tithi(l.tithi.index), na = M.nakshatra(l.nakshatra.index), yo = M.YOGA[l.yoga.index], ka = M.KARANA[l.karana.index];
  const bad = [ti.nature, na.nature, yo.nature].filter(n => n === 'bad').length + (ka.nature === 'bad' && l.karana.index === 6 ? 1 : 0);
  // When two festivals share a day (Roop Chaudas and Diwali), the hero carries the main one.
  const todays = observances(d.frame.day, 1).filter(x => x.day === d.frame.day && x.kind === 'festival');
  const festival = todays.find(x => MAJOR_FEST.indexOf(x.key) >= 0) || todays[0];
  if (festival) {
    const note = festNote(festival), win = festWindow(d, festival);
    return { nature: 'good', parva: true, festival, win, ti, na, yo,
      good: note ? t('festGood', { f: L.festName(festival), note: note.replace(/[.।]$/, '') }) : L.festName(festival),
      avoid: t('festAvoid', { span: span(d.periods.rahu) }) };
  }
  const nature = bad === 0 ? 'good' : bad === 1 ? 'mixed' : 'bad';
  const good = tr(ti.nature === 'bad' && na.nature !== 'bad' ? na.good : ti.nature === 'good' ? ti.good : na.good);
  const avoid = [ti.nature === 'bad' ? tr(ti.avoid) : '', na.nature === 'bad' ? tr(na.avoid) : '', yo.nature === 'bad' ? t('yogaAvoid', { yoga: L.yogaName(l.yoga.index), time: fmt(l.yoga.end) }) : '']
    .filter(Boolean).join('; ') || tr(ti.avoid);
  return { nature, good, avoid, ti, na, yo, festival: null };
}
const MAJOR_FEST = ['diwali', 'holika', 'dhuleti', 'janmashtami', 'shivratri', 'ramnavami', 'ganesh', 'dussehra', 'navratri', 'rakhi', 'bestuvaras', 'uttarayan', 'sankranti', 'akshaya', 'labhpancham', 'dhanteras', 'kalichaudas', 'bhaidooj'];
/* What the observance is, in one line: Soma's own festival notes (festivals.js INFO) first, then the old short note. */
const festNote = f => { const i = Fe.infoOf && Fe.infoOf(f, L.lang); return i ? i.m : f.note ? tr(f.note) : ''; };
/* The festival's own puja time for its day, by the tradition it is kept in (festivals.js PUJA). The window is fixed for
   the day: it never starts at "now", so it reads the same at 10:30 and at 10:59, and in the evening it is named as passed.
   Observances with no set muhurat have no window, and the hero then gives none. */
const SHUBH_CHOG = c => c.key === 'amrit' || c.key === 'shubh' || c.key === 'labh';
function festWindow(d, f) {
  const kind = Fe.pujaOf(f); if (!kind) return null;
  const fr = d.frame, rise = +fr.sunrise, set = +fr.sunset, len = set - rise, night = fr.nextSunrise - fr.sunset;
  const W = (a, b, extra) => mark(Object.assign({ start: new Date(a), end: new Date(b), key: kind }, extra || {}));
  // Rakhi and the Holika fire are never in Bhadra: the window starts once Bhadra has ended.
  const clear = (a, b, after) => {
    let pieces = [{ start: a, end: b }];
    for (const bh of d.periods.bhadra || []) pieces = pieces.flatMap(x => +bh.end <= x.start || +bh.start >= x.end ? [x] : [{ start: x.start, end: +bh.start }, { start: +bh.end, end: x.end }].filter(y => y.end - y.start >= 20 * 6e4));
    if (pieces.length) return W(pieces[0].start, pieces[0].end);
    const bh = (d.periods.bhadra || []).find(x => +x.end > a), e = bh ? +bh.end : b;
    return W(e, e + (after || 48 * 6e4), { afterBhadra: true });
  };
  // A daytime puja belongs to the festival's own tithi: when that tithi begins after sunrise (Gudi Padwa 2026), the window
  // opens when it begins; Ghatasthapana that misses the morning third moves to Abhijit muhurat, as the panchangs advise.
  const day = (a, b) => {
    if (typeof f.tithi !== 'number') return W(a, b);
    const t0 = K.tithi(new Date(a));
    if (t0.index === f.tithi) return W(a, Math.min(b, +t0.end));
    const t1 = K.tithi(new Date(b));
    if (t1.index === f.tithi && +t1.start < b) return W(Math.max(a, +t1.start + 6e4), b);
    // The tithi ended before the window: keep a window of the same length ending as the tithi ends.
    const tr = K.tithi(new Date(rise));
    if (tr.index === f.tithi && +tr.end <= a) return W(Math.max(rise, +tr.end - (b - a)), +tr.end - 6e4);
    if (kind === 'ghata' && d.periods.abhijit) return W(+d.periods.abhijit.start, +d.periods.abhijit.end);
    return W(a, b);
  };
  switch (kind) {
    case 'pratah': return day(rise, rise + len / 5);
    case 'purvahna': return day(rise, rise + len / 2);
    case 'ghata': return day(rise, rise + len / 3);
    case 'madhyahna': return day(rise + len * 2 / 5, rise + len * 3 / 5);
    case 'aparahna': {
      // When the tithi ends before the afternoon (Raksha Bandhan 2026), the rite is kept earlier, while the tithi lasts.
      let a = rise + len * 3 / 5, b = rise + len * 4 / 5;
      if (typeof f.tithi === 'number') { const tr = K.tithi(new Date(rise)); if (tr.index === f.tithi && +tr.end < b) { if (+tr.end <= a) a = rise; b = +tr.end; } }
      return f.key === 'rakhi' ? clear(a, b, 2 * 36e5) : day(a, b);
    }
    case 'pradosh': {
      // Pradosh belongs to the tithi too: where it has ended before sunset (Dev Diwali 2026 in Toronto) no evening time is offered.
      if (typeof f.tithi === 'number' && K.tithi(new Date(set)).index !== f.tithi && K.tithi(new Date(set + night / 5 - 6e4)).index !== f.tithi) return null;
      // And it ends with the tithi when the tithi ends inside pradosh (Pradosh vrat, Ahmedabad 2026-03-01: Trayodashi ends 7:10 pm).
      let a = set, b = set + night / 5;
      if (typeof f.tithi === 'number') {
        const ts = K.tithi(new Date(set));
        if (ts.index === f.tithi) b = Math.min(b, +ts.end); else { const te = K.tithi(new Date(b - 6e4)); a = Math.max(a, +te.start + 6e4); }
      }
      return f.key === 'holika' ? clear(a, b) : W(a, b);
    }
    // Nishita kaal: the 8th of the night's 15 muhurtas, centred on its midpoint (Shivratri 2026, New Delhi: 12:09 to 1:00 am).
    case 'nishita': { const mid = set + night / 2; return W(mid - night / 30, mid + night / 30); }
    // Chhath: Sandhya Arghya as the sun sets today, Usha Arghya as it rises tomorrow.
    case 'arghya': return W(set - 30 * 6e4, set, { usha: fr.nextSunrise });
    case 'snan': return W(+d.periods.brahma.start, rise);
    case 'punya': return W(Math.max(rise, f.at ? +f.at : rise), set);
    case 'moonrise': { const mr = fr.data.moonrise; return mr ? W(+mr, +mr + 36e5) : null; }
  }
  return null;
}
/* A window that has ended carries passed: true, so the hero says "was", never as if it were still ahead. */
function mark(w) { return w && +w.end <= +now() ? Object.assign({}, w, { passed: true }) : w; }
/* Before sunrise the Vedic day still running is yesterday's: on a festival night (Shivratri, Janmashtami, Kali Chaudas)
   the hero keeps that festival while its puja time is still ahead or running, instead of jumping to the new date at 12 am. */
function todayVerdict(d) {
  const v = verdict(d);
  if (!isToday() || now() >= d.frame.sunrise) return v;
  const vy = verdict(vedicDay(K.addDay(day, -1)));
  return vy.parva && vy.win && !vy.win.passed ? Object.assign(vy, { carried: true, until: d.frame.sunrise }) : v;
}
const festWindowLine = v => (v.carried ? t('carried', { time: fmt(v.until) }) + ' · ' : '') + pujaLine(v.festival, v.win);
/* The puja line, named the way the festival names it ("Lakshmi puja", "Ghatasthapana", "Rakhi time"). */
const pujaName = (f, w) => (t('pujaFest') || {})[f && f.key] || (t('pujaKind') || {})[w.key] || t('pujaTime');
function pujaLine(f, w) {
  if (!w) return '';
  if (w.key === 'moonrise') return t(w.passed ? 'moonriseWas' : 'moonriseLine', { time: fmt(w.start) });
  if (w.key === 'arghya') return w.passed ? t('arghyaWas', { rise: fmt(w.usha) }) : t('arghyaLine', { set: fmt(w.end), rise: fmt(w.usha) });
  return t(w.passed ? 'pujaWas' : 'pujaAt', { name: pujaName(f, w), span: span(w) }) + (w.afterBhadra && !w.passed ? ' · ' + t('afterBhadra') : '');
}
/* One three-level scale everywhere, in every language: Good · Neutral · Avoid (શુભ · સામાન્ય · અશુભ). A festival day is good. */
const level = n => n === 'good' || n === 'festival' ? 'good' : n === 'bad' ? 'bad' : 'neutral';
const verdictWord = n => L.nature(level(n));
const vWord = v => verdictWord(v.parva ? 'good' : v.nature);
/* ---- One answer to "is now a good time?" ---------------------------------------------------------------
   Every hero, the Plan check and the widget read this, so no two screens can disagree. A kaal period (Rahu Kaal,
   Yamaganda, Gulika, Dur Muhurta) outranks the Choghadiya: in Rahu Kaal the answer is Avoid whatever Choghadiya runs. */
const KAALS = ['rahu', 'yamaganda', 'gulika'];
/* The Vedic day in force at an instant: before its civil date's sunrise, that is the previous day's. */
function vedicDayAt(at) { const k = K.dateKey(at, loc.zone), d = vedicDay(k); return at < d.frame.sunrise ? vedicDay(K.addDay(k, -1)) : d; }
function kaalsOf(d) { return KAALS.map(k => Object.assign({ k }, d.periods[k])).concat((d.periods.dur || []).map(p => Object.assign({ k: 'dur' }, p))); }
function nowState(at, dd) {
  dd = dd || vedicDayAt(at);
  const c = P.at(dd.choghadiya, at), kl = kaalsOf(dd), kaal = kl.find(p => p.start <= at && at < p.end) || null;
  const lv = kaal ? 'bad' : c ? c.nature : 'neutral';
  // The state holds until the kaal ends, or the Choghadiya ends, or a kaal cuts into it.
  const cut = kaal ? null : kl.filter(p => p.start > at && (!c || p.start < c.end)).sort((a, b) => a.start - b.start)[0] || null;
  const until = kaal ? kaal.end : cut ? cut.start : c ? c.end : null;
  return { at, dd, c, kaal, cut, until, level: lv, next: nextGoodAfter(at, dd, until) };
}
/* The next clean shubh window (Amrit, Shubh, Labh with every kaal cut out) after `from`. After sunset Soma does not send
   anyone to 2 am: a night window that starts after 10 pm gives way to tomorrow's first shubh time. */
function nextGoodAfter(at, dd, from) {
  from = from && from > at ? from : at;
  const nd = vedicDay(K.addDay(dd.frame.day, 1));
  const late = w => w.night && (hourOf(w.start) >= 22 || w.start < dd.frame.nextSunrise && hourOf(w.start) < 12);
  const list = P.goodWindows(dd, from, { strict: true, accept: SHUBH_CHOG }).concat(P.goodWindows(nd, from, { strict: true, accept: c => SHUBH_CHOG(c) && !c.night }));
  return list.find(w => w.start >= from && !late(w)) || list.find(w => w.end > from) || null;
}
function stars(n, seed) { let s = '', x = seed; const r = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; for (let i = 0; i < n; i++) s += `<circle cx="${(r() * 400).toFixed(1)}" cy="${(r() * 300).toFixed(1)}" r="${(r() * 1.2 + 0.2).toFixed(2)}" fill="#fff" opacity="${(r() * 0.7 + 0.15).toFixed(2)}"/>`; return `<svg class="stars" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${s}</svg>`; }

/* The context every Today hero needs: the Vedic day in force now, the current Choghadiya, sky phase. */
function heroContext(d) {
  const live = isToday(), at0 = live ? now() : null, dd = live ? frameFor(at0) : d;
  const at = at0 || new Date(+d.frame.sunrise + 4 * 36e5);
  const c = at0 ? P.at(dd.choghadiya, at0) : null;
  const ti = K.tithi(at);
  // Sky tint follows the civil day's own sunrise and sunset, so the hour before today's sunrise reads as dawn
  // (the Vedic day in force then is yesterday's, whose sunrise was a day ago).
  const sky = SomaDial.skyPhase(at, d.frame.sunrise, d.frame.sunset);
  return { live, now: at0, dd, c, ti, sky, at };
}
// ---- Live weather (opt-in; the native shell fetches from MET Norway, weather.js reads it) --------------------
const Wx = window.SomaWeather || null;
let wxData = null, wxAsked = 0;
const wxNative = () => !!(Wx && window.SomaNative && SomaNative.weatherConfigure && SomaNative.weatherNow);
const wxFahr = () => prefs.units === 'f' || (prefs.units !== 'c' && !!Wx && Wx.fahrenheitFor(loc.zone));
const wxDeg = c => Wx.deg(c, wxFahr());
function wxLoad() {
  wxData = null;
  if (!wxNative() || !prefs.weather) return;
  try { const s = SomaNative.weatherNow(); wxData = s ? JSON.parse(s) : null; } catch (e) { wxData = null; }
}
/* Ask the shell for a fresh forecast at most every 5 minutes; it also honours MET's own expiry. */
function wxRequest(force) {
  if (!wxNative() || !prefs.weather) return;
  const n = Date.now();
  if (!force && n - wxAsked < 3e5) return;
  wxAsked = n;
  // configure (not just refresh) so the widget follows a change of place or units too.
  try { SomaNative.weatherConfigure(true, wxFahr() ? 'f' : 'c', loc.lat, loc.lon); } catch (e) {}
}
window.somaReceiveWeather = function (json) {
  try { wxData = json && json.charAt(0) === '{' ? JSON.parse(json) : null; } catch (e) { wxData = null; }
  if ($('modal').open && $('dialogBody').querySelector('.wxsheet')) { weatherSheet(); return; }
  if (view === 'today' && !$('modal').open && !$('onboard').classList.contains('open')) render();
};
const sunUp = (d, at) => at >= d.frame.sunrise && at < d.frame.sunset;
/* The weather that holds now, for the place on screen; null when off, stale, for another place, or another day. */
function wxCurrent(d, cx) {
  if (!Wx || !wxData || !cx.live || !prefs.weather) return null;
  if (Math.abs(wxData.lat - loc.lat) > 0.02 || Math.abs(wxData.lon - loc.lon) > 0.02) return null;
  const n = Wx.at(wxData, cx.now, +K.instant(K.addDay(day, 1), '00:00', loc.zone));
  if (!n.ok) return null;
  n.day = sunUp(d, cx.now);
  n.cond = t('wx')[n.kind] || n.kind;
  n.tint = Wx.tint(n.kind, n.day) || (n.day ? '' : 'night');
  return n;
}
/* The chip on every Today layout: an invitation until weather is on, then temperature, condition, high and low. */
function wxChip(d, cx) {
  if (!wxNative() || !cx.live) return '';
  if (!prefs.weather) return prefs.wxDismissed ? '' : `<button class="wxchip invite" onclick="weatherSheet()"><span>＋ ${esc(t('wxAdd'))}</span></button>`;
  const n = wxCurrent(d, cx);
  if (!n) return wxData && Math.abs(wxData.lat - loc.lat) <= 0.02 ? '' : `<button class="wxchip" data-tint="${sunUp(d, cx.now) ? '' : 'night'}" onclick="weatherSheet()"><span>${esc(t('wxLoading'))}</span></button>`;
  const label = t('wxSummary', { temp: wxDeg(n.temp), cond: n.cond + (n.windy ? ', ' + t('wxWindy') : ''), hi: wxDeg(n.hi), lo: wxDeg(n.lo) });
  return `<button class="wxchip" data-tint="${n.tint}" onclick="weatherSheet()" aria-label="${esc(label)}"><span>${Wx.icon(n.kind, n.day, 22)}<b>${esc(wxDeg(n.temp))}</b><span>${esc(n.cond)}</span><small>${esc(wxDeg(n.hi))} / ${esc(wxDeg(n.lo))}</small></span></button>`;
}
function wxLayer(d, cx) {
  const n = wxCurrent(d, cx);
  return n ? { fx: Wx.fx(n.kind, n.day, n.windy), tint: Wx.tint(n.kind, n.day), n } : { fx: '', tint: '', n: null };
}
/* The forecast for any moment of the next ~10 days at the place on screen: the hourly point for the first two days,
   then MET's 6-hour blocks. Null when weather is off, stale, for another place, or beyond the forecast. */
function wxFor(at) {
  if (!Wx || !wxData || !prefs.weather || at == null) return null;
  if (Math.abs(wxData.lat - loc.lat) > 0.02 || Math.abs(wxData.lon - loc.lon) > 0.02 || +now() - wxData.at > 12 * 36e5) return null;
  const x = +at;
  return (wxData.hours || []).find(h => h.t <= x && x < h.t + 36e5) || (wxData.six || []).find(h => h.t <= x && x < h.t + 6 * 36e5) || null;
}
const WET = /drizzle|rain|showers|sleet|snow|thunder/;
const wxKmh = ms => wxFahr() ? Math.round(ms * 2.237) + ' ' + t('mph') : Math.round(ms * 3.6) + ' ' + t('kmh');
const wxBrief = h => (t('wx')[h.k] || h.k) + ', ' + wxDeg(h.c);
/* What the sky will do at the moment a festival turns on: clouds at moonrise for the fasts broken by the Moon,
   kite wind for Uttarayan, wind at the Holika fire, cloud at an eclipse's peak, and the sky at the puja time. */
function festSky(f) {
  if (!wxFor(now())) return '';
  const d = vedicDay(f.day);
  let line = '';
  if (f.rule === 'moonrise') {
    const mr = d.frame.data.moonrise, h = wxFor(mr);
    if (h) line = (h.cl >= 70 || WET.test(h.k)) ? t('skyMoonHidden', { time: fmt(mr), cl: h.cl }) : t('skyMoonClear', { time: fmt(mr), sky: wxBrief(h) });
  } else if (f.key === 'uttarayan') {
    const hs = [11, 12, 13, 14, 15].map(hr => wxFor(K.instant(f.day, String(hr).padStart(2, '0') + ':00', loc.zone))).filter(Boolean);
    if (hs.length) { const w = hs.reduce((a, h) => a + h.w, 0) / hs.length, v = wxKmh(w);
      line = w < 2.5 ? t('kiteCalm', { v }) : w > 11 ? t('kiteStrong', { v }) : t('kiteGood', { v }); }
  } else if (f.key === 'holika') {
    const at = new Date(+d.frame.sunset + 36e5), h = wxFor(at);
    if (h) line = h.w >= 8 ? t('holikaWind', { v: wxKmh(h.w) }) : WET.test(h.k) ? t('skyWet', { sky: wxBrief(h) }) : t('holikaCalm', { sky: wxBrief(h) });
  } else if (f.key === 'chandragrahan' || f.key === 'suryagrahan') {
    const h = wxFor(f.at);
    if (h) line = (h.cl >= 70 || WET.test(h.k)) ? t('eclipseCloud', { cl: h.cl }) : t('eclipseClear', { sky: wxBrief(h) });
  } else {
    const w = f.kind === 'festival' ? festWindow(d, f) : null, h = w && !w.passed ? wxFor(w.start) : null;
    if (h) line = WET.test(h.k) ? t('skyWet', { sky: wxBrief(h) }) : t('skyPuja', { sky: wxBrief(h) });
  }
  return line ? `<p class="caption skyline">${esc(line)}</p>` : '';
}
/* A storm, heavy rain or snow, or a gale on a day: for the long-journey muhurat list. */
function wxStorm(key) {
  const a = +K.instant(key, '06:00', loc.zone), z = +K.instant(key, '22:00', loc.zone);
  const pts = [];
  for (let x = a; x <= z; x += 36e5) { const h = wxFor(x); if (h && pts[pts.length - 1] !== h) pts.push(h); }
  const bad = pts.find(h => /thunder|heavyrain|heavysnow/.test(h.k)) || pts.find(h => h.w >= 15) || pts.find(h => h.k === 'snow');
  return bad ? t('stormDay', { sky: (t('wx')[bad.k] || bad.k) + (bad.w >= 15 ? ', ' + wxKmh(bad.w) : '') }) : '';
}
function weatherSheet() {
  if (!wxNative()) return;
  if (!prefs.weather) {
    modal(`<div class="wxsheet"><div class="eyebrow">${esc(t('wxTitle'))}</div><h2 id="sheetTitle">${esc(t('wxLive'))}</h2><p>${esc(t('wxWhy'))}</p>`
      + `<button class="primary" onclick="setWeather(true)">${esc(t('wxOn'))}</button><button class="quiet" onclick="dismissWeather()">${esc(t('wxNotNow'))}</button><p class="credit">${esc(t('wxCredit'))}</p></div>`);
    return;
  }
  const d = vedicDay(todayKey()), cx = { live: true, now: now() }, n = wxCurrent(d, cx);
  let body;
  if (!n) body = `<p>${esc(wxData ? t('wxStale') : t('wxLoading'))}</p>`;
  else {
    const tomorrow = vedicDay(K.addDay(todayKey(), 1));
    const wind = wxFahr() ? Math.round(n.wind * 2.237) + ' ' + t('mph') : Math.round(n.wind * 3.6) + ' ' + t('kmh');
    const facts = [t('wxHiLo', { hi: wxDeg(n.hi), lo: wxDeg(n.lo) }), t('wxWind', { v: wind }), t('wxHum', { v: n.humidity })].concat(n.precip >= 0.1 ? [t('wxRain', { v: n.precip.toFixed(1) })] : []);
    const hours = n.next.slice(0, 12).map(h => { const at = new Date(h.t + 18e5), up = sunUp(d, at) || sunUp(tomorrow, at);
      return `<div role="group" aria-label="${esc(fmt(new Date(h.t)) + ' ' + wxDeg(h.c) + ' ' + (t('wx')[h.k] || ''))}"><span>${esc(fmt(new Date(h.t), { hour: 'numeric' }))}</span>${Wx.icon(h.k, up, 24)}<b>${esc(wxDeg(h.c))}</b></div>`; }).join('');
    body = `<div class="wxnow" data-tint="${n.tint}">${Wx.fx(n.kind, n.day, n.windy)}${Wx.icon(n.kind, n.day, 56)}<div><div class="t">${esc(wxDeg(n.temp))}</div><p><b>${esc(n.cond)}</b>${n.windy ? ' · ' + esc(t('wxWindy')) : ''}</p></div></div>`
      + `<p>${facts.map(esc).join(' · ')}</p>${hours ? `<div class="eyebrow section">${esc(t('wxNext'))}</div><div class="hours">${hours}</div>` : ''}`
      + `<p class="caption">${esc(t('wxUpdated', { t: fmt(new Date(wxData.at)) }))} · ${esc(placeName(loc.name))}</p><p class="caption">${esc(t('wxWidget'))}</p>`;
  }
  modal(`<div class="wxsheet"><div class="eyebrow">${esc(t('wxTitle'))} · ${esc(placeName(loc.name))}</div><h2 id="sheetTitle">${esc(t('wxLive'))}</h2>${body}`
    + `<label>${esc(t('wxUnits'))}${seg(t('wxUnits'), wxFahr() ? 'f' : 'c', [['c', '°C'], ['f', '°F']], 'setUnits')}</label>`
    + `<button class="quiet" onclick="setWeather(false)">${esc(t('wxOff'))}</button><p class="credit">${esc(t('wxCredit'))}</p></div>`);
}
function setWeather(on, quiet) {
  prefs.weather = !!on;
  if (on) prefs.wxDismissed = false;
  persist(); haptic('select');
  if (!wxNative()) return;
  if (!on) wxData = null;
  wxAsked = Date.now();
  try { SomaNative.weatherConfigure(!!on, wxFahr() ? 'f' : 'c', loc.lat, loc.lon); } catch (e) {}
  if (quiet) return;
  if (on) weatherSheet(); else $('modal').close();
  render();
}
function setUnits(u) { prefs.units = u; persist(); haptic('select'); wxRequest(true); weatherSheet(); render(); }
function dismissWeather() { prefs.wxDismissed = true; persist(); $('modal').close(); render(); }
/* A spoken summary of the dial, so VoiceOver and TalkBack hear what the ring shows. */
function dialLabel(d, ns) {
  const rahu = span(d.periods.rahu);
  if (!ns || !ns.c) return t('dialSummaryDay', { d: dayLabel(day), rahu });
  return t('dialSummary', { chog: L.chogName(ns.c.key), nature: L.nature(level(ns.c.nature)), time: fmt(ns.c.end), next: ns.next ? L.chogName(ns.next.key) + ' ' + span(ns.next) : t('none'), rahu });
}
/* The ring's hour labels in the reader's own clock ("6 am", "12 pm"), not 0/6/12/18. */
const dialNums = () => [6, 12, 18, 0].map(h => [h, new Intl.DateTimeFormat(locale(), Object.assign({ timeZone: 'UTC', hour: 'numeric' }, L.lang === 'en' ? { hour12: true } : { dayPeriod: 'narrow' })).format(new Date(Date.UTC(2020, 0, 1, h)))
  .replace(/\s?(am|pm)$/i, m => m.trim().toLowerCase()[0] === 'a' ? 'a' : 'p')]);
/* Today's one answer. The Sky card's colours and weather, the Kaal Chakra dial inside it, and above the dial what to do now:
   the level (Good time · Neutral · Avoid), the name of what runs now (Rahu Kaal outranks any Choghadiya), until when, and
   what comes next. On a festival day the festival and its puja time sit at the top of the card. Another day: its tithi. */
function todayHero(d, v, cx) {
  const ns = cx.live ? nowState(cx.now, cx.dd) : null, wx = wxLayer(d, cx), chip = wxChip(d, cx), night = cx.sky === 'night';
  let lv, big, l1 = '', l2 = '', then = '', info = '';
  if (ns && ns.kaal) {
    lv = 'bad'; big = periodName(ns.kaal.k); info = `termSheet('${ns.kaal.k}')`;
    l1 = until(ns.kaal.end) + (rel(ns.kaal, cx.now) ? ' · ' + rel(ns.kaal, cx.now) : '');
    l2 = ns.c ? t('underKaal', { chog: L.chogName(ns.c.key), kaal: periodName(ns.kaal.k) }) : t('holdNew');
  } else if (ns && ns.c) {
    lv = level(ns.c.nature); big = L.chogName(ns.c.key); info = `chogSheet('${ns.c.key}')`;
    l1 = until(ns.until) + (rel({ start: ns.c.start, end: ns.until }, cx.now) ? ' · ' + rel({ start: ns.c.start, end: ns.until }, cx.now) : '');
    l2 = tr(M.CHOG[ns.c.key].good) + (ns.cut ? ' · ' + t('kaalFrom', { kaal: periodName(ns.cut.k), time: fmt(ns.cut.start) }) : '');
  } else { lv = level(v.parva ? 'good' : v.nature); big = L.tithiName(d.sunriseLimbs.tithi.index); l1 = daySentence(v); }
  if (ns && ns.next && lv !== 'good') {
    const tmr = K.dateKey(ns.next.start, loc.zone) !== K.dateKey(cx.now, loc.zone);
    then = t(tmr ? 'thenTomorrow' : 'thenT', { what: L.chogName(ns.next.key), span: shortSpan(ns.next) });
  }
  const word = { good: t('lvGood'), neutral: t('lvNeutral'), bad: t('lvBad') }[lv];
  const kaal = kaalsOf(d).filter(p => p.k !== 'dur');
  const dial = SomaDial.svg({ size: 300, hourOf, chog: cx.dd.choghadiya, rahu: d.periods.rahu, kaal, sunrise: cx.dd.frame.sunrise, sunset: cx.dd.frame.sunset, now: cx.now, nums: dialNums(), label: dialLabel(d, ns) });
  const tithi = L.tithiName(cx.ti.index);
  const fest = v.parva ? `<button class="festband" onclick="festivalSheet('${v.festival.key}','${v.festival.day}')"><span class="over">${esc(v.carried ? t('festNight') : t('festToday'))}</span><b>${esc(L.festName(v.festival))}</b>${festWindowLine(v) ? `<span>${esc(festWindowLine(v))}</span>` : ''}<i aria-hidden="true">›</i></button>` : '';
  return todayTitle(d)
    + `<section class="skyhero today" data-sky="${cx.sky}"${wx.tint ? ` data-tint="${wx.tint}"` : ''}>${night && !wx.tint ? stars(70, 7) : ''}${wx.fx}`
    // Tonight's Moon as a lit sphere in the corner of the sky, its real phase; it opens the Moon page.
    + `<button class="skyorb" onclick="push('moon')" aria-label="${esc(t('moonPage') + ': ' + tithi)}">${SomaDial.moon(120, cx.ti.angle, 'orb')}</button>`
    + `<div class="herotop"><div class="status"><span class="pill ${lv}"><i aria-hidden="true"></i>${esc(word)}</span>${info ? `<button class="tip" onclick="${info}" aria-label="${esc(t('whatIsX', { x: big }))}">${icon('info')}</button>` : ''}</div>${chip}</div>${fest}`
    + `<h1 class="big">${esc(big)}</h1>${l1 ? `<p class="lineone">${esc(l1)}</p>` : ''}${l2 ? `<p class="linetwo">${esc(l2)}</p>` : ''}${then ? `<p class="then"><i aria-hidden="true"></i>${esc(then)}</p>` : ''}`
    + sunStrip(d, cx) + `</section>`
    // The whole day under the Sky card: the Kaal Chakra with the Moon and tithi at its centre, and the four angas under it.
    + `<section class="card dialbox"><div class="dialwrap">${dial.svg}<button class="dialcore" onclick="push('moon')" aria-label="${esc(t('moonPage') + ': ' + tithi)}">${SomaDial.moon(52, cx.ti.angle)}<span class="tithi">${esc(tithi)}</span><small>${esc(L.nakName(Math.floor(P.moonSid(cx.at) / (360 / 27)) % 27))}</small></button></div>` + nextRow(d, cx, ns) + angaRow(d) + dialLegend() + `</section>`;
}
/* The screen's own large title (iOS) / top app bar (Material): its name, a line under it, and a control on the right. */
const titleBar = (title, sub, trail) => `<header class="atitle"><h1>${title}</h1>${trail ? `<div class="atrail">${trail}</div>` : ''}${sub ? `<div class="asub">${sub}</div>` : ''}</header>`;
const locPill = () => `<button class="locpill" onclick="locationSheet()" aria-label="${esc(t('changePlace') + ': ' + placeName(loc.name))}">${icon('pin')}<span>${esc(placeName(loc.name))}</span></button>`;
/* Today's title: "Today" (or the weekday when another day is open), the date, lunar month and samvat under it with
   the day before and after one tap away, and the place on the right. */
function todayTitle(d) {
  const monthName = P.monthName(d.frame.sunrise, prefs.month, L.monthNames), samvat = P.samvat(d.frame.sunrise, samvatSystem());
  const at = K.instant(day, '12:00', loc.zone);
  const label = new Intl.DateTimeFormat(locale(), { timeZone: loc.zone, weekday: isToday() ? 'short' : undefined, day: 'numeric', month: 'short' }).format(at);
  const title = isToday() ? t('today') : new Intl.DateTimeFormat(locale(), { timeZone: loc.zone, weekday: 'long' }).format(at);
  const sub = `<div class="datenav"><button class="arrow" aria-label="${esc(t('prevDay'))}" onclick="setDay(K.addDay(day,-1))">‹</button><label class="datepick"><span>${esc(label)} · ${esc(monthName)} · ${esc(t('vsShort'))} ${num(samvat)}</span><input aria-label="${esc(t('pickDate'))}" type="date" min="1900-01-01" max="2100-12-31" value="${day}" onchange="setDay(this.value)"></label><button class="arrow" aria-label="${esc(t('nextDay'))}" onclick="setDay(K.addDay(day,1))">›</button></div>`;
  return titleBar(esc(title), sub, (isToday() ? '' : `<button class="now" onclick="setDay(todayKey())">${esc(t('today2'))}</button>`) + locPill());
}
/* The four angas under the dial, each one tap from the full panchang. */
function angaRow(d) {
  const l = d.sunriseLimbs;
  const cell = (k, name, end, nature) => `<button class="anga" onclick="push('panchang')" aria-label="${esc(t(k) + ': ' + name + (end ? ', ' + until(end) : ''))}"><small>${esc(t(k))}</small><b class="${nature ? level(nature) : ''}">${esc(name)}</b>${end ? `<span>${esc(until(end))}</span>` : ''}</button>`;
  return `<div class="angas">${cell('tithi', L.tithiName(l.tithi.index), l.tithi.end, M.tithi(l.tithi.index).nature)}${cell('nakshatra', L.nakName(l.nakshatra.index), l.nakshatra.end, M.nakshatra(l.nakshatra.index).nature)}`
    + `${cell('yoga', L.yogaName(l.yoga.index), l.yoga.end, M.YOGA[l.yoga.index].nature)}${cell('karana', L.karanaName(l.karana.index), l.karana.end, M.KARANA[l.karana.index].nature)}</div>`;
}
/* Three times worth knowing, each one tap from what it means: Rahu Kaal, Abhijit (or Brahma at night), and the next good window. */
function nextRow(d, cx, ns) {
  const per = d.periods, at = cx.now, past = p => at && p.end <= at;
  const item = (k, label, p, cls, go) => `<button class="nx ${cls}${past(p) ? ' past' : ''}" onclick="${go}"><small>${esc(label)}</small><b>${esc(shortSpan(p))}</b></button>`;
  const late = at && at > d.frame.sunset, brahma = late ? vedicDay(K.addDay(day, 1)).periods.brahma : per.brahma;
  const second = !per.abhijit.wednesday && !(at && per.abhijit.end <= at) ? item('abhijit', t('abhijitShort'), per.abhijit, 'good', "termSheet('abhijit')") : item('brahma', t('brahmaShort'), brahma, 'good', "termSheet('brahma')");
  const nb = ns && ns.level === 'good' ? nextGoodAfter(at, ns.dd, ns.until) : !ns ? P.goodWindows(d, d.frame.sunrise, { strict: true, accept: c => SHUBH_CHOG(c) && !c.night })[0] : null;
  const third = nb ? item('best', ns ? t('nextGood') : t('bestShort'), nb, 'good', `chogSheet('${nb.key}')`) : '';
  return `<div class="nextrow">${item('rahu', t('rahu'), per.rahu, 'bad', "termSheet('rahu')")}${second}${third}</div>`;
}
/* A one-line key for the ring: shape and word, not colour alone. */
const dialLegend = () => `<div class="legend" aria-hidden="true"><span class="good"><i></i>${esc(t('good'))}</span><span class="neutral"><i></i>${esc(t('neutral'))}</span><span class="bad"><i></i>${esc(t('bad'))}</span><span class="rahu"><i></i>${esc(t('kaalWord'))}</span></div>`;
/* Sunrise and sunset as icons with times, daylight between them, a countdown on today.
   After sunset the sunrise slot looks ahead to tomorrow. Labels live in aria-label, not on screen. */
function sunStrip(d, cx) {
  const f = d.frame, len = Math.round((f.sunset - f.sunrise) / 6e4);
  const late = cx.now && cx.now > f.sunset, rise = late ? vedicDay(K.addDay(day, 1)).frame.sunrise : f.sunrise;
  // "6:52" large and "am" / "સવારે" / "सुबह" small, in the order each language writes them.
  const time = at => { if (!at) return '<b>—</b>'; const parts = new Intl.DateTimeFormat(locale(), Object.assign({ timeZone: loc.zone, hour: 'numeric', minute: '2-digit' }, L.lang === 'en' ? { hour12: true } : { dayPeriod: 'short' })).formatToParts(at);
    return '<b>' + parts.map(p => p.type === 'dayPeriod' ? `<span class="per">${esc(p.value)}</span>` : p.type === 'literal' && /^\s+$/.test(p.value) ? ' ' : esc(p.value)).join('') + '</b>'; };
  const cell = (k, label, at) => { const r = rel({ start: at, end: at }, cx.now); return `<div class="${k}${cx.now && at <= cx.now ? ' past' : ''}" role="group" aria-label="${esc(label + ' ' + fmt(at))}">${icon(k)}${time(at)}<small>${r ? esc(r) : ''}</small></div>`; };
  return `<div class="sunstrip">${cell('sunrise', late ? t('tomorrowRise') : t('sunrise'), rise)}<div class="len" aria-label="${esc(t('daylight'))}"><i></i><span>${esc(t('hm', { h: Math.floor(len / 60), m: len % 60 }))}</span><i></i></div>${cell('sunset', t('sunset'), f.sunset)}</div>`;
}
/* A group heading: a small overline that names the kind of thing, the title, and an optional action on the right. */
function groupHead(over, title, action) {
  return `<div class="ghead"><div>${over ? `<div class="over">${esc(over)}</div>` : ''}<h2>${title}</h2></div>${action || ''}</div>`;
}
// ---- Day at a glance --------------------------------------------------------------------------
/* The whole Vedic day on one map: the 16 Choghadiya, the kaal periods to avoid (Rahu Kaal, Yamaganda, Gulika, Dur Muhurta),
   the shubh muhurtas (Abhijit, Brahma) and Bhadra, each placed at its real time. The day half runs sunrise to sunset,
   the night half sunset to the next sunrise (which is where the next morning's Brahma Muhurta sits). */
const CHOG_LORD = { udveg: 'sun', char: 'venus', labh: 'mercury', amrit: 'moon', kaal: 'saturn', shubh: 'jupiter', rog: 'mars' };
const clip = (p, a, b) => p && p.end > a && p.start < b ? { start: p.start < a ? a : p.start, end: p.end > b ? b : p.end } : null;
function halfOf(d, half) {
  const f = d.frame, night = half === 'night', a = night ? f.sunset : f.sunrise, b = night ? f.nextSunrise : f.sunset, per = d.periods;
  const chog = d.choghadiya.filter(c => c.night === night);
  const kaal = [];
  const add = (k, p, nature, extra) => { const c = clip(p, a, b); if (c) kaal.push(Object.assign(c, { k, nature, full: p }, extra || {})); };
  if (!night) {
    add('rahu', per.rahu, 'bad'); add('yamaganda', per.yamaganda, 'bad'); add('gulika', per.gulika, 'bad');
    add('abhijit', per.abhijit, per.abhijit.wednesday ? 'neutral' : 'good');
  } else add('brahma', vedicDay(K.addDay(d.frame.day, 1)).periods.brahma, 'good');
  (per.dur || []).forEach(p => add('dur', p, 'bad'));
  const bhadra = (per.bhadra || []).map(p => { const c = clip(p, a, b); return c && Object.assign(c, { k: 'bhadra', nature: 'bad', full: p }); }).filter(Boolean);
  // The clean shubh windows: Amrit, Shubh or Labh with every kaal period and Bhadra cut out.
  const best = P.goodWindows(d, a, { strict: true, accept: c => c.night === night && SHUBH_CHOG(c) }).filter(w => w.start < b);
  kaal.sort((x, y) => x.start - y.start);
  return { a, b, night, chog, kaal, bhadra, best };
}
const halfNow = d => isToday() && now() >= d.frame.sunset ? 'night' : 'day';
/* The half of the Vedic day running now. Before today's sunrise that is still last night, which belongs to yesterday's Vedic day. */
function activeHalf(d) {
  if (isToday() && now() < d.frame.sunrise) return { d: vedicDay(K.addDay(day, -1)), half: 'night' };
  return { d, half: halfNow(d) };
}
/* "9:38–11:01 am": a day period both ends share is said once ("9:38–11:01 સવારે", "सुबह 9:38–11:01"). */
const shortSpan = p => {
  const a = fmt(p.start), b = fmt(p.end), wa = a.split(' '), wb = b.split(' ');
  if (wa.length > 1 && wb.length > 1) {
    if (/\d/.test(wa[0]) && wa[wa.length - 1] === wb[wb.length - 1]) return wa.slice(0, -1).join(' ') + '–' + b;
    if (!/\d/.test(wa[0]) && wa[0] === wb[0]) return a + '–' + wb.slice(1).join(' ');
  }
  return a + '–' + b;
};
function periodName(k) { return k === 'dur' ? t('durMuhurta') : k === 'bhadra' ? t('bhadra') : t(k); }
/* The day as an information board: one 24-hour ribbon (sunrise to next sunrise) with every Choghadiya, the kaal marks
   and the shubh muhurtas; under it two columns, Shubh and Avoid, with times you can read at a glance; then the 16
   Choghadiya as a grid. Before today's sunrise the board shows the Vedic day still running (yesterday's). */
function boardData(d0) {
  const live = isToday(), at = now();
  const d = live && at < d0.frame.sunrise ? vedicDay(K.addDay(day, -1)) : d0, f = d.frame, per = d.periods;
  // Brahma Muhurta: this morning's until it has passed, then tomorrow's.
  const brahma = live && at > per.brahma.end ? vedicDay(K.addDay(f.day, 1)).periods.brahma : per.brahma;
  const items = [];
  const push = (k, p, nature, extra) => items.push(Object.assign({ k, start: p.start, end: p.end, nature }, extra || {}));
  d.choghadiya.forEach(c => push('chog', c, c.nature, { key: c.key, night: c.night }));
  push('brahma', brahma, 'good');
  push('abhijit', per.abhijit, per.abhijit.wednesday ? 'neutral' : 'good');
  ['rahu', 'yamaganda', 'gulika'].forEach(k => push(k, per[k], 'bad'));
  (per.dur || []).forEach(p => push('dur', p, 'bad'));
  (per.bhadra || []).forEach(p => push('bhadra', p, 'bad'));
  // Best windows go last, so the indices of everything else stay put while the clock runs.
  P.goodWindows(d, live && at > f.sunrise ? at : f.sunrise, { strict: true, accept: SHUBH_CHOG }).slice(0, 3).forEach(w => push('best', w, 'good', { key: w.key, night: w.night }));
  return { d, items, live, at, a: f.sunrise, b: f.nextSunrise, sunset: f.sunset };
}
const boardName = p => p.k === 'chog' || p.k === 'best' ? L.chogName(p.key) : periodName(p.k);
function dayBoard(d0) {
  const B = boardData(d0), { items, live, at } = B, len = B.b - B.a;
  const st = p => live && p.end <= at ? ' past' : live && p.start <= at && at < p.end ? ' current' : '';
  const pct = v => Math.min(100, Math.max(0, (v - B.a) / len * 100));
  const x = p => `left:${pct(p.start).toFixed(3)}%;width:${(pct(p.end) - pct(p.start)).toFixed(3)}%`;
  const idx = items.map((p, i) => Object.assign({ i }, p));
  const chog = idx.filter(p => p.k === 'chog'), shubh = idx.filter(p => p.k === 'best' || p.k === 'abhijit' || p.k === 'brahma'), avoid = idx.filter(p => p.nature === 'bad' && p.k !== 'chog');
  shubh.sort((a, b) => a.start - b.start); avoid.sort((a, b) => a.start - b.start);
  // Ribbon.
  const segs = chog.map(p => `<i class="s ${p.nature}${st(p)}" style="${x(p)}"></i>`).join('');
  const over = avoid.filter(p => p.end > B.a && p.start < B.b).map(p => `<i class="m bad${p.k === 'bhadra' ? ' bh' : ''}" style="${x(p)}"></i>`).join('')
    + shubh.filter(p => p.k !== 'best' && p.end > B.a && p.start < B.b).map(p => `<i class="m ${p.nature}" style="${x(p)}"></i>`).join('');
  const under = shubh.filter(p => p.k === 'best').map(p => `<i class="u" style="${x(p)}"></i>`).join('');
  const nowMark = live && at >= B.a && at < B.b ? `<i class="now" style="left:${pct(at).toFixed(3)}%"></i>` : '';
  const ss = pct(B.sunset);
  const ribbon = `<div class="ribbon" aria-hidden="true"><div class="over">${over}</div><div class="track"><i class="nightband" style="left:${ss.toFixed(3)}%"></i>${segs}${nowMark}</div><div class="under">${under}</div>`
    + `<div class="rlabels"><span style="left:0">${icon('sunrise')}${esc(fmt(B.a))}</span><span class="mid" style="left:${ss.toFixed(3)}%">${icon('sunset')}${esc(fmt(B.sunset))}</span><span class="end">${icon('sunrise')}${esc(fmt(B.b))}</span></div></div>`;
  // Two columns, like a departures board: name small, time large.
  const row = p => { const s = st(p); return `<button type="button" class="brow ${p.nature}${s}" onclick="boardInfo(${p.i})" aria-label="${esc(boardName(p) + ', ' + span(p))}">`
    + `<span class="nm"><i class="dot ${p.nature}" aria-hidden="true"></i>${esc(p.k === 'best' ? t('bestShort') + ' · ' + boardName(p) : boardName(p))}</span><b>${esc(shortSpan(p))}</b>${s === ' current' ? `<em>${esc(t('running'))}</em>` : ''}</button>`; };
  const col = (cls, title, list) => `<div class="bcol ${cls}"><div class="bhead"><i aria-hidden="true"></i>${esc(title)}</div>${list.map(row).join('') || `<p class="caption">${esc(t('none'))}</p>`}</div>`;
  // Choghadiya grid: day and night, four to a row.
  const tile = p => `<button type="button" class="ctile ${p.nature}${st(p)}" onclick="boardInfo(${p.i})" aria-label="${esc(L.chogName(p.key) + ', ' + L.nature(p.nature) + ', ' + span(p))}"><b>${esc(L.chogName(p.key))}</b><small>${esc(fmt(p.start))}</small></button>`;
  const grid = (night, label) => `<div class="cgrid"><div class="clabel">${icon(night ? 'moon' : 'today')}<span>${esc(label)}</span></div><div class="ctiles">${chog.filter(p => p.night === night).map(tile).join('')}</div></div>`;
  return `<section class="section boardsec">${groupHead(t('ovGlance'), esc(t('dayMap')))}<div class="board">${ribbon}`
    + `<div class="bcols">${col('good', t('good'), shubh)}${col('bad', t('bad'), avoid)}</div></div>`
    + `<div class="board chogboard"><div class="over2">${esc(t('choghadiya'))}</div>${grid(false, t('day'))}${grid(true, t('night'))}</div>`
    + `<p class="caption" style="margin-top:8px">${esc(t('tapBlock'))}</p></section>`;
}
/* A sheet for one entry on the board: what it is in the tradition and what to do in it. */
function boardInfo(i) {
  const B = boardData(vedicDay(day)), p = B.items[i]; if (!p) return;
  let title, what, todo;
  if (p.k === 'chog' || p.k === 'best') {
    title = L.chogName(p.key) + ' ' + t('choghadiya');
    what = p.k === 'best' ? t('bestRule') : t('infoChog', { planet: L.planetName(CHOG_LORD[p.key]) });
    todo = t('goodForX', { x: tr(M.CHOG[p.key].good) });
  } else {
    const key = { rahu: 'Rahu', yamaganda: 'Yama', gulika: 'Gulika', dur: 'Dur', bhadra: 'Bhadra', abhijit: 'Abhijit', brahma: 'Brahma' }[p.k];
    title = periodName(p.k); what = t('info' + key); todo = p.k === 'abhijit' && B.d.periods.abhijit.wednesday ? t('notWednesday') : t('do' + key);
  }
  modal(`<div class="row"><div class="eyebrow">${esc(dayLabel(B.d.frame.day))}</div>${badge(p.nature)}</div><h2 id="sheetTitle" style="margin-top:6px">${esc(title)}</h2><p class="value" style="margin-top:4px">${esc(span(p))}</p>`
    + `<div class="list"><div class="timeline"><div><div class="eyebrow">${esc(t('whatItIs'))}</div><p style="color:var(--ink)">${esc(what)}</p></div></div><div class="timeline"><div><div class="eyebrow">${esc(t('whatToDo'))}</div><p style="color:var(--ink)">${esc(todo)}</p></div></div></div>`);
}
/* Today's compact strip: the same day as one bar. Choghadiya as coloured segments, kaal periods as marks above,
   Abhijit as a star, a now marker, sunrise and sunset at the ends. The whole strip opens the Muhurat map. */
function dayStrip(d0, opts) {
  const act = opts && opts.half ? { d: d0, half: opts.half } : activeHalf(d0), d = act.d, half = act.half, h = halfOf(d, half), len = h.b - h.a, live = isToday(), at = now();
  const x = p => `left:${((p.start - h.a) / len * 100).toFixed(3)}%;width:${((p.end - p.start) / len * 100).toFixed(3)}%`;
  const segs = h.chog.map(c => `<i class="s ${c.nature}${live && c.end <= at ? ' past' : ''}" style="${x(c)}"></i>`).join('');
  const marks = h.kaal.filter(p => p.nature === 'bad').map(p => `<i class="k" style="${x(p)}"></i>`).join('') + h.bhadra.map(p => `<i class="k bh" style="${x(p)}"></i>`).join('');
  const goods = h.kaal.filter(p => p.nature === 'good').map(p => `<i class="g" style="${x(p)}"></i>`).join('') + h.best.map(p => `<i class="b" style="${x(p)}"></i>`).join('');
  const nowMark = live && at >= h.a && at < h.b ? `<i class="now" style="left:${((at - h.a) / len * 100).toFixed(3)}%"></i>` : '';
  const next = live ? h.best.find(w => w.end > at) : h.best[0];
  const rahu = d.periods.rahu;
  const said = (next ? t('bestTimes') + ' ' + span(next) + ' ' + L.chogName(next.key) + '. ' : '') + (half === 'day' ? t('rahu') + ' ' + span(rahu) + '.' : '');
  return `<button type="button" class="daystrip" onclick="show('muhurat')" aria-label="${esc(t('stripLabel', { what: said }))}">`
    + `<div class="row"><span class="eyebrow">${esc(t('dayMap'))} · ${esc(half === 'night' ? t('night') : t('day'))}</span><span class="chev" aria-hidden="true">›</span></div>`
    + `<div class="bar" aria-hidden="true"><div class="marks">${marks}${goods}</div><div class="segs">${segs}${nowMark}</div></div>`
    + `<div class="ends" aria-hidden="true"><span>${esc(fmt(h.a))}</span><span>${esc(fmt(h.b))}</span></div>`
    + `<div class="stripline" aria-hidden="true">${next ? `<span class="good"><i></i>${esc(next.start <= at && live ? t('now') : t('nextBest'))} <b>${esc(shortSpan(next))}</b> ${esc(L.chogName(next.key))}</span>` : `<span>${esc(h.best.length ? t('bestOver') : t('bestNone'))}</span>`}${half === 'day' ? `<span class="bad"><i></i>${esc(t('rahu'))} <b>${esc(shortSpan(rahu))}</b></span>` : ''}</div></button>`;
}
/* What the day is for, in one line, always led by what it is good for. */
function daySentence(v) {
  const first = x => String(x || '').split(';')[0].trim();
  if (v.parva) return festWindowLine(v) || v.good;
  return (v.nature === 'mixed' ? t('mixedDay') + ' · ' : v.nature === 'bad' ? t('careDay') + ' · ' : '') + t('goodFor') + ': ' + first(v.good);
}
/* The Ekadashi fast was yesterday: today carries its parana (fast-breaking) window. Festivals themselves live in the hero. */
function paranaToday(key) {
  const y = observances(K.addDay(key, -2), 3).find(x => x.key === 'ekadashi' && x.parana && x.parana.day === key);
  return y ? `<div class="card festival vrat"><div class="eyebrow">${esc(t('parana'))}</div><h2>${span(y.parana)}</h2><p>${esc(L.festName(y))} · ${esc(t('dwadashiEnds', { time: fmt(y.parana.dwadashiEnd) }))}</p></div>` : '';
}
/* One observance by key and day, whatever the festival filter says (the reader tapped it, so it is wanted). */
function findObs(key, dayKey) { return Fe.list(K.addDay(dayKey, -1), 3, loc).find(x => x.key === key && x.day === dayKey) || null; }
/* The festival page: what it is, how it is kept, its own puja time, the date in India when it differs, and actions. */
function festivalSheet(key, dayKey) {
  const f = findObs(key, dayKey); if (!f) return;
  const info = Fe.infoOf(f, L.lang), w = festWindow(vedicDay(f.day), f), n = daysBetween(todayKey(), f.day);
  const date = new Intl.DateTimeFormat(locale(), { timeZone: loc.zone, weekday: 'long', day: 'numeric', month: 'long' }).format(K.instant(f.day, '12:00', loc.zone));
  const when = n === 0 ? t('todayWord') : n === 1 ? t('tomorrow') : n > 1 ? t('inDays', { n: num(n) }) : '';
  sheet(L.festName(f), `<div class="eyebrow">${esc(date)}${when ? ' · ' + esc(when) : ''}</div>`,
    (info ? `<p class="leadline">${esc(info.m)}</p>` : f.note ? `<p class="leadline">${esc(festNote(f))}</p>` : '')
    + (w ? `<div class="pujabox"><small>${esc(w.key === 'moonrise' ? t('moonrise') : w.key === 'arghya' ? t('arghyaName') : pujaName(f, w))}</small><b>${esc(pujaLine(f, w))}</b></div>` : '')
    + (f.parana ? `<div class="pujabox"><small>${esc(t('parana'))}</small><b>${esc(dayLabel(f.parana.day))} · ${span(f.parana)}</b></div>` : '')
    + (f.sutak ? `<div class="pujabox bad"><small>${esc(t('sutak'))}</small><b>${esc(t('sutakLine', { a: full(f.sutak), b: full(f.at) }))}</b></div>` : '')
    + indiaLine(f) + festSky(f)
    + (info ? `<h3 class="sub">${esc(t('howKept'))}</h3><ol class="steps">${info.k.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : '')
    + remindButtons(f)
    + `<div class="actions"><button class="chip" onclick="festToCalendar('${f.key}','${f.day}')">${icon('calendar')} ${esc(t('addToCal'))}</button><button class="chip" onclick="closeSheet();openDay('${f.day}')">${esc(t('goToDay'))} ›</button></div>`);
}
/* Put one observance in the phone's calendar, at its puja time when it has one, else as a morning reminder. */
function festToCalendar(key, dayKey) {
  const f = findObs(key, dayKey); if (!f) return;
  const w = festWindow(vedicDay(f.day), f), a = w ? w.start : K.instant(f.day, '07:00', loc.zone), b = w ? w.end : new Date(+a + 36e5), info = Fe.infoOf(f, L.lang);
  const e = { id: 'f' + f.key + f.day.replace(/-/g, ''), title: L.festName(f), start: a.toISOString(), end: b.toISOString(), place: loc.name, tithi: info ? info.m : '', zone: loc.zone };
  haptic('success'); calendarExport(e);
}
/* Remind me: this one observance (keyed by festival and day). A vrat also offers "every Ekadashi", which is what an older
   build's Remind me meant (prefs.remind[key]), so those reminders keep working and now say so. */
const remindSet = () => prefs.remind || (prefs.remind = {});
function remindButtons(f) {
  const r = remindSet(), one = f.key + '|' + f.day, every = !!r[f.key], on = every || !!r[one];
  const b = (id, onNow, label, sub) => `<button class="remind${onNow ? ' on' : ''}" aria-pressed="${onNow}" onclick="toggleRemind('${id}','${f.key}','${f.day}')">${icon(onNow ? 'check' : 'bell')} ${esc(label)}<small>${esc(sub)}</small></button>`;
  return (every ? '' : b(one, on, on ? t('remindOn') : t('remindMe'), t('remindWhat')))
    + (f.kind === 'vrat' ? b(f.key, every, t('remindEvery', { f: L.festName(Object.assign({}, f, { en: (Fe.VRATS.find(v => v.key === f.key) || f).en })) }), t('remindEveryWhat')) : '');
}
function toggleRemind(id, key, dayKey) {
  const r = remindSet();
  if (r[id]) delete r[id]; else { r[id] = true; askNotifications(true); }
  persist(); haptic('select'); scheduleNative(true);
  festivalSheet(key, dayKey);
}
/* Small explanations, there when wanted: what a term means and what to do in it, with today's time when it has one. */
const TERM_INFO = { rahu: 'Rahu', yamaganda: 'Yama', gulika: 'Gulika', dur: 'Dur', bhadra: 'Bhadra', abhijit: 'Abhijit', brahma: 'Brahma' };
function termSheet(k) {
  const d = vedicDay(day), late = isToday() && now() > d.frame.sunset, per = d.periods;
  const p = k === 'brahma' && late ? vedicDay(K.addDay(day, 1)).periods.brahma : k === 'dur' ? (per.dur || [])[0] : per[k];
  const key = TERM_INFO[k], what = key ? t('info' + key) : t('term')[k] || '', todo = key ? (k === 'abhijit' && per.abhijit.wednesday ? t('notWednesday') : t('do' + key)) : '';
  sheet(key ? periodName(k) : k === 'amanta' ? t('monthSystem') : t(k), `<div class="eyebrow">${esc(t('whatItIs'))}</div>`,
    (p && p.start ? `<p class="value">${esc(span(p))}</p>` : '') + `<p class="leadline">${esc(what)}</p>` + (todo ? `<div class="pujabox"><small>${esc(t('whatToDo'))}</small><b>${esc(todo)}</b></div>` : ''));
}
function chogSheet(key) {
  sheet(L.chogName(key) + ' ' + t('choghadiya'), `<div class="eyebrow">${esc(L.nature(M.CHOG[key] ? level(P.CHOG_NATURE[key]) : 'neutral'))}</div>`,
    `<p class="leadline">${esc(t('infoChog', { planet: L.planetName(CHOG_LORD[key]) }))}</p><div class="pujabox"><small>${esc(t('whatToDo'))}</small><b>${esc(t('goodForX', { x: tr(M.CHOG[key].good) }))}</b></div><p class="caption">${esc(t('term').choghadiya)}</p>`);
}
/* A small ⓘ beside a term; it opens termSheet. */
const tip = (k, label) => `<button class="tip" onclick="termSheet('${k}')" aria-label="${esc(t('whatIsX', { x: label || t(k) }))}">${icon('info')}</button>`;
function practiceCard(d) {
  const chips = M.PRACTICES.map(p => `<button class="chip ${practice === p.key ? 'on' : ''}" aria-pressed="${practice === p.key}" onclick="practice=practice==='${p.key}'?null:'${p.key}';render()">${esc(L.practiceName(p))}</button>`).join('');
  const vaar = M.VAAR[d.frame.weekday];
  let body = `<p><strong>${esc(t('deityOfDay'))}:</strong> ${esc(tr(vaar.deity))}</p><p><strong>${esc(t('mantra'))}:</strong> ${esc(vaar.mantra)}</p>`;
  if (practice) {
    const p = M.PRACTICES.find(x => x.key === practice);
    if (p.vrat) {
      const v = observances(day, 40).find(x => x.kind === 'vrat' && x.day >= day);
      body += v ? `<p>${esc(L.festName(v))} · ${dayLabel(v.day)}${v.parana ? ' · ' + esc(t('parana')) + ' ' + dayLabel(v.parana.day) + ' ' + span(v.parana) : ''}</p>` : '';
    } else {
      const from = isToday() ? now() : d.frame.sunrise;
      const wins = P.goodWindows(d, from, { accept: c => p.chog.indexOf(c.key) >= 0 }).slice(0, 3);
      const horas = d.hora.filter(h => h.end > from && p.hora.indexOf(h.lord) >= 0 && !h.night && !P.overlaps(h, d.periods.rahu)).slice(0, 2);
      body += `<div class="timeline"><i class="dot good"></i><div><strong>${esc(t('choghadiya'))}</strong><p>${wins.length ? wins.map(w => span(w) + ' ' + esc(L.chogName(w.key))).join(' · ') : esc(t('none'))}</p></div></div>`
        + `<div class="timeline"><i class="dot good"></i><div><strong>${esc(t('hora'))}</strong><p>${horas.length ? horas.map(h => span(h) + ' ' + esc(L.planetName(h.lord))).join(' · ') : esc(t('none'))}</p></div></div>`
        + (p.brahma ? `<div class="timeline"><i class="dot good"></i><div><strong>${esc(t('brahma'))}</strong><p>${span(d.periods.brahma)}</p></div></div>` : '');
    }
  }
  return `<section class="section">${groupHead(t('ovPractice'), esc(t('whatToday')))}<div class="chipRow wrap">${chips}</div><div class="card">${body}</div></section>`;
}
const ord = n => L.lang === 'en' ? n + ['th', 'st', 'nd', 'rd'][n % 10 > 3 || [11, 12, 13].indexOf(n) >= 0 ? 0 : n % 10] : num(n);
/* The user's month at sunrise each day: favourable days (Chandrabalam and Tarabalam both strong) and Chandrashtama
   days (Moon 8th from the janma rashi). Same sunrise rule as the Calendar dots, so the list and the dots agree. */
const personalCache = new Map();
function monthPersonal(ym) {
  const bm = birthMoon(); if (bm == null) return null;
  // Today repaints every minute and asks for the next favourable day; a month of sunrises only changes with place or birth.
  const ck = [ym, bm, loc.lat, loc.lon, loc.zone].join('|');
  if (personalCache.has(ck)) return personalCache.get(ck);
  if (personalCache.size > 24) personalCache.clear();
  const out = monthPersonalCalc(ym, bm); personalCache.set(ck, out); return out;
}
function monthPersonalCalc(ym, bm) {
  const first = ym + '-01', count = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(), good = [], care = [];
  for (let i = 0; i < count; i++) {
    const key = K.addDay(first, i), r = K.dayData(key, loc).sunrise; if (!r) continue;
    const p = P.personal(bm, r);
    if (p.verdict === 'good') good.push({ key, p }); else if (p.chandraCount === 8) care.push({ key, p });
  }
  return { good, care };
}
function nextFavourable(from) {
  for (const ym of [from.slice(0, 7), K.addDay(from.slice(0, 7) + '-28', 7).slice(0, 7)]) {
    const m = monthPersonal(ym), hit = m && m.good.find(x => x.key > from);
    if (hit) return hit.key;
  }
  return null;
}
/* ref: the date the card speaks for (the selected day on Today, always today on You). */
function personalLine(d, ref) {
  ref = ref || day;
  const bm = birthMoon();
  if (bm == null) return `<button class="lesson" onclick="editProfile()"><div class="eyebrow">${esc(t('forYou'))}</div><h3>${esc(t('addBirth'))} <span aria-hidden="true">›</span></h3><span>${esc(t('favCtaShort'))}</span></button>`;
  const p = P.personal(bm, ref === todayKey() ? now() : d.frame.sunrise), next = nextFavourable(ref);
  return `<div class="card personalDay ${p.verdict}"><div class="row"><div class="eyebrow">${esc(t('forYou'))}</div>${badge(p.verdict)}</div><h2 style="margin-top:6px">${esc(verdictWord(p.verdict))}</h2>`
    + (p.chandraCount === 8 ? `<p class="care"><strong>${esc(t('chandrashtama'))}.</strong> ${esc(t('chandrashtamaLine', { rashi: L.rashiName(p.janmaRashi) }))}</p>` : `<p>${esc(t('chandrabalam'))}: ${esc(t('chandraLine', { n: ord(p.chandraCount), rashi: L.rashiName(p.janmaRashi) }))} · ${esc(t(p.chandraGood ? 'strong' : 'weak'))}</p>`)
    + `<p>${esc(t('tarabalam'))}: ${esc(tr(M.TARA[p.tara.key]))}</p>`
    + (next ? `<div class="row nextfav"><button class="quiet" onclick="setDay('${next}');show('today')">${esc(t('nextFav', { d: dayLabel(next) }))}</button><button class="quiet" onclick="show('calendar')">${esc(t('seeMonth'))} ›</button></div>` : '') + `</div>`;
}
/* The Moon's path through the twelve rashis as one rail, Mesha first: rashis already passed are filled, the one the
   Moon is in fills as far as it has gone, and the janma rashi is ringed. */
function rashiRail(r, frac, mine) {
  return `<div class="zrail" aria-hidden="true">${[...Array(12).keys()].map(i => `<i class="${i < r ? 'past' : ''}${i === r ? 'on' : ''}${i === mine ? ' mine' : ''}"${i === r ? ` style="--p:${Math.round(frac * 100)}%"` : ''}></i>`).join('')}</div>`;
}
/* Chandra rashi as a card in the Aakash/Deepa system: tonight's Moon, which rashi it is passing through (now on today,
   at sunrise on another day), until when, its path through the twelve, and what it supports. On Today it is the card
   alone; on You the personal line follows it. */
function rashiCard(d, onYou, onToday) {
  const at = onYou || isToday() ? now() : d.frame.sunrise, sid = P.moonSid(at), r = Math.floor(sid / 30), R = M.RASHI[r], nx = (r + 1) % 12;
  const end = P.crossing(P.moonSid, at, nx * 30, 72), bm = birthMoon(), p = bm != null ? P.personal(bm, at) : null;
  const endTxt = end ? (K.dateKey(end, loc.zone) === K.dateKey(at, loc.zone) ? fmt(end) : full(end)) : '';
  const label = p ? t('rashiRing', { rashi: L.rashiName(r), n: ord(p.chandraCount), mine: L.rashiName(p.janmaRashi) }) : t('rashiRingNoBirth', { rashi: L.rashiName(r) });
  return `<section class="section rashisec"><div class="card rashicard" role="group" aria-label="${esc(label)}">`
    + `<button class="rtop" onclick="push('moon')"><span class="rorb">${SomaDial.moon(52, K.tithi(at).angle)}</span>`
    + `<span class="rtext"><span class="eyebrow">${esc(t('ovMoonSign'))} · ${esc(t('rashiLord', { p: L.planetName(R.lord) }))}</span><h2>${esc(t('moonIn', { rashi: L.rashiName(r) }))}</h2>`
    + (end ? `<span class="runtil">${esc(t('rashiUntil', { time: endTxt, next: L.rashiName(nx) }))}</span>` : '') + `</span><span class="rchev" aria-hidden="true">›</span></button>`
    + rashiRail(r, (sid % 30) / 30, p ? p.janmaRashi : -1)
    + `<p class="rgood"><strong>${esc(t('goodFor'))}:</strong> ${esc(tr(R.good))}.</p></div>` + (onYou || onToday ? '' : personalLine(d)) + `</section>`;
}
/* The five limbs at sunrise, each with its end time, its rating in the one scale, and a ⓘ that says what it is. */
function limbsList(d) {
  const l = d.sunriseLimbs, ti = M.tithi(l.tithi.index), na = M.nakshatra(l.nakshatra.index), yo = M.YOGA[l.yoga.index], ka = M.KARANA[l.karana.index], va = M.VAAR[d.frame.weekday];
  const row = (k, name, end, note, nature) => `<div class="timeline"><i class="dot ${nature ? level(nature) : ''}" aria-hidden="true"></i><div><div class="eyebrow">${esc(t(k))}${tip(k)}</div><strong>${esc(name)}</strong><p>${esc(note)}</p></div><div class="right">${nature ? badge(level(nature)) : ''}${end ? '<br>' + esc(t('untilT', { time: full(end) })) : ''}</div></div>`;
  return `<div class="list">`
    + row('tithi', L.tithiName(l.tithi.index), l.tithi.end, tr(ti.deity) + ' · ' + tr(ti.group) + '. ' + tr(ti.note), ti.nature)
    + row('nakshatra', L.nakName(l.nakshatra.index) + ' ' + num(l.nakshatra.pada), l.nakshatra.end, tr(na.deity) + ' · ' + tr(na.group) + '. ' + t('goodForX', { x: tr(na.good) }), na.nature)
    + row('yoga', L.yogaName(l.yoga.index), l.yoga.end, yo.nature === 'bad' ? t('yogaBad') : t('yogaGood'), yo.nature)
    + row('karana', L.karanaName(l.karana.index), l.karana.end, l.karana.index === 6 ? t('bhadraNote') : t('halfTithi'), ka.nature)
    + row('vaar', L.vaarName(d.frame.weekday), null, t('vaarLine', { deity: tr(va.deity), good: tr(va.good), avoid: tr(va.avoid) }), null) + `</div>`;
}
/* Today, below the hero: the day's panchang in a glance (tithi, nakshatra, yoga, karana), one tap from the full page. */
function miniPanchang(d, v) {
  const l = d.sunriseLimbs, cell = (k, name, end, nature) => `<div class="pcell"><div class="caption">${esc(t(k))}${tip(k)}</div><b>${esc(name)}</b>${end ? `<small>${esc(until(end))}</small>` : ''}${nature ? `<i class="dot ${level(nature)}" aria-hidden="true"></i>` : ''}</div>`;
  return `<section class="section">${groupHead(t('ovPanchang'), esc(t('todayTitle')), `<button class="quiet more" onclick="push('panchang')">${esc(t('fullPanchang'))} ›</button>`)}<div class="card pcard">`
    + `<div class="pgrid">${cell('tithi', L.tithiName(l.tithi.index), l.tithi.end, M.tithi(l.tithi.index).nature)}${cell('nakshatra', L.nakName(l.nakshatra.index), l.nakshatra.end, M.nakshatra(l.nakshatra.index).nature)}`
    + `${cell('yoga', L.yogaName(l.yoga.index), l.yoga.end, M.YOGA[l.yoga.index].nature)}${cell('karana', L.karanaName(l.karana.index), l.karana.end, M.KARANA[l.karana.index].nature)}</div>`
    + `<p class="pline">${esc(daySentence(v))}</p></div></section>`;
}
function todayView() {
  const d = vedicDay(day), v = todayVerdict(d), cx = heroContext(d);
  const polar = d.frame.polar ? `<p class="notice card">${esc(t('polarNote'))}</p>` : '';
  // Phone: the Sky card and the dial fill one screen. Tablet and open foldables: the day's verdict and what is
  // coming up sit beside them, so the wide screen is used rather than scrolled.
  const dayCard = `<section class="card dayline"><div class="row"><span class="eyebrow">${esc(t('ovPanchang'))}</span><button class="quiet more" onclick="push('panchang')">${esc(t('fullPanchang'))} ›</button></div><p>${esc(daySentence(v))}</p></section>`;
  $('app').innerHTML = `<div class="split today"><div class="lead">${todayHero(d, v, cx)}</div><div class="rest">`
    + polar + paranaToday(day) + rashiCard(d, false, true)
    + `<div class="wideonly">${dayCard}${upcomingSection(todayKey().slice(0, 7), todayKey(), 3)}</div></div></div>`;
  scheduleNative();
  wxRequest();
}
/* The full panchang for the day, a page pushed over Today: verdict, the five limbs, deity and mantra, Moon. */
function panchangView() {
  const d = vedicDay(day), v = verdict(d);
  const lead = pageBar(t('todayTitle'), titleDay(day))
    + `<div class="card verdict"><p><strong>${esc(t('goodFor'))}:</strong> ${esc(v.good)}.</p><p><strong>${esc(t('avoid'))}:</strong> ${esc(v.avoid)}.</p></div>` + limbsList(d)
    + `<div style="margin-top:10px">${methodChip()}</div>`;
  const rest = practiceCard(d)
    + `<section class="section">${groupHead(t('ovSky'), esc(t('moon')), `<button class="quiet more" onclick="push('moon')">${esc(t('moon'))} ›</button>`)}<div class="grid2">`
    + [['moonrise', d.frame.data.moonrise], ['moonset', d.frame.data.moonset]].map(([k, v2]) => `<div class="card"><div class="caption">${esc(t(k))}</div><div class="value">${fmt(v2)}</div></div>`).join('') + '</div></section>'
    + `<section class="section"><button class="lesson" onclick="push('learn')"><h3>${esc(t('learnMore'))} <span aria-hidden="true">›</span></h3><span>${esc(t('learnSub'))}</span></button></section>`;
  $('app').innerHTML = `<div class="split"><div class="lead">${lead}</div><div class="rest">${rest}</div></div>`;
}

// ---- Calendar ---------------------------------------------------------------------------------
function changeMonth(n) { haptic('select'); const d = new Date(monthView + '-15T12:00Z'); d.setUTCMonth(d.getUTCMonth() + n); monthView = d.toISOString().slice(0, 7); calendarView(); }
function toggleSet(s) {
  const i = prefs.sets.indexOf(s);
  if (i >= 0) prefs.sets.splice(i, 1); else prefs.sets.push(s);
  prefs.custom = true; persist(); scheduleNative(true); render();
}
function setMonthSys(v) { prefs.month = v; prefs.monthChosen = true; persist(); haptic('select'); scheduleNative(true); if (onboardStep) onboard(onboardStep); else render(); }
function setChips(after) { return `<div class="chipRow wrap sets">${Fe.SETS.map(s => `<button class="chip ${prefs.sets.indexOf(s) >= 0 ? 'on' : ''}" aria-pressed="${prefs.sets.indexOf(s) >= 0}" onclick="toggleSet('${s}')${after ? ';' + after : ''}">${esc(t('sets')[s])}</button>`).join('')}</div>`; }
const PAKSHA = { en: ['Shukla', 'Krishna'], gu: ['સુદ', 'વદ'], hi: ['शुक्ल', 'कृष्ण'] };
const shortTithi = i => i === 14 || i === 29 ? L.tithiName(i) : PAKSHA[L.lang][i >= 15 ? 1 : 0] + ' ' + (i % 15 + 1);
/* Calendar: the month as a panchang. Each day carries its number, its moon and a mark (gold dot festival, green ring vrat,
   green corner your favourable day); the name shows where there is room. Tapping a day opens its panchang in a sheet on
   phones and in the side pane on wide screens. Below: your favourable days, what is coming up by week, and your plans. */
const wide = () => window.innerWidth >= 900;
function pickDay(key) { day = key; hour = null; haptic('select'); calendarView(); if (!wide()) daySheet(key); }
/* The lunar month, the way the panchang counts it: each paksha as fifteen Moons, the English date under each tithi.
   The month runs Shukla then Krishna (amanta) or Krishna then Shukla (purnimanta), as chosen in Settings. A tithi that
   rises on no sunrise (kshaya) is marked so; one that holds two sunrises (vriddhi) shows both dates. */
let lunarAt = null;
function setCalView(v) { prefs.calView = v === 'lunar' ? 'lunar' : 'month'; lunarAt = null; persist(); haptic('select'); calendarView(); }
function lunarMonth(key, tk) {
  const off = prefs.month === 'purnimanta' ? 15 : 0;
  const tiOf = k => { const data = K.dayData(k, loc); return data.atSunrise || K.tithi(K.instant(k, '12:00', loc.zone)); };
  const j = k => (tiOf(k).index - off + 30) % 30;
  // Start: the latest day on or before key where the count starts again (a lower slot than the day before).
  let start = key; for (let i = 0; i < 32; i++) { const prev = K.addDay(start, -1); if (j(start) < j(prev)) break; start = prev; }
  let end = start; for (let i = 0; i < 32; i++) { const nx = K.addDay(end, 1); if (j(nx) < j(end)) break; end = nx; }
  const slots = Array.from({ length: 30 }, () => []);
  for (let k = start; k <= end; k = K.addDay(k, 1)) slots[j(k)].push({ k, ti: tiOf(k) });
  const fest = observances(start, daysBetween(start, end) + 1);
  const mid = K.instant(K.addDay(start, 10), '12:00', loc.zone);
  const name = P.monthName(mid, prefs.month, L.monthNames), samvat = P.samvat(mid, samvatSystem());
  const short = k => new Intl.DateTimeFormat(locale(), { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(k + 'T12:00Z'));
  const dnum = k => num(+k.slice(8));
  let hasToday = false;
  const paksha = (from) => {
    const idx0 = (from + off) % 30, krishna = idx0 >= 15, list = slots.slice(from, from + 15);
    const days = list.flat(); const a = days[0] && days[0].k, b = days.length && days[days.length - 1].k;
    let cells = '';
    list.forEach((ds, i) => {
      const tIndex = (idx0 + i) % 30, label = i === 14 ? L.tithiName(tIndex) : num(i + 1);
      if (!ds.length) { cells += `<div class="lt kshaya" aria-label="${esc(L.tithiName(tIndex) + ' · ' + t('kshaya'))}">${SomaDial.moon(30, ((tIndex + 0.5) * 12) % 360)}<b>${esc(label)}</b><span>${esc(t('kshaya'))}</span></div>`; return; }
      // A tithi on two sunrises (vriddhi): the first tap opens its first date, a second tap its second.
      const k = ds[0].k, f = fest.filter(x => ds.some(d => d.k === x.day)), top = f.find(x => x.kind !== 'vrat') || f[0];
      if (ds.some(d => d.k === tk)) hasToday = true;
      const cls = (ds.some(d => d.k === day) ? ' selected' : '') + (ds.some(d => d.k === tk) ? ' today' : '') + (ds[ds.length - 1].k < tk ? ' gone' : '') + (top ? ' holy ' + top.kind : '');
      cells += `<button class="lt${cls}" onclick="lunarAt='${k}';pickDay('${ds.length > 1 && day === k ? ds[1].k : k}')" aria-label="${esc(L.tithiName(tIndex) + ' · ' + ds.map(d => dayLabel(d.k)).join(', ') + (f.length ? ' · ' + f.map(x => L.festName(x)).join(', ') : ''))}">${SomaDial.moon(30, ds[0].ti.angle)}<b>${esc(label)}</b><span>${ds.map(d => d.k === start || +d.k.slice(8) === 1 ? short(d.k) : dnum(d.k)).join(', ')}</span>${top ? `<em class="${top.kind === 'vrat' ? 'v' : 'f'}" aria-hidden="true"></em>` : ''}</button>`;
    });
    return `<section class="paksha"><div class="phead"><h2>${esc(t(krishna ? 'krishnaPaksha' : 'shuklaPaksha'))}</h2><span>${esc(t(krishna ? 'waningWord' : 'waxingWord'))}${a ? ' · ' + esc(short(a)) + ' – ' + esc(short(b)) : ''}</span></div><div class="lgrid">${cells}</div></section>`;
  };
  return { start, end, name, hasToday, sub: `${t('vsShort')} ${num(samvat)} · ${t(prefs.month === 'purnimanta' ? 'purnimantaShort' : 'amantaShort')}`, html: `<div class="lunar">${paksha(0)}${paksha(15)}</div>` };
}
function calendarView() {
  // In the lunar view, favourable days, Coming up and the month switch follow the lunar month on screen.
  const lm = prefs.calView === 'lunar' ? lunarMonth(lunarAt || day, todayKey()) : null;
  if (lm) monthView = K.addDay(lm.start, 7).slice(0, 7);
  const first = monthView + '-01', start = new Date(first + 'T12:00Z').getUTCDay(), count = new Date(+monthView.slice(0, 4), +monthView.slice(5), 0).getDate();
  const fest = observances(first, count + 1), bm = birthMoon(), tk = todayKey();
  let cells = '<span></span>'.repeat(start);
  for (let n = 1; n <= count; n++) {
    const key = monthView + '-' + String(n).padStart(2, '0'), data = K.dayData(key, loc), ti = data.atSunrise || K.tithi(K.instant(key, '12:00', loc.zone));
    const f = fest.filter(x => x.day === key), top = f.find(x => x.kind !== 'vrat') || f[0], vrat = f.some(x => x.kind === 'vrat');
    const pd = bm != null && data.sunrise ? P.personal(bm, data.sunrise).verdict : null;
    const special = ti.index === 14 ? ' purnima' : ti.index === 29 ? ' amas' : '';
    cells += `<button onclick="pickDay('${key}')" class="${key === day ? 'selected ' : ''}${key === tk ? 'today ' : ''}${key < tk ? 'gone ' : ''}${top ? 'holy ' + top.kind : ''}${vrat ? ' hasvrat' : ''}${pd === 'good' ? ' mine' : ''}${special}" aria-label="${dayLabel(key)} ${esc(L.tithiName(ti.index))}${f.length ? ' · ' + esc(f.map(x => L.festName(x)).join(', ')) : ''}${pd === 'good' ? ' · ' + esc(t('personalDays')) : ''}"${key === day ? ' aria-current="date"' : ''}><span class="n">${num(n)}</span>${SomaDial.moon(18, ti.angle)}<small>${esc(top ? L.festName(top) : shortTithi(ti.index))}</small>${top && top.kind !== 'vrat' ? '<em class="f" aria-hidden="true"></em>' : ''}${vrat ? '<em class="v" aria-hidden="true"></em>' : ''}</button>`;
  }
  const weekNames = [0, 1, 2, 3, 4, 5, 6].map(i => new Intl.DateTimeFormat(locale(), { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + i))));
  const last = monthView + '-' + count;
  const m1 = P.monthName(K.instant(first, '12:00', loc.zone), prefs.month, L.monthNames), m2 = P.monthName(K.instant(last, '12:00', loc.zone), prefs.month, L.monthNames);
  // The samvat can turn over inside a month (Gujarati New Year in Kartik): say both years then, so it matches Today on every day.
  const s1 = P.samvat(K.instant(first, '12:00', loc.zone), samvatSystem()), s2 = P.samvat(K.instant(last, '12:00', loc.zone), samvatSystem());
  const monthTitle = new Date(first + 'T12:00Z').toLocaleDateString(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const lunar = prefs.calView === 'lunar';
  const modeSeg = `<div class="calmode">${seg(t('calendar'), lunar ? 'lunar' : 'month', [['lunar', t('lunarView')], ['month', new Date(first + 'T12:00Z').toLocaleDateString(locale(), { month: 'long', timeZone: 'UTC' })]], 'setCalView')}</div>`;
  let lead;
  if (lunar) {
    lead = titleBar(esc(lm.name), `${esc(lm.sub)}`, `<div class="arrows">${lm.hasToday ? '' : `<button class="now" onclick="lunarAt=null;day=todayKey();monthView=day.slice(0,7);calendarView()">${esc(t('today2'))}</button>`}<button onclick="lunarAt=K.addDay('${lm.start}',-3);haptic('select');calendarView()" aria-label="${esc(t('prevMonth'))}">‹</button><button onclick="lunarAt=K.addDay('${lm.end}',3);haptic('select');calendarView()" aria-label="${esc(t('nextMonth'))}">›</button></div>`)
      + modeSeg + lm.html + `<div class="wideonly">${dayDetail(day)}</div>`;
  } else {
    lead = titleBar(esc(monthTitle), `${esc(m1 === m2 ? m1 : m1 + ' – ' + m2)} · ${esc(t('vsShort'))} ${num(s1)}${s2 !== s1 ? '–' + num(s2) : ''}`, `<div class="arrows">${monthView !== tk.slice(0, 7) ? `<button class="now" onclick="day=todayKey();monthView=day.slice(0,7);calendarView()">${esc(t('today2'))}</button>` : ''}<button onclick="changeMonth(-1)" aria-label="${esc(t('prevMonth'))}">‹</button><button onclick="changeMonth(1)" aria-label="${esc(t('nextMonth'))}">›</button></div>`)
      + modeSeg + `<div class="card calcard"><div class="week" aria-hidden="true">${weekNames.map(w => `<span>${esc(w)}</span>`).join('')}</div><div class="calendar">${cells}</div>`
      + `<div class="legend callegend" aria-hidden="true"><span class="fest"><i></i>${esc(t('ovFest'))}</span><span class="vrat"><i></i>${esc(t('vratWord'))}</span><span class="full"><i></i>${esc(t('fullNew'))}</span>${bm != null ? `<span class="mine"><i></i>${esc(t('personalDays'))}</span>` : ''}</div></div>`
      + `<div class="wideonly">${dayDetail(day)}</div>`;
  }
  const rest = favSection(monthView, tk) + upcomingSection(monthView, tk, 5)
    + `<section class="section">${groupHead(t('ovPlans'), esc(t('myPlans')), `<button class="quiet more" onclick="plan()">＋ ${esc(t('addEvent'))}</button>`)}${events.length ? `<div class="list">${events.slice().sort((a, b) => a.start.localeCompare(b.start)).map(e => `<div class="timeline"><i class="dot good"></i><div><strong>${esc(e.title)}</strong><p>${esc(dayLabel(e.day))} · ${esc(fmt(new Date(e.start)))} · ${esc(e.place)}</p><p>${esc(e.tithi)}${e.muhurat ? ' · ' + esc(e.muhurat) : ''}</p><button class="quiet" onclick="exportEvent('${e.id}')">${esc(t('addToCal'))}</button></div><div class="right"><button class="quiet x" aria-label="${esc(t('deleteEvent'))}: ${esc(e.title)}" onclick="deleteEvent('${e.id}')">×</button></div></div>`).join('')}</div>` : `<div class="card empty">${icon('calendar')}<div><h3>${esc(t('emptyPlansTitle'))}</h3><p>${esc(t('emptyPlansBody'))}</p></div></div>`}</section>`;
  $('app').innerHTML = `<div class="split cal"><div class="lead">${lead}</div><div class="rest">${rest}</div></div>`;
}
/* One day's panchang: limbs with end times, sun and moon, the day strip, its observances and plans, and where to go next. */
function dayDetail(key) {
  const d = vedicDay(key), l = d.sunriseLimbs, sel = observances(key, 1).filter(x => x.day === key), mine = events.filter(e => e.day === key);
  const cell = (k, name, end, nature) => `<div class="pcell"><div class="caption">${esc(t(k))}</div><b>${esc(name)}</b>${end ? `<small>${esc(until(end))}</small>` : ''}${nature ? `<i class="dot ${level(nature)}" aria-hidden="true"></i>` : ''}</div>`;
  const card = `<div class="card pcard"><div class="pgrid">${cell('tithi', L.tithiName(l.tithi.index), l.tithi.end, M.tithi(l.tithi.index).nature)}${cell('nakshatra', L.nakName(l.nakshatra.index), l.nakshatra.end, M.nakshatra(l.nakshatra.index).nature)}`
    + `${cell('yoga', L.yogaName(l.yoga.index), l.yoga.end, M.YOGA[l.yoga.index].nature)}${cell('karana', L.karanaName(l.karana.index), l.karana.end, M.KARANA[l.karana.index].nature)}`
    + `${cell('vaar', L.vaarName(d.frame.weekday))}${cell('month', P.monthName(d.frame.sunrise, prefs.month, L.monthNames))}</div>`
    + `<div class="psun"><span>${icon('sunrise')}<b>${esc(fmt(d.frame.sunrise))}</b></span><span>${icon('sunset')}<b>${esc(fmt(d.frame.sunset))}</b></span><span>${icon('moon')}<b>${esc(fmt(d.frame.data.moonrise))}</b></span></div>`
    + dayStrip(d, { half: 'day' }) + `</div>`;
  const list = sel.map(f => `<button type="button" class="timeline rowbtn" onclick="festivalSheet('${f.key}','${f.day}')"><i class="dot ${f.kind}" aria-hidden="true"></i><div><strong>${esc(L.festName(f))}</strong>${f.parana ? `<p>${esc(t('parana'))}: ${dayLabel(f.parana.day)} ${span(f.parana)}</p>` : festNote(f) ? `<p>${esc(festNote(f))}</p>` : ''}</div><span class="chev" aria-hidden="true">›</span></button>`).join('')
    + mine.map(e => `<div class="timeline"><i class="dot good"></i><div><strong>${esc(e.title)}</strong><p>${esc(fmt(new Date(e.start)))} · ${esc(e.muhurat)}</p></div></div>`).join('');
  return `${card}${list ? `<div class="list">${list}</div>` : ''}<div class="grid3" style="margin-top:10px"><button class="chip" onclick="closeSheet();openDay('${key}')">${esc(t('openToday'))}</button><button class="chip" onclick="closeSheet();day='${key}';muhuratTab='times';show('muhurat')">${esc(t('timings'))}</button><button class="chip on" onclick="day='${key}';plan()">＋ ${esc(t('addEvent'))}</button></div>`;
}
function daySheet(key) { sheet(titleDay(key), `<div class="eyebrow">${esc(key === todayKey() ? t('todayWord') : t('ovDay'))}</div>`, dayDetail(key)); }
/* What is coming: grouped by week, one row per day (two names on one date share a row). */
function upcomingSection(ym, tk, limit) {
  const thisMonth = ym === tk.slice(0, 7), from = thisMonth ? tk : ym + '-01', list = observances(from, thisMonth ? 35 : 31).filter(x => thisMonth || x.day.slice(0, 7) === ym);
  let byDay = []; list.forEach(f => { const g = byDay[byDay.length - 1]; if (g && g.day === f.day) g.items.push(f); else byDay.push({ day: f.day, items: [f] }); });
  // A short list where it sits beside other things (Calendar, Today on tablet); the whole run is one tap away, on its own page.
  const more = limit && byDay.length > limit ? `<button class="quiet more" onclick="festMonth='${ym}';push('festivals')">${esc(t('allFestivals'))} ›</button>` : '';
  if (limit) byDay = byDay.slice(0, limit);
  const weekOf = k => { const wd = new Date(k + 'T12:00Z').getUTCDay(); return K.addDay(k, -wd); }, w0 = weekOf(tk);
  const weekName = w => w === w0 ? t('thisWeek') : w === K.addDay(w0, 7) ? t('nextWeek') : t('weekOf', { d: dayLabel(w, { weekday: undefined }) });
  let html = '', cur = '';
  for (const g of byDay) {
    const w = weekOf(g.day); if (w !== cur) { if (cur) html += '</div>'; html += `<div class="weekhead">${esc(weekName(w))}</div><div class="list">`; cur = w; }
    const n = daysBetween(tk, g.day), main = g.items.find(x => x.kind !== 'vrat') || g.items[0];
    const when = n === 0 ? t('todayWord') : n === 1 ? t('tomorrow') : n > 1 ? t('inDays', { n: num(n) }) : '';
    html += `<button type="button" class="timeline rowbtn${g.day < tk ? ' gone' : ''}" onclick="festivalSheet('${main.key}','${g.day}')"><i class="dot ${main.kind}" aria-hidden="true"></i><div><strong>${esc(g.items.map(x => L.festName(x)).join(' · '))}</strong><p>${dayLabel(g.day)}${main.parana ? ' · ' + esc(t('parana')) + ' ' + span(main.parana) : ''}</p></div>${when ? `<span class="when">${esc(when)}</span>` : ''}<span class="chev" aria-hidden="true">›</span></button>`;
  }
  if (cur) html += '</div>';
  return `<section class="section">${groupHead(t('ovFest'), esc(thisMonth ? t('comingUp') : t('festIn', { m: new Date(ym + '-15T12:00Z').toLocaleDateString(locale(), { month: 'long', timeZone: 'UTC' }) })), more)}${html || `<p class="caption">${esc(t('none'))}</p>`}</section>`;
}

/* Every observance coming up, on its own page pushed over Calendar, with the festival filter at the top. */
let festMonth = null;
function festivalsView() {
  const tk = todayKey();
  // The month the short list came from, so "All festivals" shows the rows that list left out.
  $('app').innerHTML = `<div class="split"><div class="lead">${pageBar(t('allFestivals'))}<label>${esc(t('festivalSets'))}</label>${setChips()}</div><div class="rest">${upcomingSection(festMonth || tk.slice(0, 7), tk)}</div></div>`;
}
/* The month's favourable days for this user, and the Chandrashtama days to go gently; without birth details, the way in. */
function favSection(ym, tk) {
  const m = monthPersonal(ym), name = new Date(ym + '-15T12:00Z').toLocaleDateString(locale(), { month: 'long', timeZone: 'UTC' });
  const head = groupHead(t('ovForYou'), esc(t('favIn', { m: name })));
  if (!m) return `<section class="section">${head}<div class="card favcta"><h3>${esc(t('favCtaTitle'))}</h3><p>${esc(t('favCtaBody'))}</p><button class="primary" onclick="editProfile()">${esc(t('addBirth'))}</button></div></section>`;
  const chip = (x, cls) => `<button class="chip ${cls}${x.key < tk ? ' gone' : ''}${x.key === day ? ' on' : ''}" onclick="pickDay('${x.key}')" aria-label="${esc(dayLabel(x.key) + ' · ' + tr(M.TARA[x.p.tara.key]))}">${dayLabel(x.key, { month: undefined })}</button>`;
  return `<section class="section">${head}<div class="card favdays">`
    + (m.good.length ? `<div class="chipRow wrap">${m.good.map(x => chip(x, 'fav')).join('')}</div><p class="caption">${esc(t('favWhy'))}</p>` : `<p>${esc(t('favNone'))}</p>`)
    + (m.care.length ? `<div class="eyebrow" style="margin-top:12px">${esc(t('careDays'))}</div><div class="chipRow wrap">${m.care.map(x => chip(x, 'care')).join('')}</div>` : '')
    + `</div></section>`;
}

// ---- Muhurat ----------------------------------------------------------------------------------
/* Days in the next `days` that suit an event: nakshatra class, tithi group and weekday from the tradition, no bad yoga or Bhadra at sunrise. */
function muhuratDays(evKey, from, days) {
  // On today the result depends on the clock (a morning window that has passed drops out), so it is keyed by 10 minutes.
  return cached('mdays|' + evKey + '|' + from + '|' + days + '|' + locKey() + '|' + (from === todayKey() ? Math.floor(Clock.ms() / 6e5) : ''), () => muhuratDaysNow(evKey, from, days));
}
function muhuratDaysNow(evKey, from, days) {
  const ev = M.EVENTS.find(e => e.key === evKey), out = [];
  for (let i = 0; i < days && out.length < 8; i++) {
    const key = K.addDay(from, i), d = vedicDay(key), l = d.sunriseLimbs, ti = M.tithi(l.tithi.index), na = M.nakshatra(l.nakshatra.index);
    const group = M.GROUPS[l.tithi.index % 5];
    if (l.month.adhik || l.tithi.index === 29 || ev.avoidTithi.indexOf(group) >= 0 || ev.kinds.indexOf(na.kind) < 0 || ev.weekdays.indexOf(d.frame.weekday) < 0) continue;
    if (M.YOGA[l.yoga.index].nature === 'bad' || l.karana.index === 6) continue;
    // Kharmas (Sun in Dhanu or Meena) pauses sanskars and new homes; Chaturmas (Devshayani to Prabodhini Ekadashi) pauses griha pravesh and mundan.
    const sun = P.sunSid(d.frame.sunrise), m = l.month.index, ti0 = l.tithi.index;
    if (ev.kharmas !== false && ((sun >= 240 && sun < 270) || sun >= 330)) continue;
    if (ev.chaturmas && ((m === 3 && ti0 >= 10) || m === 4 || m === 5 || m === 6 || (m === 7 && ti0 < 10))) continue;
    // On today only windows still ahead count; a morning that has passed is no muhurat.
    const start = key === todayKey() ? new Date(Math.max(+d.frame.sunrise, +now())) : d.frame.sunrise;
    const win = P.goodWindows(d, start, { accept: c => !c.night && (c.key === 'amrit' || c.key === 'shubh' || c.key === 'labh') })[0];
    if (win) out.push({ key, d, win, why: [t('whyNak', { nak: L.nakName(l.nakshatra.index), kind: tr(na.group) }), t('whyTithi', { tithi: L.tithiName(l.tithi.index), kind: tr(ti.group) }), L.vaarName(d.frame.weekday)] });
  }
  return out;
}
/* The day's verdict from its panchang (tithi, nakshatra, yoga, karana at sunrise), and what holds now (nowState). */
function muhuratSummary(d) {
  const v = verdict(d), ns = isToday() ? nowState(now()) : null;
  const nowLine = ns ? (ns.kaal ? t('nowKaal', { kaal: periodName(ns.kaal.k), time: fmt(ns.kaal.end) }) : ns.c ? t('nowChog', { chog: L.chogName(ns.c.key), time: fmt(ns.until) }) : '') : '';
  return `<div class="card verdict msum"><div class="row"><span class="eyebrow">${esc(t('panchangShuddhi'))}</span>${badge(level(v.parva ? 'good' : v.nature))}</div>`
    + `<h2 style="margin:6px 0 4px">${esc(v.parva ? L.festName(v.festival) : vWord(v))}</h2>`
    + `<p><strong>${esc(t('goodFor'))}:</strong> ${esc(v.good)}.</p><p><strong>${esc(t('avoid'))}:</strong> ${esc(v.avoid)}.</p>`
    + (nowLine ? `<p class="nowchog"><i class="dot ${ns.level}" aria-hidden="true"></i>${esc(nowLine)}</p>` : '') + `</div>`;
}
/* Muhurat in two parts: Find (the event picker and its good days, the reason people open this tab) and Today's timings
   (the day board). A result opens a sheet with the date, the window, why in plain words, and what to do next. */
function setMuhuratTab(v) { muhuratTab = v === 'times' ? 'times' : 'find'; haptic('select'); render(); window.scrollTo(0, 0); }
function muhuratView() {
  const d = vedicDay(day);
  const tabs = `<div class="youtabs">${seg(t('muhurat'), muhuratTab, [['find', t('findTab')], ['times', t('timings')]], 'setMuhuratTab')}</div>`;
  if (muhuratTab === 'times') {
    const lead = titleBar(esc(t('muhurat')), '') + tabs + datebar() + muhuratSummary(d);
    const rest = dayBoard(d) + `<section class="section"><details class="fold"><summary>${icon('today', 'ri')}<b>${esc(t('hora'))}</b><span>24</span></summary><div class="list">${d.hora.map(h => { const live = isToday(), at = now(); return `<div class="timeline ${live && h.start <= at && at < h.end ? 'current' : live && h.end <= at ? 'past' : ''}"><i class="dot ${level(h.nature)}" aria-hidden="true"></i><div><strong>${esc(L.planetName(h.lord))}</strong><p>${esc(tr(M.PLANET[h.lord].good))}</p></div><div class="right">${span(h)}</div></div>`; }).join('')}</div></details></section>`;
    $('app').innerHTML = `<div class="split"><div class="lead">${lead}</div><div class="rest">${rest}</div></div>`;
    return;
  }
  const from = todayKey() > day ? todayKey() : day;
  mHits = muhuratDays(muhuratEvent, from, 60);
  // The occasion as chips (iOS/Material filter chips), not a dropdown: every choice is in view and one tap away.
  const evIcon = { griha: 'home', vehicle: 'car', business: 'shop', property: 'pin', learning: 'book', travel: 'plane', mundan: 'sparkle' };
  const lead = titleBar(esc(t('muhurat')), '') + tabs + `<div class="eyebrow occhead">${esc(t('eventType'))}</div><div class="chipRow occ" role="radiogroup" aria-label="${esc(t('eventType'))}">${M.EVENTS.map(e => `<button class="chip${e.key === muhuratEvent ? ' on' : ''}" role="radio" aria-checked="${e.key === muhuratEvent}" onclick="muhuratEvent='${e.key}';haptic('select');muhuratView()">${icon(evIcon[e.key] || 'muhurat')}${esc(tr(e.en).replace(/\s*[(（].*[)）]\s*$/, ''))}</button>`).join('')}</div>`
    + `<p class="caption" style="margin-top:10px">${esc(t('vivahNote'))}</p>`;
  const rest = `<section class="section first">${groupHead(t('ovPlan'), esc(t('goodDays')))}${mHits.length ? `<div class="list">${mHits.map((x, i) => `<button type="button" class="timeline rowbtn" onclick="muhuratSheet(${i})"><i class="dot good" aria-hidden="true"></i><div><strong>${dayLabel(x.key)}</strong><p>${span(x.win)} · ${esc(L.chogName(x.win.key))}</p>${muhuratEvent === 'travel' && wxStorm(x.key) ? `<p class="wxwarn">${esc(wxStorm(x.key))}</p>` : ''}</div><span class="chev" aria-hidden="true">›</span></button>`).join('')}</div>` : `<div class="card"><p>${esc(t('noGoodDays'))}</p></div>`}</section>`;
  $('app').innerHTML = `<div class="split"><div class="lead">${lead}</div><div class="rest">${rest}</div></div>`;
}
function muhuratSheet(i) {
  const x = mHits[i]; if (!x) return;
  const ev = M.EVENTS.find(e => e.key === muhuratEvent), st = muhuratEvent === 'travel' ? wxStorm(x.key) : '';
  sheet(titleDay(x.key), `<div class="eyebrow">${esc(tr(ev.en))}</div>`,
    `<div class="pujabox"><small>${esc(L.chogName(x.win.key))} ${esc(t('choghadiya'))}</small><b>${esc(span(x.win))}</b></div>`
    + `<h3 class="sub">${esc(t('whyGood'))}</h3><ul class="gets">${x.why.map(w => `<li>${esc(w)}</li>`).join('')}<li>${esc(t('whyClean'))}</li></ul>`
    + (muhuratEvent === 'griha' ? `<p class="caption">${esc(t('grihaDay'))}</p>` : '') + (st ? `<p class="wxwarn">${esc(st)}</p>` : '')
    + `<div class="actions"><button class="chip on" onclick="closeSheet();day='${x.key}';plan('${K.parts(x.win.start, loc.zone).hour}:${K.parts(x.win.start, loc.zone).minute}','${esc(tr(ev.en)).replace(/'/g, '')}')">＋ ${esc(t('planThis'))}</button><button class="chip" onclick="closeSheet();openDay('${x.key}')">${esc(t('openToday'))} ›</button></div>`);
}

// ---- Moon -------------------------------------------------------------------------------------
/* The Moon page's time of day: what the reader scrubbed to, else now on today and noon on any other day. */
function moonHour() {
  if (hour != null) return hour;
  if (!isToday()) return 12;
  const p = K.parts(now(), loc.zone);
  return Math.min(23.75, Math.floor((+p.hour + p.minute / 60) * 4) / 4);
}
/* The next new, first-quarter, full and last-quarter Moons after an instant, soonest first. */
function phasesAhead(d) {
  return [0, 90, 180, 270].map((a, i) => ({ name: L.tithiName([29, 7, 14, 22][i]), d: A.SearchMoonPhase(a, d, 32).date })).sort((a, b) => a.d - b.d)
    .map(e => `<div class="timeline"><i class="dot"></i><div><strong>${esc(e.name)}</strong></div><div class="right">${full(e.d)}</div></div>`).join('');
}
function moonView() {
  const h = moonHour(), live = hour == null && isToday();
  const d = live ? now() : K.instant(day, String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.round((h % 1) * 60)).padStart(2, '0'), loc.zone), ti = K.tithi(d), data = K.dayData(day, loc), illum = A.Illumination('Moon', d);
  const nk = P.nakshatra(d), rashi = Math.floor(P.moonSid(d) / 30);
  const lead = pageBar(L.tithiName(ti.index), titleDay(day)) + `<div class="moonbox" id="moonBox" role="img" aria-label="${esc(t('moonIllum'))} ${Math.round(illum.phase_fraction * 100)}%">${SomaDial.moon(260, ti.angle, 'big')}</div>`
    + `<div style="text-align:center"><h2 id="moonPct">${num(Math.round(illum.phase_fraction * 100))}%</h2><p id="moonNak">${esc(L.nakName(nk.index))} ${num(nk.pada)} · ${esc(L.rashiName(rashi))}</p></div>`
    + `<label><span id="scrubNow">${live ? esc(t('now')) + ' · ' : ''}</span><span id="scrubTime">${fmt(d)}</span><input aria-label="${esc(t('timeOfDay'))}" type="range" min="0" max="23.75" step="0.25" value="${h}" oninput="moonScrub(+this.value)"></label>${datebar()}`;
  const rest = `<div class="grid2"><div class="card"><div class="caption">${esc(t('moonrise'))}</div><div class="value">${fmt(data.moonrise)}</div></div><div class="card"><div class="caption">${esc(t('moonset'))}</div><div class="value">${fmt(data.moonset)}</div></div></div>`
    + `<section class="section">${groupHead(t('ovSky'), esc(t('phasesAhead')))}<div class="list" id="moonPhases">${phasesAhead(d)}</div></section>`;
  $('app').innerHTML = `<div class="split"><div class="lead">${lead}</div><div class="rest">${rest}</div></div>`;
}
/* Scrubbing the Moon page: only the Moon, its numbers and the time change in place, so the slider keeps its grip and
   nothing else on the page redraws while the finger moves. */
function moonScrub(h) {
  hour = h;
  const d = K.instant(day, String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.round((h % 1) * 60)).padStart(2, '0'), loc.zone);
  const ti = K.tithi(d), pct = Math.round(A.Illumination('Moon', d).phase_fraction * 100), nk = P.nakshatra(d), rashi = Math.floor(P.moonSid(d) / 30);
  const box = $('moonBox'); if (!box) return;
  box.innerHTML = SomaDial.moon(260, ti.angle, 'big'); box.setAttribute('aria-label', t('moonIllum') + ' ' + pct + '%');
  $('moonPct').textContent = num(pct) + '%';
  $('moonNak').textContent = L.nakName(nk.index) + ' ' + num(nk.pada) + ' · ' + L.rashiName(rashi);
  $('scrubTime').textContent = fmt(d); $('scrubNow').textContent = '';
  const ph = $('moonPhases'), html = phasesAhead(d); if (ph && ph.innerHTML !== html) ph.innerHTML = html;
  const bar = document.querySelector('#app .lead > h1'); if (bar && bar.textContent !== L.tithiName(ti.index)) bar.textContent = L.tithiName(ti.index);
}

// ---- Learn (Gyan) -----------------------------------------------------------------------------
/* Gyan: short lessons, written in each language (not machine-glued), so a Gujarati reader never meets an English page. */
const lessons = [
  { tag: "tagPanchang", src: "https://packolkata.imd.gov.in/panchang/en/preface", title: {"en": "Tithi, the lunar day", "gu": "તિથિ: ચંદ્રનો દિવસ", "hi": "तिथि: चंद्र दिवस"}, body: { en: ["A tithi is the time the Moon takes to move 12° ahead of the Sun. There are 30 in a lunar month: 15 in Shukla paksha as the Moon grows and 15 in Krishna paksha as it wanes. The tithi at sunrise, the udaya tithi, governs the day.", "Tithis fall in five families that repeat: Nanda (joy), Bhadra (steady), Jaya (victory), Rikta (empty) and Purna (complete). Rikta tithis, Chaturthi, Navami and Chaturdashi, are kept for clearing obstacles rather than new beginnings."], gu: ["તિથિ એટલે ચંદ્રને સૂર્યથી 12° આગળ જતાં લાગતો સમય. ચાંદ્ર માસમાં 30 તિથિ હોય છે: ચંદ્ર વધે ત્યારે સુદ પક્ષની 15 અને ઘટે ત્યારે વદ પક્ષની 15. સૂર્યોદય સમયે ચાલતી તિથિ, એટલે ઉદય તિથિ, આખા દિવસની તિથિ ગણાય છે.", "તિથિઓ પાંચ કુળમાં વારાફરતી આવે છે: નંદા (આનંદ), ભદ્રા (સ્થિરતા), જયા (વિજય), રિક્તા (ખાલી) અને પૂર્ણા (પૂર્ણતા). રિક્તા તિથિઓ, એટલે ચોથ, નોમ અને ચૌદશ, નવી શરૂઆત માટે નહીં પણ વિઘ્ન દૂર કરવા માટે રાખવામાં આવે છે."], hi: ["तिथि वह समय है जिसमें चंद्रमा सूर्य से 12° आगे बढ़ता है। चांद्र मास में 30 तिथियाँ होती हैं: चंद्रमा के बढ़ते समय शुक्ल पक्ष की 15 और घटते समय कृष्ण पक्ष की 15। सूर्योदय के समय चल रही तिथि, यानी उदया तिथि, पूरे दिन की तिथि मानी जाती है।", "तिथियाँ पाँच वर्गों में बार-बार आती हैं: नंदा (आनंद), भद्रा (स्थिरता), जया (विजय), रिक्ता (रिक्त) और पूर्णा (पूर्णता)। रिक्ता तिथियाँ, यानी चतुर्थी, नवमी और चतुर्दशी, नई शुरुआत के लिए नहीं बल्कि बाधाएँ दूर करने के लिए रखी जाती हैं।"] } },
  { tag: "tagPanchang", src: "", title: {"en": "The 27 nakshatras", "gu": "સત્તાવીસ નક્ષત્ર", "hi": "27 नक्षत्र"}, body: { en: ["The Moon passes through 27 nakshatras, each ruled by a deity. The nakshatra of the day shapes what work it suits: fixed (Dhruva) stars for foundations and griha pravesh, movable (Chara) stars for travel and vehicles, swift (Kshipra) stars for trade and medicine, gentle (Mridu) stars for arts and relationships.", "Fierce (Ugra) and sharp (Tikshna) nakshatras are avoided for ceremonies. Your janma nakshatra, the Moon’s nakshatra at birth, is the basis of Tarabalam."], gu: ["ચંદ્ર 27 નક્ષત્રોમાંથી પસાર થાય છે, અને દરેક નક્ષત્રના એક દેવતા છે. દિવસનું નક્ષત્ર નક્કી કરે છે કે કયું કામ શુભ છે: ધ્રુવ (સ્થિર) નક્ષત્ર પાયો અને ગૃહપ્રવેશ માટે, ચર નક્ષત્ર પ્રવાસ અને વાહન માટે, ક્ષિપ્ર નક્ષત્ર વેપાર અને ઔષધ માટે, મૃદુ નક્ષત્ર કલા અને સંબંધો માટે.", "ઉગ્ર અને તીક્ષ્ણ નક્ષત્રમાં શુભ પ્રસંગ ટાળવામાં આવે છે. તમારું જન્મ નક્ષત્ર, એટલે જન્મ સમયે ચંદ્રનું નક્ષત્ર, તારાબળનો આધાર છે."], hi: ["चंद्रमा 27 नक्षत्रों से होकर गुज़रता है, और हर नक्षत्र के एक देवता हैं। दिन का नक्षत्र बताता है कि कौन-सा काम शुभ है: ध्रुव (स्थिर) नक्षत्र नींव और गृह प्रवेश के लिए, चर नक्षत्र यात्रा और वाहन के लिए, क्षिप्र नक्षत्र व्यापार और औषधि के लिए, मृदु नक्षत्र कला और संबंधों के लिए।", "उग्र और तीक्ष्ण नक्षत्रों में संस्कार टाले जाते हैं। आपका जन्म नक्षत्र, यानी जन्म के समय चंद्रमा का नक्षत्र, ताराबल का आधार है।"] } },
  { tag: "tagMuhurat", src: "", title: {"en": "Choghadiya and Hora", "gu": "ચોઘડિયું અને હોરા", "hi": "चौघड़िया और होरा"}, body: { en: ["The day from sunrise to sunset and the night from sunset to the next sunrise are each split into eight Choghadiyas. Amrit, Shubh and Labh are auspicious, Char is good for travel, and Udveg, Kaal and Rog are avoided for new work.", "Hora divides the day and night into twelve parts each, ruled in turn by the seven grahas starting with the lord of the weekday. Choose a Jupiter, Venus, Mercury or Moon hora for good work. Rahu Kaal, Yamaganda and Gulika are eighths of the daytime set aside each weekday. On the Today dial the coloured ring is the Choghadiya (a full band is shubh, a thin band is avoid), the dotted inner band is Rahu Kaal and the hand is now."], gu: ["સૂર્યોદયથી સૂર્યાસ્ત સુધીનો દિવસ અને સૂર્યાસ્તથી બીજા સૂર્યોદય સુધીની રાત, બંનેનાં આઠ આઠ ચોઘડિયાં થાય છે. અમૃત, શુભ અને લાભ શુભ ગણાય છે, ચલ પ્રવાસ માટે સારું છે, અને ઉદ્વેગ, કાળ અને રોગમાં નવું કામ ટાળવામાં આવે છે.", "હોરા દિવસ અને રાતને બાર બાર ભાગમાં વહેંચે છે, અને વારના સ્વામીથી શરૂ કરીને સાત ગ્રહો વારાફરતી તેના સ્વામી બને છે. સારા કામ માટે ગુરુ, શુક્ર, બુધ કે ચંદ્રની હોરા પસંદ કરો. રાહુ કાળ, યમઘંટ અને ગુલિક દરેક વારે દિવસના આઠમા ભાગ જેટલા સમય માટે ટાળવામાં આવે છે. આજના ચક્રમાં રંગીન વર્તુળ ચોઘડિયું છે (પહોળી પટ્ટી શુભ, પાતળી પટ્ટી ટાળવા જેવું), અંદરની ટપકાંવાળી પટ્ટી રાહુ કાળ છે અને કાંટો અત્યારનો સમય બતાવે છે."], hi: ["सूर्योदय से सूर्यास्त तक का दिन और सूर्यास्त से अगले सूर्योदय तक की रात, दोनों आठ-आठ चौघड़ियों में बँटते हैं। अमृत, शुभ और लाभ शुभ माने जाते हैं, चर यात्रा के लिए अच्छा है, और उद्वेग, काल और रोग में नया काम टाला जाता है।", "होरा दिन और रात को बारह-बारह भागों में बाँटता है, और वार के स्वामी से शुरू होकर सात ग्रह बारी-बारी से इसके स्वामी होते हैं। शुभ काम के लिए गुरु, शुक्र, बुध या चंद्र की होरा चुनें। राहु काल, यमगण्ड और गुलिक हर वार दिन के आठवें भाग के बराबर समय के लिए टाले जाते हैं। आज के चक्र में रंगीन वृत्त चौघड़िया है (चौड़ी पट्टी शुभ, पतली पट्टी टालने योग्य), भीतर की बिंदीदार पट्टी राहु काल है और सुई अभी का समय दिखाती है।"] } },
  { tag: "tagVrat", src: "", title: {"en": "Ekadashi and parana", "gu": "અગિયારસ અને પારણાં", "hi": "एकादशी और पारण"}, body: { en: ["Ekadashi, the eleventh tithi of each paksha, is kept as a fast for Vishnu. Soma follows the sunrise rule: the fast is kept on the day Ekadashi prevails at sunrise.", "The fast is broken (parana) on Dwadashi after sunrise, after Hari Vasara (the first quarter of Dwadashi) has passed, ideally in the morning and always before Dwadashi ends. Soma shows this window for your city."], gu: ["અગિયારસ, દરેક પક્ષની અગિયારમી તિથિ, વિષ્ણુ માટે ઉપવાસનો દિવસ છે. સોમ ઉદય તિથિનો નિયમ અનુસરે છે: જે દિવસે સૂર્યોદયે અગિયારસ હોય તે દિવસે ઉપવાસ થાય છે.", "ઉપવાસ બારસે સૂર્યોદય પછી છોડાય છે (પારણાં), હરિ વાસર (બારસનો પહેલો ચોથો ભાગ) પૂરો થયા પછી, શક્ય હોય તો સવારે અને હંમેશાં બારસ પૂરી થાય તે પહેલાં. સોમ તમારા શહેર માટે આ સમય બતાવે છે."], hi: ["एकादशी, हर पक्ष की ग्यारहवीं तिथि, विष्णु के लिए व्रत का दिन है। सोम उदया तिथि का नियम मानता है: जिस दिन सूर्योदय पर एकादशी हो, उस दिन व्रत रखा जाता है।", "व्रत द्वादशी को सूर्योदय के बाद खोला जाता है (पारण), हरि वासर (द्वादशी का पहला चौथाई भाग) बीतने के बाद, हो सके तो सुबह और हमेशा द्वादशी समाप्त होने से पहले। सोम आपके शहर के लिए यह समय दिखाता है।"] } },
  { tag: "tagCalendar", src: "", title: {"en": "Amanta and Purnimanta", "gu": "અમાંત અને પૂર્ણિમાંત", "hi": "अमांत और पूर्णिमांत"}, body: { en: ["In Gujarat, Maharashtra and the South a lunar month ends at Amavasya (amanta). In North India it ends at Purnima (purnimanta), so the Krishna paksha carries the next month’s name. The festival falls on the same day either way; only the month name differs.", "Every few years an adhik (extra) month keeps the lunar year in step with the seasons. Festivals are not celebrated in an adhik month. Choose your month system in Settings."], gu: ["ગુજરાત, મહારાષ્ટ્ર અને દક્ષિણ ભારતમાં ચાંદ્ર માસ અમાસે પૂરો થાય છે (અમાંત). ઉત્તર ભારતમાં તે પૂનમે પૂરો થાય છે (પૂર્ણિમાંત), એટલે વદ પક્ષને આવતા મહિનાનું નામ મળે છે. તહેવાર બંને રીતે એક જ દિવસે આવે છે; ફક્ત મહિનાનું નામ બદલાય છે.", "થોડાં વર્ષે એક અધિક માસ આવે છે, જે ચાંદ્ર વર્ષને ઋતુઓ સાથે મેળમાં રાખે છે. અધિક માસમાં તહેવાર ઉજવાતા નથી. તમારી માસ પદ્ધતિ સેટિંગ્સમાં પસંદ કરો."], hi: ["गुजरात, महाराष्ट्र और दक्षिण भारत में चांद्र मास अमावस्या पर समाप्त होता है (अमांत)। उत्तर भारत में यह पूर्णिमा पर समाप्त होता है (पूर्णिमांत), इसलिए कृष्ण पक्ष को अगले महीने का नाम मिलता है। पर्व दोनों पद्धतियों में एक ही दिन पड़ता है; केवल महीने का नाम बदलता है।", "कुछ वर्षों में एक अधिक मास आता है, जो चांद्र वर्ष को ऋतुओं के साथ बनाए रखता है। अधिक मास में पर्व नहीं मनाए जाते। अपनी मास पद्धति सेटिंग्स में चुनें।"] } },
  { tag: "tagVrat", src: "", title: {"en": "Grahan and sutak", "gu": "ગ્રહણ અને સૂતક", "hi": "ग्रहण और सूतक"}, body: { en: ["Soma lists lunar and solar eclipses that are visible from your city. Sutak traditionally begins nine hours before a lunar eclipse and twelve hours before a solar eclipse; food is not cooked and temples close until the eclipse ends.", "After the eclipse, bathe, offer charity and resume puja."], gu: ["સોમ તમારા શહેરથી દેખાતાં ચંદ્ર અને સૂર્ય ગ્રહણ બતાવે છે. પરંપરા મુજબ સૂતક ચંદ્ર ગ્રહણના નવ કલાક પહેલાં અને સૂર્ય ગ્રહણના બાર કલાક પહેલાં શરૂ થાય છે; ગ્રહણ પૂરું થાય ત્યાં સુધી રસોઈ થતી નથી અને મંદિર બંધ રહે છે.", "ગ્રહણ પછી સ્નાન કરો, દાન આપો અને પૂજા ફરી શરૂ કરો."], hi: ["सोम आपके शहर से दिखने वाले चंद्र और सूर्य ग्रहण दिखाता है। परंपरा के अनुसार सूतक चंद्र ग्रहण से नौ घंटे पहले और सूर्य ग्रहण से बारह घंटे पहले शुरू होता है; ग्रहण समाप्त होने तक भोजन नहीं पकाया जाता और मंदिर बंद रहते हैं।", "ग्रहण के बाद स्नान करें, दान दें और पूजा फिर से शुरू करें।"] } },
  { tag: "tagJyotish", src: "https://github.com/svarbhanu/grahan", title: {"en": "Your birth sky", "gu": "તમારું જન્મ આકાશ", "hi": "आपका जन्म आकाश"}, body: { en: ["Your janma rashi and nakshatra come from the Moon’s sidereal position at your birth. Each day Soma compares today’s Moon with them: Chandrabalam is strong when the Moon is 1st, 3rd, 6th, 7th, 10th or 11th from your rashi, and Tarabalam counts the nakshatras from yours in groups of nine.", "Sampat, Kshema, Sadhana, Mitra and Param Mitra taras are supportive; Vipat, Pratyari and Naidhana call for care."], gu: ["તમારી જન્મ રાશિ અને જન્મ નક્ષત્ર જન્મ સમયે ચંદ્રની નિરયન સ્થિતિ પરથી નક્કી થાય છે. સોમ દરરોજ આજના ચંદ્રને તેની સાથે સરખાવે છે: ચંદ્ર તમારી રાશિથી 1, 3, 6, 7, 10 કે 11મા સ્થાને હોય ત્યારે ચંદ્રબળ બળવાન હોય છે, અને તારાબળ તમારા નક્ષત્રથી નવ નવના સમૂહમાં ગણાય છે.", "સંપત, ક્ષેમ, સાધના, મિત્ર અને પરમ મિત્ર તારા સાથ આપે છે; વિપત, પ્રત્યરિ અને નૈધન તારામાં સાવધાની રાખવી."], hi: ["आपकी जन्म राशि और जन्म नक्षत्र जन्म के समय चंद्रमा की निरयन स्थिति से तय होते हैं। सोम हर दिन आज के चंद्रमा की उनसे तुलना करता है: चंद्रमा आपकी राशि से 1, 3, 6, 7, 10 या 11वें स्थान पर हो तो चंद्रबल बलवान होता है, और ताराबल आपके नक्षत्र से नौ-नौ के समूहों में गिना जाता है।", "संपत, क्षेम, साधना, मित्र और परम मित्र तारे सहयोगी हैं; विपत, प्रत्यरि और नैधन तारों में सावधानी रखें।"] } },
  { tag: "tagAnk", src: "", title: {"en": "Mulank and Bhagyank", "gu": "મૂળાંક અને ભાગ્યાંક", "hi": "मूलांक और भाग्यांक"}, body: { en: ["Mulank is the sum of the digits of your birth day reduced to one digit. Bhagyank is the sum of all digits of your full birth date, reduced the same way.", "Soma uses single-digit reduction without master numbers."], gu: ["મૂળાંક એટલે જન્મ તારીખના અંકોનો સરવાળો, એક અંક સુધી ઘટાડેલો. ભાગ્યાંક એટલે આખી જન્મ તારીખના બધા અંકોનો સરવાળો, એ જ રીતે ઘટાડેલો.", "સોમ માસ્ટર અંક વગર એક અંક સુધી ઘટાડે છે."], hi: ["मूलांक जन्म की तारीख के अंकों का योग है, एक अंक तक घटाया हुआ। भाग्यांक पूरी जन्म तिथि के सभी अंकों का योग है, उसी तरह घटाया हुआ।", "सोम मास्टर अंकों के बिना एक अंक तक घटाता है।"] } },
  { tag: "tagMethod", src: "https://github.com/cosinekitty/astronomy", title: {"en": "How Soma calculates", "gu": "સોમ કેવી રીતે ગણે છે", "hi": "सोम कैसे गणना करता है"}, body: { en: ["Soma is a Drik (computed) panchang. Astronomy Engine 2.1.19 finds the Sun and Moon offline; sidereal positions use the Lahiri ayanamsa (linear approximation). Sunrise uses the standard refracted horizon at sea level for the city you choose, so times can differ by a minute or two from a printed panchang made for another town.", "Festival dates follow the common rules for each observance (udaya tithi, pradosh, nishita, madhyahna, aparahna, moonrise) for your own place and time zone; families and sampradayas sometimes follow a different rule, so a date can differ by a day from your local almanac. The muhurat finder checks nakshatra, tithi, weekday, yoga and Bhadra, and skips Kharmas (and Chaturmas for griha pravesh and mundan); it does not yet check Guru or Shukra asta. City search uses an offline list of places from GeoNames. Plans, birth details and settings stay on this phone; there is no account, advertising or tracking."], gu: ["સોમ દૃક્ (ગણિત આધારિત) પંચાંગ છે. Astronomy Engine 2.1.19 ઑફલાઇન સૂર્ય અને ચંદ્રની સ્થિતિ શોધે છે; નિરયન સ્થિતિ લાહિરી અયનાંશ (રેખીય અંદાજ) પ્રમાણે છે. સૂર્યોદય તમે પસંદ કરેલા શહેર માટે, સમુદ્ર સપાટીએ પ્રમાણભૂત વક્રીભવન સાથે ગણાય છે, એટલે બીજા ગામ માટે છપાયેલા પંચાંગથી સમય એક બે મિનિટ જુદો પડી શકે.", "તહેવારની તારીખ દરેક ઉત્સવના સામાન્ય નિયમ (ઉદય તિથિ, પ્રદોષ, નિશીથ, મધ્યાહ્ન, અપરાહ્ન, ચંદ્રોદય) મુજબ તમારા સ્થળ અને સમય વિસ્તાર માટે ગણાય છે; કેટલાંક કુટુંબ અને સંપ્રદાય જુદો નિયમ પાળે છે, એટલે તારીખ તમારા સ્થાનિક પંચાંગથી એક દિવસ જુદી પડી શકે. મુહૂર્ત શોધક નક્ષત્ર, તિથિ, વાર, યોગ અને ભદ્રા તપાસે છે, અને કમૂરતાં (અને ગૃહપ્રવેશ તથા મુંડન માટે ચાતુર્માસ) છોડી દે છે; ગુરુ કે શુક્રનો અસ્ત હજી તપાસતો નથી. શહેર શોધ GeoNames ની ઑફલાઇન યાદી વાપરે છે. કાર્યક્રમ, જન્મ વિગત અને સેટિંગ્સ આ ફોનમાં જ રહે છે; કોઈ ખાતું, જાહેરાત કે ટ્રેકિંગ નથી."], hi: ["सोम दृक् (गणना आधारित) पंचांग है। Astronomy Engine 2.1.19 ऑफ़लाइन सूर्य और चंद्रमा की स्थिति निकालता है; निरयन स्थिति लाहिरी अयनांश (रेखीय अनुमान) से है। सूर्योदय आपके चुने शहर के लिए, समुद्र तल पर मानक अपवर्तन के साथ गिना जाता है, इसलिए किसी दूसरे नगर के छपे पंचांग से समय एक-दो मिनट अलग हो सकता है।", "पर्व की तिथि हर उत्सव के सामान्य नियम (उदया तिथि, प्रदोष, निशीथ, मध्याह्न, अपराह्न, चंद्रोदय) के अनुसार आपके स्थान और समय क्षेत्र के लिए निकाली जाती है; कुछ परिवार और संप्रदाय अलग नियम मानते हैं, इसलिए तिथि आपके स्थानीय पंचांग से एक दिन अलग हो सकती है। मुहूर्त खोज नक्षत्र, तिथि, वार, योग और भद्रा देखती है, और खरमास (तथा गृह प्रवेश और मुंडन के लिए चातुर्मास) छोड़ देती है; गुरु या शुक्र अस्त अभी नहीं देखती। शहर खोज GeoNames की ऑफ़लाइन सूची से होती है। योजनाएँ, जन्म विवरण और सेटिंग्स इसी फ़ोन में रहते हैं; कोई खाता, विज्ञापन या ट्रैकिंग नहीं है।"] } }
];
const lessonTitle = l => l.title[L.lang] || l.title.en;
const lessonBody = l => l.body[L.lang] || l.body.en;
/* Learn: lessons grouped by topic, each a clear title with a one-line promise (no cut-off previews). */
function learnView() {
  const tags = []; lessons.forEach(l => { if (tags.indexOf(l.tag) < 0) tags.push(l.tag); });
  $('app').innerHTML = pageBar(t('learnMore'), t('learnSub')) + tags.map(tg => `<section class="section">${groupHead('', esc(t(tg)))}<div class="group rows">`
    + lessons.map((l, i) => l.tag === tg ? `<button onclick="lesson(${i})">${icon('book', 'ri')}<b>${esc(lessonTitle(l))}</b><span><i aria-hidden="true">›</i></span></button>` : '').join('') + `</div></section>`).join('');
}
/* Sheets: one ✕ beside the title, swipe down or tap outside to close, and focus lands on the sheet itself (no ring on ✕). */
function modal(html) {
  $('dialogBody').innerHTML = html; const m = $('modal');
  if (!m.open) { m.showModal(); haptic('select'); }
  m.style.transform = ''; m.scrollTop = 0; try { m.focus({ preventScroll: true }); } catch (e) {}
}
function sheet(title, eyebrow, body) { modal(`<div class="sheethead">${eyebrow || ''}<h2 id="sheetTitle">${esc(title)}</h2></div>${body}`); }
function closeSheet() { const m = $('modal'); if (m.open) m.close(); }
(function sheetGestures() {
  const m = $('modal'); m.setAttribute('tabindex', '-1');
  m.addEventListener('click', e => { if (e.target !== m) return; const r = m.getBoundingClientRect(); if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) closeSheet(); });
  let y0 = null, dy = 0;
  m.addEventListener('touchstart', e => { y0 = m.scrollTop <= 0 && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  m.addEventListener('touchmove', e => { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy > 0) { m.style.transition = 'none'; m.style.transform = `translateY(${dy}px)`; } }, { passive: true });
  m.addEventListener('touchend', () => { if (y0 == null) return; m.style.transition = ''; m.style.transform = ''; if (dy > 110) closeSheet(); y0 = null; });
})();
function lesson(i) { const l = lessons[i], b = lessonBody(l); sheet(lessonTitle(l), `<div class="eyebrow">${esc(t(l.tag))}</div>`, `<p class="leadline">${esc(b[0])}</p><p>${esc(b[1])}</p>${l.src ? `<a href="${l.src}">${esc(t('readSource'))}</a>` : ''}`); }

// ---- Places: search instead of coordinates -----------------------------------------------------
const placeHits = { loc: [], birth: [] };
const pickedHtml = (name, sub) => `<div class="picked">${icon('pin')}<div>${esc(name)}${sub ? `<small>${esc(sub)}</small>` : ''}</div></div>`;
/* A type-ahead field. kind 'loc' saves the place the moment it is picked; kind 'birth' fills the birth form. */
function placeField(kind, current) {
  return `<input id="${kind}Query" type="search" inputmode="search" autocomplete="off" placeholder="${esc(t('searchCity'))}" oninput="placeSearch(this.value,'${kind}')"><div class="results" id="${kind}Results"></div><div id="${kind}Picked">${current ? pickedHtml(current) : ''}</div>`;
}
/* The gazetteer is 2.8 MB, so it loads the first time someone searches or uses GPS, never at launch. */
let placesWait = null;
function needPlaces(then) {
  if (window.Places) { then(); return; }
  if (!placesWait) {
    placesWait = [];
    const sc = document.createElement('script'); sc.src = 'places.js';
    sc.onload = () => { const q = placesWait; placesWait = null; q.forEach(f => f()); };
    sc.onerror = () => { placesWait = null; toast(t('locFailed')); };
    document.head.appendChild(sc);
  }
  placesWait.push(then);
}
function placeSearch(q, kind) {
  if (!window.Places) { needPlaces(() => placeSearch($(kind + 'Query') ? $(kind + 'Query').value : q, kind)); return; }
  const hits = Places.search(q, 6); placeHits[kind] = hits;
  const out = $(kind + 'Results'); if (!out) return;
  out.innerHTML = q.trim() ? (hits.length ? hits.map((h, i) => `<button type="button" onclick="pickPlace(${i},'${kind}')"><b>${esc(h.name)}</b><small>${esc([h.state, h.country].filter(Boolean).join(', '))}</small></button>`).join('') : `<p>${esc(t('noMatch'))}</p>`) : '';
}
function pickPlace(i, kind) {
  const h = placeHits[kind][i]; if (!h) return;
  haptic('select');
  const set = (id, v) => { if ($(id)) $(id).value = v; };
  if (kind === 'loc') { set('place', h.name); set('lat', h.lat); set('lon', h.lon); set('zone', h.zone); }
  else { set('birthPlace', h.label); set('birthLat', h.lat); set('birthLon', h.lon); set('birthZone', h.zone); }
  if (kind === 'birth') setTimeout(birthPreview, 0);
  $(kind + 'Results').innerHTML = ''; $(kind + 'Query').value = '';
  $(kind + 'Picked').innerHTML = pickedHtml(h.name, [h.state, h.country].filter(Boolean).join(', '));
  if (kind === 'loc') saveLocation();
}
function locationFields() {
  return `<button class="primary gold" type="button" onclick="gps()">${icon('pin')} ${esc(t('useMyLocation'))}</button><div class="or">${esc(t('orSearch'))}</div>${placeField('loc', loc.name)}`
    + `<details><summary>${esc(t('advanced'))}</summary><label>${esc(t('placeName'))}<input id="place" value="${esc(loc.name)}" maxlength="70"></label><div class="grid2"><label>${esc(t('latitude'))}<input id="lat" type="number" step="any" value="${loc.lat}"></label><label>${esc(t('longitude'))}<input id="lon" type="number" step="any" value="${loc.lon}"></label></div><label>${esc(t('timeZone'))}<input id="zone" value="${esc(loc.zone)}" placeholder="Asia/Kolkata"></label><button class="primary" type="button" onclick="saveLocation()">${esc(t('useThis'))}</button></details>`;
}
function locationSheet() { modal(`<div class="eyebrow">${esc(t('location'))}</div><h2 id="sheetTitle">${esc(t('whereAreYou'))}</h2><p>${esc(t('whereWhy'))}</p>${locationFields()}`); }
/* Switch place. If the screen was on today, stay on today in the new place's time zone. */
function setLoc(next) {
  const wasToday = isToday();
  loc = next;
  if (wasToday) { day = todayKey(); monthView = day.slice(0, 7); }
  lastToday = todayKey();
  memo.clear();
  wxAsked = 0;
}
function saveLocation() {
  try {
    const lat = Number($('lat').value), lon = Number($('lon').value), zone = $('zone').value.trim();
    if (!$('lat').value || !$('lon').value || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) throw Error();
    new Intl.DateTimeFormat('en', { timeZone: zone });
    setLoc({ name: $('place').value.trim() || t('customLoc'), lat, lon, zone });
    applyLocationDefaults(); persist(); haptic('success');
    if ($('modal').open) $('modal').close();
    scheduleNative(true);
    if (onboardStep) onboard(3); else render();
  } catch (e) { toast(t('errCoords')); }
}
function gps() {
  toast(t('locating'));
  if (window.SomaNative && SomaNative.requestLocation) { SomaNative.requestLocation(); return; }
  if (!navigator.geolocation) { toast(t('locFailed')); return; }
  navigator.geolocation.getCurrentPosition(p => receiveGPS({ lat: p.coords.latitude, lon: p.coords.longitude, zone: Intl.DateTimeFormat().resolvedOptions().timeZone }), () => toast(t('locFailed')), { timeout: 15000 });
}
/* A GPS fix gets a real name from the offline list: the town itself, or "Near X" when it is more than 15 km away. */
function receiveGPS(p) {
  if (p.error) { toast(t('locFailed')); return; }
  if (!window.Places) { needPlaces(() => receiveGPS(p)); return; }
  const near = Places.nearest(p.lat, p.lon);
  const name = near ? (near.km > 15 ? t('nearPlace', { p: near.name }) : near.name) : t('currentLoc');
  setLoc({ name, lat: +(+p.lat).toFixed(4), lon: +(+p.lon).toFixed(4), zone: (p.zone === 'Asia/Calcutta' ? 'Asia/Kolkata' : p.zone) || (near && near.zone) || 'Asia/Kolkata' });
  applyLocationDefaults(); persist(); haptic('success');
  if ($('modal').open) $('modal').close();
  scheduleNative(true);
  if (onboardStep) onboard(3); else { render(); toast(placeName(loc.name)); }
}
window.somaReceiveLocation = s => receiveGPS(typeof s === 'string' ? JSON.parse(s) : s);

// ---- Settings ---------------------------------------------------------------------------------
function seg(name, value, options, onpick) { return `<div class="seg" role="radiogroup" aria-label="${esc(name)}">${options.map(([k, label]) => `<button type="button" role="radio" aria-checked="${k === value}" class="${k === value ? 'on' : ''}" onclick="${onpick}('${k}')">${esc(label)}</button>`).join('')}</div>`; }
function setPref(key, v) { prefs[key] = v; if (key === 'lang') { L = I18n.make(v); applyLocationDefaults(); } persist(); haptic('select'); render(); if (onboardStep) onboard(onboardStep); if ($('modal').open && $('dialogBody').querySelector('.appearance')) appearanceSheet(); }
function setLang(v) { setPref('lang', v); }
function setTheme(v) { setPref('theme', v); }
/* Today has one layout now; kept so an older call (or a test) does nothing harmful. */
function setLayout() { render(); }
function setDigits(v) { fmtCache.clear(); setPref('digits', v); }
const LANGS = [['en', 'English'], ['gu', 'ગુજરાતી'], ['hi', 'हिन्दी']];
// ---- Plans with a muhurat check ---------------------------------------------------------------
/* The Plan sheet checks the chosen minute with the same nowState() as every hero, so they always agree. */
function timingCheck() {
  const time = $('eventTime') && $('eventTime').value, out = $('timingCheck');
  if (!time || !out) return;
  const at = K.instant(day, time, loc.zone), ns = nowState(at), h = P.at(ns.dd.hora, at), c = ns.c;
  const ok = ns.level !== 'bad', better = !ok ? ns.next : null;
  out.dataset.level = ns.level;
  out.innerHTML = `<div class="row"><span class="eyebrow">${esc(t('checkTime'))}</span>${badge(ns.level)}</div><p>${ns.kaal ? esc(t('nowKaal', { kaal: periodName(ns.kaal.k), time: fmt(ns.kaal.end) })) + ' · ' : ''}${esc(t('choghadiya'))}: ${c ? esc(L.chogName(c.key)) : '—'} · ${esc(t('hora'))}: ${h ? esc(L.planetName(h.lord)) : '—'}</p>`
    + (better ? `<p>${esc(t('nextGood'))}: ${esc(dayLabel(K.dateKey(better.start, loc.zone)))} ${span(better)} ${esc(L.chogName(better.key))}</p>${K.dateKey(better.start, loc.zone) === day ? `<button type="button" class="quiet" onclick="document.getElementById('eventTime').value='${K.parts(better.start, loc.zone).hour}:${K.parts(better.start, loc.zone).minute}';timingCheck()">${esc(t('useTime'))}</button>` : ''}` : '');
}
/* A friendly zone name ("IST", "CST") instead of "Asia/Kolkata". */
const zoneShort = () => (new Intl.DateTimeFormat('en-IN', { timeZone: loc.zone, timeZoneName: 'short' }).formatToParts(now()).find(x => x.type === 'timeZoneName') || {}).value || loc.zone;
/* Plan an event on the chosen day. The time starts at the day's next good window (never at a time already gone). */
function plan(time, title) {
  if (!time) {
    const d = vedicDay(day), from = isToday() ? now() : d.frame.sunrise, w = P.goodWindows(d, from, { strict: true, accept: c => SHUBH_CHOG(c) && !c.night })[0];
    // Rounded up to the next quarter hour, but never past the chosen day (after 11:45 pm that would be tomorrow's midnight).
    let at = w ? w.start : isToday() ? new Date(Math.ceil(+now() / 9e5) * 9e5) : K.instant(day, '10:00', loc.zone);
    if (K.dateKey(at, loc.zone) !== day) at = K.instant(day, '23:59', loc.zone);
    const p = K.parts(at, loc.zone);
    time = p.hour + ':' + p.minute;
  }
  sheet(t('planEvent'), `<div class="eyebrow">${esc(titleDay(day))}</div>`, `<form onsubmit="saveEvent(event)"><label>${esc(t('evTitle'))}<input id="eventTitle" required maxlength="100" value="${esc(title || '')}" placeholder="${esc(t('evPlaceholder'))}"></label><label>${esc(t('evTime'))}<input type="time" id="eventTime" value="${time}" required oninput="timingCheck()"></label><div class="card" id="timingCheck" aria-live="polite"></div><label>${esc(t('evDuration'))}<select id="duration"><option value="60">${esc(t('dur60'))}</option><option value="30">${esc(t('dur30'))}</option><option value="120">${esc(t('dur120'))}</option></select></label><p class="caption">${esc(placeName(loc.name))} · ${esc(zoneShort())}</p><button class="primary">${esc(t('savePlan'))}</button></form>`);
  timingCheck();
}
let planConfirmed = false;
function saveEvent(e) {
  e.preventDefault();
  if (!$('eventTitle').value.trim()) { toast(t('errEvTitle')); return; }
  const time = $('eventTime').value, start = K.instant(day, time, loc.zone), rt = K.parts(start, loc.zone);
  if (rt.hour + ':' + rt.minute !== time) { toast(t('errDst')); return; }
  const ns = nowState(start);
  // An Avoid time is the reader's call, but say so once before saving.
  if (ns.level === 'bad' && !planConfirmed) { planConfirmed = true; const b = document.querySelector('#modal form .primary'); if (b) { b.textContent = t('saveAnyway'); b.classList.add('danger'); } toast(t('avoidConfirm')); haptic('warn'); return; }
  planConfirmed = false;
  const c = ns.c;
  events.push({ id: Date.now().toString(36), title: $('eventTitle').value.trim(), day, time, start: start.toISOString(), end: new Date(+start + Number($('duration').value) * 60000).toISOString(), zone: loc.zone, place: loc.name, tithi: L.tithiName(K.tithi(start).index), muhurat: c ? L.chogName(c.key) + ' ' + t('choghadiya') : '' });
  if (persist()) { closeSheet(); haptic('success'); render(); toast(t('planSaved'), t('view'), () => { monthView = day.slice(0, 7); show('calendar'); }); }
}
function deleteEvent(id) { modal(`<h2 id="sheetTitle">${esc(t('removePlanQ'))}</h2><p>${esc(t('removePlanBody'))}</p><button class="primary danger" onclick="events=events.filter(e=>e.id!=='${id}');persist();document.querySelector('dialog').close();render()">${esc(t('removePlan'))}</button>`); }
function exportEvent(id) { const e = events.find(x => x.id === id); if (e) calendarExport(e); }
function calendarExport(e) {
  if (window.SomaNative && SomaNative.addCalendarEvent) { SomaNative.addCalendarEvent(e.title, e.start, e.end, e.place, e.tithi); return; }
  const clean = s => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'), dt = s => s.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Soma//Calendar//EN', 'BEGIN:VEVENT', 'UID:' + e.id + '@soma.local', 'DTSTAMP:' + dt(new Date().toISOString()), 'DTSTART:' + dt(e.start), 'DTEND:' + dt(e.end), 'SUMMARY:' + clean(e.title), 'LOCATION:' + clean(e.place), 'DESCRIPTION:' + clean(e.tithi + ' · ' + e.zone), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/calendar' })); a.download = 'soma-event.ics'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

// ---- You: birth sky and settings ---------------------------------------------------------------
/* You: who you are in the sky first (birth, rashi, nakshatra, today for you), then settings as short grouped rows,
   with About Soma (privacy, credits, licences, version) at the end. Birth-only readings sit in the second column. */
function personalView() {
  const has = !!profile.date, bm = birthMoon();
  const row = (ic, label, value, go, cls) => `<button class="${cls || ''}" onclick="${go}">${icon(ic, 'ri')}<b>${esc(label)}</b><span>${value ? esc(value) + ' ' : ''}<i aria-hidden="true">›</i></span></button>`;
  let id = '';
  if (has) {
    const instant = K.instant(profile.date, profile.time || '12:00', profile.zone || 'Asia/Kolkata'), n = K.sidereal(instant), nak = Math.floor(n / (360 / 27));
    const born = new Intl.DateTimeFormat(locale(), { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(profile.date + 'T12:00Z'))
      + (profile.timeUnknown ? '' : ', ' + fmtIn(instant, profile.zone || loc.zone));
    id = `<div class="facts2"><div><small>${esc(t('janmaRashi'))}</small><b>${esc(L.rashiName(Math.floor(n / 30)))}</b></div><div><small>${esc(t('janmaNak'))}</small><b>${esc(L.nakName(nak))}</b><small>${esc(t('pada', { n: num(Math.floor((n % (360 / 27)) / (360 / 108)) + 1) }))}</small></div></div>`;
    id = `<div class="card me"><div class="profile"><div class="avatar">${SomaDial.moon(34, 120)}</div><div style="flex:1;min-width:0"><div class="eyebrow">${esc(t('bornOn'))}</div><h3>${esc(born)}</h3>${profile.place ? `<p class="caption">${esc(profile.place.split(',')[0])}</p>` : ''}</div><button class="quiet edit" onclick="editProfile()" aria-label="${esc(t('editBirth'))}">${esc(t('edit'))}</button></div>${id}<p class="caption lock">${esc(t('birthStays'))}</p></div>`
      + personalLine(vedicDay(todayKey()), todayKey());
  } else {
    id = `<div class="card me empty"><div class="profile"><div class="avatar">${SomaDial.moon(34, 60)}</div><div style="flex:1;min-width:0"><h3>${esc(t('favCtaShort'))}</h3><p class="caption">${esc(t('youWhy'))}</p></div></div><button class="primary" onclick="editProfile()">${esc(t('addBirth'))}</button><p class="caption lock">${esc(t('birthStays'))}</p></div>`;
  }
  let natal = '';
  if (has) {
    const instant = K.instant(profile.date, profile.time || '12:00', profile.zone || 'Asia/Kolkata');
    const from = todayKey(), m0 = monthPersonal(from.slice(0, 7)) || { good: [], care: [] }, m = { good: m0.good.filter(x => x.key >= from), care: m0.care.filter(x => x.key >= from) };
    const chips = list => list.map(x => `<button class="chip${x.key === from ? ' on' : ''}" onclick="setDay('${x.key}');show('today')">${dayLabel(x.key, { weekday: undefined })}</button>`).join('');
    natal = rashiCard(vedicDay(todayKey()), true) + `<section class="section">${groupHead(t('ovForYou'), esc(t('personalDays')), `<button class="quiet more" onclick="show('calendar')">${esc(t('seeMonth'))} ›</button>`)}<div class="card">`
      + (m.good.length ? `<div class="chipRow" style="flex-wrap:wrap">${chips(m.good)}</div>` : `<p>${esc(t('favNone'))}</p>`)
      + (m.care.length ? `<div class="eyebrow" style="margin-top:14px">${esc(t('chandrashtama'))}</div><div class="chipRow care" style="flex-wrap:wrap">${chips(m.care)}</div>` : '') + `</div></section>`;
    // The kundali's houses hang on the lagna, which needs the birth time; without it, show only what the Moon gives.
    if (profile.timeUnknown) natal += `<section class="section"><div class="card"><span class="tag">${esc(t('kundali'))}</span><p class="notice">${esc(t('timeUnknownNote'))}</p></div></section>`;
    else if (window.SomaNatal) {
      try { natal += `<details class="fold section"><summary>${icon('moon', 'ri')}<b>${esc(t('kundaliNorth'))}</b></summary><div class="card"><div class="natal">${SomaNatal.chart(instant, profile.lat, profile.lon, L.lang, t('lagnaMark'))}</div><p class="caption">${esc(t('chartFor', { date: dayLabel(profile.date, { weekday: undefined, year: 'numeric' }), time: fmtIn(instant, profile.zone || loc.zone), place: (profile.place || profile.zone).split(',')[0] }))}</p></div></details>`; }
      catch (e) { natal += `<p class="notice">${esc(t('chartFail'))}</p>`; }
    }
    natal += `<details class="fold section"><summary>${icon('muhurat', 'ri')}<b>${esc(t('numerology'))}</b><span>${num(K.reduce(profile.date.slice(-2)))} · ${num(K.reduce(profile.date))}</span></summary><div class="grid2"><div class="card"><div class="caption">${esc(t('mulank'))}</div><div class="number">${num(K.reduce(profile.date.slice(-2)))}</div></div><div class="card"><div class="caption">${esc(t('bhagyank'))}</div><div class="number">${num(K.reduce(profile.date))}</div></div></div><button class="lesson" onclick="lesson(7)"><h3>${esc(t('howCounted'))} <span aria-hidden="true">›</span></h3></button></details>`;
  } else {
    natal = rashiCard(vedicDay(todayKey()), true) + `<section class="section">${groupHead(t('forYou'), esc(t('youGet')))}<div class="card"><ul class="gets">${['youGet1', 'youGet2', 'youGet3', 'youGet4'].map(k => `<li>${esc(t(k))}</li>`).join('')}</ul></div>`
      + `<button class="lesson" onclick="lesson(6)"><h3>${esc(lessonTitle(lessons[6]))} <span>›</span></h3><span>${esc(t('birthLessonSub'))}</span></button></section>`;
  }
  void bm;
  // Who you are first, then what today and this month hold for you, then the kundali; settings are one row away.
  const top = titleBar(esc(t('you')), esc(t('yourSky')), `<button class="gear" onclick="push('settings')" aria-label="${esc(t('settings'))}">${icon('gear')}</button>`);
  const tail = `<section class="section"><div class="group rows"><button onclick="push('settings')">${icon('gear', 'ri')}<b>${esc(t('settings'))}</b><span>${updatesOn() && pendingUpdate() ? `<b class="newdot">${esc(t('updNew'))}</b> ` : ''}<i aria-hidden="true">›</i></span></button><button onclick="push('learn')">${icon('book', 'ri')}<b>${esc(t('learnMore'))}</b><span><i aria-hidden="true">›</i></span></button></div></section>`;
  $('app').innerHTML = `<div class="split"><div class="lead">${top}${id}</div><div class="rest">${natal}${tail}</div></div>`;
}
/* Settings: one page, and every change saves the moment it is made (no Save button), as on iOS and Android. */
function settings() { if (view !== 'settings') push('settings'); else render(); }
function settingsView() {
  const has = !!profile.date, r = prefs.reminders;
  const row = (ic, label, value, go, cls) => `<button class="${cls || ''}" onclick="${go}">${icon(ic, 'ri')}<b>${esc(label)}</b><span>${value ? esc(value) + ' ' : ''}<i aria-hidden="true">›</i></span></button>`;
  const sw = (id, on, label, go) => `<label class="switch"><span>${esc(label)}</span><input type="checkbox" role="switch" id="${id}" ${on ? 'checked' : ''} onchange="${go}"><i aria-hidden="true"></i></label>`;
  const block = (title, html) => `<section class="section">${groupHead('', esc(title))}${html}</section>`;
  const lead = pageBar(t('settings'))
    + block(t('location'), `<div class="group rows">${row('pin', t('location'), placeName(loc.name), 'locationSheet()')}</div>`)
    + block(t('appearance'), `<div class="card">`
      + `<label style="margin-top:0">${esc(t('language'))}${seg(t('language'), prefs.lang, LANGS, 'setLang')}</label>`
      + `<label>${esc(t('theme'))}${seg(t('theme'), prefs.theme, [['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]], 'setTheme')}</label>`
      + (L.lang !== 'en' ? `<label>${esc(t('digits'))}${seg(t('digits'), prefs.digits === 'native' ? 'native' : 'latin', [['latin', t('digitsLatin')], ['native', L.lang === 'gu' ? '૧ ૨ ૩' : '१ २ ३']], 'setDigits')}</label>` : '')
      + `</div>`)
    + block(t('calendar'), `<div class="card"><label style="margin-top:0">${esc(t('monthSystem'))}${tip('amanta', t('monthSystem'))}${seg(t('monthSystem'), prefs.month, [['amanta', t('amantaShort')], ['purnimanta', t('purnimantaShort')]], 'setMonthSys')}</label>`
      + `<label>${esc(t('festivalSets'))}</label>${setChips()}</div>`);
  const rest = block(t('reminders'), `<div class="card switches">${sw('rem_vrat', r.vrat, t('remVrat'), "setReminder('vrat',this.checked)")}${sw('rem_parana', r.parana, t('remParana'), "setReminder('parana',this.checked)")}${sw('rem_daily', r.daily, t('remDaily'), "setReminder('daily',this.checked)")}${sw('rem_rahu', r.rahu, t('remRahu'), "setReminder('rahu',this.checked)")}</div>`)
    + (wxNative() ? block(t('wxTitle'), `<div class="card switches">${sw('wxOn', prefs.weather, t('wxLive'), 'setWeather(this.checked,true);render()')}</div>`) : '')
    + block(t('aboutSoma'), `<div class="group rows">${row('muhurat', t('method'), '', 'lesson(8)')}`
      + (updatesOn() ? `<button onclick="updateSheet()">${icon('refresh', 'ri')}<b>${esc(t('updTitle'))}</b><span>${pendingUpdate() ? `<b class="newdot">${esc(t('updNew'))}</b> ` : ''}${esc((updateInfo() || {}).versionName || '')} <i aria-hidden="true">›</i></span></button>` : '')
      + row('info', t('aboutSoma'), t('versionShort', { v: appVersion() }), 'aboutSheet()') + `</div>`
      + (has ? `<div class="group rows">${row('trash', t('deleteBirth'), '', 'eraseProfile()', 'danger')}</div>` : ''));
  $('app').innerHTML = `<div class="split"><div class="lead">${lead}</div><div class="rest">${rest}</div></div>`;
}
function setReminder(k, on) {
  prefs.reminders[k] = !!on; persist(); haptic('select'); scheduleNative(true);
  if (on) askNotifications(true);
}
/* Appearance: language, theme, Today layout and digits, on their own sheet. */
function appearanceSheet() {
  modal(`<div class="appearance"><div class="eyebrow">${esc(t('ovStyle'))}</div><h2 id="sheetTitle">${esc(t('appearance'))}</h2><div class="card">`
    + `<label style="margin-top:0">${esc(t('language'))}${seg(t('language'), prefs.lang, LANGS, 'setLang')}</label>`
      + `<label>${esc(t('theme'))}${seg(t('theme'), prefs.theme, [['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]], 'setTheme')}</label>`
      + (L.lang !== 'en' ? `<label>${esc(t('digits'))}${seg(t('digits'), prefs.digits === 'native' ? 'native' : 'latin', [['latin', t('digitsLatin')], ['native', L.lang === 'gu' ? '૧ ૨ ૩' : '१ २ ३']], 'setDigits')}</label>` : '')
      + `<p class="caption" style="margin-top:12px">${esc(t('textSize'))}</p></div>` + `</div>`);
}
const appVersion = () => (updateInfo() || {}).versionName || (window.SomaPrototype && SomaPrototype.health ? SomaPrototype.health().version : '');
/* About Soma: what it is, what stays on the phone, whose data and code it stands on, and the full licence text. */
function aboutSheet() {
  const credit = (name, what, lic) => `<div class="credit2"><b>${esc(name)}</b><span>${esc(what)}</span><small>${esc(lic)}</small></div>`;
  modal(`<div class="about"><div class="abouthead">${SomaDial.moon(56, 120)}<div><h2 id="sheetTitle">Soma</h2><p class="caption">${esc(t('versionShort', { v: appVersion() }))}</p></div></div><p>${esc(t('aboutLine'))}</p>`
    + `<h3 class="section">${esc(t('privacyTitle'))}</h3><ul class="gets"><li>${esc(t('privacy1'))}</li><li>${esc(t('privacy2'))}</li><li>${esc(t('privacy3'))}</li>${updatesOn() ? `<li>${esc(t('privacy4'))}</li>` : ''}</ul>`
    + `<h3 class="section">${esc(t('creditsTitle'))}</h3>`
    + credit('Astronomy Engine', t('creditAstro'), 'MIT') + credit('MET Norway', t('creditMet'), 'CC BY 4.0 · NLOD 2.0') + credit('GeoNames', t('creditGeo'), 'CC BY 4.0')
    + credit('Instrument Serif · Manrope · Noto', t('creditFonts'), 'SIL OFL 1.1') + credit(t('moon'), t('moonCredit'), '')
    + `<details class="section" ontoggle="if(this.open)loadNotices()"><summary>${esc(t('licences'))}</summary><pre id="notices" class="notices">…</pre></details>`
    + `<button class="lesson" onclick="lesson(8)"><h3>${esc(t('method'))} <span aria-hidden="true">›</span></h3></button></div>`);
}
function loadNotices() {
  const el = $('notices'); if (!el || el.dataset.ok) return;
  if (!window.fetch) { el.textContent = t('licencesFile'); return; }
  fetch('THIRD_PARTY_NOTICES.txt').then(r => r.text()).then(x => { el.textContent = x; el.dataset.ok = '1'; }).catch(() => { el.textContent = t('licencesFile'); });
}
/* Birth details. The birthplace must be picked (or typed under Advanced): it is never borrowed from where the phone is now,
   and the time starts empty so a guess never looks like an answer. A line under the form reads the details back before saving. */
/* Birth date as day, month and year lists: a calendar grid makes people page back decades to 1985. */
function dobPicker(v) {
  const [y, m, d] = (v || '').split('-').map(Number), thisYear = +todayKey().slice(0, 4);
  const opts = (a, b, cur, label) => `<option value="">${esc(label)}</option>` + Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => a + (b > a ? i : -i)).map(n => `<option value="${n}" ${n === cur ? 'selected' : ''}>${esc(String(num(n)))}</option>`).join('');
  const months = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === m ? 'selected' : ''}>${esc(new Intl.DateTimeFormat(locale(), { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2020, i, 15))))}</option>`).join('');
  return `<div class="dobrow"><select id="dobD" aria-label="${esc(t('dobDay'))}" oninput="syncDob()">${opts(1, 31, d, t('dobDay'))}</select>`
    + `<select id="dobM" aria-label="${esc(t('dobMonth'))}" oninput="syncDob()"><option value="">${esc(t('dobMonth'))}</option>${months}</select>`
    + `<select id="dobY" aria-label="${esc(t('dobYear'))}" oninput="syncDob()">${opts(thisYear, 1900, y, t('dobYear'))}</select></div><input id="birthDate" type="hidden" value="${esc(v)}">`;
}
function syncDob() {
  const d = +$('dobD').value, m = +$('dobM').value, y = +$('dobY').value;
  const ok = d && m && y && new Date(Date.UTC(y, m - 1, d)).getUTCDate() === d;
  $('birthDate').value = ok ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '';
}
function birthForm() {
  const unknown = !!profile.timeUnknown, has = v => v != null && v !== '';
  return `<form onsubmit="saveProfile(event)" novalidate oninput="birthPreview()"><fieldset class="dob"><legend>${esc(t('dateOfBirth'))}</legend>${dobPicker(profile.date || '')}</fieldset>`
    + `<label>${esc(t('timeOfBirth'))}<input id="birthTime" type="time" value="${esc(!unknown && profile.time ? profile.time : '')}" ${unknown ? 'disabled' : ''}></label><label class="check" style="border:0"><input type="checkbox" id="birthUnknown" ${unknown ? 'checked' : ''} onchange="document.getElementById('birthTime').disabled=this.checked;birthPreview()"> ${esc(t('dontKnowTime'))}</label>`
    + `<label for="birthQuery">${esc(t('placeOfBirth'))}</label>${placeField('birth', profile.place || '')}`
    + `<details><summary>${esc(t('advanced'))}</summary><input id="birthPlace" type="hidden" value="${esc(profile.place || '')}"><div class="grid2"><label>${esc(t('latitude'))}<input id="birthLat" type="number" step="any" min="-90" max="90" value="${has(profile.lat) ? profile.lat : ''}"></label><label>${esc(t('longitude'))}<input id="birthLon" type="number" step="any" min="-180" max="180" value="${has(profile.lon) ? profile.lon : ''}"></label></div><label>${esc(t('timeZone'))}<input id="birthZone" value="${esc(profile.zone || '')}" placeholder="Asia/Kolkata"></label></details>`
    + `<p class="caption" style="margin-top:12px">${esc(t('birthWhy'))}</p><p id="birthConfirm" class="confirm" aria-live="polite"></p><p id="birthErr" class="err" role="alert"></p><button class="primary">${esc(t('seeMySky'))}</button></form>`;
}
/* Reads the form; returns {p} when complete or {err} naming the first thing still missing. */
function readBirth() {
  const val = id => ($(id) && $(id).value.trim()) || '', unknown = !!($('birthUnknown') && $('birthUnknown').checked);
  const p = { date: val('birthDate'), time: unknown ? '12:00' : val('birthTime'), timeUnknown: unknown, zone: val('birthZone'), lat: val('birthLat'), lon: val('birthLon'), place: val('birthPlace') };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return { err: t('errBirthDate') };
  if (!unknown && !/^\d{2}:\d{2}$/.test(p.time)) return { err: t('errBirthTime') };
  const lat = Number(p.lat), lon = Number(p.lon);
  if (p.lat === '' || p.lon === '' || !p.zone || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) return { err: t('errBirthPlace') };
  try { new Intl.DateTimeFormat('en', { timeZone: p.zone }); } catch (e) { return { err: t('errBirthPlace') }; }
  const d = K.instant(p.date, p.time, p.zone), r = K.parts(d, p.zone);
  if (r.hour + ':' + r.minute !== p.time) return { err: t('errBirthDst') };
  p.lat = lat; p.lon = lon;
  if (!p.place) p.place = lat.toFixed(2) + ', ' + lon.toFixed(2);
  return { p, at: d };
}
function birthPreview() {
  const out = $('birthConfirm'); if (!out) return;
  const r = readBirth();
  if (r.err) { out.textContent = ''; return; }
  const p = r.p, zoneName = (new Intl.DateTimeFormat('en-IN', { timeZone: p.zone, timeZoneName: 'short' }).formatToParts(r.at).find(x => x.type === 'timeZoneName') || {}).value || p.zone;
  const date = new Intl.DateTimeFormat(locale(), { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(p.date + 'T12:00Z'));
  out.textContent = t('bornLine', { date, time: p.timeUnknown ? t('timeNotKnown') : fmtIn(r.at, p.zone), place: p.place.split(',')[0] + ' (' + zoneName + ')' });
  if ($('birthErr')) $('birthErr').textContent = '';
}
function editProfile() { modal(`<div class="eyebrow">${esc(t('yourSky'))}</div><h2 id="sheetTitle">${esc(t('birthTitle'))}</h2>${birthForm()}`); birthPreview(); }
function saveProfile(e) {
  e.preventDefault();
  const r = readBirth();
  if (r.err) { if ($('birthErr')) $('birthErr').textContent = r.err; toast(r.err); return; }
  profile = r.p;
  if (persist()) { haptic('success'); if ($('modal').open) $('modal').close(); if (onboardStep) finishOnboard('personal'); else render(); }
}
function eraseProfile() { modal(`<h2 id="sheetTitle">${esc(t('deleteBirth'))}?</h2><p>${esc(t('eraseBody'))}</p><button class="primary danger" onclick="profile={};persist();document.querySelector('dialog').close();personalView()">${esc(t('deleteBirth'))}</button>`); }

// ---- First launch: language, place, birth sky ------------------------------------------------
let onboardStep = 0;
/* Four short steps with a top bar: back, "2 of 4", and Skip at the top right where the thumb expects it.
   Skipping the place guesses a city from the phone's time zone and says which one, so nothing is silently wrong. */
const ZONE_CITY = {
  'Asia/Kolkata': ['Jamnagar', 22.4707, 70.0577], 'Asia/Calcutta': ['Jamnagar', 22.4707, 70.0577], 'Europe/London': ['London', 51.5074, -0.1278],
  'America/New_York': ['New York', 40.7128, -74.006], 'America/Toronto': ['Toronto', 43.6532, -79.3832], 'America/Chicago': ['Chicago', 41.8781, -87.6298],
  'America/Los_Angeles': ['Los Angeles', 34.0522, -118.2437], 'Asia/Dubai': ['Dubai', 25.2048, 55.2708], 'Africa/Nairobi': ['Nairobi', -1.2921, 36.8219],
  'Australia/Sydney': ['Sydney', -33.8688, 151.2093], 'Asia/Singapore': ['Singapore', 1.3521, 103.8198], 'Asia/Kathmandu': ['Kathmandu', 27.7172, 85.324]
};
function skipPlace() {
  let z = ''; try { z = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* keep the default */ }
  const c = ZONE_CITY[z];
  if (c && c[0] !== loc.name) { loc = { name: c[0], lat: c[1], lon: c[2], zone: z }; persist(); memo.clear(); }
  onboard(3); toast(t('placeGuess', { p: placeName(loc.name) }));
}
function onboard(step) {
  onboardStep = step; const el = $('onboard');
  if ($('modal').open) $('modal').close();
  $('dialogBody').innerHTML = ''; // the forms below reuse the same field ids
  const skips = { 1: 'onboard(2)', 2: 'skipPlace()', 3: 'onboard(4)', 4: "finishOnboard('today')" };
  const bar = `<div class="obbar"><button class="obback" ${step > 1 ? `onclick="onboard(${step - 1})"` : 'disabled'} aria-label="${esc(t('back'))}">‹</button><span class="obstep">${esc(t('step', { n: num(step), m: num(4) }))}</span><button class="obskip" onclick="${skips[step]}">${esc(t('skip'))}</button></div>`;
  const foot = primary => primary ? `<div class="foot">${primary}</div>` : '';
  let html = '';
  if (step === 1) html = `<div class="hero">${SomaDial.moon(84, 120)}<h1>${esc(t('welcome'))}</h1><p style="margin-top:6px">${esc(t('tagline'))}</p></div><div class="eyebrow">${esc(t('chooseLanguage'))}</div><div class="langs">${LANGS.map(([k, n]) => `<button class="${prefs.lang === k ? 'on' : ''}" aria-pressed="${prefs.lang === k}" onclick="setLang('${k}')">${n}<span>${prefs.lang === k ? '✓' : ''}</span></button>`).join('')}</div>`
    + foot(`<button class="primary" onclick="onboard(2)">${esc(t('continue'))}</button>`);
  else if (step === 2) html = `<h1>${esc(t('whereAreYou'))}</h1><p style="margin:8px 0 18px">${esc(t('whereWhy'))}</p>${locationFields()}`;
  else if (step === 3) {
    const opt = (k, title, sub) => `<button class="${prefs.month === k ? 'on' : ''}" aria-pressed="${prefs.month === k}" onclick="setMonthSys('${k}')">${esc(title)}<small>${esc(sub)}</small><span>${prefs.month === k ? '✓' : ''}</span></button>`;
    html = `<h1>${esc(t('calTitle'))}</h1><p style="margin:8px 0 18px">${esc(t('calWhy'))}</p>`
      + `<div class="eyebrow">${esc(t('monthQ'))}</div><div class="langs months">${opt('amanta', t('monthAmaOpt'), t('monthAmaSub'))}${opt('purnimanta', t('monthPurOpt'), t('monthPurSub'))}</div>`
      + `<div class="eyebrow" style="margin-top:18px">${esc(t('festQ'))}</div>${setChips('onboard(3)')}`
      + foot(`<button class="primary" onclick="onboard(4)">${esc(t('continue'))}</button>`);
  }
  else if (step === 4) html = `<div class="eyebrow">${esc(t('yourSky'))}</div><h1 style="margin-top:6px">${esc(t('birthTitle'))}</h1>${birthForm()}`;
  el.innerHTML = `<div class="inner">${bar}${html}</div>`; el.classList.add('open'); el.scrollTop = 0;
}
function finishOnboard(to) {
  onboardStep = 0; prefs.onboarded = true; persist();
  $('onboard').classList.remove('open'); $('onboard').innerHTML = '';
  show(to || 'today');
  // Ask in our own words first; the system prompt only follows a yes, so a "no" can be asked again later.
  if (window.SomaNative && SomaNative.requestNotifications && !prefs.askedNotify) setTimeout(notifyPrimer, 400);
}
function notifyPrimer() {
  sheet(t('notifyTitle'), `<div class="eyebrow">${esc(t('reminders'))}</div>`, `<p class="leadline">${esc(t('notifyWhy'))}</p>`
    + `<div class="actions"><button class="primary" onclick="closeSheet();askNotifications(true)">${esc(t('notifyYes'))}</button><button class="quiet" onclick="closeSheet()">${esc(t('notNow'))}</button></div>`);
}

// ---- Reminders and widget (native) ----------------------------------------------------------
/* Local notifications for the next 30 days, computed here and handed to the native alarm scheduler. */
function reminderPlan() {
  // From yesterday too: a midnight festival's puja (Shivratri, Janmashtami) falls after civil midnight.
  const from = todayKey(), list = observances(K.addDay(from, -1), 32), r = prefs.reminders, out = [], nowMs = Clock.ms();
  const add = (at, title, body, id) => { if (+at > nowMs) out.push({ id, at: +at, title, body }); };
  for (const f of list) {
    const rm = prefs.remind || {}, mine = !!(rm[f.key] || rm[f.key + '|' + f.day]);
    if (mine) {
      // The puja time, or half an hour before moonrise for the fasts broken at moonrise (Karwa Chauth, Sankashti).
      const vd = vedicDay(f.day), fw = festWindow(vd, f), moonFast = f.rule === 'moonrise' || (fw && fw.key === 'moonrise'), mr = moonFast ? (fw ? fw.start : vd.frame.data.moonrise) : null, w = moonFast ? null : fw;
      const at = w ? w.start : mr ? new Date(+mr - 30 * 6e4) : K.instant(f.day, '07:00', loc.zone);
      const h = wxFor(mr || (w && w.start)), sky = h ? ' · ' + (mr && (h.cl >= 70 || WET.test(h.k)) ? t('remMoonCloud', { cl: h.cl }) : wxBrief(h)) : '';
      add(at, L.festName(f), (w ? t('remPuja', { span: span(w) }) : mr ? t('moonrise') + ' ' + fmt(mr) : (festNote(f) || L.festName(f))) + sky, 'mine-' + f.key + '-' + f.day);
    }
    if ((r.vrat || mine) && f.day > from) add(K.instant(K.addDay(f.day, -1), '19:00', loc.zone), t('remTomorrow', { f: L.festName(f) }), f.key === 'ekadashi' ? t('remFast') + (f.parana ? t('remParanaAt', { d: dayLabel(f.parana.day), span: span(f.parana) }) : '') : (festNote(f) || t('remAt', { f: L.festName(f), p: placeName(loc.name) })), 'eve-' + f.key + '-' + f.day);
    if (r.parana && f.parana) add(f.parana.start, t('parana') + ': ' + L.festName(f), t('remBreak', { time: fmt(f.parana.end) }), 'parana-' + f.day);
  }
  if (r.daily || r.rahu) {
    const samp = Fe.samples(from, 14, loc);
    for (const s of samp.slice(0, 14)) {
      const ti = Math.floor(A.MoonPhase(s.sunrise) / 12), wd = new Date(Date.parse(s.day + 'T12:00Z')).getUTCDay(), seg0 = P.RAHU[wd] - 1;
      const rahu = { start: new Date(+s.sunrise + (s.sunset - s.sunrise) * seg0 / 8), end: new Date(+s.sunrise + (s.sunset - s.sunrise) * (seg0 + 1) / 8) };
      const fest = list.filter(x => x.day === s.day).map(x => L.festName(x)).join(', ');
      if (r.daily) add(s.sunrise, L.vaarName(wd) + ' · ' + L.tithiName(ti), (fest ? fest + '. ' : '') + t('rahu') + ' ' + span(rahu) + (wxFor(s.sunrise) ? ' · ' + wxBrief(wxFor(s.sunrise)) : ''), 'daily-' + s.day);
      if (r.rahu) add(rahu.start, t('rahu') + ' ' + span(rahu), t('remRahuBody', { time: fmt(rahu.end) }), 'rahu-' + s.day);
    }
  }
  return out.slice(0, 120);
}
/* Reminders are on by default, so ask for notification permission once after setup, and again whenever reminders are saved on. */
function askNotifications(force) {
  if (!window.SomaNative || !SomaNative.requestNotifications || (!force && prefs.askedNotify)) return;
  prefs.askedNotify = true; persist(); SomaNative.requestNotifications();
}
let nativeTimer = null, nativeDay = null;
function scheduleNative(force) {
  if (!window.SomaNative) return;
  if (!force && nativeDay === todayKey()) return;
  nativeDay = todayKey();
  clearTimeout(nativeTimer);
  nativeTimer = setTimeout(() => {
    try {
      if (SomaNative.scheduleReminders) SomaNative.scheduleReminders(JSON.stringify(reminderPlan()));
      if (Object.values(prefs.reminders).some(Boolean) && prefs.onboarded) askNotifications(false);
    } catch (e) { if (SomaNative.appFailure) SomaNative.appFailure('reminders: ' + e.message); }
  }, 400);
}

/* Home-screen widget: hand the native side a week of precomputed Panchang (widget.js) plus the user's festival list, so it shows what holds *now* without opening the app. Recomputed when the place, festival filter, local day or 6-hour bucket changes. */
let widgetKey = '', widgetTimer = 0;
/* The reader's festivals for the widget, named and explained in the app's language. */
function widgetFestivals(today) {
  try {
    return observances(today, 60).map(x => ({ date: x.day, n: x.gu || x.en, en: x.en, l: L.festName(x),
      d: x.parana ? t('parana') + ': ' + dayLabel(x.parana.day) + ' ' + span(x.parana) : x.sutak ? t('sutakLine', { a: full(x.sutak), b: full(x.at) }) : festNote(x) }));
  } catch (e) { return []; }
}
/* Names and phrases in the reader's language, so the widgets never fall back to English for a Gujarati or Hindi reader. */
const CHOG_KEY = { Udveg: 'udveg', Char: 'char', Labh: 'labh', Amrit: 'amrit', Kaal: 'kaal', Shubh: 'shubh', Rog: 'rog' };
function localizeFeed(f) {
  f.lang = L.lang;
  (f.chog || []).forEach(c => { if (CHOG_KEY[c.en]) c.l = L.chogName(CHOG_KEY[c.en]); });
  (f.tithi || []).forEach(x => { x.l = L.tithiName(K.tithi(new Date((x.s + x.e) / 2)).index); });
  (f.nak || []).forEach(x => { x.l = L.nakName(Math.floor(P.moonSid(new Date((x.s + x.e) / 2)) / (360 / 27)) % 27); });
  (f.days || []).forEach(d => { d.vaarL = L.vaarName(new Date(d.date + 'T12:00Z').getUTCDay()); });
  const tx = {};
  Object.keys(I18n.STR.en).filter(k => /^w[A-Z]/.test(k)).forEach(k => { tx[k] = t(k); });
  ['rahu', 'yamaganda', 'gulika', 'abhijit', 'brahma', 'sunrise', 'sunset', 'moonrise', 'moonset', 'today2', 'tomorrow', 'wxWindy', 'mph', 'kmh'].forEach(k => { tx[k] = t(k); });
  tx.until = t('untilT', { time: '{x}' });
  [29, 7, 14, 22].forEach((ti, i) => { tx['phase' + i] = L.tithiName(ti); });
  tx.purnima = L.tithiName(14); tx.amavasya = L.tithiName(29);
  const wx = t('wx') || {};
  Object.keys(wx).forEach(k => { tx['wx_' + k] = wx[k]; });
  f.t = tx;
  return f;
}
function pushWidgetFeed() {
  if (!window.SomaNative || !SomaNative.updateWidgetFeed || !window.SomaWidgetFeed) return;
  const at = now(), today = K.dateKey(at, loc.zone);
  const key = [loc.lat, loc.lon, loc.zone, loc.name, today, L.lang, Math.floor(at.getTime() / 216e5), JSON.stringify(window.SomaFestivalSets || '')].join('|');
  if (key === widgetKey) return;
  try { SomaNative.updateWidgetFeed(JSON.stringify(localizeFeed(SomaWidgetFeed.build(loc, at, widgetFestivals(today))))); widgetKey = key; }
  catch (e) { console.error('Widget feed failed: ' + e.message); }
}
function scheduleWidgetFeed() { clearTimeout(widgetTimer); widgetTimer = setTimeout(pushWidgetFeed, 400); }

// ---- Updates for preview builds (sideloaded APKs) ------------------------------------------
/* Preview builds read the newest build from GitHub, download it and open Android's installer.
   Store builds report enabled:false and update through the store, so none of this shows there. */
const upd = { state: '', feed: null, progress: -1, message: '', manual: false, asked: 0, lastAuto: 0 };
function updateInfo() { try { return window.SomaNative && SomaNative.updateInfo ? JSON.parse(SomaNative.updateInfo()) : null; } catch (e) { return null; } }
function updatesOn() { const i = updateInfo(); return !!(i && i.enabled); }
/* A newer build than this phone has, from the last answer (kept across launches so the banner shows at once). */
function pendingUpdate() {
  const i = updateInfo(), f = upd.feed || prefs.updateFeed;
  return i && i.enabled && f && f.versionCode > i.versionCode ? f : null;
}
function checkUpdate(manual) {
  if (!updatesOn()) return;
  // A check that never answered (page paused mid-request) must not block every later one.
  const stuck = (upd.state === 'checking' && Date.now() - upd.asked > 30000) || (upd.state === 'downloading' && Date.now() - upd.asked > 600000);
  if ((upd.state === 'checking' || upd.state === 'downloading') && !stuck) { if (manual) updateSheet(); return; }
  upd.manual = !!manual; upd.installing = false; upd.state = 'checking'; upd.message = ''; upd.asked = Date.now();
  if (manual) updateSheet();
  SomaNative.checkForUpdate();
}
function installUpdate() { if (!updatesOn()) return; upd.installing = true; upd.state = 'downloading'; upd.progress = -1; upd.asked = Date.now(); refreshUpdateUI(); SomaNative.installUpdate(); }
window.somaReceiveUpdate = function (json) {
  let m; try { m = JSON.parse(json); } catch (e) { return; }
  upd.state = m.state;
  if (m.state === 'available' || m.state === 'latest') {
    upd.feed = m; prefs.updateFeed = { versionCode: m.versionCode, versionName: m.versionName, notes: m.notes || '', published: m.published || '' }; persist();
  }
  if (m.state === 'downloading') upd.progress = m.progress;
  if (m.state === 'error') { upd.message = m.message || ''; if (!upd.manual && !upd.installing && !($('modal').open && $('updateBody'))) upd.state = ''; }
  if (m.state === 'done' || m.state === 'latest') upd.installing = false;
  refreshUpdateUI();
};
function refreshUpdateUI() {
  if ($('modal').open && $('updateBody')) updateSheet();
  const f = pendingUpdate(), s = upd.state;
  if (s === 'downloading' || s === 'installing' || s === 'confirm' || s === 'permission' || (s === 'error' && f)) showUpdateNote(f);
  else if (f && !(prefs.updateSnooze && prefs.updateSnooze.code === f.versionCode && Date.now() < prefs.updateSnooze.until)) showUpdateNote(f);
  else hideUpdateNote();
}
function updateStatus() {
  const f = upd.feed, s = upd.state;
  if (s === 'checking') return t('updChecking');
  if (s === 'available') return t('updReady', { v: f.versionName });
  if (s === 'latest') return t('updLatest');
  if (s === 'downloading') return upd.progress >= 0 ? t('updDownloading') + ' ' + upd.progress + '%' : t('updDownloading');
  if (s === 'installing' || s === 'confirm') return t('updInstalling');
  if (s === 'permission') return t('updPermission');
  if (s === 'cancelled') return t('updCancelled');
  if (s === 'error') return upd.message;
  return '';
}
function updateSheet() {
  const i = updateInfo() || {}, f = upd.feed || prefs.updateFeed, s = upd.state, newer = !!(f && f.versionCode > i.versionCode);
  const action = s === 'checking' || s === 'downloading' || s === 'installing' || s === 'confirm' ? ''
    : newer ? `<button class="primary gold" onclick="installUpdate()">${esc(t('updInstall'))}</button>`
    : `<button class="primary" onclick="checkUpdate(true)">${esc(t('updCheck'))}</button>`;
  const notes = newer && f.notes ? `<p class="caption">${esc(t('updWhatsNew'))}: ${esc(f.notes)}</p>` : '';
  modal(`<div id="updateBody"><div class="eyebrow">Soma Preview</div><h2>${esc(t('updTitle'))}</h2>`
    + `<div class="group"><div class="item">${esc(t('updThisPhone'))}<span>${esc(i.versionName || '')}</span></div>${f ? `<div class="item">${esc(t('updNewest'))}<span>${esc(f.versionName)}${f.published ? ' · ' + esc(dayLabel(String(f.published).slice(0, 10), { weekday: undefined })) : ''}</span></div>` : ''}</div>`
    + `<p class="notice" role="status">${esc(updateStatus() || (newer ? t('updReady', { v: f.versionName }) : ''))}</p>${notes}${action}<p class="caption">${esc(t('updHow'))}</p></div>`);
}
/* The banner: one tap on it downloads and installs. While it works it shows progress; ✕ hides this build for six hours. */
function showUpdateNote(f) {
  let el = $('updateNote');
  if (!el) { el = document.createElement('div'); el.id = 'updateNote'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  const s = upd.state, working = s === 'downloading' || s === 'installing' || s === 'confirm';
  const label = working || s === 'permission' || s === 'error' ? updateStatus() : t('updReady', { v: f ? f.versionName : '' });
  const go = working ? '' : `<button class="go" onclick="installUpdate()">${esc(t('updNow'))}</button>`;
  const close = working ? '' : `<button class="x" aria-label="${esc(t('updLater'))}" onclick="snoozeUpdate()">✕</button>`;
  el.innerHTML = `<button class="body" onclick="${working ? 'updateSheet()' : 'installUpdate()'}">${esc(label)}</button>${go}${close}`;
  el.classList.toggle('working', working);
  el.style.display = 'flex';
}
function hideUpdateNote() { const el = $('updateNote'); if (el) el.style.display = 'none'; }
function snoozeUpdate() { const f = pendingUpdate(); if (f) { prefs.updateSnooze = { code: f.versionCode, until: Date.now() + 216e5 }; persist(); } upd.state = ''; hideUpdateNote(); }
/* Look on every launch and every return to the app (at most once a minute), so a new build shows within moments. */
function autoCheckUpdate() {
  if (!updatesOn()) return;
  refreshUpdateUI();
  if (Date.now() - upd.lastAuto < 60000) return;
  upd.lastAuto = Date.now(); checkUpdate(false);
}
setInterval(() => { if (!document.hidden) autoCheckUpdate(); }, 30 * 60000);

/* Text size follows the phone. Android hands over its font scale; iOS WebKit already sized the root from Dynamic Type.
   Either way html.bigtext switches tight rows (sun strip, calendar cells, dial core) to wrapping layouts. */
function applyTextScale() {
  const root = document.documentElement;
  try { const f = window.SomaNative && SomaNative.fontScale ? +SomaNative.fontScale() : 0; if (f > 0) root.style.fontSize = Math.round(Math.min(f, 2.2) * 100) + '%'; } catch (e) {}
  let px = parseFloat(getComputedStyle(root).fontSize) || 16;
  // iOS Dynamic Type at its accessibility sizes can pass 40px; past 30px the dial and the tab bar stop fitting a phone.
  if (px > 30) { root.style.fontSize = '30px'; px = 30; }
  root.classList.toggle('bigtext', px >= 20);
}
applyTextScale();
window.SomaPrototype = { health: () => ({ ready: true, version: '0.8.0', tithi: K.tithi(now()).label, location: loc.name, festivals: observances(todayKey(), 30).length }) };
wxLoad();
try { render(); if (!prefs.onboarded) onboard(1); if (window.SomaNative) SomaNative.appReady(); }
catch (e) { $('app').textContent = 'Unable to load: ' + e.message; if (window.SomaNative) SomaNative.appFailure(e.message); }
/* Background refresh: twice a day the shell opens the app off-screen (index.html?bg=1) so reminders keep
   their 30 days and the widgets their week even when Soma itself is not opened. */
if (/[?&]bg=1/.test(location.search) && window.SomaNative && SomaNative.bgDone) {
  try {
    if (saved.loc && prefs.onboarded) {
      pushWidgetFeed();
      if (SomaNative.scheduleReminders) SomaNative.scheduleReminders(JSON.stringify(reminderPlan()));
    }
  } catch (e) { if (SomaNative.appFailure) SomaNative.appFailure('background: ' + e.message); }
  SomaNative.bgDone();
}
/* The shared clock ticks just after every minute and whenever time may have moved under us (resume, focus,
   clock or time-zone change). Each screen repaints only as often as what it shows can change. */
let lastHourKey = '';
function tick(at, reason) {
  at = at || now();
  const today = K.dateKey(at, loc.zone), dayChanged = today !== lastToday, hourKey = today + 'T' + K.parts(at, loc.zone).hour;
  if (dayChanged) { if (day === lastToday) { day = today; monthView = today.slice(0, 7); hour = null; } lastToday = today; scheduleNative(true); }
  const hourChanged = hourKey !== lastHourKey; lastHourKey = hourKey;
  // Back from the background, focus, or a clock / time-zone change: time may have moved by hours, so repaint whatever is showing.
  const jumped = !!reason && reason !== 'minute';
  // Reminders are planned for the future only, so a changed clock re-plans them.
  if ((reason === 'clock' || reason === 'jump') && !dayChanged) scheduleNative(true);
  const live = day === today;
  const due = view === 'today' || view === 'muhurat' ? live || dayChanged
    : view === 'moon' ? (live && hour == null) || dayChanged
    : view === 'calendar' ? dayChanged
    : view === 'personal' ? hourChanged || dayChanged : false;
  // Never repaint under the reader's hands: an open sheet or a focused field waits for the next tick.
  const busy = $('modal').open || $('onboard').classList.contains('open') || (document.activeElement && $('app').contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName));
  if ((due || jumped) && !busy) render();
  else scheduleWidgetFeed();
}
Clock.onTick(tick);
$('modal').addEventListener('close', () => tick(now(), 'manual'));
document.addEventListener('visibilitychange', () => { if (!document.hidden) { applyTextScale(); autoCheckUpdate(); } });
// The native shell reports a return to the app as a 'resume' tick, which WebView's visibility event can miss.
Clock.onTick((at, reason) => { if (reason === 'resume' || reason === 'focus') autoCheckUpdate(); });
setTimeout(autoCheckUpdate, 1500);
if (window.matchMedia) { const mq = window.matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', () => { if (prefs.theme === 'auto') render(); }); }
