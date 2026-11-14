/* Meaning of each panchang element, written from the tradition (Muhurta Chintamani groupings and common
 * panchang practice). Names in English transliteration, Gujarati and Hindi; guidance text in English for now. */
(function (root) {
  // Tithi groups (Nanda, Bhadra, Jaya, Rikta, Purna) repeat every five tithis.
  const TITHI_GROUP = {
    nanda: { en: 'Nanda (joyful)', nature: 'good', good: 'celebrations, music, arts, family gatherings', avoid: 'harsh words and quarrels' },
    bhadra: { en: 'Bhadra (steady)', nature: 'good', good: 'buying, travel, routine work, starting steady projects', avoid: 'rushed decisions' },
    jaya: { en: 'Jaya (victorious)', nature: 'good', good: 'competition, courage, legal matters, physical effort', avoid: 'starting delicate or gentle work' },
    rikta: { en: 'Rikta (empty)', nature: 'bad', good: 'clearing obstacles, cleaning, ending what no longer serves', avoid: 'new beginnings, purchases and ceremonies' },
    purna: { en: 'Purna (complete)', nature: 'good', good: 'completing work, all auspicious ceremonies', avoid: 'leaving things half done' }
  };
  const GROUPS = ['nanda', 'bhadra', 'jaya', 'rikta', 'purna'];
  const TITHI = [
    { en: 'Pratipada', hi: 'प्रतिपदा', deity: 'Agni', note: 'A fresh start of the fortnight.' },
    { en: 'Dwitiya', hi: 'द्वितीया', deity: 'Brahma', note: 'Good for laying foundations.' },
    { en: 'Tritiya', hi: 'तृतीया', deity: 'Gauri', note: 'Favoured for beauty, music and blessings for the household.' },
    { en: 'Chaturthi', hi: 'चतुर्थी', deity: 'Ganesha', note: 'Worship Ganesha to remove obstacles.' },
    { en: 'Panchami', hi: 'पंचमी', deity: 'Naga devata', note: 'Good for learning, medicine and healing.' },
    { en: 'Shashthi', hi: 'षष्ठी', deity: 'Kartikeya', note: 'Good for courage, health of children and festive work.' },
    { en: 'Saptami', hi: 'सप्तमी', deity: 'Surya', note: 'Good for travel, vehicles and offering arghya to the Sun.' },
    { en: 'Ashtami', hi: 'अष्टमी', deity: 'Shiva (Rudra)', note: 'Devi and Shiva worship; good for strong, protective work.' },
    { en: 'Navami', hi: 'नवमी', deity: 'Durga', note: 'Devi worship; avoid auspicious beginnings.' },
    { en: 'Dashami', hi: 'दशमी', deity: 'Yama', note: 'Good for righteous, lasting work and travel.' },
    { en: 'Ekadashi', hi: 'एकादशी', deity: 'Vishnu', note: 'Fast and remember Vishnu. Ideal for japa and simple living.' },
    { en: 'Dwadashi', hi: 'द्वादशी', deity: 'Vishnu (Hari)', note: 'Break the Ekadashi fast within the parana time; good for charity.' },
    { en: 'Trayodashi', hi: 'त्रयोदशी', deity: 'Kamadeva', note: 'Pradosh: worship Shiva at dusk. Good for friendship and joy.' },
    { en: 'Chaturdashi', hi: 'चतुर्दशी', deity: 'Shiva (Kali)', note: 'Shiva worship; avoid new beginnings.' },
    { en: 'Purnima', hi: 'पूर्णिमा', deity: 'Chandra', note: 'Purnima vrat, Satyanarayan katha and charity. Good for all ceremonies.' }
  ];
  const AMAVASYA = { en: 'Amavasya', hi: 'अमावस्या', deity: 'Pitru (ancestors)', note: 'Offer tarpan to ancestors, give charity and keep quiet. Avoid new beginnings.', nature: 'bad', good: 'remembering ancestors, charity, meditation', avoid: 'new beginnings, purchases, travel' };
  /* index 0-29 (0 = Shukla Pratipada, 14 = Purnima, 15 = Krishna Pratipada, 29 = Amavasya). */
  function tithi(index) {
    if (index === 29) return Object.assign({ group: 'Amavasya' }, AMAVASYA);
    const base = TITHI[index % 15], g = TITHI_GROUP[GROUPS[index % 5]];
    return Object.assign({}, base, { group: g.en, nature: g.nature, good: g.good, avoid: g.avoid, krishna: index >= 15 });
  }

  // Nakshatra classes from the Muhurta tradition.
  const NAK_KIND = {
    dhruva: { en: 'Dhruva (fixed)', nature: 'good', good: 'foundations, griha pravesh, planting, long-term commitments' },
    chara: { en: 'Chara (movable)', nature: 'good', good: 'travel, vehicles, change of residence, gardening' },
    kshipra: { en: 'Kshipra (swift)', nature: 'good', good: 'trade, medicine, learning, short journeys, quick tasks' },
    mridu: { en: 'Mridu (gentle)', nature: 'good', good: 'arts, friendship, new clothes, music, romance' },
    mishra: { en: 'Mishra (mixed)', nature: 'mixed', good: 'routine work, fire rituals, daily duties' },
    ugra: { en: 'Ugra (fierce)', nature: 'bad', good: 'bold or difficult tasks', avoid: 'auspicious ceremonies and new ventures' },
    tikshna: { en: 'Tikshna (sharp)', nature: 'bad', good: 'ending ties, removing obstacles, spiritual discipline', avoid: 'weddings, purchases and new ventures' }
  };
  const NAKSHATRA = [
    ['Ashwini', 'अश्विनी', 'Ashwini Kumaras', 'kshipra'], ['Bharani', 'भरणी', 'Yama', 'ugra'], ['Krittika', 'कृत्तिका', 'Agni', 'mishra'],
    ['Rohini', 'रोहिणी', 'Brahma', 'dhruva'], ['Mrigashira', 'मृगशिरा', 'Soma', 'mridu'], ['Ardra', 'आर्द्रा', 'Rudra', 'tikshna'],
    ['Punarvasu', 'पुनर्वसु', 'Aditi', 'chara'], ['Pushya', 'पुष्य', 'Brihaspati', 'kshipra'], ['Ashlesha', 'आश्लेषा', 'Naga', 'tikshna'],
    ['Magha', 'मघा', 'Pitru', 'ugra'], ['Purva Phalguni', 'पूर्वा फाल्गुनी', 'Bhaga', 'ugra'], ['Uttara Phalguni', 'उत्तरा फाल्गुनी', 'Aryaman', 'dhruva'],
    ['Hasta', 'हस्त', 'Savitr', 'kshipra'], ['Chitra', 'चित्रा', 'Vishwakarma', 'mridu'], ['Swati', 'स्वाति', 'Vayu', 'chara'],
    ['Vishakha', 'विशाखा', 'Indra and Agni', 'mishra'], ['Anuradha', 'अनुराधा', 'Mitra', 'mridu'], ['Jyeshtha', 'ज्येष्ठा', 'Indra', 'tikshna'],
    ['Mula', 'मूल', 'Nirriti', 'tikshna'], ['Purva Ashadha', 'पूर्वाषाढ़ा', 'Apas (waters)', 'ugra'], ['Uttara Ashadha', 'उत्तराषाढ़ा', 'Vishvedevas', 'dhruva'],
    ['Shravana', 'श्रवण', 'Vishnu', 'chara'], ['Dhanishta', 'धनिष्ठा', 'Ashta Vasus', 'chara'], ['Shatabhisha', 'शतभिषा', 'Varuna', 'chara'],
    ['Purva Bhadrapada', 'पूर्वा भाद्रपद', 'Aja Ekapada', 'ugra'], ['Uttara Bhadrapada', 'उत्तरा भाद्रपद', 'Ahir Budhnya', 'dhruva'], ['Revati', 'रेवती', 'Pushan', 'mridu']
  ];
  function nakshatra(index) {
    const n = NAKSHATRA[index], k = NAK_KIND[n[3]];
    return { en: n[0], hi: n[1], deity: n[2], kind: n[3], group: k.en, nature: k.nature, good: k.good, avoid: k.avoid || 'nothing in particular' };
  }

  const YOGA = [
    ['Vishkambha', 'વિષ્કંભ', 'विष्कम्भ', 'bad'], ['Priti', 'પ્રીતિ', 'प्रीति', 'good'], ['Ayushman', 'આયુષ્માન', 'आयुष्मान', 'good'],
    ['Saubhagya', 'સૌભાગ્ય', 'सौभाग्य', 'good'], ['Shobhana', 'શોભન', 'शोभन', 'good'], ['Atiganda', 'અતિગંડ', 'अतिगण्ड', 'bad'],
    ['Sukarma', 'સુકર્મા', 'सुकर्मा', 'good'], ['Dhriti', 'ધૃતિ', 'धृति', 'good'], ['Shula', 'શૂલ', 'शूल', 'bad'],
    ['Ganda', 'ગંડ', 'गण्ड', 'bad'], ['Vriddhi', 'વૃદ્ધિ', 'वृद्धि', 'good'], ['Dhruva', 'ધ્રુવ', 'ध्रुव', 'good'],
    ['Vyaghata', 'વ્યાઘાત', 'व्याघात', 'bad'], ['Harshana', 'હર્ષણ', 'हर्षण', 'good'], ['Vajra', 'વજ્ર', 'वज्र', 'bad'],
    ['Siddhi', 'સિદ્ધિ', 'सिद्धि', 'good'], ['Vyatipata', 'વ્યતિપાત', 'व्यतीपात', 'bad'], ['Variyana', 'વરીયાન', 'वरीयान', 'good'],
    ['Parigha', 'પરિઘ', 'परिघ', 'bad'], ['Shiva', 'શિવ', 'शिव', 'good'], ['Siddha', 'સિદ્ધ', 'सिद्ध', 'good'],
    ['Sadhya', 'સાધ્ય', 'साध्य', 'good'], ['Shubha', 'શુભ', 'शुभ', 'good'], ['Shukla', 'શુક્લ', 'शुक्ल', 'good'],
    ['Brahma', 'બ્રહ્મ', 'ब्रह्म', 'good'], ['Indra', 'ઇન્દ્ર', 'इन्द्र', 'good'], ['Vaidhriti', 'વૈધૃતિ', 'वैधृति', 'bad']
  ].map(y => ({ en: y[0], gu: y[1], hi: y[2], nature: y[3] }));

  const KARANA = [
    ['Bava', 'બવ', 'बव', 'good'], ['Balava', 'બાલવ', 'बालव', 'good'], ['Kaulava', 'કૌલવ', 'कौलव', 'good'], ['Taitila', 'તૈતિલ', 'तैतिल', 'good'],
    ['Gara', 'ગર', 'गर', 'good'], ['Vanija', 'વણિજ', 'वणिज', 'good'], ['Vishti (Bhadra)', 'વિષ્ટિ (ભદ્રા)', 'विष्टि (भद्रा)', 'bad'],
    ['Shakuni', 'શકુનિ', 'शकुनि', 'bad'], ['Chatushpada', 'ચતુષ્પાદ', 'चतुष्पाद', 'bad'], ['Naga', 'નાગ', 'नाग', 'bad'], ['Kimstughna', 'કિંસ્તુઘ્ન', 'किंस्तुघ्न', 'good']
  ].map(k => ({ en: k[0], gu: k[1], hi: k[2], nature: k[3] }));

  const VAAR = [
    { en: 'Ravivar', gu: 'રવિવાર', hi: 'रविवार', lord: 'sun', deity: 'Surya', mantra: 'ॐ घृणि सूर्याय नमः', good: 'government work, authority, health, offering water to the Sun', avoid: 'starting long journeys west' },
    { en: 'Somvar', gu: 'સોમવાર', hi: 'सोमवार', lord: 'moon', deity: 'Shiva', mantra: 'ॐ नमः शिवाय', good: 'Shiva puja, travel, home, family, arts', avoid: 'harsh or violent work' },
    { en: 'Mangalvar', gu: 'મંગળવાર', hi: 'मंगलवार', lord: 'mars', deity: 'Hanuman', mantra: 'ॐ हं हनुमते नमः', good: 'courage, property matters, sport, Hanuman Chalisa', avoid: 'lending money, haircuts, new ventures' },
    { en: 'Budhvar', gu: 'બુધવાર', hi: 'बुधवार', lord: 'mercury', deity: 'Ganesha', mantra: 'ॐ गं गणपतये नमः', good: 'learning, trade, writing, accounts, communication', avoid: 'nothing in particular' },
    { en: 'Guruvar', gu: 'ગુરુવાર', hi: 'गुरुवार', lord: 'jupiter', deity: 'Vishnu', mantra: 'ॐ नमो भगवते वासुदेवाय', good: 'study, religious rites, meeting teachers, charity', avoid: 'haircuts and nail cutting' },
    { en: 'Shukravar', gu: 'શુક્રવાર', hi: 'शुक्रवार', lord: 'venus', deity: 'Lakshmi', mantra: 'ॐ श्रीं महालक्ष्म्यै नमः', good: 'arts, jewellery, clothes, relationships, Lakshmi puja', avoid: 'quarrels at home' },
    { en: 'Shanivar', gu: 'શનિવાર', hi: 'शनिवार', lord: 'saturn', deity: 'Shani and Hanuman', mantra: 'ॐ शं शनैश्चराय नमः', good: 'hard work, service, donating oil or black sesame', avoid: 'buying iron or oil, starting new ventures' }
  ];

  const CHOG = {
    udveg: { en: 'Udveg', gu: 'ઉદ્વેગ', hi: 'उद्वेग', good: 'government work only' },
    char: { en: 'Char', gu: 'ચલ', hi: 'चर', good: 'travel and movement' },
    labh: { en: 'Labh', gu: 'લાભ', hi: 'लाभ', good: 'business, trade and gains' },
    amrit: { en: 'Amrit', gu: 'અમૃત', hi: 'अमृत', good: 'every auspicious work' },
    kaal: { en: 'Kaal', gu: 'કાળ', hi: 'काल', good: 'avoid new work' },
    shubh: { en: 'Shubh', gu: 'શુભ', hi: 'शुभ', good: 'ceremonies, puja, marriage talks' },
    rog: { en: 'Rog', gu: 'રોગ', hi: 'रोग', good: 'avoid new work' }
  };
  const PLANET = {
    sun: { en: 'Sun', gu: 'સૂર્ય', hi: 'सूर्य', good: 'government work, leadership, meeting seniors' },
    moon: { en: 'Moon', gu: 'ચંદ્ર', hi: 'चंद्र', good: 'travel, home, care, meeting people' },
    mars: { en: 'Mars', gu: 'મંગળ', hi: 'मंगल', good: 'physical effort, property, courage; avoid new ventures' },
    mercury: { en: 'Mercury', gu: 'બુધ', hi: 'बुध', good: 'study, writing, trade, communication' },
    jupiter: { en: 'Jupiter', gu: 'ગુરુ', hi: 'गुरु', good: 'puja, study, counsel, every auspicious work' },
    venus: { en: 'Venus', gu: 'શુક્ર', hi: 'शुक्र', good: 'arts, shopping, relationships, celebrations' },
    saturn: { en: 'Saturn', gu: 'શનિ', hi: 'शनि', good: 'hard labour and service; avoid new ventures' }
  };
  const RASHI = [
    ['Mesha', 'મેષ', 'मेष'], ['Vrishabha', 'વૃષભ', 'वृषभ'], ['Mithuna', 'મિથુન', 'मिथुन'], ['Karka', 'કર્ક', 'कर्क'], ['Simha', 'સિંહ', 'सिंह'], ['Kanya', 'કન્યા', 'कन्या'],
    ['Tula', 'તુલા', 'तुला'], ['Vrishchika', 'વૃશ્ચિક', 'वृश्चिक'], ['Dhanu', 'ધન', 'धनु'], ['Makara', 'મકર', 'मकर'], ['Kumbha', 'કુંભ', 'कुम्भ'], ['Meena', 'મીન', 'मीन']
  ].map(r => ({ en: r[0], gu: r[1], hi: r[2] }));
  const TARA = {
    janma: 'Janma (birth star): take care with big decisions', sampat: 'Sampat (wealth): good for gains', vipat: 'Vipat (danger): avoid risks',
    kshema: 'Kshema (well-being): good for health and comfort', pratyari: 'Pratyari (obstacles): expect resistance', sadhana: 'Sadhana (achievement): good for effort and goals',
    naidhana: 'Naidhana (destruction): avoid important starts', mitra: 'Mitra (friend): supportive day', paramMitra: 'Param Mitra (best friend): very supportive day'
  };

  /* What each everyday practice looks for in the day's timings. */
  const PRACTICES = [
    { key: 'puja', en: 'Puja', gu: 'પૂજા', hi: 'पूजा', chog: ['amrit', 'shubh'], hora: ['jupiter', 'moon', 'sun'], brahma: true },
    { key: 'japa', en: 'Japa', gu: 'જાપ', hi: 'जाप', chog: ['amrit', 'shubh'], hora: ['jupiter', 'moon'], brahma: true },
    { key: 'daan', en: 'Daan', gu: 'દાન', hi: 'दान', chog: ['shubh', 'labh', 'amrit'], hora: ['jupiter', 'venus'] },
    { key: 'vrat', en: 'Vrat', gu: 'વ્રત', hi: 'व्रत', vrat: true },
    { key: 'work', en: 'Start work', gu: 'શુભ શરૂઆત', hi: 'शुभ आरंभ', chog: ['labh', 'amrit', 'shubh'], hora: ['mercury', 'jupiter', 'venus'] },
    { key: 'travel', en: 'Travel', gu: 'પ્રવાસ', hi: 'यात्रा', chog: ['char', 'labh', 'amrit', 'shubh'], hora: ['moon', 'venus', 'mercury'] },
    { key: 'buy', en: 'Buy', gu: 'ખરીદી', hi: 'खरीदारी', chog: ['labh', 'amrit', 'shubh'], hora: ['venus', 'jupiter', 'mercury'] }
  ];

  /* Life events for the muhurat finder: which nakshatra classes, tithi groups and weekdays suit them. */
  const EVENTS = [
    { key: 'griha', en: 'Griha pravesh (house warming)', kinds: ['dhruva', 'mridu', 'chara'], weekdays: [1, 3, 4, 5], avoidTithi: ['rikta'], chaturmas: true },
    { key: 'vehicle', en: 'Buying a vehicle', kinds: ['chara', 'kshipra', 'mridu', 'dhruva'], weekdays: [1, 3, 4, 5], avoidTithi: ['rikta'] },
    { key: 'business', en: 'Opening a business', kinds: ['kshipra', 'dhruva', 'chara', 'mridu'], weekdays: [3, 4, 5], avoidTithi: ['rikta'] },
    { key: 'property', en: 'Buying property or land', kinds: ['dhruva', 'mridu'], weekdays: [1, 4, 5], avoidTithi: ['rikta'] },
    { key: 'learning', en: 'Starting study (vidyarambh)', kinds: ['kshipra', 'mridu', 'chara'], weekdays: [0, 3, 4, 5], avoidTithi: ['rikta'], kharmas: false },
    { key: 'travel', en: 'Long journey', kinds: ['chara', 'kshipra', 'mridu'], weekdays: [1, 3, 4, 5], avoidTithi: ['rikta'], kharmas: false },
    { key: 'mundan', en: 'Mundan (first haircut)', kinds: ['chara', 'kshipra', 'mridu'], weekdays: [1, 3, 4, 5], avoidTithi: ['rikta'], chaturmas: true }
  ];

  const api = { tithi, nakshatra, YOGA, KARANA, VAAR, CHOG, PLANET, RASHI, TARA, PRACTICES, EVENTS, TITHI_GROUP, NAK_KIND, GROUPS };
  if (typeof module !== 'undefined') module.exports = api;
  root.Meanings = api;
})(typeof window !== 'undefined' ? window : globalThis);
