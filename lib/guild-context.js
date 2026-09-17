export async function resolveGuild(supabase, selector, columns = '*') {
  const value = String(selector || '').trim()
  let query = supabase.from('guilds').select(columns)

  if (value) {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) query = query.eq('id', value)
    else query = query.eq('slug', value.toLowerCase())
    const { data, error } = await query.maybeSingle()
    if (error) throw error
    return data || null
  }

  const { data, error } = await query.order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (error) throw error
  return data || null
}

export function withGuild(href, slug) {
  if (!slug || !href?.startsWith('/app')) return href

  const [path, query = ''] = href.split('?')
  const suffix = path === '/app' ? '' : path.replace(/^\/app\/?/, '')
  const workspacePath = suffix ? `/${slug}/${suffix}` : `/${slug}`
  return query ? `${workspacePath}?${query}` : workspacePath
}
