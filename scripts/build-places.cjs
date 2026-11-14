/* Generates src/redesign/places.js. Run: npm i --no-save all-the-cities cities.json geo-tz && node scripts/build-places.cjs src/redesign/places.js */
const c=require('all-the-cities');const {find}=require('geo-tz');const ADM=Object.fromEntries(require('cities.json/admin1.json').map(a=>[a.code,a.name]));const region=new Intl.DisplayNames(['en'],{type:'region'});
const dias=new Set(['US','CA','GB','AU','NZ','AE','KE','UG','TZ','SG','MY','FJ','MU','ZA','NL','DE','NP','LK','BD','PK','OM','QA','KW','BH','SA','TT','GY','SR','IE','FR','IT','HK','JP']);
const pick=x=>x.population>=(x.country==='IN'||dias.has(x.country)?1000:5000);
const sel=c.filter(pick).sort((a,b)=>b.population-a.population);
const stName={};const states=[],stIdx={},tzs=[],tzIdx={};const ctry={};
const out=[];const ascii=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const ALIAS={Mumbai:'Bombay',Kolkata:'Calcutta',Chennai:'Madras',Bengaluru:'Bangalore',Vadodara:'Baroda',Pune:'Poona',Gurgaon:'Gurugram',Thiruvananthapuram:'Trivandrum',Kochi:'Cochin',Varanasi:'Banaras/Kashi',Prayagraj:'Allahabad',Mysore:'Mysuru',Puducherry:'Pondicherry',Mangalore:'Mangaluru',Shimla:'Simla',Kanpur:'Cawnpore',Bharuch:'Broach',Navsari:'Navasari',Dwarka:'Dwaraka',Somnath:'Prabhas Patan',Ujjain:'Avantika',Ayodhya:'Faizabad',Delhi:'New Delhi',Vijayawada:'Bezawada',Visakhapatnam:'Vizag',Kozhikode:'Calicut',Thane:'Thana',Bhavnagar:'Bhaunagar',Junagadh:'Junagarh'};
for(const s of sel){const [lon,lat]=s.loc.coordinates;
 let st=(ADM[s.country+'.'+s.adminCode]||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(!(st in stIdx)){stIdx[st]=states.length;states.push(st)}
 const tz=find(lat,lon)[0];if(!(tz in tzIdx)){tzIdx[tz]=tzs.length;tzs.push(tz)}
 if(!ctry[s.country])ctry[s.country]=region.of(s.country)||s.country;
 const nm=ascii(s.name);const alt=ALIAS[nm]||'';
 out.push([nm.replace(/[;|]/g,' '),alt,stIdx[st],s.country,lat.toFixed(2),lon.toFixed(2),tzIdx[tz]].join(';'));
}
// dedupe: same name+state keep first (largest)
const seen=new Set();const fin=out.filter(l=>{const p=l.split(';');const k=p[0]+'|'+p[2]+'|'+p[3];if(seen.has(k))return false;seen.add(k);return true});
const body=`/* Offline gazetteer: ${fin.length} places (India and diaspora countries >= 1,000 people, elsewhere >= 5,000).
 * Built by scripts/build-places.cjs from GeoNames (CC BY 4.0, via all-the-cities), state names from GeoNames admin1 (via cities.json), time zones from geo-tz.
 * Row: name;aliases;state;country;lat;lon;zone. Sorted by population, largest first. */
(function (root) {
  const STATES = ${JSON.stringify(states)};
  const ZONES = ${JSON.stringify(tzs)};
  const COUNTRIES = ${JSON.stringify(ctry)};
  const DATA = ${JSON.stringify(fin.join('\n'))};
  let rows = null;
  const fold = s => s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  function load() {
    if (rows) return rows;
    rows = DATA.split('\\n').map((l, rank) => { const p = l.split(';'); return { name: p[0], alt: p[1] ? p[1].split('/') : [], state: STATES[+p[2]], cc: p[3], country: COUNTRIES[p[3]] || p[3], lat: +p[4], lon: +p[5], zone: ZONES[+p[6]], rank, key: fold(p[0]), akeys: p[1] ? p[1].split('/').map(fold) : [] }; });
    return rows;
  }
  const label = r => [r.name, r.state, r.country].filter(Boolean).join(', ');
  /* Type-ahead: prefix matches on the name first, then alias and word matches; bigger places first; India first when tied. */
  function search(q, limit) {
    const f = fold(q || ''); if (!f) return [];
    const hits = [];
    for (const r of load()) {
      let s = -1;
      // An exact name only outranks a much bigger place that starts with it, so "vado" still offers Vadodara first.
      if (r.key.startsWith(f)) s = 1; else if (r.akeys.some(a => a.startsWith(f))) s = 2; else if (r.key.indexOf(' ' + f) >= 0) s = 3;
      if (s >= 0) hits.push({ r, s: s * 1e6 + r.rank * (r.cc === 'IN' ? 0.5 : 1) * (r.key === f ? 0.05 : 1) });
    }
    return hits.sort((a, b) => a.s - b.s).slice(0, limit || 8).map(h => Object.assign({ label: label(h.r) }, h.r));
  }
  /* Nearest listed place to a GPS fix, so "Use my location" shows a real name. */
  function nearest(lat, lon) {
    let best = null, bd = 1e9;
    for (const r of load()) { const d = (r.lat - lat) ** 2 + ((r.lon - lon) * Math.cos(lat * Math.PI / 180)) ** 2; if (d < bd) { bd = d; best = r; } }
    return best ? Object.assign({ label: label(best), km: Math.sqrt(bd) * 111 }, best) : null;
  }
  const api = { search, nearest, label, count: () => load().length };
  if (typeof module !== 'undefined') module.exports = api;
  root.Places = api;
})(typeof window !== 'undefined' ? window : globalThis);
`;
require('fs').writeFileSync(process.argv[2],body);console.log(fin.length,states.length,tzs.length,body.length);
