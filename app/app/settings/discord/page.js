import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import { listBotGuilds, listGuildTextChannels } from '../../../../lib/discord/server'
import AppShell from '../../../../components/app-shell'
import { publishHeadlessGMControlPanel, reconnectDiscord, saveDiscordConnection, sendDiscordTestMessage } from './actions'

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
    : await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).in('role', ['owner', 'officer']).maybeSingle()
  if (!membership) redirect('/app')

  const { data: connection } = await supabase
    .from('discord_connections')
    .select('discord_guild_id, discord_guild_name, metadata, bot_installed')
    .eq('guild_id', guild.id)
    .maybeSingle()

  let botGuilds = []
  let discordLoadError = ''
  if (isOwner) {
    try {
      const guildRows = await listBotGuilds()
      botGuilds = await Promise.all(guildRows.map(async (discordGuild) => {
        try { return { ...discordGuild, channels: await listGuildTextChannels(discordGuild.id) } }
        catch { return { ...discordGuild, channels: [] } }
      }))
    } catch (error) {
      discordLoadError = error?.message || 'Could not load Discord servers for the HeadlessGM bot.'
    }
  }

  return (
    <AppShell guildName={guild.name} title="Discord" activeHref="/app/settings/discord">
      {params?.error ? <div className="notice error">{String(params.error)}</div> : null}
      {params?.success ? <div className="notice success">{String(params.success)}</div> : null}
      {discordLoadError ? <div className="notice error">{discordLoadError}</div> : null}

      <section className="panel panel-pad">
        <div className="section-head">
          <div><h2>Connection</h2><p>Discord is the member interaction and communication surface. HeadlessGM remains the system of record.</p></div>
          <span className="pill">{connection?.bot_installed ? 'CONNECTED' : 'NOT CONNECTED'}</span>
        </div>

        {connection?.bot_installed ? (
          <div className="notice" style={{ marginBottom: 16 }}>
            <strong>{connection.discord_guild_name || 'Discord server'}</strong>
            <div className="muted">{connection.metadata?.channel_name ? `Control channel: #${connection.metadata.channel_name}` : 'No control channel selected.'}</div>
          </div>
        ) : null}

        {isOwner && connection?.bot_installed ? (
          <form action={reconnectDiscord} style={{ marginBottom: 18 }}>
            <input type="hidden" name="guild_id" value={guild.id} />
            <button type="submit" className="button danger">Reconnect Discord</button>
            <span className="muted" style={{ marginLeft: 10 }}>Clears only the Discord workspace link. Roster, events, applications, auction history and member records stay intact.</span>
          </form>
        ) : null}

        {isOwner ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {botGuilds.length ? botGuilds.map((discordGuild) => (
              <form key={discordGuild.id} action={saveDiscordConnection} className="panel panel-pad" style={{ boxShadow: 'none' }}>
                <input type="hidden" name="guild_id" value={guild.id} />
                <input type="hidden" name="discord_guild_id" value={discordGuild.id} />
                <div className="section-head"><div><h3>{discordGuild.name}</h3><p>Bot-installed Discord server</p></div>{connection?.discord_guild_id === discordGuild.id ? <span className="pill">CURRENT</span> : null}</div>
                {discordGuild.channels.length ? (
                  <div className="form-grid">
                    <label className="field full"><span>HeadlessGM control channel</span><select name="channel_id" defaultValue={connection?.discord_guild_id === discordGuild.id ? connection?.metadata?.channel_id || '' : ''} required><option value="">Select channel</option>{discordGuild.channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label>
                    <div className="full"><button type="submit" className="button">{connection?.discord_guild_id === discordGuild.id ? 'Update channel' : 'Connect this Discord server'}</button></div>
                  </div>
                ) : <div className="notice error">No text channels are visible to the HeadlessGM bot in this server.</div>}
              </form>
            )) : discordLoadError ? null : <div className="notice">The HeadlessGM bot is not installed in any Discord server this bot token can access.</div>}
          </div>
        ) : <div className="notice">Only the guild owner can change the connected Discord server or channel.</div>}
      </section>

      {connection?.bot_installed ? (
        <section className="panel panel-pad">
          <div className="section-head"><div><h2>Discord operations</h2><p>Publish the control panel after changing servers or channels.</p></div></div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {isOwner ? <form action={sendDiscordTestMessage}><input type="hidden" name="guild_id" value={guild.id} /><button type="submit" className="button ghost">Send test message</button></form> : null}
            <form action={publishHeadlessGMControlPanel}><input type="hidden" name="guild_id" value={guild.id} /><button type="submit" className="button">Publish #headlessgm control panel</button></form>
            <Link href={`/app/settings/discord/claims?guild=${encodeURIComponent(guild.id)}`} className="button ghost">Review character claims</Link>
          </div>
        </section>
      ) : null}
    </AppShell>
  )
}
