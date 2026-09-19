'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'

function intOrNull(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

export async function createGuild(formData) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  if (authError || !authData?.claims?.sub) redirect('/login')

  const name = String(formData.get('name') || '').trim()
  const timezone = String(formData.get('timezone') || 'Asia/Manila').trim() || 'Asia/Manila'
  const attendanceMode = String(formData.get('attendance_mode') || 'assume_attending')
  const loaDeadline = String(formData.get('loa_deadline_local_time') || '19:30')
  const featherMode = String(formData.get('feather_mode') || 'ffa')
  const puppetMode = String(formData.get('puppet_mode') || 'ffa')

  if (name.length < 2 || name.length > 80) {
    redirect('/app/onboarding?error=Guild%20name%20must%20be%20between%202%20and%2080%20characters.')
  }

  const { data: existingGuilds } = await supabase.from('guilds').select('id,slug').order('created_at').limit(1)
  if (existingGuilds?.length) redirect(`/${existingGuilds[0].slug}`)

  const { data: guildId, error } = await supabase.rpc('create_guild_workspace', {
    guild_name: name,
    guild_timezone: timezone,
  })
  if (error || !guildId) {
    redirect('/app/onboarding?error=Could%20not%20create%20the%20guild%20workspace.%20Please%20try%20again.')
  }

  const logo = formData.get('logo')
  let logoUrl = null
  if (logo instanceof File && logo.size > 0 && logo.size <= 2 * 1024 * 1024 && ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(logo.type)) {
    const ext = (logo.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const path = `${guildId}/logo-${Date.now()}.${ext}`
    const upload = await supabase.storage.from('guild-assets').upload(path, await logo.arrayBuffer(), { contentType: logo.type, upsert: true })
    if (!upload.error) logoUrl = supabase.storage.from('guild-assets').getPublicUrl(path).data.publicUrl
  }

  await supabase.from('guilds').update({
    timezone,
    attendance_mode: ['assume_attending', 'rsvp_required'].includes(attendanceMode) ? attendanceMode : 'assume_attending',
    loa_deadline_local_time: /^([01]\d|2[0-3]):[0-5]\d$/.test(loaDeadline) ? `${loaDeadline}:00` : '19:30:00',
    ...(logoUrl ? { logo_url: logoUrl } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', guildId)

  await supabase.rpc('update_guild_auction_rules', {
    p_guild_id: guildId,
    p_feather_mode: ['ffa', 'random'].includes(featherMode) ? featherMode : 'ffa',
    p_puppet_mode: ['ffa', 'random'].includes(puppetMode) ? puppetMode : 'ffa',
    p_light_dark_feather_cap: intOrNull(formData.get('light_dark_feather_cap')),
    p_time_space_feather_cap: intOrNull(formData.get('time_space_feather_cap')),
    p_puppet_fragment_cap: intOrNull(formData.get('puppet_fragment_cap')),
    p_illusion_fragment_cap: intOrNull(formData.get('illusion_fragment_cap')),
  })

  const { data: createdGuild } = await supabase.from('guilds').select('slug').eq('id', guildId).single()
  const slug = createdGuild?.slug || guildId
  redirect(`/${slug}/members?success=Guild%20workspace%20created.%20Import%20your%20roster%20or%20add%20members%20manually.`)
}
