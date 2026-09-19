import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { resolveGuild, withGuild } from '../../../lib/guild-context'
import AppShell from '../../../components/app-shell'

export default async function SettingsPage({ searchParams }) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const params = await searchParams
  const guild = await resolveGuild(supabase, params?.guild, 'id, name, slug, timezone, plan_code, owner_user_id')
  if (!guild) redirect('/app/onboarding')

  const isOwner = guild.owner_user_id === userId
  const { data: membership } = isOwner ? { data: { role: 'owner' } } : await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).maybeSingle()
  if (!membership) redirect('/app')

  const rows = [
    ['Guild profile', `${guild.name} · /${guild.slug} · ${guild.timezone} · logo · ${guild.plan_code === 'free' ? 'manual attendance' : 'attendance & LOA defaults'}`, withGuild('/app/settings/profile', guild.slug)],
    ['Brand & Overview', guild.plan_code === 'commander' || guild.plan_code === 'beta' ? 'COMMANDER Brand Studio, logo-derived colors, typography and overview modules.' : 'COMMANDER unlocks guild-specific app branding and Overview Studio.', withGuild('/app/settings/brand', guild.slug)],
    ['Auction rules', 'Feather/Puppet allocation presets and reward caps. Custom rules are a COMMANDER feature.', withGuild('/app/settings/auction', guild.slug)],
    ...(guild.plan_code === 'free' ? [] : [['Discord', 'Server connection, channel selection, reconnect, control panel and character claims.', withGuild('/app/settings/discord', guild.slug)]]),
    ...(guild.plan_code === 'free' ? [] : [['Recruitment', `Public recruitment site /${guild.slug} · applications, applicant conversations and onboarding.`, withGuild('/app/recruitment', guild.slug)]]),
    ['Members', guild.plan_code === 'free' ? 'Manual roster entry and member status. File import unlocks on GUILD.' : 'Roster import, identity links and member status.', withGuild('/app/members', guild.slug)],
    ['Events', guild.plan_code === 'free' ? 'Manual attendance, lineup and current-event operations.' : 'Event lifecycle, LOA, attendance and lineup operations.', withGuild('/app/events', guild.slug)],
  ]

  return (
    <AppShell guildName={guild.name} guildSlug={guild.slug} title="Settings" activeHref="/app/settings">
      <section className="panel">
        <div className="panel-pad section-head"><div><h2>Guild configuration</h2><p>Everything in onboarding stays editable here. Historical event and auction snapshots remain unchanged.</p></div><span className="pill">{String(guild.plan_code).toUpperCase()}</span></div>
        <div className="settings-list">
          {rows.map(([title, text, href]) => <Link key={title} href={href} className="settings-row"><strong>{title}</strong><p>{text}</p><span>Open →</span></Link>)}
        </div>
      </section>
    </AppShell>
  )
}
