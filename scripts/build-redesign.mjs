import {copyFile,mkdir,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
const dest='android/app/src/main/assets';
await mkdir(dest,{recursive:true});
await copyFile('THIRD_PARTY_NOTICES.md',dest+'/THIRD_PARTY_NOTICES.txt');
for(const f of ['index.html','style.css','core.js']) await copyFile('src/redesign/'+f,dest+'/'+f);
// The emulator WebView rejects ES2020 syntax (`??`, `?.`), so app.js is
// down-levelled to es2017. No bundle/format: top-level functions stay global for inline handlers.
for(const f of ['clock.js','panchang.js','meanings.js','festivals.js','widget.js','i18n.js','places.js','dial.js']) await build({entryPoints:['src/redesign/'+f],outfile:dest+'/'+f,target:'es2017',logLevel:'warning'});
await build({entryPoints:['src/redesign/app.js'],outfile:dest+'/app.js',target:'es2017',logLevel:'warning'});
// Bundled fonts (OFL) so Gujarati and Devanagari render the same offline on every phone.
await mkdir(dest+'/fonts',{recursive:true});
for(const f of await readdir('src/redesign/fonts')) await copyFile('src/redesign/fonts/'+f,dest+'/fonts/'+f);
await copyFile('node_modules/astronomy-engine/astronomy.browser.min.js',dest+'/astronomy.js');
await build({entryPoints:['src/natal.js'],outfile:dest+'/natal.js',bundle:true,minify:true,target:'es2017',format:'iife'});
