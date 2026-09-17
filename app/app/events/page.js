import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import AppShell from '../../../components/app-shell'
import { createEvent } from './actions'

export default async function EventsPage({ searchParams }) {
  const query = await searchParams
  const success = String(query?.success || '')
  const errorMessage = String(query?.error || '')
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const { data: guildRows } = await supabase.from('guilds').select('id,name,timezone,owner_user_id').order('created_at').limit(1)
  const guild = guildRows?.[0]
  if (!guild) redirect('/app/onboarding')
  const membership = await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).maybeSingle()
  const canManage = guild.owner_user_id === userId || ['owner','officer'].includes(membership.data?.role)
  const { data: events } = await supabase.from('guild_events').select('*').eq('guild_id', guild.id).order('starts_at', { ascending: false })

  return (
    <AppShell guildName={guild.name} eyebrow="OPERATIONS" title="Events" activeHref="/app/events">
      {success ? <div className="notice success">{success}</div> : null}
      {errorMessage ? <div className="notice error">{errorMessage}</div> : null}

      {canManage ? (
        <section className="panel panel-pad">
          <div className="section-head"><div><h2>Create event</h2><p>Each event owns its LOA, availability, Main/Sub lineup and auction state.</p></div></div>
          <form action={createEvent} className="form-grid">
            <input type="hidden" name="guild_id" value={guild.id} />
            <label className="field full"><span>Event name</span><input name="name" required placeholder="Guild League · Sep 20" /></label>
            <label className="field"><span>Event type</span><select name="event_type" defaultValue="guild_league"><option value="guild_league">Guild League</option><option value="other">Other</option></select></label>
            <label className="field"><span>Starts at</span><input name="starts_at" required placeholder="2026-09-20T20:00:00+08:00" /></label>
            <label className="field"><span>LOA deadline</span><input name="loa_deadline" required placeholder="2026-09-20T19:30:00+08:00" /></label>
            <div className="full"><button type="submit" className="button">Create event</button></div>
          </form>
          <p className="muted" style={{ marginBottom: 0 }}>Havoc preset default: event-day LOA cutoff at 7:30 PM PHT. Guild-level defaults will feed this automatically.</p>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-pad section-head"><div><h2>Event history & queue</h2><p>Open an event to manage attendance, lineup and event-scoped state.</p></div></div>
        <div className="ops-list">
          {(events || []).map((event) => (
            <Link key={event.id} href={`/app/events/${event.id}`} className="ops-row">
              <strong>{event.name}</strong>
              <p>{event.event_type.replaceAll('_',' ').toUpperCase()} · {new Date(event.starts_at).toLocaleString()} · LOA {new Date(event.loa_deadline).toLocaleString()}</p>
              <span>{event.status.toUpperCase()} →</span>
            </Link>
          ))}
          {!events?.length ? <div className="panel-pad muted">No events yet.</div> : null}
        </div>
      </section>
    </AppShell>
  )
}
