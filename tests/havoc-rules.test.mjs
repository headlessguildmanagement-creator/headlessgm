import test from 'node:test'
import assert from 'node:assert/strict'
import { havocFeatherGroup, isHavocScheduledEventDay } from '../lib/havoc-rules.js'

test('Guild League Feather rotation keeps proven Havoc anchors', () => {
  assert.equal(havocFeatherGroup('guild_league', '2026-08-25'), 4)
  assert.equal(havocFeatherGroup('guild_league', '2026-08-27'), 3)
  assert.equal(havocFeatherGroup('guild_league', '2026-09-01'), 2)
  assert.equal(havocFeatherGroup('guild_league', '2026-09-03'), 1)
  assert.equal(havocFeatherGroup('guild_league', '2026-09-08'), 4)
})

test('Emperium Overrun Feather rotation keeps proven Havoc anchors', () => {
  assert.equal(havocFeatherGroup('emperium_overrun', '2026-08-30'), 2)
  assert.equal(havocFeatherGroup('emperium_overrun', '2026-09-06'), 3)
  assert.equal(havocFeatherGroup('emperium_overrun', '2026-09-13'), 4)
  assert.equal(havocFeatherGroup('emperium_overrun', '2026-09-20'), 1)
})

test('Havoc event schedule recognizes Tue/Thu GL and Sunday EO', () => {
  assert.equal(isHavocScheduledEventDay('guild_league', '2026-09-01'), true)
  assert.equal(isHavocScheduledEventDay('guild_league', '2026-09-03'), true)
  assert.equal(isHavocScheduledEventDay('guild_league', '2026-09-06'), false)
  assert.equal(isHavocScheduledEventDay('emperium_overrun', '2026-09-06'), true)
  assert.equal(isHavocScheduledEventDay('emperium_overrun', '2026-09-03'), false)
})
