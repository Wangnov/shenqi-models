import * as THREE from 'three';
import { seeded } from './effects';

/** Distant architecture gives the foreground relic a readable, enormous scale. */
export function monument(theme: number) {
  const root = new THREE.Group();
  const color = new THREE.Color(['#87b8ed', '#59d5ad', '#dda56d'][theme]);
  const rings = new THREE.Group();
  root.add(rings);
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.8 + i * 1.1, .018 + i * .002, 5, 256),
      new THREE.MeshBasicMaterial({color: color.clone().multiplyScalar(1.2), transparent: true, opacity: .18 + (i % 2) * .12, depthWrite: false}));
    ring.position.z = -6 - i * 1.7;
    ring.rotation.set(.12 * i, -.08 * i, 0);
    rings.add(ring);
  }
  const random = seeded(741 + theme), dummy = new THREE.Object3D();
  const stone = new THREE.MeshStandardMaterial({color: color.clone().multiplyScalar(.055), metalness: .35, roughness: .78});
  const pillars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stone, 72);
  for (let i = 0; i < 72; i++) {
    const angle = i / 72 * Math.PI * 2, radius = 12 + random() * 10;
    dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, -18 - random() * 28);
    dummy.rotation.set(random() * .25, random() * Math.PI, angle);
    dummy.scale.set(.15 + random() * .25, .8 + random() * 2.4, .25 + random() * .5);
    dummy.updateMatrix(); pillars.setMatrixAt(i, dummy.matrix);
  }
  root.add(pillars);
  // A world-space galaxy, with opaque core silhouettes and softly sampled stars.
  const count = 12000, positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 4 + Math.pow(random(), .65) * 25;
    const angle = radius * .21 + (i % 4) * Math.PI / 2 + (random() - .5) * .6;
    positions.set([Math.cos(angle) * radius, Math.sin(angle) * radius * .35 + (random() - .5), -38 + Math.sin(angle) * radius * .35], i * 3);
    colors.set(color.clone().lerp(new THREE.Color('#fff1d3'), random() * .55).toArray(), i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(geometry, new THREE.ShaderMaterial({
    uniforms:{uLife:{value:1}},vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vColor;void main(){vColor=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=2.8;}`,
    fragmentShader: `uniform float uLife;varying vec3 vColor;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(vColor,exp(-4.*r*r)*(1.-smoothstep(.7,1.,r))*.28*uLife);}`,
  }));
  root.add(stars);
  const eclipse = new THREE.Mesh(new THREE.SphereGeometry(5.2, 64, 32), new THREE.MeshStandardMaterial({color:'#030810',roughness:.92}));
  eclipse.position.set(-9, 6, -28);root.add(eclipse);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(5.3, .045, 8, 192),new THREE.MeshBasicMaterial({color:color.clone().multiplyScalar(1.8),transparent:true,opacity:.55}));
  halo.position.copy(eclipse.position);root.add(halo);
  return {root, rings, pillars, stars, update(t: number, entropy: number) {
    if(theme===0){
      const life=Math.pow(Math.sin(entropy*Math.PI),2);
      const expansion=.18+entropy*2.1;
      stars.scale.set(expansion,expansion,1);stars.material.uniforms.uLife.value=life;
      rings.scale.setScalar(.12+expansion*1.3);
      rings.children.forEach((o,i)=>{((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity=(.18+(i%2)*.12)*life;});
      pillars.scale.setScalar(expansion);stone.transparent=true;stone.opacity=life;
      eclipse.scale.setScalar(.15+life);halo.scale.copy(eclipse.scale);halo.material.opacity=.55*life;
      rings.rotation.z=t*.008;stars.rotation.z=t*.003;
      return;
    }
    rings.rotation.z = t * .008;
    stars.rotation.z = t * .003;
    pillars.rotation.z = t * -.002;
    pillars.scale.setScalar(1 + entropy * .28);
    rings.scale.setScalar(1 + entropy * .15);
  }};
}

export function infinityRiver() {
  const curve = new THREE.CatmullRomCurve3(Array.from({length:257}, (_, i) => {
    const a = i / 256 * Math.PI * 2, denominator = 1 + Math.sin(a) ** 2;
    return new THREE.Vector3(6 * Math.cos(a) / denominator, 3 * Math.sin(a) * Math.cos(a) / denominator, Math.sin(a) * 1.3 - 2);
  }));
  const group = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 384, .018 + i * .012, 6, true),new THREE.MeshBasicMaterial({color:'#9fcaff',transparent:true,opacity:.32 / (i + 1),depthWrite:false,blending:THREE.AdditiveBlending}));
    tube.scale.setScalar(1 + i * .035);group.add(tube);
  }
  return group;
}

/** Date inscriptions belong to the 3D installation and remain in immersion. */
export function chronology(){
  const root=new THREE.Group();root.position.set(0,-2.5,-2);
  function inscription(text:string,color:string,width:number){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;
    const ctx=canvas.getContext('2d')!;ctx.font='500 52px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,512,64);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/8),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));return mesh;
  }
  const ticks:number[]=[];
  for(let year=0;year<=30;year++){const x=(year-15)*.32;ticks.push(x,0,0,x,year%5===0?.25:.12,0);}
  ticks.push(-4.8,0,0,4.8,0,0);
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(ticks,3)),new THREE.LineBasicMaterial({color:'#cca77f',transparent:true,opacity:.65})));
  const end=inscription('2008 · 已经过期','#9cbfef',3);end.position.set(-2.24,.65,0);root.add(end);
  const start=inscription('2018 · 才被生产','#ffd6a3',3);start.position.set(.96,.65,0);root.add(start);
  const gap=inscription('←  保质期：负十年  →','#ffb77c',4.5);gap.position.set(-.64,-.65,0);root.add(gap);
  const span=new THREE.Mesh(new THREE.BoxGeometry(3.2,.035,.035),new THREE.MeshBasicMaterial({color:'#db9163'}));span.position.set(-.64,-.22,0);root.add(span);
  const cursor=new THREE.Mesh(new THREE.SphereGeometry(.065,12,8),new THREE.MeshBasicMaterial({color:'#fff4e3'}));root.add(cursor);
  const marker=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-.15,0),new THREE.Vector3(0,.38,0)]),new THREE.LineBasicMaterial({color:'#fff2d9'}));root.add(marker);
  return{root,update(age:number){cursor.position.x=marker.position.x=(age-.5)*9.6;}};
}
