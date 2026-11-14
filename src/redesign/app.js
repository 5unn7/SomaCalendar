"use strict";
/* Soma 0.7 — a daily panchang in the believer's own voice: what today is, when the good times are, which vrat is next. */
const $ = id => document.getElementById(id), K = Kaal, A = Astronomy, P = Panchang, M = Meanings, Fe = Festivals;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cities = [
  { name: 'Jamnagar', lat: 22.4707, lon: 70.0577, zone: 'Asia/Kolkata' },
  { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714, zone: 'Asia/Kolkata' },
  { name: 'Mumbai', lat: 19.076, lon: 72.8777, zone: 'Asia/Kolkata' },
  { name: 'Regina', lat: 50.4452, lon: -104.6189, zone: 'America/Regina' },
  { name: 'Toronto', lat: 43.6532, lon: -79.3832, zone: 'America/Toronto' },
  { name: 'New Delhi', lat: 28.6139, lon: 77.209, zone: 'Asia/Kolkata' },
  { name: 'Varanasi', lat: 25.3176, lon: 82.9739, zone: 'Asia/Kolkata' },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, zone: 'Asia/Kolkata' },
  { name: 'London', lat: 51.5072, lon: -0.1276, zone: 'Europe/London' },
  { name: 'New Jersey (Edison)', lat: 40.5187, lon: -74.4121, zone: 'America/New_York' },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708, zone: 'Asia/Dubai' }
];
const STORE = 'soma-redesign-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) {}
let loc = saved.loc || cities[0], profile = saved.profile || {}, events = saved.events || [];
let prefs = Object.assign({ lang: 'en', month: null, sets: null, custom: false, reminders: { vrat: true, parana: true, daily: false, rahu: false } }, saved.prefs || {});
let view = 'today', day = K.dateKey(new Date(), loc.zone), monthView = day.slice(0, 7), hour = 12, practice = null, muhuratEvent = 'griha';
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
function toast(s) { $('toast').textContent = s; $('toast').style.display = 'block'; setTimeout(() => ($('toast').style.display = 'none'), 4000); }
const locale = () => (L.lang === 'gu' ? 'gu-IN' : L.lang === 'hi' ? 'hi-IN' : 'en-IN');
const fmt = (d, opts = {}) => d ? new Intl.DateTimeFormat('en-IN', { timeZone: loc.zone, hour: 'numeric', minute: '2-digit', ...opts }).format(d) : '—';
const span = p => p ? fmt(p.start) + ' – ' + fmt(p.end) : '—';
const full = d => fmt(d, { day: 'numeric', month: 'short' });
const dayLabel = (key, opts) => new Intl.DateTimeFormat(locale(), Object.assign({ timeZone: loc.zone, weekday: 'short', day: 'numeric', month: 'short' }, opts || {})).format(K.instant(key, '12:00', loc.zone));
const titleDay = d => new Intl.DateTimeFormat(locale(), { timeZone: loc.zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(K.instant(d, '12:00', loc.zone));
const todayKey = () => K.dateKey(new Date(), loc.zone);
const isToday = () => day === todayKey();
const sample = () => (isToday() ? new Date() : K.instant(day, '12:00', loc.zone));
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00Z') - Date.parse(a + 'T12:00Z')) / 864e5);
const badge = n => `<span class="nature ${n}">${esc(L.nature(n))}</span>`;
const methodChip = () => `<button class="chip method" onclick="settings()">Drik · Lahiri · ${prefs.month === 'purnimanta' ? 'Purnimanta' : 'Amanta'} · ${esc(loc.name)}</button>`;

// ---- Cached calculations ----------------------------------------------------------------------
const memo = new Map();
function cached(key, fn) { if (!memo.has(key)) { if (memo.size > 80) memo.clear(); memo.set(key, fn()); } return memo.get(key); }
const locKey = () => [loc.lat, loc.lon, loc.zone].join(',');
const vedicDay = key => cached('day|' + key + '|' + locKey(), () => P.day(key, loc));
const observances = (from, days) => Fe.visible(cached('fest|' + from + '|' + days + '|' + locKey(), () => Fe.list(from, days, loc)), prefs.sets);
const birthMoon = () => profile.date ? K.sidereal(K.instant(profile.date, profile.time || '12:00', profile.zone || 'Asia/Kolkata')) : null;

function show(v) { view = v; render(); window.scrollTo(0, 0); }
function setDay(d) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < '1900-01-01' || d > '2100-12-31') return; day = d; monthView = d.slice(0, 7); render(); }
function datebar() {
  return `<div class="datebar"><button aria-label="Previous day" onclick="setDay(K.addDay(day,-1))">‹</button><input aria-label="Selected date" type="date" min="1900-01-01" max="2100-12-31" value="${day}" onchange="setDay(this.value)"><button aria-label="Next day" onclick="setDay(K.addDay(day,1))">›</button><button onclick="setDay(K.dateKey(new Date(),loc.zone))">${esc(t('now'))}</button></div>`;
}
function render() {
  document.documentElement.lang = L.lang;
  $('location').textContent = '⌖ ' + loc.name;
  $('nav').innerHTML = [['today', '◷'], ['calendar', '▦'], ['muhurat', '✦'], ['moon', '◐'], ['personal', '◎']]
    .map(([v, i]) => `<button class="${view === v ? 'active' : ''}" onclick="show('${v}')"><i>${i}</i>${esc(t(v))}</button>`).join('');
  ({ today: todayView, calendar: calendarView, muhurat: muhuratView, moon: moonView, learn: learnView, personal: personalView })[view]();
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
  return { nature, good, avoid, ti, na, yo };
}
function festivalCards(key) {
  const list = observances(K.addDay(key, -1), 50), todays = list.filter(x => x.day === key), yesterdayEkadashi = list.find(x => x.key === 'ekadashi' && x.parana && x.parana.day === key);
  let html = '';
  for (const f of todays) {
    html += `<div class="card festival ${f.kind}"><div class="eyebrow">${esc(t('festivalsToday'))}</div><h2>${esc(L.festName(f))}</h2>${L.lang !== 'en' ? `<p>${esc(f.en)}</p>` : ''}${f.note ? `<p>${esc(f.note)}</p>` : ''}`
      + (f.key === 'ekadashi' ? `<p>${esc(t('fastBegins'))} · ${fmt(vedicDay(key).frame.sunrise)}</p>${f.parana ? `<p><strong>${esc(t('parana'))}:</strong> ${dayLabel(f.parana.day)} · ${span(f.parana)}</p>` : ''}` : '')
      + (f.sutak ? `<p>Sutak begins ${full(f.sutak)} · peak ${full(f.at)}</p>` : '') + '</div>';
  }
  if (yesterdayEkadashi) html += `<div class="card festival vrat"><div class="eyebrow">${esc(t('parana'))}</div><h2>${span(yesterdayEkadashi.parana)}</h2><p>${esc(yesterdayEkadashi.en)} · Dwadashi ends ${fmt(yesterdayEkadashi.parana.dwadashiEnd)}</p></div>`;
  const next = list.filter(x => x.day > key).slice(0, 6);
  html += `<section class="section"><div class="row"><h2>${esc(t('comingUp'))}</h2><button class="quiet" onclick="show('calendar')">${esc(t('allYear'))} ↗</button></div><div class="card">`
    + (next.length ? next.map(f => { const n = daysBetween(key, f.day); return `<div class="timeline"><i class="dot ${f.kind}"></i><div><strong>${esc(L.festName(f))}</strong><p>${dayLabel(f.day)}${f.parana ? ' · ' + esc(t('parana')) + ' ' + span(f.parana) : ''}</p></div><div class="right">${n === 1 ? esc(t('tomorrow')) : esc(t('inDays', { n }))}</div></div>`; }).join('') : `<p>${esc(t('none'))}</p>`)
    + '</div></section>';
  return html;
}
function nowNext(d) {
  const now = new Date(), c = P.at(d.choghadiya, now), h = P.at(d.hora, now), next = P.goodWindows(d, now)[0];
  if (!c) return '';
  return `<section class="section grid2"><div class="card"><div class="caption">${esc(t('now'))} · ${esc(t('choghadiya'))}</div><div class="value">${esc(L.chogName(c.key))}</div>${badge(c.nature)}<p class="caption">${esc(t('until'))} ${fmt(c.end)}</p></div>`
    + `<div class="card"><div class="caption">${esc(t('now'))} · ${esc(t('hora'))}</div><div class="value">${esc(h ? L.planetName(h.lord) : '—')}</div>${h ? badge(h.nature) : ''}<p class="caption">${h ? esc(t('until')) + ' ' + fmt(h.end) : ''}</p></div></section>`
    + (next ? `<button class="lesson" onclick="show('muhurat')"><div class="eyebrow">${esc(t('nextGood'))}</div><h3>${span(next)} · ${esc(L.chogName(next.key))}</h3><span>${esc(M.CHOG[next.key].good)}</span></button>` : '');
}
function practiceCard(d) {
  const chips = M.PRACTICES.map(p => `<button class="chip ${practice === p.key ? 'on' : ''}" onclick="practice='${p.key}';todayView()">${esc(L.practiceName(p))}</button>`).join('');
  const vaar = M.VAAR[d.frame.weekday];
  let body = `<p><strong>${esc(t('deityOfDay'))}:</strong> ${esc(vaar.deity)} · <strong>${esc(t('mantra'))}:</strong> ${esc(vaar.mantra)}</p>`;
  if (practice) {
    const p = M.PRACTICES.find(x => x.key === practice);
    if (p.vrat) {
      const v = observances(day, 40).find(x => x.kind === 'vrat' && x.day >= day);
      body += v ? `<p>${esc(L.festName(v))} · ${dayLabel(v.day)}${v.parana ? ' · ' + esc(t('parana')) + ' ' + dayLabel(v.parana.day) + ' ' + span(v.parana) : ''}</p>` : '';
    } else {
      const from = isToday() ? new Date() : d.frame.sunrise;
      const wins = P.goodWindows(d, from, { accept: c => p.chog.indexOf(c.key) >= 0 }).slice(0, 3);
      const horas = d.hora.filter(h => h.end > from && p.hora.indexOf(h.lord) >= 0 && !h.night && !P.overlaps(h, d.periods.rahu)).slice(0, 2);
      body += `<div class="timeline"><i class="dot"></i><div><strong>${esc(t('choghadiya'))}</strong><p>${wins.length ? wins.map(w => span(w) + ' ' + esc(L.chogName(w.key))).join(' · ') : esc(t('none'))}</p></div></div>`
        + `<div class="timeline"><i class="dot"></i><div><strong>${esc(t('hora'))}</strong><p>${horas.length ? horas.map(h => span(h) + ' ' + esc(L.planetName(h.lord))).join(' · ') : esc(t('none'))}</p></div></div>`
        + (p.brahma ? `<div class="timeline"><i class="dot"></i><div><strong>${esc(t('brahma'))}</strong><p>${span(d.periods.brahma)}</p></div></div>` : '');
    }
  }
  return `<section class="section"><h2>${esc(t('whatToday'))}</h2><div class="chipRow">${chips}</div><div class="card">${body}</div></section>`;
}
function personalLine(d) {
  const bm = birthMoon();
  if (bm == null) return `<button class="lesson" onclick="show('personal')"><div class="eyebrow">${esc(t('forYou'))}</div><h3>Add your birth details to see Chandrabalam and Tarabalam each day ↗</h3></button>`;
  const p = P.personal(bm, isToday() ? new Date() : d.frame.sunrise);
  const word = p.verdict === 'good' ? t('favourable') : p.verdict === 'bad' ? t('takeCare') : t('mixed');
  return `<div class="card personalDay ${p.verdict}"><div class="eyebrow">${esc(t('forYou'))}</div><h2>${esc(word)}</h2><p>${esc(t('chandrabalam'))}: Moon ${p.chandraCount}${['th', 'st', 'nd', 'rd'][p.chandraCount % 10 > 3 || [11, 12, 13].indexOf(p.chandraCount) >= 0 ? 0 : p.chandraCount % 10]} from your ${esc(L.rashiName(p.janmaRashi))} · ${p.chandraGood ? esc(t('good')) : esc(t('bad'))}</p><p>${esc(t('tarabalam'))}: ${esc(M.TARA[p.tara.key])}</p></div>`;
}
function limbsCard(d) {
  const l = d.sunriseLimbs, ti = M.tithi(l.tithi.index), na = M.nakshatra(l.nakshatra.index), yo = M.YOGA[l.yoga.index], ka = M.KARANA[l.karana.index], va = M.VAAR[d.frame.weekday];
  const row = (label, name, end, note, nature) => `<div class="timeline"><i class="dot"></i><div><strong>${esc(label)} · ${esc(name)}</strong><p>${esc(note)}</p></div><div class="right">${nature ? badge(nature) : ''}${end ? '<br>' + esc(t('until')) + ' ' + full(end) : ''}</div></div>`;
  return `<section class="section"><div class="row"><h2>${esc(t('todayTitle'))}</h2>${methodChip()}</div><div class="card">`
    + row(t('tithi'), L.tithiName(l.tithi.index), l.tithi.end, ti.deity + ' · ' + ti.group + '. ' + ti.note, ti.nature)
    + row(t('nakshatra'), L.nakName(l.nakshatra.index) + ' ' + l.nakshatra.pada, l.nakshatra.end, na.deity + ' · ' + na.group + '. Good for ' + na.good + '.', na.nature)
    + row(t('yoga'), L.yogaName(l.yoga.index), l.yoga.end, yo.nature === 'bad' ? 'Avoid starting important work while it lasts.' : 'Supports good work.', yo.nature)
    + row(t('karana'), L.karanaName(l.karana.index), l.karana.end, l.karana.index === 6 ? 'Bhadra: avoid auspicious beginnings.' : 'Half-tithi.', ka.nature)
    + row(t('vaar'), L.vaarName(d.frame.weekday), null, va.deity + '. Good for ' + va.good + '. Avoid ' + va.avoid + '.', null)
    + `</div><div class="section grid2"><div class="card"><div class="caption">${esc(t('sunrise'))}</div><div class="value">${fmt(d.frame.data.sunrise)}</div></div><div class="card"><div class="caption">${esc(t('sunset'))}</div><div class="value">${fmt(d.frame.data.sunset)}</div></div><div class="card"><div class="caption">${esc(t('moonrise'))}</div><div class="value">${fmt(d.frame.data.moonrise)}</div></div><div class="card"><div class="caption">${esc(t('moonset'))}</div><div class="value">${fmt(d.frame.data.moonset)}</div></div></div></section>`;
}
function todayView() {
  const d = vedicDay(day), now = sample(), ti = K.tithi(now), v = verdict(d), per = d.periods;
  const monthName = P.monthName(d.frame.sunrise, prefs.month, L.monthNames), samvat = P.samvat(d.frame.sunrise, prefs.sets.indexOf('gujarati') >= 0 ? 'gujarati' : 'north');
  const prog = ((+now - ti.start) / (ti.end - ti.start)) * 100;
  $('app').innerHTML = `<div class="eyebrow">${esc(L.vaarName(d.frame.weekday))} · ${esc(t('samvat'))} ${samvat}</div><h1>${esc(t('todayTitle'))}</h1><p>${titleDay(day)}</p>${datebar()}`
    + `<section class="card hero"><div class="eyebrow">${esc(monthName)} · ${esc(isToday() ? t('now') : t('tithi'))}</div><h1>${esc(L.tithiName(ti.index))}</h1><p>${esc(L.nakName(P.nakshatra(now).index))} · ${esc(L.vaarName(d.frame.weekday))}</p><canvas id="heroMoon" width="240" height="240" aria-label="Moon phase"></canvas>`
    + `<div class="verdict"><span class="nature ${v.nature}">${esc(v.nature === 'good' ? t('favourable') : v.nature === 'bad' ? t('takeCare') : t('mixed'))}</span><p><strong>${esc(t('goodFor'))}:</strong> ${esc(v.good)}.</p><p><strong>${esc(t('avoid'))}:</strong> ${esc(v.avoid)}.</p><p><strong>${esc(t('rahu'))}:</strong> ${span(per.rahu)}</p></div>`
    + `<div class="meta row"><div class="caption">${esc(L.tithiName(ti.index))} ${esc(t('until'))} ${full(ti.end)}</div></div><div class="progress"><div style="width:${Math.min(100, Math.max(0, prog))}%"></div></div></section>`
    + festivalCards(day) + `<section class="section">${personalLine(d)}</section>` + (isToday() ? nowNext(d) : '') + practiceCard(d)
    + `<section class="section"><h2>${esc(t('muhurat'))}</h2><div class="card">${[['abhijit', per.abhijit, 'good'], ['brahma', per.brahma, 'good'], ['rahu', per.rahu, 'bad'], ['yamaganda', per.yamaganda, 'bad'], ['gulika', per.gulika, 'bad']]
      .map(([k, p, n]) => `<div class="timeline"><i class="dot ${n}"></i><div><strong>${esc(t(k))}</strong>${k === 'abhijit' && p.wednesday ? '<p>Not used on Wednesdays</p>' : ''}</div><div class="right">${span(p)}</div></div>`).join('')}</div></section>`
    + limbsCard(d) + `<button class="primary" onclick="plan()">＋ ${esc(t('planEvent'))}</button><button class="lesson" onclick="show('learn')">${esc(t('learnMore'))} ↗</button>`;
  drawMoon('heroMoon', ti.angle);
  scheduleNative();
}

// ---- Calendar ---------------------------------------------------------------------------------
function changeMonth(n) { const d = new Date(monthView + '-15T12:00Z'); d.setUTCMonth(d.getUTCMonth() + n); monthView = d.toISOString().slice(0, 7); calendarView(); }
function toggleSet(s) {
  const i = prefs.sets.indexOf(s);
  if (i >= 0) prefs.sets.splice(i, 1); else prefs.sets.push(s);
  prefs.custom = true; persist(); scheduleNative(true); render();
}
function setChips() { return `<div class="chipRow">${Fe.SETS.map(s => `<button class="chip ${prefs.sets.indexOf(s) >= 0 ? 'on' : ''}" onclick="toggleSet('${s}')">${esc(t('sets')[s])}</button>`).join('')}</div>`; }
function calendarView() {
  const first = monthView + '-01', start = new Date(first + 'T12:00Z').getUTCDay(), count = new Date(+monthView.slice(0, 4), +monthView.slice(5), 0).getDate();
  const fest = observances(first, count + 1), bm = birthMoon();
  let cells = '<span></span>'.repeat(start);
  for (let n = 1; n <= count; n++) {
    const key = monthView + '-' + String(n).padStart(2, '0'), data = K.dayData(key, loc), ti = data.atSunrise || K.tithi(K.instant(key, '12:00', loc.zone));
    const f = fest.filter(x => x.day === key), top = f.find(x => x.kind !== 'vrat') || f[0];
    const pd = bm != null && data.sunrise ? P.personal(bm, data.sunrise).verdict : null;
    cells += `<button onclick="setDay('${key}')" class="${key === day ? 'selected ' : ''}${key === todayKey() ? 'today ' : ''}${top ? 'holy ' + top.kind : ''}${pd === 'good' ? ' mine' : ''}" aria-label="${key} ${esc(L.tithiName(ti.index))}">${n}<small>${esc(L.tithiName(ti.index))}</small>${top ? `<em>${esc(L.festName(top))}</em>` : ''}${events.some(e => e.day === key) ? '·' : ''}</button>`;
  }
  const sel = fest.filter(x => x.day === day), d = vedicDay(day);
  $('app').innerHTML = `<div class="eyebrow">${esc(P.monthName(K.instant(first, '12:00', loc.zone), prefs.month, L.monthNames))} – ${esc(P.monthName(K.instant(monthView + '-' + count, '12:00', loc.zone), prefs.month, L.monthNames))}</div><h1>${esc(t('calendar'))}</h1>${setChips()}`
    + `<div class="row section"><button onclick="changeMonth(-1)" aria-label="Previous month">‹</button><h2>${new Date(first + 'T12:00Z').toLocaleDateString(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2><button onclick="changeMonth(1)" aria-label="Next month">›</button></div>`
    + `<div class="week">${[0, 1, 2, 3, 4, 5, 6].map(i => `<span>${esc(L.vaarName(i).replace(/વાર|वार|var$/, ''))}</span>`).join('')}</div><div class="calendar">${cells}</div>`
    + (bm != null ? `<p class="caption">Underlined days are favourable for you by Chandrabalam and Tarabalam.</p>` : '')
    + `<div class="section"><h2>${titleDay(day)}</h2><div class="card"><p>${esc(L.tithiName(d.sunriseLimbs.tithi.index))} · ${esc(L.nakName(d.sunriseLimbs.nakshatra.index))} · ${esc(t('rahu'))} ${span(d.periods.rahu)}</p>`
    + sel.map(f => `<div class="timeline"><i class="dot ${f.kind}"></i><div><strong>${esc(L.festName(f))}</strong>${f.parana ? `<p>${esc(t('parana'))}: ${dayLabel(f.parana.day)} ${span(f.parana)}</p>` : ''}${f.note ? `<p>${esc(f.note)}</p>` : ''}</div></div>`).join('')
    + `</div><button class="primary" onclick="plan()">＋ ${esc(t('addEvent'))}</button></div>`
    + `<div class="section"><h2>${esc(t('comingUp'))}</h2><div class="card">${fest.filter(x => x.day >= first).map(f => `<div class="timeline" onclick="setDay('${f.day}')"><i class="dot ${f.kind}"></i><div><strong>${esc(L.festName(f))}</strong><p>${dayLabel(f.day)}${f.parana ? ' · ' + esc(t('parana')) + ' ' + span(f.parana) : ''}</p></div></div>`).join('') || `<p>${esc(t('none'))}</p>`}</div></div>`
    + `<div class="section"><h2>${esc(t('myPlans'))} <span class="caption">${events.length}</span></h2>${events.length ? events.slice().sort((a, b) => a.start.localeCompare(b.start)).map(e => `<div class="card"><div class="row"><h3>${esc(e.title)}</h3><button class="quiet" aria-label="Delete event" onclick="deleteEvent('${e.id}')">×</button></div><p>${esc(e.day)} · ${esc(e.time)} · ${esc(e.zone)}</p><p>${esc(e.tithi)} · ${esc(e.place)}</p>${e.muhurat ? `<p class="caption">${esc(e.muhurat)}</p>` : ''}<button class="quiet" onclick="exportEvent('${e.id}')">Add to phone calendar ↗</button></div>`).join('') : '<div class="card"><h3>Plan your next good day.</h3><p>Soma checks the Choghadiya, Hora and Rahu Kaal for the time you pick.</p></div>'}</div>`;
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
    const win = P.goodWindows(d, d.frame.sunrise, { accept: c => !c.night && (c.key === 'amrit' || c.key === 'shubh' || c.key === 'labh') })[0];
    if (win) out.push({ key, d, win, why: `${L.tithiName(l.tithi.index)} (${ti.group}) · ${L.nakName(l.nakshatra.index)} (${na.group}) · ${L.vaarName(d.frame.weekday)}` });
  }
  return out;
}
function muhuratView() {
  const d = vedicDay(day), now = new Date();
  const list = (items, nameOf, tipOf) => items.map(p => `<div class="timeline ${isToday() && p.start <= now && now < p.end ? 'current' : ''}"><i class="dot ${p.nature}"></i><div><strong>${esc(nameOf(p))}</strong> ${badge(p.nature)}<p>${span(p)} · ${esc(tipOf(p))}</p></div></div>`).join('');
  const ev = muhuratDays(muhuratEvent, isToday() ? day : day, 60);
  $('app').innerHTML = `<div class="eyebrow">${esc(L.vaarName(d.frame.weekday))} · ${esc(L.tithiName(d.sunriseLimbs.tithi.index))}</div><h1>${esc(t('muhurat'))}</h1><p>${titleDay(day)}</p>${datebar()}`
    + `<div class="card"><div class="timeline"><i class="dot good"></i><div><strong>${esc(t('abhijit'))}</strong>${d.periods.abhijit.wednesday ? '<p>Not used on Wednesdays</p>' : ''}</div><div class="right">${span(d.periods.abhijit)}</div></div><div class="timeline"><i class="dot good"></i><div><strong>${esc(t('brahma'))}</strong></div><div class="right">${span(d.periods.brahma)}</div></div><div class="timeline"><i class="dot bad"></i><div><strong>${esc(t('rahu'))}</strong></div><div class="right">${span(d.periods.rahu)}</div></div><div class="timeline"><i class="dot bad"></i><div><strong>${esc(t('yamaganda'))}</strong></div><div class="right">${span(d.periods.yamaganda)}</div></div><div class="timeline"><i class="dot bad"></i><div><strong>${esc(t('gulika'))}</strong></div><div class="right">${span(d.periods.gulika)}</div></div></div>`
    + `<section class="section"><h2>${esc(t('choghadiya'))} · ${esc(t('day'))}</h2><div class="card chog">${list(d.choghadiya.filter(c => !c.night), c => L.chogName(c.key), c => M.CHOG[c.key].good)}</div></section>`
    + `<section class="section"><h2>${esc(t('choghadiya'))} · ${esc(t('night'))}</h2><div class="card chog">${list(d.choghadiya.filter(c => c.night), c => L.chogName(c.key), c => M.CHOG[c.key].good)}</div></section>`
    + `<section class="section"><details><summary>${esc(t('hora'))} (24)</summary><div class="card">${list(d.hora, h => L.planetName(h.lord), h => M.PLANET[h.lord].good)}</div></details></section>`
    + `<section class="section"><h2>${esc(t('findMuhurat'))}</h2><label>${esc(t('eventType'))}<select onchange="muhuratEvent=this.value;muhuratView()">${M.EVENTS.map(e => `<option value="${e.key}" ${e.key === muhuratEvent ? 'selected' : ''}>${esc(e.en)}</option>`).join('')}</select></label>`
    + `<div class="card"><div class="eyebrow">${esc(t('goodDays'))}</div>${ev.length ? ev.map(x => `<div class="timeline" onclick="setDay('${x.key}')"><i class="dot good"></i><div><strong>${dayLabel(x.key)} · ${span(x.win)} ${esc(L.chogName(x.win.key))}</strong><p>${esc(x.why)}</p></div></div>`).join('') : `<p>${esc(t('noGoodDays'))}</p>`}</div>`
    + `<p class="caption">For vivah (wedding) muhurat, match the couple’s charts with your family priest.</p></section>`;
}

// ---- Moon -------------------------------------------------------------------------------------
function drawMoon(id, angle) {
  const c = $(id); if (!c) return;
  const ctx = c.getContext('2d'), size = c.width, r = size * 0.4, mid = size / 2, phase = (angle * Math.PI) / 180;
  ctx.clearRect(0, 0, size, size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x - mid) / r, ny = (y - mid) / r, q = nx * nx + ny * ny;
    if (q > 1) continue;
    const z = Math.sqrt(1 - q), light = Math.max(0, nx * Math.sin(phase) - z * Math.cos(phase)), noise = (Math.sin(x * 0.7 + y * 0.31) * Math.sin(x * 0.21 - y * 0.47) + 1) * 0.04, v = light > 0 ? 0.47 + 0.48 * Math.sqrt(light) - noise : 0.11;
    const i = (y * size + x) * 4; img.data[i] = Math.round(236 * v); img.data[i + 1] = Math.round(229 * v); img.data[i + 2] = Math.round(207 * v); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
function moonView() {
  const d = K.instant(day, String(Math.floor(hour)).padStart(2, '0') + ':' + String(Math.round((hour % 1) * 60)).padStart(2, '0'), loc.zone), ti = K.tithi(d), data = K.dayData(day, loc), illum = A.Illumination('Moon', d);
  const nk = P.nakshatra(d), rashi = Math.floor(P.moonSid(d) / 30);
  const next = [0, 90, 180, 270].map((a, i) => ({ name: ['અમાસ · Amavasya', 'Shukla Ashtami', 'પૂનમ · Purnima', 'Krishna Ashtami'][i], d: A.SearchMoonPhase(a, d, 32).date })).sort((a, b) => a.d - b.d);
  $('app').innerHTML = `<div class="eyebrow">ચંદ્ર દર્શન · Chandra Darshan</div><h1>${esc(t('moon'))}</h1><p>${titleDay(day)}</p>${datebar()}<div class="moonbox"><canvas width="420" height="420" id="largeMoon" aria-label="Moon illumination"></canvas></div>`
    + `<div style="text-align:center"><h2>${esc(L.tithiName(ti.index))} · ${Math.round(illum.phase_fraction * 100)}%</h2><p>${esc(L.nakName(nk.index))} ${nk.pada} · ${esc(L.rashiName(rashi))}</p></div>`
    + `<label>${esc(t('now'))} · <span id="scrubTime">${fmt(d)}</span><input aria-label="Time of day" type="range" min="0" max="23.75" step="0.25" value="${hour}" onchange="hour=+this.value;moonView()"></label>`
    + `<div class="section grid2"><div class="card"><div class="caption">${esc(t('moonrise'))}</div><h3>${fmt(data.moonrise)}</h3></div><div class="card"><div class="caption">${esc(t('moonset'))}</div><h3>${fmt(data.moonset)}</h3></div></div>`
    + `<section class="section"><h2>${esc(t('comingUp'))}</h2><div class="card">${next.map(e => `<div class="timeline"><i class="dot"></i><div>${e.name}<p>${full(e.d)}</p></div></div>`).join('')}</div></section>`;
  drawMoon('largeMoon', ti.angle);
}

// ---- Learn (Gyan) -----------------------------------------------------------------------------
const lessons = [
  ['તિથિ · Tithi, the lunar day', 'PANCHANG', 'A tithi is the time the Moon takes to move 12° ahead of the Sun. There are 30 in a lunar month: 15 in Shukla paksha (સુદ) as the Moon grows and 15 in Krishna paksha (વદ) as it wanes. The tithi at sunrise, the udaya tithi, governs the day.', 'Tithis fall in five families that repeat: Nanda (joy), Bhadra (steady), Jaya (victory), Rikta (empty) and Purna (complete). Rikta tithis, Chaturthi, Navami and Chaturdashi, are kept for clearing obstacles rather than new beginnings.', 'https://packolkata.imd.gov.in/panchang/en/preface'],
  ['નક્ષત્ર · The 27 nakshatras', 'PANCHANG', 'The Moon passes through 27 nakshatras, each ruled by a deity. The nakshatra of the day shapes what work it suits: fixed (Dhruva) stars for foundations and griha pravesh, movable (Chara) stars for travel and vehicles, swift (Kshipra) stars for trade and medicine, gentle (Mridu) stars for arts and relationships.', 'Fierce (Ugra) and sharp (Tikshna) nakshatras are avoided for ceremonies. Your janma nakshatra, the Moon’s nakshatra at birth, is the basis of Tarabalam.', ''],
  ['ચોઘડિયું · Choghadiya and Hora', 'MUHURAT', 'The day from sunrise to sunset and the night from sunset to the next sunrise are each split into eight Choghadiyas. Amrit, Shubh and Labh are auspicious, Char is good for travel, and Udveg, Kaal and Rog are avoided for new work.', 'Hora divides the day and night into twelve parts each, ruled in turn by the seven grahas starting with the lord of the weekday. Choose a Jupiter, Venus, Mercury or Moon hora for good work. Rahu Kaal, Yamaganda and Gulika are eighths of the daytime set aside each weekday.', ''],
  ['અગિયારસ · Ekadashi and parana', 'VRAT', 'Ekadashi, the eleventh tithi of each paksha, is kept as a fast for Vishnu. Soma follows the sunrise rule: the fast is kept on the day Ekadashi prevails at sunrise.', 'The fast is broken (parana) on Dwadashi after sunrise, after Hari Vasara (the first quarter of Dwadashi) has passed, ideally in the morning and always before Dwadashi ends. Soma shows this window for your city.', ''],
  ['સુદ, વદ અને માસ · Amanta and Purnimanta', 'CALENDAR', 'In Gujarat, Maharashtra and the South a lunar month ends at Amavasya (amanta). In North India it ends at Purnima (purnimanta), so the Krishna paksha carries the next month’s name. The festival falls on the same day either way; only the month name differs.', 'Every few years an adhik (extra) month keeps the lunar year in step with the seasons. Festivals are not celebrated in an adhik month. Choose your month system in Settings.', ''],
  ['ગ્રહણ · Grahan and sutak', 'VRAT', 'Soma lists lunar and solar eclipses that are visible from your city. Sutak traditionally begins nine hours before a lunar eclipse and twelve hours before a solar eclipse; food is not cooked and temples close until the eclipse ends.', 'After the eclipse, bathe, offer charity and resume puja.', ''],
  ['નક્ષત્ર અને રાશિ · Your birth sky', 'JYOTISH', 'Your janma rashi and nakshatra come from the Moon’s sidereal position at your birth. Each day Soma compares today’s Moon with them: Chandrabalam is strong when the Moon is 1st, 3rd, 6th, 7th, 10th or 11th from your rashi, and Tarabalam counts the nakshatras from yours in groups of nine.', 'Sampat, Kshema, Sadhana, Mitra and Param Mitra taras are supportive; Vipat, Pratyari and Naidhana call for care.', 'https://github.com/svarbhanu/grahan'],
  ['અંકશાસ્ત્ર · Mulank and Bhagyank', 'ANKSHASTRA', 'Mulank is the sum of the digits of your birth day reduced to one digit. Bhagyank is the sum of all digits of your full birth date, reduced the same way.', 'Soma uses single-digit reduction without master numbers.', ''],
  ['અમારી ગણતરી · How Soma calculates', 'METHOD', 'Soma is a Drik (computed) panchang. Astronomy Engine 2.1.19 finds the Sun and Moon offline; sidereal positions use the Lahiri ayanamsa (linear approximation). Sunrise uses the standard refracted horizon at sea level for the city you choose, so times can differ by a minute or two from a printed panchang made for another town.', 'Festival dates follow the common rules for each observance (udaya tithi, pradosh, nishita, madhyahna, aparahna, moonrise) for your own place and time zone; families and sampradayas sometimes follow a different rule, so a date can differ by a day from your local almanac. The muhurat finder checks nakshatra, tithi, weekday, yoga and Bhadra, and skips Kharmas (and Chaturmas for griha pravesh and mundan); it does not yet check Guru or Shukra asta. Plans, birth details and settings stay on this phone; there is no account, advertising or tracking.', 'https://github.com/cosinekitty/astronomy']
];
function learnView() {
  $('app').innerHTML = `<div class="eyebrow">જ્ઞાન · Gyan</div><h1>${esc(t('learnMore'))}</h1><p>The meaning behind each part of the day.</p><div class="section">${lessons.map((l, i) => `<button class="lesson" onclick="lesson(${i})"><div class="eyebrow">${l[1]}</div><h3>${l[0]} ↗</h3><span>${l[2].slice(0, 100)}…</span></button>`).join('')}</div>`;
}
function modal(html) { $('dialogBody').innerHTML = html; $('modal').showModal(); }
function lesson(i) { const l = lessons[i]; modal(`<div class="eyebrow">${l[1]}</div><h2>${l[0]}</h2><p>${l[2]}</p><p>${l[3]}</p>${l[4] ? `<a href="${l[4]}">Read the source ↗</a>` : ''}`); }

// ---- Settings ---------------------------------------------------------------------------------
function settings() {
  const r = prefs.reminders, check = (k, label) => `<label class="check"><input type="checkbox" id="rem_${k}" ${r[k] ? 'checked' : ''}> ${esc(label)}</label>`;
  modal(`<div class="eyebrow">${esc(t('settings'))}</div><h2>સ્થાન · ${esc(t('location'))}</h2><label>Choose a city<select id="cityPick" onchange="fillCity(this.value)"><option value="">Custom / current</option>${cities.map((c, i) => `<option value="${i}">${c.name}</option>`).join('')}</select></label><label>Place name<input id="place" value="${esc(loc.name)}" maxlength="70"></label><div class="grid2"><label>Latitude<input id="lat" type="number" step="any" value="${loc.lat}"></label><label>Longitude<input id="lon" type="number" step="any" value="${loc.lon}"></label></div><label>IANA time zone<input id="zone" value="${esc(loc.zone)}" placeholder="Asia/Kolkata"></label><button class="primary" onclick="saveLocation()">Use this location</button><button class="quiet" onclick="gps()">⌖ Use device location</button>`
    + `<h2 class="section">${esc(t('language'))}</h2><select id="langPick">${[['en', 'English'], ['gu', 'ગુજરાતી'], ['hi', 'हिन्दी']].map(([k, n]) => `<option value="${k}" ${prefs.lang === k ? 'selected' : ''}>${n}</option>`).join('')}</select>`
    + `<h2 class="section">${esc(t('monthSystem'))}</h2><select id="monthPick"><option value="amanta" ${prefs.month === 'amanta' ? 'selected' : ''}>${esc(t('amanta'))}</option><option value="purnimanta" ${prefs.month === 'purnimanta' ? 'selected' : ''}>${esc(t('purnimanta'))}</option></select>`
    + `<h2 class="section">${esc(t('festivalSets'))}</h2>${Fe.SETS.map(s => `<label class="check"><input type="checkbox" id="set_${s}" ${prefs.sets.indexOf(s) >= 0 ? 'checked' : ''}> ${esc(t('sets')[s])}</label>`).join('')}`
    + `<h2 class="section">${esc(t('reminders'))}</h2>${check('vrat', t('remVrat'))}${check('parana', t('remParana'))}${check('daily', t('remDaily'))}${check('rahu', t('remRahu'))}`
    + `<button class="primary" onclick="savePrefs()">${esc(t('save'))}</button><button class="lesson" onclick="lesson(8)">${esc(t('method'))} ↗</button>`);
}
function savePrefs() {
  const sets = Fe.SETS.filter(s => $('set_' + s).checked);
  prefs.custom = prefs.custom || sets.join() !== prefs.sets.join() || $('monthPick').value !== prefs.month;
  prefs.sets = sets; prefs.month = $('monthPick').value; prefs.lang = $('langPick').value;
  const before = JSON.stringify(prefs.reminders);
  for (const k of ['vrat', 'parana', 'daily', 'rahu']) prefs.reminders[k] = $('rem_' + k).checked;
  L = I18n.make(prefs.lang);
  if (persist()) {
    void before;
    if (Object.values(prefs.reminders).some(Boolean)) askNotifications(true);
    $('modal').close(); scheduleNative(true); render();
  }
}
function fillCity(i) { if (i === '') return; const c = cities[+i]; $('place').value = c.name; $('lat').value = c.lat; $('lon').value = c.lon; $('zone').value = c.zone; }
function saveLocation() {
  try {
    const lat = Number($('lat').value), lon = Number($('lon').value), zone = $('zone').value.trim();
    if (!$('lat').value || !$('lon').value || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) throw Error();
    new Intl.DateTimeFormat('en', { timeZone: zone });
    loc = { name: $('place').value.trim() || 'Custom location', lat, lon, zone };
    applyLocationDefaults(); persist(); $('modal').close(); scheduleNative(true); render();
  } catch (e) { toast('Enter valid coordinates and an IANA time zone.'); }
}
function gps() {
  toast('Requesting your location…');
  if (window.SomaNative) { SomaNative.requestLocation(); return; }
  if (!navigator.geolocation) { toast('Device location unavailable. Enter coordinates.'); return; }
  navigator.geolocation.getCurrentPosition(p => receiveGPS({ lat: p.coords.latitude, lon: p.coords.longitude, zone: Intl.DateTimeFormat().resolvedOptions().timeZone }), () => toast('Location unavailable. Manual city selection still works.'), { timeout: 15000 });
}
function receiveGPS(p) {
  if (p.error) { toast(p.error); return; }
  loc = { name: 'Device location', lat: p.lat, lon: p.lon, zone: p.zone };
  applyLocationDefaults(); persist(); if ($('modal').open) $('modal').close(); scheduleNative(true); render();
  toast('Location updated. Confirm the time zone in settings.');
}
window.somaReceiveLocation = s => receiveGPS(JSON.parse(s));

// ---- Plans with a muhurat check ---------------------------------------------------------------
/* The Vedic day runs sunrise to sunrise, so a time before today's sunrise belongs to yesterday's Choghadiya and Hora. */
function frameFor(at) { const d = vedicDay(day); return at < d.frame.sunrise ? vedicDay(K.addDay(day, -1)) : d; }
function timingCheck() {
  const time = $('eventTime') && $('eventTime').value, out = $('timingCheck');
  if (!time || !out) return;
  const at = K.instant(day, time, loc.zone), d = frameFor(at), c = P.at(d.choghadiya, at), h = P.at(d.hora, at);
  const inBad = ['rahu', 'yamaganda', 'gulika'].filter(k => d.periods[k].start <= at && at < d.periods[k].end);
  const ok = c && c.nature !== 'bad' && !inBad.length;
  const better = !ok ? P.goodWindows(d, at).find(w => K.dateKey(w.start, loc.zone) === day) || null : null;
  out.innerHTML = `<div class="eyebrow">${esc(t('checkTime'))}</div>${badge(ok ? 'good' : 'bad')}<p>${esc(t('choghadiya'))}: ${c ? esc(L.chogName(c.key)) : '—'} · ${esc(t('hora'))}: ${h ? esc(L.planetName(h.lord)) : '—'}${inBad.length ? ' · ' + inBad.map(k => esc(t(k))).join(', ') : ''}</p>`
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
  if (persist()) { $('modal').close(); show('calendar'); toast('Plan saved on this device'); }
}
function deleteEvent(id) { modal(`<h2>Remove this plan?</h2><p>This removes the local copy only.</p><button class="primary" onclick="events=events.filter(e=>e.id!=='${id}');persist();document.querySelector('dialog').close();render()">Remove plan</button>`); }
function exportEvent(id) {
  const e = events.find(x => x.id === id);
  if (window.SomaNative && SomaNative.addCalendarEvent) { SomaNative.addCalendarEvent(e.title, e.start, e.end, e.place, e.tithi); return; }
  const clean = s => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'), dt = s => s.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Soma//Calendar//EN', 'BEGIN:VEVENT', 'UID:' + e.id + '@soma.local', 'DTSTAMP:' + dt(new Date().toISOString()), 'DTSTART:' + dt(e.start), 'DTEND:' + dt(e.end), 'SUMMARY:' + clean(e.title), 'LOCATION:' + clean(e.place), 'DESCRIPTION:' + clean(e.tithi + ' · ' + e.zone), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/calendar' })); a.download = 'soma-event.ics'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

// ---- Personal ---------------------------------------------------------------------------------
function personalView() {
  const has = !!profile.date;
  let natal = '';
  if (has) {
    const instant = K.instant(profile.date, profile.time || '12:00', profile.zone || 'Asia/Kolkata'), n = K.sidereal(instant), nak = Math.floor(n / (360 / 27));
    const today = P.personal(n, new Date()), first = day.slice(0, 7) + '-01', count = new Date(+day.slice(0, 4), +day.slice(5, 7), 0).getDate(), good = [];
    for (let i = 0; i < count; i++) { const key = K.addDay(first, i), r = K.dayData(key, loc).sunrise; if (r && P.personal(n, r).verdict === 'good') good.push(key); }
    natal = `<div class="grid2 section"><div class="card"><div class="caption">${esc(t('janmaRashi'))}</div><h2>${esc(L.rashiName(Math.floor(n / 30)))}</h2></div><div class="card"><div class="caption">${esc(t('janmaNak'))}</div><h2>${esc(L.nakName(nak))}</h2><p class="caption">Pada ${Math.floor((n % (360 / 27)) / (360 / 108)) + 1} · ${esc(M.nakshatra(nak).deity)}</p></div></div>`
      + `<div class="card personalDay ${today.verdict}"><div class="eyebrow">${esc(t('forYou'))}</div><h2>${esc(today.verdict === 'good' ? t('favourable') : today.verdict === 'bad' ? t('takeCare') : t('mixed'))}</h2><p>${esc(t('chandrabalam'))}: ${today.chandraCount} · ${today.chandraGood ? esc(t('good')) : esc(t('bad'))}</p><p>${esc(t('tarabalam'))}: ${esc(M.TARA[today.tara.key])}</p></div>`
      + `<div class="card"><div class="eyebrow">${esc(t('personalDays'))}</div><p>${good.length ? good.map(k => `<button class="chip" onclick="setDay('${k}');show('today')">${dayLabel(k, { weekday: undefined })}</button>`).join(' ') : esc(t('none'))}</p></div>`;
    if (window.SomaNatal) {
      try { natal += `<div class="card"><span class="tag">JANMA KUNDALI · NORTH INDIAN</span><div class="natal">${SomaNatal.chart(instant, profile.lat, profile.lon)}</div><p class="caption">Sidereal (Lahiri) chart for ${esc(profile.date)} ${esc(profile.time)} · ${esc(profile.zone)}</p></div>`; }
      catch (e) { natal += '<p class="notice">Chart unavailable for this input.</p>'; }
    }
  }
  $('app').innerHTML = `<div class="eyebrow">જન્મ કુંડળી · Janma Kundali</div><h1>મારું આકાશ</h1><p>Your birth chart and your days.</p><div class="card"><span class="tag">STAYS ON THIS PHONE</span><h2 style="margin-top:10px">${has ? 'Your profile' : 'Begin with your birth details'}</h2><p>Soma uses them for Chandrabalam, Tarabalam and your kundali.</p><button class="primary" onclick="editProfile()">${has ? 'Edit birth details' : 'Create personal profile'}</button></div>`
    + (has ? natal + `<div class="section"><div class="row"><h2>અંકશાસ્ત્ર</h2></div><div class="grid2 section"><div class="card"><div class="caption">મૂળાંક · Mulank</div><div class="number">${K.reduce(profile.date.slice(-2))}</div></div><div class="card"><div class="caption">ભાગ્યાંક · Bhagyank</div><div class="number">${K.reduce(profile.date)}</div></div></div><button class="lesson" onclick="lesson(7)">How these are counted ↗</button></div><button class="quiet section" onclick="eraseProfile()">Delete birth details</button>` : `<button class="lesson" onclick="lesson(6)">What your birth sky tells Soma ↗<span>Janma rashi, nakshatra, Chandrabalam and Tarabalam.</span></button>`)
    + `<button class="lesson" onclick="show('learn')">${esc(t('learnMore'))} ↗</button><button class="lesson" onclick="settings()">${esc(t('settings'))} ↗</button>`;
}
function editProfile() {
  modal(`<h2>Birth details</h2><form onsubmit="saveProfile(event)"><label>Date<input id="birthDate" type="date" required min="1900-01-01" max="2100-12-31" value="${esc(profile.date || '')}"></label><label>Recorded local time<input id="birthTime" type="time" required value="${esc(profile.time || '12:00')}"></label><div class="grid2"><label>Birth latitude<input id="birthLat" type="number" required step="any" min="-90" max="90" value="${profile.lat ?? loc.lat}"></label><label>Birth longitude<input id="birthLon" type="number" required step="any" min="-180" max="180" value="${profile.lon ?? loc.lon}"></label></div><label>Birth IANA time zone<input id="birthZone" required value="${esc(profile.zone || loc.zone)}"></label><p class="caption">Coordinates default to your current place. Change them to your birthplace.</p><button class="primary">Save privately</button></form>`);
}
function saveProfile(e) {
  e.preventDefault();
  try {
    const p = { date: $('birthDate').value, time: $('birthTime').value, zone: $('birthZone').value.trim(), lat: +$('birthLat').value, lon: +$('birthLon').value };
    new Intl.DateTimeFormat('en', { timeZone: p.zone });
    const d = K.instant(p.date, p.time, p.zone), r = K.parts(d, p.zone);
    if (r.hour + ':' + r.minute !== p.time) throw Error();
    profile = p;
    if (persist()) { $('modal').close(); personalView(); }
  } catch (e) { toast('Check the time zone and birth time.'); }
}
function eraseProfile() { modal('<h2>Delete your birth details?</h2><p>This clears the profile and its calculated chart.</p><button class="primary" onclick="profile={};persist();document.querySelector(\'dialog\').close();personalView()">Delete profile</button>'); }

// ---- Reminders and widget (Android) -----------------------------------------------------------
/* Local notifications for the next 30 days, computed here and handed to Android's AlarmManager. */
function reminderPlan() {
  const from = todayKey(), list = observances(from, 31), r = prefs.reminders, out = [], nowMs = Date.now();
  const add = (at, title, body, id) => { if (+at > nowMs) out.push({ id, at: +at, title, body }); };
  for (const f of list) {
    if (r.vrat && f.day > from) add(K.instant(K.addDay(f.day, -1), '19:00', loc.zone), 'Tomorrow: ' + L.festName(f), f.key === 'ekadashi' ? 'The fast begins at sunrise.' + (f.parana ? ' Parana ' + dayLabel(f.parana.day) + ' ' + span(f.parana) + '.' : '') : (f.note || L.festName(f) + ' at ' + loc.name), 'eve-' + f.key + '-' + f.day);
    if (r.parana && f.parana) add(f.parana.start, t('parana') + ': ' + f.en, 'Break the fast before ' + fmt(f.parana.end) + '.', 'parana-' + f.day);
  }
  if (r.daily || r.rahu) {
    const samp = Fe.samples(from, 14, loc);
    for (const s of samp.slice(0, 14)) {
      const ti = Math.floor(A.MoonPhase(s.sunrise) / 12), wd = new Date(Date.parse(s.day + 'T12:00Z')).getUTCDay(), seg = P.RAHU[wd] - 1;
      const rahu = { start: new Date(+s.sunrise + (s.sunset - s.sunrise) * seg / 8), end: new Date(+s.sunrise + (s.sunset - s.sunrise) * (seg + 1) / 8) };
      const fest = list.filter(x => x.day === s.day).map(x => L.festName(x)).join(', ');
      if (r.daily) add(s.sunrise, L.vaarName(wd) + ' · ' + L.tithiName(ti), (fest ? fest + '. ' : '') + t('rahu') + ' ' + span(rahu), 'daily-' + s.day);
      if (r.rahu) add(rahu.start, t('rahu') + ' ' + span(rahu), 'Avoid starting new work until ' + fmt(rahu.end) + '.', 'rahu-' + s.day);
    }
  }
  return out.slice(0, 120);
}
/* Reminders are on by default, so ask for notification permission once on first launch, and again whenever reminders are saved on. */
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
      // The home-screen widget gets its own feed (pushWidgetFeed below).
      if (SomaNative.scheduleReminders) SomaNative.scheduleReminders(JSON.stringify(reminderPlan()));
      if (Object.values(prefs.reminders).some(Boolean)) askNotifications(false);
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
  const now = new Date(), today = K.dateKey(now, loc.zone);
  const key = [loc.lat, loc.lon, loc.zone, loc.name, today, Math.floor(now.getTime() / 216e5), JSON.stringify(window.SomaFestivalSets || '')].join('|');
  if (key === widgetKey) return;
  try { SomaNative.updateWidgetFeed(JSON.stringify(SomaWidgetFeed.build(loc, now, widgetFestivals(today)))); widgetKey = key; }
  catch (e) { console.error('Widget feed failed: ' + e.message); }
}
function scheduleWidgetFeed() { clearTimeout(widgetTimer); widgetTimer = setTimeout(pushWidgetFeed, 400); }

window.SomaPrototype = { health: () => ({ ready: true, version: '0.7.0', tithi: K.tithi(new Date()).label, location: loc.name, festivals: observances(todayKey(), 30).length }) };
try { render(); if (window.SomaNative) SomaNative.appReady(); }
catch (e) { $('app').textContent = 'Unable to load: ' + e.message; if (window.SomaNative) SomaNative.appFailure(e.message); }
let lastToday = day;
function tick() {
  const now = todayKey();
  if (now !== lastToday) { if (day === lastToday) { day = now; monthView = now.slice(0, 7); } lastToday = now; scheduleNative(true); }
  if (view === 'today' && !$('modal').open) render();
}
setInterval(tick, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
window.addEventListener('focus', tick);
