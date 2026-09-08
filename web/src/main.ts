import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { particles, atmosphere, orbitLines, portalFrame, sampleSurface, timeDial, flowRibbon } from './effects';
import { SceneMusic } from './music';
import { monument, infinityRiver } from './monuments';
import './style.css';

const $ = <T extends HTMLElement = HTMLElement>(selector:string) => document.querySelector<T>(selector)!;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile=()=>innerWidth<=650;
const data=[
  {slug:'wild-dog-milk',hash:'eternity',title:'永恒',en:'ETERNITY',subtitle:'形态会消逝，存在会归来。',description:'让一盒牛奶化为星尘，再从星尘中归来。<br>所谓永恒，是每一次结束之后的重新开始。',artifact:'野生狗奶',spec:'保质期：永久',accent:'#a6d3ff',tint:'#548ccd',symbol:'∞',coordinate:'存在，无需期限',action:'按住，解构永恒',hint:'拖动旋转 · 滚轮缩放 · 开启轮回'},
  {slug:'chrysanthemum-drink',hash:'space',title:'空间',en:'SPACE',subtitle:'距离展开，世界不止一面。',description:'把重叠的空间展开，让不同视角同时存在。<br>门的另一侧，仍是同一件寻常之物。',artifact:'菊花饮料',spec:'净含量：2500 毫升',accent:'#b4edcb',tint:'#34b983',symbol:'↗',coordinate:'距离，不过一种错觉',action:'展开三重空间',hint:'拖动旋转 · 滚轮缩放 · 展开空间'},
  {slug:'chunqiu-sausage',hash:'time',title:'时间',en:'TIME',subtitle:'先有终点，才有开始。',description:'2008 年过期，2018 年才诞生。<br>当结果早于原因，时间还通往哪里？',artifact:'春秋肠',spec:'2018 生产 · 2008 保质',accent:'#edbd88',tint:'#c96a40',symbol:'↶',coordinate:'先有过去，还是未来',action:'',hint:'拖动旋转 · 滚轮缩放 · 拨动因果'},
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
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,180);camera.position.set(0,.1,10.4);
const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
const worlds:(World|undefined)[]=[undefined,undefined,undefined];const pending=new Map<number,Promise<World>>();
let current=0,ready=false,transitioning=false,dissolve=0,targetDissolve=0,timePosition=36,timeRate=reduced?0:1,portalTravel=0,portalCount=0;
const views=Array.from({length:3},()=>({yaw:0,pitch:0,distance:10.4}));
let viewDistance=10.4,eternalCycle=false,cycleClock=0,cycleCount=0,spaceTarget=0,spaceSpread=0,immersive=false;
const monuments=new Map<number,ReturnType<typeof monument>>();
let elapsed=0,activeSeconds=0,lastFrame=performance.now(),qualityIndex=0,currentDpr=1,lowQuality=isMobile(),fps=60,frames=0,fpsElapsed=0;

// Canvas antialiasing does not cover EffectComposer's offscreen targets.
const sceneTarget=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples)});
const emptyScene=new THREE.Scene();const composer=new EffectComposer(renderer,sceneTarget);const renderPass=new RenderPass(emptyScene,camera);composer.addPass(renderPass);
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.32,.45,2.0);composer.addPass(bloom);
const smaa=new SMAAPass();composer.addPass(smaa);composer.addPass(new OutputPass());
if(import.meta.env.DEV&&new URLSearchParams(location.search).has('nobloom'))bloom.enabled=false;

function resize(){
  const mobile=isMobile();lowQuality=qualityIndex===2||(qualityIndex===0&&mobile);
  currentDpr=Math.min(devicePixelRatio,lowQuality?1:1.6);renderer.setPixelRatio(currentDpr);renderer.setSize(innerWidth,innerHeight);composer.setPixelRatio(currentDpr);composer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight;camera.fov=mobile?49:43;camera.updateProjectionMatrix();bloom.strength=lowQuality?.25:.32;
  worlds.forEach(w=>{if(!w)return;w.anchor.position.set(immersive?0:mobile?0:1.85,immersive?0:mobile?1.55:.05,0);w.anchor.scale.setScalar(mobile&&!immersive?.64:1);w.systems.forEach(p=>{p.material.uniforms.uDpr.value=currentDpr;const count=p.geometry.attributes.position.count;p.geometry.setDrawRange(0,lowQuality?Math.floor(count*.48):count);});w.surface.material.uniforms.uDpr.value=currentDpr;w.surface.geometry.setDrawRange(0,lowQuality?12000:36000);});
}
addEventListener('resize',resize);resize();

function echoModel(asset:THREE.Object3D,color:string,opacity:number){
  const group=new THREE.Group();const clone=asset.clone(true);
  clone.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const original=(Array.isArray(o.material)?o.material[0]:o.material) as THREE.MeshStandardMaterial;if(original.opacity<.3){o.visible=false;return;}o.material=new THREE.MeshBasicMaterial({map:original.map,color,transparent:true,opacity,depthWrite:false});});group.add(clone);return group;
}

function inspectionCopy(asset:THREE.Group){
  const copy=asset.clone(true),cache=new Map<THREE.Material,THREE.MeshStandardMaterial>();
  copy.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    const convert=(original:THREE.MeshPhysicalMaterial)=>{
      if(original.transmission>.5){o.visible=false;}
      let material=cache.get(original);
      if(!material){material=new THREE.MeshStandardMaterial({map:original.map,color:original.color,roughness:original.roughness,metalness:original.metalness,normalMap:original.normalMap,side:original.side,alphaMap:original.alphaMap,alphaTest:original.alphaTest});material.envMapIntensity=.6;cache.set(original,material);}
      return material;
    };
    o.material=Array.isArray(o.material)?o.material.map(m=>convert(m as THREE.MeshPhysicalMaterial)):convert(o.material as THREE.MeshPhysicalMaterial);
  });return copy;
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
    const architecture=monument(index);anchor.add(architecture.root);monuments.set(index,architecture);
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
      anchor.add(infinityRiver());
      const ringGroup=new THREE.Group();ringGroup.rotation.set(.43,0,.34);
      const dust=particles(32000,0,'#76a8e8','#f1f6ff');ringGroup.add(dust,orbitLines('#9bceff',3.25,10));world.ribbon=flowRibbon(0,'#b2d5ff');ringGroup.add(world.ribbon);anchor.add(ringGroup);systems.push(dust);world.rings=ringGroup;
      const distant=orbitLines('#375a88',4.8,2);distant.rotation.set(-.36,.25,-.6);distant.position.z=-3;anchor.add(distant);
    }else if(index===1){
      const stream=particles(23500,1,'#cb8c31','#ffdc82');stream.position.set(0,-.65,-.5);anchor.add(stream);systems.push(stream);
      for(let i=0;i<3;i++){
        const frame=portalFrame(3.8,5.2);anchor.add(frame);portals.push(frame);
        if(i!==1){const echo=inspectionCopy(normalizer);echo.userData.baseScale=normalizer.scale.x;echo.rotation.y=i===0?Math.PI*.65:-Math.PI*.6;anchor.add(echo);echoes.push(echo);}
      }
      const grid=new THREE.GridHelper(45,40,'#183f35','#102821');grid.position.y=-2.55;(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.5;scene.add(grid);
    }else{
      const dust=particles(26000,2,'#c87535','#ffe1a4');dust.rotation.set(.15,.13,.05);dust.position.z=-.9;anchor.add(dust);systems.push(dust);
      world.ribbon=flowRibbon(2,'#efb365');world.ribbon.rotation.copy(dust.rotation);world.ribbon.position.copy(dust.position);anchor.add(world.ribbon);
      const blue=particles(5200,2,'#315378','#a0c1eb');blue.rotation.z=Math.PI;blue.position.set(.6,-.55,-1.8);blue.scale.setScalar(.83);anchor.add(blue);systems.push(blue);
      const dial=timeDial();dial.position.set(0,-.45,-2.0);dial.scale.setScalar(.94);anchor.add(dial);world.dial=dial;
      for(let i=0;i<7;i++){const echo=echoModel(normalizer,i<3?'#7c9bbf':'#c36a49',.12-Math.abs(i-3)*.018);echo.scale.setScalar(.78);echo.position.set((i-3)*1.5,-1.2-Math.abs(i-3)*.15,-3-Math.abs(i-3)*2);anchor.add(echo);echoes.push(echo);}
    }
    worlds[index]=world;resize();return world;
  })();pending.set(index,promise);
  try{return await promise;}finally{pending.delete(index);}
}

function updateText(index:number){
  const d=data[index];document.body.dataset.scene=String(index);document.documentElement.style.setProperty('--accent',d.accent);document.documentElement.style.setProperty('--line',index===0?'rgba(163,194,230,.18)':index===1?'rgba(130,213,171,.18)':'rgba(220,166,115,.2)');
  $('#chapter-number').textContent=String(index+1).padStart(2,'0');$('#chapter-en').textContent=d.en;$('#scene-title').innerHTML=`${d.title}<span class="title-period">.</span>`;$('#scene-subtitle').textContent=d.subtitle;$('#scene-description').innerHTML=d.description;$('#artifact-name').textContent=d.artifact;$('#artifact-spec').textContent=d.spec;$('#coordinate-value').textContent=d.symbol;$('#coordinate-label').textContent=d.coordinate;$('#action-label').textContent=d.action;$('#interaction-hint').textContent=isMobile()?'单指旋转 · 双指缩放':d.hint;$('#eternal-controls').hidden=index!==0;$('#spatial-controls').hidden=index!==1;
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
function travel(){
  if(current!==1||transitioning)return;
  spaceTarget=spaceTarget>.5?0:1;portalCount++;
  $<HTMLInputElement>('#space-spread').value=String(spaceTarget);
  $('#action-label').textContent=spaceTarget?'折回同一空间':'展开三重空间';
}
function hold(){if(current!==0||!ready||transitioning)return;eternalCycle=false;syncCycle();targetDissolve=1;$('#action').classList.add('holding');$('#action-label').textContent='松开，回到最初';}
function release(){if(!transitioning)targetDissolve=0;$('#action').classList.remove('holding');if(current===0)$('#action-label').textContent=data[0].action;}
function syncCycle(){$('#cycle').setAttribute('aria-pressed',String(eternalCycle));$('#cycle').textContent=eternalCycle?'凝聚此刻 ∞':'开启永恒轮回 ∞';}
$('#cycle').onclick=()=>{eternalCycle=!eternalCycle;cycleClock=0;syncCycle();};
$('#space-spread').addEventListener('input',()=>{spaceTarget=Number($<HTMLInputElement>('#space-spread').value);$('#action-label').textContent=spaceTarget>.5?'折回同一空间':'展开三重空间';});
$('#action').addEventListener('pointerdown',event=>{if(current===0){event.preventDefault();hold();}});
$('#action').addEventListener('click',()=>{if(current===1)travel();});
$('#action').addEventListener('keydown',event=>{if((event.key===' '||event.key==='Enter')&&!event.repeat&&current===0){event.preventDefault();hold();}});
$('#action').addEventListener('keyup',event=>{if(event.key===' '||event.key==='Enter')release();});
addEventListener('pointerup',release);addEventListener('pointercancel',release);addEventListener('blur',release);
const touches=new Map<number,THREE.Vector2>();let pinchDistance=0;
const stage=$('#stage');
stage.addEventListener('pointerdown',event=>{if(!ready||transitioning)return;stage.setPointerCapture(event.pointerId);touches.set(event.pointerId,new THREE.Vector2(event.clientX,event.clientY));stage.classList.add('dragging');if(touches.size===2){const a=[...touches.values()];pinchDistance=a[0].distanceTo(a[1]);}});
stage.addEventListener('pointermove',event=>{
  const previous=touches.get(event.pointerId);if(!previous)return;
  const dx=event.clientX-previous.x,dy=event.clientY-previous.y;previous.set(event.clientX,event.clientY);
  if(touches.size===1){views[current].yaw+=dx*.007;views[current].pitch=THREE.MathUtils.clamp(views[current].pitch+dy*.006,-1.4,1.4);}
  else{const a=[...touches.values()],distance=a[0].distanceTo(a[1]);if(pinchDistance>0)views[current].distance=THREE.MathUtils.clamp(views[current].distance*pinchDistance/Math.max(distance,1),5.2,22);pinchDistance=distance;}
});
const endPointer=(event:PointerEvent)=>{touches.delete(event.pointerId);if(!touches.size)stage.classList.remove('dragging');pinchDistance=0;};
stage.addEventListener('pointerup',endPointer);stage.addEventListener('pointercancel',endPointer);stage.addEventListener('lostpointercapture',endPointer);
addEventListener('blur',()=>{touches.clear();stage.classList.remove('dragging');});
const zoomBy=(factor:number)=>{views[current].distance=THREE.MathUtils.clamp(views[current].distance*factor,5.2,22);};
$('#zoom-in').onclick=()=>zoomBy(.8);$('#zoom-out').onclick=()=>zoomBy(1.25);
$('#reset-view').onclick=()=>{views[current]={yaw:0,pitch:0,distance:10.4};};
stage.addEventListener('dblclick',()=>{$('#reset-view').click();});
$('#immersive').onclick=()=>{immersive=!immersive;document.body.classList.toggle('immersive',immersive);$('#immersive').setAttribute('aria-pressed',String(immersive));$('#immersive').textContent=immersive?'返回叙事':'沉浸观赏';resize();};
document.querySelectorAll<HTMLButtonElement>('.chapter').forEach(b=>b.onclick=()=>void switchScene(Number(b.dataset.scene)));
$('.brand').addEventListener('click',e=>{e.preventDefault();void switchScene(0);});
addEventListener('hashchange',()=>{const index=data.findIndex(d=>location.hash===`#${d.hash}`);if(index>=0)void switchScene(index);});
addEventListener('wheel',event=>{if((event.target as HTMLElement).closest('input,button,a'))return;event.preventDefault();zoomBy(Math.exp(THREE.MathUtils.clamp(event.deltaY*(event.deltaMode===1?16:1),-200,200)*.0015));},{passive:false});
addEventListener('keydown',event=>{if(event.target instanceof HTMLInputElement||event.target instanceof HTMLButtonElement||event.target instanceof HTMLAnchorElement)return;if(event.key==='ArrowRight')void switchScene((current+1)%3);if(event.key==='ArrowLeft')void switchScene((current+2)%3);if(event.key==='Escape')release();});
$('#quality').onclick=()=>{qualityIndex=(qualityIndex+1)%3;$('#quality span').textContent=['自动','精细','流畅'][qualityIndex];resize();status(['画质随设备自动调整','精细画质','流畅画质'][qualityIndex]);};
const timeInput=$<HTMLInputElement>('#time-scrub');
function syncTimeUI(){
  $('#time-rate').textContent=timeRate===0?'0.0 ×':`${timeRate>0?'+':'−'}1.0 ×`;
  $('#pause').textContent=timeRate===0?'▷':'Ⅱ';$('#pause').setAttribute('aria-label',timeRate===0?'继续时间':'暂停时间');$('#pause').title=timeRate===0?'继续时间':'暂停时间';$('#pause').setAttribute('aria-pressed',String(timeRate===0));$('#reverse').setAttribute('aria-pressed',String(timeRate<0));
}
$('#pause').onclick=()=>{timeRate=timeRate===0?1:0;syncTimeUI();status(timeRate===0?'时间已冻结 · 仍可移动视角':'时间继续向前');};
$('#reverse').onclick=()=>{timeRate=timeRate<0?1:-1;syncTimeUI();status(timeRate<0?'时间倒流':'时间向前');};
timeInput.addEventListener('input',()=>{timePosition=Math.floor(timePosition/60)*60+Number(timeInput.value);timeRate=0;syncTimeUI();});document.querySelectorAll<HTMLButtonElement>('[data-year]').forEach(b=>b.onclick=()=>{timePosition=Number(b.dataset.year);timeInput.value=String(timePosition);timeRate=0;syncTimeUI();});syncTimeUI();

const music=new SceneMusic();
function syncMusicUI(){
  document.body.classList.toggle('sound-on',music.enabled);
  $('#sound').setAttribute('aria-pressed',String(music.enabled));
  const label=music.enabled?`关闭配乐：${music.title}`:'开启史诗配乐';
  $('#sound').setAttribute('aria-label',label);$('#sound').title=label;
  $('#score-title').textContent=music.enabled?music.title:'史诗配乐';
}
function musicFailure(){void music.setEnabled(false);syncMusicUI();status('配乐未能加载，点击声音按钮可重试。');}
function updateSound(){void music.select(current).then(syncMusicUI).catch(musicFailure);}
$('#sound').onclick=async()=>{
  try{
    const enabling=!music.enabled;
    const pending=music.setEnabled(enabling,current);syncMusicUI();
    if(enabling)status('正在加载本章配乐');
    await pending;syncMusicUI();if(music.enabled)status(`正在播放 · ${music.title}`);
  }catch{musicFailure();}
};
document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();if(document.hidden)release();void music.setHidden(document.hidden).catch(musicFailure);});

function frame(now:number){
  requestAnimationFrame(frame);const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;if(document.hidden)return;
  elapsed+=dt;activeSeconds+=dt;
  if(!ready)return;
  const world=worlds[current]!;world.clock+=reduced?0:dt;
  // Keep the animation clock continuous; only the slider wraps at one minute.
  if(current===2){timePosition+=dt*timeRate;if(document.activeElement!==timeInput)timeInput.value=String((timePosition%60+60)%60);}
  const t=current===2?timePosition:world.clock;
  let thematicDissolve=0;
  if(current===0&&eternalCycle){
    cycleClock+=dt;const phase=(cycleClock%18)/18;
    thematicDissolve=Math.pow(Math.sin(phase*Math.PI),4)*.96;
    cycleCount=Math.floor(cycleClock/18);
    $('#epoch').textContent=`第 ${cycleCount+1} 次轮回 · ${phase<.35?'凝聚':phase<.65?'消散':'重生'} · 粒子总数守恒`;
  }else if(current===0){$('#epoch').textContent='同一粒尘埃，会再次成为星辰。';}
  const age=(timePosition%60+60)%60/60;
  if(current===2){
    thematicDissolve=age<.6?.7*(1-THREE.MathUtils.smoothstep(age,.25,.6)):.94*THREE.MathUtils.smoothstep(age,.8,1);
    const year=Math.floor(2000+age*30);
    $('#time-meaning').textContent=age<8/30?`${year} · 尚未诞生，未来已留下倒影。`:age<.6?`${year} · 已经过期，却尚未诞生。`:age<.8?`${year} · 终于诞生，却已过期十年。`:`${year} · 形态散去，过去仍留下痕迹。`;
    $('#coordinate-label').textContent=age<.6?'结果，早于原因':'存在，终成记忆';
  }
  const desiredDissolve=Math.max(targetDissolve,thematicDissolve);
  dissolve=THREE.MathUtils.damp(dissolve,desiredDissolve,desiredDissolve>dissolve?2.2:3.4,dt);
  monuments.get(current)?.update(t,current===2?age:dissolve);
  spaceSpread=THREE.MathUtils.damp(spaceSpread,spaceTarget,2.2,dt);
  if(current===1)$('#space-value').textContent=spaceSpread<.1?'收束 · 一个世界':spaceSpread>.9?'展开 · 三种视角':`正在展开 · ${Math.round(spaceSpread*100)}%`;

  world.surface.material.uniforms.uDissolve.value=dissolve;world.surface.material.uniforms.uTime.value=t;world.surface.visible=dissolve>.008;
  const visible=1-THREE.MathUtils.smoothstep(dissolve,.08,.7);
  world.materials.forEach(({material,opacity})=>{material.opacity=opacity*visible;material.depthWrite=visible>.7&&opacity>.8;});
  world.model.position.set(0,Math.sin(t*.45)*.07,0);
  world.model.rotation.set(current===2?.29:.04,current===2?-.1+Math.sin(t*.16)*.04:.32+Math.sin(t*.22)*.10,current===2?-.11+Math.sin(t*.2)*.025:.035+Math.sin(t*.3)*.017);
  world.model.rotation.x+=views[current].pitch;world.model.rotation.y+=views[current].yaw;
  if(world.rings){world.rings.rotation.z=.34+Math.sin(t*.12)*.035;world.rings.rotation.y=Math.sin(t*.09)*.06;}
  world.systems.forEach(p=>{p.material.uniforms.uTime.value=t;p.material.uniforms.uForce.value=dissolve*.35;});world.haze.material.uniforms.uTime.value=t;
  if(world.ribbon)world.ribbon.material.uniforms.uTime.value=t;
  if(world.dial)world.dial.rotation.z=-t*.025;
  world.echoes.forEach((echo,i)=>{
    if(current===2){const past=t-(i-3)*5;echo.rotation.set(.29+views[current].pitch,-.1+views[current].yaw+Math.sin(past*.16)*.04,-.11+Math.sin(past*.2)*.025);echo.position.y=-1.2-Math.abs(i-3)*.15+Math.sin(past*.2)*.12;}
    else{
      const side=i===0?-1:1;echo.visible=spaceSpread>.025;
      echo.position.set(side*(1+spaceSpread*4.8),0,-5+spaceSpread*3.5);
      echo.rotation.set(views[current].pitch,views[current].yaw+side*2.0,.03);
      echo.scale.setScalar(echo.userData.baseScale*(.55+spaceSpread*.45));
    }
  });
  world.portals.forEach((portal,i)=>{
    const side=i-1;portal.position.set(side*(1+spaceSpread*4.8),0,side===0?-2:-5+spaceSpread*3.5-.6);
    portal.rotation.y=-side*.12*spaceSpread;
    portal.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.ShaderMaterial)o.material.uniforms.uTime.value=t;});
  });
  const extraDistance=current===1?spaceSpread*8.4:0;
  viewDistance=THREE.MathUtils.damp(viewDistance,views[current].distance+extraDistance,5,dt);
  const anchor=world.anchor.position,compensation=1-viewDistance/10.4;
  camera.position.set(anchor.x*compensation,.1+anchor.y*compensation,viewDistance);
  camera.lookAt(camera.position.x,.1+anchor.y*compensation,viewDistance-10);
  renderer.info.reset();
  if(import.meta.env.DEV&&new URLSearchParams(location.search).has('raw'))renderer.render(world.scene,camera);else composer.render();
  frames++;fpsElapsed+=dt;if(fpsElapsed>=1){fps=frames/fpsElapsed;frames=0;fpsElapsed=0;if(qualityIndex===0&&activeSeconds>8&&fps<28&&currentDpr>1){qualityIndex=2;$('#quality span').textContent='流畅';resize();}}
  // Small read-only diagnostics surface for runtime checks, without exposing scene objects.
  Object.assign(diagnostics,{scene:current,ready,transitioning,dissolve,timePosition:(timePosition%60+60)%60,continuousTime:timePosition,timeRate,portalCount,portalTravel,particles:world.systems.reduce((n,p)=>n+p.geometry.drawRange.count,0),fps:Math.round(fps),loaded:worlds.filter(Boolean).length,drawCalls:renderer.info.render.calls,music:music.state,view:{...views[current],actualDistance:viewDistance},spaceSpread,eternalCycle,cycleCount,age});
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
