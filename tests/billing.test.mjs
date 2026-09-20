import test from 'node:test'
import assert from 'node:assert/strict'
import { billingCatalog, billingPlanForVariant, billingSelection } from '../lib/billing/plans.mjs'
import {
  BILLING_WEBHOOK_EVENTS,
  entitlementPlanForSubscription,
  resolveSubscriptionState,
  subscriptionIdFromPayload,
  webhookEventKey,
} from '../lib/billing/lifecycle.mjs'

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

test('every paid variant maps to plan and billing period', () => {
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

test('requested webhook lifecycle is fully supported', () => {
  assert.deepEqual(BILLING_WEBHOOK_EVENTS, [
    'subscription_created','subscription_updated','subscription_cancelled','subscription_resumed','subscription_expired',
    'subscription_paused','subscription_unpaused','subscription_payment_failed','subscription_payment_success',
    'subscription_payment_recovered','subscription_payment_refunded','subscription_plan_changed','order_refunded',
  ])
})

test('only expired subscriptions lose paid entitlement', () => {
  for (const status of ['active','on_trial','paused','past_due','unpaid','cancelled']) {
    assert.equal(entitlementPlanForSubscription(status, 'guild'), 'guild')
    assert.equal(entitlementPlanForSubscription(status, 'commander'), 'commander')
  }
  assert.equal(entitlementPlanForSubscription('expired', 'guild'), 'free')
})

test('failed payment records failure without downgrading before expiration', () => {
  const state = resolveSubscriptionState({
    eventName:'subscription_payment_failed',
    attributes:{ status:'past_due' },
    mapping:{ planCode:'guild', billingPeriod:'monthly' },
  })
  assert.equal(state.paymentStatus, 'failed')
  assert.equal(state.entitlementPlan, 'guild')
})

test('payment recovery restores payment state', () => {
  const state = resolveSubscriptionState({
    eventName:'subscription_payment_recovered',
    attributes:{ status:'active' },
    mapping:{ planCode:'commander', billingPeriod:'annual' },
    prior:{ payment_status:'failed' },
  })
  assert.equal(state.paymentStatus, 'paid')
  assert.equal(state.entitlementPlan, 'commander')
})

test('refund events are tracked but preserve entitlement until provider says expired', () => {
  const state = resolveSubscriptionState({
    eventName:'subscription_payment_refunded',
    attributes:{ status:'cancelled' },
    mapping:{ planCode:'guild', billingPeriod:'annual' },
    now:'2026-09-20T00:00:00.000Z',
  })
  assert.equal(state.paymentStatus, 'refunded')
  assert.equal(state.refundedAt, '2026-09-20T00:00:00.000Z')
  assert.equal(state.entitlementPlan, 'guild')
})

test('expiration downgrades safely to free without touching guild data', () => {
  const state = resolveSubscriptionState({
    eventName:'subscription_expired',
    attributes:{ status:'expired' },
    mapping:null,
    prior:{ plan_code:'commander', billing_period:'monthly', payment_status:'paid' },
  })
  assert.equal(state.entitlementPlan, 'free')
  assert.equal(state.planCode, 'commander')
})

test('plan changes support GUILD/COMMANDER and monthly/annual transitions', () => {
  for (const variant of [2147276,2147284,2147283,2147285]) {
    const mapping = billingPlanForVariant(variant)
    const state = resolveSubscriptionState({ eventName:'subscription_plan_changed', attributes:{ status:'active' }, mapping })
    assert.equal(state.entitlementPlan, mapping.planCode)
    assert.equal(state.billingPeriod, mapping.billingPeriod)
  }
})

test('webhook idempotency keys distinguish legitimate repeated resource updates', () => {
  assert.equal(webhookEventKey('subscription_updated', 'hash-a'), 'lemonsqueezy:subscription_updated:hash-a')
  assert.equal(webhookEventKey('subscription_updated', 'hash-b'), 'lemonsqueezy:subscription_updated:hash-b')
  assert.notEqual(webhookEventKey('subscription_updated', 'hash-a'), webhookEventKey('subscription_updated', 'hash-b'))
  assert.equal(webhookEventKey('subscription_updated', 'hash-a'), webhookEventKey('subscription_updated', 'hash-a'))
})

test('subscription extraction handles subscription and invoice payloads', () => {
  const payload = { data:{ type:'subscription-invoices', id:'inv_1', attributes:{ subscription_id:123 } } }
  assert.equal(subscriptionIdFromPayload(payload), '123')
  assert.equal(subscriptionIdFromPayload({ data:{ type:'subscriptions', id:'sub_9', attributes:{} } }), 'sub_9')
})
