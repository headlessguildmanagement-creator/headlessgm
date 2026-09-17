import { headers } from 'next/headers'

export async function workspaceSlugFromRequest() {
  const requestHeaders = await headers()
  return requestHeaders.get('x-headlessgm-workspace-slug') || null
}

export async function getWorkspaceGuild(supabase, columns = '*') {
  const slug = await workspaceSlugFromRequest()
  let query = supabase.from('guilds').select(columns)

  if (slug) {
    const { data } = await query.eq('slug', slug).maybeSingle()
    return data || null
  }

  const { data } = await query.order('created_at', { ascending: true }).limit(1).maybeSingle()
  return data || null
}

export function workspacePath(slug, path = '') {
  if (!slug) return path ? `/app/${path.replace(/^\//, '')}` : '/app'
  const suffix = String(path || '').replace(/^\//, '')
  return suffix ? `/${slug}/${suffix}` : `/${slug}`
}
