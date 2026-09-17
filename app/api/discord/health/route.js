import { NextResponse } from 'next/server'
import { listBotGuilds, isDiscordBotConfigured } from '../../../../lib/discord/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isDiscordBotConfigured()) {
    return NextResponse.json({ configured: false, connected: false }, { status: 503 })
  }

  try {
    const guilds = await listBotGuilds()
    return NextResponse.json({
      configured: true,
      connected: true,
      guildCount: guilds.length,
      guilds: guilds.map((guild) => ({ id: guild.id, name: guild.name })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        connected: false,
        error: error.message || 'Discord connection failed',
      },
      { status: 502 },
    )
  }
}
