'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'

export async function createGuild(formData) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()

  if (authError || !authData?.claims?.sub) {
    redirect('/login')
  }

  const name = String(formData.get('name') || '').trim()

  if (name.length < 2 || name.length > 80) {
    redirect('/app/onboarding?error=Guild%20name%20must%20be%20between%202%20and%2080%20characters.')
  }

  const { data: existingGuilds } = await supabase
    .from('guilds')
    .select('id')
    .limit(1)

  if (existingGuilds?.length) {
    redirect('/app')
  }

  const { error } = await supabase.rpc('create_guild_workspace', {
    guild_name: name,
    guild_timezone: 'Asia/Manila',
  })

  if (error) {
    redirect('/app/onboarding?error=Could%20not%20create%20the%20guild%20workspace.%20Please%20try%20again.')
  }

  redirect('/app/members')
}
