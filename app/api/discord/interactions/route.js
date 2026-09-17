import { NextResponse } from 'next/server'
import nacl from 'tweetnacl'

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
    if (customId.startsWith('hgm:link:')) {
      const guildId = customId.slice('hgm:link:'.length)
      if (!/^[0-9a-f-]{36}$/i.test(guildId)) {
        return NextResponse.json({ type: 4, data: { content: 'This HeadlessGM link is invalid.', flags: 64 } })
      }
      const url = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://headlessgm-nu.vercel.app'}/app/link-character?guild=${encodeURIComponent(guildId)}`
      return NextResponse.json({
        type: 4,
        data: {
          content: `Open HeadlessGM to choose your existing character: ${url}`,
          flags: 64,
        },
      })
    }
    if (customId.startsWith('hgm:coming_soon:')) {
      return NextResponse.json({ type: 4, data: { content: 'Coming soon.', flags: 64 } })
    }
  }

  return NextResponse.json({ type: 4, data: { content: 'HeadlessGM received this interaction, but that action is not available yet.', flags: 64 } })
}
