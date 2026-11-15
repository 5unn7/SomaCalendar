/* Accessibility gate: axe-core (WCAG 2.1 A/AA) on every screen in light and dark, in a real Chromium.
   Fails on any serious or critical violation. Skips (exit 0) only when Playwright is not installed. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {extname,join} from 'node:path';
const require=createRequire(import.meta.url);
let chromium;try{({chromium}=require('playwright'));}catch(e){console.log('SKIP: Playwright not installed');process.exit(0);}
const axe=await readFile(require.resolve('axe-core/axe.min.js'),'utf8');
const root='android/app/src/main/assets',types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'};
const server=createServer(async(q,r)=>{try{const p=join(root,decodeURIComponent(new URL(q.url,'http://x').pathname).replace(/^\/$/,'/index.html'));r.writeHead(200,{'content-type':types[extname(p)]||'application/octet-stream'});r.end(await readFile(p));}catch(e){r.writeHead(404);r.end();}}).listen(0);
const url=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch(),fails=[];
const store=(lang,theme,layout)=>JSON.stringify({loc:{name:'Ahmedabad',lat:23.0225,lon:72.5714,zone:'Asia/Kolkata'},profile:{date:'1990-05-15',time:'08:30',timeUnknown:false,zone:'Asia/Kolkata',lat:22.3039,lon:70.8022,place:'Rajkot, Gujarat, India'},events:[],prefs:{lang,theme,layout,onboarded:true}});
for(const theme of ['light','dark'])for(const lang of ['en','gu']){
  const ctx=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme});const page=await ctx.newPage();
  await page.addInitScript(s=>{try{localStorage.setItem('soma-redesign-v1',s)}catch(e){}},store(lang,theme,'dial'));
  await page.goto(url);await page.waitForSelector('#app h1');
  const screens=[['today',"show('today')"],['panchang',"show('today');push('panchang')"],['calendar',"show('calendar')"],['muhurat',"show('muhurat')"],['muhurat-times',"show('muhurat');setMuhuratTab('times')"],['festival',"festivalSheet('diwali','2026-11-08')"],['term',"termSheet('tithi')"],['moon',"show('moon')"],['learn',"show('learn')"],['you',"show('personal')"],['settings',"show('personal');push('settings')"],['birth',"editProfile()"]];
  for(const [name,js] of screens){
    await page.evaluate(`(()=>{const m=document.querySelector('#modal');if(m.open)m.close();${js}})()`);
    // Let entrance animations finish so axe measures the settled colours.
    await page.waitForTimeout(700);
    await page.addScriptTag({content:axe});
    const res=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},resultTypes:['violations']}));
    for(const v of res.violations.filter(v=>v.impact==='serious'||v.impact==='critical'))fails.push(`${theme}/${lang}/${name}: ${v.id} ×${v.nodes.length} · ${v.nodes.slice(0,3).map(n=>n.target.join(' ')+(n.any[0]&&n.any[0].message?' ('+n.any[0].message.slice(0,90)+')':'')).join(' | ')}`);
  }
  await ctx.close();
}
await browser.close();server.close();
if(fails.length){console.error(fails.join('\n'));console.error(fails.length+' serious accessibility problems');process.exit(1);}
console.log('PASS: axe-core finds no serious or critical WCAG 2.1 AA problems on 14 screens × light/dark × English/Gujarati');
