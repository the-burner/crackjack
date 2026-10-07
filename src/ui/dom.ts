// @ts-nocheck
// Tiny DOM helpers.

/**
 * Creates an element: h('button', { class: 'btn', onclick: fn }, 'Label').
 * Props starting with "on" become event listeners; `style` may be an object;
 * `dataset` sets data-* attributes; everything else is set as an attribute,
 * except `false`/`null`/`undefined`, which are skipped.
 */
export function h(tag, props = {}, ...children) {
  const el = tag.startsWith('svg:')
    ? document.createElementNS('http://www.w3.org/2000/svg', tag.slice(4))
    : document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'html') el.innerHTML = value;
    else if (key in el && typeof value !== 'string') el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Replaces all children of `el`. */
export function replaceChildren(el, ...children) {
  el.replaceChildren();
  append(el, children);
}
