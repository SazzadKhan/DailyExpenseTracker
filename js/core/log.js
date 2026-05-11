// js/core/log.js
// Tiny prefixed logger. Use `log('expenses').info('...')` per feature so
// console output is easy to filter.

const noop = () => {};

const DEBUG = (() => {
    try { return localStorage.getItem('debug') === '1'; } catch { return false; }
})();

/**
 * @param {string} scope
 */
export function log(scope) {
    const tag = `[${scope}]`;
    return {
        debug: DEBUG ? console.debug.bind(console, tag) : noop,
        info:  console.info.bind(console, tag),
        warn:  console.warn.bind(console, tag),
        error: console.error.bind(console, tag)
    };
}
