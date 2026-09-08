import {readFile,writeFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';
const root=new URL('../public/brand/',import.meta.url);await mkdir(root,{recursive:true});
const svg=await readFile(new URL('logo.svg',root),'utf8');
const staticSvg=svg.replace(/<style>[\s\S]*?<\/style>/,'').replace(/^[ \t]+$/gm,'');
await writeFile(new URL('logo-static.svg',root),staticSvg);
const favicon=staticSvg.replace('viewBox="0 0 256 256"','viewBox="25 21 206 206"').replace(/<defs>/,'<rect x="25" y="21" width="206" height="206" rx="42" fill="#04070c"/><defs>');
await writeFile(new URL('favicon.svg',root),favicon);
await sharp(Buffer.from(favicon)).resize(64,64).png().toFile(new URL('favicon.png',root).pathname);
await sharp(Buffer.from(favicon)).resize(180,180).png().toFile(new URL('apple-touch-icon.png',root).pathname);
const frames=[];
for(let i=0;i<48;i++){
 const phase=i/48,wave=Math.cos(phase*Math.PI*2),tilt=-12*wave,size=.99-.05*wave;
 const frame=favicon.replace('class="sq-hand"',`class="sq-hand" transform="rotate(${phase*360} 128 124)"`).replace('class="sq-space"',`class="sq-space" transform="rotate(${phase*360} 128 124)"`).replace('class="sq-eternity"',`class="sq-eternity" transform="translate(128 154) rotate(${tilt}) scale(${size}) translate(-128 -154)"`).replace('class="sq-flow"',`class="sq-flow" stroke-dasharray="72 132" stroke-dashoffset="${-408*phase}"`);
 frames.push('data:image/png;base64,'+(await sharp(Buffer.from(frame)).resize(32,32).png().toBuffer()).toString('base64'));
}
await writeFile(new URL('favicon-frames.json',root),JSON.stringify(frames));
console.log('SVG、静态回退和 48 帧 favicon 已生成');
