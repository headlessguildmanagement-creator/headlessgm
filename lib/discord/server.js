const DISCORD_API_BASE = 'https://discord.com/api/v10'

function getBotToken() {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) throw new Error('DISCORD_BOT_TOKEN is not configured')
  return token
}

async function discordRequest(path, options = {}) {
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      Authorization: `Bot ${getBotToken()}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    let message = `Discord API request failed (${response.status})`
    try {
      const payload = await response.json()
      if (payload?.message) message = payload.message
    } catch {}
    throw new Error(message)
  }

  if (response.status === 204) return null
  return response.json()
}

export async function getDiscordInstallUrl() {
  const bot = await discordRequest('/users/@me')
  if (!bot?.id) throw new Error('Could not resolve HeadlessGM Discord application')
  const permissions = 85008 // Manage Channels, View Channels, Send Messages, Embed Links, Read Message History
  const params = new URLSearchParams({
    client_id: bot.id,
    scope: 'bot applications.commands',
    permissions: String(permissions),
  })
  return `https://discord.com/oauth2/authorize?${params.toString()}`
}

export async function listBotGuilds() {
  const guilds = await discordRequest('/users/@me/guilds')
  return guilds.map((guild) => ({ id: guild.id, name: guild.name, icon: guild.icon })).sort((a, b) => a.name.localeCompare(b.name))
}

export async function listGuildTextChannels(discordGuildId) {
  if (!/^\d+$/.test(discordGuildId || '')) return []
  const channels = await discordRequest(`/guilds/${discordGuildId}/channels`)
  return channels
    .filter((channel) => channel.type === 0 || channel.type === 5)
    .map((channel) => ({ id: channel.id, name: channel.name, position: channel.position ?? 0, type: channel.type, parent_id: channel.parent_id || null }))
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
}

export async function provisionHeadlessGMChannels(discordGuildId) {
  if (!/^\d+$/.test(discordGuildId || '')) throw new Error('Invalid Discord server')

  const existing = await discordRequest(`/guilds/${discordGuildId}/channels`)
  let category = existing.find((channel) => channel.type === 4 && channel.name.toLowerCase() === 'headlessgm')
  if (!category) {
    category = await discordRequest(`/guilds/${discordGuildId}/channels`, {
      method: 'POST',
      body: JSON.stringify({ name: 'HEADLESSGM', type: 4 }),
    })
  }

  async function ensureText(name, topic) {
    const found = existing.find((channel) => channel.type === 0 && channel.name === name && channel.parent_id === category.id)
    if (found) return found
    return discordRequest(`/guilds/${discordGuildId}/channels`, {
      method: 'POST',
      body: JSON.stringify({ name, type: 0, parent_id: category.id, topic }),
    })
  }

  const control = await ensureText('headlessgm', 'HeadlessGM member controls, LOA, events, lineup and published rewards.')
  const recruitment = await ensureText('recruitment', 'HeadlessGM recruitment notifications and applicant updates.')
  const officerOps = await ensureText('officer-ops', 'Private HeadlessGM officer operations, attendance, lineup and auction alerts.')
  const auctionProof = await ensureText('auction-proof', 'Submit auction proof with /auction-proof, your IGN, and a screenshot. HeadlessGM stores proof status only, not the screenshot.')

  return {
    category: { id: category.id, name: category.name },
    control: { id: control.id, name: control.name },
    recruitment: { id: recruitment.id, name: recruitment.name },
    officerOps: { id: officerOps.id, name: officerOps.name },
    auctionProof: { id: auctionProof.id, name: auctionProof.name },
  }
}

export async function registerAuctionProofCommand(discordGuildId) {
  if (!/^\d+$/.test(discordGuildId || '')) throw new Error('Invalid Discord server')
  const bot = await discordRequest('/users/@me')
  if (!bot?.id) throw new Error('Could not resolve HeadlessGM Discord application')

  const command = {
    name: 'auction-proof',
    description: 'Submit screenshot proof for your published auction IGN',
    options: [
      { type: 3, name: 'ign', description: 'IGN shown on the published bidding list', required: true },
      { type: 11, name: 'screenshot', description: 'Screenshot of your bidding proof', required: true },
    ],
  }

  const path = `/applications/${bot.id}/guilds/${discordGuildId}/commands`
  const existing = await discordRequest(path)
  const current = existing.find((item) => item.name === command.name)
  if (current?.id) {
    return discordRequest(`${path}/${current.id}`, { method: 'PATCH', body: JSON.stringify(command) })
  }
  return discordRequest(path, { method: 'POST', body: JSON.stringify(command) })
}

export async function sendChannelMessage(channelId, payload) {
  if (!/^\d+$/.test(channelId || '')) throw new Error('Invalid Discord channel')
  return discordRequest(`/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify(payload) })
}

export async function sendDirectMessage(discordUserId, payload) {
  if (!/^\d+$/.test(discordUserId || '')) throw new Error('Invalid Discord user')
  const dmChannel = await discordRequest('/users/@me/channels', { method: 'POST', body: JSON.stringify({ recipient_id: discordUserId }) })
  if (!dmChannel?.id) throw new Error('Could not open Discord direct message channel')
  return sendChannelMessage(dmChannel.id, payload)
}

export async function editChannelMessage(channelId, messageId, payload) {
  if (!/^\d+$/.test(channelId || '') || !/^\d+$/.test(messageId || '')) throw new Error('Invalid Discord channel or message')
  return discordRequest(`/channels/${channelId}/messages/${messageId}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export async function publishHeadlessGMControlPanel(channelId, guildId, guildName) {
  if (!/^\d+$/.test(channelId || '')) throw new Error('Invalid Discord channel')
  if (!/^[0-9a-f-]{36}$/i.test(guildId || '')) throw new Error('Invalid HeadlessGM guild')

  return sendChannelMessage(channelId, {
    embeds: [{
      title: 'HeadlessGM',
      description: `**${guildName}** guild operations.\n\nLink your character once, then use the same panel for LOA, events, lineups, and published reward assignments.`,
      footer: { text: 'Headless Guild Management' },
    }],
    components: [
      { type: 1, components: [
        { type: 2, style: 1, label: 'Link My Character', custom_id: `hgm:link:${guildId}` },
        { type: 2, style: 2, label: 'File LOA', custom_id: `hgm:member:loa:${guildId}` },
        { type: 2, style: 2, label: 'Upcoming Events', custom_id: `hgm:member:events:${guildId}` },
      ] },
      { type: 1, components: [
        { type: 2, style: 2, label: 'My Lineup', custom_id: `hgm:member:lineup:${guildId}` },
        { type: 2, style: 2, label: 'My Rewards', custom_id: `hgm:member:rewards:${guildId}` },
      ] },
    ],
    allowed_mentions: { parse: [] },
  })
}

export function isDiscordBotConfigured() {
  return Boolean(process.env.DISCORD_BOT_TOKEN)
}
