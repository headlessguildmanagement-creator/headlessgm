import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import { getDiscordInstallUrl, listBotGuilds, listGuildTextChannels } from '../../../../lib/discord/server'
import AppShell from '../../../../components/app-shell'
import { provisionDiscordWorkspace, publishHeadlessGMControlPanel, reconnectDiscord, saveDiscordConnection, sendDiscordTestMessage } from './actions'

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

  const { data: connection } = await supabase.from('discord_connections').select('discord_guild_id, discord_guild_name, metadata, bot_installed').eq('guild_id', guild.id).maybeSingle()

  let botGuilds = []
  let installUrl = ''
  let discordLoadError = ''
  if (isOwner) {
    try {
      const [guildRows, install] = await Promise.all([listBotGuilds(), getDiscordInstallUrl()])
      installUrl = install
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

        {isOwner && installUrl ? (
          <div className="notice" style={{ marginBottom: 16 }}>
            <strong>{connection?.bot_installed ? 'Install / reconnect the HeadlessGM bot' : 'Install HeadlessGM in your Discord server'}</strong>
            <div className="muted" style={{ margin: '5px 0 10px' }}>This grants only the permissions HeadlessGM needs: Manage Channels, View Channels, Send Messages, Embed Links and Read Message History. Administrator is not requested.</div>
            <a href={installUrl} target="_blank" rel="noreferrer" className="button">Open Discord install</a>
          </div>
        ) : null}

        {connection?.bot_installed ? (
          <div className="notice" style={{ marginBottom: 16 }}>
            <strong>{connection.discord_guild_name || 'Discord server'}</strong>
            <div className="muted">{connection.metadata?.channel_name ? `Control channel: #${connection.metadata.channel_name}` : 'No control channel selected.'}</div>
            {connection.metadata?.recruitment_channel_name ? <div className="muted">Recruitment channel: #{connection.metadata.recruitment_channel_name}</div> : null}
          </div>
        ) : null}

        {isOwner && connection?.bot_installed ? (
          <form action={reconnectDiscord} style={{ marginBottom: 18 }}>
            <input type="hidden" name="guild_id" value={guild.id} />
            <button type="submit" className="button danger">Reconnect Discord</button>
            <span className="muted" style={{ marginLeft: 10 }}>Clears only the HeadlessGM workspace link so you can bind this guild to a different Discord server. Roster and history stay intact.</span>
          </form>
        ) : null}

        {isOwner ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {botGuilds.length ? botGuilds.map((discordGuild) => (
              <div key={discordGuild.id} className="panel panel-pad" style={{ boxShadow: 'none' }}>
                <div className="section-head"><div><h3>{discordGuild.name}</h3><p>Bot-installed Discord server</p></div>{connection?.discord_guild_id === discordGuild.id ? <span className="pill">CURRENT</span> : null}</div>

                <div className="notice" style={{ marginBottom: 14 }}>
                  <strong>Recommended setup</strong>
                  <div className="muted">Create a <strong>HEADLESSGM</strong> category with <strong>#headlessgm</strong> and <strong>#recruitment</strong>, connect the control channel, and publish the member panel automatically.</div>
                </div>

                <form action={provisionDiscordWorkspace} style={{ marginBottom: 14 }}>
                  <input type="hidden" name="guild_id" value={guild.id} />
                  <input type="hidden" name="discord_guild_id" value={discordGuild.id} />
                  <button type="submit" className="button">Create HeadlessGM category & channels</button>
                </form>

                <div className="muted" style={{ margin: '4px 0 10px' }}>Or use an existing channel:</div>
                {discordGuild.channels.length ? (
                  <form action={saveDiscordConnection} className="form-grid">
                    <input type="hidden" name="guild_id" value={guild.id} />
                    <input type="hidden" name="discord_guild_id" value={discordGuild.id} />
                    <label className="field full"><span>HeadlessGM control channel</span><select name="channel_id" defaultValue={connection?.discord_guild_id === discordGuild.id ? connection?.metadata?.channel_id || '' : ''} required><option value="">Select channel</option>{discordGuild.channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label>
                    <div className="full"><button type="submit" className="button ghost">{connection?.discord_guild_id === discordGuild.id ? 'Update channel' : 'Connect existing channel'}</button></div>
                  </form>
                ) : <div className="notice">No existing text channels are visible to the bot. Automatic setup can still work when Manage Channels is granted.</div>}
              </div>
            )) : discordLoadError ? null : <div className="notice">Install the HeadlessGM bot using the button above, then return here and refresh to choose the server.</div>}
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
