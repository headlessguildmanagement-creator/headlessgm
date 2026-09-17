'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'

function safe(value) {
  return encodeURIComponent(String(value || '').slice(0, 220))
}

function parseCap(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error('Caps must be whole numbers 0 or greater')
  return parsed
}

export async function saveAuctionRules(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const featherMode = String(formData.get('feather_mode') || '')
  const puppetMode = String(formData.get('puppet_mode') || '')
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  if (authError || !authData?.claims?.sub) redirect('/login')

  let destination = '/app/settings/auction'
  try {
    const { error } = await supabase.rpc('update_guild_auction_rules', {
      p_guild_id: guildId,
      p_feather_mode: featherMode,
      p_puppet_mode: puppetMode,
      p_light_dark_feather_cap: parseCap(formData.get('light_dark_feather_cap')),
      p_time_space_feather_cap: parseCap(formData.get('time_space_feather_cap')),
      p_puppet_fragment_cap: parseCap(formData.get('puppet_fragment_cap')),
      p_illusion_fragment_cap: parseCap(formData.get('illusion_fragment_cap')),
    })
    if (error) throw error
    revalidatePath('/app')
    revalidatePath('/app/settings/auction')
    destination += `?success=${safe('Auction rules saved. Future auctions will snapshot these settings.')}`
  } catch (error) {
    destination += `?error=${safe(error?.message || 'Could not save auction rules.')}`
  }

  redirect(destination)
}
