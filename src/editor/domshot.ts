// DOM → canvas for captures of the editor's PANELS (the inspector tabs are HTML, not part of the WebGPU frame __edshot reads back): clone the subtree,
// inline every element's COMPUTED style onto the clone (so the page's stylesheet is not needed inside the image), swap canvases for <img>s of their
// pixels and form controls' live state into attributes, wrap it in an SVG <foreignObject>, load that as an image and draw it. The classic
// 'dom-to-image' route — no dependency, same-origin only, nothing external referenced (the page has no web fonts or remote images), so the canvas
// stays untainted and toBlob works. Chrome renders range / colour / checkbox inputs inside foreignObject with their native look.
const XHTML = 'http://www.w3.org/1999/xhtml';

/** rasterise `root` at `scale` device px per CSS px → a canvas of root's border box */
export async function snapshotElement(root: HTMLElement, scale = 2): Promise<HTMLCanvasElement> {
  const rect = root.getBoundingClientRect(); const W = Math.ceil(rect.width), H = Math.ceil(rect.height);
  const clone = root.cloneNode(true) as HTMLElement;
  inlineTree(root, clone);
  clone.style.margin = '0'; clone.style.position = 'static'; clone.style.inset = 'auto'; clone.style.width = `${W}px`; clone.style.height = `${H}px`;
  const holder = document.createElementNS(XHTML, 'div') as HTMLElement; holder.setAttribute('xmlns', XHTML); holder.style.width = `${W}px`; holder.style.height = `${H}px`; holder.appendChild(clone);
  const xml = new XMLSerializer().serializeToString(holder);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="0" y="0" width="100%" height="100%">${xml}</foreignObject></svg>`;
  const img = new Image(); img.decoding = 'sync';
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('domshot: the SVG would not load (an element serialised badly)')); img.src = url; });
  const out = document.createElement('canvas'); out.width = Math.round(W * scale); out.height = Math.round(H * scale);
  const cx = out.getContext('2d')!; cx.scale(scale, scale); cx.drawImage(img, 0, 0, W, H);
  return out;
}

/** walk the live tree and its clone in step: computed style → inline style, canvas → img, control state → attributes, scroll offsets kept by a negative margin */
function inlineTree(src: Element, dst: Element) {
  if (src instanceof HTMLElement && dst instanceof HTMLElement) {
    const cs = getComputedStyle(src); let text = '';
    for (let i = 0; i < cs.length; i++) { const k = cs[i]; text += `${k}:${cs.getPropertyValue(k)};`; }
    if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) text += 'overflow:hidden;';   // (inside the SVG a scroller draws classic bars that steal width; the scroll offset is kept below)
    dst.setAttribute('style', text);
    if (src instanceof HTMLInputElement) {
      const d = dst as HTMLInputElement;
      if (src.type === 'checkbox' || src.type === 'radio') { if (src.checked) d.setAttribute('checked', ''); else d.removeAttribute('checked'); }
      else d.setAttribute('value', src.value);
    } else if (src instanceof HTMLTextAreaElement) { (dst as HTMLTextAreaElement).textContent = src.value; }
    else if (src instanceof HTMLSelectElement) { const opts = (dst as HTMLSelectElement).options; for (let i = 0; i < opts.length; i++) { if (i === src.selectedIndex) opts[i].setAttribute('selected', ''); else opts[i].removeAttribute('selected'); } }
  }
  if (src instanceof HTMLCanvasElement) {   // a canvas clones EMPTY: stand an <img> of its pixels in its place
    const img = document.createElement('img'); try { img.src = src.toDataURL(); } catch { /* tainted: leave it blank */ }
    img.setAttribute('style', (dst as HTMLElement).getAttribute('style') ?? ''); img.width = src.clientWidth; img.height = src.clientHeight;
    dst.replaceWith(img); return;
  }
  const sk = src.children, dk = dst.children;
  for (let i = 0; i < Math.min(sk.length, dk.length); i++) inlineTree(sk[i], dk[i]);
  // show what is scrolled into view: pull the first child up by the scroll offset (AFTER the children got their own inline styles, which would overwrite it)
  if (src instanceof HTMLElement && src.scrollTop > 0 && dst.firstElementChild instanceof HTMLElement) { const f = dst.firstElementChild as HTMLElement; f.setAttribute('style', `${f.getAttribute('style') ?? ''}margin-top:-${src.scrollTop}px;`); }
}
