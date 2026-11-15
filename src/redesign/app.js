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
let view = 'today', day = K.dateKey(now(), loc.zone), lastToday = day, monthView = day.slice(0, 7), hour = null, practice = null, muhuratEvent = 'griha';
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
function toast(s) { $('toast').textContent = s; $('toast').style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => ($('toast').style.display = 'none'), 4000); }
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
const methodChip = () => `<button class="chip method" onclick="settings()">${esc(t('methodBase'))} · ${esc(t(prefs.month === 'purnimanta' ? 'purnimantaShort' : 'amantaShort'))} · ${esc(loc.name)}</button>`;
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
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  muhurat: '<path d="M12 3.2l2.3 5.4 5.8.6-4.4 3.9 1.3 5.7L12 15.9l-5 2.9 1.3-5.7-4.4-3.9 5.8-.6z"/>',
  moon: '<path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z"/>',
  personal: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c1.4-3.8 4.2-5.6 7.5-5.6s6.1 1.8 7.5 5.6"/>',
  sunrise: '<path d="M3 19h18M6.5 19a5.5 5.5 0 0 1 11 0M12 3.5v6M9.2 6.3 12 3.5l2.8 2.8M4.6 12.6l1.5 1.5M19.4 12.6l-1.5 1.5"/>',
  sunset: '<path d="M3 19h18M6.5 19a5.5 5.5 0 0 1 11 0M12 3.5v6M9.2 6.7 12 9.5l2.8-2.8M4.6 12.6l1.5 1.5M19.4 12.6l-1.5 1.5"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'
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
  const closeBottom = document.querySelector('#modal > .quiet'); if (closeBottom) closeBottom.textContent = t('close');
  $('nav').setAttribute('aria-label', t('mainNav'));
  if (prefs.theme === 'light' || prefs.theme === 'dark') root.setAttribute('data-theme', prefs.theme); else root.removeAttribute('data-theme');
  root.lang = L.lang;
}
function show(v) { if (v !== view) { haptic('select'); if (v === 'moon') hour = null; } view = v; render(); window.scrollTo(0, 0); }
function setDay(d) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < '1900-01-01' || d > '2100-12-31') return; if (d !== day) hour = null; day = d; monthView = d.slice(0, 7); render(); }
function datebar() {
  const label = new Intl.DateTimeFormat(locale(), { timeZone: loc.zone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(K.instant(day, '12:00', loc.zone));
  return `<div class="datebar"><button aria-label="${esc(t('prevDay'))}" onclick="setDay(K.addDay(day,-1))">‹</button><label class="datepick">${icon('calendar')}<span>${esc(label)}</span><input aria-label="${esc(t('pickDate'))}" type="date" min="1900-01-01" max="2100-12-31" value="${day}" onchange="setDay(this.value)"></label><button aria-label="${esc(t('nextDay'))}" onclick="setDay(K.addDay(day,1))">›</button>${isToday() ? '' : `<button class="now" onclick="setDay(todayKey())">${esc(t('today2'))}</button>`}</div>`;
}
let lastPaint = '';
function render() {
  applyTheme();
  $('location').innerHTML = icon('pin') + '<span>' + esc(loc.name) + '</span>';
  $('location').setAttribute('aria-label', t('changePlace') + ': ' + loc.name);
  const tabs = [['today', 'today'], ['calendar', 'calendar'], ['muhurat', 'muhurat'], ['personal', 'you']];
  const tabOf = view === 'moon' ? 'today' : view === 'learn' ? 'personal' : view;
  $('nav').innerHTML = tabs.map(([v, label]) => `<button class="${tabOf === v ? 'active' : ''}" aria-current="${tabOf === v ? 'page' : 'false'}" onclick="show('${v}')">${icon(v)}${esc(t(label))}</button>`).join('');
  // Entrance motion only when the screen changes, not on the minute tick.
  const paint = view + '|' + day + '|' + L.lang + '|' + prefs.layout;
  // A repaint of the same screen (the minute tick) keeps whatever the reader had opened.
  const opened = paint === lastPaint ? Array.from($('app').querySelectorAll('details')).map(x => x.open) : [];
  ({ today: todayView, calendar: calendarView, muhurat: muhuratView, moon: moonView, learn: learnView, personal: personalView })[view]();
  const app = $('app');
  app.classList.remove('enter', 'still');
  if (paint !== lastPaint) { void app.offsetWidth; app.classList.add('enter'); } else app.classList.add('still');
  app.querySelectorAll('details').forEach((x, i) => { if (opened[i]) x.open = true; });
  lastPaint = paint;
  scheduleWidgetFeed();
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
    const note = festNote(festival), win = (festival.rule === 'midnight' ? mark(festWindow(d, festival)) : festWindow(d, festival));
    const next = win && win.passed ? P.goodWindows(d, now(), { accept: SHUBH_CHOG })[0] || null : null;
    return { nature: 'good', parva: true, festival, win, next, ti, na, yo,
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
const festNote = f => f.note ? tr(f.note) : '';
/* The festival's own puja time today, following the rule the festival is kept by (festivals.js): a shubh Choghadiya
   in the day for sunrise, madhyahna and aparahna festivals, in pradosh (the first 2 h 24 min after sunset) for sunset
   festivals, and nishita kaal (the eighth of the night around its midpoint) for midnight festivals. The window must fall
   while the festival's own tithi runs; when none does, no puja time is offered. Moonrise festivals have no window here. */
const SHUBH_CHOG = c => c.key === 'amrit' || c.key === 'shubh' || c.key === 'labh';
function festWindow(d, f) {
  const fr = d.frame, rule = (f && f.rule) || 'sunrise';
  if (rule === 'moonrise') return null;
  const inTithi = w => !f || typeof f.tithi !== 'number' || (K.tithi(w.start).index === f.tithi && K.tithi(new Date(+w.end - 6e4)).index === f.tithi);
  if (rule === 'midnight') {
    // Nishita kaal is the 8th of the night's 15 muhurtas, centred on the night's midpoint (Shivratri 2026, New Delhi:
    // 12:09 to 1:00 am). It is the puja time of the night the festival is kept, even when the tithi ends just before it
    // (Janmashtami 2026 in Ahmedabad: Ashtami ends 12:14 am, nishita begins 12:15 am).
    const night = fr.nextSunrise - fr.sunset, mid = +fr.sunset + night / 2;
    return { start: new Date(mid - night / 30), end: new Date(mid + night / 30), key: 'nishita' };
  }
  const from = isToday() && now() > fr.sunrise ? now() : fr.sunrise;
  let wins = P.goodWindows(d, from, { accept: c => SHUBH_CHOG(c) && !c.night });
  if (rule === 'sunset') { const end = +fr.sunset + (fr.nextSunrise - fr.sunset) / 5; wins = P.goodWindows(d, fr.sunset, { accept: c => SHUBH_CHOG(c) && c.night }).filter(w => +w.start < end); }
  // Late in the day the window may have passed: name it as passed (never as if it were still ahead).
  return mark(wins.find(inTithi) || (rule !== 'sunset' && from > fr.sunrise ? P.goodWindows(d, fr.sunrise, { accept: c => SHUBH_CHOG(c) && !c.night }).find(inTithi) : null) || null);
}
// On today, a window that has already ended carries passed: true, so the hero says so and points at the next shubh time.
function mark(w) { return w && isToday() && +w.end <= +now() ? Object.assign({}, w, { passed: true }) : w; }
/* Before sunrise the Vedic day still running is yesterday's: on a festival night (Shivratri, Janmashtami, Kali Chaudas)
   the hero keeps that festival while its puja time is still ahead or running, instead of jumping to the new date at 12 am. */
function todayVerdict(d) {
  const v = verdict(d);
  if (!isToday() || now() >= d.frame.sunrise) return v;
  const vy = verdict(vedicDay(K.addDay(day, -1)));
  return vy.parva && vy.win && !vy.win.passed ? Object.assign(vy, { carried: true, until: d.frame.sunrise }) : v;
}
const festWindowLine = v => (v.carried ? t('carried', { time: fmt(v.until) }) + ' · ' : '') + festWindowCore(v);
const festWindowCore = v => {
  if (!v.win) return '';
  const vars = { span: span(v.win), chog: v.win.key === 'nishita' ? t('nishita') : L.chogName(v.win.key) };
  if (!v.win.passed) return t('festWindow', vars);
  return t('festPassed', vars) + (v.next ? ' · ' + t('nextShubhAt', { time: fmt(v.next.start) }) : '');
};
const verdictWord = n => n === 'good' ? t('favourable') : n === 'bad' ? t('takeCare') : n === 'festival' ? t('parva') : t('mixed');
const vWord = v => v.parva ? t('parva') : verdictWord(v.nature);
/* Rahu Kaal as a gentle heads-up: only while it runs or in the 30 minutes before. */
function rahuPill(d, cx) {
  const r = d.periods.rahu, at = cx.now; if (!at || !r) return '';
  if (r.start <= at && at < r.end) return `<span class="pill rahu bad"><i aria-hidden="true"></i>${esc(t('rahuNow', { time: fmt(r.end) }))}</span>`;
  const m = Math.round((r.start - at) / 6e4);
  return m > 0 && m <= 30 ? `<span class="pill rahu bad"><i aria-hidden="true"></i>${esc(t('rahuIn', { n: m }))}</span>` : '';
}
/* The next shubh Choghadiya from now (today's, else the Vedic day in force). */
const nextShubh = cx => cx.now ? (P.goodWindows(cx.dd, cx.now)[0] || null) : null;
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
      + `<p class="caption">${esc(t('wxUpdated', { t: fmt(new Date(wxData.at)) }))} · ${esc(loc.name)}</p><p class="caption">${esc(t('wxWidget'))}</p>`;
  }
  modal(`<div class="wxsheet"><div class="eyebrow">${esc(t('wxTitle'))} · ${esc(loc.name)}</div><h2 id="sheetTitle">${esc(t('wxLive'))}</h2>${body}`
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
function dialLabel(d, cx, next) {
  const rahu = span(d.periods.rahu);
  if (!cx.c) return t('dialSummaryDay', { d: dayLabel(day), rahu });
  return t('dialSummary', { chog: L.chogName(cx.c.key), nature: L.nature(cx.c.nature), time: fmt(cx.c.end), next: next ? L.chogName(next.key) + ' ' + span(next) : t('none'), rahu });
}
function dialHero(d, v, cx, eyebrow) {
  const next = nextShubh(cx);
  const dial = SomaDial.svg({ size: 340, hourOf, chog: cx.dd.choghadiya, rahu: d.periods.rahu, sunrise: cx.dd.frame.sunrise, sunset: cx.dd.frame.sunset, now: cx.now, label: dialLabel(d, cx, next) });
  // Lead with what to do: while a bad Choghadiya runs, the core names the next shubh time; the bad one is a quiet second line.
  const g = () => '';
  const chogLine = cx.c && cx.c.nature === 'bad' && next
    ? `<div class="chognow good">${g('good')}${esc(t('nextShubhAt', { time: fmt(next.start) }))}</div><div class="chogsub">${esc(t('nowChog', { chog: L.chogName(cx.c.key), time: fmt(cx.c.end) }))}</div>`
    : cx.c ? `<div class="chognow ${cx.c.nature}">${g(cx.c.nature)}${esc(L.chogName(cx.c.key))} · ${esc(until(cx.c.end))}</div>`
    : `<div class="chognow ${v.parva ? 'good' : v.nature}">${esc(vWord(v))}</div>`;
  const title = v.parva ? `<h2 class="festhead">${esc(L.festName(v.festival))}</h2><p>${esc(festWindowLine(v) || v.good)}</p>` : `<p>${esc(daySentence(v))}</p>`;
  const pill = rahuPill(d, cx), wx = wxLayer(d, cx);
  return `<section class="sky" data-sky="${cx.sky}"${wx.tint ? ` data-tint="${wx.tint}"` : ''}>${wx.fx}<div class="dateline"><span class="eyebrow">${eyebrow}</span>${wxChip(d, cx)}</div>`
    + `<div class="dialwrap">${dial.svg}<h1 class="tithi dialtitle">${esc(L.tithiName(cx.ti.index))}</h1><button class="dialcore" onclick="show('moon')" aria-label="${esc(t('moonPage'))}">${SomaDial.moon(44, cx.ti.angle)}<span class="tithi" aria-hidden="true">${esc(L.tithiName(cx.ti.index))}</span>${chogLine}</button></div>`
    + dialLegend() + `<div class="daytitle">${title}${pill ? `<div class="pillrow">${pill}</div>` : ''}</div>${sunStrip(d, cx)}</section>`;
}
/* A one-line key for the ring: shape and word, not colour alone. */
const dialLegend = () => `<div class="legend" aria-hidden="true"><span class="good"><i></i>${esc(t('good'))}</span><span class="neutral"><i></i>${esc(t('neutral'))}</span><span class="bad"><i></i>${esc(t('bad'))}</span><span class="rahu"><i></i>${esc(t('rahu'))}</span></div>`;
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
function horizonSvg(frac) {
  const w = 320, h = 96, b = (x0, c, x1, tt) => (1 - tt) * (1 - tt) * x0 + 2 * (1 - tt) * tt * c + tt * tt * x1, f = Math.min(1, Math.max(0, frac));
  const x = b(12, w / 2, w - 12, f), y = b(h - 8, -h * 0.6, h - 8, f);
  return `<svg class="horizon" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="M12 ${h - 8} Q ${w / 2} ${-h * 0.6} ${w - 12} ${h - 8}" stroke-dasharray="3 5"/><line x1="0" y1="${h - 8}" x2="${w}" y2="${h - 8}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" class="halo"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7.5" class="sun"/></svg>`;
}
function skyHero(d, v, cx, eyebrow) {
  // The horizon follows the civil day's sun, so before dawn the sun waits at the sunrise end.
  const night = cx.sky === 'night', f = d.frame, tithi = L.tithiName(cx.ti.index), next = nextShubh(cx);
  // Headline answers "what should I do now?": the festival on a festival day, the next shubh time while a bad
  // Choghadiya runs (the bad one becomes a small second line), else the running Choghadiya. Another day: the tithi.
  const leadNext = !v.parva && cx.c && cx.c.nature === 'bad' && next;
  const big = v.parva ? L.festName(v.festival) : leadNext ? L.chogName(next.key) : cx.c ? L.chogName(cx.c.key) : tithi;
  const pill = (n, word) => `<span class="pill ${n}"><i aria-hidden="true"></i>${esc(word)}</span>`;
  const status = v.parva ? `<div class="status">${pill('good', t('parva'))}${cx.c ? `<span>${esc(t('nowChog', { chog: L.chogName(cx.c.key), time: fmt(cx.c.end) }))}</span>` : ''}</div>`
    : leadNext ? `<div class="status">${pill('good', t('nextShubh'))}<span>${esc(t('fromT', { time: fmt(next.start) }))}${rel(next, cx.now) ? ' · ' + esc(rel(next, cx.now)) : ''}</span></div>`
    : cx.c ? `<div class="status">${pill(cx.c.nature, L.nature(cx.c.nature))}<span>${esc(until(cx.c.end))}${rel(cx.c, cx.now) ? ' · ' + esc(rel(cx.c, cx.now)) : ''}</span></div>`
    : `<div class="status">${pill(v.nature, vWord(v))}</div>`;
  const line = v.parva ? (festWindowLine(v) || v.good) : leadNext ? tr(M.CHOG[next.key].good) + ' · ' + t('nowChog', { chog: L.chogName(cx.c.key), time: fmt(cx.c.end) }) : cx.c ? tr(M.CHOG[cx.c.key].good) : daySentence(v);
  const visual = night ? `<div class="skymoon">${SomaDial.moon(88, cx.ti.angle)}</div>` : horizonSvg((cx.at - f.sunrise) / (f.sunset - f.sunrise));
  const facts = `<div class="facts"><button onclick="show('moon')">${SomaDial.moon(18, cx.ti.angle)}<span>${esc(tithi)}</span></button><span>${esc(L.nakName(d.sunriseLimbs.nakshatra.index))}</span>${rahuPill(d, cx)}</div>`;
  const wx = wxLayer(d, cx), chip = wxChip(d, cx);
  return `<section class="skyhero" data-sky="${cx.sky}"${wx.tint ? ` data-tint="${wx.tint}"` : ''}>${night && !wx.tint ? stars(70, 7) : ''}${wx.fx}<div class="eyebrow">${eyebrow}</div>${chip ? `<div class="wxrow">${chip}</div>` : ''}${status}<h1 class="big">${esc(big)}</h1><p class="lineone">${esc(line)}</p>`
    + `${visual}<div class="skyfoot">${sunStrip(d, cx)}${facts}</div></section>`;
}
function folioHero(d, v, cx, eyebrow, monthName) {
  const head = v.parva ? '*' + L.festName(v.festival) + '*' : v.nature === 'good' ? t('folioGood') : v.nature === 'bad' ? t('folioBad') : t('folioMixed');
  const lede = v.parva ? [festNote(v.festival), festWindowLine(v)].filter(Boolean).join(' · ') : t('goodFor') + ': ' + v.good + (v.nature === 'good' ? '' : ' · ' + t('avoid') + ': ' + v.avoid);
  const sun = [{ at: d.frame.sunrise, html: `<span>${icon('sunrise', 'ic')} ${esc(t('sunrise'))}</span><span class="k"></span>` }, { at: d.frame.sunset, html: `<span>${icon('sunset', 'ic')} ${esc(t('sunset'))}</span><span class="k"></span>` }];
  const items = sun.concat(d.choghadiya.filter(c => !c.night).map(c => ({ at: c.start, html: `<span>${esc(L.chogName(c.key))}${cx.now && c.start <= cx.now && cx.now < c.end ? ` <span class="k good">· ${esc(t('running'))}</span>` : ''}</span><span class="k ${c.nature}">${esc(L.nature(c.nature))}</span>` })))
    .concat([{ at: d.periods.rahu.start, html: `<span>${esc(t('rahu'))}</span><span class="k bad">→ ${fmt(d.periods.rahu.end)}</span>` }])
    .concat(d.periods.abhijit.wednesday ? [] : [{ at: d.periods.abhijit.start, html: `<span>${esc(t('abhijit'))}</span><span class="k good">→ ${fmt(d.periods.abhijit.end)}</span>` }])
    .sort((a, b) => a.at - b.at);
  const chip = wxChip(d, cx);
  return `<section class="folio"><div class="row"><span class="eyebrow">${eyebrow}</span></div><div class="rule"></div>${chip ? `<div class="wxrow">${chip}</div>` : ''}`
    + `<div class="eyebrow accent">${esc(monthName)} · ${esc(L.tithiName(cx.ti.index))}</div><h1 class="headline">${emph(head)}</h1><p class="lede">${esc(lede)}</p>${sunStrip(d, cx)}`
    + `<div class="hairline"></div><div class="eyebrow">${esc(t('hourByHour'))}</div>${items.map(i => `<div class="tl"><span class="t">${fmt(i.at)}</span>${i.html}</div>`).join('')}</section>`;
}
function festivalToday(key) {
  const list = observances(K.addDay(key, -1), 50), todays = list.filter(x => x.day === key), yesterdayEkadashi = list.find(x => x.key === 'ekadashi' && x.parana && x.parana.day === key);
  let html = '';
  for (const f of todays) {
    html += `<div class="card festival ${f.kind}"><div class="eyebrow">${esc(t('festivalsToday'))}</div><h2>${esc(L.festName(f))}</h2>${f.note ? `<p>${esc(festNote(f))}</p>` : ''}${f.kind === 'festival' ? `<p>${esc(t('festDayNote'))}</p>` : ''}${indiaLine(f)}`
      + (f.key === 'ekadashi' ? `<p>${esc(t('fastBegins'))} · ${fmt(vedicDay(key).frame.sunrise)}</p>${f.parana ? `<p><strong>${esc(t('parana'))}:</strong> ${dayLabel(f.parana.day)} · ${span(f.parana)}</p>` : ''}` : '')
      + (f.sutak ? `<p>${esc(t('sutakLine', { a: full(f.sutak), b: full(f.at) }))}</p>` : '') + '</div>';
  }
  if (yesterdayEkadashi) html += `<div class="card festival vrat"><div class="eyebrow">${esc(t('parana'))}</div><h2>${span(yesterdayEkadashi.parana)}</h2><p>${esc(L.festName(yesterdayEkadashi))} · ${esc(t('dwadashiEnds', { time: fmt(yesterdayEkadashi.parana.dwadashiEnd) }))}</p></div>`;
  return { html, list };
}
let upList = [];
function comingUp(key, list) {
  upList = list.filter(x => x.day > key).slice(0, 8);
  return `<section class="section">${groupHead(t('ovAhead'), esc(t('comingUp')), `<button class="quiet" onclick="show('calendar')">${esc(t('allYear'))}</button>`)}`
    + (upList.length ? `<div class="upnext">${upList.map((f, i) => { const n = daysBetween(key, f.day); return `<button onclick="festivalStory(${i})"><span class="when">${n === 1 ? esc(t('tomorrow')) : esc(t('inDays', { n }))}</span><b>${esc(L.festName(f))}</b><small>${dayLabel(f.day)}</small></button>`; }).join('')}</div>` : `<p>${esc(t('none'))}</p>`) + '</section>';
}
function festivalStory(i) {
  const f = upList[i]; if (!f) return;
  const date = K.instant(f.day, '12:00', loc.zone), n = new Intl.DateTimeFormat(locale(), { timeZone: loc.zone, day: 'numeric' }).format(date);
  modal(`<div class="row" style="align-items:flex-end"><div class="number" style="font-size:6rem">${esc(n)}</div><div style="text-align:right" class="eyebrow">${esc(new Intl.DateTimeFormat(locale(), { timeZone: loc.zone, weekday: 'long', month: 'long' }).format(date))}</div></div>`
    + `<h2 id="sheetTitle" style="font-size:2.125rem;margin-top:10px">${esc(L.festName(f))}</h2>${f.note ? `<p style="color:var(--ink)">${esc(festNote(f))}</p>` : ''}${indiaLine(f)}`
    + (f.parana ? `<div class="list"><div class="timeline"><i class="dot vrat"></i><div><strong>${esc(t('parana'))}</strong><p>${dayLabel(f.parana.day)}</p></div><div class="right">${span(f.parana)}</div></div></div>` : '')
    + (f.sutak ? `<p>${esc(t('sutakLine', { a: full(f.sutak), b: full(f.at) }))}</p>` : '')
    + `<button class="primary" onclick="document.querySelector('dialog').close();setDay('${f.day}')">${esc(t('goToDay'))}</button>`);
}
function nowNext(d, cx) {
  // Running Choghadiya and Hora come from the Vedic day in force (yesterday's before sunrise); Rahu Kaal, Abhijit and the rest belong to the selected day.
  const dd = cx.dd, now = cx.now, per = d.periods, rows = [];
  const row = (name, sub, p, nature) => { const r = rel(p, now); rows.push(`<div class="nn${p && now && p.end <= now ? ' past' : ''}"><i class="dot ${nature}" aria-hidden="true"></i><div class="label"><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div><div class="when">${span(p)}${r ? `<em class="${nature}">${esc(r)}</em>` : ''}</div></div>`); };
  if (now) {
    const next = P.goodWindows(dd, now)[0] || (dd !== d ? P.goodWindows(d, now)[0] : null), h = P.at(dd.hora, now);
    if (next) row(t('nextGood'), L.chogName(next.key) + ' · ' + tr(M.CHOG[next.key].good), next, 'good');
    if (h) row(t('hora') + ' · ' + L.planetName(h.lord), tr(M.PLANET[h.lord].good), h, h.nature);
  }
  row(t('rahu'), '', per.rahu, 'bad');
  if (!per.abhijit.wednesday) row(t('abhijit'), '', per.abhijit, 'good');
  const more = [['yamaganda', per.yamaganda, 'bad'], ['gulika', per.gulika, 'bad'], ['brahma', per.brahma, 'good']]
    .map(([k, p, n]) => `<div class="nn${p && now && p.end <= now ? ' past' : ''}"><i class="dot ${n}" aria-hidden="true"></i><div class="label"><b>${esc(t(k))}</b></div><div class="when">${span(p)}</div></div>`).join('');
  return `<section class="section">${groupHead(t('ovNow'), esc(t('nowAndNext')))}${dayStrip(d)}<div class="list">${rows.join('')}</div><details><summary>${esc(t('moreTimes'))}</summary><div class="list">${more}</div></details></section>`;
}
function practiceCard(d) {
  const chips = M.PRACTICES.map(p => `<button class="chip ${practice === p.key ? 'on' : ''}" onclick="practice=practice==='${p.key}'?null:'${p.key}';todayView()">${esc(L.practiceName(p))}</button>`).join('');
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
  return `<section class="section">${groupHead(t('ovPractice'), esc(t('whatToday')))}<div class="chipRow">${chips}</div><div class="card">${body}</div></section>`;
}
function personalLine(d) {
  const bm = birthMoon();
  if (bm == null) return `<button class="lesson" onclick="editProfile()"><div class="eyebrow">${esc(t('forYou'))}</div><h3>${esc(t('addBirth'))} <span>›</span></h3><span>${esc(t('chandrabalam'))} · ${esc(t('tarabalam'))}</span></button>`;
  const p = P.personal(bm, isToday() ? now() : d.frame.sunrise);
  return `<div class="card personalDay ${p.verdict}"><div class="row"><div class="eyebrow">${esc(t('forYou'))}</div>${badge(p.verdict)}</div><h2 style="margin-top:6px">${esc(verdictWord(p.verdict))}</h2><p>${esc(t('chandrabalam'))}: ${esc(t('chandraLine', { n: L.lang === 'en' ? p.chandraCount + ['th', 'st', 'nd', 'rd'][p.chandraCount % 10 > 3 || [11, 12, 13].indexOf(p.chandraCount) >= 0 ? 0 : p.chandraCount % 10] : num(p.chandraCount), rashi: L.rashiName(p.janmaRashi) }))} · ${esc(t(p.chandraGood ? 'strong' : 'weak'))}</p><p>${esc(t('tarabalam'))}: ${esc(tr(M.TARA[p.tara.key]))}</p></div>`;
}
function limbsCard(d, v) {
  const l = d.sunriseLimbs, ti = M.tithi(l.tithi.index), na = M.nakshatra(l.nakshatra.index), yo = M.YOGA[l.yoga.index], ka = M.KARANA[l.karana.index], va = M.VAAR[d.frame.weekday];
  const row = (label, name, end, note, nature) => `<div class="timeline"><i class="dot ${nature || ''}" aria-hidden="true"></i><div><div class="eyebrow">${esc(label)}</div><strong>${esc(name)}</strong><p>${esc(note)}</p></div><div class="right">${nature ? badge(nature) : ''}${end ? '<br>' + esc(t('untilT', { time: full(end) })) : ''}</div></div>`;
  return `<section class="section">${groupHead(t('ovPanchang'), esc(t('todayTitle')))}`
    + `<div class="card verdict"><div class="row"><span class="eyebrow">${esc(t('details'))}</span>${badge(v.parva ? 'festival' : v.nature)}</div><p><strong>${esc(t('goodFor'))}:</strong> ${esc(v.good)}.</p><p><strong>${esc(t('avoid'))}:</strong> ${esc(v.avoid)}.</p></div><div class="list">`
    + row(t('tithi'), L.tithiName(l.tithi.index), l.tithi.end, tr(ti.deity) + ' · ' + tr(ti.group) + '. ' + tr(ti.note), ti.nature)
    + row(t('nakshatra'), L.nakName(l.nakshatra.index) + ' ' + num(l.nakshatra.pada), l.nakshatra.end, tr(na.deity) + ' · ' + tr(na.group) + '. ' + t('goodForX', { x: tr(na.good) }), na.nature)
    + row(t('yoga'), L.yogaName(l.yoga.index), l.yoga.end, yo.nature === 'bad' ? t('yogaBad') : t('yogaGood'), yo.nature)
    + row(t('karana'), L.karanaName(l.karana.index), l.karana.end, l.karana.index === 6 ? t('bhadraNote') : t('halfTithi'), ka.nature)
    + row(t('vaar'), L.vaarName(d.frame.weekday), null, t('vaarLine', { deity: tr(va.deity), good: tr(va.good), avoid: tr(va.avoid) }), null)
    + `</div><div style="margin-top:10px">${methodChip()}</div></section>`
    + `<section class="section">${groupHead(t('ovSky'), esc(t('moon')), `<button class="quiet" onclick="show('moon')">${esc(t('moon'))} ›</button>`)}<div class="grid2">`
    + [['moonrise', d.frame.data.moonrise], ['moonset', d.frame.data.moonset]].map(([k, v2]) => `<div class="card"><div class="caption">${esc(t(k))}</div><div class="value">${fmt(v2)}</div></div>`).join('') + '</div></section>';
}
function todayView() {
  const d = vedicDay(day), v = todayVerdict(d), cx = heroContext(d);
  const monthName = P.monthName(d.frame.sunrise, prefs.month, L.monthNames), samvat = P.samvat(d.frame.sunrise, samvatSystem());
  const eyebrow = esc(new Intl.DateTimeFormat(locale(), { timeZone: loc.zone, weekday: 'long', day: 'numeric', month: 'short' }).format(K.instant(day, '12:00', loc.zone))) + ' · ' + esc(monthName) + ' · ' + esc(t('samvat')) + ' ' + samvat;
  const hero = prefs.layout === 'sky' ? skyHero(d, v, cx, eyebrow) : prefs.layout === 'folio' ? folioHero(d, v, cx, eyebrow, monthName) : dialHero(d, v, cx, eyebrow);
  const fest = festivalToday(day);
  const polar = d.frame.polar ? `<p class="notice card">${esc(t('polarNote'))}</p>` : '';
  $('app').innerHTML = `<div class="split"><div class="lead">${hero}${datebar()}</div><div class="rest">`
    + polar + fest.html + nowNext(d, cx) + comingUp(day, fest.list) + `<section class="section">${personalLine(d)}</section>` + practiceCard(d) + limbsCard(d, v)
    + `<div class="tiles section"><button onclick="plan()">${icon('calendar')}<b>${esc(t('planEvent'))}</b></button><button onclick="show('learn')">${icon('moon')}<b>${esc(t('learnMore'))}</b></button></div></div></div>`;
  scheduleNative();
  wxRequest();
}

// ---- Calendar ---------------------------------------------------------------------------------
function changeMonth(n) { haptic('select'); const d = new Date(monthView + '-15T12:00Z'); d.setUTCMonth(d.getUTCMonth() + n); monthView = d.toISOString().slice(0, 7); calendarView(); }
function toggleSet(s) {
  const i = prefs.sets.indexOf(s);
  if (i >= 0) prefs.sets.splice(i, 1); else prefs.sets.push(s);
  prefs.custom = true; persist(); scheduleNative(true); render();
}
function setMonthSys(v) { prefs.month = v; prefs.monthChosen = true; persist(); haptic('select'); scheduleNative(true); if (onboardStep) onboard(onboardStep); else render(); }
function setChips(after) { return `<div class="chipRow">${Fe.SETS.map(s => `<button class="chip ${prefs.sets.indexOf(s) >= 0 ? 'on' : ''}" aria-pressed="${prefs.sets.indexOf(s) >= 0}" onclick="toggleSet('${s}')${after ? ';' + after : ''}">${esc(t('sets')[s])}</button>`).join('')}</div>`; }
const PAKSHA = { en: ['Shukla', 'Krishna'], gu: ['સુદ', 'વદ'], hi: ['शुक्ल', 'कृष्ण'] };
const shortTithi = i => i === 14 || i === 29 ? L.tithiName(i) : PAKSHA[L.lang][i >= 15 ? 1 : 0] + ' ' + (i % 15 + 1);
/* Calendar: the month as a panchang. Each day carries its moon, tithi and festival; the chosen day opens as a full
   panchang card (five limbs with end times, sun and moon, Rahu Kaal and the day strip). Festivals list only what is
   still ahead, from today; the month's earlier ones fold away. */
function calendarView() {
  const first = monthView + '-01', start = new Date(first + 'T12:00Z').getUTCDay(), count = new Date(+monthView.slice(0, 4), +monthView.slice(5), 0).getDate();
  const fest = observances(first, count + 1), bm = birthMoon(), tk = todayKey();
  let cells = '<span></span>'.repeat(start);
  for (let n = 1; n <= count; n++) {
    const key = monthView + '-' + String(n).padStart(2, '0'), data = K.dayData(key, loc), ti = data.atSunrise || K.tithi(K.instant(key, '12:00', loc.zone));
    const f = fest.filter(x => x.day === key && x.day <= K.addDay(first, count - 1)), top = f.find(x => x.kind !== 'vrat') || f[0];
    const pd = bm != null && data.sunrise ? P.personal(bm, data.sunrise).verdict : null;
    const special = ti.index === 14 ? ' purnima' : ti.index === 29 ? ' amas' : ti.index === 10 || ti.index === 25 ? ' ekadashi' : '';
    cells += `<button onclick="setDay('${key}')" class="${key === day ? 'selected ' : ''}${key === tk ? 'today ' : ''}${key < tk ? 'gone ' : ''}${top ? 'holy ' + top.kind : ''}${pd === 'good' ? ' mine' : ''}${special}" aria-label="${dayLabel(key)} ${esc(L.tithiName(ti.index))}${top ? ' · ' + esc(L.festName(top)) : ''}"${key === day ? ' aria-current="date"' : ''}><span class="n">${num(n)}</span>${SomaDial.moon(18, ti.angle)}<small>${esc(top ? L.festName(top) : shortTithi(ti.index))}</small>${top ? '<em aria-hidden="true"></em>' : ''}</button>`;
  }
  const sel = fest.filter(x => x.day === day), d = vedicDay(day), mine = events.filter(e => e.day === day);
  const weekNames = [0, 1, 2, 3, 4, 5, 6].map(i => new Intl.DateTimeFormat(locale(), { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + i))));
  const m1 = P.monthName(K.instant(first, '12:00', loc.zone), prefs.month, L.monthNames), m2 = P.monthName(K.instant(monthView + '-' + count, '12:00', loc.zone), prefs.month, L.monthNames);
  const samvat = P.samvat(K.instant(first, '12:00', loc.zone), samvatSystem());
  const monthTitle = new Date(first + 'T12:00Z').toLocaleDateString(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const lead = `<div class="eyebrow">${esc(m1 === m2 ? m1 : m1 + ' – ' + m2)} · ${esc(t('samvat'))} ${num(samvat)}</div>`
    + `<div class="monthhead"><h1>${esc(monthTitle)}</h1><div class="arrows">${monthView !== tk.slice(0, 7) ? `<button class="now" onclick="setDay(todayKey())">${esc(t('today2'))}</button>` : ''}<button onclick="changeMonth(-1)" aria-label="${esc(t('prevMonth'))}">‹</button><button onclick="changeMonth(1)" aria-label="${esc(t('nextMonth'))}">›</button></div></div>`
    + `<div class="week">${weekNames.map(w => `<span>${esc(w)}</span>`).join('')}</div><div class="calendar">${cells}</div>`
    + `<div class="legend callegend" aria-hidden="true"><span class="fest"><i></i>${esc(t('ovFest'))}</span><span class="vrat"><i></i>${esc(t('vratWord'))}</span>${bm != null ? `<span class="mine"><i></i>${esc(t('personalDays'))}</span>` : ''}</div>`
    + `<details class="setfilter"><summary>${esc(t('showFestivals'))}</summary>${setChips()}</details>`;
  const l = d.sunriseLimbs, cell = (label, name, end, nature) => `<div class="pcell"><div class="caption">${esc(label)}</div><b>${esc(name)}</b>${end ? `<small>${esc(until(end))}</small>` : ''}${nature ? `<i class="dot ${nature}" aria-hidden="true"></i>` : ''}</div>`;
  const panchangCard = `<div class="card pcard">`
    + `<div class="pgrid">${cell(t('tithi'), L.tithiName(l.tithi.index), l.tithi.end, M.tithi(l.tithi.index).nature)}${cell(t('nakshatra'), L.nakName(l.nakshatra.index), l.nakshatra.end, M.nakshatra(l.nakshatra.index).nature)}`
    + `${cell(t('yoga'), L.yogaName(l.yoga.index), l.yoga.end, M.YOGA[l.yoga.index].nature)}${cell(t('karana'), L.karanaName(l.karana.index), l.karana.end, M.KARANA[l.karana.index].nature)}`
    + `${cell(t('vaar'), L.vaarName(d.frame.weekday))}${cell(t('month'), P.monthName(d.frame.sunrise, prefs.month, L.monthNames))}</div>`
    + `<div class="psun"><span>${icon('sunrise')}<b>${esc(fmt(d.frame.sunrise))}</b></span><span>${icon('sunset')}<b>${esc(fmt(d.frame.sunset))}</b></span><span>${icon('moon')}<b>${esc(fmt(d.frame.data.moonrise))}</b></span></div>`
    + dayStrip(d, { half: 'day' }) + `</div>`;
  const dayFest = sel.map(f => `<div class="timeline"><i class="dot ${f.kind}"></i><div><strong>${esc(L.festName(f))}</strong>${f.parana ? `<p>${esc(t('parana'))}: ${dayLabel(f.parana.day)} ${span(f.parana)}</p>` : ''}${f.note ? `<p>${esc(festNote(f))}</p>` : ''}${indiaLine(f)}</div></div>`).join('')
    + mine.map(e => `<div class="timeline"><i class="dot good"></i><div><strong>${esc(e.title)}</strong><p>${esc(e.time)} · ${esc(e.muhurat)}</p></div></div>`).join('');
  // Festivals: from today forward when this month holds today (and on past the month's end), else the month's own list.
  const thisMonth = monthView === tk.slice(0, 7), future = monthView > tk.slice(0, 7);
  const ahead = thisMonth ? observances(tk, 30) : future ? fest.filter(x => x.day >= first && x.day.slice(0, 7) === monthView) : [];
  const earlier = thisMonth ? fest.filter(x => x.day >= first && x.day < tk) : !future ? fest.filter(x => x.day >= first && x.day.slice(0, 7) === monthView) : [];
  const festRow = (f, past) => { const n = daysBetween(tk, f.day); const when = past ? '' : n === 0 ? t('todayWord') : n === 1 ? t('tomorrow') : t('inDays', { n: num(n) });
    return `<button type="button" class="timeline rowbtn${past ? ' gone' : ''}" onclick="setDay('${f.day}')" aria-label="${esc(t('openDayLabel', { d: dayLabel(f.day), what: L.festName(f) }))}"><i class="dot ${f.kind}" aria-hidden="true"></i><div><strong>${esc(L.festName(f))}</strong><p>${dayLabel(f.day)}${f.parana ? ' · ' + esc(t('parana')) + ' ' + span(f.parana) : ''}</p></div>${when ? `<span class="when">${esc(when)}</span>` : ''}<span class="chev" aria-hidden="true">›</span></button>`; };
  const festSec = `<section class="section">${groupHead(t('ovFest'), esc(thisMonth ? t('comingUp') : t('festIn', { m: new Date(first + 'T12:00Z').toLocaleDateString(locale(), { month: 'long', timeZone: 'UTC' }) })))}`
    + (ahead.length || !earlier.length ? `<div class="list">${ahead.map(f => festRow(f, false)).join('') || `<p style="padding:14px 0">${esc(t('none'))}</p>`}</div>` : '')
    + (earlier.length ? (thisMonth ? `<details><summary>${esc(t('earlierMonth'))} (${num(earlier.length)})</summary><div class="list">${earlier.map(f => festRow(f, true)).join('')}</div></details>` : `<div class="list">${earlier.map(f => festRow(f, true)).join('')}</div>`) : '')
    + `</section>`;
  const rest = `<section class="section">${groupHead(day === tk ? t('todayWord') : t('ovDay'), titleDay(day))}${panchangCard}${dayFest ? `<div class="list">${dayFest}</div>` : ''}`
    + `<div class="grid3" style="margin-top:10px"><button class="chip" onclick="show('today')">${esc(t('details'))}</button><button class="chip" onclick="show('muhurat')">${esc(t('muhurat'))}</button><button class="chip on" onclick="plan()">＋ ${esc(t('addEvent'))}</button></div></section>`
    + festSec
    + `<section class="section">${groupHead(t('ovPlans'), esc(t('myPlans')) + ` <span class="caption">${events.length}</span>`)}${events.length ? `<div class="list">${events.slice().sort((a, b) => a.start.localeCompare(b.start)).map(e => `<div class="timeline"><i class="dot good"></i><div><strong>${esc(e.title)}</strong><p>${esc(e.day)} · ${esc(e.time)} · ${esc(e.place)}</p><p>${esc(e.tithi)}${e.muhurat ? ' · ' + esc(e.muhurat) : ''}</p><button class="quiet" onclick="exportEvent('${e.id}')">${esc(t('addToCal'))}</button></div><div class="right"><button class="quiet" aria-label="${esc(t('deleteEvent'))}: ${esc(e.title)}" onclick="deleteEvent('${e.id}')">×</button></div></div>`).join('')}</div>` : `<div class="card"><h3>${esc(t('emptyPlansTitle'))}</h3><p>${esc(t('emptyPlansBody'))}</p></div>`}</section>`;
  $('app').innerHTML = `<div class="split"><div class="lead">${lead}</div><div class="rest">${rest}</div></div>`;
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
    if (win) out.push({ key, d, win, why: `${tr(na.group)} ${t('nakshatra')} (${L.nakName(l.nakshatra.index)}) · ${tr(ti.group)} ${t('tithi')} · ${L.vaarName(d.frame.weekday)}` });
  }
  return out;
}
/* The day's verdict from its panchang (tithi, nakshatra, yoga, karana at sunrise), and what is running now. */
function muhuratSummary(d) {
  const v = verdict(d), live = isToday(), dd = live ? frameFor(now()) : d, c = live ? P.at(dd.choghadiya, now()) : null;
  return `<div class="card verdict msum"><div class="row"><span class="eyebrow">${esc(t('panchangShuddhi'))}</span>${badge(v.parva ? 'festival' : v.nature)}</div>`
    + `<h2 style="margin:6px 0 4px">${esc(v.parva ? L.festName(v.festival) : vWord(v))}</h2>`
    + `<p><strong>${esc(t('goodFor'))}:</strong> ${esc(v.good)}.</p><p><strong>${esc(t('avoid'))}:</strong> ${esc(v.avoid)}.</p>`
    + (c ? `<p class="nowchog"><i class="dot ${c.nature}" aria-hidden="true"></i>${esc(t('nowChog', { chog: L.chogName(c.key), time: fmt(c.end) }))}</p>` : '') + `</div>`;
}
function muhuratView() {
  const d = vedicDay(day), at = now(), live = isToday();
  const list = (items, nameOf, tipOf) => items.map(p => `<div class="timeline ${live && p.start <= at && at < p.end ? 'current' : live && p.end <= at ? 'past' : ''}"><i class="dot ${p.nature}" aria-hidden="true"></i><div><strong>${esc(nameOf(p))}</strong><p>${esc(tipOf(p))}</p></div><div class="right">${span(p)}<br>${badge(p.nature)}</div></div>`).join('');
  const ev = muhuratDays(muhuratEvent, day, 60);
  const lead = `<div class="eyebrow">${esc(L.vaarName(d.frame.weekday))} · ${esc(L.tithiName(d.sunriseLimbs.tithi.index))}</div><h1>${esc(t('muhurat'))}</h1>${datebar()}`
    + muhuratSummary(d);
  const finder = `<section class="section">${groupHead(t('ovPlan'), esc(t('findMuhurat')))}<label>${esc(t('eventType'))}<select onchange="muhuratEvent=this.value;muhuratView()">${M.EVENTS.map(e => `<option value="${e.key}" ${e.key === muhuratEvent ? 'selected' : ''}>${esc(tr(e.en))}</option>`).join('')}</select></label>`
    + `<div class="list"><div class="timeline"><div><div class="eyebrow">${esc(t('goodDays'))}</div></div></div>${ev.length ? ev.map(x => `<button type="button" class="timeline rowbtn" onclick="setDay('${x.key}')" aria-label="${esc(t('openDayLabel', { d: dayLabel(x.key), what: L.chogName(x.win.key) + ' ' + span(x.win) }))}"><i class="dot good" aria-hidden="true"></i><div><strong>${dayLabel(x.key)} · ${span(x.win)} · ${esc(L.chogName(x.win.key))}</strong><p>${esc(t('why'))}: ${esc(x.why)}</p></div><span class="chev" aria-hidden="true">›</span></button>`).join('') : `<p style="padding:14px 0">${esc(t('noGoodDays'))}</p>`}</div>`
    + `<p class="caption" style="margin-top:10px">${esc(t('vivahNote'))}</p></section>`;
  // The board keeps Shubh and Avoid in separate columns, so nobody skimming a "best times" list lands in Rahu Kaal.
  const rest = dayBoard(d)
    + `<section class="section"><details><summary>${esc(t('choghadiya'))} · ${esc(t('day'))} (8)</summary><div class="list chog">${list(d.choghadiya.filter(c => !c.night), c => L.chogName(c.key), c => tr(M.CHOG[c.key].good))}</div></details>`
    + `<details><summary>${esc(t('choghadiya'))} · ${esc(t('night'))} (8)</summary><div class="list chog">${list(d.choghadiya.filter(c => c.night), c => L.chogName(c.key), c => tr(M.CHOG[c.key].good))}</div></details>`
    + `<details><summary>${esc(t('hora'))} (24)</summary><div class="list">${list(d.hora, h => L.planetName(h.lord), h => tr(M.PLANET[h.lord].good))}</div></details></section>`
    + finder;
  $('app').innerHTML = `<div class="split"><div class="lead">${lead}</div><div class="rest">${rest}</div></div>`;
}

// ---- Moon -------------------------------------------------------------------------------------
function drawMoon(id, angle) {
  const c = $(id); if (!c) return;
  const ctx = c.getContext('2d'), size = c.width, r = size * 0.48, mid = size / 2, phase = (angle * Math.PI) / 180;
  ctx.clearRect(0, 0, size, size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x - mid) / r, ny = (y - mid) / r, q = nx * nx + ny * ny;
    if (q > 1) continue;
    const z = Math.sqrt(1 - q), light = Math.max(0, nx * Math.sin(phase) - z * Math.cos(phase)), noise = (Math.sin(x * 0.7 + y * 0.31) * Math.sin(x * 0.21 - y * 0.47) + 1) * 0.04, v = light > 0 ? 0.47 + 0.48 * Math.sqrt(light) - noise : 0.11;
    const i = (y * size + x) * 4; img.data[i] = Math.round(244 * v); img.data[i + 1] = Math.round(234 * v); img.data[i + 2] = Math.round(214 * v); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
/* The Moon page's time of day: what the reader scrubbed to, else now on today and noon on any other day. */
function moonHour() {
  if (hour != null) return hour;
  if (!isToday()) return 12;
  const p = K.parts(now(), loc.zone);
  return Math.min(23.75, Math.floor((+p.hour + p.minute / 60) * 4) / 4);
}
function moonView() {
  const h = moonHour(), live = hour == null && isToday();
  const d = live ? now() : K.instant(day, String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.round((h % 1) * 60)).padStart(2, '0'), loc.zone), ti = K.tithi(d), data = K.dayData(day, loc), illum = A.Illumination('Moon', d);
  const nk = P.nakshatra(d), rashi = Math.floor(P.moonSid(d) / 30);
  const next = [0, 90, 180, 270].map((a, i) => ({ name: L.tithiName([29, 7, 14, 22][i]), d: A.SearchMoonPhase(a, d, 32).date })).sort((a, b) => a.d - b.d);
  const lead = `<div class="eyebrow">${esc(t('moonTitle'))}</div><h1>${esc(L.tithiName(ti.index))}</h1><p>${titleDay(day)}</p><div class="moonbox"><canvas width="420" height="420" id="largeMoon" role="img" aria-label="${esc(t('moonIllum'))} ${Math.round(illum.phase_fraction * 100)}%"></canvas></div>`
    + `<div style="text-align:center"><h2>${num(Math.round(illum.phase_fraction * 100))}%</h2><p>${esc(L.nakName(nk.index))} ${num(nk.pada)} · ${esc(L.rashiName(rashi))}</p></div>`
    + `<label>${live ? esc(t('now')) + ' · ' : ''}<span id="scrubTime">${fmt(d)}</span><input aria-label="${esc(t('timeOfDay'))}" type="range" min="0" max="23.75" step="0.25" value="${h}" oninput="$('scrubTime').textContent=String(Math.floor(this.value)).padStart(2,'0')+':'+String(Math.round(this.value%1*60)).padStart(2,'0')" onchange="hour=+this.value;moonView()"></label>${datebar()}`;
  const rest = `<div class="grid2"><div class="card"><div class="caption">${esc(t('moonrise'))}</div><div class="value">${fmt(data.moonrise)}</div></div><div class="card"><div class="caption">${esc(t('moonset'))}</div><div class="value">${fmt(data.moonset)}</div></div></div>`
    + `<section class="section"><h2>${esc(t('comingUp'))}</h2><div class="list">${next.map(e => `<div class="timeline"><i class="dot"></i><div><strong>${esc(e.name)}</strong></div><div class="right">${full(e.d)}</div></div>`).join('')}</div></section>`;
  $('app').innerHTML = `<div class="split"><div class="lead">${lead}</div><div class="rest">${rest}</div></div>`;
  drawMoon('largeMoon', ti.angle);
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
function learnView() {
  $('app').innerHTML = `<div class="eyebrow">${esc(t('learnTitle'))}</div><h1>${esc(t('learnMore'))}</h1><p style="margin-top:6px">${esc(t('learnSub'))}</p><div class="section">${lessons.map((l, i) => `<button class="lesson" onclick="lesson(${i})"><div class="eyebrow">${esc(t(l.tag))}</div><h3>${esc(lessonTitle(l))} <span aria-hidden="true">›</span></h3><span>${esc(lessonBody(l)[0].slice(0, 96))}…</span></button>`).join('')}</div>`;
}
function modal(html) { $('dialogBody').innerHTML = html; if (!$('modal').open) $('modal').showModal(); $('modal').scrollTop = 0; }
function lesson(i) { const l = lessons[i], b = lessonBody(l); modal(`<div class="eyebrow">${esc(t(l.tag))}</div><h2 id="sheetTitle">${esc(lessonTitle(l))}</h2><p style="color:var(--ink)">${esc(b[0])}</p><p>${esc(b[1])}</p>${l.src ? `<a href="${l.src}">${esc(t('readSource'))}</a>` : ''}`); }

// ---- Places: search instead of coordinates -----------------------------------------------------
const placeHits = { loc: [], birth: [] };
const pickedHtml = (name, sub) => `<div class="picked">${icon('pin')}<div>${esc(name)}${sub ? `<small>${esc(sub)}</small>` : ''}</div></div>`;
/* A type-ahead field. kind 'loc' saves the place the moment it is picked; kind 'birth' fills the birth form. */
function placeField(kind, current) {
  return `<input id="${kind}Query" type="search" inputmode="search" autocomplete="off" placeholder="${esc(t('searchCity'))}" oninput="placeSearch(this.value,'${kind}')"><div class="results" id="${kind}Results"></div><div id="${kind}Picked">${current ? pickedHtml(current) : ''}</div>`;
}
function placeSearch(q, kind) {
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
  const near = Places.nearest(p.lat, p.lon);
  const name = near ? (near.km > 15 ? t('nearPlace', { p: near.name }) : near.name) : t('currentLoc');
  setLoc({ name, lat: +(+p.lat).toFixed(4), lon: +(+p.lon).toFixed(4), zone: (p.zone === 'Asia/Calcutta' ? 'Asia/Kolkata' : p.zone) || (near && near.zone) || 'Asia/Kolkata' });
  applyLocationDefaults(); persist(); haptic('success');
  if ($('modal').open) $('modal').close();
  scheduleNative(true);
  if (onboardStep) onboard(3); else { render(); toast(loc.name); }
}
window.somaReceiveLocation = s => receiveGPS(typeof s === 'string' ? JSON.parse(s) : s);

// ---- Settings ---------------------------------------------------------------------------------
function seg(name, value, options, onpick) { return `<div class="seg" role="radiogroup" aria-label="${esc(name)}">${options.map(([k, label]) => `<button type="button" role="radio" aria-checked="${k === value}" class="${k === value ? 'on' : ''}" onclick="${onpick}('${k}')">${esc(label)}</button>`).join('')}</div>`; }
function setPref(key, v) { prefs[key] = v; if (key === 'lang') { L = I18n.make(v); applyLocationDefaults(); } persist(); haptic('select'); render(); if (onboardStep) onboard(onboardStep); }
function setLang(v) { setPref('lang', v); }
function setTheme(v) { setPref('theme', v); }
function setLayout(v) { setPref('layout', v); }
function setDigits(v) { fmtCache.clear(); setPref('digits', v); }
const LANGS = [['en', 'English'], ['gu', 'ગુજરાતી'], ['hi', 'हिन्दी']];
function settings() {
  const r = prefs.reminders, check = (k, label) => `<label class="check"><input type="checkbox" id="rem_${k}" ${r[k] ? 'checked' : ''}> ${esc(label)}</label>`;
  modal(`<div class="eyebrow">${esc(t('settings'))}</div><h2 id="sheetTitle">${esc(t('location'))}</h2>${locationFields()}`
    + `<h2 class="section">${esc(t('language'))}</h2><select id="langPick" aria-label="${esc(t('language'))}">${LANGS.map(([k, n]) => `<option value="${k}" ${prefs.lang === k ? 'selected' : ''}>${n}</option>`).join('')}</select>`
    + `<h2 class="section">${esc(t('monthSystem'))}</h2><select id="monthPick" aria-label="${esc(t('monthSystem'))}"><option value="amanta" ${prefs.month === 'amanta' ? 'selected' : ''}>${esc(t('amanta'))}</option><option value="purnimanta" ${prefs.month === 'purnimanta' ? 'selected' : ''}>${esc(t('purnimanta'))}</option></select>`
    + `<h2 class="section">${esc(t('festivalSets'))}</h2><div class="card">${Fe.SETS.map(s => `<label class="check"><input type="checkbox" id="set_${s}" ${prefs.sets.indexOf(s) >= 0 ? 'checked' : ''}> ${esc(t('sets')[s])}</label>`).join('')}</div>`
    + (wxNative() ? `<h2 class="section">${esc(t('wxTitle'))}</h2><div class="card"><label class="check"><input type="checkbox" id="wxOn" ${prefs.weather ? 'checked' : ''}> ${esc(t('wxLive'))}</label><p class="caption">${esc(t('wxWhy'))}</p></div>` : '')
    + `<h2 class="section">${esc(t('reminders'))}</h2><div class="card">${check('vrat', t('remVrat'))}${check('parana', t('remParana'))}${check('daily', t('remDaily'))}${check('rahu', t('remRahu'))}</div>`
    + `<button class="primary" onclick="savePrefs()">${esc(t('save'))}</button><button class="lesson" onclick="lesson(8)"><h3>${esc(t('method'))} <span>›</span></h3></button>`);
}
function savePrefs() {
  const sets = Fe.SETS.filter(s => $('set_' + s).checked);
  prefs.custom = prefs.custom || sets.join() !== prefs.sets.join() || $('monthPick').value !== prefs.month;
  prefs.sets = sets; prefs.month = $('monthPick').value; prefs.lang = $('langPick').value;
  for (const k of ['vrat', 'parana', 'daily', 'rahu']) prefs.reminders[k] = $('rem_' + k).checked;
  L = I18n.make(prefs.lang);
  const wxWant = !!($('wxOn') && $('wxOn').checked);
  if (wxNative() && $('wxOn') && wxWant !== !!prefs.weather) setWeather(wxWant, true);
  if (persist()) {
    if (Object.values(prefs.reminders).some(Boolean)) askNotifications(true);
    $('modal').close(); scheduleNative(true); render();
  }
}

// ---- Plans with a muhurat check ---------------------------------------------------------------
function timingCheck() {
  const time = $('eventTime') && $('eventTime').value, out = $('timingCheck');
  if (!time || !out) return;
  const at = K.instant(day, time, loc.zone), d = frameFor(at), c = P.at(d.choghadiya, at), h = P.at(d.hora, at);
  const inBad = ['rahu', 'yamaganda', 'gulika'].filter(k => d.periods[k].start <= at && at < d.periods[k].end);
  const ok = c && c.nature !== 'bad' && !inBad.length;
  const better = !ok ? P.goodWindows(d, at).find(w => K.dateKey(w.start, loc.zone) === day) || null : null;
  out.innerHTML = `<div class="row"><span class="eyebrow">${esc(t('checkTime'))}</span>${badge(ok ? 'good' : 'bad')}</div><p>${esc(t('choghadiya'))}: ${c ? esc(L.chogName(c.key)) : '—'} · ${esc(t('hora'))}: ${h ? esc(L.planetName(h.lord)) : '—'}${inBad.length ? ' · ' + inBad.map(k => esc(t(k))).join(', ') : ''}</p>`
    + (better ? `<p>${esc(t('nextGood'))}: ${span(better)} ${esc(L.chogName(better.key))}</p><button type="button" class="quiet" onclick="document.getElementById('eventTime').value='${K.parts(better.start, loc.zone).hour}:${K.parts(better.start, loc.zone).minute}';timingCheck()">${esc(t('useTime'))}</button>` : '');
}
function plan() {
  modal(`<div class="eyebrow">${esc(t('muhurat'))}</div><h2 id="sheetTitle">${esc(t('planEvent'))}</h2><p>${titleDay(day)}</p><form onsubmit="saveEvent(event)"><label>${esc(t('evTitle'))}<input id="eventTitle" required maxlength="100" placeholder="${esc(t('evPlaceholder'))}"></label><label>${esc(t('evTime'))}<input type="time" id="eventTime" value="10:00" required oninput="timingCheck()"></label><div class="card" id="timingCheck" aria-live="polite"></div><label>${esc(t('evDuration'))}<select id="duration"><option value="60">${esc(t('dur60'))}</option><option value="30">${esc(t('dur30'))}</option><option value="120">${esc(t('dur120'))}</option></select></label><p class="caption">${esc(loc.name)} · ${esc(loc.zone)}</p><button class="primary">${esc(t('savePlan'))}</button></form>`);
  timingCheck();
}
function saveEvent(e) {
  e.preventDefault();
  if (!$('eventTitle').value.trim()) { toast(t('errEvTitle')); return; }
  const time = $('eventTime').value, start = K.instant(day, time, loc.zone), rt = K.parts(start, loc.zone);
  if (rt.hour + ':' + rt.minute !== time) { toast(t('errDst')); return; }
  const c = P.at(frameFor(start).choghadiya, start);
  events.push({ id: Date.now().toString(36), title: $('eventTitle').value.trim(), day, time, start: start.toISOString(), end: new Date(+start + Number($('duration').value) * 60000).toISOString(), zone: loc.zone, place: loc.name, tithi: L.tithiName(K.tithi(start).index), muhurat: c ? L.chogName(c.key) + ' ' + t('choghadiya') : '' });
  if (persist()) { $('modal').close(); haptic('success'); show('calendar'); toast(t('planSaved')); }
}
function deleteEvent(id) { modal(`<h2 id="sheetTitle">${esc(t('removePlanQ'))}</h2><p>${esc(t('removePlanBody'))}</p><button class="primary danger" onclick="events=events.filter(e=>e.id!=='${id}');persist();document.querySelector('dialog').close();render()">${esc(t('removePlan'))}</button>`); }
function exportEvent(id) {
  const e = events.find(x => x.id === id);
  if (window.SomaNative && SomaNative.addCalendarEvent) { SomaNative.addCalendarEvent(e.title, e.start, e.end, e.place, e.tithi); return; }
  const clean = s => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'), dt = s => s.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Soma//Calendar//EN', 'BEGIN:VEVENT', 'UID:' + e.id + '@soma.local', 'DTSTAMP:' + dt(new Date().toISOString()), 'DTSTART:' + dt(e.start), 'DTEND:' + dt(e.end), 'SUMMARY:' + clean(e.title), 'LOCATION:' + clean(e.place), 'DESCRIPTION:' + clean(e.tithi + ' · ' + e.zone), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/calendar' })); a.download = 'soma-event.ics'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

// ---- You: birth sky and settings ---------------------------------------------------------------
function personalView() {
  const has = !!profile.date;
  let natal = '';
  if (has) {
    const instant = K.instant(profile.date, profile.time || '12:00', profile.zone || 'Asia/Kolkata'), n = K.sidereal(instant), nak = Math.floor(n / (360 / 27));
    const today = P.personal(n, now()), first = day.slice(0, 7) + '-01', count = new Date(+day.slice(0, 4), +day.slice(5, 7), 0).getDate(), good = [];
    for (let i = 0; i < count; i++) { const key = K.addDay(first, i), r = K.dayData(key, loc).sunrise; if (r && P.personal(n, r).verdict === 'good') good.push(key); }
    natal = `<div class="grid2 section"><div class="card"><div class="caption">${esc(t('janmaRashi'))}</div><h2>${esc(L.rashiName(Math.floor(n / 30)))}</h2></div><div class="card"><div class="caption">${esc(t('janmaNak'))}</div><h2>${esc(L.nakName(nak))}</h2><p class="caption">${esc(t('pada', { n: num(Math.floor((n % (360 / 27)) / (360 / 108)) + 1) }))} · ${esc(tr(M.nakshatra(nak).deity))}</p></div></div>`
      + `<div class="card personalDay ${today.verdict}"><div class="row"><div class="eyebrow">${esc(t('forYou'))}</div>${badge(today.verdict)}</div><h2 style="margin-top:6px">${esc(verdictWord(today.verdict))}</h2><p>${esc(t('chandrabalam'))}: ${num(today.chandraCount)} · ${esc(t(today.chandraGood ? 'strong' : 'weak'))}</p><p>${esc(t('tarabalam'))}: ${esc(tr(M.TARA[today.tara.key]))}</p></div>`
      + `<div class="card"><div class="eyebrow">${esc(t('personalDays'))}</div><div class="chipRow" style="flex-wrap:wrap">${good.length ? good.map(k => `<button class="chip" onclick="setDay('${k}');show('today')">${dayLabel(k, { weekday: undefined })}</button>`).join('') : esc(t('none'))}</div></div>`;
    // The kundali's houses hang on the lagna, which needs the birth time; without it, show only what the Moon gives.
    if (profile.timeUnknown) natal += `<div class="card"><span class="tag">${esc(t('kundali'))}</span><p class="notice">${esc(t('timeUnknownNote'))}</p></div>`;
    else if (window.SomaNatal) {
      try { natal += `<div class="card"><span class="tag">${esc(t('kundaliNorth'))}</span><div class="natal">${SomaNatal.chart(instant, profile.lat, profile.lon, L.lang, t('lagnaMark'))}</div><p class="caption">${esc(t('chartFor', { date: dayLabel(profile.date, { weekday: undefined, year: 'numeric' }), time: fmtIn(instant, profile.zone || loc.zone), place: (profile.place || profile.zone).split(',')[0] }))}</p></div>`; }
      catch (e) { natal += `<p class="notice">${esc(t('chartFail'))}</p>`; }
    }
    natal += `<section class="section">${groupHead(t('ovNumbers'), esc(t('numerology')))}<div class="grid2"><div class="card"><div class="caption">${esc(t('mulank'))}</div><div class="number">${num(K.reduce(profile.date.slice(-2)))}</div></div><div class="card"><div class="caption">${esc(t('bhagyank'))}</div><div class="number">${num(K.reduce(profile.date))}</div></div></div><button class="lesson" onclick="lesson(7)"><h3>${esc(t('howCounted'))} <span aria-hidden="true">›</span></h3></button></section>`;
  }
  const head = `<div class="eyebrow">${esc(t('yourSky'))}</div><h1>${esc(t('you'))}</h1>`
    + `<div class="card"><div class="profile"><div class="avatar">${SomaDial.moon(34, birthMoon() != null ? 120 : 60)}</div><div style="flex:1;min-width:0"><span class="tag">${esc(t('birthStays'))}</span><h3 style="margin-top:6px">${has ? esc(dayLabel(profile.date, { year: 'numeric' }).replace(/,? \d{1,2}:.*/, '')) + (profile.place ? ' · ' + esc(profile.place.split(',')[0]) : '') : esc(t('addBirth'))}</h3></div></div><button class="primary" onclick="editProfile()">${has ? esc(t('editBirth')) : esc(t('addBirth'))}</button></div>`;
  const options = `<section class="section">${groupHead(t('ovStyle'), esc(t('appearance')))}<div class="card"><label style="margin-top:0">${esc(t('language'))}${seg(t('language'), prefs.lang, LANGS, 'setLang')}</label>`
    + `<label>${esc(t('theme'))}${seg(t('theme'), prefs.theme, [['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]], 'setTheme')}</label>`
    + `<label>${esc(t('layout'))}${seg(t('layout'), prefs.layout, [['dial', t('layoutDial')], ['sky', t('layoutSky')], ['folio', t('layoutFolio')]], 'setLayout')}</label>`
    + (L.lang !== 'en' ? `<label>${esc(t('digits'))}${seg(t('digits'), prefs.digits === 'native' ? 'native' : 'latin', [['latin', t('digitsLatin')], ['native', L.lang === 'gu' ? '૧ ૨ ૩' : '१ २ ३']], 'setDigits')}</label>` : '')
    + `<p class="caption" style="margin-top:12px">${esc(t('textSize'))}</p></div></section>`
    + `<section class="section">${groupHead(t('ovApp'), esc(t('settings')))}<div class="group"><button onclick="locationSheet()">${esc(t('location'))}<span>${esc(loc.name)} ›</span></button><button onclick="settings()">${esc(t('festivalSets'))} · ${esc(t('reminders'))}<span>›</span></button><button onclick="show('learn')">${esc(t('learnMore'))}<span>›</span></button><button onclick="lesson(8)">${esc(t('method'))}<span>›</span></button>${updatesOn() ? `<button onclick="updateSheet()">${esc(t('updTitle'))}<span>${pendingUpdate() ? `<b class="newdot">${esc(t('updNew'))}</b> ` : ''}${esc((updateInfo() || {}).versionName || '')} ›</span></button>` : ''}</div>`
    + (has ? `<button class="quiet section" onclick="eraseProfile()">${esc(t('deleteBirth'))}</button>` : '') + `</section>`;
  $('app').innerHTML = `<div class="split"><div class="lead">${head}${options}</div><div class="rest">${natal || `<button class="lesson" onclick="lesson(6)"><h3>${esc(lessonTitle(lessons[6]))} <span>›</span></h3><span>${esc(t('birthLessonSub'))}</span></button>`}</div></div>`;
}
/* Birth details. The birthplace must be picked (or typed under Advanced): it is never borrowed from where the phone is now,
   and the time starts empty so a guess never looks like an answer. A line under the form reads the details back before saving. */
function birthForm() {
  const unknown = !!profile.timeUnknown, has = v => v != null && v !== '';
  return `<form onsubmit="saveProfile(event)" novalidate oninput="birthPreview()"><label>${esc(t('dateOfBirth'))}<input id="birthDate" type="date" required min="1900-01-01" max="2100-12-31" value="${esc(profile.date || '')}"></label>`
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
  if (persist()) { haptic('success'); if ($('modal').open) $('modal').close(); if (onboardStep) finishOnboard('personal'); else personalView(); }
}
function eraseProfile() { modal(`<h2 id="sheetTitle">${esc(t('deleteBirth'))}?</h2><p>${esc(t('eraseBody'))}</p><button class="primary danger" onclick="profile={};persist();document.querySelector('dialog').close();personalView()">${esc(t('deleteBirth'))}</button>`); }

// ---- First launch: language, place, birth sky ------------------------------------------------
let onboardStep = 0;
function onboard(step) {
  onboardStep = step; const el = $('onboard');
  if ($('modal').open) $('modal').close();
  $('dialogBody').innerHTML = ''; // the forms below reuse the same field ids
  const foot = (primary, skip) => `<div class="foot">${primary || ''}${skip ? `<button class="quiet" onclick="${skip}">${esc(t('skip'))}</button>` : ''}</div>`;
  let html = '';
  if (step === 1) html = `<div class="hero">${SomaDial.moon(84, 120)}<h1>${esc(t('welcome'))}</h1><p style="margin-top:6px">${esc(t('tagline'))}</p></div><div class="eyebrow">${esc(t('chooseLanguage'))}</div><div class="langs">${LANGS.map(([k, n]) => `<button class="${prefs.lang === k ? 'on' : ''}" onclick="setLang('${k}')">${n}<span>${prefs.lang === k ? '✓' : ''}</span></button>`).join('')}</div>`
    + foot(`<button class="primary" onclick="onboard(2)">${esc(t('continue'))}</button>`);
  else if (step === 2) html = `<div class="eyebrow">${esc(t('step', { n: 2, m: 4 }))}</div><h1 style="margin-top:6px">${esc(t('whereAreYou'))}</h1><p style="margin:8px 0 18px">${esc(t('whereWhy'))}</p>${locationFields()}` + foot('', 'onboard(3)');
  else if (step === 3) {
    const opt = (k, title, sub) => `<button class="${prefs.month === k ? 'on' : ''}" aria-pressed="${prefs.month === k}" onclick="setMonthSys('${k}')">${esc(title)}<small>${esc(sub)}</small><span>${prefs.month === k ? '✓' : ''}</span></button>`;
    html = `<div class="eyebrow">${esc(t('step', { n: 3, m: 4 }))}</div><h1 style="margin-top:6px">${esc(t('calTitle'))}</h1><p style="margin:8px 0 18px">${esc(t('calWhy'))}</p>`
      + `<div class="eyebrow">${esc(t('monthQ'))}</div><div class="langs months">${opt('amanta', t('monthAmaOpt'), t('monthAmaSub'))}${opt('purnimanta', t('monthPurOpt'), t('monthPurSub'))}</div>`
      + `<div class="eyebrow" style="margin-top:18px">${esc(t('festQ'))}</div>${setChips('onboard(3)')}`
      + foot(`<button class="primary" onclick="onboard(4)">${esc(t('continue'))}</button>`);
  }
  else if (step === 4) html = `<div class="eyebrow">${esc(t('step', { n: 4, m: 4 }))} · ${esc(t('yourSky'))}</div><h1 style="margin-top:6px">${esc(t('birthTitle'))}</h1>${birthForm()}` + foot('', "finishOnboard('today')");
  el.innerHTML = `<div class="inner">${html}</div>`; el.classList.add('open'); el.scrollTop = 0;
}
function finishOnboard(to) {
  onboardStep = 0; prefs.onboarded = true; persist();
  $('onboard').classList.remove('open'); $('onboard').innerHTML = '';
  askNotifications(false); show(to || 'today');
}

// ---- Reminders and widget (native) ----------------------------------------------------------
/* Local notifications for the next 30 days, computed here and handed to the native alarm scheduler. */
function reminderPlan() {
  const from = todayKey(), list = observances(from, 31), r = prefs.reminders, out = [], nowMs = Clock.ms();
  const add = (at, title, body, id) => { if (+at > nowMs) out.push({ id, at: +at, title, body }); };
  for (const f of list) {
    if (r.vrat && f.day > from) add(K.instant(K.addDay(f.day, -1), '19:00', loc.zone), t('remTomorrow', { f: L.festName(f) }), f.key === 'ekadashi' ? t('remFast') + (f.parana ? t('remParanaAt', { d: dayLabel(f.parana.day), span: span(f.parana) }) : '') : (festNote(f) || t('remAt', { f: L.festName(f), p: loc.name })), 'eve-' + f.key + '-' + f.day);
    if (r.parana && f.parana) add(f.parana.start, t('parana') + ': ' + L.festName(f), t('remBreak', { time: fmt(f.parana.end) }), 'parana-' + f.day);
  }
  if (r.daily || r.rahu) {
    const samp = Fe.samples(from, 14, loc);
    for (const s of samp.slice(0, 14)) {
      const ti = Math.floor(A.MoonPhase(s.sunrise) / 12), wd = new Date(Date.parse(s.day + 'T12:00Z')).getUTCDay(), seg0 = P.RAHU[wd] - 1;
      const rahu = { start: new Date(+s.sunrise + (s.sunset - s.sunrise) * seg0 / 8), end: new Date(+s.sunrise + (s.sunset - s.sunrise) * (seg0 + 1) / 8) };
      const fest = list.filter(x => x.day === s.day).map(x => L.festName(x)).join(', ');
      if (r.daily) add(s.sunrise, L.vaarName(wd) + ' · ' + L.tithiName(ti), (fest ? fest + '. ' : '') + t('rahu') + ' ' + span(rahu), 'daily-' + s.day);
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
  const px = parseFloat(getComputedStyle(root).fontSize) || 16;
  root.classList.toggle('bigtext', px >= 20);
}
applyTextScale();
window.SomaPrototype = { health: () => ({ ready: true, version: '0.8.0', tithi: K.tithi(now()).label, location: loc.name, festivals: observances(todayKey(), 30).length }) };
wxLoad();
try { render(); if (!prefs.onboarded) onboard(1); if (window.SomaNative) SomaNative.appReady(); }
catch (e) { $('app').textContent = 'Unable to load: ' + e.message; if (window.SomaNative) SomaNative.appFailure(e.message); }
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
