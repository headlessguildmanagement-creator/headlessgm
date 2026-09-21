export function normalizeIgn(value) {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()

  return (normalized.match(/[a-z0-9]+/g) || []).join('')
}

export function uniqueIgnMatch(members, submittedIgn) {
  const key = normalizeIgn(submittedIgn)
  if (!key) return { key, member: null, ambiguous: false }

  const matches = (members || []).filter((member) => normalizeIgn(member?.ign) === key)
  if (matches.length === 1) return { key, member: matches[0], ambiguous: false }
  return { key, member: null, ambiguous: matches.length > 1 }
}
