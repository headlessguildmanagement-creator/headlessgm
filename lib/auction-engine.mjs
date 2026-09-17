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
