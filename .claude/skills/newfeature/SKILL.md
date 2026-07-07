---
name: newfeature
description: Scaffold a new feature folder following this repo's ES-module conventions
---

Scaffold a new feature named: $ARGUMENTS

Follow the existing pattern exactly (look at `js/features/budget/` or `js/features/navigation/` as small references — do NOT read the large features):

1. Create `js/features/<name>/index.js` exporting a single `mount(root)` function.
2. Use ES module imports only — never `window.*`. Import services from `js/services/`, helpers from `js/core/`.
3. State: read with `store.getState()`, write with `store.update(patch)` or a domain action; render functions subscribe to the store, never called manually after mutations.
4. If the feature needs styles, create `css/components/<name>.css` and add a `<link>` in `index.html` next to the other component CSS links.
5. Wire it up: import and call `mount()` from `js/main.js`, matching how other features are wired.
6. DOM hooks for JS use `data-role="..."` attributes, never visual CSS classes.

Split into `index.js` + `<name>.model.js` + `<name>.ui.js` only if the feature has real model logic; a small feature stays as a single `index.js`.
