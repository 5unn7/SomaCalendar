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
  if (!prefs.custom || !prefs.sets) prefs.sets = Fe.defaultSets(loc);
  if (!prefs.custom || !prefs.month) prefs.month = Fe.defaultMonthSystem(loc);
}
applyLocationDefaults();
window.SomaFestivalSets = prefs.sets;

function persist() {
  window.SomaFestivalSets = prefs.sets;
  try { localStorage.setItem(STORE, JSON.stringify({ loc, profile, events, prefs })); return true; }
  catch (e) { toast('Storage is full or unavailable. Changes were not saved.'); return false; }
}
let toastTimer = 0;
function toast(s) { $('toast').textContent = s; $('toast').style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => ($('toast').style.display = 'none'), 4000); }
function haptic(kind) { try { if (window.SomaNative && SomaNative.haptic) SomaNative.haptic(kind || 'select'); } catch (e) {} }
const locale = () => (L.lang === 'gu' ? 'gu-IN' : L.lang === 'hi' ? 'hi-IN' : 'en-IN');
const fmt = (d, opts = {}) => d ? new Intl.DateTimeFormat('en-IN', { timeZone: loc.zone, hour: 'numeric', minute: '2-digit', ...opts }).format(d) : '—';
const span = p => p ? fmt(p.start) + ' – ' + fmt(p.end) : '—';
const full = d => fmt(d, { day: 'numeric', month: 'short' });
const dayLabel = (key, opts) => new Intl.DateTimeFormat(locale(), Object.assign({ timeZone: loc.zone, weekday: 'short', day: 'numeric', month: 'short' }, opts || {})).format(K.instant(key, '12:00', loc.zone));
const titleDay = d => new Intl.DateTimeFormat(locale(), { timeZone: loc.zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(K.instant(d, '12:00', loc.zone));
const todayKey = () => K.dateKey(now(), loc.zone);
const isToday = () => day === todayKey();
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00Z') - Date.parse(a + 'T12:00Z')) / 864e5);
const badge = n => `<span class="nature ${n}">${esc(L.nature(n))}</span>`;
const hourOf = d => { const p = K.parts(d, loc.zone); return +p.hour + p.minute / 60 + p.second / 3600; };
const methodChip = () => `<button class="chip method" onclick="settings()">Drik · Lahiri · ${prefs.month === 'purnimanta' ? 'Purnimanta' : 'Amanta'} · ${esc(loc.name)}</button>`;
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
function cached(key, fn) { if (!memo.has(key)) { if (memo.size > 80) memo.clear(); memo.set(key, fn()); } return memo.get(key); }
const locKey = () => [loc.lat, loc.lon, loc.zone].join(',');
const vedicDay = key => cached('day|' + key + '|' + locKey(), () => P.day(key, loc));
const observances = (from, days) => Fe.visible(cached('fest|' + from + '|' + days + '|' + locKey(), () => Fe.list(from, days, loc)), prefs.sets);
const birthMoon = () => profile.date ? K.sidereal(K.instant(profile.date, profile.time || '12:00', profile.zone || 'Asia/Kolkata')) : null;
/* The Vedic day runs sunrise to sunrise, so a time before today's sunrise belongs to yesterday's Choghadiya and Hora. */
function frameFor(at) { const d = vedicDay(day); return at < d.frame.sunrise ? vedicDay(K.addDay(day, -1)) : d; }

// ---- Shell ------------------------------------------------------------------------------------
function applyTheme() {
  const root = document.documentElement;
  if (prefs.theme === 'light' || prefs.theme === 'dark') root.setAttribute('data-theme', prefs.theme); else root.removeAttribute('data-theme');
  root.lang = L.lang;
}
function show(v) { if (v !== view) { haptic('select'); if (v === 'moon') hour = null; } view = v; render(); window.scrollTo(0, 0); }
function setDay(d) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < '1900-01-01' || d > '2100-12-31') return; if (d !== day) hour = null; day = d; monthView = d.slice(0, 7); render(); }
function datebar() {
  const label = new Intl.DateTimeFormat(locale(), { timeZone: loc.zone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(K.instant(day, '12:00', loc.zone));
  return `<div class="datebar"><button aria-label="Previous day" onclick="setDay(K.addDay(day,-1))">‹</button><label class="datepick">${icon('calendar')}<span>${esc(label)}</span><input aria-label="${esc(t('pickDate'))}" type="date" min="1900-01-01" max="2100-12-31" value="${day}" onchange="setDay(this.value)"></label><button aria-label="Next day" onclick="setDay(K.addDay(day,1))">›</button>${isToday() ? '' : `<button class="now" onclick="setDay(todayKey())">${esc(t('today2'))}</button>`}</div>`;
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
/* One sentence that says what kind of day it is, built from the tithi, nakshatra and yoga at sunrise. */
function verdict(d) {
  const l = d.sunriseLimbs, ti = M.tithi(l.tithi.index), na = M.nakshatra(l.nakshatra.index), yo = M.YOGA[l.yoga.index], ka = M.KARANA[l.karana.index];
  const bad = [ti.nature, na.nature, yo.nature].filter(n => n === 'bad').length + (ka.nature === 'bad' && l.karana.index === 6 ? 1 : 0);
  // A festival day is a sacred day whatever its limbs say; the limbs then only shape the timing.
  const festival = observances(d.frame.day, 1).find(x => x.day === d.frame.day && x.kind === 'festival');
  const nature = bad === 0 ? 'good' : bad === 1 || festival ? 'mixed' : 'bad';
  const good = festival ? L.festName(festival) + (festival.note ? ': ' + festival.note.replace(/\.$/, '').toLowerCase() : '') + '; ' + (ti.nature === 'good' ? ti.good : na.good)
    : ti.nature === 'bad' && na.nature !== 'bad' ? na.good : ti.nature === 'good' ? ti.good : na.good;
  const avoid = [ti.nature === 'bad' ? ti.avoid : '', na.nature === 'bad' ? na.avoid : '', yo.nature === 'bad' ? 'starting important work during ' + yo.en + ' yoga (until ' + fmt(l.yoga.end) + ')' : '']
    .filter(Boolean).join('; ') || ti.avoid;
  return { nature, good, avoid, ti, na, yo, festival };
}
const verdictWord = n => n === 'good' ? t('favourable') : n === 'bad' ? t('takeCare') : t('mixed');
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
function dialHero(d, v, cx, eyebrow) {
  const dial = SomaDial.svg({ size: 340, hourOf, chog: cx.dd.choghadiya, rahu: d.periods.rahu, sunrise: cx.dd.frame.sunrise, sunset: cx.dd.frame.sunset, now: cx.now, label: t('choghadiya') });
  const chogLine = cx.c ? `<div class="chognow ${cx.c.nature}">${esc(L.chogName(cx.c.key))} · ${esc(t('until'))} ${fmt(cx.c.end)}</div>` : `<div class="chognow ${v.nature}">${esc(verdictWord(v.nature))}</div>`;
  const sub = daySentence(v);
  return `<section class="sky" data-sky="${cx.sky}"><div class="dateline"><span class="eyebrow">${eyebrow}</span></div>`
    + `<div class="dialwrap">${dial.svg}<button class="dialcore" onclick="show('moon')" aria-label="${esc(t('moonPage'))}">${SomaDial.moon(44, cx.ti.angle)}<h1 class="tithi">${esc(L.tithiName(cx.ti.index))}</h1>${chogLine}</button></div>`
    + `<div class="daytitle"><p>${esc(sub)}</p></div>${sunStrip(d, cx)}</section>`;
}
/* Sunrise and sunset as icons with times, daylight between them, a countdown on today.
   After sunset the sunrise slot looks ahead to tomorrow. Labels live in aria-label, not on screen. */
function sunStrip(d, cx) {
  const f = d.frame, len = Math.round((f.sunset - f.sunrise) / 6e4);
  const late = cx.now && cx.now > f.sunset, rise = late ? vedicDay(K.addDay(day, 1)).frame.sunrise : f.sunrise;
  const cell = (k, label, at) => { const r = rel({ start: at, end: at }, cx.now); return `<div class="${k}${cx.now && at <= cx.now ? ' past' : ''}" role="group" aria-label="${esc(label + ' ' + fmt(at))}">${icon(k)}<b>${fmt(at)}</b>${r ? `<small>${esc(r)}</small>` : ''}</div>`; };
  return `<div class="sunstrip">${cell('sunrise', late ? t('tomorrowRise') : t('sunrise'), rise)}<div class="len" aria-label="${esc(t('daylight'))}"><i></i><span>${esc(t('hm', { h: Math.floor(len / 60), m: len % 60 }))}</span><i></i></div>${cell('sunset', t('sunset'), f.sunset)}</div>`;
}
/* A group heading: a small overline that names the kind of thing, the title, and an optional action on the right. */
function groupHead(over, title, action) {
  return `<div class="ghead"><div>${over ? `<div class="over">${esc(over)}</div>` : ''}<h2>${title}</h2></div>${action || ''}</div>`;
}
/* What the day is for, in one line: what it is good for, or what to avoid. */
function daySentence(v) {
  // The festival has its own card right below the hero, so this line says what the day is good for.
  const first = s => String(s || '').split(';')[0].trim();
  const good = v.festival ? String(v.good).split(';').slice(1).join(';') || v.good : v.good;
  return v.nature === 'bad' ? t('avoid') + ': ' + first(v.avoid) : (v.nature === 'mixed' ? t('mixedDay') + ' · ' : '') + t('goodFor') + ': ' + first(good);
}
function horizonSvg(frac) {
  const w = 320, h = 96, b = (x0, c, x1, tt) => (1 - tt) * (1 - tt) * x0 + 2 * (1 - tt) * tt * c + tt * tt * x1, f = Math.min(1, Math.max(0, frac));
  const x = b(12, w / 2, w - 12, f), y = b(h - 8, -h * 0.6, h - 8, f);
  return `<svg class="horizon" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="M12 ${h - 8} Q ${w / 2} ${-h * 0.6} ${w - 12} ${h - 8}" stroke-dasharray="3 5"/><line x1="0" y1="${h - 8}" x2="${w}" y2="${h - 8}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" class="halo"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7.5" class="sun"/></svg>`;
}
function skyHero(d, v, cx, eyebrow) {
  // The horizon follows the civil day's sun, so before dawn the sun waits at the sunrise end.
  const night = cx.sky === 'night', f = d.frame, tithi = L.tithiName(cx.ti.index);
  // Live: the running Choghadiya is the headline, with how long it lasts. Another day: the tithi is the headline.
  const big = cx.c ? L.chogName(cx.c.key) : tithi;
  const status = cx.c ? `<div class="status"><span class="pill ${cx.c.nature}"><i></i>${esc(L.nature(cx.c.nature))}</span><span>${esc(t('until'))} ${fmt(cx.c.end)}${rel(cx.c, cx.now) ? ' · ' + esc(rel(cx.c, cx.now)) : ''}</span></div>` : `<div class="status"><span class="pill ${v.nature}"><i></i>${esc(verdictWord(v.nature))}</span></div>`;
  const line = cx.c ? M.CHOG[cx.c.key].good : daySentence(v);
  const visual = night ? `<div class="skymoon">${SomaDial.moon(88, cx.ti.angle)}</div>` : horizonSvg((cx.at - f.sunrise) / (f.sunset - f.sunrise));
  const facts = `<div class="facts"><button onclick="show('moon')">${SomaDial.moon(18, cx.ti.angle)}<span>${esc(tithi)}</span></button><span>${esc(L.nakName(d.sunriseLimbs.nakshatra.index))}</span></div>`;
  return `<section class="skyhero" data-sky="${cx.sky}">${night ? stars(70, 7) : ''}<div class="eyebrow">${eyebrow}</div>${status}<h1 class="big">${esc(big)}</h1><p class="lineone">${esc(line)}</p>`
    + `${visual}${sunStrip(d, cx)}${facts}</section>`;
}
function folioHero(d, v, cx, eyebrow, monthName) {
  const head = v.nature === 'good' ? t('folioGood') : v.nature === 'bad' ? t('folioBad') : t('folioMixed');
  const lede = v.festival ? L.festName(v.festival) + (v.festival.note ? '. ' + v.festival.note : '') : (v.nature === 'bad' ? t('avoid') + ': ' + v.avoid : t('goodFor') + ': ' + v.good) + '.';
  const sun = [{ at: d.frame.sunrise, html: `<span>${icon('sunrise', 'ic')} ${esc(t('sunrise'))}</span><span class="k"></span>` }, { at: d.frame.sunset, html: `<span>${icon('sunset', 'ic')} ${esc(t('sunset'))}</span><span class="k"></span>` }];
  const items = sun.concat(d.choghadiya.filter(c => !c.night).map(c => ({ at: c.start, html: `<span>${esc(L.chogName(c.key))}${cx.now && c.start <= cx.now && cx.now < c.end ? ` <span class="k good">· ${esc(t('running'))}</span>` : ''}</span><span class="k ${c.nature}">${esc(L.nature(c.nature))}</span>` })))
    .concat([{ at: d.periods.rahu.start, html: `<span>${esc(t('rahu'))}</span><span class="k bad">→ ${fmt(d.periods.rahu.end)}</span>` }])
    .concat(d.periods.abhijit.wednesday ? [] : [{ at: d.periods.abhijit.start, html: `<span>${esc(t('abhijit'))}</span><span class="k good">→ ${fmt(d.periods.abhijit.end)}</span>` }])
    .sort((a, b) => a.at - b.at);
  return `<section class="folio"><div class="row"><span class="eyebrow">${eyebrow}</span></div><div class="rule"></div>`
    + `<div class="eyebrow" style="color:var(--accent)">${esc(monthName)} · ${esc(L.tithiName(cx.ti.index))}</div><h1 class="headline">${emph(head)}</h1><p class="lede">${esc(lede)}</p>${sunStrip(d, cx)}`
    + `<div class="hairline"></div><div class="eyebrow">${esc(t('hourByHour'))}</div>${items.map(i => `<div class="tl"><span class="t">${fmt(i.at)}</span>${i.html}</div>`).join('')}</section>`;
}
function festivalToday(key) {
  const list = observances(K.addDay(key, -1), 50), todays = list.filter(x => x.day === key), yesterdayEkadashi = list.find(x => x.key === 'ekadashi' && x.parana && x.parana.day === key);
  let html = '';
  for (const f of todays) {
    html += `<div class="card festival ${f.kind}"><div class="eyebrow">${esc(t('festivalsToday'))}</div><h2>${esc(L.festName(f))}</h2>${L.lang !== 'en' ? `<p>${esc(f.en)}</p>` : ''}${f.note ? `<p>${esc(f.note)}</p>` : ''}`
      + (f.key === 'ekadashi' ? `<p>${esc(t('fastBegins'))} · ${fmt(vedicDay(key).frame.sunrise)}</p>${f.parana ? `<p><strong>${esc(t('parana'))}:</strong> ${dayLabel(f.parana.day)} · ${span(f.parana)}</p>` : ''}` : '')
      + (f.sutak ? `<p>Sutak begins ${full(f.sutak)} · peak ${full(f.at)}</p>` : '') + '</div>';
  }
  if (yesterdayEkadashi) html += `<div class="card festival vrat"><div class="eyebrow">${esc(t('parana'))}</div><h2>${span(yesterdayEkadashi.parana)}</h2><p>${esc(yesterdayEkadashi.en)} · Dwadashi ends ${fmt(yesterdayEkadashi.parana.dwadashiEnd)}</p></div>`;
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
  modal(`<div class="row" style="align-items:flex-end"><div class="number" style="font-size:96px">${esc(n)}</div><div style="text-align:right" class="eyebrow">${esc(new Intl.DateTimeFormat(locale(), { timeZone: loc.zone, weekday: 'long', month: 'long' }).format(date))}</div></div>`
    + `<h2 style="font-size:34px;margin-top:10px">${esc(L.festName(f))}</h2>${L.lang !== 'en' ? `<p>${esc(f.en)}</p>` : ''}${f.note ? `<p style="color:var(--ink)">${esc(f.note)}</p>` : ''}`
    + (f.parana ? `<div class="list"><div class="timeline"><i class="dot vrat"></i><div><strong>${esc(t('parana'))}</strong><p>${dayLabel(f.parana.day)}</p></div><div class="right">${span(f.parana)}</div></div></div>` : '')
    + (f.sutak ? `<p>Sutak begins ${full(f.sutak)} · peak ${full(f.at)}</p>` : '')
    + `<button class="primary" onclick="document.querySelector('dialog').close();setDay('${f.day}')">${esc(t('goToDay'))}</button>`);
}
function nowNext(d, cx) {
  // Running Choghadiya and Hora come from the Vedic day in force (yesterday's before sunrise); Rahu Kaal, Abhijit and the rest belong to the selected day.
  const dd = cx.dd, now = cx.now, per = d.periods, rows = [];
  const row = (name, sub, p, nature) => { const r = rel(p, now); rows.push(`<div class="nn${p && now && p.end <= now ? ' past' : ''}"><i class="dot ${nature}"></i><div class="label"><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div><div class="when">${span(p)}${r ? `<em class="${nature}">${esc(r)}</em>` : ''}</div></div>`); };
  if (now) {
    const next = P.goodWindows(dd, now)[0] || (dd !== d ? P.goodWindows(d, now)[0] : null), h = P.at(dd.hora, now);
    if (next) row(t('nextGood'), L.chogName(next.key) + ' · ' + M.CHOG[next.key].good, next, 'good');
    if (h) row(t('hora') + ' · ' + L.planetName(h.lord), M.PLANET[h.lord].good, h, h.nature);
  }
  row(t('rahu'), '', per.rahu, 'bad');
  if (!per.abhijit.wednesday) row(t('abhijit'), '', per.abhijit, 'good');
  const more = [['yamaganda', per.yamaganda, 'bad'], ['gulika', per.gulika, 'bad'], ['brahma', per.brahma, 'good']]
    .map(([k, p, n]) => `<div class="nn"><i class="dot ${n}"></i><div class="label"><b>${esc(t(k))}</b></div><div class="when">${span(p)}</div></div>`).join('');
  return `<section class="section">${groupHead(t('ovNow'), esc(t('nowAndNext')))}<div class="list">${rows.join('')}</div><details><summary>${esc(t('moreTimes'))}</summary><div class="list">${more}</div></details></section>`;
}
function practiceCard(d) {
  const chips = M.PRACTICES.map(p => `<button class="chip ${practice === p.key ? 'on' : ''}" onclick="practice=practice==='${p.key}'?null:'${p.key}';todayView()">${esc(L.practiceName(p))}</button>`).join('');
  const vaar = M.VAAR[d.frame.weekday];
  let body = `<p><strong>${esc(t('deityOfDay'))}:</strong> ${esc(vaar.deity)}</p><p><strong>${esc(t('mantra'))}:</strong> ${esc(vaar.mantra)}</p>`;
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
  return `<div class="card personalDay ${p.verdict}"><div class="row"><div class="eyebrow">${esc(t('forYou'))}</div>${badge(p.verdict)}</div><h2 style="margin-top:6px">${esc(verdictWord(p.verdict))}</h2><p>${esc(t('chandrabalam'))}: Moon ${p.chandraCount}${['th', 'st', 'nd', 'rd'][p.chandraCount % 10 > 3 || [11, 12, 13].indexOf(p.chandraCount) >= 0 ? 0 : p.chandraCount % 10]} from your ${esc(L.rashiName(p.janmaRashi))} · ${p.chandraGood ? esc(t('good')) : esc(t('bad'))}</p><p>${esc(t('tarabalam'))}: ${esc(M.TARA[p.tara.key])}</p></div>`;
}
function limbsCard(d, v) {
  const l = d.sunriseLimbs, ti = M.tithi(l.tithi.index), na = M.nakshatra(l.nakshatra.index), yo = M.YOGA[l.yoga.index], ka = M.KARANA[l.karana.index], va = M.VAAR[d.frame.weekday];
  const row = (label, name, end, note, nature) => `<div class="timeline"><i class="dot ${nature || ''}"></i><div><div class="eyebrow">${esc(label)}</div><strong>${esc(name)}</strong><p>${esc(note)}</p></div><div class="right">${nature ? badge(nature) : ''}${end ? '<br>' + esc(t('until')) + ' ' + full(end) : ''}</div></div>`;
  return `<section class="section">${groupHead(t('ovPanchang'), esc(t('todayTitle')))}`
    + `<div class="card verdict"><div class="row"><span class="eyebrow">${esc(t('details'))}</span>${badge(v.nature)}</div><p><strong>${esc(t('goodFor'))}:</strong> ${esc(v.good)}.</p><p><strong>${esc(t('avoid'))}:</strong> ${esc(v.avoid)}.</p></div><div class="list">`
    + row(t('tithi'), L.tithiName(l.tithi.index), l.tithi.end, ti.deity + ' · ' + ti.group + '. ' + ti.note, ti.nature)
    + row(t('nakshatra'), L.nakName(l.nakshatra.index) + ' ' + l.nakshatra.pada, l.nakshatra.end, na.deity + ' · ' + na.group + '. Good for ' + na.good + '.', na.nature)
    + row(t('yoga'), L.yogaName(l.yoga.index), l.yoga.end, yo.nature === 'bad' ? 'Avoid starting important work while it lasts.' : 'Supports good work.', yo.nature)
    + row(t('karana'), L.karanaName(l.karana.index), l.karana.end, l.karana.index === 6 ? 'Bhadra: avoid auspicious beginnings.' : 'Half-tithi.', ka.nature)
    + row(t('vaar'), L.vaarName(d.frame.weekday), null, va.deity + '. Good for ' + va.good + '. Avoid ' + va.avoid + '.', null)
    + `</div><div style="margin-top:10px">${methodChip()}</div></section>`
    + `<section class="section">${groupHead(t('ovSky'), esc(t('moon')), `<button class="quiet" onclick="show('moon')">${esc(t('moon'))} ›</button>`)}<div class="grid2">`
    + [['moonrise', d.frame.data.moonrise], ['moonset', d.frame.data.moonset]].map(([k, v2]) => `<div class="card"><div class="caption">${esc(t(k))}</div><div class="value">${fmt(v2)}</div></div>`).join('') + '</div></section>';
}
function todayView() {
  const d = vedicDay(day), v = verdict(d), cx = heroContext(d);
  const monthName = P.monthName(d.frame.sunrise, prefs.month, L.monthNames), samvat = P.samvat(d.frame.sunrise, prefs.sets.indexOf('gujarati') >= 0 ? 'gujarati' : 'north');
  const eyebrow = esc(new Intl.DateTimeFormat(locale(), { timeZone: loc.zone, weekday: 'long', day: 'numeric', month: 'short' }).format(K.instant(day, '12:00', loc.zone))) + ' · ' + esc(monthName) + ' · ' + esc(t('samvat')) + ' ' + samvat;
  const hero = prefs.layout === 'sky' ? skyHero(d, v, cx, eyebrow) : prefs.layout === 'folio' ? folioHero(d, v, cx, eyebrow, monthName) : dialHero(d, v, cx, eyebrow);
  const fest = festivalToday(day);
  $('app').innerHTML = `<div class="split"><div class="lead">${hero}${datebar()}</div><div class="rest">`
    + fest.html + nowNext(d, cx) + comingUp(day, fest.list) + `<section class="section">${personalLine(d)}</section>` + practiceCard(d) + limbsCard(d, v)
    + `<div class="tiles section"><button onclick="plan()">${icon('calendar')}<b>${esc(t('planEvent'))}</b></button><button onclick="show('learn')">${icon('moon')}<b>${esc(t('learnMore'))}</b></button></div></div></div>`;
  scheduleNative();
}

// ---- Calendar ---------------------------------------------------------------------------------
function changeMonth(n) { haptic('select'); const d = new Date(monthView + '-15T12:00Z'); d.setUTCMonth(d.getUTCMonth() + n); monthView = d.toISOString().slice(0, 7); calendarView(); }
function toggleSet(s) {
  const i = prefs.sets.indexOf(s);
  if (i >= 0) prefs.sets.splice(i, 1); else prefs.sets.push(s);
  prefs.custom = true; persist(); scheduleNative(true); render();
}
function setChips() { return `<div class="chipRow">${Fe.SETS.map(s => `<button class="chip ${prefs.sets.indexOf(s) >= 0 ? 'on' : ''}" onclick="toggleSet('${s}')">${esc(t('sets')[s])}</button>`).join('')}</div>`; }
const PAKSHA = { en: ['Shukla', 'Krishna'], gu: ['સુદ', 'વદ'], hi: ['शुक्ल', 'कृष्ण'] };
const shortTithi = i => i === 14 || i === 29 ? L.tithiName(i) : PAKSHA[L.lang][i >= 15 ? 1 : 0] + ' ' + (i % 15 + 1);
function calendarView() {
  const first = monthView + '-01', start = new Date(first + 'T12:00Z').getUTCDay(), count = new Date(+monthView.slice(0, 4), +monthView.slice(5), 0).getDate();
  const fest = observances(first, count + 1), bm = birthMoon();
  let cells = '<span></span>'.repeat(start);
  for (let n = 1; n <= count; n++) {
    const key = monthView + '-' + String(n).padStart(2, '0'), data = K.dayData(key, loc), ti = data.atSunrise || K.tithi(K.instant(key, '12:00', loc.zone));
    const f = fest.filter(x => x.day === key), top = f.find(x => x.kind !== 'vrat') || f[0];
    const pd = bm != null && data.sunrise ? P.personal(bm, data.sunrise).verdict : null;
    cells += `<button onclick="setDay('${key}')" class="${key === day ? 'selected ' : ''}${key === todayKey() ? 'today ' : ''}${top ? 'holy ' + top.kind : ''}${pd === 'good' ? ' mine' : ''}" aria-label="${dayLabel(key)} ${esc(L.tithiName(ti.index))}${top ? ' · ' + esc(L.festName(top)) : ''}">${SomaDial.moon(22, ti.angle)}${n}<small>${esc(top ? L.festName(top) : shortTithi(ti.index))}</small>${top ? `<em>${esc(L.festName(top))}</em>` : ''}</button>`;
  }
  const sel = fest.filter(x => x.day === day), d = vedicDay(day), mine = events.filter(e => e.day === day);
  const weekNames = [0, 1, 2, 3, 4, 5, 6].map(i => new Intl.DateTimeFormat(locale(), { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + i))));
  const lead = `<div class="eyebrow">${esc(P.monthName(K.instant(first, '12:00', loc.zone), prefs.month, L.monthNames))} – ${esc(P.monthName(K.instant(monthView + '-' + count, '12:00', loc.zone), prefs.month, L.monthNames))}</div><h1>${esc(t('calendar'))}</h1>${setChips()}`
    + `<div class="monthhead"><h2>${new Date(first + 'T12:00Z').toLocaleDateString(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2><div class="arrows"><button onclick="changeMonth(-1)" aria-label="Previous month">‹</button><button onclick="changeMonth(1)" aria-label="Next month">›</button></div></div>`
    + `<div class="week">${weekNames.map(w => `<span>${esc(w)}</span>`).join('')}</div><div class="calendar">${cells}</div>`
    + (bm != null ? `<p class="caption" style="margin-top:8px">● ${esc(t('personalDays'))}</p>` : '');
  const rest = `<section class="section">${groupHead(t('ovDay'), titleDay(day))}<div class="list"><div class="timeline"><i class="dot"></i><div><strong>${esc(L.tithiName(d.sunriseLimbs.tithi.index))}</strong><p>${esc(L.nakName(d.sunriseLimbs.nakshatra.index))}</p></div><div class="right">${esc(t('rahu'))}<br>${span(d.periods.rahu)}</div></div>`
    + sel.map(f => `<div class="timeline"><i class="dot ${f.kind}"></i><div><strong>${esc(L.festName(f))}</strong>${f.parana ? `<p>${esc(t('parana'))}: ${dayLabel(f.parana.day)} ${span(f.parana)}</p>` : ''}${f.note ? `<p>${esc(f.note)}</p>` : ''}</div></div>`).join('')
    + mine.map(e => `<div class="timeline"><i class="dot good"></i><div><strong>${esc(e.title)}</strong><p>${esc(e.time)} · ${esc(e.muhurat)}</p></div></div>`).join('')
    + `</div><div class="grid2" style="margin-top:10px"><button class="chip" style="min-height:46px" onclick="show('today')">${esc(t('details'))}</button><button class="chip on" style="min-height:46px" onclick="plan()">＋ ${esc(t('addEvent'))}</button></div></section>`
    + `<section class="section">${groupHead(t('ovFest'), esc(t('comingUp')))}<div class="list">${fest.filter(x => x.day >= first).map(f => `<div class="timeline" onclick="setDay('${f.day}')"><i class="dot ${f.kind}"></i><div><strong>${esc(L.festName(f))}</strong><p>${dayLabel(f.day)}${f.parana ? ' · ' + esc(t('parana')) + ' ' + span(f.parana) : ''}</p></div></div>`).join('') || `<p style="padding:14px 0">${esc(t('none'))}</p>`}</div></section>`
    + `<section class="section">${groupHead(t('ovPlans'), esc(t('myPlans')) + ` <span class="caption">${events.length}</span>`)}${events.length ? `<div class="list">${events.slice().sort((a, b) => a.start.localeCompare(b.start)).map(e => `<div class="timeline"><i class="dot good"></i><div><strong>${esc(e.title)}</strong><p>${esc(e.day)} · ${esc(e.time)} · ${esc(e.place)}</p><p>${esc(e.tithi)}${e.muhurat ? ' · ' + esc(e.muhurat) : ''}</p><button class="quiet" onclick="exportEvent('${e.id}')">Add to phone calendar</button></div><div class="right"><button class="quiet" aria-label="Delete event" onclick="deleteEvent('${e.id}')">×</button></div></div>`).join('')}</div>` : '<div class="card"><h3>Plan your next good day.</h3><p>Soma checks the Choghadiya, Hora and Rahu Kaal for the time you pick.</p></div>'}</section>`;
  $('app').innerHTML = `<div class="split"><div class="lead">${lead}</div><div class="rest">${rest}</div></div>`;
}

// ---- Muhurat ----------------------------------------------------------------------------------
/* Days in the next `days` that suit an event: nakshatra class, tithi group and weekday from the tradition, no bad yoga or Bhadra at sunrise. */
function muhuratDays(evKey, from, days) {
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
    if (win) out.push({ key, d, win, why: `${L.tithiName(l.tithi.index)} (${ti.group}) · ${L.nakName(l.nakshatra.index)} (${na.group}) · ${L.vaarName(d.frame.weekday)}` });
  }
  return out;
}
function muhuratView() {
  const d = vedicDay(day), at = now(), live = isToday();
  const list = (items, nameOf, tipOf) => items.map(p => `<div class="timeline ${live && p.start <= at && at < p.end ? 'current' : live && p.end <= at ? 'past' : ''}"><i class="dot ${p.nature}"></i><div><strong>${esc(nameOf(p))}</strong><p>${esc(tipOf(p))}</p></div><div class="right">${span(p)}<br>${badge(p.nature)}</div></div>`).join('');
  const ev = muhuratDays(muhuratEvent, day, 60);
  const lead = `<div class="eyebrow">${esc(L.vaarName(d.frame.weekday))} · ${esc(L.tithiName(d.sunriseLimbs.tithi.index))}</div><h1>${esc(t('muhurat'))}</h1>${datebar()}`
    + `<section class="section">${groupHead(t('ovPlan'), esc(t('findMuhurat')))}<label>${esc(t('eventType'))}<select onchange="muhuratEvent=this.value;muhuratView()">${M.EVENTS.map(e => `<option value="${e.key}" ${e.key === muhuratEvent ? 'selected' : ''}>${esc(e.en)}</option>`).join('')}</select></label>`
    + `<div class="list"><div class="timeline"><div><div class="eyebrow">${esc(t('goodDays'))}</div></div></div>${ev.length ? ev.map(x => `<div class="timeline" onclick="setDay('${x.key}')"><i class="dot good"></i><div><strong>${dayLabel(x.key)}</strong><p>${esc(x.why)}</p></div><div class="right">${span(x.win)}<br>${esc(L.chogName(x.win.key))}</div></div>`).join('') : `<p style="padding:14px 0">${esc(t('noGoodDays'))}</p>`}</div>`
    + `<p class="caption" style="margin-top:10px">For vivah (wedding) muhurat, match the couple’s charts with your family priest.</p></section>`;
  const rest = `<section class="section">${groupHead(t('ovDay'), esc(t('bestTimes')))}<div class="list">`
    + [['abhijit', d.periods.abhijit, 'good'], ['brahma', d.periods.brahma, 'good'], ['rahu', d.periods.rahu, 'bad'], ['yamaganda', d.periods.yamaganda, 'bad'], ['gulika', d.periods.gulika, 'bad']]
      .map(([k, p, n]) => `<div class="timeline"><i class="dot ${n}"></i><div><strong>${esc(t(k))}</strong>${k === 'abhijit' && p.wednesday ? '<p>Not used on Wednesdays</p>' : ''}</div><div class="right">${span(p)}</div></div>`).join('') + '</div></section>'
    + `<section class="section">${groupHead(t('choghadiya'), esc(t('day')))}<div class="list chog">${list(d.choghadiya.filter(c => !c.night), c => L.chogName(c.key), c => M.CHOG[c.key].good)}</div></section>`
    + `<section class="section">${groupHead(t('choghadiya'), esc(t('night')))}<div class="list chog">${list(d.choghadiya.filter(c => c.night), c => L.chogName(c.key), c => M.CHOG[c.key].good)}</div></section>`
    + `<section class="section"><details><summary>${esc(t('hora'))} (24)</summary><div class="list">${list(d.hora, h => L.planetName(h.lord), h => M.PLANET[h.lord].good)}</div></details></section>`;
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
  const lead = `<div class="eyebrow">${esc(t('moonTitle'))}</div><h1>${esc(L.tithiName(ti.index))}</h1><p>${titleDay(day)}</p><div class="moonbox"><canvas width="420" height="420" id="largeMoon" aria-label="Moon illumination"></canvas></div>`
    + `<div style="text-align:center"><h2>${Math.round(illum.phase_fraction * 100)}%</h2><p>${esc(L.nakName(nk.index))} ${nk.pada} · ${esc(L.rashiName(rashi))}</p></div>`
    + `<label>${live ? esc(t('now')) + ' · ' : ''}<span id="scrubTime">${fmt(d)}</span><input aria-label="Time of day" type="range" min="0" max="23.75" step="0.25" value="${h}" oninput="$('scrubTime').textContent=String(Math.floor(this.value)).padStart(2,'0')+':'+String(Math.round(this.value%1*60)).padStart(2,'0')" onchange="hour=+this.value;moonView()"></label>${datebar()}`;
  const rest = `<div class="grid2"><div class="card"><div class="caption">${esc(t('moonrise'))}</div><div class="value">${fmt(data.moonrise)}</div></div><div class="card"><div class="caption">${esc(t('moonset'))}</div><div class="value">${fmt(data.moonset)}</div></div></div>`
    + `<section class="section"><h2>${esc(t('comingUp'))}</h2><div class="list">${next.map(e => `<div class="timeline"><i class="dot"></i><div><strong>${esc(e.name)}</strong></div><div class="right">${full(e.d)}</div></div>`).join('')}</div></section>`;
  $('app').innerHTML = `<div class="split"><div class="lead">${lead}</div><div class="rest">${rest}</div></div>`;
  drawMoon('largeMoon', ti.angle);
}

// ---- Learn (Gyan) -----------------------------------------------------------------------------
const lessons = [
  ['તિથિ · Tithi, the lunar day', 'PANCHANG', 'A tithi is the time the Moon takes to move 12° ahead of the Sun. There are 30 in a lunar month: 15 in Shukla paksha (સુદ) as the Moon grows and 15 in Krishna paksha (વદ) as it wanes. The tithi at sunrise, the udaya tithi, governs the day.', 'Tithis fall in five families that repeat: Nanda (joy), Bhadra (steady), Jaya (victory), Rikta (empty) and Purna (complete). Rikta tithis, Chaturthi, Navami and Chaturdashi, are kept for clearing obstacles rather than new beginnings.', 'https://packolkata.imd.gov.in/panchang/en/preface'],
  ['નક્ષત્ર · The 27 nakshatras', 'PANCHANG', 'The Moon passes through 27 nakshatras, each ruled by a deity. The nakshatra of the day shapes what work it suits: fixed (Dhruva) stars for foundations and griha pravesh, movable (Chara) stars for travel and vehicles, swift (Kshipra) stars for trade and medicine, gentle (Mridu) stars for arts and relationships.', 'Fierce (Ugra) and sharp (Tikshna) nakshatras are avoided for ceremonies. Your janma nakshatra, the Moon’s nakshatra at birth, is the basis of Tarabalam.', ''],
  ['ચોઘડિયું · Choghadiya and Hora', 'MUHURAT', 'The day from sunrise to sunset and the night from sunset to the next sunrise are each split into eight Choghadiyas. Amrit, Shubh and Labh are auspicious, Char is good for travel, and Udveg, Kaal and Rog are avoided for new work.', 'Hora divides the day and night into twelve parts each, ruled in turn by the seven grahas starting with the lord of the weekday. Choose a Jupiter, Venus, Mercury or Moon hora for good work. Rahu Kaal, Yamaganda and Gulika are eighths of the daytime set aside each weekday. On the Today dial the coloured ring is the Choghadiya, the dotted inner band is Rahu Kaal and the hand is now.', ''],
  ['અગિયારસ · Ekadashi and parana', 'VRAT', 'Ekadashi, the eleventh tithi of each paksha, is kept as a fast for Vishnu. Soma follows the sunrise rule: the fast is kept on the day Ekadashi prevails at sunrise.', 'The fast is broken (parana) on Dwadashi after sunrise, after Hari Vasara (the first quarter of Dwadashi) has passed, ideally in the morning and always before Dwadashi ends. Soma shows this window for your city.', ''],
  ['સુદ, વદ અને માસ · Amanta and Purnimanta', 'CALENDAR', 'In Gujarat, Maharashtra and the South a lunar month ends at Amavasya (amanta). In North India it ends at Purnima (purnimanta), so the Krishna paksha carries the next month’s name. The festival falls on the same day either way; only the month name differs.', 'Every few years an adhik (extra) month keeps the lunar year in step with the seasons. Festivals are not celebrated in an adhik month. Choose your month system in Settings.', ''],
  ['ગ્રહણ · Grahan and sutak', 'VRAT', 'Soma lists lunar and solar eclipses that are visible from your city. Sutak traditionally begins nine hours before a lunar eclipse and twelve hours before a solar eclipse; food is not cooked and temples close until the eclipse ends.', 'After the eclipse, bathe, offer charity and resume puja.', ''],
  ['નક્ષત્ર અને રાશિ · Your birth sky', 'JYOTISH', 'Your janma rashi and nakshatra come from the Moon’s sidereal position at your birth. Each day Soma compares today’s Moon with them: Chandrabalam is strong when the Moon is 1st, 3rd, 6th, 7th, 10th or 11th from your rashi, and Tarabalam counts the nakshatras from yours in groups of nine.', 'Sampat, Kshema, Sadhana, Mitra and Param Mitra taras are supportive; Vipat, Pratyari and Naidhana call for care.', 'https://github.com/svarbhanu/grahan'],
  ['અંકશાસ્ત્ર · Mulank and Bhagyank', 'ANKSHASTRA', 'Mulank is the sum of the digits of your birth day reduced to one digit. Bhagyank is the sum of all digits of your full birth date, reduced the same way.', 'Soma uses single-digit reduction without master numbers.', ''],
  ['અમારી ગણતરી · How Soma calculates', 'METHOD', 'Soma is a Drik (computed) panchang. Astronomy Engine 2.1.19 finds the Sun and Moon offline; sidereal positions use the Lahiri ayanamsa (linear approximation). Sunrise uses the standard refracted horizon at sea level for the city you choose, so times can differ by a minute or two from a printed panchang made for another town.', 'Festival dates follow the common rules for each observance (udaya tithi, pradosh, nishita, madhyahna, aparahna, moonrise) for your own place and time zone; families and sampradayas sometimes follow a different rule, so a date can differ by a day from your local almanac. The muhurat finder checks nakshatra, tithi, weekday, yoga and Bhadra, and skips Kharmas (and Chaturmas for griha pravesh and mundan); it does not yet check Guru or Shukra asta. City search uses an offline list of places from GeoNames. Plans, birth details and settings stay on this phone; there is no account, advertising or tracking.', 'https://github.com/cosinekitty/astronomy']
];
/* Lesson titles carry the Gujarati word first; English readers see only the English half. */
const lessonTitle = l => L.lang === 'gu' ? l[0] : l[0].split(' · ').slice(1).join(' · ') || l[0];
function learnView() {
  $('app').innerHTML = `<div class="eyebrow">${esc(t('learnTitle'))}</div><h1>${esc(t('learnMore'))}</h1><p style="margin-top:6px">${esc(t('learnSub'))}</p><div class="section">${lessons.map((l, i) => `<button class="lesson" onclick="lesson(${i})"><div class="eyebrow">${l[1]}</div><h3>${esc(lessonTitle(l))} <span>›</span></h3><span>${l[2].slice(0, 96)}…</span></button>`).join('')}</div>`;
}
function modal(html) { $('dialogBody').innerHTML = html; if (!$('modal').open) $('modal').showModal(); $('modal').scrollTop = 0; }
function lesson(i) { const l = lessons[i]; modal(`<div class="eyebrow">${l[1]}</div><h2>${esc(lessonTitle(l))}</h2><p style="color:var(--ink)">${l[2]}</p><p>${l[3]}</p>${l[4] ? `<a href="${l[4]}">Read the source</a>` : ''}`); }

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
  $(kind + 'Results').innerHTML = ''; $(kind + 'Query').value = '';
  $(kind + 'Picked').innerHTML = pickedHtml(h.name, [h.state, h.country].filter(Boolean).join(', '));
  if (kind === 'loc') saveLocation();
}
function locationFields() {
  return `<button class="primary gold" type="button" onclick="gps()">${icon('pin')} ${esc(t('useMyLocation'))}</button><div class="or">${esc(t('orSearch'))}</div>${placeField('loc', loc.name)}`
    + `<details><summary>${esc(t('advanced'))}</summary><label>${esc(t('placeName'))}<input id="place" value="${esc(loc.name)}" maxlength="70"></label><div class="grid2"><label>${esc(t('latitude'))}<input id="lat" type="number" step="any" value="${loc.lat}"></label><label>${esc(t('longitude'))}<input id="lon" type="number" step="any" value="${loc.lon}"></label></div><label>${esc(t('timeZone'))}<input id="zone" value="${esc(loc.zone)}" placeholder="Asia/Kolkata"></label><button class="primary" type="button" onclick="saveLocation()">${esc(t('useThis'))}</button></details>`;
}
function locationSheet() { modal(`<div class="eyebrow">${esc(t('location'))}</div><h2>${esc(t('whereAreYou'))}</h2><p>${esc(t('whereWhy'))}</p>${locationFields()}`); }
/* Switch place. If the screen was on today, stay on today in the new place's time zone. */
function setLoc(next) {
  const wasToday = isToday();
  loc = next;
  if (wasToday) { day = todayKey(); monthView = day.slice(0, 7); }
  lastToday = todayKey();
  memo.clear();
}
function saveLocation() {
  try {
    const lat = Number($('lat').value), lon = Number($('lon').value), zone = $('zone').value.trim();
    if (!$('lat').value || !$('lon').value || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) throw Error();
    new Intl.DateTimeFormat('en', { timeZone: zone });
    setLoc({ name: $('place').value.trim() || 'Custom location', lat, lon, zone });
    applyLocationDefaults(); persist(); haptic('success');
    if ($('modal').open) $('modal').close();
    scheduleNative(true);
    if (onboardStep) onboard(3); else render();
  } catch (e) { toast('Enter valid coordinates and an IANA time zone.'); }
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
  const name = near ? (near.km > 15 ? t('nearPlace', { p: near.name }) : near.name) : 'Current location';
  setLoc({ name, lat: +(+p.lat).toFixed(4), lon: +(+p.lon).toFixed(4), zone: p.zone || (near && near.zone) || 'Asia/Kolkata' });
  applyLocationDefaults(); persist(); haptic('success');
  if ($('modal').open) $('modal').close();
  scheduleNative(true);
  if (onboardStep) onboard(3); else { render(); toast(loc.name); }
}
window.somaReceiveLocation = s => receiveGPS(typeof s === 'string' ? JSON.parse(s) : s);

// ---- Settings ---------------------------------------------------------------------------------
function seg(name, value, options, onpick) { return `<div class="seg" role="radiogroup" aria-label="${esc(name)}">${options.map(([k, label]) => `<button type="button" role="radio" aria-checked="${k === value}" class="${k === value ? 'on' : ''}" onclick="${onpick}('${k}')">${esc(label)}</button>`).join('')}</div>`; }
function setPref(key, v) { prefs[key] = v; if (key === 'lang') L = I18n.make(v); persist(); haptic('select'); render(); if (onboardStep) onboard(onboardStep); }
function setLang(v) { setPref('lang', v); }
function setTheme(v) { setPref('theme', v); }
function setLayout(v) { setPref('layout', v); }
const LANGS = [['en', 'English'], ['gu', 'ગુજરાતી'], ['hi', 'हिन्दी']];
function settings() {
  const r = prefs.reminders, check = (k, label) => `<label class="check"><input type="checkbox" id="rem_${k}" ${r[k] ? 'checked' : ''}> ${esc(label)}</label>`;
  modal(`<div class="eyebrow">${esc(t('settings'))}</div><h2>${esc(t('location'))}</h2>${locationFields()}`
    + `<h2 class="section">${esc(t('language'))}</h2><select id="langPick">${LANGS.map(([k, n]) => `<option value="${k}" ${prefs.lang === k ? 'selected' : ''}>${n}</option>`).join('')}</select>`
    + `<h2 class="section">${esc(t('monthSystem'))}</h2><select id="monthPick"><option value="amanta" ${prefs.month === 'amanta' ? 'selected' : ''}>${esc(t('amanta'))}</option><option value="purnimanta" ${prefs.month === 'purnimanta' ? 'selected' : ''}>${esc(t('purnimanta'))}</option></select>`
    + `<h2 class="section">${esc(t('festivalSets'))}</h2><div class="card">${Fe.SETS.map(s => `<label class="check"><input type="checkbox" id="set_${s}" ${prefs.sets.indexOf(s) >= 0 ? 'checked' : ''}> ${esc(t('sets')[s])}</label>`).join('')}</div>`
    + `<h2 class="section">${esc(t('reminders'))}</h2><div class="card">${check('vrat', t('remVrat'))}${check('parana', t('remParana'))}${check('daily', t('remDaily'))}${check('rahu', t('remRahu'))}</div>`
    + `<button class="primary" onclick="savePrefs()">${esc(t('save'))}</button><button class="lesson" onclick="lesson(8)"><h3>${esc(t('method'))} <span>›</span></h3></button>`);
}
function savePrefs() {
  const sets = Fe.SETS.filter(s => $('set_' + s).checked);
  prefs.custom = prefs.custom || sets.join() !== prefs.sets.join() || $('monthPick').value !== prefs.month;
  prefs.sets = sets; prefs.month = $('monthPick').value; prefs.lang = $('langPick').value;
  for (const k of ['vrat', 'parana', 'daily', 'rahu']) prefs.reminders[k] = $('rem_' + k).checked;
  L = I18n.make(prefs.lang);
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
  modal(`<div class="eyebrow">${esc(t('muhurat'))}</div><h2>${esc(t('planEvent'))}</h2><p>${titleDay(day)}</p><form onsubmit="saveEvent(event)"><label>Event title<input id="eventTitle" required maxlength="100" placeholder="Griha pravesh"></label><label>Local start time<input type="time" id="eventTime" value="10:00" required oninput="timingCheck()"></label><div class="card" id="timingCheck"></div><label>Duration<select id="duration"><option value="60">1 hour</option><option value="30">30 minutes</option><option value="120">2 hours</option></select></label><p class="caption">${esc(loc.name)} · ${esc(loc.zone)}</p><button class="primary">Save plan</button></form>`);
  timingCheck();
}
function saveEvent(e) {
  e.preventDefault();
  if (!$('eventTitle').value.trim()) { toast('Enter an event title.'); return; }
  const time = $('eventTime').value, start = K.instant(day, time, loc.zone), rt = K.parts(start, loc.zone);
  if (rt.hour + ':' + rt.minute !== time) { toast('This clock time does not exist due to a DST change. Choose another.'); return; }
  const c = P.at(frameFor(start).choghadiya, start);
  events.push({ id: Date.now().toString(36), title: $('eventTitle').value.trim(), day, time, start: start.toISOString(), end: new Date(+start + Number($('duration').value) * 60000).toISOString(), zone: loc.zone, place: loc.name, tithi: L.tithiName(K.tithi(start).index), muhurat: c ? M.CHOG[c.key].en + ' choghadiya' : '' });
  if (persist()) { $('modal').close(); haptic('success'); show('calendar'); toast('Plan saved on this device'); }
}
function deleteEvent(id) { modal(`<h2>Remove this plan?</h2><p>This removes the local copy only.</p><button class="primary" onclick="events=events.filter(e=>e.id!=='${id}');persist();document.querySelector('dialog').close();render()">Remove plan</button>`); }
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
    natal = `<div class="grid2 section"><div class="card"><div class="caption">${esc(t('janmaRashi'))}</div><h2>${esc(L.rashiName(Math.floor(n / 30)))}</h2></div><div class="card"><div class="caption">${esc(t('janmaNak'))}</div><h2>${esc(L.nakName(nak))}</h2><p class="caption">Pada ${Math.floor((n % (360 / 27)) / (360 / 108)) + 1} · ${esc(M.nakshatra(nak).deity)}</p></div></div>`
      + `<div class="card personalDay ${today.verdict}"><div class="row"><div class="eyebrow">${esc(t('forYou'))}</div>${badge(today.verdict)}</div><h2 style="margin-top:6px">${esc(verdictWord(today.verdict))}</h2><p>${esc(t('chandrabalam'))}: ${today.chandraCount} · ${today.chandraGood ? esc(t('good')) : esc(t('bad'))}</p><p>${esc(t('tarabalam'))}: ${esc(M.TARA[today.tara.key])}</p></div>`
      + `<div class="card"><div class="eyebrow">${esc(t('personalDays'))}</div><div class="chipRow" style="flex-wrap:wrap">${good.length ? good.map(k => `<button class="chip" onclick="setDay('${k}');show('today')">${dayLabel(k, { weekday: undefined })}</button>`).join('') : esc(t('none'))}</div></div>`;
    // The kundali's houses hang on the lagna, which needs the birth time; without it, show only what the Moon gives.
    if (profile.timeUnknown) natal += `<div class="card"><span class="tag">Janma kundali</span><p class="notice">${esc(t('timeUnknownNote'))}</p></div>`;
    else if (window.SomaNatal) {
      try { natal += `<div class="card"><span class="tag">Janma kundali · North Indian</span><div class="natal">${SomaNatal.chart(instant, profile.lat, profile.lon)}</div><p class="caption">Sidereal (Lahiri) chart for ${esc(profile.date)} ${esc(profile.time)} · ${esc(profile.place || profile.zone)}</p></div>`; }
      catch (e) { natal += '<p class="notice">Chart unavailable for this input.</p>'; }
    }
    natal += `<section class="section">${groupHead(t('ovNumbers'), esc(t('numerology')))}<div class="grid2"><div class="card"><div class="caption">${esc(t('mulank'))}</div><div class="number">${K.reduce(profile.date.slice(-2))}</div></div><div class="card"><div class="caption">${esc(t('bhagyank'))}</div><div class="number">${K.reduce(profile.date)}</div></div></div><button class="lesson" onclick="lesson(7)"><h3>How these are counted <span>›</span></h3></button></section>`;
  }
  const head = `<div class="eyebrow">${esc(t('yourSky'))}</div><h1>${esc(t('you'))}</h1>`
    + `<div class="card"><div class="profile"><div class="avatar">${SomaDial.moon(34, birthMoon() != null ? 120 : 60)}</div><div style="flex:1;min-width:0"><span class="tag">${esc(t('birthStays'))}</span><h3 style="margin-top:6px">${has ? esc(dayLabel(profile.date, { year: 'numeric' }).replace(/,? \d{1,2}:.*/, '')) + (profile.place ? ' · ' + esc(profile.place.split(',')[0]) : '') : esc(t('addBirth'))}</h3></div></div><button class="primary" onclick="editProfile()">${has ? esc(t('editBirth')) : esc(t('addBirth'))}</button></div>`;
  const options = `<section class="section">${groupHead(t('ovStyle'), esc(t('appearance')))}<div class="card"><label style="margin-top:0">${esc(t('language'))}${seg(t('language'), prefs.lang, LANGS, 'setLang')}</label>`
    + `<label>${esc(t('theme'))}${seg(t('theme'), prefs.theme, [['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]], 'setTheme')}</label>`
    + `<label>${esc(t('layout'))}${seg(t('layout'), prefs.layout, [['dial', t('layoutDial')], ['sky', t('layoutSky')], ['folio', t('layoutFolio')]], 'setLayout')}</label></div></section>`
    + `<section class="section">${groupHead(t('ovApp'), esc(t('settings')))}<div class="group"><button onclick="locationSheet()">${esc(t('location'))}<span>${esc(loc.name)} ›</span></button><button onclick="settings()">${esc(t('festivalSets'))} · ${esc(t('reminders'))}<span>›</span></button><button onclick="show('learn')">${esc(t('learnMore'))}<span>›</span></button><button onclick="lesson(8)">${esc(t('method'))}<span>›</span></button>${updatesOn() ? `<button onclick="updateSheet()">${esc(t('updTitle'))}<span>${esc((updateInfo() || {}).versionName || '')} ›</span></button>` : ''}</div>`
    + (has ? `<button class="quiet section" onclick="eraseProfile()">${esc(t('deleteBirth'))}</button>` : '') + `</section>`;
  $('app').innerHTML = `<div class="split"><div class="lead">${head}${options}</div><div class="rest">${natal || `<button class="lesson" onclick="lesson(6)"><h3>${esc(lessonTitle(lessons[6]))} <span>›</span></h3><span>Janma rashi, nakshatra, Chandrabalam and Tarabalam.</span></button>`}</div></div>`;
}
function birthForm() {
  const unknown = !!profile.timeUnknown;
  return `<form onsubmit="saveProfile(event)"><label>${esc(t('dateOfBirth'))}<input id="birthDate" type="date" required min="1900-01-01" max="2100-12-31" value="${esc(profile.date || '')}"></label>`
    + `<label>${esc(t('timeOfBirth'))}<input id="birthTime" type="time" value="${esc(profile.time || '12:00')}" ${unknown ? 'disabled' : ''}></label><label class="check" style="border:0"><input type="checkbox" id="birthUnknown" ${unknown ? 'checked' : ''} onchange="document.getElementById('birthTime').disabled=this.checked"> ${esc(t('dontKnowTime'))}</label>`
    + `<label for="birthQuery">${esc(t('placeOfBirth'))}</label>${placeField('birth', profile.place || '')}`
    + `<details><summary>${esc(t('advanced'))}</summary><input id="birthPlace" type="hidden" value="${esc(profile.place || '')}"><div class="grid2"><label>${esc(t('latitude'))}<input id="birthLat" type="number" required step="any" min="-90" max="90" value="${profile.lat ?? loc.lat}"></label><label>${esc(t('longitude'))}<input id="birthLon" type="number" required step="any" min="-180" max="180" value="${profile.lon ?? loc.lon}"></label></div><label>${esc(t('timeZone'))}<input id="birthZone" required value="${esc(profile.zone || loc.zone)}"></label></details>`
    + `<p class="caption" style="margin-top:12px">${esc(t('birthWhy'))}</p><button class="primary">${esc(t('seeMySky'))}</button></form>`;
}
function editProfile() { modal(`<div class="eyebrow">${esc(t('yourSky'))}</div><h2>${esc(t('birthTitle'))}</h2>${birthForm()}`); }
function saveProfile(e) {
  e.preventDefault();
  try {
    const unknown = $('birthUnknown') && $('birthUnknown').checked;
    const p = { date: $('birthDate').value, time: unknown ? '12:00' : $('birthTime').value, timeUnknown: unknown, zone: $('birthZone').value.trim(), lat: +$('birthLat').value, lon: +$('birthLon').value, place: ($('birthPlace') && $('birthPlace').value) || '' };
    if (!p.date) throw Error();
    new Intl.DateTimeFormat('en', { timeZone: p.zone });
    const d = K.instant(p.date, p.time, p.zone), r = K.parts(d, p.zone);
    if (r.hour + ':' + r.minute !== p.time) throw Error();
    profile = p;
    if (persist()) { haptic('success'); if ($('modal').open) $('modal').close(); if (onboardStep) finishOnboard('personal'); else personalView(); }
  } catch (e) { toast('Check the birth date, time and place.'); }
}
function eraseProfile() { modal(`<h2>${esc(t('deleteBirth'))}?</h2><p>This clears the profile and its calculated chart.</p><button class="primary" onclick="profile={};persist();document.querySelector('dialog').close();personalView()">${esc(t('deleteBirth'))}</button>`); }

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
  else if (step === 2) html = `<div class="eyebrow">${esc(t('step', { n: 2, m: 3 }))}</div><h1 style="margin-top:6px">${esc(t('whereAreYou'))}</h1><p style="margin:8px 0 18px">${esc(t('whereWhy'))}</p>${locationFields()}` + foot('', 'onboard(3)');
  else if (step === 3) html = `<div class="eyebrow">${esc(t('step', { n: 3, m: 3 }))} · ${esc(t('yourSky'))}</div><h1 style="margin-top:6px">${esc(t('birthTitle'))}</h1>${birthForm()}` + foot('', "finishOnboard('today')");
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
    if (r.vrat && f.day > from) add(K.instant(K.addDay(f.day, -1), '19:00', loc.zone), 'Tomorrow: ' + L.festName(f), f.key === 'ekadashi' ? 'The fast begins at sunrise.' + (f.parana ? ' Parana ' + dayLabel(f.parana.day) + ' ' + span(f.parana) + '.' : '') : (f.note || L.festName(f) + ' at ' + loc.name), 'eve-' + f.key + '-' + f.day);
    if (r.parana && f.parana) add(f.parana.start, t('parana') + ': ' + f.en, 'Break the fast before ' + fmt(f.parana.end) + '.', 'parana-' + f.day);
  }
  if (r.daily || r.rahu) {
    const samp = Fe.samples(from, 14, loc);
    for (const s of samp.slice(0, 14)) {
      const ti = Math.floor(A.MoonPhase(s.sunrise) / 12), wd = new Date(Date.parse(s.day + 'T12:00Z')).getUTCDay(), seg0 = P.RAHU[wd] - 1;
      const rahu = { start: new Date(+s.sunrise + (s.sunset - s.sunrise) * seg0 / 8), end: new Date(+s.sunrise + (s.sunset - s.sunrise) * (seg0 + 1) / 8) };
      const fest = list.filter(x => x.day === s.day).map(x => L.festName(x)).join(', ');
      if (r.daily) add(s.sunrise, L.vaarName(wd) + ' · ' + L.tithiName(ti), (fest ? fest + '. ' : '') + t('rahu') + ' ' + span(rahu), 'daily-' + s.day);
      if (r.rahu) add(rahu.start, t('rahu') + ' ' + span(rahu), 'Avoid starting new work until ' + fmt(rahu.end) + '.', 'rahu-' + s.day);
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
function widgetFestivals(today) {
  try { return window.SomaFestivals && typeof SomaFestivals.upcoming === 'function' ? SomaFestivals.upcoming(loc, today, 60) || [] : []; }
  catch (e) { return []; }
}
function pushWidgetFeed() {
  if (!window.SomaNative || !SomaNative.updateWidgetFeed || !window.SomaWidgetFeed) return;
  const at = now(), today = K.dateKey(at, loc.zone);
  const key = [loc.lat, loc.lon, loc.zone, loc.name, today, Math.floor(at.getTime() / 216e5), JSON.stringify(window.SomaFestivalSets || '')].join('|');
  if (key === widgetKey) return;
  try { SomaNative.updateWidgetFeed(JSON.stringify(SomaWidgetFeed.build(loc, at, widgetFestivals(today)))); widgetKey = key; }
  catch (e) { console.error('Widget feed failed: ' + e.message); }
}
function scheduleWidgetFeed() { clearTimeout(widgetTimer); widgetTimer = setTimeout(pushWidgetFeed, 400); }

// ---- Updates for preview builds (sideloaded APKs) ------------------------------------------
/* Preview builds read the newest build from GitHub, download it and open Android's installer.
   Store builds report enabled:false and update through the store, so none of this shows there. */
const upd = { state: '', feed: null, progress: -1, message: '', manual: false };
function updateInfo() { try { return window.SomaNative && SomaNative.updateInfo ? JSON.parse(SomaNative.updateInfo()) : null; } catch (e) { return null; } }
function updatesOn() { const i = updateInfo(); return !!(i && i.enabled); }
function checkUpdate(manual) {
  if (!updatesOn() || upd.state === 'checking' || upd.state === 'downloading') return;
  upd.manual = !!manual; upd.state = 'checking'; upd.message = '';
  prefs.updateChecked = Clock.ms(); persist();
  if (manual) updateSheet();
  SomaNative.checkForUpdate();
}
function installUpdate() { if (!updatesOn()) return; hideUpdateNote(); upd.state = 'downloading'; upd.progress = -1; updateSheet(); SomaNative.installUpdate(); }
window.somaReceiveUpdate = function (json) {
  let m; try { m = JSON.parse(json); } catch (e) { return; }
  upd.state = m.state;
  if (m.state === 'available' || m.state === 'latest') upd.feed = m;
  if (m.state === 'downloading') upd.progress = m.progress;
  if (m.state === 'error') upd.message = m.message || '';
  const open = $('modal').open && $('updateBody');
  if (open) updateSheet();
  else if (m.state === 'available' && !upd.manual && prefs.updateSkipped !== m.versionCode) showUpdateNote(m);
  else if (m.state === 'error' && !upd.manual) upd.state = '';
};
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
  const i = updateInfo() || {}, f = upd.feed, s = upd.state;
  const action = s === 'available' || s === 'cancelled' || s === 'permission' || (s === 'error' && f && f.versionCode > i.versionCode)
    ? `<button class="primary gold" onclick="installUpdate()">${esc(t('updInstall'))}</button>`
    : s === 'checking' || s === 'downloading' || s === 'installing' || s === 'confirm' ? ''
    : `<button class="primary" onclick="checkUpdate(true)">${esc(t('updCheck'))}</button>`;
  const notes = f && f.versionCode > i.versionCode && f.notes ? `<p class="caption">${esc(t('updWhatsNew'))}: ${esc(f.notes)}</p>` : '';
  modal(`<div id="updateBody"><div class="eyebrow">Soma Preview</div><h2>${esc(t('updTitle'))}</h2>`
    + `<div class="group"><div class="item">${esc(t('updThisPhone'))}<span>${esc(i.versionName || '')}</span></div>${f ? `<div class="item">${esc(t('updNewest'))}<span>${esc(f.versionName)}${f.published ? ' · ' + esc(dayLabel(String(f.published).slice(0, 10), { weekday: undefined })) : ''}</span></div>` : ''}</div>`
    + `<p class="notice" role="status">${esc(updateStatus())}</p>${notes}${action}<p class="caption">${esc(t('updHow'))}</p></div>`);
}
function showUpdateNote(f) {
  let el = $('updateNote');
  if (!el) { el = document.createElement('div'); el.id = 'updateNote'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = `<span>${esc(t('updReady', { v: f.versionName }))}</span><button class="quiet" onclick="updateSheet()">${esc(t('updView'))}</button><button class="quiet" aria-label="${esc(t('updLater'))}" onclick="prefs.updateSkipped=${+f.versionCode};persist();hideUpdateNote()">✕</button>`;
  el.style.display = 'flex';
}
function hideUpdateNote() { const el = $('updateNote'); if (el) el.style.display = 'none'; }
/* A quiet look at most every 12 hours, when the app opens or comes back to the front. */
function autoCheckUpdate() { if (updatesOn() && Clock.ms() - (prefs.updateChecked || 0) > 432e5) checkUpdate(false); }

window.SomaPrototype = { health: () => ({ ready: true, version: '0.8.0', tithi: K.tithi(now()).label, location: loc.name, festivals: observances(todayKey(), 30).length }) };
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
document.addEventListener('visibilitychange', () => { if (!document.hidden) autoCheckUpdate(); });
setTimeout(autoCheckUpdate, 3000);
if (window.matchMedia) { const mq = window.matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', () => { if (prefs.theme === 'auto') render(); }); }
