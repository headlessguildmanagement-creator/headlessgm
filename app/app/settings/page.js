import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import AppShell from '../../../components/app-shell'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const { data: guild } = await supabase.from('guilds').select('id, name, slug, timezone, plan_code, owner_user_id').limit(1).maybeSingle()
  if (!guild) redirect('/app/onboarding')

  const isOwner = guild.owner_user_id === userId
  const { data: membership } = isOwner ? { data: { role: 'owner' } } : await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).maybeSingle()
  if (!membership) redirect('/app')

  const rows = [
    ['Guild profile', `${guild.name} · /${guild.slug} · ${guild.timezone}`, '/app'],
    ['Auction rules', 'Feather/Puppet allocation presets and reward caps. Custom rules are a COMMANDER feature.', '/app/settings/auction'],
    ['Discord', 'Server connection, channel selection, reconnect, control panel and character claims.', '/app/settings/discord'],
    ['Recruitment', 'Applications, applicant conversations and onboarding.', '/app/recruitment'],
    ['Members', 'Roster, identity links and member status.', '/app/members'],
    ['Events', 'Event lifecycle, LOA, attendance and lineup operations.', '/app/events'],
  ]

  return (
    <AppShell guildName={guild.name} title="Settings" activeHref="/app/settings">
      <section className="panel">
        <div className="panel-pad section-head"><div><h2>Guild configuration</h2><p>Everything in onboarding stays editable here. Historical event and auction snapshots remain unchanged.</p></div><span className="pill">{String(guild.plan_code).toUpperCase()}</span></div>
        <div className="settings-list">
          {rows.map(([title, text, href]) => <Link key={title} href={href} className="settings-row"><strong>{title}</strong><p>{text}</p><span>Open →</span></Link>)}
        </div>
      </section>
    </AppShell>
  )
}
