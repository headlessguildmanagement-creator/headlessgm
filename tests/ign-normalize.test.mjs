import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeIgn, uniqueIgnMatch } from '../lib/ign-normalize.mjs'

test('IGN normalization handles case, width, punctuation and non-Latin prefixes', () => {
  for (const value of ['汉字OZAWA', 'OZAWA', 'Ozawa', 'ozawa', 'ＯＺＡＷＡ', 'O-ZAWA', 'O_ZAWA']) {
    assert.equal(normalizeIgn(value), 'ozawa')
  }
})

test('IGN matching accepts exactly one normalized roster identity', () => {
  const members = [{ id:'a', ign:'汉字OZAWA' }, { id:'b', ign:'Another' }]
  assert.deepEqual(uniqueIgnMatch(members, 'ozawa'), {
    key:'ozawa',
    member:members[0],
    ambiguous:false,
  })
})

test('IGN matching never guesses when normalized identities collide', () => {
  const members = [{ id:'a', ign:'漢OZAWA' }, { id:'b', ign:'字OZAWA' }]
  assert.deepEqual(uniqueIgnMatch(members, 'OZAWA'), {
    key:'ozawa',
    member:null,
    ambiguous:true,
  })
})

test('IGN matching rejects values without a Latin or numeric matching key', () => {
  assert.deepEqual(uniqueIgnMatch([{ id:'a', ign:'OZAWA' }], '汉字'), {
    key:'',
    member:null,
    ambiguous:false,
  })
})
