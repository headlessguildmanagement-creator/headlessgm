import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import ThemeToggle from '../../../components/theme-toggle'
import { fileMemberLoa, cancelMemberLoa, submitPuppetAppeal } from './actions'
import { commanderBrandStyle } from '../../../lib/brand.js'

export default async function MemberPortalPage({ searchParams }) {
  const query = await searchParams
  const guildId = String(query?.guild || '')
  const success = String(query?.success || '')
  const errorMessage = String(query?.error || '')
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  if (authError || !authData?.claims?.sub) redirect(`/login?next=${encodeURIComponent(`/app/member?guild=${guildId}`)}`)
  if (!guildId) redirect('/app')

  const { data: portal, error } = await supabase.rpc('get_my_guild_portal', { p_guild_id: guildId })
  if (error) return <main className="member-portal"><div className="member-portal-wrap"><h1>Member portal</h1><p>{error.message}</p></div></main>

  const { data: guildTheme } = await supabase.from('guilds').select('plan_code,settings').eq('id', guildId).maybeSingle()
  const brandStyle = commanderBrandStyle(guildTheme?.plan_code, guildTheme?.settings || {})
  const branded = ['commander','beta'].includes(String(guildTheme?.plan_code || ''))
  const puppet = portal.puppet || {}
  return (
    <main className={branded ? 'member-portal commander-branded' : 'member-portal'} style={brandStyle}>
      <div className="member-portal-wrap">
        <header className="member-portal-header"><div><p className="eyebrow">{portal.guild.name} · MEMBER PORTAL</p><h1>{portal.member.ign}</h1><p className="muted">Your Discord identity is linked. Availability, lineup, rewards and Puppet state are scoped to you.</p></div><ThemeToggle /></header>
        {success ? <div className="notice success">{success}</div> : null}
        {errorMessage ? <div className="notice error">{errorMessage}</div> : null}

        <section className="stats member-portal-stats">
          <div className="stat"><label>PUPPET CYCLE</label><strong>{puppet.current_cycle || 1}</strong><small>Current guild cycle</small></div>
          <div className="stat"><label>A–Z POSITION</label><strong>{puppet.position ? `#${puppet.position}` : '—'}</strong><small>Persistent queue position</small></div>
          <div className="stat"><label>CYCLE STATE</label><strong style={{fontSize:20}}>{puppet.completed_current_cycle ? 'DONE' : 'PENDING'}</strong><small>{puppet.deferred ? `Make-up from Cycle ${puppet.deferred.source_cycle}` : 'Normal current-cycle state'}</small></div>
          <div className="stat"><label>APPEALS</label><strong>{puppet.appeals?.length || 0}</strong><small>{(puppet.appeals||[]).filter((row)=>row.status==='pending').length} pending</small></div>
        </section>

        {puppet.deferred ? <div className="notice"><strong>MAKE-UP PUPPET TURN:</strong> Cycle {puppet.deferred.source_cycle} · {String(puppet.deferred.reason||'').replaceAll('_',' ')}. This obligation is selected before your normal current-cycle turn when you are eligible.</div> : null}

        {(portal.events || []).map((event) => {
          const closed = ['completed','cancelled'].includes(event.status)
          const pastDeadline = new Date() > new Date(event.loa_deadline)
          return <section key={event.id} className="panel panel-pad">
            <div className="section-head"><div><p className="eyebrow">{String(event.event_type).replaceAll('_',' ')}</p><h2>{event.name}</h2><p>{new Date(event.starts_at).toLocaleString()}</p></div><span className="pill">{String(event.status).toUpperCase()}</span></div>
            <div className="member-event-grid">
              <div><small>AVAILABILITY</small><strong>{event.loa ? 'LOA / unavailable' : 'Expected to attend'}</strong></div>
              <div><small>LINEUP</small><strong>{event.lineup ? `${String(event.lineup.raid_code).toUpperCase()} · Party ${event.lineup.party_no} · Slot ${event.lineup.slot_no}` : 'Not assigned yet'}</strong></div>
              <div><small>REWARDS</small><strong>{event.rewards?.length ? event.rewards.map((r)=>`${String(r.category).replaceAll('_',' ')} ×${r.quantity}${r.metadata?.turn_kind ? ` · ${r.metadata.turn_kind}` : ''}`).join(', ') : 'No published allocation'}</strong></div>
            </div>

            {!closed && !pastDeadline ? <div className="member-event-actions">{event.loa ? <form action={cancelMemberLoa}><input type="hidden" name="guild_id" value={portal.guild.id}/><input type="hidden" name="event_id" value={event.id}/><p className="muted">LOA filed{event.loa.reason ? `: ${event.loa.reason}` : ''}</p><button type="submit" className="button ghost">Cancel LOA</button></form> : <form action={fileMemberLoa} className="inline-action"><input type="hidden" name="guild_id" value={portal.guild.id}/><input type="hidden" name="event_id" value={event.id}/><input name="reason" maxLength={500} placeholder="LOA reason (optional)"/><button type="submit" className="button">File LOA</button></form>}<div className="muted">LOA cutoff: {new Date(event.loa_deadline).toLocaleString()}</div></div> : null}

            {event.puppet_appealable ? <div className="member-event-actions"><h3>Puppet appeal</h3><p className="muted">A completed Puppet turn from this event is still inside the cycle's seven-day appeal window.</p><form action={submitPuppetAppeal} className="inline-action"><input type="hidden" name="guild_id" value={portal.guild.id}/><input type="hidden" name="event_id" value={event.id}/><input name="reason" required minLength={3} maxLength={500} placeholder="Explain why this Puppet turn should be reviewed"/><button className="button ghost" type="submit">Submit appeal</button></form></div> : null}
          </section>
        })}
        {!portal.events?.length ? <section className="panel panel-pad muted">No guild events are available yet.</section> : null}
        <footer className="member-portal-footer"><Link href={`/${portal.guild.slug}/overview`}>Return to guild workspace</Link></footer>
      </div>
    </main>
  )
}
