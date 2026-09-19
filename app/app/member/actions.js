'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../lib/supabase/server'

function safe(value) { return encodeURIComponent(String(value || '').slice(0, 240)) }

async function requireUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) redirect('/login')
  return supabase
}

export async function fileMemberLoa(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const eventId = String(formData.get('event_id') || '')
  const reason = String(formData.get('reason') || '').trim() || null
  const supabase = await requireUser()
  const { data: guildPlan } = await supabase.from('guilds').select('plan_code').eq('id', guildId).maybeSingle()
  if (guildPlan?.plan_code === 'free') redirect(`/app/member?guild=${encodeURIComponent(guildId)}&error=Member%20self-service%20requires%20the%20GUILD%20plan.`)
  let destination = `/app/member?guild=${encodeURIComponent(guildId)}`
  try {
    const { error } = await supabase.rpc('file_event_loa', { p_event_id: eventId, p_reason: reason })
    if (error) throw error
    revalidatePath('/app/member')
    destination += `&success=${safe('LOA filed. You are now unavailable for that event.')}`
  } catch (error) { destination += `&error=${safe(error.message || 'Could not file LOA.')}` }
  redirect(destination)
}

export async function cancelMemberLoa(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const eventId = String(formData.get('event_id') || '')
  const supabase = await requireUser()
  const { data: guildPlan } = await supabase.from('guilds').select('plan_code').eq('id', guildId).maybeSingle()
  if (guildPlan?.plan_code === 'free') redirect(`/app/member?guild=${encodeURIComponent(guildId)}&error=Member%20self-service%20requires%20the%20GUILD%20plan.`)
  let destination = `/app/member?guild=${encodeURIComponent(guildId)}`
  try {
    const { error } = await supabase.rpc('cancel_event_loa', { p_event_id: eventId })
    if (error) throw error
    revalidatePath('/app/member')
    destination += `&success=${safe('LOA cancelled. You are expected to attend again.')}`
  } catch (error) { destination += `&error=${safe(error.message || 'Could not cancel LOA.')}` }
  redirect(destination)
}

export async function submitPuppetAppeal(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const eventId = String(formData.get('event_id') || '')
  const reason = String(formData.get('reason') || '').trim()
  const supabase = await requireUser()
  const { data: guildPlan } = await supabase.from('guilds').select('plan_code').eq('id', guildId).maybeSingle()
  if (guildPlan?.plan_code === 'free') redirect(`/app/member?guild=${encodeURIComponent(guildId)}&error=Member%20self-service%20requires%20the%20GUILD%20plan.`)
  let destination = `/app/member?guild=${encodeURIComponent(guildId)}`
  try {
    const { error } = await supabase.rpc('submit_puppet_appeal', { p_guild_id: guildId, p_source_event_id: eventId, p_reason: reason })
    if (error) throw error
    revalidatePath('/app/member')
    destination += `&success=${safe('Puppet appeal submitted for officer review.')}`
  } catch (error) { destination += `&error=${safe(error.message || 'Could not submit Puppet appeal.')}` }
  redirect(destination)
}
