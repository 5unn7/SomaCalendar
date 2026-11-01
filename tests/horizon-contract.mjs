import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('android/app/src/main/assets/index.html','utf8');
for(const id of ['obsLocation','birthQuery','birthSearch','birthLat','birthLon','birthZone','birthResults','birthPlaceSummary','getWeather','timeScrub','natalChart','heroTitle','weatherSummary']){
 assert.ok(html.includes('id="'+id+'"'),'Missing Horizon element: '+id);
}
for(const token of ['window.SomaGrahan','panchangAtSunrise','kundaliSvg','somaReceiveBirthplaces','somaReceiveLocation','appReady']){
 assert.ok(html.includes(token),'Missing calculation / bridge integration: '+token);
}
const matches=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
assert.ok(matches.length>=2,'Bundled Grahan and Horizon scripts not found');
assert.ok(html.length>200000,'Astronomy bundle too small');
console.log('Horizon v0.5 HTML contract passed; scripts:',matches.length,'bytes:',html.length);
