import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { resolveGuild } from '../../../lib/guild-context'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const selector = request.nextUrl.searchParams.get('guild') || ''
  const guild = await resolveGuild(supabase, selector, 'id,name,slug,owner_user_id,plan_code,game_preset_id,timezone,attendance_mode,loa_deadline_local_time,created_at,updated_at')
  if (!guild) return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
  const access = guild.owner_user_id === userId || Boolean((await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).in('role', ['owner','officer']).maybeSingle()).data)
  if (!access) return NextResponse.json({ error: 'Officer access required' }, { status: 403 })

  const [{ data: users }, { data: members }, { data: events }, { data: rules }, { data: queue }, { data: puppetState }, { data: progress }, { data: deferred }, { data: appeals }, { data: cycles }, { data: featherGroups }, { data: officerQueue }, { data: recruitment }, { data: applications }] = await Promise.all([
    supabase.from('guild_users').select('user_id,role,created_at').eq('guild_id', guild.id),
    supabase.from('guild_members').select('*').eq('guild_id', guild.id).order('created_at'),
    supabase.from('guild_events').select('*').eq('guild_id', guild.id).order('starts_at'),
    supabase.from('guild_auction_rules').select('*').eq('guild_id', guild.id).maybeSingle(),
    supabase.from('puppet_queue').select('*').eq('guild_id', guild.id).order('position'),
    supabase.from('guild_puppet_state').select('*').eq('guild_id', guild.id).maybeSingle(),
    supabase.from('puppet_cycle_progress').select('*').eq('guild_id', guild.id).order('cycle'),
    supabase.from('puppet_deferred_turns').select('*').eq('guild_id', guild.id).order('created_at'),
    supabase.from('puppet_appeals').select('*').eq('guild_id', guild.id).order('submitted_at'),
    supabase.from('puppet_cycle_history').select('*').eq('guild_id', guild.id).order('cycle'),
    supabase.from('feather_groups').select('*').eq('guild_id', guild.id).order('rotation_order'),
    supabase.from('feather_officer_queue').select('*').eq('guild_id', guild.id).order('position'),
    supabase.from('recruitment_settings').select('*').eq('guild_id', guild.id).maybeSingle(),
    supabase.from('guild_applications').select('*').eq('guild_id', guild.id).order('created_at'),
  ])

  const eventIds = (events || []).map((event) => event.id)
  const [{ data: loas }, { data: absences }, { data: lineups }, { data: puppetExclusions }, { data: featherExclusions }, { data: runs }] = eventIds.length ? await Promise.all([
    supabase.from('event_loas').select('*').in('event_id', eventIds),
    supabase.from('event_absences').select('*').in('event_id', eventIds),
    supabase.from('event_lineup_slots').select('*').in('event_id', eventIds),
    supabase.from('event_puppet_exclusions').select('*').in('event_id', eventIds),
    supabase.from('event_feather_exclusions').select('*').in('event_id', eventIds),
    supabase.from('auction_runs').select('*').in('event_id', eventIds),
  ]) : [{data:[]},{data:[]},{data:[]},{data:[]},{data:[]},{data:[]}]

  const runIds = (runs || []).map((run) => run.id)
  const { data: allocations } = runIds.length ? await supabase.from('auction_allocations').select('*').in('auction_run_id', runIds) : { data: [] }

  const payload = {
    format: 'headlessgm-guild-backup-v1',
    exported_at: new Date().toISOString(),
    guild,
    guild_users: users || [],
    guild_members: members || [],
    auction_rules: rules || null,
    events: events || [],
    event_loas: loas || [],
    event_absences: absences || [],
    event_lineup_slots: lineups || [],
    event_puppet_exclusions: puppetExclusions || [],
    event_feather_exclusions: featherExclusions || [],
    auction_runs: runs || [],
    auction_allocations: allocations || [],
    puppet_queue: queue || [],
    puppet_state: puppetState || null,
    puppet_cycle_progress: progress || [],
    puppet_deferred_turns: deferred || [],
    puppet_appeals: appeals || [],
    puppet_cycle_history: cycles || [],
    feather_groups: featherGroups || [],
    feather_officer_queue: officerQueue || [],
    recruitment_settings: recruitment || null,
    applications: applications || [],
  }

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${guild.slug}-headlessgm-backup-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
