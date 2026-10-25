// Example Quire extension. Install: ⋮ → Extensions → Add extension (.js)…
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
