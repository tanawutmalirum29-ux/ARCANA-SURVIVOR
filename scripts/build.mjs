import {mkdir,copyFile,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist/src',{recursive:true});
for(const file of ['index.html','src/main.js','src/engine.js','src/render.js','src/storage.js','src/styles.css']){await copyFile(file,`dist/${file}`)}
console.log('Built static web app in dist/ — can be hosted on GitHub Pages or any static host.');
