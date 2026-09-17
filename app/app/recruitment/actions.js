'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../lib/supabase/server'

function safe(value) {
  return encodeURIComponent(String(value || '').slice(0, 240))
}

async function requireUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (error || !userId) redirect('/login')
  return { supabase, userId }
}

export async function sendOfficerApplicationMessage(formData) {
  const applicationId = String(formData.get('application_id') || '')
  const message = String(formData.get('message') || '').trim()
  const { supabase, userId } = await requireUser()
  let destination = `/app/recruitment?application=${encodeURIComponent(applicationId)}`

  try {
    if (!message) throw new Error('Enter a message')
    const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', userId).maybeSingle()
    const { error } = await supabase.from('application_messages').insert({
      application_id: applicationId,
      sender_type: 'officer',
      sender_user_id: userId,
      sender_name: profile?.display_name || 'Officer',
      message: message.slice(0, 3000),
    })
    if (error) throw error
    revalidatePath('/app/recruitment')
    destination += `&success=${safe('Message sent.')}`
  } catch (error) {
    destination += `&error=${safe(error.message || 'Could not send message.')}`
  }

  redirect(destination)
}

export async function setApplicationStatus(formData) {
  const applicationId = String(formData.get('application_id') || '')
  const status = String(formData.get('status') || '')
  const note = String(formData.get('note') || '').trim() || null
  const { supabase } = await requireUser()
  let destination = `/app/recruitment?application=${encodeURIComponent(applicationId)}`

  try {
    const { error } = await supabase.rpc('set_application_status', {
      p_application_id: applicationId,
      p_status: status,
      p_note: note,
    })
    if (error) throw error
    revalidatePath('/app/recruitment')
    destination += `&success=${safe(status === 'approved' ? 'Application approved.' : status === 'rejected' ? 'Application rejected.' : 'Application moved to pending review.')}`
  } catch (error) {
    destination += `&error=${safe(error.message || 'Could not update application.')}`
  }

  redirect(destination)
}

export async function confirmApplicantJoined(formData) {
  const applicationId = String(formData.get('application_id') || '')
  const ign = String(formData.get('ign') || '').trim()
  const jobCode = String(formData.get('job_code') || '').trim() || null
  const guildRole = String(formData.get('guild_role') || '').trim() || null
  const { supabase } = await requireUser()
  let destination = `/app/recruitment?application=${encodeURIComponent(applicationId)}`

  try {
    const { error } = await supabase.rpc('confirm_application_joined', {
      p_application_id: applicationId,
      p_ign: ign,
      p_job_code: jobCode,
      p_guild_role: guildRole,
    })
    if (error) throw error
    revalidatePath('/app/recruitment')
    revalidatePath('/app/members')
    destination += `&success=${safe('Applicant converted to an active roster member. Discord identity carried over automatically.')}`
  } catch (error) {
    destination += `&error=${safe(error.message || 'Could not confirm joined.')}`
  }

  redirect(destination)
}
