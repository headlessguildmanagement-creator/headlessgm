'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../../../lib/supabase/server'
import { sendChannelMessage } from '../../../../../lib/discord/server'
import { allocateCapped, allocateFairCombinedFeathers, eligiblePool, shuffleWith } from '../../../../../lib/auction-engine.mjs'
import { allocateOfficerExcess, isPuppet96hPenalty, selectPuppetTurns } from '../../../../../lib/puppet-engine.mjs'
import { havocFeatherGroupForInstant } from '../../../../../lib/havoc-rules.mjs'

function safe(value) { return encodeURIComponent(String(value || '').slice(0, 220)) }
function qty(value) { const n = Number(value); return Number.isInteger(n) && n >= 0 ? n : 0 }

async function context(eventId) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const { data: event } = await supabase.from('guild_events').select('id,guild_id,name,status,event_type,starts_at').eq('id', eventId).maybeSingle()
  if (!event) throw new Error('Event not found')
  const { data: guild } = await supabase.from('guilds').select('id,name,owner_user_id,game_preset_id,timezone,slug').eq('id', event.guild_id).single()
  const manager = guild.owner_user_id === userId || Boolean((await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).in('role', ['owner','officer']).maybeSingle()).data)
  if (!manager) throw new Error('Officer access required')
  return { supabase, userId, event, guild }
}

async function loadAuctionInputs(supabase, event, guild) {
  const [{ data: rules }, { data: members }, { data: loas }, { data: absences }, { data: queue }, { data: puppetState }, { data: puppetExclusions }, { data: featherExclusions }, { data: deferred }, { data: appeals }, { data: officerQueue }] = await Promise.all([
    supabase.from('guild_auction_rules').select('*').eq('guild_id', event.guild_id).single(),
    supabase.from('guild_members').select('id,ign,job_code,combat_role,feather_group,status,created_at,is_officer').eq('guild_id', event.guild_id).eq('status', 'active').order('ign'),
    supabase.from('event_loas').select('guild_member_id').eq('event_id', event.id).is('cancelled_at', null),
    supabase.from('event_absences').select('guild_member_id').eq('event_id', event.id),
    supabase.from('puppet_queue').select('guild_member_id,position,is_active').eq('guild_id', event.guild_id).eq('is_active', true).order('position'),
    supabase.from('guild_puppet_state').select('current_cycle,feather_officer_rotation_index').eq('guild_id', event.guild_id).maybeSingle(),
    supabase.from('event_puppet_exclusions').select('guild_member_id,reason').eq('event_id', event.id),
    supabase.from('event_feather_exclusions').select('guild_member_id,reason').eq('event_id', event.id),
    supabase.from('puppet_deferred_turns').select('id,guild_member_id,source_cycle,created_at,consumed_at').eq('guild_id', event.guild_id).is('consumed_at', null),
    supabase.from('puppet_appeals').select('id,guild_member_id,source_cycle,status,submitted_at,decided_at,consumed_at').eq('guild_id', event.guild_id).eq('status', 'approved').is('consumed_at', null),
    supabase.from('feather_officer_queue').select('guild_member_id,position,is_active').eq('guild_id', event.guild_id).eq('is_active', true).order('position'),
  ])
  const currentCycle = Number(puppetState?.current_cycle || 1)
  const { data: progress } = await supabase.from('puppet_cycle_progress').select('guild_member_id').eq('guild_id', event.guild_id).eq('cycle', currentCycle)
  return { rules, members: members || [], loas: loas || [], absences: absences || [], queue: queue || [], puppetState: puppetState || { current_cycle: 1, feather_officer_rotation_index: 0 }, puppetExclusions: puppetExclusions || [], featherExclusions: featherExclusions || [], deferred: deferred || [], appeals: appeals || [], officerQueue: officerQueue || [], progress: progress || [] }
}

export async function generateAuctionDraft(formData) {
  const eventId = String(formData.get('event_id') || '')
  let url = `/app/events/${eventId}/auction`
  try {
    const { supabase, event, guild } = await context(eventId)
    const quantities = {
      light_dark_feather: qty(formData.get('light_dark_feather')),
      time_space_feather: qty(formData.get('time_space_feather')),
      puppet_fragment: qty(formData.get('puppet_fragment')),
      illusion_fragment: qty(formData.get('illusion_fragment')),
    }
    const requestedGroup = Number(formData.get('active_feather_group') || 0) || null
    const data = await loadAuctionInputs(supabase, event, guild)
    const { rules, members, loas, absences, queue, puppetState, puppetExclusions, featherExclusions, deferred, appeals, officerQueue, progress } = data

    let activeGroup = requestedGroup
    if (rules.feather_mode === 'four_group' && ['guild_league','emperium_overrun'].includes(event.event_type)) activeGroup = havocFeatherGroupForInstant(event.event_type, event.starts_at, guild.timezone || 'Asia/Manila')
    if (rules.feather_mode === 'four_group' && ![1,2,3,4].includes(activeGroup)) throw new Error('Choose the active Feather group for this event')

    const unavailable = new Set([...loas.map((x) => x.guild_member_id), ...absences.map((x) => x.guild_member_id)])
    const puppetBlocked = new Set(puppetExclusions.map((x) => x.guild_member_id))
    const featherBlocked = new Set(featherExclusions.map((x) => x.guild_member_id))
    const penaltyIds = new Set(members.filter((member) => isPuppet96hPenalty(member, event.starts_at, guild.timezone || 'Asia/Manila')).map((member) => member.id))
    const generalEligible = eligiblePool(members, unavailable)
    const puppetEligible = generalEligible.filter((member) => !puppetBlocked.has(member.id) && !penaltyIds.has(member.id))
    const featherEligible = generalEligible.filter((member) => !featherBlocked.has(member.id) && !penaltyIds.has(member.id))
    const memberMap = new Map(members.map((member) => [member.id, member]))
    const caps = {
      light_dark_feather: rules.light_dark_feather_cap,
      time_space_feather: rules.time_space_feather_cap,
      puppet_fragment: rules.puppet_fragment_cap,
      illusion_fragment: rules.illusion_fragment_cap,
    }

    let activeFeatherGroupId = null
    if (rules.feather_mode === 'four_group') {
      const { data: groupRow } = await supabase.from('feather_groups').select('id').eq('guild_id', event.guild_id).eq('code', String(activeGroup)).maybeSingle()
      activeFeatherGroupId = groupRow?.id || null
    }

    const allocations = []
    const unassigned = {}
    const output = {
      eligible_member_ids: generalEligible.map((member) => member.id),
      puppet_eligible_member_ids: puppetEligible.map((member) => member.id),
      feather_eligible_member_ids: featherEligible.map((member) => member.id),
      unavailable_member_ids: [...unavailable],
      penalty_96h_member_ids: [...penaltyIds],
      puppet_cannot_bid_member_ids: [...puppetBlocked],
      feather_excluded_member_ids: [...featherBlocked],
      feather_mode: rules.feather_mode,
      puppet_mode: rules.puppet_mode,
      active_feather_group: activeGroup,
      active_feather_group_id: activeFeatherGroupId,
      ffa: {},
      unassigned: {},
      random_orders: {},
    }

    if (rules.feather_mode === 'four_group') {
      const pool = featherEligible.filter((member) => member.feather_group === activeGroup)
      const result = allocateFairCombinedFeathers(quantities.light_dark_feather, quantities.time_space_feather, pool, caps.light_dark_feather, caps.time_space_feather)
      allocations.push(...result.rows)

      const officerMembers = officerQueue.map((row) => memberMap.get(row.guild_member_id)).filter((member) => member && featherEligible.some((eligible) => eligible.id === member.id))
      const startIndex = Number(puppetState.feather_officer_rotation_index || 0)
      const ldExisting = new Map(Object.entries(result.quotas || {}).map(([id, q]) => [id, Number(q.light_dark_feather || 0)]))
      const tsExisting = new Map(Object.entries(result.quotas || {}).map(([id, q]) => [id, Number(q.time_space_feather || 0)]))
      const ldExcess = allocateOfficerExcess({ category: 'light_dark_feather', quantity: result.unassigned.light_dark_feather, officers: officerMembers, startIndex, cap: caps.light_dark_feather, existing: ldExisting })
      const tsExcess = allocateOfficerExcess({ category: 'time_space_feather', quantity: result.unassigned.time_space_feather, officers: officerMembers, startIndex: ldExcess.nextIndex, cap: caps.time_space_feather, existing: tsExisting })
      allocations.push(...ldExcess.rows, ...tsExcess.rows)
      unassigned.light_dark_feather = ldExcess.unassigned
      unassigned.time_space_feather = tsExcess.unassigned
      output.feather_distribution = { bidder_count: pool.length, equal_combined_total: result.equalCombined, regular_range: result.regularRange, fairness: 'combined_equal_rounds', officer_excess_ld: result.unassigned.light_dark_feather - ldExcess.unassigned, officer_excess_ts: result.unassigned.time_space_feather - tsExcess.unassigned }
      output.officer_rotation_start = startIndex
      output.officer_rotation_next = tsExcess.nextIndex
      output.officer_rotation_member_ids = officerMembers.map((member) => member.id)
    } else {
      for (const category of ['light_dark_feather','time_space_feather']) {
        const total = quantities[category]
        if (rules.feather_mode === 'ffa') {
          output.ffa[category] = { quantity: total, eligible_member_ids: caps[category] === 0 ? [] : featherEligible.map((m) => m.id), cap: caps[category] }
          continue
        }
        const pool = shuffleWith(featherEligible)
        output.random_orders[category] = pool.map((member) => member.id)
        const result = allocateCapped(category, total, pool, caps[category], 'rotation')
        allocations.push(...result.rows)
        unassigned[category] = result.unassigned
      }
    }

    if (rules.puppet_mode === 'ffa') {
      output.ffa.puppet_fragment = { quantity: quantities.puppet_fragment, eligible_member_ids: caps.puppet_fragment === 0 ? [] : puppetEligible.map((m) => m.id), cap: caps.puppet_fragment }
    } else if (rules.puppet_mode === 'round_robin') {
      const currentCycle = Number(puppetState.current_cycle || 1)
      const completedIds = new Set(progress.map((row) => row.guild_member_id))
      const selection = caps.puppet_fragment === 0
        ? { assignments: [], cycleCanFinish: false, counts: { deferred:0, appeal:0, normal:0, rollover:0 }, penaltyIds }
        : selectPuppetTurns({ members, queue, unavailableIds: unavailable, cannotBidIds: puppetBlocked, currentCycle, completedIds, deferred, appeals, requestedCount: quantities.puppet_fragment, eventStartsAt: event.starts_at, timeZone: guild.timezone || 'Asia/Manila' })
      for (const row of selection.assignments) allocations.push({ guild_member_id: row.guild_member_id, category: 'puppet_fragment', quantity: 1, source: row.turn_kind === 'normal' ? 'queue' : row.turn_kind, metadata: { turn_kind: row.turn_kind, source_cycle: row.source_cycle, cycle_offset: row.cycle_offset || 0, ...(row.deferred_id ? { deferred_id: row.deferred_id } : {}), ...(row.appeal_id ? { appeal_id: row.appeal_id } : {}) } })
      unassigned.puppet_fragment = Math.max(0, quantities.puppet_fragment - selection.assignments.length)
      output.puppet_selection = { current_cycle: currentCycle, cycle_can_finish: selection.cycleCanFinish, counts: selection.counts, selected_member_ids: selection.assignments.map((row) => row.guild_member_id) }
    } else {
      const pool = shuffleWith(puppetEligible)
      output.random_orders.puppet_fragment = pool.map((member) => member.id)
      const result = allocateCapped('puppet_fragment', quantities.puppet_fragment, pool, caps.puppet_fragment, 'rotation')
      allocations.push(...result.rows)
      unassigned.puppet_fragment = result.unassigned
    }

    output.ffa.illusion_fragment = { quantity: quantities.illusion_fragment, eligible_member_ids: caps.illusion_fragment === 0 ? [] : generalEligible.map((m) => m.id), cap: caps.illusion_fragment }
    output.unassigned = unassigned

    const { error } = await supabase.rpc('replace_auction_draft', { p_event_id: eventId, p_input_data: { quantities, active_feather_group: activeGroup }, p_generated_output: output, p_allocations: allocations, p_active_feather_group_id: activeFeatherGroupId })
    if (error) throw error
    revalidatePath(`/app/events/${eventId}/auction`)
    revalidatePath(`/app/events/${eventId}`)
    revalidatePath('/app/auctions')
    url += `?success=${safe(`Draft generated. ${allocations.length} allocation rows created. Review before publishing.`)}`
  } catch (error) {
    url += `?error=${safe(error.message || 'Could not generate auction draft.')}`
  }
  redirect(url)
}

export async function setPuppetCannotBid(formData) {
  const eventId = String(formData.get('event_id') || '')
  const memberId = String(formData.get('guild_member_id') || '')
  const blocked = String(formData.get('blocked') || '') === 'true'
  let url = `/app/events/${eventId}/auction`
  try {
    const { supabase } = await context(eventId)
    const { error } = await supabase.rpc('set_event_puppet_cannot_bid', { p_event_id: eventId, p_member_id: memberId, p_blocked: blocked })
    if (error) throw error
    revalidatePath(`/app/events/${eventId}/auction`)
    url += `?success=${safe(blocked ? 'Member marked Cannot Bid for this event. Draft cleared for recalculation.' : 'Member restored to Puppet eligibility. Draft cleared for recalculation.')}`
  } catch (error) { url += `?error=${safe(error.message || 'Could not update Puppet eligibility.')}` }
  redirect(url)
}

export async function setFeatherExclusion(formData) {
  const eventId = String(formData.get('event_id') || '')
  const memberId = String(formData.get('guild_member_id') || '')
  const excluded = String(formData.get('excluded') || '') === 'true'
  const reason = String(formData.get('reason') || 'NO_GOLD')
  let url = `/app/events/${eventId}/auction`
  try {
    const { supabase } = await context(eventId)
    const { error } = await supabase.rpc('set_event_feather_exclusion', { p_event_id: eventId, p_member_id: memberId, p_excluded: excluded, p_reason: reason })
    if (error) throw error
    revalidatePath(`/app/events/${eventId}/auction`)
    url += `?success=${safe(excluded ? 'Feather bidder marked ineligible. Draft cleared for recalculation.' : 'Feather bidder restored. Draft cleared for recalculation.')}`
  } catch (error) { url += `?error=${safe(error.message || 'Could not update Feather eligibility.')}` }
  redirect(url)
}

export async function setPuppetCycleComplete(formData) {
  const eventId = String(formData.get('event_id') || '')
  const memberId = String(formData.get('guild_member_id') || '')
  const complete = String(formData.get('complete') || '') === 'true'
  let url = `/app/events/${eventId}/auction`
  try {
    const { supabase, event } = await context(eventId)
    const { error } = await supabase.rpc('set_puppet_cycle_member_complete', { p_guild_id: event.guild_id, p_member_id: memberId, p_complete: complete })
    if (error) throw error
    const { error: invalidateError } = await supabase.rpc('invalidate_auction_draft', { p_event_id: eventId })
    if (invalidateError) throw invalidateError
    revalidatePath(`/app/events/${eventId}/auction`)
    url += `?success=${safe(complete ? 'Puppet turn marked DONE for the current cycle.' : 'Puppet turn returned to PENDING.')}`
  } catch (error) { url += `?error=${safe(error.message || 'Could not update Puppet cycle.')}` }
  redirect(url)
}

export async function decidePuppetAppeal(formData) {
  const eventId = String(formData.get('event_id') || '')
  const appealId = String(formData.get('appeal_id') || '')
  const status = String(formData.get('status') || '')
  let url = `/app/events/${eventId}/auction`
  try {
    const { supabase } = await context(eventId)
    const { error } = await supabase.rpc('decide_puppet_appeal', { p_appeal_id: appealId, p_status: status })
    if (error) throw error
    const { error: invalidateError } = await supabase.rpc('invalidate_auction_draft', { p_event_id: eventId })
    if (invalidateError) throw invalidateError
    revalidatePath(`/app/events/${eventId}/auction`)
    url += `?success=${safe(`Puppet appeal ${status}. Draft cleared for recalculation.`)}`
  } catch (error) { url += `?error=${safe(error.message || 'Could not decide Puppet appeal.')}` }
  redirect(url)
}

export async function publishTentativeBidders(formData) {
  const eventId = String(formData.get('event_id') || '')
  let url = `/app/events/${eventId}/auction`
  try {
    const { supabase, event, guild } = await context(eventId)
    const data = await loadAuctionInputs(supabase, event, guild)
    const unavailable = new Set([...data.loas.map((x) => x.guild_member_id), ...data.absences.map((x) => x.guild_member_id)])
    const puppetBlocked = new Set(data.puppetExclusions.map((x) => x.guild_member_id))
    const featherBlocked = new Set(data.featherExclusions.map((x) => x.guild_member_id))
    const penaltyIds = new Set(data.members.filter((member) => isPuppet96hPenalty(member, event.starts_at, guild.timezone || 'Asia/Manila')).map((member) => member.id))
    const group = data.rules.feather_mode === 'four_group' && ['guild_league','emperium_overrun'].includes(event.event_type) ? havocFeatherGroupForInstant(event.event_type, event.starts_at, guild.timezone || 'Asia/Manila') : null
    const feather = data.members.filter((member) => member.status === 'active' && !unavailable.has(member.id) && !featherBlocked.has(member.id) && !penaltyIds.has(member.id) && (!group || member.feather_group === group)).sort((a,b)=>a.ign.localeCompare(b.ign))
    const selection = selectPuppetTurns({ members: data.members, queue: data.queue, unavailableIds: unavailable, cannotBidIds: puppetBlocked, currentCycle: Number(data.puppetState.current_cycle || 1), completedIds: new Set(data.progress.map((row) => row.guild_member_id)), deferred: data.deferred, appeals: data.appeals, requestedCount: event.event_type === 'emperium_overrun' ? 20 : 8, eventStartsAt: event.starts_at, timeZone: guild.timezone || 'Asia/Manila' })
    const map = new Map(data.members.map((member) => [member.id, member.ign]))
    const { data: connection } = await supabase.from('discord_connections').select('metadata').eq('guild_id', event.guild_id).maybeSingle()
    const channelId = connection?.metadata?.channel_id
    if (!channelId) throw new Error('Connect Discord and choose a control channel before publishing possible bidders')
    const puppetNames = selection.assignments.map((row, index) => `${index + 1}. ${map.get(row.guild_member_id) || 'Unknown'}${row.turn_kind === 'rollover' ? ' · NEXT CYCLE' : row.turn_kind === 'deferred' ? ' · MAKE-UP' : row.turn_kind === 'appeal' ? ' · APPEAL' : ''}`)
    const featherNames = feather.map((member, index) => `${index + 1}. ${member.ign}`)
    await sendChannelMessage(channelId, { embeds: [{ title: `${event.name} · Possible Bidders`, description: '**EARLY REMINDER ONLY — NOT THE OFFICIAL BIDDING LIST**\nPuppet bidders can change with final results, LOA/no-show and officer eligibility updates.', fields: [{ name: `Possible Feather Bidders${group ? ` · Group ${group}` : ''}`, value: featherNames.slice(0, 35).join('\n') || 'None currently eligible', inline: true }, { name: `Possible Puppet Bidders · Up to ${event.event_type === 'emperium_overrun' ? 20 : 8}`, value: puppetNames.join('\n') || 'None currently eligible', inline: true }], footer: { text: 'HeadlessGM · tentative reminder' } }], allowed_mentions: { parse: [] } })
    url += `?success=${safe('Possible bidders reminder published to Discord.')}`
  } catch (error) { url += `?error=${safe(error.message || 'Could not publish possible bidders.')}` }
  redirect(url)
}

export async function publishAuction(formData) {
  const eventId = String(formData.get('event_id') || '')
  const runId = String(formData.get('auction_run_id') || '')
  let url = `/app/events/${eventId}/auction`
  try {
    const { supabase, event } = await context(eventId)
    const [{ data: run }, { data: allocations }, { data: members }, { data: connection }] = await Promise.all([
      supabase.from('auction_runs').select('id,status,input_data,generated_output,rules_snapshot').eq('id', runId).eq('event_id', eventId).single(),
      supabase.from('auction_allocations').select('guild_member_id,category,quantity,source,metadata').eq('auction_run_id', runId).order('category'),
      supabase.from('guild_members').select('id,ign').eq('guild_id', event.guild_id),
      supabase.from('discord_connections').select('metadata').eq('guild_id', event.guild_id).maybeSingle(),
    ])
    if (run.status !== 'draft') throw new Error('Only draft auctions can be published')
    const memberMap = new Map((members || []).map((m) => [m.id, m.ign]))
    const lines = (allocations || []).slice(0, 45).map((row) => `• ${row.category.replaceAll('_',' ')} — **${memberMap.get(row.guild_member_id) || 'Unknown'}** × ${row.quantity}${row.source === 'officer_excess' ? ' · OFFICER EXCESS' : row.metadata?.turn_kind === 'rollover' ? ' · NEXT CYCLE' : row.metadata?.turn_kind === 'deferred' ? ' · MAKE-UP' : row.metadata?.turn_kind === 'appeal' ? ' · APPEAL' : ''}`)
    const ffa = run.generated_output?.ffa || {}
    for (const [category, info] of Object.entries(ffa)) if (info?.quantity > 0) lines.push(`• ${category.replaceAll('_',' ')} — FFA · ${info.quantity} available · cap ${info.cap ?? 'unlimited'}`)
    const channelId = connection?.metadata?.channel_id
    if (channelId) await sendChannelMessage(channelId, { embeds: [{ title: `${event.name} · Auction`, description: lines.length ? lines.join('\n') : 'No reward quantities configured.', footer: { text: 'HeadlessGM · Officer-published auction' } }], allowed_mentions: { parse: [] } })
    const { error } = await supabase.rpc('publish_auction_run', { p_run_id: runId })
    if (error) throw error
    revalidatePath(`/app/events/${eventId}/auction`)
    revalidatePath('/app/member')
    url += `?success=${safe(channelId ? 'Auction published to Discord and locked for finalization.' : 'Auction published and locked. No Discord control channel is configured.')}`
  } catch (error) { url += `?error=${safe(error.message || 'Could not publish auction.')}` }
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
    revalidatePath('/app/auctions')
    revalidatePath('/app/member')
    url += `?success=${safe('Auction finalized. Puppet cycle/deferred turns and Feather officer rotation advanced only now.')}`
  } catch (error) { url += `?error=${safe(error.message || 'Could not finalize auction.')}` }
  redirect(url)
}
