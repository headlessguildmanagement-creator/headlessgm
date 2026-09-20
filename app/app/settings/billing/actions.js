'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import { billingSelection, isLemonTestMode } from '../../../../lib/billing/plans.mjs'
import { billingReturnUrl } from '../../../../lib/billing/url.mjs'
import { LAUNCH_PROMO_CODE, LAUNCH_PROMO_RESERVATION_MINUTES, launchPromoSelection } from '../../../../lib/billing/promo.mjs'

function safe(value) {
  return encodeURIComponent(String(value || '').slice(0, 220))
}

async function ownerContext(guildId) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const { data: guild } = await supabase.from('guilds').select('id,name,slug,owner_user_id,plan_code').eq('id', guildId).maybeSingle()
  if (!guild || guild.owner_user_id !== userId) redirect('/app/settings?error=Guild%20owner%20access%20required.')
  return { supabase, guild, authData, userId }
}

export async function startCheckout(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const planCode = String(formData.get('plan_code') || '').toLowerCase()
  const billingPeriod = String(formData.get('billing_period') || '').toLowerCase()
  const { supabase, guild, authData, userId } = await ownerContext(guildId)

  const selection = billingSelection(planCode, billingPeriod)
  if (!selection?.variantId) redirect(`/${guild.slug}/settings/billing?error=${safe('That billing option is not configured.')}`)

  const apiKey = process.env.LEMON_SQUEEZY_API_KEY
  const storeId = String(process.env.LEMON_SQUEEZY_STORE_ID || '').trim()
  if (!apiKey || !storeId) redirect(`/${guild.slug}/settings/billing?error=${safe('Billing checkout is not configured yet.')}`)

  const { data: existing } = await supabase.from('billing_subscriptions').select('provider_subscription_id,status').eq('guild_id', guild.id).maybeSingle()
  if (existing?.provider_subscription_id && String(existing.status) !== 'expired') {
    redirect(`/${guild.slug}/settings/billing?error=${safe('This guild already has a subscription. Change it below or use Manage billing.')}`)
  }

  const email = String(authData?.claims?.email || '').trim()
  const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: { Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          product_options: { redirect_url: billingReturnUrl(guild.slug), enabled_variants: [selection.variantId] },
          checkout_options: { embed: false, media: true, logo: true, desc: true, discount: true, subscription_preview: true },
          checkout_data: {
            ...(email ? { email } : {}),
            custom: { guild_id: guild.id, user_id: userId, plan_code: planCode, billing_period: billingPeriod },
          },
          test_mode: isLemonTestMode(),
        },
        relationships: {
          store: { data: { type: 'stores', id: storeId } },
          variant: { data: { type: 'variants', id: String(selection.variantId) } },
        },
      },
    }),
    cache: 'no-store',
  })

  const body = await response.json().catch(() => null)
  const checkoutUrl = body?.data?.attributes?.url
  if (!response.ok || !checkoutUrl) {
    const detail = body?.errors?.[0]?.detail || 'Could not create Lemon Squeezy checkout.'
    redirect(`/${guild.slug}/settings/billing?error=${safe(detail)}`)
  }
  redirect(checkoutUrl)
}


export async function startLaunchCheckout(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const planCode = String(formData.get('plan_code') || '').toLowerCase()
  const accepted = String(formData.get('launch_terms') || '') === 'accepted'
  const { supabase, guild, authData, userId } = await ownerContext(guildId)

  if (!accepted) redirect(`/${guild.slug}/settings/billing?error=${safe('Accept the 3-month launch offer terms before checkout.')}`)

  const selection = launchPromoSelection(planCode)
  if (!selection?.productId || !selection?.variantId || !selection?.discountCode) {
    redirect(`/${guild.slug}/settings/billing?error=${safe('The launch offer is not configured yet.')}`)
  }

  const apiKey = process.env.LEMON_SQUEEZY_API_KEY
  const storeId = String(process.env.LEMON_SQUEEZY_STORE_ID || '').trim()
  if (!apiKey || !storeId) redirect(`/${guild.slug}/settings/billing?error=${safe('Billing checkout is not configured yet.')}`)

  const { data: existing } = await supabase.from('billing_subscriptions').select('provider_subscription_id,status').eq('guild_id', guild.id).maybeSingle()
  if (existing?.provider_subscription_id && String(existing.status) !== 'expired') {
    redirect(`/${guild.slug}/settings/billing?error=${safe('The launch offer is only available before a guild starts a paid subscription.')}`)
  }

  const { data: redemptionId, error: reserveError } = await supabase.rpc('reserve_billing_promotion', {
    p_code: LAUNCH_PROMO_CODE,
    p_guild_id: guild.id,
    p_plan_code: planCode,
  })
  if (reserveError || !redemptionId) {
    redirect(`/${guild.slug}/settings/billing?error=${safe(reserveError?.message || 'No launch offer slots are currently available.')}`)
  }

  const email = String(authData?.claims?.email || '').trim()
  const expiresAt = new Date(Date.now() + LAUNCH_PROMO_RESERVATION_MINUTES * 60 * 1000).toISOString()
  const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: { Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          product_options: {
            name: `HeadlessGM ${selection.label} · Launch 30`,
            description: `Prepay the first 3 months with the Launch 30 discount. Renews every 3 months at the standard equivalent price unless cancelled.`,
            redirect_url: billingReturnUrl(guild.slug),
            enabled_variants: [selection.variantId],
          },
          checkout_options: { embed: false, media: true, logo: true, desc: true, discount: false, subscription_preview: true },
          checkout_data: {
            ...(email ? { email } : {}),
            discount_code: selection.discountCode,
            custom: {
              guild_id: guild.id,
              user_id: userId,
              plan_code: planCode,
              billing_period: 'quarterly',
              promotion_code: LAUNCH_PROMO_CODE,
              promotion_redemption_id: String(redemptionId),
            },
          },
          preview: true,
          expires_at: expiresAt,
          test_mode: isLemonTestMode(),
        },
        relationships: {
          store: { data: { type: 'stores', id: storeId } },
          variant: { data: { type: 'variants', id: String(selection.variantId) } },
        },
      },
    }),
    cache: 'no-store',
  })

  const body = await response.json().catch(() => null)
  const checkoutUrl = body?.data?.attributes?.url
  const discountTotal = Number(body?.data?.attributes?.preview?.discount_total || 0)
  if (!response.ok || !checkoutUrl || discountTotal <= 0) {
    await supabase.rpc('release_billing_promotion', { p_redemption_id: redemptionId }).catch(() => null)
    const detail = body?.errors?.[0]?.detail || (discountTotal <= 0 ? 'The launch discount could not be applied.' : 'Could not create Lemon Squeezy checkout.')
    redirect(`/${guild.slug}/settings/billing?error=${safe(detail)}`)
  }

  redirect(checkoutUrl)
}

export async function changeSubscription(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const planCode = String(formData.get('plan_code') || '').toLowerCase()
  const billingPeriod = String(formData.get('billing_period') || '').toLowerCase()
  const { supabase, guild } = await ownerContext(guildId)
  const selection = billingSelection(planCode, billingPeriod)
  if (!selection?.variantId) redirect(`/${guild.slug}/settings/billing?error=${safe('That billing option is not configured.')}`)

  const { data: billing } = await supabase.from('billing_subscriptions').select('provider_subscription_id,status,variant_id,plan_code,billing_period').eq('guild_id', guild.id).maybeSingle()
  if (!billing?.provider_subscription_id || String(billing.status) === 'expired') {
    redirect(`/${guild.slug}/settings/billing?error=${safe('No active paid subscription is connected to this guild.')}`)
  }
  if (Number(billing.variant_id) === Number(selection.variantId)) redirect(`/${guild.slug}/settings/billing`)

  const apiKey = process.env.LEMON_SQUEEZY_API_KEY
  if (!apiKey) redirect(`/${guild.slug}/settings/billing?error=${safe('Billing management is not configured yet.')}`)

  const currentRank = billing.plan_code === 'commander' ? 2 : billing.plan_code === 'guild' ? 1 : 0
  const targetRank = planCode === 'commander' ? 2 : planCode === 'guild' ? 1 : 0
  const tierDowngrade = targetRank < currentRank

  const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(billing.provider_subscription_id)}`, {
    method: 'PATCH',
    headers: { Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      data: {
        type: 'subscriptions',
        id: String(billing.provider_subscription_id),
        attributes: {
          product_id: selection.productId,
          variant_id: selection.variantId,
          ...(tierDowngrade ? { disable_prorations: true } : { invoice_immediately: true }),
        },
      },
    }),
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body?.errors?.[0]?.detail || 'Could not change the Lemon Squeezy subscription.'
    redirect(`/${guild.slug}/settings/billing?error=${safe(detail)}`)
  }
  const returnedVariantId = Number(body?.data?.attributes?.variant_id)
  const portalUpdate = body?.data?.attributes?.urls?.customer_portal_update_subscription
  if (portalUpdate && returnedVariantId !== Number(selection.variantId)) redirect(portalUpdate)
  redirect(`/${guild.slug}/settings/billing?change=pending`)
}

export async function openCustomerPortal(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const { supabase, guild } = await ownerContext(guildId)
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY
  if (!apiKey) redirect(`/${guild.slug}/settings/billing?error=${safe('Billing management is not configured yet.')}`)

  const { data: billing } = await supabase.from('billing_subscriptions').select('provider_subscription_id').eq('guild_id', guild.id).maybeSingle()
  if (!billing?.provider_subscription_id) redirect(`/${guild.slug}/settings/billing?error=${safe('No paid subscription is connected to this guild.')}`)

  const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(billing.provider_subscription_id)}`, {
    headers: { Accept: 'application/vnd.api+json', Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)
  const portalUrl = body?.data?.attributes?.urls?.customer_portal
  if (!response.ok || !portalUrl) redirect(`/${guild.slug}/settings/billing?error=${safe('Could not open the Lemon Squeezy customer portal.')}`)
  redirect(portalUrl)
}
