// Tiny DOM helpers.

/** Anything `h()` accepts as a child; `null`, `undefined` and `false` are skipped. */
export type Child = Node | string | number | null | undefined | false;
/** Children may be nested in arrays, which are flattened. */
export type Children = Child | readonly Children[];

type AttrValue = string | number | boolean | null | undefined;

/** `onclick`, `onchange`, ...: added with addEventListener. */
export type EventProps = {
  [E in keyof HTMLElementEventMap as `on${E}`]?: ((event: HTMLElementEventMap[E]) => void) | null;
};

export type Props = EventProps & {
  class?: string | null;
  style?: Partial<CSSStyleDeclaration>;
  dataset?: Record<string, string>;
  /** Sets innerHTML. */
  html?: string;
  id?: string;
  title?: string;
  role?: string;
  type?: string;
  name?: string;
  value?: string | number;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  inputmode?: string;
  tabindex?: string | number;
  hidden?: boolean;
  disabled?: boolean;
  checked?: boolean;
  [attr: `data-${string}`]: AttrValue;
  [attr: `aria-${string}`]: AttrValue;
};

const isListener = (value: unknown): value is EventListener => typeof value === 'function';

/**
 * Creates an element: h('button', { class: 'btn', onclick: fn }, 'Label').
 * Props starting with "on" become event listeners; `style` may be an object;
 * `dataset` sets data-* attributes; everything else is set as an attribute,
 * except `false`/`null`/`undefined`, which are skipped.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: Children[]
): HTMLElementTagNameMap[K];
export function h<K extends keyof SVGElementTagNameMap>(
  tag: `svg:${K}`,
  props?: Props | null,
  ...children: Children[]
): SVGElementTagNameMap[K];
export function h(tag: string, props: Props | null = {}, ...children: Children[]): HTMLElement | SVGElement {
  const el = tag.startsWith('svg:')
    ? document.createElementNS('http://www.w3.org/2000/svg', tag.slice(4))
    : document.createElement(tag);
  const entries: [string, unknown][] = Object.entries(props ?? {});
  for (const [key, value] of entries) {
    if (value === false || value === null || value === undefined) continue;
    if (key.startsWith('on') && isListener(value)) el.addEventListener(key.slice(2), value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'html') el.innerHTML = String(value);
    else if (key in el && typeof value !== 'string') Reflect.set(el, key, value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  append(el, children);
  return el;
}

function append(el: Element, children: readonly Children[]): void {
  for (const child of children) {
    if (Array.isArray(child)) append(el, child);
    else if (child === null || child === undefined || child === false) continue;
    else el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Replaces all children of `el`. */
export function replaceChildren(el: Element, ...children: Children[]): void {
  el.replaceChildren();
  append(el, children);
}
