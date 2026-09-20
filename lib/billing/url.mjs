const FALLBACK_APP_URL = 'https://headlessgm-nu.vercel.app'

function stripWrappingQuotes(value) {
  const text = String(value || '').trim()
  if (text.length >= 2 && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))) {
    return text.slice(1, -1).trim()
  }
  return text
}

export function normalizeAppUrl(value, fallback = FALLBACK_APP_URL) {
  const raw = stripWrappingQuotes(value) || fallback
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`

  try {
    const url = new URL(candidate)
    if (!url.hostname || !['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid app URL')
    return url.origin
  } catch {
    return fallback
  }
}

export function billingReturnUrl(guildSlug, env = process.env) {
  const base = normalizeAppUrl(
    env.NEXT_PUBLIC_APP_URL ||
    env.NEXT_PUBLIC_SITE_URL ||
    env.VERCEL_PROJECT_PRODUCTION_URL ||
    env.VERCEL_URL ||
    FALLBACK_APP_URL
  )
  const url = new URL(`/${encodeURIComponent(String(guildSlug || ''))}/settings/billing`, base)
  url.searchParams.set('checkout', 'success')
  return url.toString()
}
