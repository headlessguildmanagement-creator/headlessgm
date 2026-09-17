import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import AppShell from '../../../components/app-shell'

export default async function AuctionsPage() {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const { data: guild } = await supabase.from('guilds').select('id,name,owner_user_id').limit(1).maybeSingle()
  if (!guild) redirect('/app/onboarding')
  const manager = guild.owner_user_id === userId || Boolean((await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).in('role', ['owner','officer']).maybeSingle()).data)
  if (!manager) redirect('/app')

  const { data: events } = await supabase.from('guild_events').select('id,name,event_type,starts_at,status').eq('guild_id', guild.id).order('starts_at', { ascending: false }).limit(30)
  const eventIds = (events || []).map((e) => e.id)
  const { data: runs } = eventIds.length ? await supabase.from('auction_runs').select('id,event_id,status,generated_at,published_at,completed_at,input_data').in('event_id', eventIds) : { data: [] }
  const runMap = new Map((runs || []).map((run) => [run.event_id, run]))

  return (
    <AppShell guildName={guild.name} eyebrow="AUCTION" title="Auction Operations" activeHref="/app/auctions">
      <section className="panel">
        <div className="panel-pad section-head"><div><h2>Event auctions</h2><p>Generate draft → officer review → publish → finalize. Persistent rotations advance only on finalization.</p></div><Link href="/app/settings/auction" className="button ghost">Rules & caps</Link></div>
        <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
          <table>
            <thead><tr><th>Event</th><th>Date</th><th>Event state</th><th>Auction</th><th>Rewards entered</th><th></th></tr></thead>
            <tbody>
              {(events || []).map((event) => {
                const run = runMap.get(event.id)
                const q = run?.input_data?.quantities || {}
                const total = Object.values(q).reduce((sum, value) => sum + (Number(value) || 0), 0)
                return <tr key={event.id}><td><strong>{event.name}</strong><div className="muted" style={{ fontSize: 12 }}>{event.event_type.replaceAll('_',' ')}</div></td><td>{new Date(event.starts_at).toLocaleString()}</td><td><span className="pill">{event.status}</span></td><td><span className="pill">{run?.status || 'not generated'}</span></td><td>{run ? total : '—'}</td><td><Link href={`/app/events/${event.id}/auction`}>Open →</Link></td></tr>
              })}
              {!events?.length ? <tr><td colSpan="6" className="muted">No events yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  )
}
