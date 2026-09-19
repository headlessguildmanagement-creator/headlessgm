'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { sendChannelMessage } from '../../../lib/discord/server'

function safe(value) { return encodeURIComponent(String(value || '').slice(0, 240)) }

function zonedLocalToDate(dateValue, timeValue, timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) return null
  const [year, month, day] = dateValue.split('-').map(Number)
  const [hour, minute] = timeValue.split(':').map(Number)
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  let guess = targetUtc
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
    const observedUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
    const delta = targetUtc - observedUtc
    guess += delta
    if (delta === 0) break
  }
  return new Date(guess)
}

async function requireUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (error || !userId) redirect('/login')
  return { supabase, userId }
}

async function requireManagerGuild(supabase, guildId, userId) {
  const { data: guild } = await supabase.from('guilds').select('id, owner_user_id, timezone, loa_deadline_local_time, plan_code').eq('id', guildId).single()
  if (!guild) throw new Error('Guild not found')
  if (guild.owner_user_id === userId) return guild
  const { data: membership } = await supabase.from('guild_users').select('role').eq('guild_id', guildId).eq('user_id', userId).in('role', ['owner', 'officer']).maybeSingle()
  if (!membership) throw new Error('Officer access required')
  return guild
}

async function requireEventInGuild(supabase, eventId, guildId) {
  const { data: event } = await supabase.from('guild_events').select('id,guild_id,status,name,event_type,starts_at').eq('id', eventId).eq('guild_id', guildId).maybeSingle()
  if (!event) throw new Error('Event does not belong to this guild')
  return event
}

export async function createEvent(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const name = String(formData.get('name') || '').trim()
  const eventType = String(formData.get('event_type') || 'guild_league')
  const eventDate = String(formData.get('event_date') || '')
  const eventTime = String(formData.get('event_time') || '20:30')
  const legacyStartsAt = String(formData.get('starts_at') || '')
  const legacyLoaDeadline = String(formData.get('loa_deadline') || '')
  const { supabase, userId } = await requireUser()

  let url = '/app/events'
  try {
    const guild = await requireManagerGuild(supabase, guildId, userId)
    if (!name) throw new Error('Event name is required')
    if (!['guild_league','emperium_overrun','other'].includes(eventType)) throw new Error('Invalid event type')

    let starts
    let deadline
    if (eventDate) {
      const deadlineTime = String(guild.loa_deadline_local_time || '19:30:00').slice(0, 5)
      starts = zonedLocalToDate(eventDate, eventTime, guild.timezone || 'Asia/Manila')
      deadline = zonedLocalToDate(eventDate, deadlineTime, guild.timezone || 'Asia/Manila')
    } else {
      starts = new Date(legacyStartsAt)
      deadline = new Date(legacyLoaDeadline)
    }

    if (!starts || !deadline || Number.isNaN(starts.getTime()) || Number.isNaN(deadline.getTime())) throw new Error('Invalid event date or time')
    if (deadline >= starts) throw new Error('LOA deadline must be before the event start time')

    const { data, error } = await supabase.from('guild_events').insert({
      guild_id: guildId,
      name,
      event_type: eventType,
      starts_at: starts.toISOString(),
      loa_deadline: deadline.toISOString(),
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
    await requireEventInGuild(supabase, eventId, guildId)
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

export async function setEventAbsence(formData) {
  const eventId = String(formData.get('event_id') || '')
  const guildId = String(formData.get('guild_id') || '')
  const memberId = String(formData.get('guild_member_id') || '')
  const absent = String(formData.get('absent') || '') === 'true'
  const reason = String(formData.get('reason') || 'No-show').trim() || 'No-show'
  const { supabase, userId } = await requireUser()
  let url = `/app/events/${eventId}`
  try {
    await requireManagerGuild(supabase, guildId, userId)
    await requireEventInGuild(supabase, eventId, guildId)
    const { data: member } = await supabase.from('guild_members').select('id').eq('id', memberId).eq('guild_id', guildId).eq('status', 'active').maybeSingle()
    if (!member) throw new Error('Member does not belong to this guild')

    if (absent) {
      const { error } = await supabase.from('event_absences').upsert({ event_id: eventId, guild_member_id: memberId, reason, created_by_user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'event_id,guild_member_id' })
      if (error) throw error
      await supabase.from('event_lineup_slots').update({ guild_member_id: null, updated_at: new Date().toISOString() }).eq('event_id', eventId).eq('guild_member_id', memberId)
    } else {
      const { error } = await supabase.from('event_absences').delete().eq('event_id', eventId).eq('guild_member_id', memberId)
      if (error) throw error
    }

    revalidatePath(`/app/events/${eventId}`)
    url += `?success=${safe(absent ? 'Member marked as absent/no-show.' : 'Absence removed.')}`
  } catch (error) {
    url += `?error=${safe(error.message || 'Could not update attendance.')}`
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
    await requireEventInGuild(supabase, eventId, guildId)
    if (!['main','sub'].includes(raidCode) || !Number.isInteger(partyNo) || partyNo < 1 || partyNo > 8 || !Number.isInteger(slotNo) || slotNo < 1 || slotNo > 5) throw new Error('Invalid raid slot')
    if (memberId) {
      const { data: member } = await supabase.from('guild_members').select('id').eq('id', memberId).eq('guild_id', guildId).eq('status', 'active').maybeSingle()
      if (!member) throw new Error('Member does not belong to this guild')
      const [{ data: loa }, { data: absence }] = await Promise.all([
        supabase.from('event_loas').select('id').eq('event_id', eventId).eq('guild_member_id', memberId).is('cancelled_at', null).maybeSingle(),
        supabase.from('event_absences').select('id').eq('event_id', eventId).eq('guild_member_id', memberId).maybeSingle(),
      ])
      if (loa) throw new Error('That member is on LOA for this event')
      if (absence) throw new Error('That member is marked absent/no-show for this event')
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


export async function importPreviousLineup(formData) {
  const eventId = String(formData.get('event_id') || '')
  const guildId = String(formData.get('guild_id') || '')
  const { supabase, userId } = await requireUser()
  let url = `/app/events/${eventId}`
  try {
    await requireManagerGuild(supabase, guildId, userId)
    const current = await requireEventInGuild(supabase, eventId, guildId)
    const { data: previous } = await supabase.from('guild_events').select('id,name,starts_at').eq('guild_id', guildId).lt('starts_at', current.starts_at).not('status', 'eq', 'cancelled').order('starts_at', { ascending: false }).limit(1).maybeSingle()
    if (!previous) throw new Error('No previous guild event is available to import')

    const [{ data: previousSlots }, { data: activeMembers }, { data: loas }, { data: absences }] = await Promise.all([
      supabase.from('event_lineup_slots').select('raid_code,party_no,slot_no,guild_member_id').eq('event_id', previous.id).not('guild_member_id', 'is', null),
      supabase.from('guild_members').select('id').eq('guild_id', guildId).eq('status', 'active'),
      supabase.from('event_loas').select('guild_member_id').eq('event_id', eventId).is('cancelled_at', null),
      supabase.from('event_absences').select('guild_member_id').eq('event_id', eventId),
    ])

    const active = new Set((activeMembers || []).map((row) => row.id))
    const unavailable = new Set([...(loas || []).map((row) => row.guild_member_id), ...(absences || []).map((row) => row.guild_member_id)])
    const seen = new Set()
    const rows = (previousSlots || []).filter((slot) => active.has(slot.guild_member_id) && !unavailable.has(slot.guild_member_id) && !seen.has(slot.guild_member_id)).map((slot) => {
      seen.add(slot.guild_member_id)
      return { event_id: eventId, raid_code: slot.raid_code, party_no: slot.party_no, slot_no: slot.slot_no, guild_member_id: slot.guild_member_id, assigned_by_user_id: userId, updated_at: new Date().toISOString() }
    })

    const { error: clearError } = await supabase.from('event_lineup_slots').delete().eq('event_id', eventId)
    if (clearError) throw clearError
    if (rows.length) {
      const { error: insertError } = await supabase.from('event_lineup_slots').insert(rows)
      if (insertError) throw insertError
    }

    revalidatePath(`/app/events/${eventId}`)
    url += `?success=${safe(`Imported ${rows.length} eligible assignments from ${previous.name}. LOA, no-show and inactive members were skipped.`)}`
  } catch (error) {
    url += `?error=${safe(error.message || 'Could not import the previous lineup.')}`
  }
  redirect(url)
}

export async function publishLineup(formData) {
  const eventId = String(formData.get('event_id') || '')
  const guildId = String(formData.get('guild_id') || '')
  const { supabase, userId } = await requireUser()
  let url = `/app/events/${eventId}`
  try {
    const guild = await requireManagerGuild(supabase, guildId, userId)
    const event = await requireEventInGuild(supabase, eventId, guildId)
    if (guild.plan_code === 'free') throw new Error('Discord lineup publishing requires the GUILD plan')
    const [{ data: slots }, { data: members }, { data: connection }] = await Promise.all([
      supabase.from('event_lineup_slots').select('raid_code,party_no,slot_no,guild_member_id').eq('event_id', eventId).order('raid_code').order('party_no').order('slot_no'),
      supabase.from('guild_members').select('id,ign').eq('guild_id', guildId),
      supabase.from('discord_connections').select('metadata,bot_installed').eq('guild_id', guildId).maybeSingle(),
    ])
    const channelId = connection?.metadata?.channel_id
    if (!connection?.bot_installed || !channelId) throw new Error('Connect Discord and choose a HeadlessGM control channel before publishing')

    const memberMap = new Map((members || []).map((member) => [member.id, member]))
    const fields = []
    for (const raid of ['main', 'sub']) {
      for (let party = 1; party <= 8; party += 1) {
        const partySlots = (slots || []).filter((slot) => slot.raid_code === raid && slot.party_no === party)
        const names = Array.from({ length: 5 }, (_, index) => {
          const slot = partySlots.find((row) => row.slot_no === index + 1)
          const member = slot?.guild_member_id ? memberMap.get(slot.guild_member_id) : null
          return member ? `${index + 1}. ${member.ign}` : `${index + 1}. —`
        })
        fields.push({ name: `${raid === 'main' ? 'MAIN' : 'SUB'} · Party ${party}`, value: names.join('\n'), inline: true })
      }
    }

    await sendChannelMessage(channelId, {
      embeds: [{ title: `${event.name} · Final Lineup`, description: `Officer-published lineup · ${new Date(event.starts_at).toLocaleString('en-US', { timeZone: guild.timezone || 'Asia/Manila' })}`, fields, footer: { text: 'HeadlessGM · lineup publication' } }],
      allowed_mentions: { parse: [] },
    })

    revalidatePath(`/app/events/${eventId}`)
    url += `?success=${safe('Lineup published to the configured Discord channel.')}`
  } catch (error) {
    url += `?error=${safe(error.message || 'Could not publish lineup.')}`
  }
  redirect(url)
}


export async function clearLineup(formData) {
  const eventId = String(formData.get('event_id') || '')
  const guildId = String(formData.get('guild_id') || '')
  const { supabase, userId } = await requireUser()
  let url = `/app/events/${eventId}`
  try {
    await requireManagerGuild(supabase, guildId, userId)
    await requireEventInGuild(supabase, eventId, guildId)
    const { error } = await supabase.from('event_lineup_slots').delete().eq('event_id', eventId)
    if (error) throw error
    revalidatePath(`/app/events/${eventId}`)
    url += `?success=${safe('Lineup cleared. Attendance and roster history were not changed.')}`
  } catch (error) {
    url += `?error=${safe(error.message || 'Could not clear the lineup.')}`
  }
  redirect(url)
}
