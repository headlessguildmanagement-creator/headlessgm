import { NextResponse } from 'next/server'
import { updateSession } from './lib/supabase/proxy'

const RESERVED = new Set(['api','app','auth','login','_next','favicon.ico'])
const WORKSPACE_ROOTS = new Set(['overview','members','events','auctions','recruitment','history','settings'])

export async function proxy(request) {
  const sessionResponse = await updateSession(request)
  const { pathname } = request.nextUrl
  const parts = pathname.split('/').filter(Boolean)
  if (!parts.length) return sessionResponse

  const slug = parts[0]
  if (RESERVED.has(slug)) return sessionResponse
  if (parts.length === 1) return sessionResponse
  if (parts[1] === 'apply') return sessionResponse
  if (!WORKSPACE_ROOTS.has(parts[1])) return sessionResponse

  const target = request.nextUrl.clone()
  target.pathname = parts[1] === 'overview' ? '/app' : `/app/${parts.slice(1).join('/')}`
  target.searchParams.set('guild', slug)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-headlessgm-workspace-slug', slug)
  if (request.cookies?.toString) requestHeaders.set('cookie', request.cookies.toString())

  const response = NextResponse.rewrite(target, { request: { headers: requestHeaders } })
  for (const cookie of sessionResponse.cookies.getAll()) {
    response.cookies.set(cookie.name, cookie.value, cookie)
  }
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
