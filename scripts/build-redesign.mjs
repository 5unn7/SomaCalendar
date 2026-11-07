import {copyFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
const dest='android/app/src/main/assets';
await mkdir(dest,{recursive:true});
await copyFile('THIRD_PARTY_NOTICES.md',dest+'/THIRD_PARTY_NOTICES.txt');
for(const f of ['index.html','style.css','core.js','app.js']) await copyFile('src/redesign/'+f,dest+'/'+f);
await copyFile('node_modules/astronomy-engine/astronomy.browser.min.js',dest+'/astronomy.js');
await build({entryPoints:['src/natal.js'],outfile:dest+'/natal.js',bundle:true,minify:true,target:'es2017',format:'iife'});
