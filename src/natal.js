import {kundali,kundaliSvg} from '@grahan/vedic';
window.SomaNatal={chart:(date,latitude,longitude)=>kundaliSvg(kundali({date,latitude,longitude}),{style:'north',size:340})};
