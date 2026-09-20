import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { billingPlanForVariant } from '../../../../lib/billing/plans.mjs'

export const runtime = 'nodejs'

const lifecycleEvents = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_resumed',
  'subscription_expired',
  'subscription_paused',
  'subscription_unpaused',
])

function secureEqualHex(a, b) {
  try {
    const left = Buffer.from(String(a || ''), 'hex')
    const right = Buffer.from(String(b || ''), 'hex')
    return left.length > 0 && left.length === right.length && timingSafeEqual(left, right)
  } catch {
    return false
  }
}

function paidThrough(attributes) {
  const endsAt = attributes?.ends_at ? new Date(attributes.ends_at) : null
  return endsAt && Number.isFinite(endsAt.getTime()) && endsAt.getTime() > Date.now()
}

export async function POST(request) {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })

  const raw = await request.text()
  const signature = request.headers.get('x-signature') || ''
  const expected = createHmac('sha256', secret).update(raw).digest('hex')
  if (!secureEqualHex(signature, expected)) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  let payload
  try { payload = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const eventName = String(payload?.meta?.event_name || request.headers.get('x-event-name') || '')
  if (!lifecycleEvents.has(eventName)) return NextResponse.json({ ok: true, ignored: true })

  const attributes = payload?.data?.attributes || {}
  const subscriptionId = String(payload?.data?.id || '')
  const variantId = Number(attributes.variant_id)
  const mapping = billingPlanForVariant(variantId)
  if (!mapping && eventName !== 'subscription_expired') {
    return NextResponse.json({ error: 'Unknown Lemon Squeezy variant' }, { status: 400 })
  }

  const admin = createAdminClient()
  const custom = payload?.meta?.custom_data || {}
  let guildId = String(custom.guild_id || '').trim()

  if (!guildId && subscriptionId) {
    const { data: existing } = await admin.from('billing_subscriptions').select('guild_id').eq('provider_subscription_id', subscriptionId).maybeSingle()
    guildId = String(existing?.guild_id || '')
  }
  if (!guildId) return NextResponse.json({ error: 'Missing guild mapping' }, { status: 400 })

  const payloadHash = createHash('sha256').update(raw).digest('hex')
  const { data: seen } = await admin.from('billing_webhook_events').select('id').eq('payload_hash', payloadHash).maybeSingle()
  if (seen) return NextResponse.json({ ok: true, duplicate: true })

  const { data: guild } = await admin.from('guilds').select('id,plan_code').eq('id', guildId).maybeSingle()
  if (!guild) return NextResponse.json({ error: 'Guild not found' }, { status: 404 })

  const prior = await admin.from('billing_subscriptions').select('plan_code,billing_period,variant_id').eq('guild_id', guildId).maybeSingle()
  const priorBilling = prior.data
  const resolvedPlan = mapping || (priorBilling ? { planCode: priorBilling.plan_code, billingPeriod: priorBilling.billing_period, variantId: priorBilling.variant_id, productId: attributes.product_id } : null)
  if (!resolvedPlan) return NextResponse.json({ error: 'No billing plan mapping' }, { status: 400 })

  const subscriptionRow = {
    guild_id: guildId,
    provider: 'lemonsqueezy',
    provider_customer_id: attributes.customer_id != null ? String(attributes.customer_id) : null,
    provider_subscription_id: subscriptionId || null,
    provider_order_id: attributes.order_id != null ? String(attributes.order_id) : null,
    product_id: Number(attributes.product_id || resolvedPlan.productId) || null,
    variant_id: Number(attributes.variant_id || resolvedPlan.variantId) || null,
    plan_code: resolvedPlan.planCode,
    billing_period: resolvedPlan.billingPeriod,
    status: String(attributes.status || eventName.replace('subscription_', '')),
    test_mode: Boolean(attributes.test_mode ?? true),
    cancelled: Boolean(attributes.cancelled || eventName === 'subscription_cancelled'),
    customer_email: attributes.user_email || null,
    renews_at: attributes.renews_at || null,
    ends_at: attributes.ends_at || null,
    updated_at: new Date().toISOString(),
  }

  const { error: billingError } = await admin.from('billing_subscriptions').upsert(subscriptionRow, { onConflict: 'guild_id' })
  if (billingError) return NextResponse.json({ error: 'Could not sync subscription' }, { status: 500 })

  const shouldDowngrade = eventName === 'subscription_expired' || (String(attributes.status) === 'expired' && !paidThrough(attributes))
  const nextPlan = shouldDowngrade ? 'free' : resolvedPlan.planCode
  if (nextPlan !== guild.plan_code) {
    const { error: planError } = await admin.from('guilds').update({ plan_code: nextPlan, updated_at: new Date().toISOString() }).eq('id', guildId)
    if (planError) return NextResponse.json({ error: 'Could not update guild plan' }, { status: 500 })
  }

  const { error: eventError } = await admin.from('billing_webhook_events').insert({
    provider: 'lemonsqueezy',
    event_name: eventName,
    payload_hash: payloadHash,
  })
  if (eventError?.code !== '23505' && eventError) return NextResponse.json({ error: 'Could not record webhook' }, { status: 500 })

  return NextResponse.json({ ok: true, plan: nextPlan })
}
