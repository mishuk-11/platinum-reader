import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findInPage } from '../src/app/search.ts'

// Two lines, each char 10pt wide, 12pt tall.
const line = (text: string, y: number) => ({
  x: 0, y, w: text.length * 10, h: 12, text,
  boxes: [...text].flatMap((_, i) => [i * 10, y, i * 10 + 10, y + 12]),
})
const page = { lines: [line('Hello World', 0), line('world peace', 20)], links: [] }

test('case-insensitive finds both', () => {
  const m = findInPage(page, 'world', false)
  assert.equal(m.length, 2)
  assert.deepEqual(m[0], [[60, 0, 50, 12]])
  assert.deepEqual(m[1], [[0, 20, 50, 12]])
})

test('match case finds only exact', () => {
  assert.equal(findInPage(page, 'world', true).length, 1)
})

test('match across a line break gives one rect per line', () => {
  const m = findInPage(page, 'world\nworld', false)
  assert.equal(m.length, 1)
  assert.equal(m[0].length, 2)
})

test('empty query finds nothing', () => {
  assert.deepEqual(findInPage(page, '', false), [])
})
