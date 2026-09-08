import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { particles, atmosphere, orbitLines, portalFrame, sampleSurface, timeDial, flowRibbon } from './effects';
import './style.css';

const $ = <T extends HTMLElement = HTMLElement>(selector:string) => document.querySelector<T>(selector)!;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile=()=>innerWidth<=650;
const data=[
  {slug:'wild-dog-milk',hash:'eternity',title:'永恒',en:'ETERNITY',subtitle:'万物消逝，它依然在。',description:'粒子散入无尽虚空，又回到最初的模样。<br>在时间的尽头，仍有一盒野生狗奶。',artifact:'野生狗奶',spec:'保质期：永久',accent:'#a6d3ff',tint:'#548ccd',symbol:'∞',coordinate:'存在，无需期限',action:'按住，解构永恒',hint:'移动探索 · 按住扰动 · 滚动切换'},
  {slug:'chrysanthemum-drink',hash:'space',title:'空间',en:'SPACE',subtitle:'一寸之间，另一个宇宙。',description:'让距离失去意义，让视线穿过边界。<br>这一盒，容得下整个世界。',artifact:'菊花饮料',spec:'净含量：2500 毫升',accent:'#b4edcb',tint:'#34b983',symbol:'↗',coordinate:'距离，不过一种错觉',action:'穿越下一道门',hint:'点击光门穿越 · 移动探索 · 滚动切换'},
  {slug:'chunqiu-sausage',hash:'time',title:'时间',en:'TIME',subtitle:'尚未诞生，已然过期。',description:'昨天在前方，明天在身后。<br>拨动时间，让一切沿来路归还。',artifact:'春秋肠',spec:'2018 生产 · 2008 保质',accent:'#edbd88',tint:'#c96a40',symbol:'↶',coordinate:'先有过去，还是未来',action:'',hint:'拖动时间轴 · 暂停 / 倒流 · 滚动切换'},
];
type ParticleMesh=ReturnType<typeof particles>;
type World={scene:THREE.Scene;anchor:THREE.Group;model:THREE.Group;asset:THREE.Object3D;surface:ReturnType<typeof sampleSurface>;systems:ParticleMesh[];haze:ReturnType<typeof atmosphere>;rings?:THREE.Group;ribbon?:ReturnType<typeof flowRibbon>;dial?:THREE.LineSegments;portals:THREE.Group[];echoes:THREE.Group[];materials:{material:THREE.MeshStandardMaterial;opacity:number}[];clock:number};
let renderer:THREE.WebGLRenderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{
  $('#loading-copy').textContent='此浏览器无法启动 3D 渲染，请使用支持 WebGL 2 的浏览器。';$('#retry').hidden=false;$('#retry').onclick=()=>location.reload();throw new Error('WebGL renderer unavailable');
}
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.setClearColor('#04070c');renderer.info.autoReset=false;
$('#stage').appendChild(renderer.domElement);
const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();const environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,100);camera.position.set(0,.1,10.4);
const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
const worlds:(World|undefined)[]=[undefined,undefined,undefined];const pending=new Map<number,Promise<World>>();
let current=0,ready=false,transitioning=false,dissolve=0,targetDissolve=0,timePosition=24,timeRate=reduced?0:1,portalTravel=0,portalCount=0;
let elapsed=0,activeSeconds=0,lastFrame=performance.now(),lastWheel=0,qualityIndex=0,currentDpr=1,lowQuality=isMobile(),fps=60,frames=0,fpsElapsed=0;
const pointer=new THREE.Vector2(),smoothPointer=new THREE.Vector2();const raycaster=new THREE.Raycaster();
const emptyScene=new THREE.Scene();const composer=new EffectComposer(renderer);const renderPass=new RenderPass(emptyScene,camera);composer.addPass(renderPass);
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.4,.45,2.0);composer.addPass(bloom);composer.addPass(new OutputPass());
if(import.meta.env.DEV&&new URLSearchParams(location.search).has('nobloom'))bloom.enabled=false;

function resize(){
  const mobile=isMobile();lowQuality=qualityIndex===2||(qualityIndex===0&&mobile);
  currentDpr=Math.min(devicePixelRatio,lowQuality?1:1.6);renderer.setPixelRatio(currentDpr);renderer.setSize(innerWidth,innerHeight);composer.setPixelRatio(currentDpr);composer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight;camera.fov=mobile?49:43;camera.updateProjectionMatrix();bloom.strength=lowQuality?.3:.4;
  worlds.forEach(w=>{if(!w)return;w.anchor.position.set(mobile?0:1.85,mobile?1.55:.05,0);w.anchor.scale.setScalar(mobile?.64:1);w.systems.forEach(p=>{p.material.uniforms.uDpr.value=currentDpr;const count=p.geometry.attributes.position.count;p.geometry.setDrawRange(0,lowQuality?Math.floor(count*.48):count);});w.surface.material.uniforms.uDpr.value=currentDpr;w.surface.geometry.setDrawRange(0,lowQuality?12000:36000);});
}
addEventListener('resize',resize);resize();

function echoModel(asset:THREE.Object3D,color:string,opacity:number){
  const group=new THREE.Group();const clone=asset.clone(true);
  clone.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const original=(Array.isArray(o.material)?o.material[0]:o.material) as THREE.MeshStandardMaterial;if(original.opacity<.3){o.visible=false;return;}o.material=new THREE.MeshBasicMaterial({map:original.map,color,transparent:true,opacity,depthWrite:false});});group.add(clone);return group;
}

async function loadWorld(index:number):Promise<World>{
  if(worlds[index])return worlds[index]!;
  if(pending.has(index))return pending.get(index)!;
  const promise=(async()=>{
    const gltf=await loader.loadAsync(`${import.meta.env.BASE_URL}models/${data[index].slug}.glb`,event=>{if(!ready&&event.total)$('#loading-progress').style.width=`${Math.min(76,event.loaded/event.total*76)}%`;});
    const scene=new THREE.Scene();scene.environment=environment;scene.environmentIntensity=.38;scene.fog=new THREE.FogExp2('#04080e',.014);
    const haze=atmosphere(data[index].tint);scene.add(haze);
    const stars=particles(3800,3,index===0?'#6280af':index===1?'#597f77':'#96755b','#d6e6ff');scene.add(stars);
    const ground=particles(7200,4,index===0?'#21416a':index===1?'#1d725a':'#763d2e',data[index].accent);scene.add(ground);
    const anchor=new THREE.Group();scene.add(anchor);
    const model=new THREE.Group();anchor.add(model);
    gltf.scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(gltf.scene),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    if(!Number.isFinite(size.length())||size.length()===0)throw new Error('模型边界无效');
    gltf.scene.position.sub(center);const normalizer=new THREE.Group();normalizer.add(gltf.scene);normalizer.scale.setScalar(index===2?5.25/size.x:3.15/size.y);model.add(normalizer);
    const materials:World['materials']=[];const found=new Set<THREE.Material>();
    gltf.scene.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;o.frustumCulled=true;
      const list=Array.isArray(o.material)?o.material:[o.material];
      for(const mat of list){if(found.has(mat))continue;found.add(mat);const material=mat as THREE.MeshPhysicalMaterial;materials.push({material,opacity:material.opacity});material.transparent=true;material.forceSinglePass=true;material.envMapIntensity=.6;
        // The tiny aluminium clips have degenerate UV tangents. Isotropic highlights
        // avoid NaNs spreading through the HDR bloom chain while retaining metal shading.
        if(material.anisotropy>0)material.anisotropy=0;
        if(material.map)material.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}
    });
    model.updateMatrixWorld(true);const surface=sampleSurface(model,36000);model.add(surface);
    const key=new THREE.DirectionalLight('#f0f5ff',1.5);key.position.set(-3,5,6);scene.add(key);
    const rim=new THREE.DirectionalLight(data[index].accent,1.7);rim.position.set(5,3,-4);scene.add(rim);
    const fill=new THREE.DirectionalLight(index===2?'#ed7c5b':'#b1d4fc',.55);fill.position.set(0,-1,4);scene.add(fill);scene.add(new THREE.AmbientLight('#afc8ec',.2));
    const systems=[stars,ground];const portals:THREE.Group[]=[],echoes:THREE.Group[]=[];
    const world:World={scene,anchor,model,asset:normalizer,surface,systems,haze,portals,echoes,materials,clock:0};
    if(index===0){
      const ringGroup=new THREE.Group();ringGroup.rotation.set(.43,0,.34);
      const dust=particles(32000,0,'#76a8e8','#f1f6ff');ringGroup.add(dust,orbitLines('#9bceff',3.25,10));world.ribbon=flowRibbon(0,'#b2d5ff');ringGroup.add(world.ribbon);anchor.add(ringGroup);systems.push(dust);world.rings=ringGroup;
      const distant=orbitLines('#375a88',4.8,2);distant.rotation.set(-.36,.25,-.6);distant.position.z=-3;anchor.add(distant);
    }else if(index===1){
      const stream=particles(23500,1,'#cb8c31','#ffdc82');stream.position.set(0,-.65,-.5);anchor.add(stream);systems.push(stream);
      for(let i=0;i<4;i++){const frame=portalFrame(3.3,4.7);frame.position.set(-2.7+i*3.4,.15,-1-i*3.5);frame.rotation.y=-.28;anchor.add(frame);portals.push(frame);if(i>0&&i<3){const echo=echoModel(normalizer,'#a5efd5',.30/(i*.4+.6));echo.position.copy(frame.position);echo.position.z-=.2;echo.rotation.y=.6*i;echo.scale.setScalar(.78);anchor.add(echo);echoes.push(echo);}}
      const grid=new THREE.GridHelper(45,40,'#183f35','#102821');grid.position.y=-2.55;(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.5;scene.add(grid);
    }else{
      const dust=particles(26000,2,'#c87535','#ffe1a4');dust.rotation.set(.15,.13,.05);dust.position.z=-.9;anchor.add(dust);systems.push(dust);
      world.ribbon=flowRibbon(2,'#efb365');world.ribbon.rotation.copy(dust.rotation);world.ribbon.position.copy(dust.position);anchor.add(world.ribbon);
      const blue=particles(5200,2,'#315378','#a0c1eb');blue.rotation.z=Math.PI;blue.position.set(.6,-.55,-1.8);blue.scale.setScalar(.83);anchor.add(blue);systems.push(blue);
      const dial=timeDial();dial.position.set(0,-.45,-2.0);dial.scale.setScalar(.94);anchor.add(dial);world.dial=dial;
      for(let i=0;i<2;i++){const echo=echoModel(normalizer,'#c36a49',.15-i*.055);echo.scale.setScalar(.67-i*.2);echo.position.set(.6+i*.8,-1.6-i*.65,-1.5-i*1.3);anchor.add(echo);echoes.push(echo);}
    }
    worlds[index]=world;resize();return world;
  })();pending.set(index,promise);
  try{return await promise;}finally{pending.delete(index);}
}

function updateText(index:number){
  const d=data[index];document.body.dataset.scene=String(index);document.documentElement.style.setProperty('--accent',d.accent);document.documentElement.style.setProperty('--line',index===0?'rgba(163,194,230,.18)':index===1?'rgba(130,213,171,.18)':'rgba(220,166,115,.2)');
  $('#chapter-number').textContent=String(index+1).padStart(2,'0');$('#chapter-en').textContent=d.en;$('#scene-title').innerHTML=`${d.title}<span class="title-period">.</span>`;$('#scene-subtitle').textContent=d.subtitle;$('#scene-description').innerHTML=d.description;$('#artifact-name').textContent=d.artifact;$('#artifact-spec').textContent=d.spec;$('#coordinate-value').textContent=d.symbol;$('#coordinate-label').textContent=d.coordinate;$('#action-label').textContent=d.action;$('#interaction-hint').textContent=isMobile()?(index===0?'按住解构 · 轻触章节切换':index===1?'轻触光门，穿越空间':'拖动时间轴，控制时间'):d.hint;
  $('#action').hidden=index===2;$('#timeline').hidden=index!==2;document.querySelectorAll<HTMLButtonElement>('.chapter').forEach((b,i)=>{b.classList.toggle('active',i===index);if(i===index)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');});
  document.title=`${d.title} · 三神器`;history.replaceState(null,'',`#${d.hash}`);
}

async function switchScene(index:number){
  if(!ready||transitioning||index===current)return;
  transitioning=true;targetDissolve=1;$('#scene-status').textContent=`正在进入${data[index].title}`;
  document.querySelectorAll<HTMLButtonElement>('.chapter').forEach(b=>b.disabled=true);
  try{
    const w=await loadWorld(index);await new Promise(r=>setTimeout(r,reduced?0:470));document.body.classList.add('transitioning');await new Promise(r=>setTimeout(r,reduced?0:360));
    current=index;dissolve=1;targetDissolve=0;portalTravel=0;renderPass.scene=w.scene;updateText(index);resize();updateSound();
    document.body.classList.remove('transitioning');await new Promise(r=>setTimeout(r,reduced?0:520));$('#scene-status').textContent='';
  }catch(error){console.error('Scene load failed',error);$('#scene-status').textContent='场景未能加载，请再次点击章节重试。';targetDissolve=0;document.body.classList.remove('transitioning');}
  finally{transitioning=false;document.querySelectorAll<HTMLButtonElement>('.chapter').forEach(b=>b.disabled=false);}
}

let statusTimeout:ReturnType<typeof setTimeout>;
function status(message:string){clearTimeout(statusTimeout);$('#scene-status').textContent=message;statusTimeout=setTimeout(()=>{$('#scene-status').textContent='';},2200);}
function travel(){if(current!==1||portalTravel>0||transitioning)return;portalTravel=.001;portalCount++;status(`空间折叠 · 第 ${String(portalCount).padStart(2,'0')} 次穿越`);}
function hold(){if(current!==0||!ready||transitioning)return;targetDissolve=1;$('#action').classList.add('holding');$('#action-label').textContent='松开，回到最初';}
function release(){if(!transitioning)targetDissolve=0;$('#action').classList.remove('holding');if(current===0)$('#action-label').textContent=data[0].action;}
$('#action').addEventListener('pointerdown',event=>{if(current===0){event.preventDefault();hold();}});
$('#action').addEventListener('click',()=>{if(current===1)travel();});
$('#action').addEventListener('keydown',event=>{if((event.key===' '||event.key==='Enter')&&!event.repeat&&current===0){event.preventDefault();hold();}});
$('#action').addEventListener('keyup',event=>{if(event.key===' '||event.key==='Enter')release();});
addEventListener('pointerup',release);addEventListener('pointercancel',release);addEventListener('blur',release);
$('#stage').addEventListener('pointerdown',event=>{if(current===0)hold();if(current===1){const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);const world=worlds[1];if(world&&raycaster.intersectObjects(world.portals,true).length)travel();}});
addEventListener('pointermove',event=>{pointer.set(event.clientX/innerWidth*2-1,event.clientY/innerHeight*2-1);});
document.querySelectorAll<HTMLButtonElement>('.chapter').forEach(b=>b.onclick=()=>void switchScene(Number(b.dataset.scene)));
$('.brand').addEventListener('click',e=>{e.preventDefault();void switchScene(0);});
addEventListener('hashchange',()=>{const index=data.findIndex(d=>location.hash===`#${d.hash}`);if(index>=0)void switchScene(index);});
addEventListener('wheel',event=>{if(event.target instanceof HTMLInputElement)return;if(Math.abs(event.deltaY)<16||performance.now()-lastWheel<1600||!ready||transitioning)return;lastWheel=performance.now();void switchScene((current+(event.deltaY>0?1:2))%3);},{passive:true});
addEventListener('keydown',event=>{if(event.target instanceof HTMLInputElement||event.target instanceof HTMLButtonElement||event.target instanceof HTMLAnchorElement)return;if(event.key==='ArrowRight')void switchScene((current+1)%3);if(event.key==='ArrowLeft')void switchScene((current+2)%3);if(event.key==='Escape')release();});
$('#quality').onclick=()=>{qualityIndex=(qualityIndex+1)%3;$('#quality span').textContent=['自动','精细','流畅'][qualityIndex];resize();status(['画质随设备自动调整','精细画质','流畅画质'][qualityIndex]);};
const timeInput=$<HTMLInputElement>('#time-scrub');
function syncTimeUI(){
  $('#time-rate').textContent=timeRate===0?'0.0 ×':`${timeRate>0?'+':'−'}1.0 ×`;
  $('#pause').textContent=timeRate===0?'▷':'Ⅱ';$('#pause').setAttribute('aria-label',timeRate===0?'继续时间':'暂停时间');$('#pause').title=timeRate===0?'继续时间':'暂停时间';$('#pause').setAttribute('aria-pressed',String(timeRate===0));$('#reverse').setAttribute('aria-pressed',String(timeRate<0));
}
$('#pause').onclick=()=>{timeRate=timeRate===0?1:0;syncTimeUI();status(timeRate===0?'时间已冻结 · 仍可移动视角':'时间继续向前');};
$('#reverse').onclick=()=>{timeRate=timeRate<0?1:-1;syncTimeUI();status(timeRate<0?'时间倒流':'时间向前');};
timeInput.addEventListener('input',()=>{timePosition=Number(timeInput.value);timeRate=0;syncTimeUI();});syncTimeUI();

let audioContext:AudioContext|undefined,audioGain:GainNode|undefined,audioNodes:OscillatorNode[]=[],soundOn=false;
function updateSound(){if(!audioContext||!audioGain)return;const t=audioContext.currentTime,f=[55,65.406,49][current];audioNodes.forEach((node,i)=>node.frequency.setTargetAtTime(f*[1,1.5,2.002][i],t,.7));audioGain.gain.setTargetAtTime(soundOn?.022:0,t,.3);}
$('#sound').onclick=async()=>{
  try{if(!audioContext){audioContext=new AudioContext();audioGain=audioContext.createGain();audioGain.gain.value=0;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=450;filter.connect(audioGain);audioGain.connect(audioContext.destination);for(let i=0;i<3;i++){const oscillator=audioContext.createOscillator();oscillator.type='sine';oscillator.connect(filter);oscillator.start();audioNodes.push(oscillator);}}
    await audioContext.resume();soundOn=!soundOn;updateSound();document.body.classList.toggle('sound-on',soundOn);$('#sound').setAttribute('aria-pressed',String(soundOn));$('#sound').setAttribute('aria-label',soundOn?'关闭环境声音':'开启环境声音');$('#sound').title=soundOn?'关闭环境声音':'开启环境声音';
  }catch{status('此浏览器暂时无法播放环境声音。');}
};
document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();if(document.hidden){release();if(audioContext)void audioContext.suspend();}else if(soundOn&&audioContext)void audioContext.resume();});

function frame(now:number){
  requestAnimationFrame(frame);const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;if(document.hidden)return;
  elapsed+=dt;activeSeconds+=dt;
  if(!ready)return;
  const world=worlds[current]!;world.clock+=reduced?0:dt;
  if(current===2){timePosition=(timePosition+dt*timeRate+60)%60;if(document.activeElement!==timeInput)timeInput.value=String(timePosition);}
  const t=current===2?timePosition:world.clock;
  smoothPointer.lerp(pointer,1-Math.exp(-dt*3));
  dissolve=THREE.MathUtils.damp(dissolve,targetDissolve,targetDissolve>dissolve?2.2:3.4,dt);
  world.surface.material.uniforms.uDissolve.value=dissolve;world.surface.material.uniforms.uTime.value=t;world.surface.visible=dissolve>.008;
  const visible=1-THREE.MathUtils.smoothstep(dissolve,.08,.7);
  world.materials.forEach(({material,opacity})=>{material.opacity=opacity*visible;material.depthWrite=visible>.7&&opacity>.8;});
  world.model.position.set(0,Math.sin(t*.45)*.07,0);
  world.model.rotation.set(current===2?.29:.04,current===2?-.1+Math.sin(t*.16)*.04:.32+Math.sin(t*.22)*.10,current===2?-.11+Math.sin(t*.2)*.025:.035+Math.sin(t*.3)*.017);
  if(world.rings){world.rings.rotation.z=.34+Math.sin(t*.12)*.035;world.rings.rotation.y=Math.sin(t*.09)*.06;}
  world.systems.forEach(p=>{p.material.uniforms.uTime.value=t;p.material.uniforms.uForce.value=dissolve*.35;});world.haze.material.uniforms.uTime.value=t;
  if(world.ribbon)world.ribbon.material.uniforms.uTime.value=t;
  if(world.dial)world.dial.rotation.z=-t*.025;
  world.echoes.forEach((echo,i)=>{if(current===2){echo.rotation.z=-.11+Math.sin((t-(i+1)*3)*.2)*.10;echo.position.x=.6+i*.8+Math.sin((t-i*2)*.3)*.15;}else{echo.rotation.y=.5+i*.75+t*.09;}});
  world.portals.forEach((portal,i)=>{portal.position.y=.15+Math.sin(t*.3+i)*.10;portal.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.ShaderMaterial)o.material.uniforms.uTime.value=t;});});
  let zoom=0;
  if(portalTravel>0){portalTravel+=dt/1.7;zoom=Math.sin(Math.min(1,portalTravel)*Math.PI);world.portals.forEach((portal,i)=>{portal.position.z=-1-i*3.5+zoom*3.5;});if(portalTravel>=1)portalTravel=0;}
  if(current===1)world.model.rotation.y+=(portalCount-(portalTravel>0?1-THREE.MathUtils.smoothstep(portalTravel,0,1):0))*Math.PI/2;
  const mobile=isMobile();camera.position.set(smoothPointer.x*(mobile?.13:.25)+zoom*.4,.1-smoothPointer.y*.16,10.4-zoom*7.9);camera.lookAt(zoom*1.4,mobile?.12:.1,0);
  renderer.info.reset();
  if(import.meta.env.DEV&&new URLSearchParams(location.search).has('raw'))renderer.render(world.scene,camera);else composer.render();
  frames++;fpsElapsed+=dt;if(fpsElapsed>=1){fps=frames/fpsElapsed;frames=0;fpsElapsed=0;if(qualityIndex===0&&activeSeconds>8&&fps<28&&currentDpr>1){qualityIndex=2;$('#quality span').textContent='流畅';resize();}}
  // Small read-only diagnostics surface for runtime checks, without exposing scene objects.
  Object.assign(diagnostics,{scene:current,ready,transitioning,dissolve,timePosition,timeRate,portalCount,portalTravel,particles:world.systems.reduce((n,p)=>n+p.geometry.drawRange.count,0),fps:Math.round(fps),loaded:worlds.filter(Boolean).length,drawCalls:renderer.info.render.calls});
}
const diagnostics={scene:0,ready:false,transitioning:false,dissolve:0,timePosition:24,timeRate,portalCount:0,portalTravel:0,particles:0,fps:0,loaded:0,drawCalls:0};
Object.defineProperty(window,'__shenqi',{value:diagnostics,writable:false});
requestAnimationFrame(frame);

async function init(){
  try{
    const initial=Math.max(0,data.findIndex(d=>location.hash===`#${d.hash}`));
    $('#loading-progress').style.width='12%';const world=await loadWorld(initial);current=initial;renderPass.scene=world.scene;updateText(initial);resize();
    $('#loading-copy').textContent='粒子就绪，正在打开边界';$('#loading-progress').style.width='92%';
    await renderer.compileAsync(world.scene,camera);ready=true;$('#loading-progress').style.width='100%';
    setTimeout(()=>$('#loading').classList.add('done'),reduced?0:250);
    for(let i=0;i<3;i++){if(i===initial)continue;await new Promise(r=>setTimeout(r,400));try{await loadWorld(i);}catch(error){console.warn('场景预加载失败，可点击章节重试。',error);}}
  }catch(error){console.error(error);$('#loading-copy').textContent='宇宙暂时未能打开，请检查网络后重试。';$('#retry').hidden=false;$('#retry').onclick=()=>location.reload();}
}
void init();
