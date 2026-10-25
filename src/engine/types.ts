export interface OutlineItem { title: string; page: number; depth: number }
export interface Link { x: number; y: number; w: number; h: number; page?: number; uri?: string }
export interface TextLine {
  x: number; y: number; w: number; h: number
  text: string
  /** x0,y0,x1,y1 per character, flattened */
  boxes: number[]
}
export interface PageText { lines: TextLine[]; links: Link[] }
export interface OpenResult {
  pages: number
  /** page size in points */
  sizes: [number, number][]
  outline: OutlineItem[]
  meta: Record<string, string>
}
