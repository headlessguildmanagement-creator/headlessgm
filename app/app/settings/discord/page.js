import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import { listBotGuilds, listGuildTextChannels } from '../../../../lib/discord/server'
import { publishHeadlessGMControlPanel, saveDiscordConnection, sendDiscordTestMessage } from './actions'

export default async function DiscordSettingsPage({ searchParams }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const { data: guild } = await supabase.from('guilds').select('id, name, owner_user_id').limit(1).maybeSingle()
  if (!guild) redirect('/app/onboarding')

  const isOwner = guild.owner_user_id === userId
  const { data: membership } = isOwner
    ? { data: { role: 'owner' } }
    : await supabase
        .from('guild_users')
        .select('role')
        .eq('guild_id', guild.id)
        .eq('user_id', userId)
        .in('role', ['owner', 'officer'])
        .maybeSingle()
  if (!membership) redirect('/app')

  const { data: connection } = await supabase
    .from('discord_connections')
    .select('discord_guild_id, discord_guild_name, metadata, bot_installed')
    .eq('guild_id', guild.id)
    .maybeSingle()

  const channelName = connection?.metadata?.channel_name

  let botGuilds = []
  let discordLoadError = ''

  if (isOwner) {
    try {
      const guildRows = await listBotGuilds()
      botGuilds = await Promise.all(
        guildRows.map(async (discordGuild) => {
          try {
            const channels = await listGuildTextChannels(discordGuild.id)
            return { ...discordGuild, channels }
          } catch {
            return { ...discordGuild, channels: [] }
          }
        }),
      )
    } catch (error) {
      discordLoadError = error?.message || 'Could not load Discord servers for the HeadlessGM bot.'
    }
  }

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
        {discordLoadError ? <div style={{ border: '1px solid #7f1d1d', borderRadius: 12, padding: 14, color: '#fca5a5' }}>{discordLoadError}</div> : null}

        <section style={{ border: '1px solid #232832', borderRadius: 16, padding: 22, background: '#11151a', display: 'grid', gap: 14 }}>
          <strong>Connection</strong>
          <div style={{ color: '#8893a1', fontSize: 14 }}>
            {connection?.bot_installed
              ? `Connected to ${connection.discord_guild_name || 'Discord'}${channelName ? ` · #${channelName}` : ''}.`
              : 'No Discord connection is configured yet.'}
          </div>

          {isOwner ? (
            <div style={{ display: 'grid', gap: 14, marginTop: 4 }}>
              {botGuilds.length ? (
                botGuilds.map((discordGuild) => (
                  <form
                    key={discordGuild.id}
                    action={saveDiscordConnection}
                    style={{ border: '1px solid #232832', borderRadius: 12, padding: 16, display: 'grid', gap: 12 }}
                  >
                    <input type="hidden" name="guild_id" value={guild.id} />
                    <input type="hidden" name="discord_guild_id" value={discordGuild.id} />
                    <div>
                      <div style={{ fontWeight: 800 }}>{discordGuild.name}</div>
                      <div style={{ color: '#727d8c', fontSize: 12, marginTop: 3 }}>Bot-installed Discord server</div>
                    </div>
                    {discordGuild.channels.length ? (
                      <>
                        <select
                          name="channel_id"
                          defaultValue={connection?.discord_guild_id === discordGuild.id ? connection?.metadata?.channel_id || '' : ''}
                          required
                          style={{ border: '1px solid #303742', borderRadius: 10, background: '#0b0d10', color: '#f5f7fa', padding: '12px 13px' }}
                        >
                          <option value="">Select HeadlessGM channel</option>
                          {discordGuild.channels.map((channel) => (
                            <option key={channel.id} value={channel.id}>#{channel.name}</option>
                          ))}
                        </select>
                        <button type="submit" style={{ border: 0, borderRadius: 10, padding: '11px 16px', fontWeight: 800, cursor: 'pointer' }}>
                          {connection?.discord_guild_id === discordGuild.id ? 'Update Discord connection' : 'Connect this Discord server'}
                        </button>
                      </>
                    ) : (
                      <div style={{ color: '#fca5a5', fontSize: 13 }}>No text channels are visible to the HeadlessGM bot in this server.</div>
                    )}
                  </form>
                ))
              ) : discordLoadError ? null : (
                <div style={{ color: '#8893a1', fontSize: 14 }}>The HeadlessGM bot is not installed in any Discord server this bot token can access.</div>
              )}
            </div>
          ) : null}

          {connection?.bot_installed ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              {isOwner ? (
                <form action={sendDiscordTestMessage}>
                  <input type="hidden" name="guild_id" value={guild.id} />
                  <button type="submit" style={{ border: '1px solid #303742', borderRadius: 10, padding: '11px 16px', fontWeight: 700, cursor: 'pointer', background: '#0b0d10', color: '#f5f7fa' }}>Send test message</button>
                </form>
              ) : null}
              <form action={publishHeadlessGMControlPanel}>
                <input type="hidden" name="guild_id" value={guild.id} />
                <button type="submit" style={{ border: 0, borderRadius: 10, padding: '11px 16px', fontWeight: 800, cursor: 'pointer' }}>Publish #headlessgm control panel</button>
              </form>
              <Link href={`/app/settings/discord/claims?guild=${encodeURIComponent(guild.id)}`} style={{ color: '#f5f7fa', alignSelf: 'center' }}>Review character claims →</Link>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}
