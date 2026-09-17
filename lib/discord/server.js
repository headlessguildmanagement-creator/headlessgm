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
    .map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
    }))
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
  if (!/^\d+$/.test(channelId || '')) {
    throw new Error('Invalid Discord channel')
  }

  return discordRequest(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function isDiscordBotConfigured() {
  return Boolean(process.env.DISCORD_BOT_TOKEN)
}
