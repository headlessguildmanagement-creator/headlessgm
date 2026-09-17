import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import { publishHeadlessGMControlPanel } from './actions'

export default async function DiscordSettingsPage({ searchParams }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const { data: guild } = await supabase.from('guilds').select('id, name, owner_user_id').limit(1).maybeSingle()
  if (!guild) redirect('/app/onboarding')

  const isOwner = guild.owner_user_id === userId
  const { data: membership } = isOwner ? { data: { role: 'owner' } } : await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).in('role', ['owner', 'officer']).maybeSingle()
  if (!membership) redirect('/app')

  const { data: connection } = await supabase.from('discord_connections').select('discord_guild_name, metadata, bot_installed').eq('guild_id', guild.id).maybeSingle()
  const channelName = connection?.metadata?.channel_name

  return (
    <main style={{ minHeight: '100vh', padding: '40px 24px 72px' }}>
      <div style={{ width: 'min(900px, 100%)', margin: '0 auto', display: 'grid', gap: 24 }}>
        <header>
          <Link href="/app" style={{ color: '#8893a1', textDecoration: 'none' }}>← Dashboard</Link>
          <p className="eyebrow" style={{ marginTop: 20 }}>{guild.name}</p>
          <h1 style={{ fontSize: 48, lineHeight: 1 }}>Discord</h1>
          <p className="lede">Discord is the interaction layer. HeadlessGM remains the source of truth for the in-game roster.</p>
        </header>
        {params?.error ? <div style={{ border: '1px solid #7f1d1d', borderRadius: 12, padding: 14, color: '#fca5a5' }}>{String(params.error)}</div> : null}
        {params?.success ? <div style={{ border: '1px solid #14532d', borderRadius: 12, padding: 14, color: '#86efac' }}>{String(params.success)}</div> : null}

        <section style={{ border: '1px solid #232832', borderRadius: 16, padding: 22, background: '#11151a', display: 'grid', gap: 12 }}>
          <strong>Connection</strong>
          <div style={{ color: '#8893a1', fontSize: 14 }}>{connection?.bot_installed ? `Connected to ${connection.discord_guild_name || 'Discord'}${channelName ? ` · #${channelName}` : ''}.` : 'No Discord connection is configured yet.'}</div>
          {connection?.bot_installed ? (
            <>
              <form action={publishHeadlessGMControlPanel}>
                <input type="hidden" name="guild_id" value={guild.id} />
                <button type="submit" style={{ border: 0, borderRadius: 10, padding: '11px 16px', fontWeight: 800, cursor: 'pointer' }}>Publish #headlessgm control panel</button>
              </form>
              <Link href={`/app/settings/discord/claims?guild=${encodeURIComponent(guild.id)}`} style={{ color: '#f5f7fa' }}>Review character claims →</Link>
            </>
          ) : null}
        </section>
      </div>
    </main>
  )
}
