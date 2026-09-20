import test from 'node:test'
import assert from 'node:assert/strict'
import { billingCatalog, billingPlanForVariant, billingSelection } from '../lib/billing/plans.mjs'

test('test-mode Lemon Squeezy catalog uses the configured HeadlessGM products', () => {
  const catalog = billingCatalog()
  assert.equal(catalog.guild.monthly.productId, 1374346)
  assert.equal(catalog.guild.monthly.variantId, 2147276)
  assert.equal(catalog.guild.annual.productId, 1374352)
  assert.equal(catalog.guild.annual.variantId, 2147284)
  assert.equal(catalog.commander.monthly.productId, 1374351)
  assert.equal(catalog.commander.monthly.variantId, 2147283)
  assert.equal(catalog.commander.annual.productId, 1374353)
  assert.equal(catalog.commander.annual.variantId, 2147285)
})

test('variant mapping resolves plan and billing period', () => {
  assert.deepEqual(billingPlanForVariant(2147276), { planCode:'guild', billingPeriod:'monthly', productId:1374346, variantId:2147276 })
  assert.deepEqual(billingPlanForVariant(2147284), { planCode:'guild', billingPeriod:'annual', productId:1374352, variantId:2147284 })
  assert.deepEqual(billingPlanForVariant(2147283), { planCode:'commander', billingPeriod:'monthly', productId:1374351, variantId:2147283 })
  assert.deepEqual(billingPlanForVariant(2147285), { planCode:'commander', billingPeriod:'annual', productId:1374353, variantId:2147285 })
  assert.equal(billingPlanForVariant(999), null)
})

test('billing selection rejects unsupported plan and period values', () => {
  assert.equal(billingSelection('free', 'monthly'), null)
  assert.equal(billingSelection('guild', 'weekly'), null)
  assert.equal(billingSelection('commander', 'annual').variantId, 2147285)
})
