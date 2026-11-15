/* Panchang layer on top of Kaal (core.js): the five limbs, daily muhurta periods,
 * Choghadiya, Hora and personal Chandrabalam / Tarabalam.
 * Drik (computed) panchang, sidereal positions with Kaal's Lahiri ayanamsa, sunrise-to-sunrise Vedic day. */
(function (root) {
  const K = typeof Kaal !== 'undefined' ? Kaal : require('./core.js');
  const A = typeof Astronomy !== 'undefined' ? Astronomy : require('astronomy-engine');
  const NAK_SPAN = 360 / 27, MIN = 60000, HOUR = 36e5;

  // ---- The five limbs ---------------------------------------------------------------------------
  const sunSid = d => K.mod(A.SunPosition(d).elon - K.ayan(d));
  const moonSid = d => K.sidereal(d);
  const yogaAngle = d => K.mod(sunSid(d) + moonSid(d));
  const tithiAngle = d => A.MoonPhase(d);

  /* Time when an angle function (increasing, wrapping at 360) next reaches `target` degrees, searched forward from `from`. */
  function crossing(fn, from, target, maxHours) {
    let prev = fn(from), lo = from, hi = null, done = 0;
    const need = K.mod(target - prev) || 360;
    // Step hourly (every limb moves well under 1° an hour), accumulating the unwrapped progress.
    for (let h = 1; h <= maxHours; h++) {
      const t = new Date(+from + h * HOUR), v = fn(t), step = K.mod(v - prev);
      if (done + step >= need) { hi = t; break; }
      done += step; prev = v; lo = t;
    }
    if (!hi) return null;
    const base = fn(lo), rest = need - done;
    while (hi - lo > 30000) {
      const mid = new Date((+lo + +hi) / 2);
      if (K.mod(fn(mid) - base) >= rest) hi = mid; else lo = mid;
    }
    return new Date(Math.round(+hi / MIN) * MIN);
  }
  function crossingBack(fn, from, target, maxHours) {
    // Search the most recent time the angle passed `target`: go back far enough and search forward.
    const start = new Date(+from - maxHours * HOUR);
    return crossing(fn, start, target, maxHours + 1);
  }

  function nakshatra(d) {
    const v = moonSid(d), index = Math.floor(v / NAK_SPAN);
    return { index, pada: Math.floor((v % NAK_SPAN) / (NAK_SPAN / 4)) + 1,
      start: crossingBack(moonSid, d, index * NAK_SPAN, 30), end: crossing(moonSid, d, ((index + 1) % 27) * NAK_SPAN, 30) };
  }
  function yoga(d) {
    const v = yogaAngle(d), index = Math.floor(v / NAK_SPAN);
    return { index, end: crossing(yogaAngle, d, ((index + 1) % 27) * NAK_SPAN, 30) };
  }
  /* 60 half-tithis. 0 Kimstughna, 1-56 the seven movable karanas in turn, 57 Shakuni, 58 Chatushpada, 59 Naga. */
  function karana(d) {
    const k = Math.floor(tithiAngle(d) / 6);
    const index = k === 0 ? 10 : k >= 57 ? k - 50 : (k - 1) % 7;
    return { index, slot: k, end: crossing(tithiAngle, d, ((k + 1) % 60) * 6, 20) };
  }
  /* Amanta lunar month as an index (0 = Chaitra) plus adhik flag. Same rule as Kaal.month. */
  function lunarMonth(d) {
    let p = A.SearchMoonPhase(0, new Date(+d - 32 * 864e5), 35).date;
    let next = A.SearchMoonPhase(0, new Date(+p + 864e5), 35).date;
    if (next <= d) { p = next; next = A.SearchMoonPhase(0, new Date(+p + 864e5), 35).date; }
    const sign = x => Math.floor(K.mod(A.SunPosition(x).elon - K.ayan(x)) / 30);
    const s = sign(next), adhik = s === sign(p);
    return { index: adhik ? (s + 1) % 12 : s, adhik, start: p, end: next };
  }
  /* Purnimanta months begin after Purnima, so the Krishna paksha carries the next month's name. */
  function monthName(d, system, names) {
    const m = lunarMonth(d), krishna = tithiAngle(d) >= 180;
    const idx = system === 'purnimanta' && krishna ? (m.index + 1) % 12 : m.index;
    return (m.adhik && !(system === 'purnimanta' && krishna) ? names.adhik + ' ' : '') + names.months[idx];
  }

  /* Vikram Samvat. Gujarati (Kartikadi) years begin on Kartik Shukla Pratipada; North Indian (Chaitradi) on Chaitra Shukla Pratipada. */
  function samvat(d, system) {
    const first = system === 'gujarati' ? 7 : 0;
    let m = lunarMonth(d);
    for (let i = 0; i < 14 && !(m.index === first && !m.adhik); i++) m = lunarMonth(new Date(+m.start - 2 * 864e5));
    return new Date(+m.start + 864e5).getUTCFullYear() + 57;
  }

  // ---- Day frame --------------------------------------------------------------------------------
  /* Sunrise, sunset and next sunrise for a civil date. Polar days fall back to 06:00 / 18:00 local so the frame never breaks. */
  function frame(day, loc) {
    const data = K.dayData(day, loc), nextData = K.dayData(K.addDay(day, 1), loc);
    const sunrise = data.sunrise || K.instant(day, '06:00', loc.zone);
    // The day's own sunset is the first one after its sunrise. Far north in summer (Reykjavik, Fairbanks) it falls after
    // local midnight, so the civil date holds only the previous evening's sunset, which comes before sunrise.
    const own = data.sunrise ? A.SearchRiseSet('Sun', new A.Observer(loc.lat, loc.lon, 0), -1, data.sunrise, 1) : null;
    const sunset = own && own.date - data.sunrise < 864e5 ? own.date : data.sunset && data.sunset > sunrise ? data.sunset : K.instant(day, '18:00', loc.zone);
    const nextSunrise = nextData.sunrise || K.instant(K.addDay(day, 1), '06:00', loc.zone);
    const weekday = new Date(Date.parse(day + 'T12:00Z')).getUTCDay();
    return { day, sunrise, sunset, nextSunrise, weekday, polar: !data.sunrise || !data.sunset, data };
  }
  const part = (a, b, n, i) => ({ start: new Date(+a + (b - a) * i / n), end: new Date(+a + (b - a) * (i + 1) / n) });

  // Eighth-of-daytime periods (1-based segment numbers, Sunday first).
  const RAHU = [8, 2, 7, 5, 6, 4, 3], YAMA = [5, 4, 3, 2, 1, 7, 6], GULIKA = [7, 6, 5, 4, 3, 2, 1];
  function periods(f) {
    const eighth = seg => part(f.sunrise, f.sunset, 8, seg - 1);
    const muhurta = (f.sunset - f.sunrise) / 15;
    const noon = new Date((+f.sunrise + +f.sunset) / 2);
    return {
      rahu: eighth(RAHU[f.weekday]), yamaganda: eighth(YAMA[f.weekday]), gulika: eighth(GULIKA[f.weekday]),
      // Abhijit: the 8th of 15 daytime muhurtas. Traditionally not used on Wednesdays.
      abhijit: Object.assign({ start: new Date(+noon - muhurta / 2), end: new Date(+noon + muhurta / 2) }, { wednesday: f.weekday === 3 }),
      // Brahma muhurta: the 14th of 15 night muhurtas, i.e. two night-muhurtas before sunrise ends at one before.
      brahma: (() => { const nm = (f.sunrise - new Date(+f.sunset - 864e5)) / 15; return { start: new Date(+f.sunrise - 2 * nm), end: new Date(+f.sunrise - nm) }; })()
    };
  }

  // Choghadiya: 8 day and 8 night parts. Order of the cycle, with its ruling planet.
  const CHOG = ['udveg', 'char', 'labh', 'amrit', 'kaal', 'shubh', 'rog'];
  const CHOG_NATURE = { udveg: 'bad', char: 'neutral', labh: 'good', amrit: 'good', kaal: 'bad', shubh: 'good', rog: 'bad' };
  const CHOG_DAY_START = [0, 3, 6, 2, 5, 1, 4]; // Sun Udveg, Mon Amrit, Tue Rog, Wed Labh, Thu Shubh, Fri Char, Sat Kaal
  function choghadiya(f) {
    const out = [];
    const d0 = CHOG_DAY_START[f.weekday], n0 = (d0 + 5) % 7;
    for (let i = 0; i < 8; i++) { const k = CHOG[(d0 + i) % 7]; out.push(Object.assign(part(f.sunrise, f.sunset, 8, i), { key: k, nature: CHOG_NATURE[k], night: false })); }
    for (let i = 0; i < 8; i++) { const k = CHOG[(n0 + 5 * i) % 7]; out.push(Object.assign(part(f.sunset, f.nextSunrise, 8, i), { key: k, nature: CHOG_NATURE[k], night: true })); }
    return out;
  }

  // Hora: 12 day and 12 night parts, starting with the weekday lord, in Chaldean order.
  const HORA = ['sun', 'venus', 'mercury', 'moon', 'saturn', 'jupiter', 'mars'];
  const WEEKDAY_LORD = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];
  const HORA_NATURE = { sun: 'neutral', venus: 'good', mercury: 'good', moon: 'good', saturn: 'bad', jupiter: 'good', mars: 'bad' };
  function horas(f) {
    const s = HORA.indexOf(WEEKDAY_LORD[f.weekday]), out = [];
    for (let i = 0; i < 24; i++) {
      const p = i < 12 ? part(f.sunrise, f.sunset, 12, i) : part(f.sunset, f.nextSunrise, 12, i - 12);
      const lord = HORA[(s + i) % 7];
      out.push(Object.assign(p, { lord, nature: HORA_NATURE[lord], night: i >= 12 }));
    }
    return out;
  }

  /* Dur Muhurta: the weekday's inauspicious muhurtas (1-based, of the 15 day muhurtas; 'n' marks a night muhurta counted from sunset). */
  const DUR = [[14], [9, 12], [4, 'n7'], [8], [6, 12], [4, 9], [1, 2]];
  function durMuhurta(f) {
    const out = [];
    for (const m of DUR[f.weekday]) {
      const p = typeof m === 'number' ? Object.assign(part(f.sunrise, f.sunset, 15, m - 1), { night: false }) : Object.assign(part(f.sunset, f.nextSunrise, 15, +m.slice(1) - 1), { night: true });
      // Saturday's two muhurtas touch: one stretch, as almanacs print it.
      const last = out[out.length - 1];
      if (last && +last.end === +p.start) last.end = p.end; else out.push(p);
    }
    return out;
  }
  /* Bhadra: every stretch of Vishti karana (half-tithi slots 8, 15, 22 … 57 cycle position 6) that touches this Vedic day. */
  function bhadra(f) {
    const out = [];
    let t = f.sunrise;
    for (let guard = 0; guard < 6 && t < f.nextSunrise; guard++) {
      // Probe a minute in, so a boundary rounded to the minute never reads as the slot just ended.
      const k = Math.floor(tithiAngle(new Date(+t + MIN)) / 6), end = crossing(tithiAngle, t, ((k + 1) % 60) * 6, 20);
      if (!end) break;
      if (end <= t) { t = new Date(+t + MIN); continue; }
      if (k >= 1 && k <= 56 && (k - 1) % 7 === 6) out.push({ start: t > f.sunrise ? t : crossingBack(tithiAngle, f.sunrise, k * 6, 20) || t, end });
      t = end;
    }
    return out;
  }

  const overlaps = (a, b) => a.start < b.end && b.start < a.end;
  const at = (list, t) => list.find(p => p.start <= t && t < p.end) || null;

  /* Everything a screen needs for one Vedic day. */
  function day(dayKey, loc) {
    const f = frame(dayKey, loc), per = periods(f), chog = choghadiya(f), hora = horas(f);
    const rise = f.sunrise;
    const t = K.tithi(rise);
    per.dur = durMuhurta(f); per.bhadra = bhadra(f);
    return { frame: f, periods: per, choghadiya: chog, hora,
      sunriseLimbs: { tithi: t, nakshatra: nakshatra(rise), yoga: yoga(rise), karana: karana(rise), vaar: f.weekday, month: lunarMonth(rise) } };
  }
  /* Good windows from `from` onward: a good Choghadiya, trimmed so it never touches Rahu Kaal, Yamaganda or Gulika. */
  function goodWindows(d, from, opts) {
    opts = opts || {};
    const accept = opts.accept || (c => c.nature === 'good');
    const avoid = [d.periods.rahu, d.periods.yamaganda].concat(opts.avoidGulika === false ? [] : [d.periods.gulika], opts.strict ? (d.periods.dur || []).concat(d.periods.bhadra || []) : []);
    const out = [];
    for (const c of d.choghadiya) {
      if (!accept(c) || c.end <= from) continue;
      let pieces = [{ start: c.start < from ? from : c.start, end: c.end }];
      for (const bad of avoid) pieces = pieces.flatMap(p => !overlaps(p, bad) ? [p] : [{ start: p.start, end: bad.start }, { start: bad.end, end: p.end }].filter(x => x.end - x.start >= 10 * MIN));
      for (const p of pieces) out.push(Object.assign({}, p, { key: c.key, night: c.night }));
    }
    return out;
  }

  // ---- Personal strength ------------------------------------------------------------------------
  const CHANDRA_GOOD = [1, 3, 6, 7, 10, 11];
  const TARA = [
    { key: 'janma', nature: 'mixed' }, { key: 'sampat', nature: 'good' }, { key: 'vipat', nature: 'bad' },
    { key: 'kshema', nature: 'good' }, { key: 'pratyari', nature: 'bad' }, { key: 'sadhana', nature: 'good' },
    { key: 'naidhana', nature: 'bad' }, { key: 'mitra', nature: 'good' }, { key: 'paramMitra', nature: 'good' }];
  /* birthMoon: sidereal longitude of the natal Moon. Returns Chandrabalam and Tarabalam for the instant `d`. */
  function personal(birthMoon, d) {
    const janmaRashi = Math.floor(birthMoon / 30), janmaNak = Math.floor(birthMoon / NAK_SPAN);
    const now = moonSid(d), rashiNow = Math.floor(now / 30), nakNow = Math.floor(now / NAK_SPAN);
    const chandraCount = ((rashiNow - janmaRashi + 12) % 12) + 1;
    const taraCount = ((nakNow - janmaNak + 27) % 27) % 9;
    const tara = TARA[taraCount];
    const chandraGood = CHANDRA_GOOD.indexOf(chandraCount) >= 0;
    const verdict = chandraGood && tara.nature === 'good' ? 'good' : !chandraGood && tara.nature === 'bad' ? 'bad' : 'mixed';
    return { janmaRashi, janmaNak, rashiNow, nakNow, chandraCount, chandraGood, tara: Object.assign({ count: taraCount + 1 }, tara), verdict };
  }

  const api = { crossing, nakshatra, yoga, karana, lunarMonth, monthName, samvat, frame, periods, choghadiya, horas, day, goodWindows, personal, at, overlaps, durMuhurta, bhadra, DUR,
    sunSid, moonSid, CHOG, CHOG_NATURE, HORA, HORA_NATURE, WEEKDAY_LORD, RAHU, YAMA, GULIKA };
  if (typeof module !== 'undefined') module.exports = api;
  root.Panchang = api;
})(typeof window !== 'undefined' ? window : globalThis);
