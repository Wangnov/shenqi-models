import {readFile,writeFile,mkdir,rm,cp,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),out=path.join(root,'cloudflare/dist');
const sharp=createRequire(new URL('../web/package.json',import.meta.url))('sharp');
const entries=JSON.parse(await readFile(new URL('catalog.json',import.meta.url),'utf8'));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slugs=new Set();
for(const item of entries){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)||slugs.has(item.slug)||['previews','brand','assets'].includes(item.slug))throw Error('路径无效或重复：'+item.slug);
 slugs.add(item.slug);const source=path.resolve(root,item.source);
 if(!source.startsWith(root+path.sep)||source.startsWith(out))throw Error('构建目录必须位于仓库中且不在输出目录内');
 await access(path.join(source,'index.html'));
 for(const scene of item.scenes){if(!/^[a-z0-9-]+$/.test(scene.hash))throw Error('章节名称无效');await access(path.join(root,scene.preview));}
}
// Check every registered build before replacing the generated gallery.
await rm(out,{recursive:true,force:true});await mkdir(path.join(out,'previews'),{recursive:true});
await cp(path.join(root,'web/public/brand'),path.join(out,'brand'),{recursive:true});
for(const item of entries){
 await cp(path.join(root,item.source),path.join(out,item.slug),{recursive:true});
 for(const scene of item.scenes)await sharp(path.join(root,scene.preview)).resize(900,750,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toFile(path.join(out,'previews',`${item.slug}-${scene.hash}.webp`));
}
const css=`*{box-sizing:border-box}body{margin:0;background:#070b10;color:#eaf0f6;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif}a{color:inherit;text-decoration:none}a:focus-visible{outline:2px solid #b6d7f8;outline-offset:6px}header,main,footer{max-width:1280px;margin:auto;padding-left:5%;padding-right:5%}header{padding-top:32px;display:flex;align-items:center;justify-content:space-between;font-size:11px;letter-spacing:2px;color:#9eaec0}.brand{display:flex;align-items:center;gap:12px;color:#eaf0f6}.brand img{width:52px;height:52px}.intro{padding:80px 0 62px}.eyebrow{font-size:11px;letter-spacing:3px;color:#95a9bf}h1{font-size:clamp(36px,6vw,68px);font-weight:350;letter-spacing:4px;margin:20px 0}p{color:#94a5b8;line-height:1.9;font-size:14px}.project{padding:32px 0 46px;border-top:1px solid #28313c}.project-head{display:flex;justify-content:space-between;align-items:center;gap:20px}h2{font-weight:450;letter-spacing:3px;font-size:25px;margin:0 0 10px}.enter{border:1px solid #53677c;padding:13px 20px;font-size:12px;white-space:nowrap}.enter:hover{background:#182332}.models{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:30px}.model{display:block;min-width:0}.picture{height:270px;overflow:hidden;background:#0e141c;border:1px solid #1c2632}.picture img{width:100%;height:100%;object-fit:contain;transition:transform .6s}.model:hover img{transform:scale(1.04)}.caption{display:flex;justify-content:space-between;align-items:center;padding:18px 0;font-size:14px}.caption small{font-size:11px;color:#8c9caf}.hint{border-top:1px solid #28313c;padding:32px 0;color:#71849a;font-size:12px}footer{padding-top:24px;padding-bottom:40px;font-size:10px;letter-spacing:2px;color:#6f8297;display:flex;justify-content:space-between}@media(max-width:650px){.intro{padding:48px 0 35px}.project-head{align-items:flex-start;flex-direction:column}.models{grid-template-columns:1fr}.picture{height:300px}.intro p{font-size:13px}header{font-size:9px}.hint{line-height:1.8}}@media(prefers-reduced-motion:reduce){.picture img{transition:none}}`;
const projects=entries.map(item=>`<section class="project"><div class="project-head"><div><h2>${escape(item.title)}</h2><p>${escape(item.description)}</p></div><a class="enter" href="/${item.slug}/">进入完整场景 ↗</a></div><div class="models">${item.scenes.map(scene=>`<a class="model" href="/${item.slug}/#${scene.hash}"><div class="picture"><img src="/previews/${item.slug}-${scene.hash}.webp" alt="${escape(scene.artifact)}的三维渲染" width="900" height="750" loading="lazy"></div><div class="caption"><span>${escape(scene.title)} ↗</span><small>${escape(scene.artifact)}</small></div></a>`).join('')}</div></section>`).join('');
const head=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#070b10"><link rel="icon" href="/brand/favicon.svg?v=motion2"><style>${css}</style>`;
await writeFile(path.join(out,'index.html'),`${head}<title>模型展厅 · Wangnov</title><meta name="description" content="Wangnov 的交互式 3D 模型与场景预览。"><header><a class="brand" href="/"><img src="/brand/logo.svg?v=motion2" alt="">WANGNOV / MODEL</a><a href="https://github.com/Wangnov/shenqi-models">开源模型 ↗</a></header><main><section class="intro"><div class="eyebrow">INTERACTIVE 3D COLLECTION</div><h1>把想象，放进世界。</h1><p>模型、粒子与交互构成的数字展厅。<br>选择一个作品，开始探索。</p></section>${projects}<div class="hint">更多模型与独立预览场景将在这里持续收录。</div></main><footer><span>WANGNOV · 模型展厅</span><span>REAL-TIME / THREE.JS</span></footer></html>`);
await writeFile(path.join(out,'404.html'),`${head}<title>页面未找到 · 模型展厅</title><main><section class="intro"><div class="eyebrow">404 / NOT FOUND</div><h1>这里还没有作品。</h1><p><a class="enter" href="/">返回模型展厅 ↗</a></p></section></main></html>`);
await writeFile(path.join(out,'_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: public, max-age=0, must-revalidate\n');
console.log(`模型展厅已构建：${entries.map(e=>'/'+e.slug+'/').join(', ')}`);
