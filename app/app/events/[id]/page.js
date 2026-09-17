import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import { updateEventStatus, fileMyLoa, cancelMyLoa, assignLineupMember } from '../actions'

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
  const { data: guild } = await supabase.from('guilds').select('id,name,owner_user_id,game_preset_id').eq('id', event.guild_id).single()
  const membership = await supabase.from('guild_users').select('role').eq('guild_id', event.guild_id).eq('user_id', userId).maybeSingle()
  const canManage = guild?.owner_user_id === userId || ['owner','officer'].includes(membership.data?.role)

  const [{ data: members }, { data: loas }, { data: slots }, { data: jobs }] = await Promise.all([
    supabase.from('guild_members').select('id,ign,job_code,status,discord_user_id').eq('guild_id', event.guild_id).eq('status', 'active').order('ign'),
    supabase.from('event_loas').select('id,guild_member_id,reason,filed_at,cancelled_at').eq('event_id', id),
    supabase.from('event_lineup_slots').select('*').eq('event_id', id).order('raid_code').order('party_no').order('slot_no'),
    supabase.from('game_jobs').select('code,label').eq('game_preset_id', guild.game_preset_id),
  ])

  const jobMap = Object.fromEntries((jobs || []).map((job) => [job.code, job.label]))
  const activeLoas = (loas || []).filter((loa) => !loa.cancelled_at)
  const loaIds = new Set(activeLoas.map((loa) => loa.guild_member_id))
  const expected = (members || []).filter((member) => !loaIds.has(member.id))
  const assignedIds = new Set((slots || []).filter((slot) => slot.guild_member_id).map((slot) => slot.guild_member_id))
  const available = expected.filter((member) => !assignedIds.has(member.id))

  const discordIdentity = (await supabase.auth.getUser()).data?.user?.identities?.find((identity) => identity.provider === 'discord')
  const myDiscordId = discordIdentity?.identity_id || discordIdentity?.id || discordIdentity?.identity_data?.sub || null
  const myMember = myDiscordId ? (members || []).find((member) => member.discord_user_id === myDiscordId) : null
  const myLoa = myMember ? activeLoas.find((loa) => loa.guild_member_id === myMember.id) : null

  function slotFor(raid, party, slotNo) {
    return (slots || []).find((slot) => slot.raid_code === raid && slot.party_no === party && slot.slot_no === slotNo)
  }

  return (
    <main style={{ minHeight: '100vh', padding: '30px 20px 64px' }}>
      <div style={{ width: 'min(1240px,100%)', margin: '0 auto', display: 'grid', gap: 18 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'end', flexWrap: 'wrap' }}>
          <div><p className="eyebrow">{guild.name} · Event</p><h1 style={{ fontSize: 44, margin: '6px 0' }}>{event.name}</h1><p style={{ margin: 0, color: '#8b96a5' }}>{new Date(event.starts_at).toLocaleString()} · status {event.status.toUpperCase()}</p></div>
          <Link href="/app/events" style={{ color: 'inherit', textDecoration: 'none', border: '1px solid #303742', borderRadius: 10, padding: '10px 14px' }}>All events</Link>
        </header>

        {success ? <div style={{ padding: 12, borderRadius: 10, background: '#14301f', border: '1px solid #25633a' }}>{success}</div> : null}
        {errorMessage ? <div style={{ padding: 12, borderRadius: 10, background: '#381b1b', border: '1px solid #743333' }}>{errorMessage}</div> : null}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
          {[['ACTIVE ROSTER', members?.length || 0], ['LOA', activeLoas.length], ['EXPECTED', expected.length], ['UNASSIGNED', available.length]].map(([label,value]) => <div key={label} style={{ border: '1px solid #2b313c', borderRadius: 14, padding: 16, background: '#11151a' }}><div style={{ color: '#8b96a5', fontSize: 12 }}>{label}</div><div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{value}</div></div>)}
        </section>

        {myMember ? <section style={{ border: '1px solid #2b313c', borderRadius: 14, padding: 18, background: '#11151a' }}>
          <h2 style={{ marginTop: 0 }}>My availability</h2>
          <p style={{ color: '#8b96a5' }}>Everyone is expected unless they file LOA. Cutoff: {new Date(event.loa_deadline).toLocaleString()}.</p>
          {myLoa ? <form action={cancelMyLoa}><input type="hidden" name="event_id" value={event.id} /><p><strong>LOA filed.</strong> {myLoa.reason || ''}</p><button type="submit">Cancel my LOA</button></form> : <form action={fileMyLoa} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input type="hidden" name="event_id" value={event.id} /><input name="reason" maxLength={500} placeholder="Reason (optional)" style={{ padding: 10, borderRadius: 10, minWidth: 260 }} /><button type="submit">File LOA</button></form>}
        </section> : null}

        {canManage ? <section style={{ border: '1px solid #2b313c', borderRadius: 14, padding: 18, background: '#11151a' }}>
          <h2 style={{ marginTop: 0 }}>Event lifecycle</h2>
          <form action={updateEventStatus} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input type="hidden" name="event_id" value={event.id} /><input type="hidden" name="guild_id" value={event.guild_id} />{['upcoming','loa_open','lineup','live','auction','completed','cancelled'].map((status) => <button key={status} type="submit" name="status" value={status} disabled={event.status === status}>{status.replaceAll('_',' ')}</button>)}</form>
        </section> : null}

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ border: '1px solid #2b313c', borderRadius: 14, padding: 18, background: '#11151a' }}><h2 style={{ marginTop: 0 }}>LOA</h2>{activeLoas.map((loa) => { const member=(members||[]).find((m)=>m.id===loa.guild_member_id); return <div key={loa.id} style={{ padding: '8px 0', borderBottom: '1px solid #242a32' }}><strong>{member?.ign || 'Unknown'}</strong><span style={{ color:'#8b96a5' }}> · {loa.reason || 'No reason'}</span></div> })}{!activeLoas.length ? <p style={{ color:'#8b96a5' }}>No LOAs filed.</p> : null}</div>
          <div style={{ border: '1px solid #2b313c', borderRadius: 14, padding: 18, background: '#11151a' }}><h2 style={{ marginTop: 0 }}>Available pool</h2><div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{available.map((member)=><span key={member.id} style={{ border:'1px solid #303742', borderRadius:999, padding:'6px 9px' }}>{member.ign} · {jobMap[member.job_code] || member.job_code || '—'}</span>)}</div>{!available.length ? <p style={{ color:'#8b96a5' }}>Everyone expected is assigned.</p> : null}</div>
        </section>

        {canManage ? ['main','sub'].map((raid) => <section key={raid} style={{ border: '1px solid #2b313c', borderRadius: 14, padding: 18, background: '#11151a' }}><h2 style={{ marginTop: 0 }}>{raid === 'main' ? 'Main Raid' : 'Sub Raid'}</h2><div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10 }}>{Array.from({length:8},(_,partyIndex)=>partyIndex+1).map((party)=><div key={party} style={{ border:'1px solid #2a3038', borderRadius:12, padding:12 }}><h3 style={{ marginTop:0 }}>Party {party}</h3><div style={{ display:'grid', gap:8 }}>{Array.from({length:5},(_,slotIndex)=>slotIndex+1).map((slotNo)=>{ const slot=slotFor(raid,party,slotNo); const member=(members||[]).find((m)=>m.id===slot?.guild_member_id); return <form key={slotNo} action={assignLineupMember} style={{ display:'grid', gap:5 }}><input type="hidden" name="event_id" value={event.id}/><input type="hidden" name="guild_id" value={event.guild_id}/><input type="hidden" name="raid_code" value={raid}/><input type="hidden" name="party_no" value={party}/><input type="hidden" name="slot_no" value={slotNo}/><select name="guild_member_id" defaultValue={member?.id || ''} style={{ width:'100%', padding:7, borderRadius:8 }}><option value="">Slot {slotNo} · empty</option>{expected.map((candidate)=><option key={candidate.id} value={candidate.id}>{candidate.ign} · {jobMap[candidate.job_code] || candidate.job_code || '—'}</option>)}</select><button type="submit" style={{ fontSize:12 }}>Save</button></form> })}</div></div>)}</div></section>) : null}
      </div>
    </main>
  )
}
