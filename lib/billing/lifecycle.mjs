export const BILLING_WEBHOOK_EVENTS = Object.freeze([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_resumed',
  'subscription_expired',
  'subscription_paused',
  'subscription_unpaused',
  'subscription_payment_failed',
  'subscription_payment_success',
  'subscription_payment_recovered',
  'subscription_payment_refunded',
  'subscription_plan_changed',
  'order_refunded',
])

const PAYMENT_FAILED = new Set(['subscription_payment_failed'])
const PAYMENT_PAID = new Set(['subscription_payment_success', 'subscription_payment_recovered'])
const PAYMENT_REFUNDED = new Set(['subscription_payment_refunded', 'order_refunded'])
const PAYMENT_CONFIRMED = new Set(['subscription_payment_success', 'subscription_payment_recovered'])

function isPaidPlan(planCode) {
  return ['guild', 'commander'].includes(String(planCode || '').toLowerCase())
}

function planRank(planCode) {
  const plan = String(planCode || '').toLowerCase()
  if (plan === 'commander') return 2
  if (plan === 'guild') return 1
  return 0
}

export function webhookFingerprintPayload(payload) {
  const meta = payload?.meta && typeof payload.meta === 'object'
    ? Object.fromEntries(Object.entries(payload.meta).filter(([key]) => key !== 'webhook_id'))
    : payload?.meta
  return { ...payload, meta }
}

export function webhookEventKey(eventName, payloadHash) {
  return `lemonsqueezy:${String(eventName || 'unknown')}:${String(payloadHash || 'unknown')}`
}

export function subscriptionIdFromPayload(payload) {
  const type = String(payload?.data?.type || '')
  const attributes = payload?.data?.attributes || {}
  if (type === 'subscriptions') return String(payload?.data?.id || '')
  return String(attributes.subscription_id || '')
}

export function entitlementPlanForSubscription(status, planCode) {
  if (String(status || '').toLowerCase() === 'expired') return 'free'
  return ['guild', 'commander'].includes(planCode) ? planCode : 'free'
}

export function entitlementPlanForEvent({ eventName, status, candidatePlan, currentPlan }) {
  if (String(status || '').toLowerCase() === 'expired') return 'free'

  const candidate = String(candidatePlan || '').toLowerCase()
  const current = String(currentPlan || 'free').toLowerCase()
  if (!isPaidPlan(candidate)) return current

  if (PAYMENT_CONFIRMED.has(eventName)) return candidate
  if (candidate === current) return current

  if (isPaidPlan(current) && planRank(candidate) < planRank(current)) return candidate

  return current
}

export function resolvePaymentStatus(eventName, subscriptionStatus, priorPaymentStatus = null) {
  if (PAYMENT_FAILED.has(eventName)) return 'failed'
  if (PAYMENT_PAID.has(eventName)) return 'paid'
  if (PAYMENT_REFUNDED.has(eventName)) return 'refunded'
  if (['past_due', 'unpaid'].includes(String(subscriptionStatus || '').toLowerCase())) return 'failed'
  return priorPaymentStatus
}

export function resolveSubscriptionState({ eventName, attributes = {}, mapping, prior = null, currentPlan = null, now = new Date().toISOString() }) {
  const planCode = mapping?.planCode || prior?.plan_code || null
  const billingPeriod = mapping?.billingPeriod || prior?.billing_period || null
  const status = String(attributes.status || prior?.status || eventName.replace('subscription_', '') || 'unknown').toLowerCase()
  const entitlementPlan = currentPlan == null
    ? entitlementPlanForSubscription(status, planCode)
    : entitlementPlanForEvent({ eventName, status, candidatePlan: planCode, currentPlan })
  const awaitingUpgradePayment = currentPlan != null &&
    isPaidPlan(planCode) &&
    entitlementPlan !== planCode &&
    planRank(planCode) > planRank(entitlementPlan)

  return {
    planCode,
    billingPeriod,
    status,
    entitlementPlan,
    cancelled: Boolean(attributes.cancelled || status === 'cancelled' || eventName === 'subscription_cancelled'),
    paymentStatus: awaitingUpgradePayment ? 'pending' : resolvePaymentStatus(eventName, status, prior?.payment_status || null),
    refundedAt: PAYMENT_REFUNDED.has(eventName) ? now : (prior?.refunded_at || null),
  }
}
