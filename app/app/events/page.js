import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
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
    <main style={{ minHeight: '100vh', padding: '32px 20px 64px' }}>
      <div style={{ width: 'min(1040px,100%)', margin: '0 auto', display: 'grid', gap: 20 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'end', flexWrap: 'wrap' }}>
          <div><p className="eyebrow">{guild.name} · Operations</p><h1 style={{ fontSize: 46, margin: '6px 0 8px' }}>Events</h1><p style={{ margin: 0, color: '#8b96a5' }}>Event → LOA → expected attendance → lineup → auction → finalize.</p></div>
          <Link href="/app" style={{ color: 'inherit', textDecoration: 'none', border: '1px solid #303742', borderRadius: 10, padding: '10px 14px' }}>Dashboard</Link>
        </header>

        {success ? <div style={{ padding: 12, borderRadius: 10, background: '#14301f', border: '1px solid #25633a' }}>{success}</div> : null}
        {errorMessage ? <div style={{ padding: 12, borderRadius: 10, background: '#381b1b', border: '1px solid #743333' }}>{errorMessage}</div> : null}

        {canManage ? <section style={{ border: '1px solid #2b313c', borderRadius: 16, padding: 20, background: '#11151a' }}>
          <h2 style={{ marginTop: 0 }}>Create event</h2>
          <form action={createEvent} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10 }}>
            <input type="hidden" name="guild_id" value={guild.id} />
            <input name="name" required placeholder="Guild League · Sep 20" style={{ padding: 11, borderRadius: 10 }} />
            <select name="event_type" defaultValue="guild_league" style={{ padding: 11, borderRadius: 10 }}><option value="guild_league">Guild League</option><option value="other">Other</option></select>
            <input name="starts_at" required placeholder="2026-09-20T20:00:00+08:00" title="ISO date/time with timezone, e.g. 2026-09-20T20:00:00+08:00" style={{ padding: 11, borderRadius: 10 }} />
            <input name="loa_deadline" required placeholder="2026-09-20T19:30:00+08:00" title="Havoc cutoff: 7:30 PM PHT on event day" style={{ padding: 11, borderRadius: 10 }} />
            <button type="submit" style={{ gridColumn: '1 / -1', justifySelf: 'start' }}>Create event</button>
          </form>
          <p style={{ color: '#7f8a98', fontSize: 12, marginBottom: 0 }}>Havoc default: LOA closes at 7:30 PM PHT on the event day. We will move this into configurable event presets rather than typing it manually.</p>
        </section> : null}

        <section style={{ display: 'grid', gap: 12 }}>
          {(events || []).map((event) => <Link key={event.id} href={`/app/events/${event.id}`} style={{ color: 'inherit', textDecoration: 'none', border: '1px solid #2b313c', borderRadius: 14, padding: 18, background: '#11151a', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
            <div><div style={{ color: '#8b96a5', fontSize: 12 }}>{event.event_type.replaceAll('_',' ').toUpperCase()}</div><h2 style={{ margin: '4px 0 5px' }}>{event.name}</h2><div style={{ color: '#8b96a5' }}>{new Date(event.starts_at).toLocaleString()} · LOA cutoff {new Date(event.loa_deadline).toLocaleString()}</div></div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>{event.status.toUpperCase()}</div>
          </Link>)}
          {!events?.length ? <div style={{ border: '1px dashed #303742', borderRadius: 14, padding: 24, color: '#8b96a5' }}>No events yet.</div> : null}
        </section>
      </div>
    </main>
  )
}
