import { NextResponse } from 'next/server'
import nacl from 'tweetnacl'
import { createAdminClient } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

function hexToBytes(value) {
  if (!value || !/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null
  const bytes = new Uint8Array(value.length / 2)
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

async function verifyDiscordSignature(rawBody, request) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY
  const signature = request.headers.get('x-signature-ed25519')
  const timestamp = request.headers.get('x-signature-timestamp')
  if (!publicKey || !signature || !timestamp) return false

  const keyBytes = hexToBytes(publicKey)
  const sigBytes = hexToBytes(signature)
  if (!keyBytes || keyBytes.length !== 32 || !sigBytes || sigBytes.length !== 64) return false

  return nacl.sign.detached.verify(
    new TextEncoder().encode(timestamp + rawBody),
    sigBytes,
    keyBytes,
  )
}

function ephemeral(content) {
  return NextResponse.json({ type: 4, data: { content, flags: 64 } })
}

async function requirePaidDiscordGuild(guildId) {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('guilds').select('plan_code,status').eq('id', guildId).maybeSingle()
    if (error || !data || data.status !== 'active') return false
    return ['guild', 'commander', 'beta'].includes(String(data.plan_code || '').toLowerCase())
  } catch {
    return false
  }
}

export async function POST(request) {
  const rawBody = await request.text()
  if (!(await verifyDiscordSignature(rawBody, request))) {
    return NextResponse.json({ error: 'Invalid request signature' }, { status: 401 })
  }

  let interaction
  try {
    interaction = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (interaction.type === 1) return NextResponse.json({ type: 1 })

  if (interaction.type === 3) {
    const customId = String(interaction.data?.custom_id || '')
    const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://headlessgm-nu.vercel.app'

    if (customId.startsWith('hgm:link:')) {
      const guildId = customId.slice('hgm:link:'.length)
      if (!/^[0-9a-f-]{36}$/i.test(guildId)) return ephemeral('This HeadlessGM link is invalid.')
      if (!(await requirePaidDiscordGuild(guildId))) return ephemeral('This HeadlessGM Discord integration is currently inactive. The guild owner can reactivate it by restoring a GUILD or COMMANDER subscription.')
      const url = `${site}/app/link-character?guild=${encodeURIComponent(guildId)}`
      return ephemeral(`Open HeadlessGM to choose your existing character: ${url}`)
    }

    if (customId.startsWith('hgm:member:')) {
      const match = customId.match(/^hgm:member:(loa|events|lineup|rewards):([0-9a-f-]{36})$/i)
      if (!match) return ephemeral('This HeadlessGM member action is invalid.')
      const [, view, guildId] = match
      if (!(await requirePaidDiscordGuild(guildId))) return ephemeral('This HeadlessGM Discord integration is currently inactive. The guild owner can reactivate it by restoring a GUILD or COMMANDER subscription.')
      const url = `${site}/app/member?guild=${encodeURIComponent(guildId)}&view=${encodeURIComponent(view)}`
      const labels = {
        loa: 'File or cancel your event LOA',
        events: 'View upcoming guild events',
        lineup: 'View your current lineup assignments',
        rewards: 'View your published reward assignments',
      }
      return ephemeral(`${labels[view]}: ${url}`)
    }
  }

  return ephemeral('HeadlessGM received this interaction, but that action is not available yet.')
}
