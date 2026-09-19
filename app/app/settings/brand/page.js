import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import { resolveGuild } from '../../../../lib/guild-context'
import { DEFAULT_OVERVIEW_MODULES, OVERVIEW_MODULES } from '../../../../lib/plans.mjs'
import AppShell from '../../../../components/app-shell'
import BrandStudio from '../../../../components/brand-studio'
import { saveBrandStudio } from './actions'

export default async function BrandSettingsPage({ searchParams }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const guild = await resolveGuild(supabase, params?.guild, 'id,name,slug,owner_user_id,plan_code,logo_url,settings')
  if (!guild) redirect('/app/onboarding')
  if (guild.owner_user_id !== userId) redirect('/app/settings')

  const commander = ['commander','beta'].includes(guild.plan_code)
  const brand = guild.settings?.brand || {}
  const modules = guild.settings?.overview?.modules || DEFAULT_OVERVIEW_MODULES

  return (
    <AppShell guildName={guild.name} guildSlug={guild.slug} title="Brand & Overview" activeHref="/app/settings">
      {params?.error ? <div className="notice error">{String(params.error)}</div> : null}
      {params?.success ? <div className="notice success">{String(params.success)}</div> : null}
      {!commander ? (
        <section className="panel panel-pad">
          <p className="eyebrow">COMMANDER</p>
          <h2 style={{ marginTop: 6 }}>Guild-specific app branding and Overview Studio</h2>
          <p className="muted">FREE and GUILD use the standard HeadlessGM visual system. COMMANDER can derive colors from the guild logo, choose typography and customize which officer overview modules are visible.</p>
        </section>
      ) : (
        <BrandStudio action={saveBrandStudio} guildId={guild.id} logoUrl={guild.logo_url || ''} brand={brand} modules={modules} allModules={OVERVIEW_MODULES} />
      )}
    </AppShell>
  )
}
