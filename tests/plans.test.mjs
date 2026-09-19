import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizePlan,
  planCapabilities,
  allowedFeatherModes,
  allowedPuppetModes,
  DEFAULT_OVERVIEW_MODULES,
} from '../lib/plans.mjs'

test('FREE keeps setup simple and blocks paid operational surfaces', () => {
  const plan = planCapabilities('free')
  assert.equal(plan.publicRecruitment, false)
  assert.equal(plan.discord, false)
  assert.equal(plan.rosterImport, false)
  assert.equal(plan.memberLoa, false)
  assert.equal(plan.history, false)
  assert.equal(plan.previousLineup, false)
  assert.equal(plan.rewardCaps, false)
  assert.deepEqual(allowedFeatherModes('free'), ['ffa', 'random'])
  assert.deepEqual(allowedPuppetModes('free'), ['ffa', 'random'])
})

test('GUILD unlocks recruitment, Discord and proven standard auction workflows', () => {
  const plan = planCapabilities('guild')
  assert.equal(plan.publicRecruitment, true)
  assert.equal(plan.discord, true)
  assert.equal(plan.rosterImport, true)
  assert.equal(plan.memberLoa, true)
  assert.equal(plan.history, true)
  assert.equal(plan.previousLineup, true)
  assert.equal(plan.advancedAuction, true)
  assert.equal(plan.customAuction, false)
  assert.ok(allowedFeatherModes('guild').includes('four_group'))
  assert.ok(allowedPuppetModes('guild').includes('round_robin'))
  assert.ok(!allowedFeatherModes('guild').includes('custom'))
})

test('COMMANDER unlocks branding, overview customization and custom auction rules', () => {
  const plan = planCapabilities('commander')
  assert.equal(plan.brandStudio, true)
  assert.equal(plan.customOverview, true)
  assert.equal(plan.rosterImport, true)
  assert.equal(plan.memberLoa, true)
  assert.equal(plan.history, true)
  assert.equal(plan.customAuction, true)
  assert.ok(allowedFeatherModes('commander').includes('custom'))
  assert.ok(allowedPuppetModes('commander').includes('custom'))
  assert.ok(DEFAULT_OVERVIEW_MODULES.length >= 7)
})

test('beta remains an internal COMMANDER-equivalent entitlement', () => {
  assert.equal(normalizePlan('beta'), 'commander')
  assert.equal(planCapabilities('beta').brandStudio, true)
})
