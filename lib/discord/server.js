const DISCORD_API_BASE = 'https://discord.com/api/v10'

function getBotToken() {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) {
    throw new Error('DISCORD_BOT_TOKEN is not configured')
  }
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
    } catch {
      // Keep the HTTP status message when Discord returns a non-JSON response.
    }
    throw new Error(message)
  }

  if (response.status === 204) return null
  return response.json()
}

export async function listBotGuilds() {
  const guilds = await discordRequest('/users/@me/guilds')
  return guilds
    .map((guild) => ({ id: guild.id, name: guild.name, icon: guild.icon }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function listGuildTextChannels(discordGuildId) {
  if (!/^\d+$/.test(discordGuildId || '')) return []

  const channels = await discordRequest(`/guilds/${discordGuildId}/channels`)
  return channels
    .filter((channel) => channel.type === 0 || channel.type === 5)
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      position: channel.position ?? 0,
      type: channel.type,
    }))
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
}

export async function sendChannelMessage(channelId, payload) {
  if (!/^\d+$/.test(channelId || '')) throw new Error('Invalid Discord channel')
  return discordRequest(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function editChannelMessage(channelId, messageId, payload) {
  if (!/^\d+$/.test(channelId || '') || !/^\d+$/.test(messageId || '')) {
    throw new Error('Invalid Discord channel or message')
  }
  return discordRequest(`/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function publishHeadlessGMControlPanel(channelId, guildId, guildName) {
  if (!/^\d+$/.test(channelId || '')) throw new Error('Invalid Discord channel')
  if (!/^[0-9a-f-]{36}$/i.test(guildId || '')) throw new Error('Invalid HeadlessGM guild')

  return sendChannelMessage(channelId, {
    embeds: [{
      title: 'HeadlessGM',
      description: `**${guildName}** guild operations, without spreadsheet chaos.\n\nUse the controls below to connect your Discord identity to your existing HeadlessGM character roster. Officers approve every link before it becomes active.`,
      footer: { text: 'Headless Guild Management' },
    }],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 1, label: 'Link My Character', custom_id: `hgm:link:${guildId}` },
          { type: 2, style: 2, label: 'File LOA', custom_id: 'hgm:coming_soon:loa', disabled: true },
          { type: 2, style: 2, label: 'Upcoming Events', custom_id: 'hgm:coming_soon:events', disabled: true },
        ],
      },
      {
        type: 1,
        components: [
          { type: 2, style: 2, label: 'My Lineup', custom_id: 'hgm:coming_soon:lineup', disabled: true },
          { type: 2, style: 2, label: 'My Rewards', custom_id: 'hgm:coming_soon:rewards', disabled: true },
        ],
      },
    ],
    allowed_mentions: { parse: [] },
  })
}

export function isDiscordBotConfigured() {
  return Boolean(process.env.DISCORD_BOT_TOKEN)
}
