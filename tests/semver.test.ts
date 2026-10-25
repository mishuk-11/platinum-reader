import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareVersions as cmp } from '../src/app/semver.ts'

test('numeric parts', () => {
  assert.ok(cmp('0.3.1', '0.3.0') > 0)
  assert.ok(cmp('0.10.0', '0.9.9') > 0)
  assert.equal(cmp('v1.2.3', '1.2.3'), 0)
})

test('release beats its prerelease', () => {
  assert.ok(cmp('0.3.0', '0.3.0-beta') > 0)
  assert.ok(cmp('0.3.0-beta', '0.3.0') < 0)
  assert.ok(cmp('0.3.1-beta', '0.3.0') > 0)
})

test('prereleases compare naturally', () => {
  assert.ok(cmp('0.3.0-beta.2', '0.3.0-beta.1') > 0)
  assert.ok(cmp('0.3.0-beta.10', '0.3.0-beta.9') > 0)
  assert.ok(cmp('0.3.0-rc', '0.3.0-beta') > 0)
})
