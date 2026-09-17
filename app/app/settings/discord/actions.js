'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../../lib/supabase/server'
import { listBotGuilds, listGuildTextChannels, sendChannelMessage, publishHeadlessGMControlPanel as publishDiscordControlPanel } from '../../../../lib/discord/server'

function safeMessage(value) {
  return encodeURIComponent(String(value || '').slice(0, 180))
}

async function requireOwnerGuild(supabase, guildId, userId) {
  const { data: guild } = await supabase
    .from('guilds')
    .select('id, name, owner_user_id')
    .eq('id', guildId)
    .eq('owner_user_id', userId)
    .single()

  if (!guild) throw new Error('Guild owner access required')
  return guild
}

async function requireManagerGuild(supabase, guildId, userId) {
  const { data: guild } = await supabase
    .from('guilds')
    .select('id, name, owner_user_id')
    .eq('id', guildId)
    .single()
  if (!guild) throw new Error('Guild not found')
  if (guild.owner_user_id === userId) return guild

  const { data: membership } = await supabase
    .from('guild_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .in('role', ['owner', 'officer'])
    .maybeSingle()

  if (!membership) throw new Error('Officer access required')
  return guild
}

export async function saveDiscordConnection(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const discordGuildId = String(formData.get('discord_guild_id') || '')
  const channelId = String(formData.get('channel_id') || '')

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub

  if (authError || !userId) redirect('/login')

  try {
    await requireOwnerGuild(supabase, guildId, userId)

    const botGuilds = await listBotGuilds()
    const discordGuild = botGuilds.find((item) => item.id === discordGuildId)
    if (!discordGuild) throw new Error('HeadlessGM is not installed in that Discord server')

    const channels = await listGuildTextChannels(discordGuildId)
    const channel = channels.find((item) => item.id === channelId)
    if (!channel) throw new Error('Selected Discord channel is not available to HeadlessGM')

    const { error } = await supabase.from('discord_connections').upsert(
      {
        guild_id: guildId,
        discord_guild_id: discordGuild.id,
        discord_guild_name: discordGuild.name,
        installed_by_user_id: userId,
        bot_installed: true,
        metadata: { channel_id: channel.id, channel_name: channel.name },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'guild_id' },
    )

    if (error) throw error

    revalidatePath('/app')
    revalidatePath('/app/settings/discord')
    redirect(`/app/settings/discord?success=${safeMessage(`Connected to #${channel.name}`)}`)
  } catch (error) {
    redirect(`/app/settings/discord?error=${safeMessage(error.message || 'Discord connection failed')}&server=${safeMessage(discordGuildId)}`)
  }
}

export async function sendDiscordTestMessage(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  try {
    const guild = await requireOwnerGuild(supabase, guildId, userId)
    const { data: connection } = await supabase
      .from('discord_connections')
      .select('discord_guild_name, metadata')
      .eq('guild_id', guildId)
      .single()
    const channelId = connection?.metadata?.channel_id
    if (!channelId) throw new Error('Choose a HeadlessGM Discord channel first')

    await sendChannelMessage(channelId, {
      embeds: [{
        title: 'HeadlessGM connected',
        description: `**${guild.name}** is now connected to HeadlessGM. This channel will become the member control panel for character linking, LOA, events, lineups, and rewards.`,
        footer: { text: 'Headless Guild Management' },
      }],
    })

    redirect(`/app/settings/discord?success=${safeMessage('Test message sent to Discord')}`)
  } catch (error) {
    redirect(`/app/settings/discord?error=${safeMessage(error.message || 'Could not send Discord message')}`)
  }
}

export async function publishHeadlessGMControlPanel(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  try {
    const guild = await requireManagerGuild(supabase, guildId, userId)
    const { data: connection, error } = await supabase
      .from('discord_connections')
      .select('metadata')
      .eq('guild_id', guildId)
      .single()
    if (error) throw error

    const channelId = connection?.metadata?.channel_id
    if (!channelId) throw new Error('No #headlessgm channel is configured for this guild')

    await publishDiscordControlPanel(channelId, guild.id, guild.name)
    revalidatePath('/app/settings/discord')
    redirect(`/app/settings/discord?success=${safeMessage('HeadlessGM control panel published')}`)
  } catch (error) {
    redirect(`/app/settings/discord?error=${safeMessage(error.message || 'Could not publish HeadlessGM control panel')}`)
  }
}
