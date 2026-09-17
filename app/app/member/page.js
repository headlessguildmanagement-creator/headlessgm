import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { fileMemberLoa, cancelMemberLoa } from './actions'

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
  if (error) {
    return <main style={{ minHeight:'100vh',padding:'40px 20px' }}><div style={{ width:'min(760px,100%)',margin:'0 auto' }}><h1>Member portal</h1><p>{error.message}</p></div></main>
  }

  return (
    <main style={{ minHeight:'100vh',padding:'36px 20px 64px' }}>
      <div style={{ width:'min(920px,100%)',margin:'0 auto',display:'grid',gap:18 }}>
        <header><p className="eyebrow">{portal.guild.name} · Member Portal</p><h1 style={{ fontSize:44,margin:'6px 0' }}>{portal.member.ign}</h1><p style={{ color:'#8b96a5',margin:0 }}>Your Discord identity is linked. LOA, lineup and published rewards below are scoped to you.</p></header>
        {success ? <div style={{ padding:12,borderRadius:10,background:'#14301f',border:'1px solid #25633a' }}>{success}</div> : null}
        {errorMessage ? <div style={{ padding:12,borderRadius:10,background:'#381b1b',border:'1px solid #743333' }}>{errorMessage}</div> : null}

        {(portal.events || []).map((event) => {
          const closed = ['completed','cancelled'].includes(event.status)
          const pastDeadline = new Date() > new Date(event.loa_deadline)
          return <section key={event.id} style={{ border:'1px solid #2b313c',borderRadius:16,padding:20,background:'#11151a' }}>
            <div style={{ display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap' }}>
              <div><div style={{ color:'#8b96a5',fontSize:12 }}>{String(event.event_type).replaceAll('_',' ').toUpperCase()}</div><h2 style={{ margin:'5px 0 4px' }}>{event.name}</h2><div style={{ color:'#8b96a5' }}>{new Date(event.starts_at).toLocaleString()}</div></div>
              <strong>{String(event.status).toUpperCase()}</strong>
            </div>

            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10,marginTop:16 }}>
              <div style={{ padding:12,borderRadius:10,background:'#171c23' }}><div style={{ color:'#8b96a5',fontSize:12 }}>AVAILABILITY</div><strong>{event.loa ? 'LOA / unavailable' : 'Expected to attend'}</strong></div>
              <div style={{ padding:12,borderRadius:10,background:'#171c23' }}><div style={{ color:'#8b96a5',fontSize:12 }}>LINEUP</div><strong>{event.lineup ? `${String(event.lineup.raid_code).toUpperCase()} · Party ${event.lineup.party_no} · Slot ${event.lineup.slot_no}` : 'Not assigned yet'}</strong></div>
              <div style={{ padding:12,borderRadius:10,background:'#171c23' }}><div style={{ color:'#8b96a5',fontSize:12 }}>REWARDS</div><strong>{event.rewards?.length ? event.rewards.map((r)=>`${r.category} ×${r.quantity}`).join(', ') : 'No published allocation'}</strong></div>
            </div>

            {!closed && !pastDeadline ? <div style={{ marginTop:16,paddingTop:16,borderTop:'1px solid #252b34' }}>
              {event.loa ? <form action={cancelMemberLoa}><input type="hidden" name="guild_id" value={portal.guild.id}/><input type="hidden" name="event_id" value={event.id}/><p style={{ color:'#8b96a5' }}>LOA filed{event.loa.reason ? `: ${event.loa.reason}` : ''}</p><button type="submit">Cancel LOA</button></form> : <form action={fileMemberLoa} style={{ display:'flex',gap:8,flexWrap:'wrap' }}><input type="hidden" name="guild_id" value={portal.guild.id}/><input type="hidden" name="event_id" value={event.id}/><input name="reason" maxLength={500} placeholder="LOA reason (optional)" style={{ padding:10,borderRadius:10,minWidth:260 }}/><button type="submit">File LOA</button></form>}
              <div style={{ color:'#7f8a98',fontSize:12,marginTop:8 }}>LOA cutoff: {new Date(event.loa_deadline).toLocaleString()}</div>
            </div> : null}
          </section>
        })}
        {!portal.events?.length ? <section style={{ border:'1px dashed #303742',borderRadius:14,padding:24,color:'#8b96a5' }}>No guild events are available yet.</section> : null}
      </div>
    </main>
  )
}
