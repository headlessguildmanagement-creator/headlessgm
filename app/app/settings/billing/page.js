import { redirect } from 'next/navigation'
import AppShell from '../../../../components/app-shell'
import { createClient } from '../../../../lib/supabase/server'
import { resolveGuild } from '../../../../lib/guild-context'
import { billingIntegrationReady, isLemonTestMode } from '../../../../lib/billing/plans.mjs'
import { openCustomerPortal, startCheckout } from './actions'

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

  return (
    <AppShell guildName={guild.name} guildSlug={guild.slug} title="Billing" activeHref="/app/settings">
      {params?.error ? <div className="notice error">{String(params.error)}</div> : null}
      {params?.checkout === 'success' ? <div className="notice success">Checkout finished. Lemon Squeezy is confirming the subscription through the signed webhook. Plan access updates from the verified webhook, not from this return page.</div> : null}
      {testMode ? <div className="notice"><strong>TEST MODE</strong> · Checkout uses Lemon Squeezy test data and cannot charge a real customer.</div> : null}
      {!ready ? <div className="notice error"><strong>Billing integration setup is incomplete.</strong> The store/API/webhook secrets still need to be added to the app environment before checkout can run.</div> : null}

      <section className="panel panel-pad">
        <div className="section-head"><div><h2>Current subscription</h2><p>Lemon Squeezy is the billing authority. HeadlessGM changes plan access only from verified subscription webhooks.</p></div><span className="pill">{String(guild.plan_code).toUpperCase()}</span></div>
        <div className="event-readiness-strip">
          <div><small>Plan</small><strong>{String(guild.plan_code).toUpperCase()}</strong></div>
          <div><small>Billing state</small><strong>{billing?.status ? String(billing.status).toUpperCase() : guild.plan_code === 'free' ? 'NO SUBSCRIPTION' : 'UNLINKED'}</strong></div>
          <div><small>Cycle</small><strong>{billing?.billing_period ? String(billing.billing_period).toUpperCase() : '—'}</strong></div>
          <div><small>Renews / ends</small><strong>{billing?.ends_at ? new Date(billing.ends_at).toLocaleDateString() : billing?.renews_at ? new Date(billing.renews_at).toLocaleDateString() : '—'}</strong></div>
        </div>
        {billing?.provider_subscription_id ? <form action={openCustomerPortal} className="operator-actions"><input type="hidden" name="guild_id" value={guild.id}/><button className="button" type="submit">Manage billing</button></form> : null}
      </section>

      <div className="pricing-grid">
        {offers.map((offer) => <section className={offer.planCode === 'commander' ? 'pricing-card featured' : 'pricing-card'} key={offer.planCode}>
          <div className="pricing-card-head"><div><p className="eyebrow">{offer.label}</p><h2>{offer.label}</h2></div></div>
          <p>{offer.copy}</p>
          <div className="billing-choice-grid">
            <form action={startCheckout} className="panel panel-pad">
              <input type="hidden" name="guild_id" value={guild.id}/>
              <input type="hidden" name="plan_code" value={offer.planCode}/>
              <input type="hidden" name="billing_period" value="monthly"/>
              <strong>{offer.monthly}<small>/month</small></strong>
              <button type="submit" className="button" disabled={!ready || Boolean(billing?.provider_subscription_id)}>Choose monthly</button>
            </form>
            <form action={startCheckout} className="panel panel-pad">
              <input type="hidden" name="guild_id" value={guild.id}/>
              <input type="hidden" name="plan_code" value={offer.planCode}/>
              <input type="hidden" name="billing_period" value="annual"/>
              <strong>{offer.annual}<small>/year</small></strong>
              <span className="pill">SAVE 25%</span>
              <button type="submit" className="button" disabled={!ready || Boolean(billing?.provider_subscription_id)}>Choose annual</button>
            </form>
          </div>
        </section>)}
      </div>
    </AppShell>
  )
}
