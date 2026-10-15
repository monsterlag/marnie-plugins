// Checks the self-animating mascot in a real browser. Not part of the plugin: nothing under
// hooks/ imports it. Needs playwright-core, pngjs and dompurify installed beside it or in a
// parent folder, and a Chromium (headless shell is enough):
//
//   npm i playwright-core pngjs dompurify   (in a scratch folder, then run from there)
//   CHROMIUM=<path to chrome-headless-shell> npx tsx <repo>/plugins/pixel-buddy/tools/check-animation.mts [scene]
//
// 1. Frames: for every scene and both cuts, seeks the animated picture's SMIL clock to each
//    tick and compares it with the still frame the scene draws for that moment. Expect 0
//    differing frames (a 2 px difference on the bleed cut's clipped left edge is
//    anti-aliasing the band hides).
// 2. Pipeline: a copy of how desktop 2.37337.1 draws an interactive Svg (its DOMPurify scrub,
//    the sandboxed srcdoc frame and its CSP, and the redraw morph that keeps an unchanged
//    frame), checking that the animations survive the scrub, the picture plays on its own,
//    a redraw with the same picture keeps the same frame, and a new scene gets a new one.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { eventScenes, nativeScenes } from '../hooks/native'
import { animatedBody } from '../hooks/animate'
import { SCENE_BODY_HEIGHT, SCENE_BODY_WIDTH, SCENE_HEIGHT, SCENE_WIDTH, SVG_SOURCE_MAX, animatedSceneSvg, sceneSvg } from '../hooks/scene'

// The browser kit comes from where the tool is run, not from the repo.
const local = createRequire(process.cwd() + '/')
const { chromium } = local('playwright-core') as typeof import('playwright-core')
const { PNG } = local('pngjs') as typeof import('pngjs')
type PNG = import('pngjs').PNG
const only = process.argv[2]
const scenes = [...Object.values(nativeScenes).flat(), ...Object.values(eventScenes)]
  .filter((s, i, a) => a.findIndex(o => o.name === s.name) === i)
  .filter(s => !only || s.name === only)
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const page = await browser.newPage({ deviceScaleFactor: 1 })
const changed = (a: PNG, b: PNG) => {
  let n = 0
  for (let k = 0; k < a.data.length; k += 4)
    if (Math.abs(a.data[k]! - b.data[k]!) + Math.abs(a.data[k + 1]! - b.data[k + 1]!) + Math.abs(a.data[k + 2]! - b.data[k + 2]!) > 40) n++
  return n
}
const ids = (svg: string, tag: string) => svg.replaceAll('id="edge"', `id="edge${tag}"`).replaceAll('url(#edge)', `url(#edge${tag})`).replaceAll('id="fade"', `id="fade${tag}"`).replaceAll('url(#fade)', `url(#fade${tag})`)

let failures = 0
for (const s of scenes) {
  for (const variant of ['bleed', 'inline'] as const) {
    const anim = animatedSceneSvg(s.scene, variant)
    if (!anim) {
      console.log(`${s.name} ${variant}: does not fit as one picture`)
      failures++
      continue
    }
    // The 200 ms build is used where the 100 ms one does not fit (see animatedSceneSvg).
    const step = animatedBody(s.scene, 0.1).length + 2000 > SVG_SOURCE_MAX ? 0.2 : 0.1
    const [w, h] = variant === 'bleed' ? [SCENE_WIDTH, SCENE_HEIGHT] : [SCENE_BODY_WIDTH, SCENE_BODY_HEIGHT]
    await page.setContent(`<body style="margin:0;background:#000"><div id="a" style="width:${w}px;height:${h}px">${anim}</div><div id="b" style="width:${w}px;height:${h}px"></div></body>`)
    let bad = 0
    let worst = 0
    const n = Math.round(s.scene.loop / step)
    for (let i = 0; i < n; i++) {
      const t = Math.round(i * step * 1000) / 1000
      const mid = t + step / 2
      await page.evaluate(([at, still]) => {
        const svg = document.querySelector('#a svg') as SVGSVGElement
        svg.pauseAnimations()
        svg.setCurrentTime(at as number)
        ;(document.getElementById('b') as HTMLElement).innerHTML = still as string
      }, [mid, ids(sceneSvg(s.scene, t, variant, mid), '2')] as const)
      const d = changed(PNG.sync.read(await page.locator('#a').screenshot()), PNG.sync.read(await page.locator('#b').screenshot()))
      if (d) bad++
      worst = Math.max(worst, d)
    }
    if (worst > 2) failures++
    console.log(`${s.name.padEnd(12)} ${variant.padEnd(6)} ${String(anim.length).padStart(6)} chars, ${n} frames at ${step * 1000} ms: ${bad} differ, worst ${worst} px`)
  }
}

// The pipeline copy, from the desktop bundle (functions ul, pl, Dl, uf, df, ff, pf, mf, hf, gf).
const purify = readFileSync(local.resolve('dompurify/dist/purify.min.js'), 'utf8')
await page.setContent('<body style="margin:0;background:#212121"><div id="host"></div></body>')
await page.addScriptTag({ content: purify })
await page.addScriptTag({
  content: `
const il=["animate","set","use"], al=["script","foreignObject","image","a","iframe"], cl=["from","to","calcMode"];
function ol(e){let t=e.trim().toLowerCase().split(":").at(-1)??"";return t!==""&&t!=="href"&&!t.startsWith("on")}
function sl(e,t){return e.startsWith("on")?!1:e==="href"||e==="xlink:href"?t.trim().startsWith("#"):e!=="attributename"||ol(t)}
function ul(e){if(e.length>131072)return null;let t=DOMPurify(window);t.addHook("uponSanitizeAttribute",(e,t)=>{sl(t.attrName,t.attrValue)||(t.keepAttr=!1)});
 let n=Array.from(t.sanitize(e,{USE_PROFILES:{svg:!0,svgFilters:!0},ADD_TAGS:[...il],ADD_ATTR:[...cl],FORBID_TAGS:[...al],ALLOW_DATA_ATTR:!1,ALLOW_UNKNOWN_PROTOCOLS:!1,FORCE_BODY:!0,RETURN_DOM_FRAGMENT:!0}).childNodes).filter(e=>e.nodeType!==Node.TEXT_NODE||e.textContent?.trim()),[r]=n;
 return n.length===1&&r instanceof Element&&r.namespaceURI==="http://www.w3.org/2000/svg"&&r.localName==="svg"?r.outerHTML:null}
const dl="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; script-src 'none'; form-action 'none'";
const fl=":root{color-scheme:light dark}html,body{margin:0;height:100%;background:transparent;overflow:hidden}body>svg{display:block;width:100%;height:100%}";
function pl(e){let t=ul(e);return t===null?null:'<!doctype html><meta http-equiv="Content-Security-Policy" content="'+dl+'"><style>'+fl+'</style>'+t}
function Dl(src,alt,w,h){const a=pl(src);if(a===null)return null;const o=document.createElement("iframe");
 o.setAttribute("sandbox","");o.setAttribute("referrerpolicy","no-referrer");o.setAttribute("loading","lazy");o.setAttribute("title",alt);o.setAttribute("aria-label",alt);o.setAttribute("srcdoc",a);o.setAttribute("style","display:block;max-width:100%;border:0;width:"+w+"px;height:"+h+"px");return o}
function uf(e,t){for(let n of e.getAttributeNames())t.hasAttribute(n)||e.removeAttribute(n);for(let n of t.getAttributeNames()){let r=t.getAttribute(n)??"";e.getAttribute(n)!==r&&e.setAttribute(n,r)}}
function df(e,t,n){let r=e.firstChild,i=null;function a(e){for(;r!==null&&r!==e;){let e=r;(r=r.nextSibling),e.remove()}}uf(e,t);for(let o=t.firstChild;o!==null;o=i){let t=n.get(o);(i=o.nextSibling),t===void 0||!(o instanceof Element)?e.insertBefore(o,r):(a(t),(r=t.nextSibling),df(t,o,n))}a(null)}
const ff=e=>e.matches("iframe")?[e]:[...e.querySelectorAll("iframe")];
function pf(e,t){let n=[e];for(let r=e.parentElement;n[0]!==t&&r!==null;r=r.parentElement)n.unshift(r);return n}
function mf(e,t,n,r){return e.length===t.length&&e.every((e,i)=>{let a=t[i],o=n.get(a);return o===void 0?!r.has(e)&&e.tagName===a.tagName&&!e.hasAttribute("data-hover-anchor")&&!a.hasAttribute("data-hover-anchor"):o===e})}
function hf(e,t){let n=new Map(),r=new Set(),i=ff(e).map(t=>pf(t,e)),a=0;for(let e of ff(t)){let o=pf(e,t),s=i.findIndex((t,i)=>i>=a&&mf(t,o,n,r)&&t.at(-1)?.isEqualNode(e)===!0);s!==-1&&((a=s+1),i[s].forEach((e,t)=>{n.set(o[t],e),r.add(e)}))}return n}
function gf(e,t){let n=hf(e,t);return n.get(t)===e?(df(e,t,n),e):(e.replaceWith(t),t)}
window.draw=(src,stats)=>{const root=document.createElement("div");root.setAttribute("style","display:flex;position:relative");
 const pic=document.createElement("div");pic.setAttribute("style","position:absolute;top:0;left:0");const f=Dl(src,"Claude is working",${SCENE_WIDTH},${SCENE_HEIGHT});if(!f)return false;pic.appendChild(f);root.appendChild(pic);
 const s=document.createElement("span");s.textContent=stats;s.setAttribute("style","margin-left:240px;color:#ccc");root.appendChild(s);
 const host=document.getElementById("host");const sr=host.shadowRoot??host.attachShadow({mode:"open"});const old=sr.firstElementChild;
 if(!old)sr.appendChild(root);else gf(old,root);return true};
window.frameEl=()=>document.getElementById("host").shadowRoot.querySelector("iframe");`,
})
const [first, second] = [nativeScenes.working[0]!, nativeScenes.working[1]!].map(s => animatedSceneSvg(s.scene, 'bleed')!)
const shot = async () => PNG.sync.read(await page.screenshot({ clip: { x: 0, y: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT } }))
const check = (what: string, ok: boolean) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`)
  if (!ok) failures++
}
check('the scrub leaves an svg', await page.evaluate(src => (window as any).draw(src, '41%'), first))
check('every animation survives the scrub', (await page.evaluate(() => (window as any).frameEl().getAttribute('srcdoc').split('<animate').length - 1)) === first.split('<animate').length - 1)
await page.waitForTimeout(800)
await page.evaluate(() => ((window as any).kept = (window as any).frameEl()))
let a = await shot()
await page.waitForTimeout(450)
check('the picture plays on its own', changed(a, await shot()) > 0)
await page.evaluate(src => (window as any).draw(src, '42%'), first)
check('a redraw with the same picture keeps its frame', await page.evaluate(() => (window as any).kept === (window as any).frameEl()))
a = await shot()
await page.waitForTimeout(450)
check('and it keeps playing', changed(a, await shot()) > 0)
await page.evaluate(src => (window as any).draw(src, '42%'), second)
check('another scene gets a new frame', await page.evaluate(() => (window as any).kept !== (window as any).frameEl()))
await browser.close()
console.log(failures ? `${failures} failure(s)` : 'all good')
process.exit(failures ? 1 : 0)
