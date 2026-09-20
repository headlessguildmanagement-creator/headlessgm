import { redirect } from 'next/navigation'
import AppShell from '../../../../components/app-shell'
import { createClient } from '../../../../lib/supabase/server'
import { resolveGuild } from '../../../../lib/guild-context'
import { billingIntegrationReady, isLemonTestMode } from '../../../../lib/billing/plans.mjs'
import { changeSubscription, openCustomerPortal, startCheckout } from './actions'

const offers = [
  { planCode:'guild', label:'GUILD', monthly:'$15.99', annual:'$144', copy:'HeadlessGM’s complete standard operating system: automation, organized bidding, recruitment, Discord, history and backup.' },
  { planCode:'commander', label:'COMMANDER', monthly:'$24.99', annual:'$225', copy:'Everything in GUILD plus deep customization for rules, workflows, permissions, dashboard, recruitment and branding.' },
]

export default async function BillingPage({ searchParams }) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const params = await searchParams
  const guild = await resolveGuild(supabase, params?.guild, 'id,name,slug,owner_user_id,plan_code')
  if (!guild) redirect('/app/onboarding')
  if (guild.owner_user_id !== userId) redirect(`/${guild.slug}/settings?error=Guild%20owner%20access%20required.`)

  const { data: billing } = await supabase.from('billing_subscriptions').select('*').eq('guild_id', guild.id).maybeSingle()
  const ready = billingIntegrationReady()
  const testMode = isLemonTestMode()
  const hasSubscription = Boolean(billing?.provider_subscription_id && billing?.status !== 'expired')
  const planRank = (code) => code === 'commander' ? 2 : code === 'guild' ? 1 : 0
  const pendingDowngrade = Boolean(billing?.plan_code && planRank(billing.plan_code) < planRank(guild.plan_code))
  const pendingUpgrade = Boolean(billing?.plan_code && planRank(billing.plan_code) > planRank(guild.plan_code))
  const effectiveDate = billing?.renews_at || billing?.ends_at
  const targetOffer = offers.find((item) => item.planCode === billing?.plan_code)
  const targetPrice = targetOffer ? (billing?.billing_period === 'annual' ? targetOffer.annual : targetOffer.monthly) : null

  return (
    <AppShell guildName={guild.name} guildSlug={guild.slug} title="Billing" activeHref="/app/settings">
      {params?.error ? <div className="notice error">{String(params.error)}</div> : null}
      {params?.checkout === 'success' ? <div className="notice success">Checkout finished. Lemon Squeezy is confirming the subscription through the signed webhook. Plan access updates from the verified webhook, not from this return page.</div> : null}
      {params?.change === 'pending' ? <div className="notice success">Lemon Squeezy accepted the subscription change. Paid upgrades are invoiced immediately, and higher-tier access unlocks only after the signed successful-payment webhook confirms the charge.</div> : null}
      {testMode ? <div className="notice"><strong>TEST MODE</strong> · Checkout uses Lemon Squeezy test data and cannot charge a real customer.</div> : null}
      {!ready ? <div className="notice error"><strong>Billing integration setup is incomplete.</strong> The server billing variables must be available before checkout can run.</div> : null}

      <section className="panel panel-pad">
        <div className="section-head"><div><h2>Current subscription</h2><p>Lemon Squeezy is the billing authority. HeadlessGM changes plan access only from verified subscription webhooks.</p></div><span className="pill">{String(guild.plan_code).toUpperCase()}</span></div>
        <div className="event-readiness-strip">
          <div><small>Plan</small><strong>{String(guild.plan_code).toUpperCase()}</strong></div>
          <div><small>Billing state</small><strong>{billing?.status ? String(billing.status).toUpperCase() : guild.plan_code === 'free' ? 'NO SUBSCRIPTION' : 'UNLINKED'}</strong></div>
          <div><small>Payment</small><strong>{billing?.payment_status ? String(billing.payment_status).toUpperCase() : '—'}</strong></div>
          <div><small>Cycle</small><strong>{billing?.billing_period ? String(billing.billing_period).toUpperCase() : '—'}</strong></div>
          <div><small>Renews / ends</small><strong>{billing?.ends_at ? new Date(billing.ends_at).toLocaleDateString() : billing?.renews_at ? new Date(billing.renews_at).toLocaleDateString() : '—'}</strong></div>
        </div>
        {pendingUpgrade && billing?.status !== 'expired' ? <div className="notice">Upgrade pending: Lemon Squeezy shows <strong>{String(billing.plan_code).toUpperCase()}</strong>, while HeadlessGM remains <strong>{String(guild.plan_code).toUpperCase()}</strong> until a successful payment webhook confirms the charge.</div> : null}
        {pendingDowngrade && billing?.status !== 'expired' ? <div className="notice"><strong>Downgrade scheduled.</strong> You keep {String(guild.plan_code).toUpperCase()} access{effectiveDate ? <> through <strong>{new Date(effectiveDate).toLocaleDateString()}</strong></> : null}. After that, your subscription continues on <strong>{String(billing.plan_code).toUpperCase()}</strong>{targetPrice ? <> at <strong>{targetPrice}{billing?.billing_period === 'annual' ? '/year' : '/month'}</strong></> : null}. Higher-tier features will be disabled when the downgrade takes effect, but your saved settings are retained if you upgrade again.</div> : null}
        {billing?.cancelled && billing?.ends_at ? <div className="notice">Cancelled subscriptions keep paid access through the confirmed end date. Historical guild data is preserved after downgrade.</div> : null}
        {billing?.payment_status === 'failed' ? <div className="notice error">A payment attempt failed. Lemon Squeezy may retry it; access remains until the subscription is confirmed expired.</div> : null}
        {billing?.provider_subscription_id ? <form action={openCustomerPortal} className="operator-actions"><input type="hidden" name="guild_id" value={guild.id}/><button className="button" type="submit">Manage billing / resume / cancel</button></form> : null}
      </section>

      <div className="pricing-grid">
        {offers.map((offer) => <section className={offer.planCode === 'commander' ? 'pricing-card featured' : 'pricing-card'} key={offer.planCode}>
          <div className="pricing-card-head"><div><p className="eyebrow">{offer.label}</p><h2>{offer.label}</h2></div></div>
          <p>{offer.copy}</p>
          <div className="billing-choice-grid">
            {['monthly','annual'].map((period) => {
              const isCurrent = billing?.plan_code === offer.planCode && billing?.billing_period === period && hasSubscription
              const price = period === 'monthly' ? offer.monthly : offer.annual
              const action = hasSubscription ? changeSubscription : startCheckout
              const isTierDowngrade = hasSubscription && planRank(offer.planCode) < planRank(guild.plan_code)
              const isTierUpgrade = hasSubscription && planRank(offer.planCode) > planRank(guild.plan_code)
              const buttonLabel = isCurrent ? 'Current billing plan' : isTierDowngrade ? `Downgrade to ${offer.label}` : isTierUpgrade ? `Upgrade to ${offer.label}` : hasSubscription ? 'Change billing cycle' : `Choose ${period}`
              return <form action={action} className="panel panel-pad" key={period}>
                <input type="hidden" name="guild_id" value={guild.id}/>
                <input type="hidden" name="plan_code" value={offer.planCode}/>
                <input type="hidden" name="billing_period" value={period}/>
                <strong>{price}<small>/{period === 'monthly' ? 'month' : 'year'}</small></strong>
                {period === 'annual' ? <span className="pill">~25% LESS THAN 12 MONTHS</span> : null}
                <button type="submit" className="button" disabled={!ready || isCurrent}>{buttonLabel}</button>
              </form>
            })}
          </div>
        </section>)}
      </div>
    </AppShell>
  )
}
