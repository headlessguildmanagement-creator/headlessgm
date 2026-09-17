import test from 'node:test'
import assert from 'node:assert/strict'
import { allocateCapped, eligiblePool, shuffleWith } from '../lib/auction-engine.mjs'

test('per-person cap is never exceeded and excess stays unassigned', () => {
  const members = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const result = allocateCapped('light_dark_feather', 8, members, 2, 'rotation')
  assert.deepEqual(result.rows.map((row) => [row.guild_member_id, row.quantity]), [['a', 2], ['b', 2], ['c', 2]])
  assert.equal(result.unassigned, 2)
})

test('zero cap allocates nothing', () => {
  const result = allocateCapped('puppet_fragment', 4, [{ id: 'a' }, { id: 'b' }], 0, 'queue')
  assert.deepEqual(result.rows, [])
  assert.equal(result.unassigned, 4)
})

test('duplicate pool members cannot receive duplicate shares', () => {
  const result = allocateCapped('time_space_feather', 3, [{ id: 'a' }, { id: 'a' }, { id: 'b' }], 2, 'base')
  assert.deepEqual(result.rows.map((row) => [row.guild_member_id, row.quantity]), [['a', 2], ['b', 1]])
})

test('event eligibility excludes inactive and unavailable members before randomization', () => {
  const pool = eligiblePool([
    { id: 'a', status: 'active' },
    { id: 'b', status: 'active' },
    { id: 'c', status: 'inactive' },
  ], new Set(['b']))
  assert.deepEqual(pool.map((member) => member.id), ['a'])
})

test('random shuffle is injectable for deterministic regression coverage', () => {
  const values = [0, 0]
  let index = 0
  const shuffled = shuffleWith([{ id: 'a' }, { id: 'b' }, { id: 'c' }], () => values[index++] ?? 0)
  assert.deepEqual(shuffled.map((member) => member.id), ['b', 'c', 'a'])
})
