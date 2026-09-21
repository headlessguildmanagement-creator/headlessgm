export function normalizeIgn(value) {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[ø]/g, 'o')
    .replace(/[đð]/g, 'd')
    .replace(/[ł]/g, 'l')
    .replace(/[þ]/g, 'th')
    .replace(/[æ]/g, 'ae')
    .replace(/[œ]/g, 'oe')
    .replace(/[ß]/g, 'ss')

  return (normalized.match(/[a-z0-9]+/g) || []).join('')
}

export function uniqueIgnMatch(members, submittedIgn) {
  const key = normalizeIgn(submittedIgn)
  if (!key) return { key, member: null, ambiguous: false }

  const matches = (members || []).filter((member) => normalizeIgn(member?.ign) === key)
  if (matches.length === 1) return { key, member: matches[0], ambiguous: false }
  return { key, member: null, ambiguous: matches.length > 1 }
}

export function extractIgnFromProofMessage(value) {
  const match = String(value || '').match(/(?:^|\n)\s*ign\s*:\s*([^\r\n]+)/i)
  return match?.[1]?.trim() || ''
}
