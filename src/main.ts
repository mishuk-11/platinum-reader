// The same page runs the full reader, or (with ?peek) the tiny hold-to-preview window.
if (new URLSearchParams(location.search).has('peek')) await import('./peek-window')
else await import('./app-main')
export {}
