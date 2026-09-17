'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../lib/supabase/server'

function safe(value) {
  return encodeURIComponent(String(value || '').slice(0, 240))
}

export async function submitApplication(formData) {
  const slug = String(formData.get('slug') || '').trim().toLowerCase()
  const ign = String(formData.get('ign') || '').trim()
  const jobCode = String(formData.get('job_code') || '').trim() || null
  const email = String(formData.get('email') || '').trim() || null
  const previousGuild = String(formData.get('previous_guild') || '').trim() || null
  const whyJoin = String(formData.get('why_join') || '').trim()
  const availability = String(formData.get('availability') || '').trim()
  const notes = String(formData.get('notes') || '').trim()
  const supabase = await createClient()

  let destination = `/${encodeURIComponent(slug)}/apply`
  try {
    const { data, error } = await supabase.rpc('submit_guild_application', {
      p_guild_slug: slug,
      p_ign: ign,
      p_job_code: jobCode,
      p_email: email,
      p_previous_guild: previousGuild,
      p_answers: { why_join: whyJoin, availability, notes },
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row?.token) throw new Error('Application created, but the private portal token was not returned')
    destination = `/${encodeURIComponent(slug)}/apply?token=${encodeURIComponent(row.token)}&success=${safe('Application submitted. Connect Discord to keep your identity attached through onboarding.')}`
  } catch (error) {
    destination = `/${encodeURIComponent(slug)}/apply?error=${safe(error.message || 'Could not submit application.')}`
  }

  redirect(destination)
}

export async function linkApplicationDiscord(formData) {
  const slug = String(formData.get('slug') || '').trim().toLowerCase()
  const token = String(formData.get('token') || '').trim()
  const supabase = await createClient()

  let destination = `/${encodeURIComponent(slug)}/apply?token=${encodeURIComponent(token)}`
  try {
    const { data: authData, error: authError } = await supabase.auth.getClaims()
    if (authError || !authData?.claims?.sub) {
      destination = `/login?next=${encodeURIComponent(`/${slug}/apply?token=${token}`)}`
    } else {
      const { error } = await supabase.rpc('link_application_discord', {
        p_guild_slug: slug,
        p_token: token,
      })
      if (error) throw error
      revalidatePath(`/${slug}/apply`)
      destination += `&success=${safe('Discord connected to your application.')}`
    }
  } catch (error) {
    destination += `&error=${safe(error.message || 'Could not connect Discord.')}`
  }

  redirect(destination)
}

export async function postApplicantMessage(formData) {
  const slug = String(formData.get('slug') || '').trim().toLowerCase()
  const token = String(formData.get('token') || '').trim()
  const message = String(formData.get('message') || '').trim()
  const supabase = await createClient()

  let destination = `/${encodeURIComponent(slug)}/apply?token=${encodeURIComponent(token)}`
  try {
    const { error } = await supabase.rpc('post_application_message', {
      p_guild_slug: slug,
      p_token: token,
      p_message: message,
    })
    if (error) throw error
    revalidatePath(`/${slug}/apply`)
    destination += `&success=${safe('Message sent.')}`
  } catch (error) {
    destination += `&error=${safe(error.message || 'Could not send message.')}`
  }

  redirect(destination)
}
