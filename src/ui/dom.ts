/** Tiny DOM builders. Strings become text nodes, so names are never parsed as HTML. */

export type Child = Node | string;

export function el(tag: string, attrs: Record<string, string>, ...children: Child[]): HTMLElement {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== '' || k === 'hidden') node.setAttribute(k, v);
  node.append(...children);
  return node;
}

export function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export function svgText(text: string, attrs: Record<string, string | number>): SVGElement {
  const node = svgEl('text', attrs);
  node.textContent = text;
  return node;
}
