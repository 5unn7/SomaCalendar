import {readFileSync,writeFileSync} from 'node:fs';
import {transform} from 'esbuild';
const path='android/app/src/main/assets/index.html';
let html=readFileSync(path,'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
if(scripts.length<2)throw Error('Expected inlined Grahan and Soma scripts');
for(const match of scripts){
  const transformed=await transform(match[1],{target:'es2017',format:'iife',minify:true,charset:'utf8',legalComments:'none'});
  html=html.replace(match[0],'<script>'+transformed.code+'</script>');
}
if(/\?\.|\?\?/.test(html.slice(html.lastIndexOf('<script>'))))throw Error('Modern syntax remains in the final script');
writeFileSync(path,html,'utf8');
console.log('Transpiled embedded scripts for Android WebView ES2017:',scripts.length,html.length,'bytes');
