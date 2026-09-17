'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'

function safe(value) { return encodeURIComponent(String(value || '').slice(0, 180)) }

export async function saveGuildProfile(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const { data: guild } = await supabase.from('guilds').select('id,owner_user_id,logo_url').eq('id', guildId).eq('owner_user_id', userId).maybeSingle()
  if (!guild) redirect('/app/settings?error=Guild%20owner%20access%20required.')

  const name = String(formData.get('name') || '').trim()
  const slug = String(formData.get('slug') || '').trim().toLowerCase()
  const timezone = String(formData.get('timezone') || '').trim()
  const attendanceMode = String(formData.get('attendance_mode') || 'assume_attending')
  const loaDeadline = String(formData.get('loa_deadline_local_time') || '19:30')

  if (name.length < 2 || name.length > 80) redirect('/app/settings/guild?error=Guild%20name%20must%20be%202-80%20characters.')
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) redirect('/app/settings/guild?error=Workspace%20slug%20must%20use%20lowercase%20letters,%20numbers%20and%20hyphens.')
  if (!['assume_attending','rsvp_required'].includes(attendanceMode)) redirect('/app/settings/guild?error=Invalid%20attendance%20mode.')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(loaDeadline)) redirect('/app/settings/guild?error=Invalid%20LOA%20deadline.')

  const { data: slugConflict } = await supabase.from('guilds').select('id').eq('slug', slug).neq('id', guildId).maybeSingle()
  if (slugConflict) redirect('/app/settings/guild?error=That%20workspace%20URL%20is%20already%20in%20use.')

  let logoUrl = guild.logo_url
  const logo = formData.get('logo')
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 2 * 1024 * 1024 || !['image/png','image/jpeg','image/webp','image/gif'].includes(logo.type)) {
      redirect('/app/settings/guild?error=Logo%20must%20be%20PNG,%20JPG,%20WebP%20or%20GIF%20and%202%20MB%20or%20smaller.')
    }
    const ext = (logo.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const path = `${guildId}/logo-${Date.now()}.${ext}`
    const upload = await supabase.storage.from('guild-assets').upload(path, await logo.arrayBuffer(), { contentType: logo.type, upsert: true })
    if (upload.error) redirect(`/app/settings/guild?error=${safe(upload.error.message || 'Logo upload failed.')}`)
    logoUrl = supabase.storage.from('guild-assets').getPublicUrl(path).data.publicUrl
  }

  const { error } = await supabase.from('guilds').update({
    name,
    slug,
    timezone: timezone || 'Asia/Manila',
    attendance_mode: attendanceMode,
    loa_deadline_local_time: `${loaDeadline}:00`,
    logo_url: logoUrl,
    updated_at: new Date().toISOString(),
  }).eq('id', guildId).eq('owner_user_id', userId)

  if (error) redirect(`/app/settings/guild?error=${safe(error.message || 'Could not save guild profile.')}`)
  revalidatePath('/app')
  revalidatePath('/app/settings')
  revalidatePath('/app/settings/guild')
  redirect('/app/settings/guild?success=Guild%20settings%20saved.')
}
