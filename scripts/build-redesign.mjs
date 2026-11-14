import {copyFile,mkdir} from 'node:fs/promises';
import {build,transform} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const dest='android/app/src/main/assets';
await mkdir(dest,{recursive:true});
await copyFile('THIRD_PARTY_NOTICES.md',dest+'/THIRD_PARTY_NOTICES.txt');
for(const f of ['index.html','style.css']) await copyFile('src/redesign/'+f,dest+'/'+f);
// Down-level plain scripts so older Android WebViews (e.g. Android 10's Chrome 74) can parse ?? and ?.
for(const f of ['core.js','app.js']){const {code}=await transform(await readFile('src/redesign/'+f,'utf8'),{target:'es2017',loader:'js'});await writeFile(dest+'/'+f,code);}
await copyFile('node_modules/astronomy-engine/astronomy.browser.min.js',dest+'/astronomy.js');
await build({entryPoints:['src/natal.js'],outfile:dest+'/natal.js',bundle:true,minify:true,target:'es2017',format:'iife'});
