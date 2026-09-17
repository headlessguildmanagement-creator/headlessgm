import { notFound, redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'

export default async function GuildWorkspaceEntry({ params }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  if (authError || !authData?.claims?.sub) redirect(`/login?next=/${encodeURIComponent(slug)}`)

  const { data: guild } = await supabase.from('guilds').select('id,slug').eq('slug', String(slug).toLowerCase()).maybeSingle()
  if (!guild) notFound()

  redirect(`/app?guild=${encodeURIComponent(guild.slug)}`)
}
