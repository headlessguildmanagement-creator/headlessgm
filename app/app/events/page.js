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

  const { data: guildRows } = await supabase.from('guilds').select('id,name,timezone,loa_deadline_local_time,owner_user_id').order('created_at').limit(1)
  const guild = guildRows?.[0]
  if (!guild) redirect('/app/onboarding')
  const membership = await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).maybeSingle()
  const canManage = guild.owner_user_id === userId || ['owner','officer'].includes(membership.data?.role)
  const { data: events } = await supabase.from('guild_events').select('*').eq('guild_id', guild.id).order('starts_at', { ascending: false })
  const loaTime = String(guild.loa_deadline_local_time || '19:30:00').slice(0,5)

  return (
    <AppShell guildName={guild.name} eyebrow="OPERATIONS" title="Events" activeHref="/app/events">
      {success ? <div className="notice success">{success}</div> : null}
      {errorMessage ? <div className="notice error">{errorMessage}</div> : null}

      {canManage ? (
        <section className="panel panel-pad">
          <div className="section-head"><div><h2>Create event</h2><p>Use the guild-local date and call time. HeadlessGM applies the guild LOA deadline automatically in {guild.timezone}.</p></div><span className="pill">LOA {loaTime}</span></div>
          <form action={createEvent} className="form-grid">
            <input type="hidden" name="guild_id" value={guild.id} />
            <label className="field full"><span>Event name</span><input name="name" required placeholder="Guild League · Sep 20" /></label>
            <label className="field"><span>Event type</span><select name="event_type" defaultValue="guild_league"><option value="guild_league">Guild League</option><option value="emperium_overrun">Emperium Overrun</option><option value="other">Other</option></select></label>
            <label className="field"><span>Event date · {guild.timezone}</span><input type="date" name="event_date" required /></label>
            <label className="field"><span>Call / event time · {guild.timezone}</span><input type="time" name="event_time" defaultValue="20:30" required /></label>
            <div className="full notice"><strong>LOA cutoff:</strong> {loaTime} on the event date. Change the guild default from Settings → Guild Profile.</div>
            <div className="full"><button type="submit" className="button">Create event</button></div>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-pad section-head"><div><h2>Event history & queue</h2><p>Open an event to manage attendance, Main/Sub lineup, auction and finalization.</p></div></div>
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
