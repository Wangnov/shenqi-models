import logo from '../public/brand/logo.svg?raw';

// The header is a genuine inline vector with independent CSS timelines.
const slot=document.querySelector<HTMLElement>('#brand-mark')!;
slot.innerHTML=logo;
const mark=slot.querySelector('svg')!;
mark.setAttribute('aria-hidden','true');mark.removeAttribute('aria-labelledby');
const favicon=document.querySelector<HTMLLinkElement>('#animated-favicon')!;
const fallback=favicon.href;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let frames:string[]|undefined,timer:ReturnType<typeof setInterval>|undefined,index=0;
function pause(){if(timer!==undefined)clearInterval(timer);timer=undefined;}
function resume(){
 pause();
 if(reduced.matches||document.hidden){favicon.type="image/svg+xml";favicon.href=fallback;return;}
 if(!frames)return;
 // Pre-rendered 32px frames avoid relying on native animated-favicon support.
 favicon.type="image/png";timer=setInterval(()=>{favicon.href=frames![index++%frames!.length];},125);
}
async function prepare(){
 if(reduced.matches)return;
 try{const response=await fetch(`${import.meta.env.BASE_URL}brand/favicon-frames.json`);if(!response.ok)return;frames=await response.json();resume();}catch{/* The static SVG remains available offline or on request failure. */}
}
document.addEventListener('visibilitychange',()=>{mark.querySelectorAll<SVGElement>('.sq-hand,.sq-space,.sq-flow').forEach(el=>el.style.animationPlayState=document.hidden?'paused':'running');resume();});
reduced.addEventListener('change',()=>{if(!frames&&!reduced.matches)void prepare();else resume();});
addEventListener('pagehide',pause);addEventListener('pageshow',resume);
setTimeout(()=>void prepare(),1600);
