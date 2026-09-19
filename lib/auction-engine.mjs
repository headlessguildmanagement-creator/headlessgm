export function shuffleWith(items, random = Math.random) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function allocateCapped(category, total, pool, cap, source = 'base') {
  const quantity = Number(total)
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('Allocation quantity must be a non-negative whole number')
  if (!Array.isArray(pool)) throw new Error('Allocation pool must be an array')

  if (quantity === 0 || pool.length === 0) return { rows: [], unassigned: quantity }
  const max = cap == null ? Number.MAX_SAFE_INTEGER : Number(cap)
  if (!Number.isInteger(max) || max < 0) throw new Error('Allocation cap must be null or a non-negative whole number')

  const uniquePool = []
  const seen = new Set()
  for (const member of pool) {
    if (!member?.id || seen.has(member.id)) continue
    seen.add(member.id)
    uniquePool.push(member)
  }

  const counts = new Map(uniquePool.map((member) => [member.id, 0]))
  let remaining = quantity

  while (remaining > 0) {
    let progressed = false
    for (const member of uniquePool) {
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
    rows: [...counts.entries()]
      .filter(([, assigned]) => assigned > 0)
      .map(([guild_member_id, assigned]) => ({ guild_member_id, category, quantity: assigned, source, metadata: {} })),
    unassigned: remaining,
  }
}

export function eligiblePool(members, unavailableIds = new Set()) {
  return (members || []).filter((member) => member?.id && member.status === 'active' && !unavailableIds.has(member.id))
}


export function allocateFairCombinedFeathers(ldTotal, tsTotal, pool, ldCap = null, tsCap = null) {
  const ld = Number(ldTotal)
  const ts = Number(tsTotal)
  if (!Number.isInteger(ld) || ld < 0 || !Number.isInteger(ts) || ts < 0) throw new Error('Feather quantities must be non-negative whole numbers')
  if (!Array.isArray(pool)) throw new Error('Feather pool must be an array')

  const unique = []
  const seen = new Set()
  for (const member of pool) {
    if (!member?.id || seen.has(member.id)) continue
    seen.add(member.id)
    unique.push(member)
  }

  const maxLd = ldCap == null ? Number.MAX_SAFE_INTEGER : Number(ldCap)
  const maxTs = tsCap == null ? Number.MAX_SAFE_INTEGER : Number(tsCap)
  if (!Number.isInteger(maxLd) || maxLd < 0 || !Number.isInteger(maxTs) || maxTs < 0) throw new Error('Feather caps must be null or non-negative whole numbers')

  if (!unique.length) return { rows: [], unassigned: { light_dark_feather: ld, time_space_feather: ts }, equalCombined: 0, quotas: {} }

  const quotas = Object.fromEntries(unique.map((member) => [member.id, { light_dark_feather: 0, time_space_feather: 0 }]))
  const n = unique.length
  const baseLd = Math.min(Math.floor(ld / n), maxLd)
  const baseTs = Math.min(Math.floor(ts / n), maxTs)
  for (const member of unique) {
    quotas[member.id].light_dark_feather = baseLd
    quotas[member.id].time_space_feather = baseTs
  }

  let remainingLd = ld - baseLd * n
  let remainingTs = ts - baseTs * n

  // Havoc fairness: pool category remainders to complete whole +1 combined
  // rounds for every regular bidder before anything is considered excess.
  while (remainingLd + remainingTs >= n) {
    const trial = structuredClone(quotas)
    let trialLd = remainingLd
    let trialTs = remainingTs
    let complete = true

    for (const member of unique) {
      const quota = trial[member.id]
      if (trialLd > 0 && quota.light_dark_feather < maxLd) {
        quota.light_dark_feather += 1
        trialLd -= 1
      } else if (trialTs > 0 && quota.time_space_feather < maxTs) {
        quota.time_space_feather += 1
        trialTs -= 1
      } else if (trialLd > 0 && quota.light_dark_feather < maxLd) {
        quota.light_dark_feather += 1
        trialLd -= 1
      } else {
        complete = false
        break
      }
    }

    if (!complete) break
    for (const member of unique) quotas[member.id] = trial[member.id]
    remainingLd = trialLd
    remainingTs = trialTs
  }

  const rows = []
  for (const member of unique) {
    const quota = quotas[member.id]
    if (quota.light_dark_feather > 0) rows.push({ guild_member_id: member.id, category: 'light_dark_feather', quantity: quota.light_dark_feather, source: 'base', metadata: { fairness: 'combined_equal_rounds' } })
    if (quota.time_space_feather > 0) rows.push({ guild_member_id: member.id, category: 'time_space_feather', quantity: quota.time_space_feather, source: 'base', metadata: { fairness: 'combined_equal_rounds' } })
  }

  const totals = unique.map((member) => quotas[member.id].light_dark_feather + quotas[member.id].time_space_feather)
  const min = Math.min(...totals)
  const max = Math.max(...totals)
  return {
    rows,
    quotas,
    equalCombined: min === max ? min : null,
    regularRange: [min, max],
    unassigned: { light_dark_feather: remainingLd, time_space_feather: remainingTs },
  }
}
