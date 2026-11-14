/* Interface language: English, ગુજરાતી, हिन्दी. Panchang names come from Kaal and Meanings; this file holds screen text. */
(function (root) {
  const M = typeof Meanings !== 'undefined' ? Meanings : require('./meanings.js');
  const STR = {
    en: {
      today: 'Today', calendar: 'Calendar', muhurat: 'Muhurat', moon: 'Moon', personal: 'Me', learn: 'Learn',
      todayTitle: 'Today’s Panchang', goodFor: 'Good for', avoid: 'Avoid', rahu: 'Rahu Kaal', yamaganda: 'Yamaganda', gulika: 'Gulika Kaal',
      abhijit: 'Abhijit Muhurat', brahma: 'Brahma Muhurat', sunrise: 'Sunrise', sunset: 'Sunset', moonrise: 'Moonrise', moonset: 'Moonset',
      tithi: 'Tithi', nakshatra: 'Nakshatra', yoga: 'Yoga', karana: 'Karana', vaar: 'Vaar', until: 'until', from: 'from', now: 'Now',
      choghadiya: 'Choghadiya', hora: 'Hora', day: 'Day', night: 'Night', nextGood: 'Next good time', festivalsToday: 'Today’s observance',
      comingUp: 'Coming up', inDays: 'in {n} days', tomorrow: 'tomorrow', todayWord: 'today', parana: 'Parana (break the fast)',
      fastBegins: 'The fast begins at sunrise', whatToday: 'What are you doing today?', bestTimes: 'Best times today', deityOfDay: 'Deity of the day',
      mantra: 'Mantra', forYou: 'For you today', chandrabalam: 'Chandrabalam', tarabalam: 'Tarabalam', favourable: 'Favourable', mixed: 'Mixed', takeCare: 'Take care',
      good: 'Shubh', neutral: 'Neutral', bad: 'Avoid', planEvent: 'Plan an event on this day', addEvent: 'Add event', myPlans: 'My plans',
      sets: { gujarati: 'Gujarati', india: 'Pan-Indian', international: 'International', vrat: 'Vrat days' },
      month: 'Lunar month', samvat: 'Vikram Samvat', amanta: 'Amanta (Gujarat, Maharashtra, South)', purnimanta: 'Purnimanta (North India)',
      settings: 'Settings', language: 'Language', monthSystem: 'Month system', festivalSets: 'Festivals to show', reminders: 'Reminders',
      remVrat: 'Evening before each vrat and festival', remParana: 'When the parana window opens', remDaily: 'Daily panchang at sunrise', remRahu: 'When Rahu Kaal begins',
      location: 'Location', save: 'Save', findMuhurat: 'Find a muhurat', eventType: 'What are you planning?', goodDays: 'Good days in the next 60 days',
      noGoodDays: 'No strong muhurat in this period. Try a longer journey of days or ask your family priest.', checkTime: 'Timing check',
      useTime: 'Use this time', loading: 'Calculating…', allYear: 'All festivals this year', personalDays: 'Your favourable days this month',
      janmaRashi: 'Janma rashi', janmaNak: 'Janma nakshatra', none: 'Nothing special', learnMore: 'Learn the panchang', method: 'How Soma calculates'
    },
    gu: {
      today: 'આજ', calendar: 'પંચાંગ', muhurat: 'મુહૂર્ત', moon: 'ચંદ્ર', personal: 'મારું', learn: 'જ્ઞાન',
      todayTitle: 'આજનું પંચાંગ', goodFor: 'શુભ કાર્ય', avoid: 'ટાળો', rahu: 'રાહુ કાળ', yamaganda: 'યમઘંટ', gulika: 'ગુલિક કાળ',
      abhijit: 'અભિજિત મુહૂર્ત', brahma: 'બ્રહ્મ મુહૂર્ત', sunrise: 'સૂર્યોદય', sunset: 'સૂર્યાસ્ત', moonrise: 'ચંદ્રોદય', moonset: 'ચંદ્રાસ્ત',
      tithi: 'તિથિ', nakshatra: 'નક્ષત્ર', yoga: 'યોગ', karana: 'કરણ', vaar: 'વાર', until: 'સુધી', from: 'થી', now: 'અત્યારે',
      choghadiya: 'ચોઘડિયું', hora: 'હોરા', day: 'દિવસ', night: 'રાત', nextGood: 'આગળનો શુભ સમય', festivalsToday: 'આજનો તહેવાર',
      comingUp: 'આવનારા દિવસો', inDays: '{n} દિવસમાં', tomorrow: 'કાલે', todayWord: 'આજે', parana: 'પારણાં',
      fastBegins: 'ઉપવાસ સૂર્યોદયથી શરૂ', whatToday: 'આજે શું કરવું છે?', bestTimes: 'આજના શુભ સમય', deityOfDay: 'આજના દેવ',
      mantra: 'મંત્ર', forYou: 'તમારા માટે આજે', chandrabalam: 'ચંદ્રબળ', tarabalam: 'તારાબળ', favourable: 'શુભ', mixed: 'મિશ્ર', takeCare: 'સાવધાન',
      good: 'શુભ', neutral: 'સામાન્ય', bad: 'અશુભ', planEvent: 'આ દિવસે કાર્ય નક્કી કરો', addEvent: 'કાર્ય ઉમેરો', myPlans: 'મારા કાર્યક્રમ',
      sets: { gujarati: 'ગુજરાતી', india: 'ભારતીય', international: 'આંતરરાષ્ટ્રીય', vrat: 'વ્રત' },
      month: 'માસ', samvat: 'વિક્રમ સંવત', amanta: 'અમાંત (ગુજરાત, મહારાષ્ટ્ર, દક્ષિણ)', purnimanta: 'પૂર્ણિમાંત (ઉત્તર ભારત)',
      settings: 'સેટિંગ્સ', language: 'ભાષા', monthSystem: 'માસ પદ્ધતિ', festivalSets: 'કયા તહેવાર બતાવવા', reminders: 'યાદ અપાવો',
      remVrat: 'દરેક વ્રત અને તહેવારની આગલી સાંજે', remParana: 'પારણાંનો સમય શરૂ થાય ત્યારે', remDaily: 'રોજ સૂર્યોદયે પંચાંગ', remRahu: 'રાહુ કાળ શરૂ થાય ત્યારે',
      location: 'સ્થાન', save: 'સાચવો', findMuhurat: 'મુહૂર્ત શોધો', eventType: 'શું આયોજન છે?', goodDays: 'આગામી 60 દિવસના શુભ દિવસ',
      noGoodDays: 'આ સમયમાં સારું મુહૂર્ત નથી. કુટુંબના ગોરમહારાજને પૂછો.', checkTime: 'સમય તપાસ',
      useTime: 'આ સમય રાખો', loading: 'ગણતરી ચાલે છે…', allYear: 'આ વર્ષના બધા તહેવાર', personalDays: 'આ મહિને તમારા શુભ દિવસ',
      janmaRashi: 'જન્મ રાશિ', janmaNak: 'જન્મ નક્ષત્ર', none: 'વિશેષ કંઈ નથી', learnMore: 'પંચાંગ સમજો', method: 'સોમ કેવી રીતે ગણે છે'
    },
    hi: {
      today: 'आज', calendar: 'पंचांग', muhurat: 'मुहूर्त', moon: 'चंद्र', personal: 'मेरा', learn: 'ज्ञान',
      todayTitle: 'आज का पंचांग', goodFor: 'शुभ कार्य', avoid: 'टालें', rahu: 'राहु काल', yamaganda: 'यमगण्ड', gulika: 'गुलिक काल',
      abhijit: 'अभिजित मुहूर्त', brahma: 'ब्रह्म मुहूर्त', sunrise: 'सूर्योदय', sunset: 'सूर्यास्त', moonrise: 'चंद्रोदय', moonset: 'चंद्रास्त',
      tithi: 'तिथि', nakshatra: 'नक्षत्र', yoga: 'योग', karana: 'करण', vaar: 'वार', until: 'तक', from: 'से', now: 'अभी',
      choghadiya: 'चौघड़िया', hora: 'होरा', day: 'दिन', night: 'रात', nextGood: 'अगला शुभ समय', festivalsToday: 'आज का पर्व',
      comingUp: 'आने वाले दिन', inDays: '{n} दिन में', tomorrow: 'कल', todayWord: 'आज', parana: 'पारण',
      fastBegins: 'व्रत सूर्योदय से आरंभ', whatToday: 'आज क्या करना है?', bestTimes: 'आज के शुभ समय', deityOfDay: 'आज के देवता',
      mantra: 'मंत्र', forYou: 'आपके लिए आज', chandrabalam: 'चंद्रबल', tarabalam: 'ताराबल', favourable: 'शुभ', mixed: 'मिश्र', takeCare: 'सावधान',
      good: 'शुभ', neutral: 'सामान्य', bad: 'अशुभ', planEvent: 'इस दिन कार्य तय करें', addEvent: 'कार्य जोड़ें', myPlans: 'मेरे कार्यक्रम',
      sets: { gujarati: 'गुजराती', india: 'भारतीय', international: 'अंतर्राष्ट्रीय', vrat: 'व्रत' },
      month: 'मास', samvat: 'विक्रम संवत', amanta: 'अमांत (गुजरात, महाराष्ट्र, दक्षिण)', purnimanta: 'पूर्णिमांत (उत्तर भारत)',
      settings: 'सेटिंग्स', language: 'भाषा', monthSystem: 'मास पद्धति', festivalSets: 'कौन से पर्व दिखाएँ', reminders: 'याद दिलाएँ',
      remVrat: 'हर व्रत और पर्व की पिछली शाम', remParana: 'पारण का समय शुरू होने पर', remDaily: 'रोज़ सूर्योदय पर पंचांग', remRahu: 'राहु काल शुरू होने पर',
      location: 'स्थान', save: 'सहेजें', findMuhurat: 'मुहूर्त खोजें', eventType: 'क्या योजना है?', goodDays: 'अगले 60 दिनों के शुभ दिन',
      noGoodDays: 'इस अवधि में अच्छा मुहूर्त नहीं है। अपने कुल पुरोहित से पूछें।', checkTime: 'समय जाँच',
      useTime: 'यह समय रखें', loading: 'गणना हो रही है…', allYear: 'इस वर्ष के सभी पर्व', personalDays: 'इस महीने आपके शुभ दिन',
      janmaRashi: 'जन्म राशि', janmaNak: 'जन्म नक्षत्र', none: 'कुछ विशेष नहीं', learnMore: 'पंचांग समझें', method: 'सोम कैसे गणना करता है'
    }
  };
  const MONTHS = {
    en: ['Chaitra', 'Vaishakh', 'Jyeshtha', 'Ashadh', 'Shravan', 'Bhadrapad', 'Ashvin', 'Kartik', 'Margashirsha', 'Paush', 'Magh', 'Phalgun'],
    gu: ['ચૈત્ર', 'વૈશાખ', 'જેઠ', 'અષાઢ', 'શ્રાવણ', 'ભાદરવો', 'આસો', 'કારતક', 'માગશર', 'પોષ', 'મહા', 'ફાગણ'],
    hi: ['चैत्र', 'वैशाख', 'ज्येष्ठ', 'आषाढ़', 'श्रावण', 'भाद्रपद', 'आश्विन', 'कार्तिक', 'मार्गशीर्ष', 'पौष', 'माघ', 'फाल्गुन']
  };
  const ADHIK = { en: 'Adhik', gu: 'અધિક', hi: 'अधिक' };
  const PAKSHA = { en: ['Shukla', 'Krishna'], gu: ['સુદ', 'વદ'], hi: ['शुक्ल', 'कृष्ण'] };
  const GU_TITHI = ['પડવો', 'બીજ', 'ત્રીજ', 'ચોથ', 'પાંચમ', 'છઠ', 'સાતમ', 'આઠમ', 'નોમ', 'દશમ', 'અગિયારસ', 'બારસ', 'તેરસ', 'ચૌદશ', 'પૂનમ'];
  const GU_NAK = ['અશ્વિની', 'ભરણી', 'કૃત્તિકા', 'રોહિણી', 'મૃગશીર્ષ', 'આર્દ્રા', 'પુનર્વસુ', 'પુષ્ય', 'આશ્લેષા', 'મઘા', 'પૂર્વા ફાલ્ગુની', 'ઉત્તરા ફાલ્ગુની', 'હસ્ત', 'ચિત્રા', 'સ્વાતિ', 'વિશાખા', 'અનુરાધા', 'જ્યેષ્ઠા', 'મૂળ', 'પૂર્વાષાઢા', 'ઉત્તરાષાઢા', 'શ્રવણ', 'ધનિષ્ઠા', 'શતભિષા', 'પૂર્વા ભાદ્રપદા', 'ઉત્તરા ભાદ્રપદા', 'રેવતી'];

  function make(lang) {
    const L = STR[lang] ? lang : 'en', s = STR[L];
    const t = (key, vars) => { let v = s[key] != null ? s[key] : STR.en[key]; if (vars) for (const k in vars) v = v.replace('{' + k + '}', vars[k]); return v; };
    const pick = o => o[L] || o.en;
    return {
      lang: L, t, s,
      tithiName(index) {
        if (index === 29) return L === 'gu' ? 'અમાસ' : M.tithi(29)[L === 'hi' ? 'hi' : 'en'];
        const m = M.tithi(index), name = L === 'gu' ? GU_TITHI[index % 15] : L === 'hi' ? m.hi : m.en;
        return index === 14 ? name : PAKSHA[L][index >= 15 ? 1 : 0] + ' ' + name;
      },
      nakName(index) { const n = M.nakshatra(index); return L === 'gu' ? GU_NAK[index] : L === 'hi' ? n.hi : n.en; },
      yogaName(index) { return pick(M.YOGA[index]); },
      karanaName(index) { return pick(M.KARANA[index]); },
      vaarName(index) { return pick(M.VAAR[index]); },
      chogName(key) { return pick(M.CHOG[key]); },
      planetName(key) { return pick(M.PLANET[key]); },
      rashiName(index) { return pick(M.RASHI[index]); },
      practiceName(p) { return pick(p); },
      festName(f) { return L === 'en' ? f.en : (f[L] || f.en); },
      monthNames: { months: MONTHS[L], adhik: ADHIK[L] },
      nature(n) { return n === 'good' ? s.good : n === 'bad' ? s.bad : n === 'mixed' ? s.mixed : s.neutral; }
    };
  }
  const api = { make, STR, MONTHS };
  if (typeof module !== 'undefined') module.exports = api;
  root.I18n = api;
})(typeof window !== 'undefined' ? window : globalThis);
