/* Meaning of each panchang element, written from the tradition (Muhurta Chintamani groupings and common
 * panchang practice). Names in English transliteration, Gujarati and Hindi; guidance text in English with Gujarati and Hindi in TX below. */
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
  /* What the Moon's passage through each rashi supports: the sign's lord, and the Moon's own dignity (exalted in
     Vrishabha, at home in Karka, debilitated in Vrishchika). */
  const RASHI_LORD = ['mars', 'venus', 'mercury', 'moon', 'sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'saturn', 'jupiter'];
  const RASHI_GOOD = [
    'bold starts, sport and quick decisions; keep your temper',
    'the Moon is exalted: buying, money matters, food, music and anything meant to last',
    'talks, writing, trade, learning and short trips',
    'the Moon is at home: family, mother, home and caring for others; feelings run deep',
    'leadership, government work, meeting elders and being seen; keep pride in check',
    'detailed work, accounts, health routines and service',
    'partnerships, agreements, beauty, art and making peace',
    'the Moon is debilitated: sadhana, research and quiet work; avoid new ventures and arguments',
    'dharma, study, teachers, pilgrimage and long journeys',
    'steady effort, duty, long-term plans and hard work',
    'seva, community work, friends and new ideas',
    'prayer, daan, rest and pilgrimage; trust your intuition'
  ];
  const RASHI = [
    ['Mesha', 'મેષ', 'मेष'], ['Vrishabha', 'વૃષભ', 'वृषभ'], ['Mithuna', 'મિથુન', 'मिथुन'], ['Karka', 'કર્ક', 'कर्क'], ['Simha', 'સિંહ', 'सिंह'], ['Kanya', 'કન્યા', 'कन्या'],
    ['Tula', 'તુલા', 'तुला'], ['Vrishchika', 'વૃશ્ચિક', 'वृश्चिक'], ['Dhanu', 'ધન', 'धनु'], ['Makara', 'મકર', 'मकर'], ['Kumbha', 'કુંભ', 'कुम्भ'], ['Meena', 'મીન', 'मीन']
  ].map((r, i) => ({ en: r[0], gu: r[1], hi: r[2], lord: RASHI_LORD[i], good: RASHI_GOOD[i] }));
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


  /* Gujarati and Hindi for every guidance text above, keyed by the English. tr() falls back to English only for a
     string that is missing here, and tests/i18n-coverage.mjs fails the build if any string is missing. */
  const TX = {};
  [
    // Moon in each rashi
    ['bold starts, sport and quick decisions; keep your temper', 'હિંમતભરી શરૂઆત, રમત અને ઝડપી નિર્ણય; ગુસ્સો કાબૂમાં રાખો', 'साहसिक आरंभ, खेल और त्वरित निर्णय; क्रोध पर संयम रखें'],
    ['the Moon is exalted: buying, money matters, food, music and anything meant to last', 'ચંદ્ર ઉચ્ચનો: ખરીદી, નાણાંનાં કામ, ભોજન, સંગીત અને લાંબું ટકે એવું દરેક કામ', 'चंद्र उच्च का: खरीदारी, धन के काम, भोजन, संगीत और टिकाऊ हर काम'],
    ['talks, writing, trade, learning and short trips', 'વાતચીત, લેખન, વેપાર, અભ્યાસ અને ટૂંકા પ્રવાસ', 'बातचीत, लेखन, व्यापार, अध्ययन और छोटी यात्राएँ'],
    ['the Moon is at home: family, mother, home and caring for others; feelings run deep', 'ચંદ્ર સ્વગૃહી: કુટુંબ, માતા, ઘર અને બીજાની સંભાળ; લાગણી ઊંડી રહે', 'चंद्र स्वराशि में: परिवार, माता, घर और दूसरों की देखभाल; भावनाएँ गहरी रहती हैं'],
    ['leadership, government work, meeting elders and being seen; keep pride in check', 'નેતૃત્વ, સરકારી કામ, વડીલોને મળવું અને ઓળખ; અભિમાન ટાળો', 'नेतृत्व, सरकारी काम, बड़ों से मिलना और पहचान; अभिमान से बचें'],
    ['detailed work, accounts, health routines and service', 'ઝીણવટભર્યું કામ, હિસાબ, આરોગ્યની દિનચર્યા અને સેવા', 'बारीक काम, हिसाब-किताब, स्वास्थ्य की दिनचर्या और सेवा'],
    ['partnerships, agreements, beauty, art and making peace', 'ભાગીદારી, કરાર, સૌંદર્ય, કલા અને સમાધાન', 'साझेदारी, समझौते, सौंदर्य, कला और मेल-मिलाप'],
    ['the Moon is debilitated: sadhana, research and quiet work; avoid new ventures and arguments', 'ચંદ્ર નીચનો: સાધના, સંશોધન અને શાંત કામ; નવું સાહસ અને વિવાદ ટાળો', 'चंद्र नीच का: साधना, शोध और शांत काम; नए उद्यम और विवाद से बचें'],
    ['dharma, study, teachers, pilgrimage and long journeys', 'ધર્મ, અભ્યાસ, ગુરુ, તીર્થયાત્રા અને લાંબા પ્રવાસ', 'धर्म, अध्ययन, गुरु, तीर्थयात्रा और लंबी यात्राएँ'],
    ['steady effort, duty, long-term plans and hard work', 'સતત પ્રયત્ન, ફરજ, લાંબા ગાળાની યોજના અને મહેનત', 'लगातार प्रयास, कर्तव्य, दीर्घकालिक योजना और परिश्रम'],
    ['seva, community work, friends and new ideas', 'સેવા, સમાજનું કામ, મિત્રો અને નવા વિચાર', 'सेवा, सामाजिक काम, मित्र और नए विचार'],
    ['prayer, daan, rest and pilgrimage; trust your intuition', 'પ્રાર્થના, દાન, આરામ અને તીર્થયાત્રા; અંતઃસ્ફુરણા પર ભરોસો રાખો', 'प्रार्थना, दान, विश्राम और तीर्थयात्रा; अंतर्ज्ञान पर भरोसा रखें'],
    // Tithi groups
    ['Nanda (joyful)', 'નંદા (આનંદદાયી)', 'नंदा (आनंददायक)'], ['Bhadra (steady)', 'ભદ્રા (સ્થિર)', 'भद्रा (स्थिर)'], ['Jaya (victorious)', 'જયા (વિજયી)', 'जया (विजयी)'],
    ['Rikta (empty)', 'રિક્તા (ખાલી)', 'रिक्ता (रिक्त)'], ['Purna (complete)', 'પૂર્ણા (સંપૂર્ણ)', 'पूर्णा (पूर्ण)'], ['Amavasya', 'અમાસ', 'अमावस्या'],
    ['celebrations, music, arts, family gatherings', 'ઉત્સવ, સંગીત, કલા, કુટુંબ મેળાવડા', 'उत्सव, संगीत, कला, पारिवारिक मिलन'],
    ['buying, travel, routine work, starting steady projects', 'ખરીદી, પ્રવાસ, રોજિંદાં કામ, સ્થિર કામની શરૂઆત', 'खरीदारी, यात्रा, नियमित काम, स्थायी कार्यों की शुरुआत'],
    ['competition, courage, legal matters, physical effort', 'સ્પર્ધા, હિંમતનાં કામ, કોર્ટ-કચેરી, શારીરિક મહેનત', 'प्रतियोगिता, साहस के काम, कानूनी मामले, शारीरिक परिश्रम'],
    ['clearing obstacles, cleaning, ending what no longer serves', 'વિઘ્ન દૂર કરવાં, સાફસફાઈ, જે કામનું નથી તેનો અંત', 'बाधाएँ दूर करना, साफ़-सफ़ाई, जो काम का नहीं उसे समाप्त करना'],
    ['completing work, all auspicious ceremonies', 'કામ પૂરાં કરવાં, બધાં શુભ કાર્ય', 'काम पूरे करना, सभी शुभ संस्कार'],
    ['harsh words and quarrels', 'કડવાં વચન અને ઝઘડા', 'कटु वचन और झगड़े'], ['rushed decisions', 'ઉતાવળા નિર્ણય', 'जल्दबाज़ी के निर्णय'],
    ['starting delicate or gentle work', 'નાજુક કે કોમળ કામની શરૂઆત', 'नाज़ुक या कोमल कार्यों की शुरुआत'],
    ['new beginnings, purchases and ceremonies', 'નવી શરૂઆત, ખરીદી અને શુભ પ્રસંગ', 'नई शुरुआत, खरीदारी और संस्कार'], ['leaving things half done', 'કામ અધૂરાં છોડવાં', 'काम अधूरे छोड़ना'],
    // Deities
    ['Agni', 'અગ્નિ', 'अग्नि'], ['Brahma', 'બ્રહ્મા', 'ब्रह्मा'], ['Gauri', 'ગૌરી', 'गौरी'], ['Ganesha', 'ગણેશ', 'गणेश'], ['Naga devata', 'નાગ દેવતા', 'नाग देवता'],
    ['Kartikeya', 'કાર્તિકેય', 'कार्तिकेय'], ['Surya', 'સૂર્ય', 'सूर्य'], ['Shiva (Rudra)', 'શિવ (રુદ્ર)', 'शिव (रुद्र)'], ['Durga', 'દુર્ગા', 'दुर्गा'], ['Yama', 'યમ', 'यम'],
    ['Vishnu', 'વિષ્ણુ', 'विष्णु'], ['Vishnu (Hari)', 'વિષ્ણુ (હરિ)', 'विष्णु (हरि)'], ['Kamadeva', 'કામદેવ', 'कामदेव'], ['Shiva (Kali)', 'શિવ (કાળી)', 'शिव (काली)'],
    ['Chandra', 'ચંદ્ર', 'चंद्र'], ['Pitru (ancestors)', 'પિતૃ (પૂર્વજો)', 'पितृ (पूर्वज)'], ['Ashwini Kumaras', 'અશ્વિની કુમાર', 'अश्विनी कुमार'], ['Soma', 'સોમ', 'सोम'],
    ['Rudra', 'રુદ્ર', 'रुद्र'], ['Aditi', 'અદિતિ', 'अदिति'], ['Brihaspati', 'બૃહસ્પતિ', 'बृहस्पति'], ['Naga', 'નાગ', 'नाग'], ['Pitru', 'પિતૃ', 'पितृ'], ['Bhaga', 'ભગ', 'भग'],
    ['Aryaman', 'અર્યમા', 'अर्यमा'], ['Savitr', 'સવિતા', 'सविता'], ['Vishwakarma', 'વિશ્વકર્મા', 'विश्वकर्मा'], ['Vayu', 'વાયુ', 'वायु'], ['Indra and Agni', 'ઇન્દ્ર અને અગ્નિ', 'इंद्र और अग्नि'],
    ['Mitra', 'મિત્ર', 'मित्र'], ['Indra', 'ઇન્દ્ર', 'इंद्र'], ['Nirriti', 'નિર્ઋતિ', 'निर्ऋति'], ['Apas (waters)', 'આપ (જળ)', 'आप (जल)'], ['Vishvedevas', 'વિશ્વેદેવ', 'विश्वेदेव'],
    ['Ashta Vasus', 'અષ્ટ વસુ', 'अष्ट वसु'], ['Varuna', 'વરુણ', 'वरुण'], ['Aja Ekapada', 'અજ એકપાદ', 'अज एकपाद'], ['Ahir Budhnya', 'અહિર્બુધ્ન્ય', 'अहिर्बुध्न्य'], ['Pushan', 'પૂષા', 'पूषा'],
    ['Shiva', 'શિવ', 'शिव'], ['Hanuman', 'હનુમાન', 'हनुमान'], ['Lakshmi', 'લક્ષ્મી', 'लक्ष्मी'], ['Shani and Hanuman', 'શનિ અને હનુમાન', 'शनि और हनुमान'],
    // Tithi notes
    ['A fresh start of the fortnight.', 'પખવાડિયાની નવી શરૂઆત.', 'पक्ष की नई शुरुआत।'], ['Good for laying foundations.', 'પાયો નાખવા માટે શુભ.', 'नींव रखने के लिए शुभ।'],
    ['Favoured for beauty, music and blessings for the household.', 'સૌંદર્ય, સંગીત અને ઘરના આશીર્વાદ માટે ઉત્તમ.', 'सौंदर्य, संगीत और घर-परिवार के आशीर्वाद के लिए उत्तम।'],
    ['Worship Ganesha to remove obstacles.', 'વિઘ્ન દૂર કરવા ગણેશ પૂજા કરો.', 'बाधाएँ दूर करने के लिए गणेश पूजा करें।'],
    ['Good for learning, medicine and healing.', 'વિદ્યા, ઔષધ અને ઉપચાર માટે શુભ.', 'विद्या, औषधि और उपचार के लिए शुभ।'],
    ['Good for courage, health of children and festive work.', 'હિંમત, બાળકોના આરોગ્ય અને ઉત્સવનાં કામ માટે શુભ.', 'साहस, संतान के स्वास्थ्य और उत्सव के कार्यों के लिए शुभ।'],
    ['Good for travel, vehicles and offering arghya to the Sun.', 'પ્રવાસ, વાહન અને સૂર્યને અર્ઘ્ય આપવા માટે શુભ.', 'यात्रा, वाहन और सूर्य को अर्घ्य देने के लिए शुभ।'],
    ['Devi and Shiva worship; good for strong, protective work.', 'દેવી અને શિવની પૂજા; દૃઢ, રક્ષણનાં કામ માટે શુભ.', 'देवी और शिव की पूजा; दृढ़ और रक्षा के कार्यों के लिए शुभ।'],
    ['Devi worship; avoid auspicious beginnings.', 'દેવી પૂજા; શુભ શરૂઆત ટાળો.', 'देवी पूजा; शुभ आरंभ टालें।'],
    ['Good for righteous, lasting work and travel.', 'ધર્મનાં, લાંબું ટકે એવાં કામ અને પ્રવાસ માટે શુભ.', 'धर्म के, स्थायी कार्यों और यात्रा के लिए शुभ।'],
    ['Fast and remember Vishnu. Ideal for japa and simple living.', 'ઉપવાસ કરો અને વિષ્ણુનું સ્મરણ કરો. જાપ અને સાદા જીવન માટે ઉત્તમ.', 'व्रत रखें और विष्णु का स्मरण करें। जप और सादे जीवन के लिए उत्तम।'],
    ['Break the Ekadashi fast within the parana time; good for charity.', 'પારણાંના સમયમાં અગિયારસનો ઉપવાસ છોડો; દાન માટે શુભ.', 'पारण के समय में एकादशी का व्रत खोलें; दान के लिए शुभ।'],
    ['Pradosh: worship Shiva at dusk. Good for friendship and joy.', 'પ્રદોષ: સંધ્યાકાળે શિવ પૂજા કરો. મિત્રતા અને આનંદ માટે શુભ.', 'प्रदोष: संध्या में शिव पूजा करें। मित्रता और आनंद के लिए शुभ।'],
    ['Shiva worship; avoid new beginnings.', 'શિવ પૂજા; નવી શરૂઆત ટાળો.', 'शिव पूजा; नई शुरुआत टालें।'],
    ['Purnima vrat, Satyanarayan katha and charity. Good for all ceremonies.', 'પૂનમનું વ્રત, સત્યનારાયણની કથા અને દાન. બધાં શુભ કાર્ય માટે ઉત્તમ.', 'पूर्णिमा व्रत, सत्यनारायण कथा और दान। सभी संस्कारों के लिए शुभ।'],
    ['Offer tarpan to ancestors, give charity and keep quiet. Avoid new beginnings.', 'પિતૃઓને તર્પણ કરો, દાન આપો અને શાંત રહો. નવી શરૂઆત ટાળો.', 'पितरों को तर्पण करें, दान दें और शांत रहें। नई शुरुआत टालें।'],
    ['remembering ancestors, charity, meditation', 'પિતૃ સ્મરણ, દાન, ધ્યાન', 'पितृ स्मरण, दान, ध्यान'], ['new beginnings, purchases, travel', 'નવી શરૂઆત, ખરીદી, પ્રવાસ', 'नई शुरुआत, खरीदारी, यात्रा'],
    // Nakshatra classes
    ['Dhruva (fixed)', 'ધ્રુવ (સ્થિર)', 'ध्रुव (स्थिर)'], ['Chara (movable)', 'ચર (ચલિત)', 'चर (चलायमान)'], ['Kshipra (swift)', 'ક્ષિપ્ર (ઝડપી)', 'क्षिप्र (शीघ्र)'],
    ['Mridu (gentle)', 'મૃદુ (કોમળ)', 'मृदु (कोमल)'], ['Mishra (mixed)', 'મિશ્ર', 'मिश्र'], ['Ugra (fierce)', 'ઉગ્ર', 'उग्र'], ['Tikshna (sharp)', 'તીક્ષ્ણ', 'तीक्ष्ण'],
    ['foundations, griha pravesh, planting, long-term commitments', 'પાયો, ગૃહપ્રવેશ, વાવેતર, લાંબા ગાળાનાં વચન', 'नींव, गृह प्रवेश, रोपण, दीर्घकालीन संकल्प'],
    ['travel, vehicles, change of residence, gardening', 'પ્રવાસ, વાહન, ઘર બદલવું, બાગકામ', 'यात्रा, वाहन, निवास बदलना, बागवानी'],
    ['trade, medicine, learning, short journeys, quick tasks', 'વેપાર, ઔષધ, વિદ્યા, ટૂંકો પ્રવાસ, ઝડપી કામ', 'व्यापार, औषधि, विद्या, छोटी यात्रा, शीघ्र कार्य'],
    ['arts, friendship, new clothes, music, romance', 'કલા, મિત્રતા, નવાં વસ્ત્ર, સંગીત, પ્રેમ', 'कला, मित्रता, नए वस्त्र, संगीत, प्रेम'],
    ['routine work, fire rituals, daily duties', 'રોજિંદાં કામ, હવન, નિત્ય કર્મ', 'नियमित काम, हवन, नित्य कर्म'], ['bold or difficult tasks', 'સાહસનાં કે કઠિન કામ', 'साहसिक या कठिन कार्य'],
    ['auspicious ceremonies and new ventures', 'શુભ પ્રસંગ અને નવાં સાહસ', 'शुभ संस्कार और नए उद्यम'],
    ['ending ties, removing obstacles, spiritual discipline', 'સંબંધ પૂરા કરવા, વિઘ્ન દૂર કરવાં, સાધના', 'संबंध समाप्त करना, बाधाएँ हटाना, साधना'],
    ['weddings, purchases and new ventures', 'લગ્ન, ખરીદી અને નવાં સાહસ', 'विवाह, खरीदारी और नए उद्यम'], ['nothing in particular', 'ખાસ કંઈ નહીં', 'कुछ विशेष नहीं'],
    // Weekdays
    ['government work, authority, health, offering water to the Sun', 'સરકારી કામ, અધિકાર, આરોગ્ય, સૂર્યને જળ અર્પણ', 'सरकारी काम, अधिकार, स्वास्थ्य, सूर्य को जल अर्पण'],
    ['Shiva puja, travel, home, family, arts', 'શિવ પૂજા, પ્રવાસ, ઘર, કુટુંબ, કલા', 'शिव पूजा, यात्रा, घर, परिवार, कला'],
    ['courage, property matters, sport, Hanuman Chalisa', 'હિંમત, મિલકતનાં કામ, રમતગમત, હનુમાન ચાલીસા', 'साहस, संपत्ति के काम, खेल, हनुमान चालीसा'],
    ['learning, trade, writing, accounts, communication', 'વિદ્યા, વેપાર, લેખન, હિસાબ, વાતચીત', 'विद्या, व्यापार, लेखन, हिसाब, संवाद'],
    ['study, religious rites, meeting teachers, charity', 'અભ્યાસ, ધાર્મિક વિધિ, ગુરુ દર્શન, દાન', 'अध्ययन, धार्मिक अनुष्ठान, गुरु से भेंट, दान'],
    ['arts, jewellery, clothes, relationships, Lakshmi puja', 'કલા, ઘરેણાં, વસ્ત્ર, સંબંધ, લક્ષ્મી પૂજા', 'कला, आभूषण, वस्त्र, संबंध, लक्ष्मी पूजा'],
    ['hard work, service, donating oil or black sesame', 'મહેનત, સેવા, તેલ કે કાળા તલનું દાન', 'परिश्रम, सेवा, तेल या काले तिल का दान'],
    ['starting long journeys west', 'પશ્ચિમ દિશાનો લાંબો પ્રવાસ શરૂ કરવો', 'पश्चिम दिशा की लंबी यात्रा शुरू करना'], ['harsh or violent work', 'કઠોર કે હિંસક કામ', 'कठोर या हिंसक काम'],
    ['lending money, haircuts, new ventures', 'ઉધાર આપવું, વાળ કપાવવા, નવાં સાહસ', 'उधार देना, बाल कटवाना, नए उद्यम'], ['haircuts and nail cutting', 'વાળ અને નખ કાપવા', 'बाल और नाखून काटना'],
    ['quarrels at home', 'ઘરમાં ઝઘડા', 'घर में झगड़े'], ['buying iron or oil, starting new ventures', 'લોખંડ કે તેલ ખરીદવું, નવાં સાહસ શરૂ કરવાં', 'लोहा या तेल खरीदना, नए उद्यम शुरू करना'],
    // Choghadiya and Hora
    ['government work only', 'ફક્ત સરકારી કામ', 'केवल सरकारी काम'], ['travel and movement', 'પ્રવાસ અને અવરજવર', 'यात्रा और आवागमन'], ['business, trade and gains', 'ધંધો, વેપાર અને લાભ', 'व्यवसाय, व्यापार और लाभ'],
    ['every auspicious work', 'દરેક શુભ કાર્ય', 'हर शुभ कार्य'], ['avoid new work', 'નવું કામ ટાળો', 'नया काम टालें'], ['ceremonies, puja, marriage talks', 'શુભ પ્રસંગ, પૂજા, સગપણની વાત', 'संस्कार, पूजा, विवाह की बात'],
    ['government work, leadership, meeting seniors', 'સરકારી કામ, નેતૃત્વ, વડીલોને મળવું', 'सरकारी काम, नेतृत्व, वरिष्ठों से मिलना'], ['travel, home, care, meeting people', 'પ્રવાસ, ઘર, સંભાળ, લોકોને મળવું', 'यात्रा, घर, देखभाल, लोगों से मिलना'],
    ['physical effort, property, courage; avoid new ventures', 'શારીરિક મહેનત, મિલકત, હિંમત; નવાં સાહસ ટાળો', 'शारीरिक परिश्रम, संपत्ति, साहस; नए उद्यम टालें'],
    ['study, writing, trade, communication', 'અભ્યાસ, લેખન, વેપાર, વાતચીત', 'अध्ययन, लेखन, व्यापार, संवाद'], ['puja, study, counsel, every auspicious work', 'પૂજા, અભ્યાસ, સલાહ, દરેક શુભ કાર્ય', 'पूजा, अध्ययन, परामर्श, हर शुभ कार्य'],
    ['arts, shopping, relationships, celebrations', 'કલા, ખરીદી, સંબંધ, ઉત્સવ', 'कला, खरीदारी, संबंध, उत्सव'], ['hard labour and service; avoid new ventures', 'મહેનત અને સેવા; નવાં સાહસ ટાળો', 'परिश्रम और सेवा; नए उद्यम टालें'],
    // Tarabalam
    ['Janma (birth star): take care with big decisions', 'જન્મ તારા: મોટા નિર્ણયમાં સાવધાની રાખો', 'जन्म तारा: बड़े निर्णयों में सावधानी रखें'], ['Sampat (wealth): good for gains', 'સંપત તારા: લાભ માટે શુભ', 'संपत तारा: लाभ के लिए शुभ'],
    ['Vipat (danger): avoid risks', 'વિપત તારા: જોખમ ટાળો', 'विपत तारा: जोखिम टालें'], ['Kshema (well-being): good for health and comfort', 'ક્ષેમ તારા: આરોગ્ય અને સુખ માટે શુભ', 'क्षेम तारा: स्वास्थ्य और सुख के लिए शुभ'],
    ['Pratyari (obstacles): expect resistance', 'પ્રત્યરિ તારા: અડચણ આવી શકે', 'प्रत्यरि तारा: बाधा आ सकती है'], ['Sadhana (achievement): good for effort and goals', 'સાધના તારા: પ્રયત્ન અને ધ્યેય માટે શુભ', 'साधना तारा: प्रयास और लक्ष्य के लिए शुभ'],
    ['Naidhana (destruction): avoid important starts', 'નૈધન તારા: મહત્ત્વની શરૂઆત ટાળો', 'नैधन तारा: महत्वपूर्ण आरंभ टालें'], ['Mitra (friend): supportive day', 'મિત્ર તારા: સાથ આપતો દિવસ', 'मित्र तारा: सहयोगी दिन'],
    ['Param Mitra (best friend): very supportive day', 'પરમ મિત્ર તારા: ખૂબ સાથ આપતો દિવસ', 'परम मित्र तारा: बहुत सहयोगी दिन'],
    // Muhurat finder events
    ['Griha pravesh (house warming)', 'ગૃહપ્રવેશ', 'गृह प्रवेश'], ['Buying a vehicle', 'વાહન ખરીદી', 'वाहन खरीदना'], ['Opening a business', 'નવો ધંધો શરૂ કરવો', 'व्यवसाय आरंभ'],
    ['Buying property or land', 'મિલકત કે જમીન ખરીદી', 'संपत्ति या भूमि खरीदना'], ['Starting study (vidyarambh)', 'વિદ્યારંભ', 'विद्यारंभ'], ['Long journey', 'લાંબો પ્રવાસ', 'लंबी यात्रा'],
    ['Mundan (first haircut)', 'મુંડન (બાબરી)', 'मुंडन'],
    // Festival notes
    ['Any good work begun today is said to bear lasting fruit.', 'આજે શરૂ કરેલું દરેક સારું કામ અક્ષય ફળ આપે છે.', 'आज आरंभ किया हर शुभ कार्य अक्षय फल देता है।'],
    ['Nine nights of Devi worship and garba.', 'દેવી ઉપાસના અને ગરબાની નવ રાત.', 'देवी उपासना और गरबा की नौ रातें।'],
    ['Traders open new account books.', 'વેપારીઓ નવા ચોપડાનું પૂજન કરે છે.', 'व्यापारी नए बही-खाते का पूजन करते हैं।']
  ].forEach(([en, gu, hi]) => { TX[en] = { gu, hi }; });
  /* English text → the reader's language. Lists joined with '; ' are translated part by part. */
  function tr(s, lang) {
    if (!s || !lang || lang === 'en') return s;
    const hit = TX[s]; if (hit) return hit[lang] || s;
    return s.indexOf('; ') >= 0 ? s.split('; ').map(x => tr(x, lang)).join('; ') : s;
  }

  const api = { tr, TX, tithi, nakshatra, YOGA, KARANA, VAAR, CHOG, PLANET, RASHI, TARA, PRACTICES, EVENTS, TITHI_GROUP, NAK_KIND, GROUPS };
  if (typeof module !== 'undefined') module.exports = api;
  root.Meanings = api;
})(typeof window !== 'undefined' ? window : globalThis);
