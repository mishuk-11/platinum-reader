import type { PageText } from '../engine/types.ts'

/** Finds every match on a page; each match becomes one rect per line it spans ([x, y, w, h] in points). */
export function findInPage(page: PageText, query: string, matchCase: boolean): number[][][] {
  if (!query) return []
  // One string per page with '\n' between lines, and a char → (line, index) map.
  let text = ''
  const at: [number, number][] = []
  page.lines.forEach((l, li) => {
    for (let i = 0; i < l.text.length; i++) at.push([li, i])
    at.push([li, -1])
    text += l.text + '\n'
  })
  const hay = matchCase ? text : text.toLowerCase()
  const needle = matchCase ? query : query.toLowerCase()
  const matches: number[][][] = []
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) {
    const rects: number[][] = []
    let cur: number[] | null = null
    let curLine = -1
    for (let k = i; k < i + needle.length; k++) {
      const [li, ci] = at[k]
      if (ci < 0) continue
      const b = page.lines[li].boxes
      const [x0, y0, x1, y1] = [b[ci * 4], b[ci * 4 + 1], b[ci * 4 + 2], b[ci * 4 + 3]]
      if (cur && li === curLine) {
        const r = Math.max(cur[0] + cur[2], x1), bt = Math.max(cur[1] + cur[3], y1)
        cur[0] = Math.min(cur[0], x0); cur[1] = Math.min(cur[1], y0)
        cur[2] = r - cur[0]; cur[3] = bt - cur[1]
      } else {
        cur = [x0, y0, x1 - x0, y1 - y0]
        curLine = li
        rects.push(cur)
      }
    }
    matches.push(rects)
  }
  return matches
}
