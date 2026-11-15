import {kundali,chartHouses} from '@grahan/vedic';
/* North Indian janma kundali, drawn here so graha names follow the reader's language, the lagna house is marked,
   and no label is smaller than 13px at the size it is shown. Strokes use currentColor, like the Grahan renderer. */
const ABBR={
  en:{sun:'Su',moon:'Mo',mars:'Ma',mercury:'Me',jupiter:'Ju',venus:'Ve',saturn:'Sa',rahu:'Ra',ketu:'Ke'},
  gu:{sun:'સૂ',moon:'ચં',mars:'મં',mercury:'બુ',jupiter:'ગુ',venus:'શુ',saturn:'શ',rahu:'રા',ketu:'કે'},
  hi:{sun:'सू',moon:'चं',mars:'मं',mercury:'बु',jupiter:'गु',venus:'शु',saturn:'श',rahu:'रा',ketu:'के'}
};
const ANCHORS=[[0.5,0.28],[0.25,0.12],[0.12,0.28],[0.28,0.5],[0.12,0.72],[0.25,0.88],[0.5,0.72],[0.75,0.88],[0.88,0.72],[0.72,0.5],[0.88,0.28],[0.75,0.12]];
function chart(date,latitude,longitude,lang,lagnaWord){
  const k=kundali({date,latitude,longitude}),houses=chartHouses(k,'rashi'),ab=ABBR[lang]||ABBR.en,s=340;
  // Re-label each house from the kundali itself, so the retrograde mark stays a separate small glyph.
  const byHouse=houses.map(()=>[]);
  for(const g of k.grahas){const h=(g.rashi-k.lagna.rashi+12)%12;byHouse[h].push({t:ab[g.graha]||g.graha,r:!!g.retrograde&&g.graha!=='rahu'&&g.graha!=='ketu'});}
  const rf=13,gf=15,parts=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" role="img" aria-label="${lagnaWord||'Lagna'}" font-family="var(--body), system-ui, sans-serif">`,
    `<rect x="1" y="1" width="${s-2}" height="${s-2}" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
    `<path d="M1 1 L${s-1} ${s-1} M${s-1} 1 L1 ${s-1}" stroke="currentColor" stroke-width="1" fill="none"/>`,
    `<path d="M${s/2} 1 L${s-1} ${s/2} L${s/2} ${s-1} L1 ${s/2} Z" stroke="currentColor" stroke-width="1" fill="none"/>`,
    `<path d="M${s/2} 6 L${s*0.75-4} ${s*0.25} L${s/2} ${s/2-6} L${s*0.25+4} ${s*0.25} Z" fill="currentColor" opacity=".07"/>`];
  houses.forEach((house,i)=>{
    const [fx,fy]=ANCHORS[house.bhava-1],x=Math.round(fx*s),y=Math.round(fy*s),list=byHouse[i];
    const top=y-gf*(list.length>2?1.2:0.9);
    parts.push(`<text x="${x}" y="${Math.round(top)}" text-anchor="middle" font-size="${rf}" fill="currentColor" opacity="0.7">${house.rashi+1}${i===0?' · '+(lagnaWord||'Lagna'):''}</text>`);
    list.forEach((g,line)=>parts.push(`<text x="${x}" y="${Math.round(top+(line+1)*(gf+3))}" text-anchor="middle" font-size="${gf}" font-weight="600" fill="currentColor">${g.t}${g.r?'<tspan font-size="11" dy="-5">℞</tspan>':''}</text>`));
  });
  parts.push('</svg>');return parts.join('');
}
window.SomaNatal={chart};
