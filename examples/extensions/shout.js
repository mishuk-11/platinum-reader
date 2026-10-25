// Example Platinum Reader extension. Install: ⋮ → Extensions → Add extension (.js)…
export default function (reader) {
  reader.addSelectionAction({
    label: 'Shout',
    run: (text) => reader.toast(text.toUpperCase()),
  })

  reader.addMenuItem({
    label: 'Current page',
    run: () => {
      const v = reader.activeViewer()
      reader.toast(v ? `Page ${v.current + 1} of ${v.doc.pages}` : 'No document open')
    },
  })

  reader.onDocumentOpen((viewer, info) => {
    console.log('Opened', info.title, info.pages, 'pages')
  })
}
