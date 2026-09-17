import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'
import AppShell from '../../components/app-shell'
import { signOut } from './actions'

export default async function AppHome() {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  if (authError || !authData?.claims?.sub) redirect('/login')

  const { data: guildRows } = await supabase
    .from('guilds')
    .select('id, name, slug, plan_code, game_preset_id, timezone, created_at')
    .order('created_at', { ascending: true })
    .limit(1)

  const guild = guildRows?.[0]
  if (!guild) redirect('/app/onboarding')

  const [{ data: plan }, { data: preset }, activeMembers, pendingMembers, openApps, upcomingEvents, { data: discord }] = await Promise.all([
    supabase.from('plans').select('display_name, active_member_limit').eq('code', guild.plan_code).single(),
    supabase.from('game_presets').select('name, raid_size, party_size, parties_per_raid').eq('id', guild.game_preset_id).single(),
    supabase.from('guild_members').select('id', { count: 'exact', head: true }).eq('guild_id', guild.id).eq('status', 'active'),
    supabase.from('guild_members').select('id', { count: 'exact', head: true }).eq('guild_id', guild.id).eq('status', 'pending'),
    supabase.from('guild_applications').select('id', { count: 'exact', head: true }).eq('guild_id', guild.id).not('status', 'in', '(rejected,joined)'),
    supabase.from('guild_events').select('id', { count: 'exact', head: true }).eq('guild_id', guild.id).not('status', 'in', '(completed,cancelled)'),
    supabase.from('discord_connections').select('discord_guild_name, metadata, bot_installed').eq('guild_id', guild.id).maybeSingle(),
  ])

  const activeCount = activeMembers.count ?? 0
  const activeLimit = plan?.active_member_limit ?? 80
  const operations = [
    ['Events & Attendance', `${upcomingEvents.count ?? 0} active/upcoming events. LOA, availability and event state live here.`, '/app/events'],
    ['Lineup Builder', `${preset?.raid_size || 40}-player Main · ${preset?.parties_per_raid || 8} parties × ${preset?.party_size || 5}.`, '/app/events'],
    ['Auction Rules', 'Feather and Puppet presets, Random eligibility and per-person caps.', '/app/settings/auction'],
    ['Recruitment', `${openApps.count ?? 0} open applications · public application page /${guild.slug}/apply`, '/app/recruitment'],
    ['Members', `${activeCount} active · ${pendingMembers.count ?? 0} pending. Persistent identity and Discord links.`, '/app/members'],
    ['Discord', discord?.bot_installed ? `Connected to ${discord.discord_guild_name}${discord.metadata?.channel_name ? ` · #${discord.metadata.channel_name}` : ''}` : 'Not connected. Install or reconnect HeadlessGM and choose its channel.', '/app/settings/discord'],
  ]

  const actions = <form action={signOut}><button type="submit" className="button ghost">Sign out</button></form>

  return (
    <AppShell guildName={guild.name} title="Guild overview" activeHref="/app" actions={actions}>
      <section className="stats">
        <div className="stat"><label>ACTIVE ROSTER</label><strong>{activeCount} / {activeLimit}</strong><small>{pendingMembers.count ?? 0} pending</small></div>
        <div className="stat"><label>UPCOMING / ACTIVE EVENTS</label><strong>{upcomingEvents.count ?? 0}</strong><small>LOA → lineup → auction</small></div>
        <div className="stat"><label>OPEN APPLICATIONS</label><strong>{openApps.count ?? 0}</strong><small>Recruitment queue</small></div>
        <div className="stat"><label>PLAN</label><strong>{plan?.display_name || 'BETA'}</strong><small>{guild.slug} · {guild.timezone}</small></div>
      </section>

      <section className="panel">
        <div className="panel-pad section-head">
          <div><h2>Operations</h2><p>Same operating flow as Havoc, with guild-configurable rules around it.</p></div>
          <span className="pill">{preset?.name || 'Guild Operations'}</span>
        </div>
        <div className="ops-list">
          {operations.map(([title, text, href]) => (
            <Link key={title} href={href} className="ops-row">
              <strong>{title}</strong><p>{text}</p><span>Open →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel panel-pad">
        <div className="section-head"><div><h2>Current operating model</h2><p>HeadlessGM keeps persistent guild identity and history while each event carries its own attendance, lineup and auction state.</p></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Area</th><th>Default</th><th>Where to change</th></tr></thead>
            <tbody>
              <tr><td>Attendance</td><td>Assume attending unless LOA</td><td>Guild settings</td></tr>
              <tr><td>Lineup</td><td>{preset?.raid_size || 40}-player Main + Sub</td><td>Game / event preset</td></tr>
              <tr><td>Auction</td><td>Preset + caps; snapshot per auction run</td><td><Link href="/app/settings/auction">Auction Rules</Link></td></tr>
              <tr><td>Discord</td><td>Communication/control surface, not source of truth</td><td><Link href="/app/settings/discord">Discord Settings</Link></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  )
}
