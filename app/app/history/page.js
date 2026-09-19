import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { resolveGuild, withGuild } from '../../../lib/guild-context'
import AppShell from '../../../components/app-shell'

export default async function HistoryPage({ searchParams }) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const params = await searchParams
  const guild = await resolveGuild(supabase, params?.guild, 'id,name,slug,owner_user_id')
  if (!guild) redirect('/app/onboarding')
  const access = guild.owner_user_id === userId || Boolean((await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).in('role', ['owner','officer']).maybeSingle()).data)
  if (!access) redirect(`/${guild.slug}`)

  const [{ data: events }, { data: cycles }, { data: appeals }, { data: deferred }] = await Promise.all([
    supabase.from('guild_events').select('id,name,event_type,starts_at,status').eq('guild_id', guild.id).order('starts_at', { ascending: false }).limit(80),
    supabase.from('puppet_cycle_history').select('cycle,completed_at,appeal_open_until,completed_through_event_id,snapshot').eq('guild_id', guild.id).order('cycle', { ascending: false }).limit(20),
    supabase.from('puppet_appeals').select('id,source_cycle,status,submitted_at,consumed_at').eq('guild_id', guild.id).order('submitted_at', { ascending: false }).limit(50),
    supabase.from('puppet_deferred_turns').select('id,source_cycle,reason,created_at,consumed_at').eq('guild_id', guild.id).order('created_at', { ascending: false }).limit(50),
  ])

  const eventIds = (events || []).map((event) => event.id)
  const [{ data: loas }, { data: absences }, { data: slots }, { data: runs }] = eventIds.length ? await Promise.all([
    supabase.from('event_loas').select('event_id,id,cancelled_at').in('event_id', eventIds),
    supabase.from('event_absences').select('event_id,id').in('event_id', eventIds),
    supabase.from('event_lineup_slots').select('event_id,guild_member_id').in('event_id', eventIds).not('guild_member_id','is',null),
    supabase.from('auction_runs').select('event_id,status,completed_at,published_at,generated_at,generated_output').in('event_id', eventIds),
  ]) : [{data:[]},{data:[]},{data:[]},{data:[]}]

  const countFor = (rows, eventId, filter = () => true) => (rows || []).filter((row) => row.event_id === eventId && filter(row)).length
  const runMap = new Map((runs || []).map((run) => [run.event_id, run]))

  return (
    <AppShell guildName={guild.name} guildSlug={guild.slug} eyebrow="HISTORY" title="Guild History" activeHref="/app/history" actions={<a className="button ghost" href={`/api/export?guild=${encodeURIComponent(guild.slug)}`}>Export guild backup</a>}>
      <section className="panel">
        <div className="panel-pad section-head"><div><h2>Event record</h2><p>Attendance, lineup, auction publication, completion and snapshotted generated state stay attached to the event.</p></div></div>
        <div className="table-wrap" style={{ border:0,borderRadius:0 }}><table><thead><tr><th>Event</th><th>Date</th><th>Status</th><th>LOA</th><th>No-show</th><th>Lineup</th><th>Auction</th><th>Completed</th><th></th></tr></thead><tbody>{(events||[]).map((event)=>{const run=runMap.get(event.id);return <tr key={event.id}><td><strong>{event.name}</strong><div className="muted" style={{fontSize:12}}>{event.event_type.replaceAll('_',' ')}</div></td><td>{new Date(event.starts_at).toLocaleString()}</td><td><span className="pill">{event.status}</span></td><td>{countFor(loas,event.id,(row)=>!row.cancelled_at)}</td><td>{countFor(absences,event.id)}</td><td>{countFor(slots,event.id)}</td><td>{run?.status||'—'}</td><td>{run?.completed_at?new Date(run.completed_at).toLocaleString():'—'}</td><td><Link href={withGuild(`/app/events/${event.id}`,guild.slug)}>Open →</Link></td></tr>})}{!events?.length?<tr><td colSpan="9" className="muted">No event history yet.</td></tr>:null}</tbody></table></div>
      </section>

      <section className="overview-columns">
        <div className="panel"><div className="panel-pad section-head"><div><h2>Puppet cycle history</h2><p>Cycle closure snapshots remain immutable. Each closed cycle keeps a seven-day appeal window.</p></div></div><div className="table-wrap" style={{border:0,borderRadius:0}}><table><thead><tr><th>Cycle</th><th>Completed</th><th>Appeal closes</th><th>Members</th></tr></thead><tbody>{(cycles||[]).map((row)=><tr key={row.cycle}><td><strong>Cycle {row.cycle}</strong></td><td>{new Date(row.completed_at).toLocaleString()}</td><td>{new Date(row.appeal_open_until).toLocaleString()}</td><td>{Array.isArray(row.snapshot)?row.snapshot.length:(Array.isArray(row.snapshot?.members)?row.snapshot.members.length:'—')}</td></tr>)}{!cycles?.length?<tr><td colSpan="4" className="muted">No completed Puppet cycles yet.</td></tr>:null}</tbody></table></div></div>
        <div className="panel panel-pad"><div className="section-head"><div><h2>Puppet audit</h2><p>Open appeal and deferred-turn counts are preserved independently from the event result.</p></div></div><div className="event-readiness-strip"><div><small>Appeals filed</small><strong>{appeals?.length||0}</strong></div><div><small>Pending</small><strong>{(appeals||[]).filter((row)=>row.status==='pending').length}</strong></div><div><small>Approved open</small><strong>{(appeals||[]).filter((row)=>row.status==='approved'&&!row.consumed_at).length}</strong></div><div><small>Deferred open</small><strong>{(deferred||[]).filter((row)=>!row.consumed_at).length}</strong></div></div></div>
      </section>
    </AppShell>
  )
}
