function zonedParts(value, timeZone = 'Asia/Manila') {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) }
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function isPuppet96hPenalty(member, eventStartsAt, timeZone = 'Asia/Manila') {
  if (!member?.created_at || !eventStartsAt) return false
  const joined = zonedParts(member.created_at, timeZone)
  const event = zonedParts(eventStartsAt, timeZone)
  if (!joined || !event) return false
  const beforeCall = joined.hour < 20 || (joined.hour === 20 && joined.minute < 30)
  const eligibleOn = addDays(joined.date, beforeCall ? 4 : 5)
  return event.date < eligibleOn
}

export function selectPuppetTurns({
  members = [], queue = [], unavailableIds = new Set(), cannotBidIds = new Set(), currentCycle = 1,
  completedIds = new Set(), deferred = [], appeals = [], requestedCount = 0, eventStartsAt, timeZone = 'Asia/Manila',
} = {}) {
  const count = Math.max(0, Math.floor(Number(requestedCount) || 0))
  if (!count) return { assignments: [], cycleCanFinish: false, counts: { deferred: 0, appeal: 0, normal: 0, rollover: 0 }, penaltyIds: new Set() }

  const memberMap = new Map(members.filter((member) => member?.id && member.status === 'active').map((member) => [member.id, member]))
  const rotation = queue
    .filter((row) => row?.is_active !== false && memberMap.has(row.guild_member_id))
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((row) => memberMap.get(row.guild_member_id))

  const penaltyIds = new Set(rotation.filter((member) => isPuppet96hPenalty(member, eventStartsAt, timeZone)).map((member) => member.id))
  const unavailable = (member) => unavailableIds.has(member.id) || cannotBidIds.has(member.id) || penaltyIds.has(member.id)
  const available = rotation.filter((member) => !unavailable(member))
  const assignments = []
  const selectedIds = new Set()

  const take = (member, meta) => {
    if (!member || selectedIds.has(member.id) || assignments.length >= count) return false
    selectedIds.add(member.id)
    assignments.push({ guild_member_id: member.id, quantity: 1, ...meta })
    return true
  }

  for (const row of [...deferred].filter((row) => !row.consumed_at).sort((a, b) => Number(a.source_cycle) - Number(b.source_cycle) || String(a.created_at || '').localeCompare(String(b.created_at || '')))) {
    const member = memberMap.get(row.guild_member_id)
    if (member && !unavailable(member)) take(member, { turn_kind: 'deferred', source_cycle: Number(row.source_cycle), deferred_id: row.id })
  }

  for (const row of [...appeals].filter((row) => row.status === 'approved' && !row.consumed_at).sort((a, b) => Number(a.source_cycle) - Number(b.source_cycle) || String(a.decided_at || a.submitted_at || '').localeCompare(String(b.decided_at || b.submitted_at || '')))) {
    const member = memberMap.get(row.guild_member_id)
    if (member && !unavailable(member)) take(member, { turn_kind: 'appeal', source_cycle: Number(row.source_cycle), appeal_id: row.id })
  }

  for (const member of available.filter((member) => !completedIds.has(member.id))) {
    take(member, { turn_kind: 'normal', source_cycle: Number(currentCycle), cycle_offset: 0 })
  }

  const normalSelectedIds = new Set(assignments.filter((row) => row.turn_kind === 'normal' && row.source_cycle === Number(currentCycle)).map((row) => row.guild_member_id))
  const pending = rotation.filter((member) => !completedIds.has(member.id))
  const cycleCanFinish = pending.every((member) => normalSelectedIds.has(member.id) || unavailable(member))

  if (cycleCanFinish && assignments.length < count) {
    for (const member of available.filter((member) => completedIds.has(member.id))) {
      take(member, { turn_kind: 'rollover', source_cycle: Number(currentCycle) + 1, cycle_offset: 1 })
    }
  }

  const counts = { deferred: 0, appeal: 0, normal: 0, rollover: 0 }
  for (const row of assignments) counts[row.turn_kind] += 1
  return { assignments, cycleCanFinish, counts, penaltyIds }
}

export function allocateOfficerExcess({ category, quantity, officers = [], startIndex = 0, cap = null, existing = new Map() } = {}) {
  let remaining = Math.max(0, Math.floor(Number(quantity) || 0))
  const max = cap == null ? Number.MAX_SAFE_INTEGER : Number(cap)
  if (!Number.isInteger(max) || max < 0) throw new Error('Officer cap must be null or a non-negative whole number')
  if (!officers.length || !remaining) return { rows: [], unassigned: remaining, nextIndex: officers.length ? ((startIndex % officers.length) + officers.length) % officers.length : 0 }

  let pointer = ((Number(startIndex) || 0) % officers.length + officers.length) % officers.length
  const counts = new Map()
  let consecutiveMisses = 0
  while (remaining > 0 && consecutiveMisses < officers.length) {
    const member = officers[pointer]
    const already = Number(existing.get(member.id) || 0) + Number(counts.get(member.id) || 0)
    if (already < max) {
      counts.set(member.id, Number(counts.get(member.id) || 0) + 1)
      remaining -= 1
      consecutiveMisses = 0
    } else {
      consecutiveMisses += 1
    }
    pointer = (pointer + 1) % officers.length
  }

  return {
    rows: [...counts.entries()].map(([guild_member_id, assigned]) => ({ guild_member_id, category, quantity: assigned, source: 'officer_excess', metadata: { officer_excess: true } })),
    unassigned: remaining,
    nextIndex: pointer,
  }
}
