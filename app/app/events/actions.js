'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'

function safe(value) {
  return encodeURIComponent(String(value || '').slice(0, 240))
}

async function requireUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (error || !userId) redirect('/login')
  return { supabase, userId }
}

async function requireManagerGuild(supabase, guildId, userId) {
  const { data: guild } = await supabase.from('guilds').select('id, owner_user_id').eq('id', guildId).single()
  if (!guild) throw new Error('Guild not found')
  if (guild.owner_user_id === userId) return guild
  const { data: membership } = await supabase.from('guild_users').select('role').eq('guild_id', guildId).eq('user_id', userId).in('role', ['owner', 'officer']).maybeSingle()
  if (!membership) throw new Error('Officer access required')
  return guild
}

export async function createEvent(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const name = String(formData.get('name') || '').trim()
  const startsAt = String(formData.get('starts_at') || '')
  const loaDeadline = String(formData.get('loa_deadline') || '')
  const eventType = String(formData.get('event_type') || 'guild_league')
  const { supabase, userId } = await requireUser()

  let url = '/app/events'
  try {
    await requireManagerGuild(supabase, guildId, userId)
    if (!name || !startsAt || !loaDeadline) throw new Error('Event name, start time, and LOA deadline are required')
    const { data, error } = await supabase.from('guild_events').insert({
      guild_id: guildId,
      name,
      event_type: eventType,
      starts_at: new Date(startsAt).toISOString(),
      loa_deadline: new Date(loaDeadline).toISOString(),
      status: 'loa_open',
      created_by_user_id: userId,
    }).select('id').single()
    if (error) throw error
    revalidatePath('/app')
    revalidatePath('/app/events')
    url = `/app/events/${data.id}?success=${safe('Event created.')}`
  } catch (error) {
    url = `/app/events?error=${safe(error.message || 'Could not create event.')}`
  }
  redirect(url)
}

export async function updateEventStatus(formData) {
  const eventId = String(formData.get('event_id') || '')
  const guildId = String(formData.get('guild_id') || '')
  const status = String(formData.get('status') || '')
  const allowed = new Set(['upcoming','loa_open','lineup','live','auction','completed','cancelled'])
  const { supabase, userId } = await requireUser()
  let url = `/app/events/${eventId}`
  try {
    await requireManagerGuild(supabase, guildId, userId)
    if (!allowed.has(status)) throw new Error('Invalid event status')
    const { error } = await supabase.from('guild_events').update({ status, updated_at: new Date().toISOString() }).eq('id', eventId).eq('guild_id', guildId)
    if (error) throw error
    revalidatePath('/app/events')
    revalidatePath(`/app/events/${eventId}`)
    url += `?success=${safe('Event status updated.')}`
  } catch (error) {
    url += `?error=${safe(error.message || 'Could not update event.')}`
  }
  redirect(url)
}

export async function fileMyLoa(formData) {
  const eventId = String(formData.get('event_id') || '')
  const reason = String(formData.get('reason') || '').trim()
  const { supabase } = await requireUser()
  let url = `/app/events/${eventId}`
  try {
    const { error } = await supabase.rpc('file_event_loa', { p_event_id: eventId, p_reason: reason || null })
    if (error) throw error
    revalidatePath(`/app/events/${eventId}`)
    url += `?success=${safe('LOA filed. You are now unavailable for this event.')}`
  } catch (error) {
    url += `?error=${safe(error.message || 'Could not file LOA.')}`
  }
  redirect(url)
}

export async function cancelMyLoa(formData) {
  const eventId = String(formData.get('event_id') || '')
  const { supabase } = await requireUser()
  let url = `/app/events/${eventId}`
  try {
    const { error } = await supabase.rpc('cancel_event_loa', { p_event_id: eventId })
    if (error) throw error
    revalidatePath(`/app/events/${eventId}`)
    url += `?success=${safe('LOA cancelled. You are expected to attend again.')}`
  } catch (error) {
    url += `?error=${safe(error.message || 'Could not cancel LOA.')}`
  }
  redirect(url)
}

export async function assignLineupMember(formData) {
  const eventId = String(formData.get('event_id') || '')
  const guildId = String(formData.get('guild_id') || '')
  const raidCode = String(formData.get('raid_code') || '')
  const partyNo = Number(formData.get('party_no'))
  const slotNo = Number(formData.get('slot_no'))
  const memberId = String(formData.get('guild_member_id') || '') || null
  const { supabase, userId } = await requireUser()
  let url = `/app/events/${eventId}`
  try {
    await requireManagerGuild(supabase, guildId, userId)
    if (!['main','sub'].includes(raidCode)) throw new Error('Invalid raid')
    if (memberId) {
      const { data: loa } = await supabase.from('event_loas').select('id').eq('event_id', eventId).eq('guild_member_id', memberId).is('cancelled_at', null).maybeSingle()
      if (loa) throw new Error('That member is on LOA for this event')
      await supabase.from('event_lineup_slots').update({ guild_member_id: null, updated_at: new Date().toISOString() }).eq('event_id', eventId).eq('guild_member_id', memberId)
    }
    const { error } = await supabase.from('event_lineup_slots').upsert({
      event_id: eventId,
      raid_code: raidCode,
      party_no: partyNo,
      slot_no: slotNo,
      guild_member_id: memberId,
      assigned_by_user_id: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id,raid_code,party_no,slot_no' })
    if (error) throw error
    revalidatePath(`/app/events/${eventId}`)
    url += `?success=${safe('Lineup updated.')}`
  } catch (error) {
    url += `?error=${safe(error.message || 'Could not update lineup.')}`
  }
  redirect(url)
}
