import { NextResponse } from 'next/server'
import nacl from 'tweetnacl'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { uniqueIgnMatch } from '../../../../lib/ign-normalize.mjs'

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

function paidPlan(planCode) {
  return ['guild', 'commander', 'beta'].includes(String(planCode || '').toLowerCase())
}

async function requirePaidDiscordGuild(guildId, discordGuildId) {
  try {
    if (!guildId || !discordGuildId) return false
    const admin = createAdminClient()
    const [{ data: guild, error: guildError }, { data: connection, error: connectionError }] = await Promise.all([
      admin.from('guilds').select('id,plan_code,status').eq('id', guildId).maybeSingle(),
      admin.from('discord_connections').select('guild_id,discord_guild_id,bot_installed').eq('guild_id', guildId).maybeSingle(),
    ])
    if (guildError || connectionError || !guild || !connection) return false
    if (guild.status !== 'active' || !paidPlan(guild.plan_code) || !connection.bot_installed) return false
    return String(connection.discord_guild_id || '') === String(discordGuildId)
  } catch {
    return false
  }
}

async function resolveConnectedGuild(discordGuildId) {
  if (!discordGuildId) return { error: 'Run this command inside the Discord server connected to HeadlessGM.' }
  const admin = createAdminClient()
  const { data: rows, error } = await admin
    .from('discord_connections')
    .select('guild_id,discord_guild_id,metadata,bot_installed')
    .eq('discord_guild_id', String(discordGuildId))
    .eq('bot_installed', true)

  if (error || !rows?.length) return { error: 'This Discord server is not connected to HeadlessGM.' }
  if (rows.length !== 1) return { error: 'This Discord server has an ambiguous HeadlessGM connection. Ask an officer to reconnect it.' }

  const connection = rows[0]
  const { data: guild } = await admin.from('guilds').select('id,name,plan_code,status').eq('id', connection.guild_id).maybeSingle()
  if (!guild || guild.status !== 'active' || !paidPlan(guild.plan_code)) {
    return { error: 'This HeadlessGM Discord integration is currently inactive. The guild owner can restore it with GUILD or COMMANDER.' }
  }
  return { admin, guild, connection }
}

function commandOption(interaction, name) {
  return interaction.data?.options?.find((option) => option.name === name)?.value
}

function isScreenshotAttachment(attachment) {
  const type = String(attachment?.content_type || '').toLowerCase()
  const filename = String(attachment?.filename || '').toLowerCase()
  return type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(filename)
}

async function handleAuctionProof(interaction) {
  const resolved = await resolveConnectedGuild(interaction.guild_id)
  if (resolved.error) return ephemeral(resolved.error)
  const { admin, guild, connection } = resolved

  const proofChannelId = String(connection.metadata?.auction_proof_channel_id || connection.metadata?.channel_id || '')
  if (proofChannelId && String(interaction.channel_id || '') !== proofChannelId) {
    const label = connection.metadata?.auction_proof_channel_name ? `#${connection.metadata.auction_proof_channel_name}` : 'the configured auction-proof channel'
    return ephemeral(`Submit auction proof in ${label}.`)
  }

  const ign = String(commandOption(interaction, 'ign') || '').trim()
  const attachmentId = String(commandOption(interaction, 'screenshot') || '')
  const attachment = interaction.data?.resolved?.attachments?.[attachmentId]
  if (!ign) return ephemeral('IGN is required. Use the IGN shown on the published bidding list.')
  if (!attachment || !isScreenshotAttachment(attachment)) return ephemeral('Attach a screenshot image to submit auction proof.')

  const { data: events, error: eventError } = await admin.from('guild_events').select('id').eq('guild_id', guild.id)
  if (eventError) return ephemeral('HeadlessGM could not resolve the current auction.')
  const eventIds = (events || []).map((event) => event.id)
  if (!eventIds.length) return ephemeral('There is no published auction waiting for proof.')

  const { data: runs, error: runError } = await admin
    .from('auction_runs')
    .select('id,event_id,status,published_at')
    .in('event_id', eventIds)
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (runError || !runs?.length) return ephemeral('There is no published auction waiting for proof.')
  if (runs.length > 1) return ephemeral('More than one auction is currently published. Ask an officer to resolve the older auction before submitting proof.')

  const run = runs[0]
  const [{ data: allocations }, { data: proxies }, { data: members }] = await Promise.all([
    admin.from('auction_allocations').select('id,guild_member_id').eq('auction_run_id', run.id),
    admin.from('auction_bidder_proxies').select('allocation_id,bidder_member_id').eq('auction_run_id', run.id),
    admin.from('guild_members').select('id,ign,status').eq('guild_id', guild.id).eq('status', 'active'),
  ])

  const match = uniqueIgnMatch(members || [], ign)
  if (!match.key) return ephemeral('That IGN could not be parsed. Enter the recognizable letters/numbers from your roster IGN.')
  if (match.ambiguous) return ephemeral('That IGN matches more than one roster member after normalization. Ask an officer to resolve the duplicate names.')
  if (!match.member) return ephemeral('That IGN was not found on the active guild roster.')

  const proxyMap = new Map((proxies || []).map((row) => [row.allocation_id, row.bidder_member_id]))
  const publishedBidderIds = new Set((allocations || []).map((row) => proxyMap.get(row.id) || row.guild_member_id))
  if (!publishedBidderIds.has(match.member.id)) {
    return ephemeral(`${match.member.ign} is not on the current published bidding list.`)
  }

  const posterId = String(interaction.member?.user?.id || interaction.user?.id || '')
  const { error: proofError } = await admin.rpc('record_auction_bid_proof', {
    p_run_id: run.id,
    p_bidder_member_id: match.member.id,
    p_ign_submitted: ign,
    p_ign_match_key: match.key,
    p_discord_user_id: posterId || null,
    p_discord_interaction_id: String(interaction.id || ''),
  })
  if (proofError) return ephemeral(proofError.message || 'HeadlessGM could not record that proof.')

  return ephemeral(`✅ Proof received for ${match.member.ign}. The screenshot was validated as an attachment but is not stored by HeadlessGM.`)
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

  if (interaction.type === 2 && interaction.data?.name === 'auction-proof') {
    return handleAuctionProof(interaction)
  }

  if (interaction.type === 3) {
    const customId = String(interaction.data?.custom_id || '')
    const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://headlessgm-nu.vercel.app'

    if (customId.startsWith('hgm:link:')) {
      const guildId = customId.slice('hgm:link:'.length)
      if (!/^[0-9a-f-]{36}$/i.test(guildId)) return ephemeral('This HeadlessGM link is invalid.')
      if (!(await requirePaidDiscordGuild(guildId, interaction.guild_id))) return ephemeral('This HeadlessGM Discord integration is currently inactive or this control panel belongs to a different Discord server.')
      const url = `${site}/app/link-character?guild=${encodeURIComponent(guildId)}`
      return ephemeral(`Open HeadlessGM to choose your existing character: ${url}`)
    }

    if (customId.startsWith('hgm:member:')) {
      const match = customId.match(/^hgm:member:(loa|events|lineup|rewards):([0-9a-f-]{36})$/i)
      if (!match) return ephemeral('This HeadlessGM member action is invalid.')
      const [, view, guildId] = match
      if (!(await requirePaidDiscordGuild(guildId, interaction.guild_id))) return ephemeral('This HeadlessGM Discord integration is currently inactive or this control panel belongs to a different Discord server.')
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
