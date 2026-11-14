/* Festivals and vrat days, computed for the user's own place and time zone.
 * Rules follow common Drik panchang practice: each observance names an amanta lunar month, a tithi and the moment of
 * the day at which that tithi must prevail (sunrise for most, pradosh/sunset for Diwali, Holika Dahan and Pradosh,
 * local midnight for Shivratri and Janmashtami, moonrise for Sankashti and Karwa Chauth). Adhik months carry no festivals.
 * Sets: 'gujarati', 'india' (pan-Indian), 'international' (global observances), 'vrat' (monthly fasts). */
(function (root) {
  const K = typeof Kaal !== 'undefined' ? Kaal : require('./core.js');
  const A = typeof Astronomy !== 'undefined' ? Astronomy : require('astronomy-engine');
  const P = typeof Panchang !== 'undefined' ? Panchang : require('./panchang.js');

  // Amanta month index: 0 Chaitra … 6 Ashvin, 7 Kartik … 11 Phalgun. Tithi index: 0-14 Shukla (14 Purnima), 15-29 Krishna (29 Amavasya).
  const S = n => n - 1, Kr = n => 14 + n, PURNIMA = 14, AMAVASYA = 29;
  const F = (key, en, gu, hi, sets, month, tithi, rule, note) => ({ key, en, gu, hi, sets, month, tithi, rule: rule || 'sunrise', note: note || '' });
  const FESTIVALS = [
    F('gudi', 'Chaitra Navratri begins · Gudi Padwa', 'ચૈત્રી નવરાત્રિ', 'चैत्र नवरात्रि · गुड़ी पड़वा', ['india', 'gujarati'], 0, S(1)),
    F('ramnavami', 'Ram Navami', 'રામ નવમી', 'राम नवमी', ['india', 'gujarati'], 0, S(9), 'midday'),
    F('mahavir', 'Mahavir Jayanti', 'મહાવીર જયંતી', 'महावीर जयंती', ['india', 'gujarati'], 0, S(13)),
    F('hanuman', 'Hanuman Jayanti', 'હનુમાન જયંતી', 'हनुमान जयंती', ['india', 'gujarati'], 0, PURNIMA),
    F('akshaya', 'Akshaya Tritiya', 'અખાત્રીજ', 'अक्षय तृतीया', ['india', 'gujarati'], 1, S(3), 'sunrise', 'Any good work begun today is said to bear lasting fruit.'),
    F('buddha', 'Buddha Purnima', 'બુદ્ધ પૂર્ણિમા', 'बुद्ध पूर्णिमा', ['india'], 1, PURNIMA),
    F('vatpurnima', 'Vat Purnima', 'વટ સાવિત્રી', 'वट पूर्णिमा', ['india', 'gujarati'], 2, PURNIMA),
    F('rathyatra', 'Rath Yatra', 'રથયાત્રા', 'रथ यात्रा', ['india', 'gujarati'], 3, S(2)),
    F('gurupurnima', 'Guru Purnima', 'ગુરુ પૂર્ણિમા', 'गुरु पूर्णिमा', ['india', 'gujarati'], 3, PURNIMA),
    F('nagpanchami', 'Nag Panchami', 'નાગ પંચમી', 'नाग पंचमी', ['india'], 4, S(5)),
    F('rakhi', 'Raksha Bandhan', 'રક્ષાબંધન', 'रक्षा बंधन', ['india', 'gujarati'], 4, PURNIMA),
    F('randhan', 'Randhan Chhath', 'રાંધણ છઠ', 'रांधण छठ', ['gujarati'], 4, Kr(6)),
    F('shitala', 'Shitala Satam', 'શીતળા સાતમ', 'शीतला सप्तमी', ['gujarati'], 4, Kr(7)),
    F('janmashtami', 'Janmashtami', 'જન્માષ્ટમી', 'जन्माष्टमी', ['india', 'gujarati'], 4, Kr(8), 'midnight'),
    F('ganesh', 'Ganesh Chaturthi', 'ગણેશ ચતુર્થી', 'गणेश चतुर्थी', ['india', 'gujarati'], 5, S(4), 'midday'),
    F('rishi', 'Rishi Panchami', 'ઋષિ પાંચમ', 'ऋषि पंचमी', ['india', 'gujarati'], 5, S(5)),
    F('anant', 'Anant Chaturdashi · Ganesh Visarjan', 'અનંત ચૌદશ', 'अनंत चतुर्दशी', ['india', 'gujarati'], 5, S(14)),
    F('pitrupaksha', 'Pitru Paksha begins', 'શ્રાદ્ધ પક્ષ આરંભ', 'पितृ पक्ष आरंभ', ['india', 'gujarati'], 5, Kr(1)),
    F('sarvapitru', 'Sarva Pitru Amavasya', 'સર્વપિતૃ અમાસ', 'सर्वपितृ अमावस्या', ['india', 'gujarati'], 5, AMAVASYA),
    F('navratri', 'Sharad Navratri begins', 'નવરાત્રિ આરંભ', 'शारदीय नवरात्रि', ['india', 'gujarati'], 6, S(1), 'sunrise', 'Nine nights of Devi worship and garba.'),
    F('durgashtami', 'Durga Ashtami', 'દુર્ગાષ્ટમી', 'दुर्गा अष्टमी', ['india', 'gujarati'], 6, S(8)),
    F('dussehra', 'Dussehra · Vijayadashami', 'દશેરા', 'दशहरा', ['india', 'gujarati'], 6, S(10), 'afternoon'),
    F('sharadpurnima', 'Sharad Purnima', 'શરદ પૂનમ', 'शरद पूर्णिमा', ['india', 'gujarati'], 6, PURNIMA),
    F('karwa', 'Karwa Chauth', 'કરવા ચોથ', 'करवा चौथ', ['india'], 6, Kr(4), 'moonrise'),
    F('dhanteras', 'Dhanteras', 'ધનતેરસ', 'धनतेरस', ['india', 'gujarati'], 6, Kr(13), 'sunset'),
    F('kalichaudas', 'Kali Chaudas', 'કાળી ચૌદશ', 'काली चौदस', ['gujarati'], 6, Kr(14), 'midnight'),
    F('narak', 'Narak Chaturdashi · Roop Chaudas', 'રૂપ ચૌદશ', 'नरक चतुर्दशी', ['india'], 6, Kr(14)),
    F('diwali', 'Diwali · Lakshmi Puja', 'દિવાળી', 'दीपावली', ['india', 'gujarati'], 6, AMAVASYA, 'sunset'),
    F('bestuvaras', 'Bestu Varas · Gujarati New Year', 'બેસતું વર્ષ', 'गुजराती नव वर्ष', ['gujarati'], 7, S(1)),
    F('govardhan', 'Govardhan Puja · Annakut', 'અન્નકૂટ', 'गोवर्धन पूजा', ['india'], 7, S(1)),
    F('bhaidooj', 'Bhai Dooj', 'ભાઈબીજ', 'भाई दूज', ['india', 'gujarati'], 7, S(2)),
    F('labhpancham', 'Labh Pancham', 'લાભ પાંચમ', 'लाभ पंचमी', ['gujarati'], 7, S(5), 'sunrise', 'Traders open new account books.'),
    F('chhath', 'Chhath Puja', 'છઠ પૂજા', 'छठ पूजा', ['india'], 7, S(6)),
    F('jalaram', 'Jalaram Jayanti', 'જલારામ જયંતી', 'जलाराम जयंती', ['gujarati'], 7, S(7)),
    F('devdiwali', 'Kartik Purnima · Dev Diwali', 'દેવ દિવાળી', 'देव दीपावली', ['india', 'gujarati'], 7, PURNIMA),
    F('vasant', 'Vasant Panchami', 'વસંત પંચમી', 'वसंत पंचमी', ['india', 'gujarati'], 10, S(5)),
    F('shivratri', 'Maha Shivratri', 'મહાશિવરાત્રિ', 'महाशिवरात्रि', ['india', 'gujarati'], 10, Kr(14), 'midnight'),
    F('holika', 'Holika Dahan', 'હોળી', 'होलिका दहन', ['india', 'gujarati'], 11, PURNIMA, 'sunset'),
    F('dhuleti', 'Holi · Dhuleti', 'ધૂળેટી', 'होली', ['india', 'gujarati'], 11, Kr(1))
  ];
  // Ekadashi names by purnimanta month: [Krishna, Shukla]. An amanta Krishna Ekadashi belongs to the next purnimanta month.
  const EKADASHI = [['Papmochani', 'Kamada'], ['Varuthini', 'Mohini'], ['Apara', 'Nirjala'], ['Yogini', 'Devshayani'], ['Kamika', 'Shravana Putrada'],
    ['Aja', 'Parivartini'], ['Indira', 'Papankusha'], ['Rama', 'Prabodhini (Dev Uthi)'], ['Utpanna', 'Mokshada'], ['Saphala', 'Pausha Putrada'],
    ['Shattila', 'Jaya'], ['Vijaya', 'Amalaki']];
  const VRATS = [
    { key: 'ekadashi', tithis: [S(11), Kr(11)], rule: 'sunrise', en: 'Ekadashi', gu: 'અગિયારસ', hi: 'एकादशी' },
    { key: 'purnima', tithis: [PURNIMA], rule: 'sunrise', en: 'Purnima', gu: 'પૂનમ', hi: 'पूर्णिमा' },
    { key: 'amavasya', tithis: [AMAVASYA], rule: 'sunrise', en: 'Amavasya', gu: 'અમાસ', hi: 'अमावस्या' },
    { key: 'sankashti', tithis: [Kr(4)], rule: 'moonrise', en: 'Sankashti Chaturthi', gu: 'સંકષ્ટ ચતુર્થી', hi: 'संकष्टी चतुर्थी' },
    { key: 'vinayaka', tithis: [S(4)], rule: 'sunrise', en: 'Vinayaka Chaturthi', gu: 'વિનાયક ચતુર્થી', hi: 'विनायक चतुर्थी' },
    { key: 'pradosh', tithis: [S(13), Kr(13)], rule: 'sunset', en: 'Pradosh Vrat', gu: 'પ્રદોષ', hi: 'प्रदोष व्रत' },
    { key: 'masikshivratri', tithis: [Kr(14)], rule: 'midnight', en: 'Masik Shivratri', gu: 'માસિક શિવરાત્રિ', hi: 'मासिक शिवरात्रि' }
  ];
  const SETS = ['gujarati', 'india', 'international', 'vrat'];

  /* Location defaults: Gujarat → Gujarati + pan-Indian; rest of India → pan-Indian; elsewhere → pan-Indian + international. */
  function defaultSets(loc) {
    const inGujarat = loc.lat >= 20 && loc.lat <= 24.8 && loc.lon >= 68 && loc.lon <= 74.6;
    const inIndia = loc.zone === 'Asia/Kolkata';
    return inGujarat ? ['gujarati', 'india', 'vrat'] : inIndia ? ['india', 'vrat'] : ['india', 'international', 'vrat'];
  }
  /* North Indian users count months purnimanta; Gujarat, Maharashtra and the South use amanta. */
  function defaultMonthSystem(loc) {
    const north = loc.zone === 'Asia/Kolkata' && loc.lat > 23.5 && !(loc.lon < 74.6 && loc.lat < 24.8);
    return north ? 'purnimanta' : 'amanta';
  }

  // ---- Day samples ------------------------------------------------------------------------------
  function lunations(from, to) {
    const out = [];
    let p = A.SearchMoonPhase(0, new Date(+from - 32 * 864e5), 35).date;
    while (p < to) {
      const next = A.SearchMoonPhase(0, new Date(+p + 864e5), 35).date;
      const sign = x => Math.floor(K.mod(A.SunPosition(x).elon - K.ayan(x)) / 30);
      const s = sign(next), adhik = s === sign(p);
      out.push({ start: p, end: next, index: adhik ? (s + 1) % 12 : s, adhik });
      p = next;
    }
    return out;
  }
  const lunationAt = (ls, t) => ls.find(l => l.start <= t && t < l.end);

  function samples(fromDay, days, loc) {
    const obs = new A.Observer(loc.lat, loc.lon, 0), out = [];
    for (let i = 0; i <= days; i++) {
      const day = K.addDay(fromDay, i), start = K.instant(day, '00:00', loc.zone), end = K.instant(K.addDay(day, 1), '00:00', loc.zone);
      const r = A.SearchRiseSet('Sun', obs, 1, start, 1.2), s = A.SearchRiseSet('Sun', obs, -1, start, 1.2);
      const sunrise = r && r.date < end ? r.date : K.instant(day, '06:00', loc.zone);
      const sunset = s && s.date < end && s.date > sunrise ? s.date : K.instant(day, '18:00', loc.zone);
      out.push({ day, start, end, sunrise, sunset });
    }
    for (let i = 0; i < out.length; i++) {
      const d = out[i], nextRise = out[i + 1] ? out[i + 1].sunrise : new Date(+d.sunrise + 864e5);
      d.nextSunrise = nextRise;
      d.midnight = new Date((+d.sunset + +nextRise) / 2);
    }
    return out;
  }
  function moonriseFor(d, loc) {
    const r = A.SearchRiseSet('Moon', new A.Observer(loc.lat, loc.lon, 0), 1, new Date(+d.sunset - 3 * 36e5), 1);
    return r ? r.date : d.midnight;
  }
  const tithiAt = t => Math.floor(A.MoonPhase(t) / 12);

  /* The moment of the day at which a rule checks the tithi. */
  function momentOf(d, rule, loc) {
    const daytime = d.sunset - d.sunrise;
    if (rule === 'sunset') return d.sunset;
    if (rule === 'midnight') return d.midnight;
    if (rule === 'midday') return new Date(+d.sunrise + daytime / 2);          // madhyahna
    if (rule === 'afternoon') return new Date(+d.sunrise + daytime * 0.7);     // aparahna
    if (rule === 'moonrise') return d._moonrise || (d._moonrise = moonriseFor(d, loc));
    return d.sunrise;
  }
  /* Days on which `tithi` prevails at `rule` within lunar month `month` (null = any month). One day per occurrence.
   * When the tithi misses the rule's moment in a lunar month, fall back to the tithi at sunrise; when it misses every
   * sunrise too (kshaya tithi), use the day in which it begins and ends. */
  function findDays(samp, ls, tithi, month, rule, loc, allowAdhik) {
    const hits = [];
    let prev = false;
    for (let i = 0; i < samp.length - 1; i++) {
      const t = momentOf(samp[i], rule, loc), l = lunationAt(ls, t);
      const ok = !!l && (allowAdhik || !l.adhik) && (month == null || l.index === month) && tithiAt(t) === tithi;
      if (ok && !prev) hits.push({ i, lunation: l });
      prev = ok;
    }
    const covered = (l, list) => list.some(h => h.lunation === l);
    if (rule !== 'sunrise') {
      const sunriseHits = findDays(samp, ls, tithi, month, 'sunrise', loc, allowAdhik);
      for (const h of sunriseHits) if (!covered(h.lunation, hits)) hits.push(Object.assign({ fallback: true }, h));
    } else {
      for (let i = 0; i < samp.length - 1; i++) {
        const d = samp[i], a = tithiAt(d.sunrise), b = tithiAt(d.nextSunrise), l = lunationAt(ls, d.nextSunrise);
        if (!l || (l.adhik && !allowAdhik) || (month != null && l.index !== month) || covered(l, hits)) continue;
        if (a === (tithi + 29) % 30 && b === (tithi + 1) % 30) hits.push({ i, lunation: l, kshaya: true });
      }
    }
    return hits.sort((a, b) => a.i - b.i);
  }

  /* Parana (fast-breaking) window after an Ekadashi observed on samp[i]: after sunrise and after Hari Vasara
   * (the first quarter of Dwadashi), preferably in the morning (first fifth of daytime), always before Dwadashi ends. */
  function parana(samp, i) {
    const next = samp[i + 1];
    if (!next) return null;
    const ekadashiEnd = A.SearchMoonPhase((tithiAt(samp[i].sunrise) + 1) * 12 % 360, samp[i].sunrise, 2).date;
    const dwadashiEnd = A.SearchMoonPhase((tithiAt(samp[i].sunrise) + 2) * 12 % 360, ekadashiEnd, 2).date;
    const hariVasaraEnd = new Date(+ekadashiEnd + (dwadashiEnd - ekadashiEnd) / 4);
    const daytime = next.sunset - next.sunrise, pratahEnd = new Date(+next.sunrise + daytime / 5);
    const start = new Date(Math.max(+next.sunrise, +hariVasaraEnd));
    // Prefer the morning (pratah kaal); if Hari Vasara runs late, the window moves to midday, then to the afternoon.
    let end = [pratahEnd, new Date(+next.sunrise + daytime / 2), next.sunset].find(x => x - start >= 30 * 6e4) || next.sunset;
    if (dwadashiEnd > start && dwadashiEnd < end) end = dwadashiEnd;
    const round = d => new Date(Math.round(+d / 6e4) * 6e4);
    return { day: next.day, start: round(start), end: round(end), dwadashiEnd: round(dwadashiEnd) };
  }

  function international(fromDay, toDay, loc) {
    const out = [], from = K.instant(fromDay, '00:00', loc.zone), to = K.instant(toDay, '23:59', loc.zone), obs = new A.Observer(loc.lat, loc.lon, 0);
    // Seasons (tropical): equinoxes and solstices.
    for (let y = +fromDay.slice(0, 4); y <= +toDay.slice(0, 4); y++) {
      const s = A.Seasons(y);
      [[s.mar_equinox, 'March equinox', 'વસંત સંપાત', 'वसंत विषुव'], [s.jun_solstice, 'June solstice', 'ઉત્તર અયનાંત', 'ग्रीष्म संक्रांति'],
        [s.sep_equinox, 'September equinox', 'શરદ સંપાત', 'शरद विषुव'], [s.dec_solstice, 'December solstice', 'દક્ષિણ અયનાંત', 'शीत संक्रांति']]
        .forEach(([t, en, gu, hi]) => { if (t.date >= from && t.date <= to) out.push({ key: 'season', en, gu, hi, sets: ['international'], day: K.dateKey(t.date, loc.zone), at: t.date }); });
      const yogaDay = y + '-06-21';
      if (yogaDay >= fromDay && yogaDay <= toDay) out.push({ key: 'yogaday', en: 'International Day of Yoga', gu: 'આંતરરાષ્ટ્રીય યોગ દિવસ', hi: 'अंतर्राष्ट्रीय योग दिवस', sets: ['international', 'india'], day: yogaDay });
    }
    // Eclipses visible from this place, with the traditional sutak start.
    for (let e = A.SearchLunarEclipse(from); e.peak.date < to; e = A.NextLunarEclipse(e.peak)) {
      if (e.kind === 'penumbral') continue;
      // Visible if the Moon is above the horizon at any point of the partial (or penumbral-free) phase.
      const half = (e.sd_partial || 30) * 6e4, alt = t => { const q = A.Equator('Moon', t, obs, true, true); return A.Horizon(t, obs, q.ra, q.dec, 'normal').altitude; };
      if (![-1, -0.5, 0, 0.5, 1].some(k => alt(new Date(+e.peak.date + k * half)) > 0)) continue;
      out.push({ key: 'chandragrahan', en: (e.kind === 'total' ? 'Total' : 'Partial') + ' lunar eclipse · Chandra Grahan', gu: 'ચંદ્ર ગ્રહણ', hi: 'चंद्र ग्रहण',
        sets: ['international', 'india', 'gujarati'], day: K.dateKey(e.peak.date, loc.zone), at: e.peak.date, sutak: new Date(+e.peak.date - half - 9 * 36e5) });
    }
    for (let e = A.SearchLocalSolarEclipse(from, obs); e.peak.time.date < to; e = A.NextLocalSolarEclipse(e.peak.time, obs)) {
      if (e.peak.altitude <= 0) continue;
      const begin = e.partial_begin && e.partial_begin.time ? e.partial_begin.time.date : e.peak.time.date;
      out.push({ key: 'suryagrahan', en: e.kind[0].toUpperCase() + e.kind.slice(1) + ' solar eclipse · Surya Grahan', gu: 'સૂર્ય ગ્રહણ', hi: 'सूर्य ग्रहण',
        sets: ['international', 'india', 'gujarati'], day: K.dateKey(e.peak.time.date, loc.zone), at: e.peak.time.date, sutak: new Date(+begin - 12 * 36e5) });
    }
    return out;
  }

  /* Makar Sankranti: the Sun enters sidereal Capricorn. Observed the next day if it happens after sunset. */
  function sankranti(samp, loc) {
    const out = [];
    for (let y = +samp[0].day.slice(0, 4); y <= +samp[samp.length - 1].day.slice(0, 4); y++) {
      const t = P.crossing(P.sunSid, new Date(Date.UTC(y, 0, 1)), 270, 30 * 24);
      if (!t) continue;
      const d = samp.find(x => x.start <= t && t < x.end);
      if (!d) continue;
      const day = t > d.sunset ? K.addDay(d.day, 1) : d.day;
      out.push({ key: 'sankranti', en: 'Makar Sankranti', gu: 'મકર સંક્રાંતિ', hi: 'मकर संक्रांति', sets: ['india'], day, at: t });
      out.push({ key: 'uttarayan', en: 'Uttarayan · kite festival', gu: 'ઉત્તરાયણ', hi: 'उत्तरायण', sets: ['gujarati'], day, at: t });
      out.push({ key: 'vasiuttarayan', en: 'Vasi Uttarayan', gu: 'વાસી ઉત્તરાયણ', hi: 'वासी उत्तरायण', sets: ['gujarati'], day: K.addDay(day, 1) });
    }
    return out;
  }

  const cache = new Map();
  /* All observances from `fromDay` for `days` days at `loc`, sorted by day. Each: {key, en, gu, hi, sets, day, kind, parana?, note?}. */
  function list(fromDay, days, loc) {
    const id = [fromDay, days, loc.lat, loc.lon, loc.zone].join('|');
    if (cache.has(id)) return cache.get(id);
    const samp = samples(K.addDay(fromDay, -2), days + 4, loc);
    const ls = lunations(samp[0].start, samp[samp.length - 1].end);
    const toDay = K.addDay(fromDay, days);
    let out = [];
    for (const f of FESTIVALS) for (const h of findDays(samp, ls, f.tithi, f.month, f.rule, loc))
      out.push(Object.assign({}, f, { kind: 'festival', day: samp[h.i].day }));
    for (const v of VRATS) for (const tithi of v.tithis) for (const h of findDays(samp, ls, tithi, null, v.rule, loc, true)) {
      const item = { key: v.key, en: v.en, gu: v.gu, hi: v.hi, sets: ['vrat'], kind: 'vrat', day: samp[h.i].day, tithi, rule: v.rule };
      if (v.key === 'ekadashi') {
        const krishna = tithi >= 15, pm = krishna ? (h.lunation.index + 1) % 12 : h.lunation.index;
        // Adhik months: Padmini (Shukla) and Parama (Krishna) Ekadashi.
        item.en = (h.lunation.adhik ? (krishna ? 'Parama' : 'Padmini') : EKADASHI[pm][krishna ? 0 : 1]) + ' Ekadashi';
        item.parana = parana(samp, h.i);
      }
      out.push(item);
    }
    out = out.concat(sankranti(samp, loc).map(x => Object.assign({ kind: 'festival' }, x)), international(fromDay, toDay, loc).map(x => Object.assign({ kind: x.key.indexOf('grahan') > 0 ? 'grahan' : 'observance' }, x)));
    out = out.filter(x => x.day >= fromDay && x.day <= toDay).sort((a, b) => a.day < b.day ? -1 : a.day > b.day ? 1 : (a.kind === 'vrat') - (b.kind === 'vrat'));
    if (cache.size > 12) cache.clear();
    cache.set(id, out);
    return out;
  }
  const visible = (items, sets) => items.filter(x => x.sets.some(s => sets.indexOf(s) >= 0));
  /* Compact feed for the home-screen widget: [{date, n (Gujarati name), en, d (one line on what to do)}]. */
  function upcoming(loc, fromDay, days, sets) {
    return visible(list(fromDay, days || 60, loc), sets || defaultSets(loc)).map(x => ({ date: x.day, n: x.gu || x.en, en: x.en,
      d: x.parana ? 'Fast from sunrise; parana ' + x.parana.day + ' ' + hhmm(x.parana.start, loc.zone) + '–' + hhmm(x.parana.end, loc.zone)
        : x.sutak ? 'Sutak from ' + hhmm(x.sutak, loc.zone) + ' ' + K.dateKey(x.sutak, loc.zone) : x.note || '' }));
  }
  const hhmm = (d, z) => { const p = K.parts(d, z); return p.hour + ':' + p.minute; };

  const api = { FESTIVALS, VRATS, EKADASHI, SETS, defaultSets, defaultMonthSystem, list, visible, upcoming, parana, samples, lunations, findDays };
  if (typeof module !== 'undefined') module.exports = api;
  root.Festivals = api;
  // Read by the home-screen widget feed when present.
  root.SomaFestivals = { upcoming: (loc, fromDay, days) => upcoming(loc, fromDay, days, root.SomaFestivalSets) };
})(typeof window !== 'undefined' ? window : globalThis);
