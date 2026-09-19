'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../../lib/supabase/server'
import { listBotGuilds, listGuildTextChannels, provisionHeadlessGMChannels, sendChannelMessage, publishHeadlessGMControlPanel as publishDiscordControlPanel } from '../../../../lib/discord/server'

function safeMessage(value) {
  return encodeURIComponent(String(value || '').slice(0, 180))
}

async function requireOwnerGuild(supabase, guildId, userId) {
  const { data: guild } = await supabase.from('guilds').select('id, name, owner_user_id, plan_code').eq('id', guildId).eq('owner_user_id', userId).single()
  if (!guild) throw new Error('Guild owner access required')
  if (guild.plan_code === 'free') throw new Error('Discord operations require the GUILD plan')
  return guild
}

async function requireManagerGuild(supabase, guildId, userId) {
  const { data: guild } = await supabase.from('guilds').select('id, name, owner_user_id, plan_code').eq('id', guildId).single()
  if (!guild) throw new Error('Guild not found')
  if (guild.plan_code === 'free') throw new Error('Discord operations require the GUILD plan')
  if (guild.owner_user_id === userId) return guild
  const { data: membership } = await supabase.from('guild_users').select('role').eq('guild_id', guildId).eq('user_id', userId).in('role', ['owner', 'officer']).maybeSingle()
  if (!membership) throw new Error('Officer access required')
  return guild
}

async function authUser(supabase) {
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')
  return userId
}

export async function provisionDiscordWorkspace(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const discordGuildId = String(formData.get('discord_guild_id') || '')
  const supabase = await createClient()
  const userId = await authUser(supabase)

  let destination
  try {
    await requireOwnerGuild(supabase, guildId, userId)
    const botGuilds = await listBotGuilds()
    const discordGuild = botGuilds.find((item) => item.id === discordGuildId)
    if (!discordGuild) throw new Error('HeadlessGM is not installed in that Discord server')

    const channels = await provisionHeadlessGMChannels(discordGuildId)
    const { error } = await supabase.from('discord_connections').upsert({
      guild_id: guildId,
      discord_guild_id: discordGuild.id,
      discord_guild_name: discordGuild.name,
      installed_by_user_id: userId,
      bot_installed: true,
      metadata: {
        channel_id: channels.control.id,
        channel_name: channels.control.name,
        category_id: channels.category.id,
        recruitment_channel_id: channels.recruitment.id,
        recruitment_channel_name: channels.recruitment.name,
        officer_ops_channel_id: channels.officerOps.id,
        officer_ops_channel_name: channels.officerOps.name,
        provisioned_by_headlessgm: true,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'guild_id' })
    if (error) throw error

    await publishDiscordControlPanel(channels.control.id, guildId, discordGuild.name)
    revalidatePath('/app')
    revalidatePath('/app/settings/discord')
    destination = `/app/settings/discord?success=${safeMessage('Created HEADLESSGM category, #headlessgm, #recruitment and #officer-ops, then published the member control panel.')}`
  } catch (error) {
    const message = error?.message || 'Could not create Discord channels'
    destination = `/app/settings/discord?error=${safeMessage(message.includes('Missing Permissions') ? 'Discord denied channel creation. Reconnect/install HeadlessGM with Manage Channels permission, then try again.' : message)}`
  }
  redirect(destination)
}

export async function saveDiscordConnection(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const discordGuildId = String(formData.get('discord_guild_id') || '')
  const channelId = String(formData.get('channel_id') || '')
  const supabase = await createClient()
  const userId = await authUser(supabase)

  let destination
  try {
    await requireOwnerGuild(supabase, guildId, userId)
    const botGuilds = await listBotGuilds()
    const discordGuild = botGuilds.find((item) => item.id === discordGuildId)
    if (!discordGuild) throw new Error('HeadlessGM is not installed in that Discord server')
    const channels = await listGuildTextChannels(discordGuildId)
    const channel = channels.find((item) => item.id === channelId)
    if (!channel) throw new Error('Selected Discord channel is not available to HeadlessGM')

    const { error } = await supabase.from('discord_connections').upsert({
      guild_id: guildId,
      discord_guild_id: discordGuild.id,
      discord_guild_name: discordGuild.name,
      installed_by_user_id: userId,
      bot_installed: true,
      metadata: { channel_id: channel.id, channel_name: channel.name },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'guild_id' })
    if (error) throw error
    revalidatePath('/app')
    revalidatePath('/app/settings/discord')
    destination = `/app/settings/discord?success=${safeMessage(`Connected to ${discordGuild.name} · #${channel.name}`)}`
  } catch (error) {
    destination = `/app/settings/discord?error=${safeMessage(error.message || 'Discord connection failed')}&server=${safeMessage(discordGuildId)}`
  }
  redirect(destination)
}

export async function reconnectDiscord(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const supabase = await createClient()
  const userId = await authUser(supabase)
  let destination
  try {
    await requireOwnerGuild(supabase, guildId, userId)
    const { error } = await supabase.from('discord_connections').delete().eq('guild_id', guildId)
    if (error) throw error
    revalidatePath('/app')
    revalidatePath('/app/settings/discord')
    destination = `/app/settings/discord?success=${safeMessage('Discord connection cleared. Choose the new Discord server and channel below.')}`
  } catch (error) {
    destination = `/app/settings/discord?error=${safeMessage(error.message || 'Could not reset Discord connection')}`
  }
  redirect(destination)
}

export async function sendDiscordTestMessage(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const supabase = await createClient()
  const userId = await authUser(supabase)
  let destination
  try {
    const guild = await requireOwnerGuild(supabase, guildId, userId)
    const { data: connection } = await supabase.from('discord_connections').select('discord_guild_name, metadata').eq('guild_id', guildId).single()
    const channelId = connection?.metadata?.channel_id
    if (!channelId) throw new Error('Choose a HeadlessGM Discord channel first')
    await sendChannelMessage(channelId, {
      embeds: [{ title: 'HeadlessGM connected', description: `**${guild.name}** is now connected to HeadlessGM. This channel is the member control panel for character linking, LOA, events, lineups, and rewards.`, footer: { text: 'Headless Guild Management' } }],
    })
    destination = `/app/settings/discord?success=${safeMessage('Test message sent to Discord')}`
  } catch (error) {
    destination = `/app/settings/discord?error=${safeMessage(error.message || 'Could not send Discord message')}`
  }
  redirect(destination)
}

export async function publishHeadlessGMControlPanel(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const supabase = await createClient()
  const userId = await authUser(supabase)
  let destination
  try {
    const guild = await requireManagerGuild(supabase, guildId, userId)
    const { data: connection, error } = await supabase.from('discord_connections').select('metadata').eq('guild_id', guildId).single()
    if (error) throw error
    const channelId = connection?.metadata?.channel_id
    if (!channelId) throw new Error('No #headlessgm channel is configured for this guild')
    await publishDiscordControlPanel(channelId, guild.id, guild.name)
    revalidatePath('/app/settings/discord')
    destination = `/app/settings/discord?success=${safeMessage('HeadlessGM control panel published')}`
  } catch (error) {
    destination = `/app/settings/discord?error=${safeMessage(error.message || 'Could not publish HeadlessGM control panel')}`
  }
  redirect(destination)
}
