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
  const access = guild.owner_user_id === userId || Boolean((await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).maybeSingle()).data)
  if (!access) redirect('/app')

  const { data: events } = await supabase.from('guild_events').select('id,name,event_type,starts_at,status').eq('guild_id', guild.id).order('starts_at', { ascending: false }).limit(50)
  const eventIds = (events || []).map((event) => event.id)
  const [{ data: loas }, { data: absences }, { data: slots }, { data: runs }] = eventIds.length ? await Promise.all([
    supabase.from('event_loas').select('event_id,id,cancelled_at').in('event_id', eventIds),
    supabase.from('event_absences').select('event_id,id').in('event_id', eventIds),
    supabase.from('event_lineup_slots').select('event_id,guild_member_id').in('event_id', eventIds).not('guild_member_id','is',null),
    supabase.from('auction_runs').select('event_id,status,completed_at').in('event_id', eventIds),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]

  const countFor = (rows, eventId, filter = () => true) => (rows || []).filter((row) => row.event_id === eventId && filter(row)).length
  const runMap = new Map((runs || []).map((run) => [run.event_id, run]))

  return (
    <AppShell guildName={guild.name} guildSlug={guild.slug} eyebrow="HISTORY" title="Guild History" activeHref="/app/history">
      <section className="panel">
        <div className="panel-pad section-head"><div><h2>Event record</h2><p>Completed operations remain attached to the event: LOA, no-show, lineup, auction publication and finalization.</p></div></div>
        <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
          <table>
            <thead><tr><th>Event</th><th>Date</th><th>Status</th><th>LOA</th><th>No-show</th><th>Lineup</th><th>Auction</th><th></th></tr></thead>
            <tbody>
              {(events || []).map((event) => {
                const run = runMap.get(event.id)
                return <tr key={event.id}><td><strong>{event.name}</strong><div className="muted" style={{ fontSize: 12 }}>{event.event_type.replaceAll('_',' ')}</div></td><td>{new Date(event.starts_at).toLocaleString()}</td><td><span className="pill">{event.status}</span></td><td>{countFor(loas,event.id,(row)=>!row.cancelled_at)}</td><td>{countFor(absences,event.id)}</td><td>{countFor(slots,event.id)}</td><td>{run?.status || '—'}</td><td><Link href={withGuild(`/app/events/${event.id}`, guild.slug)}>Open →</Link></td></tr>
              })}
              {!events?.length ? <tr><td colSpan="8" className="muted">No event history yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  )
}
