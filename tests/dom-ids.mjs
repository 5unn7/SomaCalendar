import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('android/app/src/main/assets/index.html','utf8');
const js=readFileSync('src/app.js','utf8');
const ids=new Set([...html.matchAll(/\\bid=[\"']([^\"']+)[\"']/g)].map(m=>m[1]));
const refs=[...js.matchAll(/\\$\\([\"']([A-Za-z0-9_-]+)[\"']\\)/g)].map(m=>m[1]);
const missing=[...new Set(refs.filter(id=>!ids.has(id)))];
assert.deepEqual(missing,[], 'JavaScript references IDs missing from index.html');
console.log('DOM contract passed: '+new Set(refs).size+' statically referenced elements exist');
