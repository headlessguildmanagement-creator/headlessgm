import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import AppShell from '../../../../components/app-shell'
import LineupSearch from '../../../../components/lineup-search'
import { updateEventStatus, fileMyLoa, cancelMyLoa, assignLineupMember, setEventAbsence, importPreviousLineup, publishLineup, clearLineup } from '../actions'

export default async function EventDetailPage({ params, searchParams }) {
  const { id } = await params
  const query = await searchParams
  const success = String(query?.success || '')
  const errorMessage = String(query?.error || '')
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const { data: event } = await supabase.from('guild_events').select('*').eq('id', id).maybeSingle()
  if (!event) notFound()
  const { data: guild } = await supabase.from('guilds').select('id,name,slug,owner_user_id,game_preset_id,timezone').eq('id', event.guild_id).single()
  const membership = await supabase.from('guild_users').select('role').eq('guild_id', event.guild_id).eq('user_id', userId).maybeSingle()
  const canManage = guild?.owner_user_id === userId || ['owner','officer'].includes(membership.data?.role)

  const [{ data: members }, { data: loas }, { data: absences }, { data: slots }, { data: jobs }, { data: auctionRun }] = await Promise.all([
    supabase.from('guild_members').select('id,ign,job_code,combat_role,status,discord_user_id').eq('guild_id', event.guild_id).eq('status', 'active').order('ign'),
    supabase.from('event_loas').select('id,guild_member_id,reason,filed_at,cancelled_at').eq('event_id', id),
    supabase.from('event_absences').select('id,guild_member_id,reason,created_at').eq('event_id', id),
    supabase.from('event_lineup_slots').select('*').eq('event_id', id).order('raid_code').order('party_no').order('slot_no'),
    supabase.from('game_jobs').select('code,label').eq('game_preset_id', guild.game_preset_id),
    supabase.from('auction_runs').select('id,status').eq('event_id', id).maybeSingle(),
  ])

  const jobMap = Object.fromEntries((jobs || []).map((job) => [job.code, job.label]))
  const memberMap = new Map((members || []).map((member) => [member.id, member]))
  const activeLoas = (loas || []).filter((loa) => !loa.cancelled_at)
  const loaIds = new Set(activeLoas.map((loa) => loa.guild_member_id))
  const absenceIds = new Set((absences || []).map((absence) => absence.guild_member_id))
  const expected = (members || []).filter((member) => !loaIds.has(member.id))
  const eligible = expected.filter((member) => !absenceIds.has(member.id))
  const assignedIds = new Set((slots || []).filter((slot) => slot.guild_member_id).map((slot) => slot.guild_member_id))
  const available = eligible.filter((member) => !assignedIds.has(member.id))
  const jobBreakdown = [...(members || []).reduce((map, member) => {
    const label = jobMap[member.job_code] || member.job_code || 'Job not set'
    map.set(label, (map.get(label) || 0) + 1)
    return map
  }, new Map()).entries()].sort((a, b) => a[0].localeCompare(b[0]))

  const supportWarnings = []
  for (const raid of ['main', 'sub']) {
    for (let party = 1; party <= 8; party += 1) {
      const partyMembers = (slots || [])
        .filter((slot) => slot.raid_code === raid && slot.party_no === party && slot.guild_member_id)
        .map((slot) => memberMap.get(slot.guild_member_id))
        .filter(Boolean)
      if (partyMembers.length && !partyMembers.some((member) => String(member.combat_role || '').toLowerCase() === 'support')) {
        supportWarnings.push(`${raid === 'main' ? 'Main' : 'Sub'} Party ${party}`)
      }
    }
  }

  const lineupSearchRows = (slots || [])
    .filter((slot) => slot.guild_member_id)
    .map((slot) => {
      const member = memberMap.get(slot.guild_member_id)
      return member ? { memberId: member.id, ign: member.ign, job: jobMap[member.job_code] || member.job_code || '', raid: slot.raid_code, party: slot.party_no, slot: slot.slot_no } : null
    })
    .filter(Boolean)

  const discordIdentity = (await supabase.auth.getUser()).data?.user?.identities?.find((identity) => identity.provider === 'discord')
  const myDiscordId = discordIdentity?.identity_data?.sub || discordIdentity?.identity_id || discordIdentity?.id || null
  const myMember = myDiscordId ? (members || []).find((member) => member.discord_user_id === myDiscordId) : null
  const myLoa = myMember ? activeLoas.find((loa) => loa.guild_member_id === myMember.id) : null

  function slotFor(raid, party, slotNo) {
    return (slots || []).find((slot) => slot.raid_code === raid && slot.party_no === party && slot.slot_no === slotNo)
  }

  function candidatesFor(currentMemberId) {
    return eligible.filter((member) => member.id === currentMemberId || !assignedIds.has(member.id))
  }

  const headerActions = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {canManage ? <Link href={`/app/events/${id}/auction`} className="button">Auction {auctionRun ? `· ${auctionRun.status}` : ''}</Link> : null}
      <Link href={`/${guild.slug}/events`} className="button ghost">All events</Link>
    </div>
  )

  return (
    <AppShell guildName={guild.name} eyebrow="EVENT COMMAND" title={event.name} activeHref="/app/events" actions={headerActions}>
      {success ? <div className="notice success">{success}</div> : null}
      {errorMessage ? <div className="notice error">{errorMessage}</div> : null}

      <section className="stats">
        <div className="stat"><label>ACTIVE ROSTER</label><strong>{members?.length || 0}</strong><small>Persistent roster</small></div>
        <div className="stat"><label>LOA</label><strong>{activeLoas.length}</strong><small>Event-scoped exceptions</small></div>
        <div className="stat"><label>NO-SHOW</label><strong>{absences?.length || 0}</strong><small>Excluded from lineup & auction</small></div>
        <div className="stat"><label>UNASSIGNED</label><strong>{available.length}</strong><small>Eligible but not in Main/Sub</small></div>
      </section>

      <section className="panel panel-pad">
        <div className="section-head">
          <div><h2>Event state</h2><p>{new Date(event.starts_at).toLocaleString()} · LOA cutoff {new Date(event.loa_deadline).toLocaleString()}</p></div>
          <span className="pill">{event.status.toUpperCase()}</span>
        </div>
        {canManage ? (
          <form action={updateEventStatus} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="hidden" name="event_id" value={event.id} />
            <input type="hidden" name="guild_id" value={event.guild_id} />
            {['upcoming','loa_open','lineup','live','auction','completed','cancelled'].map((status) => <button className={event.status === status ? 'button' : 'button ghost'} key={status} type="submit" name="status" value={status} disabled={event.status === status}>{status.replaceAll('_',' ')}</button>)}
          </form>
        ) : null}
        {canManage ? <div className="operator-actions">
          <form action={importPreviousLineup}><input type="hidden" name="event_id" value={event.id} /><input type="hidden" name="guild_id" value={event.guild_id} /><button type="submit" className="button ghost">Use previous lineup</button></form>
          <form action={clearLineup}><input type="hidden" name="event_id" value={event.id} /><input type="hidden" name="guild_id" value={event.guild_id} /><button type="submit" className="button ghost">Clear lineup</button></form>
          <form action={publishLineup}><input type="hidden" name="event_id" value={event.id} /><input type="hidden" name="guild_id" value={event.guild_id} /><button type="submit" className="button">Publish Lineup to Discord</button></form>
        </div> : null}
      </section>

      {myMember ? (
        <section className="panel panel-pad">
          <div className="section-head"><div><h2>My availability</h2><p>Default policy: attending unless an LOA is filed before cutoff.</p></div><span className="pill">{myLoa ? 'LOA FILED' : absenceIds.has(myMember.id) ? 'ABSENT' : 'ATTENDING'}</span></div>
          {myLoa ? (
            <form action={cancelMyLoa}><input type="hidden" name="event_id" value={event.id} /><p className="muted">{myLoa.reason || 'No reason provided.'}</p><button type="submit" className="button ghost">Cancel my LOA</button></form>
          ) : (
            <form action={fileMyLoa} className="form-grid"><input type="hidden" name="event_id" value={event.id} /><label className="field full"><span>LOA reason · optional</span><input type="text" name="reason" maxLength={500} placeholder="Reason" /></label><div className="full"><button type="submit" className="button">File LOA</button></div></form>
          )}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-pad section-head"><div><h2>Attendance</h2><p>LOA is member-filed availability. No-show is officer-recorded after the lineup/event and removes auction eligibility without changing the persistent roster.</p></div><span className="pill">{eligible.length} ELIGIBLE</span></div>
        <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
          <table>
            <thead><tr><th>IGN</th><th>Class</th><th>Combat role</th><th>State</th><th>Reason</th>{canManage ? <th>Officer action</th> : null}</tr></thead>
            <tbody>
              {(members || []).map((member) => {
                const loa = activeLoas.find((row) => row.guild_member_id === member.id)
                const absence = (absences || []).find((row) => row.guild_member_id === member.id)
                const state = loa ? 'LOA' : absence ? 'NO-SHOW' : 'EXPECTED'
                return <tr key={member.id}><td><strong>{member.ign}</strong></td><td>{jobMap[member.job_code] || member.job_code || '—'}</td><td>{member.combat_role || '—'}</td><td><span className="pill">{state}</span></td><td>{loa?.reason || absence?.reason || '—'}</td>{canManage ? <td>{loa ? <span className="muted">LOA controls availability</span> : <form action={setEventAbsence} style={{ display: 'flex', gap: 6 }}><input type="hidden" name="event_id" value={event.id}/><input type="hidden" name="guild_id" value={event.guild_id}/><input type="hidden" name="guild_member_id" value={member.id}/><input type="hidden" name="absent" value={absence ? 'false' : 'true'}/><button type="submit" className="button ghost">{absence ? 'Remove no-show' : 'Mark no-show'}</button></form>}</td> : null}</tr>
              })}
            </tbody>
          </table>
        </div>
      </section>

      <LineupSearch rows={lineupSearchRows} />

      {canManage && guild.plan_code !== 'free' && supportWarnings.length ? <div className="notice error lineup-support-warning"><strong>Party support warning:</strong> {supportWarnings.join(', ')} currently {supportWarnings.length === 1 ? 'has' : 'have'} assigned players but no Support-role member.</div> : null}

      {canManage ? ['main','sub'].map((raid) => (
        <section key={raid} className="panel panel-pad">
          <div className="section-head"><div><h2>{raid === 'main' ? 'Main 40' : 'Sub'}</h2><p>8 parties × 5. A member can occupy only one event slot; moving them frees their previous slot.</p></div><span className="pill">{(slots || []).filter((slot) => slot.raid_code === raid && slot.guild_member_id).length} ASSIGNED</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
            {Array.from({ length: 8 }, (_, partyIndex) => partyIndex + 1).map((party) => (
              <div key={party} className="panel" style={{ boxShadow: 'none', padding: 12 }}>
                <h3 style={{ margin: '0 0 10px' }}>Party {party}</h3>
                <div style={{ display: 'grid', gap: 8 }}>
                  {Array.from({ length: 5 }, (_, slotIndex) => slotIndex + 1).map((slotNo) => {
                    const slot = slotFor(raid, party, slotNo)
                    const member = memberMap.get(slot?.guild_member_id)
                    const candidates = candidatesFor(member?.id)
                    return (
                      <form key={slotNo} action={assignLineupMember} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
                        <input type="hidden" name="event_id" value={event.id}/><input type="hidden" name="guild_id" value={event.guild_id}/><input type="hidden" name="raid_code" value={raid}/><input type="hidden" name="party_no" value={party}/><input type="hidden" name="slot_no" value={slotNo}/>
                        <select name="guild_member_id" defaultValue={member?.id || ''}><option value="">Slot {slotNo} · empty</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.ign} · {jobMap[candidate.job_code] || candidate.job_code || '—'}</option>)}</select>
                        <button type="submit" className="button ghost">Save</button>
                      </form>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )) : null}

      <section className="panel panel-pad">
        <div className="section-head"><div><h2>Available pool</h2><p>Expected members not on LOA/no-show and not currently assigned to Main or Sub.</p></div><span className="pill">{available.length} AVAILABLE</span></div>
        <div className="job-breakdown">{jobBreakdown.map(([job, count]) => <span className="job-breakdown-item" key={job}><strong>{job}</strong><small>{count}</small></span>)}</div>
        <div className="available-pool">{available.map((member) => <span key={member.id} className="pill">{member.ign} · {jobMap[member.job_code] || member.job_code || '—'}</span>)}</div>
        {!available.length ? <p className="muted" style={{ marginBottom: 0 }}>Everyone eligible is assigned.</p> : null}
      </section>
    </AppShell>
  )
}
