# Writing Quire extensions

An extension is a single JavaScript module (`.js` or `.mjs`) whose default export is a function. Quire calls it once at startup with an API object.

Install one from **⋮ → Extensions → Add extension (.js)…**, then restart Quire.

> Extensions run with full access to the app, like a browser extension. Only install ones you trust.

## Example

```js
// shout.js — adds a selection action and a menu item
export default function (quire) {
  quire.addSelectionAction({
    label: 'Shout',
    run: (text) => quire.toast(text.toUpperCase()),
  })

  quire.addMenuItem({
    label: 'Current page',
    run: () => {
      const v = quire.activeViewer()
      quire.toast(v ? `Page ${v.current + 1} of ${v.doc.pages}` : 'No document open')
    },
  })

  quire.onDocumentOpen((viewer, info) => {
    console.log('Opened', info.title, info.pages, 'pages')
  })
}
```

A ready-to-install copy is in [examples/extensions/shout.js](examples/extensions/shout.js).

## API

| Member | Description |
|---|---|
| `version` | Quire version string |
| `addSelectionAction({ label, run(text) })` | Adds a button to the floating menu that appears over selected text |
| `addMenuItem({ label, run() })` | Adds an item to the ⋮ menu |
| `onDocumentOpen((viewer, { path, pages, title }) => {})` | Runs every time a document finishes opening |
| `activeViewer()` | The viewer of the focused tab: `current` (0-based page), `zoom`, `mode`, `doc.pages`, `goTo(page)`, `next()`, `prev()`, `setZoom(z \| 'width' \| 'page')` |
| `openUrl(url)` | Opens an `http(s)` URL in the default browser |
| `toast(message)` | Shows a short message at the bottom of the window |

Errors thrown by an extension are caught and logged, so they don't crash the reader. Turn on **Settings → Developer mode → Open DevTools** to see them.
