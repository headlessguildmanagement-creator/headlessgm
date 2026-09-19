'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import { DEFAULT_OVERVIEW_MODULES } from '../../../../lib/plans.mjs'

function safeHex(value, fallback) {
  const raw = String(value || '').trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(raw) ? raw : fallback
}

export async function saveBrandStudio(formData) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const guildId = String(formData.get('guild_id') || '')
  const { data: guild } = await supabase.from('guilds').select('id,slug,owner_user_id,plan_code,settings').eq('id', guildId).maybeSingle()
  if (!guild || guild.owner_user_id !== userId) redirect('/app/settings?error=Guild%20owner%20access%20required.')
  if (!['commander','beta'].includes(guild.plan_code)) redirect('/app/settings/brand?error=COMMANDER%20plan%20required.')

  const allowedFonts = new Set(['modern','compact','editorial','classic'])
  const allowedRadius = new Set(['6','12','18'])
  const requestedModules = formData.getAll('overview_modules').map(String)
  const modules = DEFAULT_OVERVIEW_MODULES.filter((id) => requestedModules.includes(id))
  const settings = {
    ...(guild.settings || {}),
    brand: {
      primary: safeHex(formData.get('primary'), '#635bff'),
      secondary: safeHex(formData.get('secondary'), '#22d3ee'),
      fontStyle: allowedFonts.has(String(formData.get('font_style'))) ? String(formData.get('font_style')) : 'modern',
      radius: allowedRadius.has(String(formData.get('radius'))) ? String(formData.get('radius')) : '12',
    },
    overview: { modules: modules.length ? modules : DEFAULT_OVERVIEW_MODULES },
  }

  const { error } = await supabase.from('guilds').update({ settings, updated_at: new Date().toISOString() }).eq('id', guild.id)
  if (error) redirect('/app/settings/brand?error=Could%20not%20save%20COMMANDER%20appearance.')
  revalidatePath('/app')
  revalidatePath('/app/settings')
  revalidatePath('/app/settings/brand')
  revalidatePath(`/${guild.slug}`)
  redirect('/app/settings/brand?success=COMMANDER%20appearance%20saved.')
}
