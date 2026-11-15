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

  /* Location defaults: Gujarat → Gujarati + pan-Indian; rest of India → pan-Indian; elsewhere → Gujarati + pan-Indian + international
     (Soma is Gujarati-first, and abroad most of its readers keep the Gujarati calendar, so Labh Pancham or Bestu Varas
     must not vanish just because the phone is in Canada). */
  /* India's zone has two names: many browsers and some Android phones still report the old Asia/Calcutta. */
  const indiaZone = z => z === 'Asia/Kolkata' || z === 'Asia/Calcutta';
  function defaultSets(loc) {
    const inGujarat = loc.lat >= 20 && loc.lat <= 24.8 && loc.lon >= 68 && loc.lon <= 74.6;
    const inIndia = indiaZone(loc.zone);
    return inGujarat ? ['gujarati', 'india', 'vrat'] : inIndia ? ['india', 'vrat'] : ['gujarati', 'india', 'international', 'vrat'];
  }
  /* North Indian users count months purnimanta; Gujarat, Maharashtra and the South use amanta. */
  function defaultMonthSystem(loc) {
    const north = indiaZone(loc.zone) && loc.lat > 23.5 && !(loc.lon < 74.6 && loc.lat < 24.8);
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
      // The first sunset after sunrise, even when it falls after local midnight (far north in summer).
      const own = r && r.date < end ? A.SearchRiseSet('Sun', obs, -1, r.date, 1) : null;
      const sunset = own && own.date - r.date < 864e5 ? own.date : s && s.date < end && s.date > sunrise ? s.date : K.instant(day, '18:00', loc.zone);
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
  function parana(samp, i, tithi) {
    const next = samp[i + 1];
    if (!next) return null;
    // Boundaries come from the observed Ekadashi tithi itself, which may begin after this day's sunrise (kshaya).
    const ekadashiEnd = A.SearchMoonPhase(((tithi + 1) * 12) % 360, new Date(+samp[i].sunrise - 6 * 36e5), 3).date;
    const dwadashiEnd = A.SearchMoonPhase(((tithi + 2) * 12) % 360, ekadashiEnd, 2).date;
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
        item.parana = parana(samp, h.i, tithi);
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

  /* How each observance is kept, and when its own puja falls. `puja` names a fixed window of the day by tradition
   * (never one clipped to "now"): pratah (first fifth of daytime), purvahna (sunrise to midday), ghata (Ghatasthapana,
   * first third of daytime), madhyahna (third fifth), aparahna (fourth fifth), pradosh (first fifth of the night),
   * nishita (the night's middle muhurta), arghya (Chhath: sunset today, sunrise tomorrow), snan (Abhyang snan, Brahma
   * muhurta to sunrise), punya (Sankranti punya kaal), moonrise (fasts broken at moonrise). Observances without a set
   * muhurat have none, and the app then gives no "best time" at all rather than inventing one. */
  const PUJA = { gudi: 'ghata', navratri: 'ghata', ramnavami: 'madhyahna', ganesh: 'madhyahna', rishi: 'madhyahna', vinayaka: 'madhyahna',
    akshaya: 'purvahna', vasant: 'purvahna', nagpanchami: 'pratah', labhpancham: 'pratah', govardhan: 'pratah', bhaidooj: 'aparahna',
    dussehra: 'aparahna', rakhi: 'aparahna', sarvapitru: 'aparahna', dhanteras: 'pradosh', diwali: 'pradosh', devdiwali: 'pradosh',
    pradosh: 'pradosh', holika: 'pradosh', janmashtami: 'nishita', shivratri: 'nishita', kalichaudas: 'nishita', masikshivratri: 'nishita',
    chhath: 'arghya', narak: 'snan', sankranti: 'punya', uttarayan: 'punya', karwa: 'moonrise', sankashti: 'moonrise', sharadpurnima: 'moonrise' };
  const pujaOf = f => (f && PUJA[f.key]) || null;
  /* m: what it is (one or two lines); k: how it is kept (three short steps). Written in each language. */
  const I = (en, gu, hi) => ({ en: { m: en[0], k: en.slice(1) }, gu: { m: gu[0], k: gu.slice(1) }, hi: { m: hi[0], k: hi.slice(1) } });
  const INFO = {
    gudi: I(['The lunar new year in the Chaitra calendar, and the first of the nine nights of Chaitra Navratri.', 'Set up the kalash (Ghatasthapana) in the morning', 'Raise the Gudi or hang a toran of mango leaves', 'Eat neem with jaggery for a sweet, healthy year'],
      ['ચૈત્ર માસનું નવું વર્ષ અને ચૈત્રી નવરાત્રિની પહેલી રાત.', 'સવારે ઘટસ્થાપન કરો', 'આંબાનાં પાનનું તોરણ બાંધો', 'લીમડો અને ગોળ ખાઈ વર્ષ શરૂ કરો'],
      ['चैत्र मास का नव वर्ष और चैत्र नवरात्रि की पहली रात।', 'सुबह घटस्थापना करें', 'गुड़ी खड़ी करें या आम के पत्तों का तोरण बाँधें', 'नीम और गुड़ खाकर वर्ष आरंभ करें']),
    ramnavami: I(['The birth of Shri Ram, at midday on Chaitra Shukla Navami.', 'Fast until the madhyahna puja', 'Read or listen to the Ramcharitmanas', 'Offer panjiri and fruit at the cradle at noon'],
      ['ચૈત્ર સુદ નોમે બપોરે શ્રી રામનો જન્મ.', 'મધ્યાહ્ન પૂજા સુધી ઉપવાસ રાખો', 'રામચરિતમાનસનો પાઠ કરો', 'બપોરે પારણામાં પંજરી અને ફળ ધરાવો'],
      ['चैत्र शुक्ल नवमी को मध्याह्न में श्री राम का जन्म।', 'मध्याह्न पूजा तक व्रत रखें', 'रामचरितमानस का पाठ करें', 'दोपहर में पालने में पंजीरी और फल अर्पित करें']),
    mahavir: I(['The birth of Bhagwan Mahavir, the 24th Tirthankara.', 'Visit a derasar for abhishek of the pratima', 'Keep ahimsa in food and word', 'Give to those in need'],
      ['ચોવીસમા તીર્થંકર ભગવાન મહાવીરનો જન્મ.', 'દેરાસરમાં પ્રતિમાનો અભિષેક જુઓ', 'ભોજન અને વાણીમાં અહિંસા રાખો', 'જરૂરિયાતમંદને દાન આપો'],
      ['चौबीसवें तीर्थंकर भगवान महावीर का जन्म।', 'मंदिर में प्रतिमा का अभिषेक देखें', 'भोजन और वाणी में अहिंसा रखें', 'ज़रूरतमंदों को दान दें']),
    hanuman: I(['The birth of Hanumanji, on Chaitra Purnima.', 'Begin at sunrise with the Hanuman Chalisa', 'Offer sindoor, oil and a garland at the temple', 'Share boondi or laddoo as prasad'],
      ['ચૈત્રી પૂનમે હનુમાનજીનો જન્મ.', 'સૂર્યોદયે હનુમાન ચાલીસાથી શરૂ કરો', 'મંદિરે સિંદૂર, તેલ અને હાર ચડાવો', 'બુંદી કે લાડુનો પ્રસાદ વહેંચો'],
      ['चैत्र पूर्णिमा को हनुमानजी का जन्म।', 'सूर्योदय पर हनुमान चालीसा से आरंभ करें', 'मंदिर में सिंदूर, तेल और माला चढ़ाएँ', 'बूंदी या लड्डू का प्रसाद बाँटें']),
    akshaya: I(['A day whose merit never wanes: any good work begun today bears lasting fruit. The whole day is a muhurat.', 'Worship Vishnu and Lakshmi in the morning', 'Buy gold or begin a venture, a home or a study', 'Give water, grain or a fan to someone in need'],
      ['જેનું પુણ્ય ક્યારેય ઘટતું નથી એવો દિવસ: આજે શરૂ કરેલું સારું કામ ફળે છે. આખો દિવસ મુહૂર્ત છે.', 'સવારે વિષ્ણુ અને લક્ષ્મીની પૂજા કરો', 'સોનું ખરીદો કે નવું કામ, ઘર કે અભ્યાસ શરૂ કરો', 'પાણી, અનાજ કે પંખાનું દાન કરો'],
      ['जिसका पुण्य कभी क्षीण नहीं होता: आज आरंभ किया शुभ कार्य स्थायी फल देता है। पूरा दिन मुहूर्त है।', 'सुबह विष्णु और लक्ष्मी की पूजा करें', 'सोना खरीदें या नया कार्य, घर या अध्ययन आरंभ करें', 'जल, अन्न या पंखे का दान करें']),
    buddha: I(['The birth, awakening and passing of the Buddha, all on Vaishakh Purnima.', 'Light a lamp and sit in quiet meditation', 'Keep the day free of harm to any being', 'Give food or alms'],
      ['વૈશાખી પૂનમે બુદ્ધનો જન્મ, બોધ અને નિર્વાણ.', 'દીવો કરી શાંત ધ્યાનમાં બેસો', 'કોઈ જીવને દુઃખ ન થાય તેમ દિવસ ગાળો', 'ભોજન કે દાન આપો'],
      ['वैशाख पूर्णिमा को बुद्ध का जन्म, बोध और निर्वाण।', 'दीप जलाकर शांत ध्यान करें', 'दिन भर किसी जीव को कष्ट न दें', 'भोजन या दान दें']),
    vatpurnima: I(['Married women pray for their husbands’ long life, as Savitri won back Satyavan.', 'Fast from sunrise', 'Wind a sacred thread around the banyan tree', 'Hear the Savitri–Satyavan katha'],
      ['સાવિત્રીએ સત્યવાનના પ્રાણ પાછા મેળવ્યા તેમ પરિણીત સ્ત્રીઓ પતિના દીર્ઘાયુ માટે વ્રત કરે છે.', 'સૂર્યોદયથી ઉપવાસ રાખો', 'વડની આસપાસ સૂતરનો દોરો વીંટો', 'સાવિત્રી સત્યવાનની કથા સાંભળો'],
      ['जैसे सावित्री ने सत्यवान के प्राण लौटाए, विवाहित स्त्रियाँ पति की लंबी आयु के लिए व्रत रखती हैं।', 'सूर्योदय से व्रत रखें', 'बरगद के चारों ओर कच्चा सूत लपेटें', 'सावित्री-सत्यवान की कथा सुनें']),
    rathyatra: I(['Jagannath, Balbhadra and Subhadra ride out in their chariots; Ahmedabad’s yatra is the second largest.', 'Join or watch the yatra in the morning', 'Offer moong, jambu and cucumber prasad', 'Pull the rope if you can: it is a blessing'],
      ['જગન્નાથ, બળભદ્ર અને સુભદ્રા રથમાં નગરયાત્રાએ નીકળે છે; અમદાવાદની રથયાત્રા દેશમાં બીજી સૌથી મોટી છે.', 'સવારે રથયાત્રામાં જોડાઓ કે દર્શન કરો', 'મગ, જાંબુ અને કાકડીનો પ્રસાદ ધરાવો', 'મળે તો રથનું દોરડું ખેંચો: એ આશીર્વાદ છે'],
      ['जगन्नाथ, बलभद्र और सुभद्रा रथ पर नगर यात्रा करते हैं।', 'सुबह यात्रा में शामिल हों या दर्शन करें', 'मूंग, जामुन और ककड़ी का प्रसाद चढ़ाएँ', 'हो सके तो रथ की रस्सी खींचें: यह आशीर्वाद है']),
    gurupurnima: I(['The day of Vyasa and of every guru: thanks to those who taught you.', 'Bow to your guru, parents or teachers', 'Read a little of a text you love', 'Offer dakshina, fruit or flowers'],
      ['વ્યાસ અને દરેક ગુરુનો દિવસ: જેમણે શીખવ્યું તેમનો આભાર.', 'ગુરુ, માતાપિતા કે શિક્ષકને વંદન કરો', 'ગમતા ગ્રંથનો થોડો પાઠ કરો', 'દક્ષિણા, ફળ કે ફૂલ ધરાવો'],
      ['व्यास और हर गुरु का दिन: जिन्होंने सिखाया उनका आभार।', 'गुरु, माता-पिता या शिक्षकों को प्रणाम करें', 'किसी प्रिय ग्रंथ का थोड़ा पाठ करें', 'दक्षिणा, फल या फूल अर्पित करें']),
    nagpanchami: I(['Worship of the Nagas, guardians of water and the earth.', 'Offer milk and flowers to a Naga image in the morning', 'Do not dig the soil today', 'Eat simple food, often cold'],
      ['પાણી અને ધરતીના રક્ષક નાગ દેવતાની પૂજા.', 'સવારે નાગ દેવતાને દૂધ અને ફૂલ ધરાવો', 'આજે જમીન ખોદશો નહીં', 'સાદું ભોજન લો'],
      ['जल और धरती के रक्षक नाग देवता की पूजा।', 'सुबह नाग देवता को दूध और फूल अर्पित करें', 'आज भूमि न खोदें', 'सादा भोजन करें']),
    rakhi: I(['Sisters tie a rakhi on their brothers, who promise to protect them. The rakhi is tied in the afternoon, never during Bhadra.', 'Prepare a thali: rakhi, kumkum, rice, a lamp and sweets', 'Tie the rakhi after Bhadra has ended', 'Brothers give a gift and a promise'],
      ['બહેન ભાઈને રાખડી બાંધે છે અને ભાઈ રક્ષાનું વચન આપે છે. રાખડી બપોરે બંધાય, ભદ્રામાં ક્યારેય નહીં.', 'થાળી તૈયાર કરો: રાખડી, કંકુ, ચોખા, દીવો અને મીઠાઈ', 'ભદ્રા પૂરી થયા પછી રાખડી બાંધો', 'ભાઈ ભેટ અને વચન આપે'],
      ['बहन भाई को राखी बाँधती है और भाई रक्षा का वचन देता है। राखी अपराह्न में बँधती है, भद्रा में कभी नहीं।', 'थाली सजाएँ: राखी, कुमकुम, चावल, दीपक और मिठाई', 'भद्रा समाप्त होने के बाद राखी बाँधें', 'भाई उपहार और वचन दें']),
    randhan: I(['Cooking day before Shitala Satam: the food for tomorrow is made today.', 'Cook the next day’s meal in the evening', 'Clean the stove and let it rest after', 'Keep the cooked food covered overnight'],
      ['શીતળા સાતમ પહેલાંનો રાંધણ દિવસ: કાલનું ભોજન આજે બને.', 'સાંજે આવતી કાલનું ભોજન રાંધો', 'પછી ચૂલો સાફ કરી ઠંડો રાખો', 'રાંધેલું ભોજન રાત્રે ઢાંકીને રાખો'],
      ['शीतला सप्तमी से पहले का रांधण दिवस: कल का भोजन आज बनता है।', 'शाम को अगले दिन का भोजन पकाएँ', 'फिर चूल्हा साफ़ करके ठंडा रखें', 'पका भोजन रात भर ढककर रखें']),
    shitala: I(['Shitala Mata keeps the family free of fever: no fire is lit today.', 'Do not light the stove; eat yesterday’s food cold', 'Worship Shitala Mata with cold water and curd', 'Bathe in cool water'],
      ['શીતળા માતા પરિવારને તાવ અને રોગથી બચાવે છે: આજે ચૂલો સળગાવાતો નથી.', 'ચૂલો ન સળગાવો; ગઈકાલનું ઠંડું ભોજન લો', 'શીતળા માતાની ઠંડા પાણી અને દહીંથી પૂજા કરો', 'ઠંડા પાણીથી સ્નાન કરો'],
      ['शीतला माता परिवार को ज्वर और रोग से बचाती हैं: आज चूल्हा नहीं जलता।', 'चूल्हा न जलाएँ; बासी ठंडा भोजन करें', 'शीतला माता की ठंडे जल और दही से पूजा करें', 'ठंडे जल से स्नान करें']),
    janmashtami: I(['The birth of Shri Krishna at midnight, in Rohini nakshatra.', 'Fast through the day', 'Sing bhajans and keep awake until the nishita puja', 'Bathe and dress Laddu Gopal at midnight, then break the fast'],
      ['મધરાતે રોહિણી નક્ષત્રમાં શ્રી કૃષ્ણનો જન્મ.', 'આખો દિવસ ઉપવાસ રાખો', 'ભજન ગાઓ અને નિશીથ પૂજા સુધી જાગો', 'મધરાતે લાલજીને સ્નાન કરાવી શણગારો, પછી પારણાં કરો'],
      ['मध्यरात्रि में रोहिणी नक्षत्र में श्री कृष्ण का जन्म।', 'पूरे दिन व्रत रखें', 'भजन गाएँ और निशीथ पूजा तक जागें', 'मध्यरात्रि में लड्डू गोपाल को स्नान कराकर सजाएँ, फिर व्रत खोलें']),
    ganesh: I(['The birth of Ganesh. The murti is installed at midday, the hour he was born.', 'Install the murti in the madhyahna window', 'Offer modak, durva grass and red flowers', 'Do not look at the Moon tonight'],
      ['ગણેશનો જન્મ. મૂર્તિની સ્થાપના બપોરે થાય, જે ઘડીએ તેઓ જન્મ્યા.', 'મધ્યાહ્નમાં મૂર્તિની સ્થાપના કરો', 'મોદક, દૂર્વા અને લાલ ફૂલ ધરાવો', 'આજે રાત્રે ચંદ્ર જોશો નહીં'],
      ['गणेश का जन्म। मूर्ति की स्थापना मध्याह्न में होती है, जिस घड़ी उनका जन्म हुआ।', 'मध्याह्न में मूर्ति स्थापित करें', 'मोदक, दूर्वा और लाल फूल अर्पित करें', 'आज रात चंद्रमा न देखें']),
    rishi: I(['Honour of the Saptarishi, kept by women to cleanse the year’s faults.', 'Bathe and fast', 'Worship the seven rishis at midday', 'Eat only what grows without ploughing'],
      ['સપ્તર્ષિનું પૂજન; સ્ત્રીઓ વર્ષના દોષ નિવારણ માટે વ્રત કરે છે.', 'સ્નાન કરી ઉપવાસ રાખો', 'બપોરે સપ્તર્ષિની પૂજા કરો', 'હળ વગર ઊગેલું જ ભોજન લો'],
      ['सप्तर्षियों का पूजन; स्त्रियाँ वर्ष के दोषों के निवारण के लिए व्रत रखती हैं।', 'स्नान करके व्रत रखें', 'मध्याह्न में सप्तर्षियों की पूजा करें', 'बिना हल जोते उगा अन्न ही खाएँ']),
    anant: I(['Vishnu as Anant, and the farewell of Ganesh: the murti is immersed today.', 'Tie the fourteen-knot Anant sutra on the arm', 'Do the uttar puja and aarti of Ganesh', 'Immerse the murti with “Ganpati Bappa, come back soon”'],
      ['અનંત રૂપે વિષ્ણુની પૂજા અને ગણેશજીની વિદાય: આજે મૂર્તિનું વિસર્જન થાય.', 'હાથે ચૌદ ગાંઠનો અનંત દોરો બાંધો', 'ગણેશજીની ઉત્તર પૂજા અને આરતી કરો', '“ગણપતિ બાપ્પા, આવતા વર્ષે વહેલા આવજો” કહી વિસર્જન કરો'],
      ['अनंत रूप में विष्णु की पूजा और गणेश की विदाई: आज मूर्ति विसर्जन होता है।', 'बाँह पर चौदह गाँठ का अनंत सूत्र बाँधें', 'गणेश की उत्तर पूजा और आरती करें', '“गणपति बप्पा, अगले बरस जल्दी आना” कहकर विसर्जन करें']),
    pitrupaksha: I(['The fortnight of the ancestors begins. Shraddha is offered on the tithi of each ancestor’s passing.', 'Offer water and sesame (tarpan) to the ancestors', 'Feed a Brahmin, a cow, a crow and a dog', 'Hold back from new purchases and celebrations'],
      ['પિતૃઓનો પખવાડિયો શરૂ થાય છે. દરેક પૂર્વજના અવસાનની તિથિએ શ્રાદ્ધ થાય.', 'પિતૃઓને જળ અને તલનું તર્પણ કરો', 'બ્રાહ્મણ, ગાય, કાગડો અને કૂતરાને ભોજન આપો', 'નવી ખરીદી અને ઉત્સવ આ દિવસોમાં ટાળો'],
      ['पितरों का पक्ष आरंभ होता है। हर पूर्वज की पुण्यतिथि पर श्राद्ध होता है।', 'पितरों को जल और तिल से तर्पण करें', 'ब्राह्मण, गाय, कौआ और कुत्ते को भोजन दें', 'इन दिनों नई खरीदारी और उत्सव टालें']),
    sarvapitru: I(['Shraddha for every ancestor, including those whose tithi is not known.', 'Offer tarpan and pind in the afternoon (aparahna)', 'Feed Brahmins and give daan', 'Light a lamp facing south in the evening'],
      ['બધા પિતૃઓનું શ્રાદ્ધ, જેમની તિથિ ખબર નથી તેમનું પણ.', 'બપોર પછી (અપરાહ્ન) તર્પણ અને પિંડદાન કરો', 'બ્રાહ્મણોને ભોજન અને દાન આપો', 'સાંજે દક્ષિણ દિશામાં દીવો કરો'],
      ['सभी पितरों का श्राद्ध, उनका भी जिनकी तिथि ज्ञात नहीं।', 'अपराह्न में तर्पण और पिंडदान करें', 'ब्राह्मणों को भोजन और दान दें', 'शाम को दक्षिण दिशा में दीप जलाएँ']),
    navratri: I(['Nine nights of the Devi begin. The kalash is set up in the morning and garba fills the nights.', 'Do Ghatasthapana in the morning window', 'Sow jowar in the garbo and keep the lamp lit for nine days', 'Fast as your family does, and join the garba'],
      ['દેવીની નવ રાત્રિ શરૂ થાય છે. સવારે ઘટસ્થાપન અને રાત્રે ગરબા.', 'સવારના સમયમાં ઘટસ્થાપન કરો', 'ગરબામાં જવારા વાવો અને નવ દિવસ અખંડ દીવો રાખો', 'કુટુંબ પ્રમાણે ઉપવાસ કરો અને ગરબે ઘૂમો'],
      ['देवी की नौ रातें आरंभ। सुबह घटस्थापना और रात में गरबा।', 'सुबह के समय में घटस्थापना करें', 'जौ बोएँ और नौ दिन अखंड दीप जलाएँ', 'परिवार की रीति से व्रत रखें और गरबा में शामिल हों']),
    durgashtami: I(['The eighth day of Navratri, sacred to Mahagauri and the havan.', 'Do the havan of Navratri', 'Worship nine young girls (kanya puja)', 'Offer halwa, puri and chana'],
      ['નવરાત્રિનો આઠમો દિવસ, મહાગૌરી અને હવનનો દિવસ.', 'નવરાત્રિનો હવન કરો', 'નવ કન્યાઓનું પૂજન કરો', 'શીરો, પૂરી અને ચણા ધરાવો'],
      ['नवरात्रि का आठवाँ दिन, महागौरी और हवन का दिन।', 'नवरात्रि का हवन करें', 'नौ कन्याओं का पूजन करें', 'हलवा, पूरी और चना अर्पित करें']),
    dussehra: I(['Ram’s victory over Ravan and the Devi’s over Mahishasura: good over evil.', 'Worship tools, books and vehicles (Shastra puja)', 'Do the Aparajita puja in the afternoon', 'Eat fafda-jalebi and give shami leaves as gold'],
      ['રાવણ પર રામનો અને મહિષાસુર પર દેવીનો વિજય: અસત્ય પર સત્યનો.', 'શસ્ત્ર, પુસ્તક અને વાહનની પૂજા કરો', 'બપોરે અપરાજિતા પૂજન કરો', 'ફાફડા-જલેબી ખાઓ અને શમીનાં પાન સોનું ગણીને આપો'],
      ['रावण पर राम की और महिषासुर पर देवी की विजय: असत्य पर सत्य की।', 'शस्त्र, पुस्तक और वाहन की पूजा करें', 'अपराह्न में अपराजिता पूजन करें', 'शमी के पत्ते सोने के रूप में बाँटें']),
    sharadpurnima: I(['The brightest full moon of the year, when the Moon’s light is said to carry amrit.', 'Make doodh-pauva or kheer', 'Leave it in the moonlight after moonrise', 'Take it as prasad late at night'],
      ['વર્ષની સૌથી ઉજળી પૂનમ; ચાંદનીમાં અમૃત વરસે છે એમ મનાય છે.', 'દૂધપૌંઆ કે ખીર બનાવો', 'ચંદ્રોદય પછી ચાંદનીમાં મૂકો', 'મોડી રાત્રે પ્રસાદ તરીકે લો'],
      ['वर्ष की सबसे उजली पूर्णिमा; चाँदनी में अमृत बरसता है ऐसा माना जाता है।', 'खीर बनाएँ', 'चंद्रोदय के बाद चाँदनी में रखें', 'देर रात प्रसाद के रूप में ग्रहण करें']),
    karwa: I(['Married women fast from dawn to moonrise for their husbands’ long life.', 'Eat sargi before sunrise, then keep a nirjala fast', 'Hear the Karwa Chauth katha in the evening', 'At moonrise, see the Moon through a sieve, offer arghya, then break the fast'],
      ['પરિણીત સ્ત્રીઓ પતિના દીર્ઘાયુ માટે સવારથી ચંદ્રોદય સુધી ઉપવાસ કરે છે.', 'સૂર્યોદય પહેલાં સરગી લો, પછી નિર્જળા ઉપવાસ', 'સાંજે કરવા ચોથની કથા સાંભળો', 'ચંદ્રોદયે ચાળણીમાંથી ચંદ્ર જોઈ અર્ઘ્ય આપો, પછી પારણાં'],
      ['विवाहित स्त्रियाँ पति की लंबी आयु के लिए भोर से चंद्रोदय तक व्रत रखती हैं।', 'सूर्योदय से पहले सरगी लें, फिर निर्जला व्रत', 'शाम को करवा चौथ की कथा सुनें', 'चंद्रोदय पर छलनी से चाँद देखकर अर्घ्य दें, फिर व्रत खोलें']),
    dhanteras: I(['Dhanvantari’s day and the start of Diwali: Lakshmi is welcomed with new metal.', 'Buy gold, silver or a new vessel', 'Light the Yama deep facing south after sunset', 'Do the Lakshmi–Kuber puja in pradosh'],
      ['ધન્વંતરિનો દિવસ અને દિવાળીની શરૂઆત: નવી ધાતુથી લક્ષ્મીનું સ્વાગત.', 'સોનું, ચાંદી કે નવું વાસણ ખરીદો', 'સૂર્યાસ્ત પછી દક્ષિણ તરફ યમ દીપ કરો', 'પ્રદોષમાં લક્ષ્મી-કુબેર પૂજન કરો'],
      ['धन्वंतरि का दिन और दीपावली का आरंभ: नई धातु से लक्ष्मी का स्वागत।', 'सोना, चाँदी या नया बर्तन खरीदें', 'सूर्यास्त के बाद दक्षिण की ओर यम दीप जलाएँ', 'प्रदोष में लक्ष्मी-कुबेर पूजन करें']),
    kalichaudas: I(['The night of Mahakali and Hanumanji, kept to drive away fear and the evil eye.', 'Offer oil and sindoor to Hanumanji', 'Make vada and place them at a crossroads to ward off ill', 'Do the Kali puja at midnight'],
      ['મહાકાળી અને હનુમાનજીની રાત, ભય અને નજર દૂર કરવા.', 'હનુમાનજીને તેલ અને સિંદૂર ચડાવો', 'વડાં બનાવી ચાર રસ્તે કકળાટ કાઢો', 'મધરાતે કાળી પૂજા કરો'],
      ['महाकाली और हनुमानजी की रात, भय और नज़र दूर करने के लिए।', 'हनुमानजी को तेल और सिंदूर चढ़ाएँ', 'बुराई दूर करने के लिए चौराहे पर वड़े रखें', 'मध्यरात्रि में काली पूजा करें']),
    narak: I(['Krishna’s victory over Narakasura. The day begins with an oil bath before sunrise.', 'Take the abhyang snan (oil and ubtan) before sunrise', 'Light fourteen lamps in the evening', 'Wear new clothes'],
      ['નરકાસુર પર કૃષ્ણનો વિજય. દિવસ સૂર્યોદય પહેલાં તેલ-સ્નાનથી શરૂ થાય.', 'સૂર્યોદય પહેલાં અભ્યંગ સ્નાન (તેલ અને ઉબટન) કરો', 'સાંજે ચૌદ દીવા કરો', 'નવાં કપડાં પહેરો'],
      ['नरकासुर पर कृष्ण की विजय। दिन सूर्योदय से पहले तेल स्नान से आरंभ होता है।', 'सूर्योदय से पहले अभ्यंग स्नान (तेल और उबटन) करें', 'शाम को चौदह दीपक जलाएँ', 'नए वस्त्र पहनें']),
    diwali: I(['Lakshmi comes home on the darkest night: the house is lit to welcome her.', 'Clean the home and make rangoli at the door', 'Do the Lakshmi puja (and Chopda pujan) in pradosh, after sunset', 'Light lamps in every room and share sweets'],
      ['સૌથી અંધારી રાતે લક્ષ્મી ઘરે આવે છે: તેમના સ્વાગત માટે ઘર ઝગમગે છે.', 'ઘર સાફ કરી બારણે રંગોળી કરો', 'સૂર્યાસ્ત પછી પ્રદોષમાં લક્ષ્મી પૂજન અને ચોપડા પૂજન કરો', 'દરેક ઓરડામાં દીવા કરો અને મીઠાઈ વહેંચો'],
      ['सबसे अंधेरी रात में लक्ष्मी घर आती हैं: उनके स्वागत में घर जगमगाता है।', 'घर साफ़ करके द्वार पर रंगोली बनाएँ', 'सूर्यास्त के बाद प्रदोष में लक्ष्मी पूजन करें', 'हर कमरे में दीप जलाएँ और मिठाई बाँटें']),
    bestuvaras: I(['The Gujarati New Year, Vikram Samvat begins: a fresh start with family and elders.', 'Visit the temple for darshan of the Annakut', 'Greet elders with “Saal Mubarak” and take their blessings', 'Begin the year’s first work in a shubh Choghadiya'],
      ['ગુજરાતી નવું વર્ષ, વિક્રમ સંવતની શરૂઆત: કુટુંબ અને વડીલો સાથે નવી શરૂઆત.', 'મંદિરે અન્નકૂટનાં દર્શન કરો', 'વડીલોને “સાલ મુબારક” કહી આશીર્વાદ લો', 'વર્ષનું પહેલું કામ શુભ ચોઘડિયામાં શરૂ કરો'],
      ['गुजराती नव वर्ष, विक्रम संवत का आरंभ: परिवार और बड़ों के साथ नई शुरुआत।', 'मंदिर में अन्नकूट के दर्शन करें', 'बड़ों को “साल मुबारक” कहकर आशीर्वाद लें', 'वर्ष का पहला काम शुभ चौघड़िया में आरंभ करें']),
    govardhan: I(['Krishna lifted Govardhan to shelter Vraj. A mountain of food (Annakut) is offered.', 'Make a Govardhan of cow dung or a heap of food in the morning', 'Offer the Annakut of many dishes', 'Walk around it (parikrama) and share the prasad'],
      ['કૃષ્ણે વ્રજના રક્ષણ માટે ગોવર્ધન ઊંચક્યો. ભોજનનો પર્વત (અન્નકૂટ) ધરાવાય છે.', 'સવારે છાણ કે ભોજનનો ગોવર્ધન બનાવો', 'અનેક વાનગીઓનો અન્નકૂટ ધરાવો', 'પરિક્રમા કરી પ્રસાદ વહેંચો'],
      ['कृष्ण ने व्रज की रक्षा के लिए गोवर्धन उठाया। भोजन का पर्वत (अन्नकूट) अर्पित होता है।', 'सुबह गोबर या अन्न से गोवर्धन बनाएँ', 'अनेक व्यंजनों का अन्नकूट अर्पित करें', 'परिक्रमा करें और प्रसाद बाँटें']),
    bhaidooj: I(['Yamuna welcomed her brother Yama: sisters feed their brothers and pray for their long life.', 'Brothers go to their sister’s home', 'She applies tilak and does aarti in the afternoon', 'She feeds him; he gives a gift'],
      ['યમુનાએ ભાઈ યમનું સ્વાગત કર્યું: બહેન ભાઈને જમાડે અને દીર્ઘાયુની પ્રાર્થના કરે.', 'ભાઈ બહેનને ઘરે જાય', 'બપોરે બહેન તિલક અને આરતી કરે', 'બહેન જમાડે; ભાઈ ભેટ આપે'],
      ['यमुना ने भाई यम का स्वागत किया: बहन भाई को भोजन कराती है और लंबी आयु की कामना करती है।', 'भाई बहन के घर जाएँ', 'अपराह्न में बहन तिलक और आरती करे', 'बहन भोजन कराए; भाई उपहार दे']),
    labhpancham: I(['Shops and businesses reopen after Diwali: new account books are worshipped for a year of profit.', 'Do the Sharda (Chopda) puja in the morning window', 'Write “Shubh Labh” and the swastik in the new books', 'Open the shop or begin work after the puja'],
      ['દિવાળી પછી દુકાન અને વેપાર ફરી ખૂલે: નફાના વર્ષ માટે નવા ચોપડાનું પૂજન.', 'સવારના સમયમાં શારદા (ચોપડા) પૂજન કરો', 'નવા ચોપડામાં “શુભ લાભ” અને સાથિયો લખો', 'પૂજા પછી દુકાન ખોલો કે કામ શરૂ કરો'],
      ['दीपावली के बाद दुकान और व्यापार फिर खुलते हैं: लाभ के वर्ष के लिए नए बही-खातों का पूजन।', 'सुबह के समय में शारदा (बही) पूजन करें', 'नई बही में “शुभ लाभ” और स्वस्तिक लिखें', 'पूजा के बाद दुकान खोलें या काम आरंभ करें']),
    chhath: I(['Worship of Surya and Chhathi Maiya: arghya to the setting sun today and the rising sun tomorrow.', 'Keep the nirjala fast through the day', 'Offer Sandhya Arghya at sunset, standing in water', 'Offer Usha Arghya at sunrise tomorrow, then break the fast'],
      ['સૂર્ય અને છઠી મૈયાની પૂજા: આજે આથમતા અને કાલે ઊગતા સૂર્યને અર્ઘ્ય.', 'આખો દિવસ નિર્જળા ઉપવાસ રાખો', 'સૂર્યાસ્તે પાણીમાં ઊભા રહી સંધ્યા અર્ઘ્ય આપો', 'કાલે સૂર્યોદયે ઉષા અર્ઘ્ય આપી પારણાં કરો'],
      ['सूर्य और छठी मैया की पूजा: आज डूबते और कल उगते सूर्य को अर्घ्य।', 'पूरे दिन निर्जला व्रत रखें', 'सूर्यास्त पर जल में खड़े होकर संध्या अर्घ्य दें', 'कल सूर्योदय पर उषा अर्घ्य देकर व्रत खोलें']),
    jalaram: I(['The birth of Jalaram Bapa of Virpur, whose sadavrat fed everyone who came.', 'Visit a Jalaram temple for darshan', 'Feed others, as Bapa did', 'Sing his bhajans in the evening'],
      ['વીરપુરના જલારામ બાપાનો જન્મ, જેમના સદાવ્રતમાં આવનાર દરેકને ભોજન મળતું.', 'જલારામ મંદિરે દર્શન કરો', 'બાપાની જેમ બીજાને જમાડો', 'સાંજે તેમનાં ભજન ગાઓ'],
      ['वीरपुर के जलाराम बापा का जन्म, जिनके सदाव्रत में हर आने वाले को भोजन मिलता था।', 'जलाराम मंदिर में दर्शन करें', 'बापा की तरह दूसरों को भोजन कराएँ', 'शाम को उनके भजन गाएँ']),
    devdiwali: I(['The Diwali of the gods, on Kartik Purnima: Shiva’s victory over Tripurasura.', 'Bathe in a river or at home before sunrise', 'Light lamps at the water and the door in pradosh', 'Give daan of lamps and food'],
      ['કારતકી પૂનમે દેવોની દિવાળી: ત્રિપુરાસુર પર શિવનો વિજય.', 'સૂર્યોદય પહેલાં નદીમાં કે ઘરે સ્નાન કરો', 'પ્રદોષમાં પાણી અને બારણે દીવા કરો', 'દીવા અને અન્નનું દાન કરો'],
      ['कार्तिक पूर्णिमा पर देवताओं की दीपावली: त्रिपुरासुर पर शिव की विजय।', 'सूर्योदय से पहले नदी में या घर पर स्नान करें', 'प्रदोष में जल और द्वार पर दीप जलाएँ', 'दीप और अन्न का दान करें']),
    vasant: I(['Saraswati’s day and the first breath of spring.', 'Wear yellow and offer yellow flowers', 'Worship Saraswati, books and instruments in the morning', 'A good day for a child’s first letters'],
      ['સરસ્વતીનો દિવસ અને વસંતની શરૂઆત.', 'પીળાં કપડાં પહેરો અને પીળાં ફૂલ ધરાવો', 'સવારે સરસ્વતી, પુસ્તક અને વાદ્યોની પૂજા કરો', 'બાળકના અક્ષરારંભ માટે શુભ દિવસ'],
      ['सरस्वती का दिन और वसंत का आरंभ।', 'पीले वस्त्र पहनें और पीले फूल अर्पित करें', 'सुबह सरस्वती, पुस्तकों और वाद्यों की पूजा करें', 'बच्चे के अक्षरारंभ के लिए शुभ दिन']),
    shivratri: I(['The great night of Shiva. The night is kept awake in four prahars; nishita kaal is its heart.', 'Fast through the day', 'Offer water, milk and bilva leaves to the Shivling', 'Chant Om Namah Shivaya and keep awake; the nishita puja is the main one'],
      ['શિવની મહા રાત્રિ. રાત ચાર પ્રહરમાં જાગરણથી ગળાય છે; નિશીથ કાળ તેનું હૃદય છે.', 'આખો દિવસ ઉપવાસ રાખો', 'શિવલિંગ પર જળ, દૂધ અને બીલીપત્ર ચડાવો', '“ૐ નમઃ શિવાય” જપી જાગરણ કરો; નિશીથ પૂજા મુખ્ય છે'],
      ['शिव की महान रात्रि। रात चार प्रहर जागरण से बीतती है; निशीथ काल उसका हृदय है।', 'पूरे दिन व्रत रखें', 'शिवलिंग पर जल, दूध और बेलपत्र चढ़ाएँ', '“ॐ नमः शिवाय” जपें और जागें; निशीथ पूजा मुख्य है']),
    holika: I(['Prahlad came through the fire unharmed: the Holika fire is lit after sunset, never during Bhadra.', 'Gather around the Holika in the evening', 'Light it in the pradosh window after Bhadra', 'Walk around it with water, wheat and coconut'],
      ['પ્રહલાદ અગ્નિમાંથી સલામત નીકળ્યા: હોળી સૂર્યાસ્ત પછી પ્રગટે, ભદ્રામાં ક્યારેય નહીં.', 'સાંજે હોળીની આસપાસ ભેગા થાઓ', 'ભદ્રા પછી પ્રદોષમાં હોળી પ્રગટાવો', 'પાણી, ઘઉં અને નારિયેળ સાથે પ્રદક્ષિણા કરો'],
      ['प्रह्लाद अग्नि से सुरक्षित निकले: होलिका सूर्यास्त के बाद जलती है, भद्रा में कभी नहीं।', 'शाम को होलिका के पास इकट्ठा हों', 'भद्रा के बाद प्रदोष में होलिका दहन करें', 'जल, गेहूँ और नारियल के साथ परिक्रमा करें']),
    dhuleti: I(['The day of colours after Holika: old quarrels are washed away.', 'Play with colour in the morning', 'Visit family and friends', 'Share sweets and thandai'],
      ['હોળી પછીનો રંગોનો દિવસ: જૂના ઝઘડા ધોવાઈ જાય.', 'સવારે રંગે રમો', 'સગાં અને મિત્રોને મળો', 'મીઠાઈ વહેંચો'],
      ['होलिका के बाद रंगों का दिन: पुराने झगड़े धुल जाते हैं।', 'सुबह रंग खेलें', 'परिवार और मित्रों से मिलें', 'मिठाई और ठंडाई बाँटें']),
    sankranti: I(['The Sun enters Makar: the days begin to lengthen. Daan in the punya kaal is especially fruitful.', 'Bathe and offer arghya to Surya', 'Give sesame, jaggery and grain in the punya kaal', 'Eat til-gud and khichdi'],
      ['સૂર્ય મકર રાશિમાં પ્રવેશે: દિવસ લાંબા થવા લાગે. પુણ્ય કાળમાં દાન વિશેષ ફળ આપે.', 'સ્નાન કરી સૂર્યને અર્ઘ્ય આપો', 'પુણ્ય કાળમાં તલ, ગોળ અને અનાજનું દાન કરો', 'તલસાંકળી અને ખીચડી ખાઓ'],
      ['सूर्य मकर राशि में प्रवेश करते हैं: दिन बड़े होने लगते हैं। पुण्य काल में दान विशेष फलदायी है।', 'स्नान करके सूर्य को अर्घ्य दें', 'पुण्य काल में तिल, गुड़ और अन्न का दान करें', 'तिल-गुड़ और खिचड़ी खाएँ']),
    uttarayan: I(['Gujarat’s kite festival, as the Sun turns north.', 'Offer arghya to Surya and give daan in the punya kaal', 'Fly kites from the terrace with family', 'Eat undhiyu, chikki and jalebi'],
      ['સૂર્ય ઉત્તર તરફ વળે ત્યારે ગુજરાતનો પતંગોત્સવ.', 'પુણ્ય કાળમાં સૂર્યને અર્ઘ્ય અને દાન આપો', 'કુટુંબ સાથે અગાસી પર પતંગ ચગાવો', 'ઊંધિયું, ચીક્કી અને જલેબી ખાઓ'],
      ['सूर्य के उत्तर की ओर मुड़ने पर गुजरात का पतंग उत्सव।', 'पुण्य काल में सूर्य को अर्घ्य और दान दें', 'परिवार के साथ छत पर पतंग उड़ाएँ', 'उंधियू, चिक्की और जलेबी खाएँ']),
    vasiuttarayan: I(['The second day of kites, the day after Uttarayan.', 'Fly kites again from the terrace', 'Eat the leftover undhiyu with family', 'Give to cows and birds'],
      ['પતંગોનો બીજો દિવસ, ઉત્તરાયણ પછીનો દિવસ.', 'ફરી અગાસી પર પતંગ ચગાવો', 'કુટુંબ સાથે વાસી ઊંધિયું ખાઓ', 'ગાય અને પક્ષીઓને ચણ આપો'],
      ['पतंगों का दूसरा दिन, उत्तरायण के अगले दिन।', 'फिर छत पर पतंग उड़ाएँ', 'परिवार के साथ उंधियू खाएँ', 'गाय और पक्षियों को दाना दें']),
    ekadashi: I(['Vishnu’s fast, on the eleventh tithi of each paksha. The fast is broken on Dwadashi in the parana window.', 'Fast from sunrise: no grains or beans', 'Worship Vishnu with tulsi and read or hear the Ekadashi katha', 'Break the fast in the parana window tomorrow'],
      ['દરેક પક્ષની અગિયારમી તિથિએ વિષ્ણુનો ઉપવાસ. પારણાં બારસે પારણાંના સમયમાં થાય.', 'સૂર્યોદયથી ઉપવાસ: અનાજ અને કઠોળ નહીં', 'તુલસીથી વિષ્ણુ પૂજા કરો અને અગિયારસની કથા વાંચો', 'કાલે પારણાંના સમયમાં ઉપવાસ છોડો'],
      ['हर पक्ष की ग्यारहवीं तिथि पर विष्णु का व्रत। पारण द्वादशी को पारण के समय में होता है।', 'सूर्योदय से व्रत: अन्न और दालें नहीं', 'तुलसी से विष्णु पूजा करें और एकादशी कथा पढ़ें', 'कल पारण के समय में व्रत खोलें']),
    purnima: I(['The full moon. A day for Satyanarayan katha, daan and a bath in sacred water.', 'Bathe early and give daan', 'Do the Satyanarayan katha or Vishnu puja', 'Offer arghya to the Moon after moonrise'],
      ['પૂનમ. સત્યનારાયણની કથા, દાન અને પવિત્ર સ્નાનનો દિવસ.', 'વહેલું સ્નાન કરી દાન આપો', 'સત્યનારાયણની કથા કે વિષ્ણુ પૂજા કરો', 'ચંદ્રોદય પછી ચંદ્રને અર્ઘ્ય આપો'],
      ['पूर्णिमा। सत्यनारायण कथा, दान और पवित्र स्नान का दिन।', 'जल्दी स्नान करके दान दें', 'सत्यनारायण कथा या विष्णु पूजा करें', 'चंद्रोदय के बाद चंद्रमा को अर्घ्य दें']),
    amavasya: I(['The new moon: a day for the ancestors and for quiet, not for new beginnings.', 'Offer water and sesame to the ancestors', 'Light a lamp under a peepal tree in the evening', 'Keep new starts for another day'],
      ['અમાસ: પિતૃઓ અને શાંતિનો દિવસ, નવી શરૂઆતનો નહીં.', 'પિતૃઓને જળ અને તલ અર્પણ કરો', 'સાંજે પીપળા નીચે દીવો કરો', 'નવી શરૂઆત બીજા દિવસે રાખો'],
      ['अमावस्या: पितरों और शांति का दिन, नई शुरुआत का नहीं।', 'पितरों को जल और तिल अर्पित करें', 'शाम को पीपल के नीचे दीपक जलाएँ', 'नई शुरुआत किसी और दिन रखें']),
    sankashti: I(['Ganesh’s fast to remove obstacles, broken at moonrise.', 'Fast through the day', 'Worship Ganesh with durva and modak in the evening', 'See the Moon at moonrise, offer arghya, then eat'],
      ['વિઘ્ન દૂર કરવા ગણેશજીનો ઉપવાસ, ચંદ્રોદયે છોડાય.', 'આખો દિવસ ઉપવાસ રાખો', 'સાંજે દૂર્વા અને મોદકથી ગણેશ પૂજા કરો', 'ચંદ્રોદયે ચંદ્રદર્શન કરી અર્ઘ્ય આપો, પછી જમો'],
      ['विघ्न दूर करने के लिए गणेश का व्रत, चंद्रोदय पर खुलता है।', 'पूरे दिन व्रत रखें', 'शाम को दूर्वा और मोदक से गणेश पूजा करें', 'चंद्रोदय पर चंद्र दर्शन करके अर्घ्य दें, फिर भोजन करें']),
    vinayaka: I(['Ganesh’s monthly day in the bright fortnight, worshipped at midday.', 'Worship Ganesh in the madhyahna window', 'Offer durva and modak', 'Avoid seeing the Moon tonight'],
      ['સુદ પક્ષમાં ગણેશજીનો માસિક દિવસ, બપોરે પૂજા.', 'મધ્યાહ્નમાં ગણેશ પૂજા કરો', 'દૂર્વા અને મોદક ધરાવો', 'આજે રાત્રે ચંદ્ર જોવાનું ટાળો'],
      ['शुक्ल पक्ष में गणेश का मासिक दिन, मध्याह्न में पूजा।', 'मध्याह्न में गणेश पूजा करें', 'दूर्वा और मोदक अर्पित करें', 'आज रात चंद्रमा देखने से बचें']),
    pradosh: I(['Shiva’s twilight fast on Trayodashi, kept in pradosh after sunset.', 'Fast through the day', 'Worship Shiva in the pradosh window after sunset', 'Offer bilva leaves and light a lamp'],
      ['તેરસે સંધ્યાકાળે શિવનો ઉપવાસ, સૂર્યાસ્ત પછી પ્રદોષમાં પૂજા.', 'આખો દિવસ ઉપવાસ રાખો', 'સૂર્યાસ્ત પછી પ્રદોષમાં શિવ પૂજા કરો', 'બીલીપત્ર ચડાવો અને દીવો કરો'],
      ['त्रयोदशी को संध्या में शिव का व्रत, सूर्यास्त के बाद प्रदोष में पूजा।', 'पूरे दिन व्रत रखें', 'सूर्यास्त के बाद प्रदोष में शिव पूजा करें', 'बेलपत्र चढ़ाएँ और दीप जलाएँ']),
    masikshivratri: I(['Shiva’s monthly night, on Krishna Chaturdashi.', 'Fast through the day', 'Offer water and bilva leaves to the Shivling', 'Chant Om Namah Shivaya in nishita kaal'],
      ['વદ ચૌદશે શિવની માસિક રાત્રિ.', 'આખો દિવસ ઉપવાસ રાખો', 'શિવલિંગ પર જળ અને બીલીપત્ર ચડાવો', 'નિશીથ કાળમાં “ૐ નમઃ શિવાય” જપો'],
      ['कृष्ण चतुर्दशी को शिव की मासिक रात्रि।', 'पूरे दिन व्रत रखें', 'शिवलिंग पर जल और बेलपत्र चढ़ाएँ', 'निशीथ काल में “ॐ नमः शिवाय” जपें']),
    chandragrahan: I(['An eclipse of the Moon visible from your place. Sutak begins nine hours before.', 'Do not cook or eat during sutak; put tulsi in stored food', 'Chant and meditate while the eclipse runs', 'After it ends, bathe, give daan and resume puja'],
      ['તમારા સ્થળેથી દેખાતું ચંદ્ર ગ્રહણ. સૂતક નવ કલાક પહેલાં શરૂ થાય.', 'સૂતકમાં રસોઈ કે ભોજન નહીં; રાખેલા ભોજનમાં તુલસી મૂકો', 'ગ્રહણ દરમિયાન જપ અને ધ્યાન કરો', 'ગ્રહણ પછી સ્નાન, દાન અને પૂજા કરો'],
      ['आपके स्थान से दिखने वाला चंद्र ग्रहण। सूतक नौ घंटे पहले शुरू होता है।', 'सूतक में खाना न पकाएँ न खाएँ; रखे भोजन में तुलसी डालें', 'ग्रहण के दौरान जप और ध्यान करें', 'ग्रहण के बाद स्नान, दान और पूजा करें']),
    suryagrahan: I(['An eclipse of the Sun visible from your place. Sutak begins twelve hours before.', 'Do not cook or eat during sutak', 'Never look at the Sun directly; chant and meditate', 'After it ends, bathe, give daan and resume puja'],
      ['તમારા સ્થળેથી દેખાતું સૂર્ય ગ્રહણ. સૂતક બાર કલાક પહેલાં શરૂ થાય.', 'સૂતકમાં રસોઈ કે ભોજન નહીં', 'સૂર્ય સામે સીધું ન જુઓ; જપ અને ધ્યાન કરો', 'ગ્રહણ પછી સ્નાન, દાન અને પૂજા કરો'],
      ['आपके स्थान से दिखने वाला सूर्य ग्रहण। सूतक बारह घंटे पहले शुरू होता है।', 'सूतक में खाना न पकाएँ न खाएँ', 'सूर्य को सीधे न देखें; जप और ध्यान करें', 'ग्रहण के बाद स्नान, दान और पूजा करें'])
  };
  /* What an observance is and how it is kept, in the reader's language; null when Soma has nothing written for it. */
  const infoOf = (f, lang) => { const x = f && INFO[f.key]; return x ? (x[lang] || x.en) : null; };

  const api = { PUJA, pujaOf, INFO, infoOf, FESTIVALS, VRATS, EKADASHI, SETS, defaultSets, defaultMonthSystem, list, visible, upcoming, parana, samples, lunations, findDays };
  if (typeof module !== 'undefined') module.exports = api;
  root.Festivals = api;
  // Read by the home-screen widget feed when present.
  root.SomaFestivals = { upcoming: (loc, fromDay, days) => upcoming(loc, fromDay, days, root.SomaFestivalSets) };
})(typeof window !== 'undefined' ? window : globalThis);
