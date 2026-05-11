// js/core/dom.js
// Minimal DOM helpers. No jQuery, no framework — just less typing.

/**
 * Query a single element.
 * @template {Element} T
 * @param {string} selector
 * @param {ParentNode} [root]
 * @returns {T | null}
 */
export const $ = (selector, root = document) => /** @type {T|null} */ (root.querySelector(selector));

/**
 * Query all matching elements as a real array.
 * @template {Element} T
 * @param {string} selector
 * @param {ParentNode} [root]
 * @returns {T[]}
 */
export const $$ = (selector, root = document) =>
    /** @type {T[]} */ (Array.from(root.querySelectorAll(selector)));

/**
 * Attach an event listener. Returns an unsubscribe function.
 * @param {EventTarget} el
 * @param {string} event
 * @param {EventListenerOrEventListenerObject} handler
 * @param {boolean | AddEventListenerOptions} [opts]
 */
export function on(el, event, handler, opts) {
    el.addEventListener(event, handler, opts);
    return () => el.removeEventListener(event, handler, opts);
}

/**
 * Delegated event listener. Calls `handler(event, matchedEl)` when an
 * event bubbles up from a descendant matching `selector`.
 * @param {Element} root
 * @param {string} event
 * @param {string} selector
 * @param {(ev: Event, target: Element) => void} handler
 */
export function delegate(root, event, selector, handler) {
    return on(root, event, ev => {
        const target = /** @type {Element | null} */ (ev.target);
        if (!target) return;
        const match = target.closest(selector);
        if (match && root.contains(match)) handler(ev, match);
    });
}

/**
 * Build an element from a tag and attributes. Children may be strings or nodes.
 * @param {string} tag
 * @param {Record<string, any>} [attrs]
 * @param {...(string|Node)} children
 */
export function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') {
            node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (k in node) {
            /** @type {any} */ (node)[k] = v;
        } else {
            node.setAttribute(k, String(v));
        }
    }
    for (const child of children) {
        if (child == null) continue;
        node.append(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
}

/**
 * Show/hide via the `hidden` attribute. Prefer this over `style.display`.
 * @param {Element} element
 * @param {boolean} visible
 */
export function setVisible(element, visible) {
    if (visible) element.removeAttribute('hidden');
    else element.setAttribute('hidden', '');
}
