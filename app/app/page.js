import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'
import { signOut } from './actions'

const card = { color: 'inherit', textDecoration: 'none', border: '1px solid #303742', borderRadius: 16, padding: 22, background: '#11151a' }

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

  const [{ data: plan }, { data: preset }, activeMembers, pendingMembers, openApps, upcomingEvents] = await Promise.all([
    supabase.from('plans').select('display_name, active_member_limit').eq('code', guild.plan_code).single(),
    supabase.from('game_presets').select('name, raid_size, party_size, parties_per_raid').eq('id', guild.game_preset_id).single(),
    supabase.from('guild_members').select('id', { count: 'exact', head: true }).eq('guild_id', guild.id).eq('status', 'active'),
    supabase.from('guild_members').select('id', { count: 'exact', head: true }).eq('guild_id', guild.id).eq('status', 'pending'),
    supabase.from('guild_applications').select('id', { count: 'exact', head: true }).eq('guild_id', guild.id).not('status', 'in', '(rejected,joined)'),
    supabase.from('guild_events').select('id', { count: 'exact', head: true }).eq('guild_id', guild.id).not('status', 'in', '(completed,cancelled)'),
  ])

  const activeCount = activeMembers.count ?? 0
  const pendingCount = pendingMembers.count ?? 0
  const activeLimit = plan?.active_member_limit ?? 80

  const cards = [
    ['RECRUITMENT', 'Applicants', `${openApps.count ?? 0} open applications · public page /${guild.slug}/apply`, '/app/recruitment'],
    ['ROSTER', 'Members', 'Authoritative in-game roster and Discord identity links.', '/app/members'],
    ['OPERATIONS', 'Events', `${upcomingEvents.count ?? 0} active/upcoming events · LOA → eligibility → lineup`, '/app/events'],
    ['AUCTION', 'Rules & Caps', 'Feather and Puppet presets plus per-person reward limits.', '/app/settings/auction'],
    ['DISCORD', 'Control Panel', 'Connect the server, publish member controls, and review character claims.', '/app/settings/discord'],
  ]

  return (
    <main style={{ minHeight: '100vh', padding: '36px 24px 64px' }}>
      <div style={{ width: 'min(1040px, 100%)', margin: '0 auto', display: 'grid', gap: 28 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <p className="eyebrow">HeadlessGM · {preset?.name || 'Guild Operations'}</p>
            <h1 style={{ fontSize: 56, lineHeight: 1, letterSpacing: '-0.05em' }}>{guild.name}</h1>
            <p className="lede" style={{ fontSize: 18, marginTop: 16 }}>Recruit → onboard → operate → finalize → remember.</p>
          </div>
          <form action={signOut}><button type="submit" style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer' }}>Sign out</button></form>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
          <div style={{ border: '1px solid #232832', borderRadius: 16, padding: 20, background: '#11151a' }}><div style={{ color: '#8893a1', fontSize: 13 }}>ACTIVE ROSTER</div><div style={{ marginTop: 8, fontSize: 34, fontWeight: 800 }}>{activeCount} / {activeLimit}</div><div style={{ color: '#727d8c', fontSize: 13 }}>{pendingCount} pending</div></div>
          <div style={{ border: '1px solid #232832', borderRadius: 16, padding: 20, background: '#11151a' }}><div style={{ color: '#8893a1', fontSize: 13 }}>LINEUP PRESET</div><div style={{ marginTop: 8, fontSize: 20, fontWeight: 800 }}>{preset?.raid_size || 40}-player Main</div><div style={{ color: '#727d8c', fontSize: 13 }}>{preset?.parties_per_raid || 8} parties × {preset?.party_size || 5} members</div></div>
          <div style={{ border: '1px solid #232832', borderRadius: 16, padding: 20, background: '#11151a' }}><div style={{ color: '#8893a1', fontSize: 13 }}>WORKSPACE</div><div style={{ marginTop: 8, fontSize: 20, fontWeight: 800 }}>{plan?.display_name || 'Beta'}</div><div style={{ color: '#727d8c', fontSize: 13 }}>{guild.slug} · {guild.timezone}</div></div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          {cards.map(([eyebrow, title, text, href]) => <Link key={href} href={href} style={card}><div style={{ color: '#8893a1', fontSize: 12, fontWeight: 800, letterSpacing: '.12em' }}>{eyebrow}</div><h2 style={{ margin: '8px 0', fontSize: 26 }}>{title}</h2><p style={{ margin: 0, color: '#8893a1', lineHeight: 1.5 }}>{text}</p></Link>)}
        </section>
      </div>
    </main>
  )
}
