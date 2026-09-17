'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'

function safe(value) { return encodeURIComponent(String(value || '').slice(0, 180)) }

export async function saveGuildProfile(formData) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const guildId = String(formData.get('guild_id') || '')
  const name = String(formData.get('name') || '').trim()
  const timezone = String(formData.get('timezone') || 'Asia/Manila').trim() || 'Asia/Manila'
  const attendanceMode = String(formData.get('attendance_mode') || 'assume_attending')
  const loaDeadline = String(formData.get('loa_deadline_local_time') || '19:30')

  const { data: guild } = await supabase.from('guilds').select('id,owner_user_id,logo_url').eq('id', guildId).maybeSingle()
  if (!guild || guild.owner_user_id !== userId) redirect('/app/settings?error=Guild%20owner%20access%20required.')
  if (name.length < 2 || name.length > 80) redirect('/app/settings/profile?error=Guild%20name%20must%20be%20between%202%20and%2080%20characters.')

  let logoUrl = guild.logo_url
  const logo = formData.get('logo')
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 2 * 1024 * 1024 || !['image/png','image/jpeg','image/webp','image/gif'].includes(logo.type)) {
      redirect('/app/settings/profile?error=Logo%20must%20be%20PNG%2C%20JPG%2C%20WebP%20or%20GIF%20and%20under%202%20MB.')
    }
    const ext = (logo.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const path = `${guild.id}/logo-${Date.now()}.${ext}`
    const upload = await supabase.storage.from('guild-assets').upload(path, await logo.arrayBuffer(), { contentType: logo.type, upsert: true })
    if (upload.error) redirect(`/app/settings/profile?error=${safe(upload.error.message || 'Logo upload failed')}`)
    logoUrl = supabase.storage.from('guild-assets').getPublicUrl(path).data.publicUrl
  }

  const { error } = await supabase.from('guilds').update({
    name,
    timezone,
    logo_url: logoUrl,
    attendance_mode: ['assume_attending','rsvp_required','custom'].includes(attendanceMode) ? attendanceMode : 'assume_attending',
    loa_deadline_local_time: /^([01]\d|2[0-3]):[0-5]\d$/.test(loaDeadline) ? `${loaDeadline}:00` : '19:30:00',
    updated_at: new Date().toISOString(),
  }).eq('id', guild.id)

  if (error) redirect(`/app/settings/profile?error=${safe(error.message || 'Could not save guild profile')}`)
  revalidatePath('/app')
  revalidatePath('/app/settings')
  revalidatePath('/app/settings/profile')
  redirect('/app/settings/profile?success=Guild%20settings%20saved.')
}
