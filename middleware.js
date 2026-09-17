import { NextResponse } from 'next/server'

const RESERVED = new Set(['api','app','auth','login','_next','favicon.ico'])
const WORKSPACE_ROOTS = new Set(['members','events','auctions','recruitment','history','settings'])

export function middleware(request) {
  const { pathname } = request.nextUrl
  const parts = pathname.split('/').filter(Boolean)
  if (!parts.length) return NextResponse.next()

  const slug = parts[0]
  if (RESERVED.has(slug)) return NextResponse.next()
  if (parts[1] === 'apply') return NextResponse.next()
  if (parts.length > 1 && !WORKSPACE_ROOTS.has(parts[1])) return NextResponse.next()

  const target = request.nextUrl.clone()
  target.pathname = parts.length === 1 ? '/app' : `/app/${parts.slice(1).join('/')}`
  target.searchParams.set('guild', slug)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-headlessgm-workspace-slug', slug)

  return NextResponse.rewrite(target, { request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
