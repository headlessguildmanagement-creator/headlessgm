import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { billingPlanForVariant } from '../../../../lib/billing/plans.mjs'
import {
  BILLING_WEBHOOK_EVENTS,
  resolveSubscriptionState,
  subscriptionIdFromPayload,
  webhookEventKey,
  webhookFingerprintPayload,
} from '../../../../lib/billing/lifecycle.mjs'

export const runtime = 'nodejs'

const supportedEvents = new Set(BILLING_WEBHOOK_EVENTS)
const subscriptionEvents = new Set(BILLING_WEBHOOK_EVENTS.filter((name) => name.startsWith('subscription_') && !name.startsWith('subscription_payment_')))

function secureEqualHex(a, b) {
  try {
    const left = Buffer.from(String(a || ''), 'hex')
    const right = Buffer.from(String(b || ''), 'hex')
    return left.length > 0 && left.length === right.length && timingSafeEqual(left, right)
  } catch {
    return false
  }
}

async function fetchSubscription(subscriptionId) {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY
  if (!apiKey || !subscriptionId) return null
  const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { Accept: 'application/vnd.api+json', Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Lemon Squeezy subscription lookup failed (${response.status})`)
  const body = await response.json()
  return body?.data || null
}

async function markEvent(admin, eventKey, patch) {
  await admin.from('billing_webhook_events').update(patch).eq('event_key', eventKey)
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
  if (!supportedEvents.has(eventName)) return NextResponse.json({ ok: true, ignored: true })

  let admin = null
  let eventKey = ''
  try {
    admin = createAdminClient()

    const rawPayloadHash = createHash('sha256').update(raw).digest('hex')
    const fingerprint = JSON.stringify(webhookFingerprintPayload(payload))
    const payloadHash = createHash('sha256').update(fingerprint).digest('hex')
    eventKey = webhookEventKey(eventName, payloadHash)
    const custom = payload?.meta?.custom_data || {}
    let subscriptionId = subscriptionIdFromPayload(payload)
    let guildId = String(custom.guild_id || '').trim()
    let existingBilling = null

    if (subscriptionId) {
      const { data, error } = await admin.from('billing_subscriptions').select('*').eq('provider_subscription_id', subscriptionId).maybeSingle()
      if (error) throw new Error(`Could not read subscription mapping: ${error.message}`)
      existingBilling = data
      if (existingBilling?.guild_id && guildId && existingBilling.guild_id !== guildId) {
        return NextResponse.json({ error: 'Subscription belongs to a different guild' }, { status: 409 })
      }
      if (!guildId) guildId = String(existingBilling?.guild_id || '')
    }

    if (!guildId) return NextResponse.json({ error: 'Missing guild mapping' }, { status: 400 })

    const { data: guild, error: guildError } = await admin.from('guilds').select('id,owner_user_id,plan_code').eq('id', guildId).maybeSingle()
    if (guildError) throw new Error(`Could not read guild: ${guildError.message}`)
    if (!guild) return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    if (custom.user_id && String(custom.user_id) !== String(guild.owner_user_id)) {
      return NextResponse.json({ error: 'Checkout owner does not own this guild' }, { status: 403 })
    }

    if (!existingBilling) {
      const { data, error } = await admin.from('billing_subscriptions').select('*').eq('guild_id', guildId).maybeSingle()
      if (error) throw new Error(`Could not read guild billing state: ${error.message}`)
      existingBilling = data
      if (!subscriptionId) subscriptionId = String(existingBilling?.provider_subscription_id || '')
    }

    const resourceType = String(payload?.data?.type || '')
    const resourceId = String(payload?.data?.id || '')
    const { error: claimError } = await admin.from('billing_webhook_events').insert({
      provider: 'lemonsqueezy',
      event_key: eventKey,
      event_name: eventName,
      resource_type: resourceType || null,
      resource_id: resourceId || null,
      guild_id: guildId,
      payload_hash: payloadHash,
      processing_status: 'processing',
    })

    if (claimError?.code === '23505') {
      const { data: priorEvent, error: priorError } = await admin.from('billing_webhook_events').select('processing_status,retry_count').eq('event_key', eventKey).maybeSingle()
      if (priorError) throw new Error(`Could not read prior webhook event: ${priorError.message}`)
      if (priorEvent?.processing_status !== 'failed') return NextResponse.json({ ok: true, duplicate: true })
      await markEvent(admin, eventKey, {
        processing_status: 'processing',
        error_message: null,
        retry_count: Number(priorEvent?.retry_count || 0) + 1,
        received_at: new Date().toISOString(),
      })
    } else if (claimError) {
      throw new Error(`Could not claim webhook event: ${claimError.message}`)
    }

    void rawPayloadHash
    let subscriptionData = null
    if (subscriptionEvents.has(eventName) && String(payload?.data?.type || '') === 'subscriptions') {
      subscriptionData = payload.data
    } else if (!existingBilling && subscriptionId) {
      subscriptionData = await fetchSubscription(subscriptionId)
    }

    const attributes = subscriptionData?.attributes || (
      existingBilling
        ? {
            status: existingBilling.status,
            customer_id: existingBilling.provider_customer_id,
            order_id: existingBilling.provider_order_id,
            product_id: existingBilling.product_id,
            variant_id: existingBilling.variant_id,
            test_mode: existingBilling.test_mode,
            user_email: existingBilling.customer_email,
            renews_at: existingBilling.renews_at,
            ends_at: existingBilling.ends_at,
          }
        : payload?.data?.attributes || {}
    )
    if (!subscriptionId && subscriptionData?.id) subscriptionId = String(subscriptionData.id)

    const mapping = billingPlanForVariant(Number(attributes.variant_id))
    const resolved = resolveSubscriptionState({ eventName, attributes, mapping, prior: existingBilling })
    if (!resolved.planCode || !resolved.billingPeriod) throw new Error('No billing plan mapping')
    if (!mapping && resolved.status !== 'expired') throw new Error('Unknown Lemon Squeezy variant')

    const now = new Date().toISOString()
    const subscriptionRow = {
      guild_id: guildId,
      provider: 'lemonsqueezy',
      provider_customer_id: attributes.customer_id != null ? String(attributes.customer_id) : (existingBilling?.provider_customer_id || null),
      provider_subscription_id: subscriptionId || existingBilling?.provider_subscription_id || null,
      provider_order_id: attributes.order_id != null ? String(attributes.order_id) : (existingBilling?.provider_order_id || null),
      product_id: Number(attributes.product_id || mapping?.productId || existingBilling?.product_id) || null,
      variant_id: Number(attributes.variant_id || mapping?.variantId || existingBilling?.variant_id) || null,
      plan_code: resolved.planCode,
      billing_period: resolved.billingPeriod,
      status: resolved.status,
      payment_status: resolved.paymentStatus,
      test_mode: Boolean(attributes.test_mode ?? existingBilling?.test_mode ?? true),
      cancelled: resolved.cancelled,
      customer_email: attributes.user_email || existingBilling?.customer_email || null,
      renews_at: attributes.renews_at || existingBilling?.renews_at || null,
      ends_at: attributes.ends_at || existingBilling?.ends_at || null,
      refunded_at: resolved.refundedAt,
      last_event_name: eventName,
      last_event_at: now,
      updated_at: now,
    }

    const { error: billingError } = await admin.from('billing_subscriptions').upsert(subscriptionRow, { onConflict: 'guild_id' })
    if (billingError) throw billingError

    if (resolved.entitlementPlan !== guild.plan_code) {
      const { error: planError } = await admin.from('guilds').update({
        plan_code: resolved.entitlementPlan,
        updated_at: now,
      }).eq('id', guildId)
      if (planError) throw planError
    }

    await markEvent(admin, eventKey, { processing_status: 'processed', processed_at: now, error_message: null })
    return NextResponse.json({ ok: true, plan: resolved.entitlementPlan, status: resolved.status })
  } catch (error) {
    const message = String(error?.message || error || 'Webhook processing failed').slice(0, 500)
    if (admin && eventKey) {
      try { await markEvent(admin, eventKey, { processing_status: 'failed', error_message: message }) } catch {}
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
