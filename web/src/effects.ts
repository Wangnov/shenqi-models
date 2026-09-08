import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

export function seeded(seed = 42) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const particleVertex = /* glsl */`
attribute vec4 aSeed;
attribute vec3 aColor;
uniform float uTime;
uniform float uForce;
uniform float uDpr;
uniform float uMode;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec3 p=position;
  float t=uTime;
  float a=aSeed.x*6.2831853;
  if(uMode<0.5){
    a+=t*(.055+aSeed.w*.045);
    float r=3.25+(aSeed.y-.5)*.62;
    p=vec3(cos(a)*r, sin(aSeed.z*6.283+t*.07)*.14, sin(a)*r);
    p.y+=sin(a*2.+t*.15)*.10;
    p*=1.+uForce*(.65+aSeed.z);
    p.y+=uForce*sin(aSeed.y*31.+t)*1.4;
  }else if(uMode<1.5){
    float x=mod(position.x+t*(.25+aSeed.w*.55)+14.,28.)-14.;
    p=vec3(x, position.y+sin(x*.38+t*.2+aSeed.x*6.)*.2, position.z);
  }else if(uMode<2.5){
    a+=t*(.06+aSeed.w*.055);
    float r=3.15+(aSeed.y-.5)*.65;
    p=vec3(cos(a)*r,sin(a)*r*.69, sin(a*1.4+aSeed.z*6.)*.65);
    p.y+=(aSeed.z-.5)*.27;
  }else if(uMode<3.5){
    p.y+=sin(t*.08+aSeed.z*20.)*.08;
  }else{
    p.y+=sin(p.x*.42+t*.17)*cos(p.z*.31+t*.07)*.18;
  }
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*mv;
  // A soft footprint spanning several physical pixels prevents moving points
  // from blinking on/off at pixel boundaries. Preserve energy as it expands.
  float desired=(.7+aSeed.w*2.4)*uDpr*(8./max(.1,-mv.z));
  float footprint=clamp(desired,2.8,7.);
  gl_PointSize=footprint;
  vColor=aColor*(1.1+aSeed.w*.9);
  vAlpha=(.28+aSeed.y*.7)*.82*min(1.,pow(desired/footprint,2.));
}`;
const particleFragment = /* glsl */`
uniform float uLife;
varying vec3 vColor;
varying float vAlpha;
void main(){
  float d=length(gl_PointCoord-.5)*2.;
  float a=exp(-4.5*d*d)*(1.-smoothstep(.7,1.,d))*vAlpha;
  gl_FragColor=vec4(vColor,a*uLife);
}`;

export function particles(count: number, mode: number, colorA: string, colorB: string) {
  const random=seeded(72+mode*103), pos=new Float32Array(count*3), seeds=new Float32Array(count*4), colors=new Float32Array(count*3);
  const ca=new THREE.Color(colorA),cb=new THREE.Color(colorB),c=new THREE.Color();
  for(let i=0;i<count;i++){
    pos.set([(random()-.5)*28,(random()-.5)*8,(random()-.5)*22],i*3);
    if(mode===1){pos[i*3+1]=(random()-.5)*1.7;pos[i*3+2]=(random()-.5)*7-2;}
    if(mode===3){pos[i*3]=(random()-.5)*48;pos[i*3+1]=(random()-.5)*27;pos[i*3+2]=-8-random()*24;}
    if(mode===4){pos[i*3]=(random()-.5)*40;pos[i*3+1]=-2.6;pos[i*3+2]=(random()-.5)*28;}
    seeds.set([random(),random(),random(),Math.pow(random(),2)],i*4);
    c.copy(ca).lerp(cb,random());colors.set([c.r,c.g,c.b],i*3);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('aSeed',new THREE.BufferAttribute(seeds,4));geo.setAttribute('aColor',new THREE.BufferAttribute(colors,3));
  const material=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uForce:{value:0},uLife:{value:1},uDpr:{value:1},uMode:{value:mode}},vertexShader:particleVertex,fragmentShader:particleFragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const mesh=new THREE.Points(geo,material);mesh.frustumCulled=false;
  return mesh;
}

export function orbitLines(color:string, radius=3.25, layers=7) {
  const group=new THREE.Group();
  for(let i=0;i<layers;i++){
    const pts=[];
    for(let j=0;j<=256;j++){const a=j/256*Math.PI*2,r=radius+(i-layers/2)*.055;pts.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a*3+i)*.055,Math.sin(a)*r));}
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color,transparent:true,opacity:i%2===0?.20:.09,blending:THREE.AdditiveBlending,depthWrite:false}));group.add(line);
  }
  return group;
}

export function atmosphere(color: string) {
  const material=new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(color)},uTime:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:/* glsl */`
    varying vec2 vUv;uniform vec3 uColor;uniform float uTime;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*noise(p);p=p*2.1+4.3;a*=.5;}return s;}
    void main(){vec2 p=(vUv-.5)*vec2(4.375,2.5);float r=length(p-vec2(.07,0.));float fog=fbm(p*5.+vec2(uTime*.009,0.));float arc=exp(-pow((r-.22)*11.,2.));float strength=arc*fog*.16+exp(-r*r*7.)*.026;gl_FragColor=vec4(uColor*strength,1.);}
  `,depthWrite:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(120,75),material);mesh.position.set(2,1,-18);mesh.renderOrder=-20;return mesh;
}

export function timeDial(){
  const points:THREE.Vector3[]=[];const radius=4.1;
  for(let i=0;i<161;i++){
    const a=(i/160*1.56-.28)*Math.PI;const len=i%10===0?.23:i%5===0?.14:.06;
    points.push(new THREE.Vector3(Math.cos(a)*radius,Math.sin(a)*radius,0),new THREE.Vector3(Math.cos(a)*(radius-len),Math.sin(a)*(radius-len),0));
  }
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:new THREE.Color('#ffb561').multiplyScalar(1.6),transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending}));
}

export function flowRibbon(mode:number,color:string){
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let strip=0;strip<5;strip++)for(let i=0;i<=384;i++){
    const a=i/384*Math.PI*2;
    for(const side of [-1,1]){positions.push(a,side,strip-2);uvs.push(i/384,side*.5+.5);}
    if(i<384){const n=strip*770+i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
  const material=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uColor:{value:new THREE.Color(color)},uMode:{value:mode}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 vUv;varying float vStrip;uniform float uMode;void main(){vUv=uv;vStrip=position.z;float a=position.x,r=3.25+position.z*.077+sin(a*3.+position.z)*.043;vec3 p;if(uMode<.5){p=vec3(cos(a)*r,sin(a*2.+position.z)*.09+position.y*.018,sin(a)*r);}else{p=vec3(cos(a)*r,sin(a)*r*.69,sin(a*1.4+position.z)*.65);p.xy+=vec2(cos(a),sin(a))*position.y*.023;}gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    // Interpolation at a triangle edge can slightly exceed [0, 1]. A negative
    // fractional-power base becomes NaN and contaminates the entire bloom frame.
    fragmentShader:`varying vec2 vUv;varying float vStrip;uniform float uTime;uniform vec3 uColor;void main(){float edge=pow(clamp(1.-abs(vUv.y*2.-1.),0.,1.),1.5);float streak=pow(clamp(.5+.5*sin(vUv.x*12.566-uTime*.16+vStrip),0.,1.),5.);gl_FragColor=vec4(uColor*3.4,edge*(.025+streak*.20));}`,
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;return mesh;
}

export function portalFrame(width:number,height:number){
  const group=new THREE.Group();
  const pts=[new THREE.Vector3(-width/2,-height/2,0),new THREE.Vector3(width/2,-height/2,0),new THREE.Vector3(width/2,height/2,0),new THREE.Vector3(-width/2,height/2,0),new THREE.Vector3(-width/2,-height/2,0)];
  const rimMaterial=new THREE.MeshBasicMaterial({color:new THREE.Color('#abffdb').multiplyScalar(3.2)});
  for(const side of [-1,1]){
    const vertical=new THREE.Mesh(new THREE.BoxGeometry(.015,height,.015),rimMaterial);vertical.position.x=side*width/2;
    const horizontal=new THREE.Mesh(new THREE.BoxGeometry(width,.015,.015),rimMaterial);horizontal.position.y=side*height/2;
    group.add(vertical,horizontal);
  }
  const inset=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#83e6c5',transparent:true,opacity:.27}));inset.scale.set(.965,.975,1);inset.position.z=.04;group.add(inset);
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.ShaderMaterial({uniforms:{uTime:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform float uTime;void main(){float d=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y));float edge=pow(1.-smoothstep(0.,.12,d),2.);float scan=pow(.5+.5*sin(vUv.y*110.+uTime*.8),20.);gl_FragColor=vec4(vec3(.08,.75,.47),edge*.1+scan*.018);}`}));
  plane.name='portal-aperture';group.add(plane);group.userData.portal=true;
  return group;
}

type SampleRecord = { mesh:THREE.Mesh; sampler:MeshSurfaceSampler; area:number; texture?:ImageData; map?:THREE.Texture; color:THREE.Color };
export function sampleSurface(root:THREE.Object3D,count:number){
  root.updateMatrixWorld(true);const records:SampleRecord[]=[];let total=0;const random=seeded(994);
  const tempA=new THREE.Vector3(),tempB=new THREE.Vector3(),tempC=new THREE.Vector3();
  const imageCache=new Map<THREE.Texture,ImageData>();
  root.traverse(o=>{
    if(!(o instanceof THREE.Mesh)||!o.geometry.attributes.position)return;
    const mat=(Array.isArray(o.material)?o.material[0]:o.material) as THREE.MeshPhysicalMaterial;
    if(mat.opacity<.3||mat.transmission>0.3)return;
    const attr=o.geometry.attributes.position,index=o.geometry.index;let area=0;
    for(let j=0;j<(index?index.count:attr.count);j+=3){tempA.fromBufferAttribute(attr,index?index.getX(j):j).applyMatrix4(o.matrixWorld);tempB.fromBufferAttribute(attr,index?index.getX(j+1):j+1).applyMatrix4(o.matrixWorld);tempC.fromBufferAttribute(attr,index?index.getX(j+2):j+2).applyMatrix4(o.matrixWorld);tempB.sub(tempA);tempC.sub(tempA);area+=tempB.cross(tempC).length()*.5;}
    if(!area)return;
    let texture:ImageData|undefined;
    if(mat.map?.image){
      texture=imageCache.get(mat.map);
      if(!texture){try{const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(mat.map.image as CanvasImageSource,0,0,512,512);texture=ctx.getImageData(0,0,512,512);imageCache.set(mat.map,texture);}catch{/* Plain material color remains available. */}}
    }
    total+=area;
    // Three.js exposes this method, but the matching DefinitelyTyped release omits it.
    const sampler=new MeshSurfaceSampler(o) as MeshSurfaceSampler & {setRandomGenerator(fn:()=>number):MeshSurfaceSampler};
    sampler.setRandomGenerator(random).build();records.push({mesh:o,sampler,area:total,texture,map:mat.map??undefined,color:mat.color??new THREE.Color('#fff')});
  });
  if(!records.length)throw new Error('模型中没有可用于粒子的表面');
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3),seeds=new Float32Array(count*4);const p=new THREE.Vector3(),uv=new THREE.Vector2(),c=new THREE.Color();
  const inv=new THREE.Matrix4().copy(root.matrixWorld).invert();
  for(let i=0;i<count;i++){
    const r=random()*total;let lo=0,hi=records.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(records[mid].area<r)lo=mid+1;else hi=mid;}
    const rec=records[lo];rec.sampler.sample(p,undefined,undefined,uv);p.applyMatrix4(rec.mesh.matrixWorld).applyMatrix4(inv);positions.set(p.toArray(),i*3);c.copy(rec.color);
    if(rec.texture&&rec.map){rec.map.transformUv(uv);const tx=((uv.x%1)+1)%1,ty=((uv.y%1)+1)%1;const n=(Math.min(511,Math.floor(ty*512))*512+Math.min(511,Math.floor(tx*512)))*4;const d=rec.texture.data;c.multiply(new THREE.Color().setRGB(d[n]/255,d[n+1]/255,d[n+2]/255,THREE.SRGBColorSpace));}
    colors.set([c.r,c.g,c.b],i*3);seeds.set([random(),random(),random(),random()],i*4);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('aColor',new THREE.BufferAttribute(colors,3));geo.setAttribute('aSeed',new THREE.BufferAttribute(seeds,4));
  const mat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uDissolve:{value:0},uDpr:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:/* glsl */`attribute vec3 aColor;attribute vec4 aSeed;uniform float uTime;uniform float uDissolve;uniform float uDpr;varying vec3 vColor;varying float vAlpha;
      void main(){float f=uDissolve;vec3 p=position;vec3 dir=normalize(position+vec3(aSeed.x-.5,aSeed.y-.5,aSeed.z-.5)*2.);float speed=.8+aSeed.w*3.;float theta=f*2.3;mat2 rot=mat2(cos(theta),-sin(theta),sin(theta),cos(theta));p+=dir*f*speed;p.xz=rot*p.xz;p.y+=sin(aSeed.x*25.+uTime*.5)*f*.5;
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((1.2+aSeed.w*1.5)*uDpr*8./-mv.z,.6,5.);vColor=mix(aColor*1.7,vec3(.55,.76,1.3),f*.35);vAlpha=smoothstep(0.,.15,f)*(.45+aSeed.y*.55);}`,
    fragmentShader:particleFragment,
  });
  const points=new THREE.Points(geo,mat);points.frustumCulled=false;return points;
}
