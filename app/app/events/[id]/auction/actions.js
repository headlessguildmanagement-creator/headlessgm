'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../../../lib/supabase/server'
import { sendChannelMessage } from '../../../../../lib/discord/server'

function safe(value) { return encodeURIComponent(String(value || '').slice(0, 220)) }
function qty(value) { const n = Number(value); return Number.isInteger(n) && n >= 0 ? n : 0 }

function shuffle(items) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function allocate(category, total, pool, cap, source) {
  if (!total || !pool.length) return { rows: [], unassigned: total }
  const max = cap == null ? Number.MAX_SAFE_INTEGER : cap
  const counts = new Map(pool.map((member) => [member.id, 0]))
  let remaining = total
  while (remaining > 0) {
    let progressed = false
    for (const member of pool) {
      if (remaining <= 0) break
      const current = counts.get(member.id) || 0
      if (current >= max) continue
      counts.set(member.id, current + 1)
      remaining -= 1
      progressed = true
    }
    if (!progressed) break
  }
  return {
    rows: [...counts.entries()].filter(([, count]) => count > 0).map(([guild_member_id, quantity]) => ({ guild_member_id, category, quantity, source, metadata: {} })),
    unassigned: remaining,
  }
}

async function context(eventId) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const { data: event } = await supabase.from('guild_events').select('id,guild_id,name,status,event_type,starts_at').eq('id', eventId).maybeSingle()
  if (!event) throw new Error('Event not found')
  const { data: guild } = await supabase.from('guilds').select('id,name,owner_user_id').eq('id', event.guild_id).single()
  const manager = guild.owner_user_id === userId || Boolean((await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).in('role', ['owner','officer']).maybeSingle()).data)
  if (!manager) throw new Error('Officer access required')
  return { supabase, userId, event, guild }
}

export async function generateAuctionDraft(formData) {
  const eventId = String(formData.get('event_id') || '')
  let url = `/app/events/${eventId}/auction`
  try {
    const { supabase, event } = await context(eventId)
    const quantities = {
      light_dark_feather: qty(formData.get('light_dark_feather')),
      time_space_feather: qty(formData.get('time_space_feather')),
      puppet_fragment: qty(formData.get('puppet_fragment')),
      illusion_fragment: qty(formData.get('illusion_fragment')),
    }
    const activeGroup = Number(formData.get('active_feather_group') || 0) || null

    const [{ data: rules }, { data: members }, { data: loas }, { data: absences }, { data: queue }] = await Promise.all([
      supabase.from('guild_auction_rules').select('*').eq('guild_id', event.guild_id).single(),
      supabase.from('guild_members').select('id,ign,job_code,combat_role,feather_group,status').eq('guild_id', event.guild_id).eq('status', 'active').order('ign'),
      supabase.from('event_loas').select('guild_member_id').eq('event_id', eventId).is('cancelled_at', null),
      supabase.from('event_absences').select('guild_member_id').eq('event_id', eventId),
      supabase.from('puppet_queue').select('guild_member_id,position,is_active').eq('guild_id', event.guild_id).eq('is_active', true).order('position'),
    ])

    const unavailable = new Set([...(loas || []).map((x) => x.guild_member_id), ...(absences || []).map((x) => x.guild_member_id)])
    const eligible = (members || []).filter((member) => !unavailable.has(member.id))
    const memberMap = new Map((members || []).map((member) => [member.id, member]))
    const caps = {
      light_dark_feather: rules.light_dark_feather_cap,
      time_space_feather: rules.time_space_feather_cap,
      puppet_fragment: rules.puppet_fragment_cap,
      illusion_fragment: rules.illusion_fragment_cap,
    }

    if (rules.feather_mode === 'four_group' && ![1,2,3,4].includes(activeGroup)) throw new Error('Choose the active Feather group for this event')

    const allocations = []
    const unassigned = {}
    const output = {
      eligible_member_ids: eligible.map((member) => member.id),
      unavailable_member_ids: [...unavailable],
      feather_mode: rules.feather_mode,
      puppet_mode: rules.puppet_mode,
      active_feather_group: activeGroup,
      ffa: {},
      unassigned: {},
    }

    for (const category of ['light_dark_feather','time_space_feather']) {
      const total = quantities[category]
      if (rules.feather_mode === 'ffa') {
        output.ffa[category] = { quantity: total, eligible_member_ids: eligible.map((m) => m.id), cap: caps[category] }
        continue
      }
      let pool = rules.feather_mode === 'four_group' ? eligible.filter((member) => member.feather_group === activeGroup) : shuffle(eligible)
      const result = allocate(category, total, pool, caps[category], rules.feather_mode === 'random' ? 'rotation' : 'base')
      allocations.push(...result.rows)
      unassigned[category] = result.unassigned
    }

    if (rules.puppet_mode === 'ffa') {
      output.ffa.puppet_fragment = { quantity: quantities.puppet_fragment, eligible_member_ids: eligible.map((m) => m.id), cap: caps.puppet_fragment }
    } else {
      let puppetPool
      if (rules.puppet_mode === 'round_robin') {
        puppetPool = (queue || []).map((row) => memberMap.get(row.guild_member_id)).filter((member) => member && !unavailable.has(member.id))
      } else {
        puppetPool = shuffle(eligible)
      }
      const result = allocate('puppet_fragment', quantities.puppet_fragment, puppetPool, caps.puppet_fragment, rules.puppet_mode === 'round_robin' ? 'queue' : 'rotation')
      allocations.push(...result.rows)
      unassigned.puppet_fragment = result.unassigned
    }

    output.ffa.illusion_fragment = { quantity: quantities.illusion_fragment, eligible_member_ids: eligible.map((m) => m.id), cap: caps.illusion_fragment }
    output.unassigned = unassigned

    const { data: runId, error } = await supabase.rpc('replace_auction_draft', {
      p_event_id: eventId,
      p_input_data: { quantities, active_feather_group: activeGroup },
      p_generated_output: output,
      p_allocations: allocations,
      p_active_feather_group_id: null,
    })
    if (error) throw error

    revalidatePath(`/app/events/${eventId}/auction`)
    revalidatePath(`/app/events/${eventId}`)
    url += `?success=${safe(`Draft generated. ${allocations.length} allocation rows created. Review before publishing.`)}`
  } catch (error) {
    url += `?error=${safe(error.message || 'Could not generate auction draft.')}`
  }
  redirect(url)
}

export async function publishAuction(formData) {
  const eventId = String(formData.get('event_id') || '')
  const runId = String(formData.get('auction_run_id') || '')
  let url = `/app/events/${eventId}/auction`
  try {
    const { supabase, event, guild } = await context(eventId)
    const [{ data: run }, { data: allocations }, { data: members }, { data: connection }] = await Promise.all([
      supabase.from('auction_runs').select('id,status,input_data,generated_output,rules_snapshot').eq('id', runId).eq('event_id', eventId).single(),
      supabase.from('auction_allocations').select('guild_member_id,category,quantity,source').eq('auction_run_id', runId).order('category'),
      supabase.from('guild_members').select('id,ign').eq('guild_id', event.guild_id),
      supabase.from('discord_connections').select('metadata').eq('guild_id', event.guild_id).maybeSingle(),
    ])
    if (run.status !== 'draft') throw new Error('Only draft auctions can be published')
    const memberMap = new Map((members || []).map((m) => [m.id, m.ign]))
    const lines = (allocations || []).slice(0, 40).map((row) => `• ${row.category.replaceAll('_',' ')} — **${memberMap.get(row.guild_member_id) || 'Unknown'}** × ${row.quantity}`)
    const ffa = run.generated_output?.ffa || {}
    for (const [category, info] of Object.entries(ffa)) {
      if (info?.quantity > 0) lines.push(`• ${category.replaceAll('_',' ')} — FFA · ${info.quantity} available · cap ${info.cap ?? 'unlimited'}`)
    }

    const channelId = connection?.metadata?.channel_id
    if (channelId) {
      await sendChannelMessage(channelId, {
        embeds: [{ title: `${event.name} · Auction`, description: lines.length ? lines.join('\n') : 'No reward quantities configured.', footer: { text: 'HeadlessGM · Officer-published auction' } }],
        allowed_mentions: { parse: [] },
      })
    }

    const { error } = await supabase.rpc('publish_auction_run', { p_run_id: runId })
    if (error) throw error
    revalidatePath(`/app/events/${eventId}/auction`)
    revalidatePath('/app/member')
    url += `?success=${safe(channelId ? 'Auction published to Discord and locked for finalization.' : 'Auction published and locked. No Discord control channel is configured.')}`
  } catch (error) {
    url += `?error=${safe(error.message || 'Could not publish auction.')}`
  }
  redirect(url)
}

export async function finalizeAuction(formData) {
  const eventId = String(formData.get('event_id') || '')
  const runId = String(formData.get('auction_run_id') || '')
  let url = `/app/events/${eventId}/auction`
  try {
    const { supabase } = await context(eventId)
    const { error } = await supabase.rpc('finalize_auction_run', { p_run_id: runId })
    if (error) throw error
    revalidatePath(`/app/events/${eventId}/auction`)
    revalidatePath(`/app/events/${eventId}`)
    revalidatePath('/app/events')
    revalidatePath('/app/member')
    url += `?success=${safe('Auction finalized. Persistent Puppet queue advanced only now, and the event was completed.')}`
  } catch (error) {
    url += `?error=${safe(error.message || 'Could not finalize auction.')}`
  }
  redirect(url)
}
