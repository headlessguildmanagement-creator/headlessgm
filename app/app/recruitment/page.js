import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { sendOfficerApplicationMessage, setApplicationStatus, confirmApplicantJoined } from './actions'

export default async function RecruitmentPage({ searchParams }) {
  const query = await searchParams
  const selectedId = String(query?.application || '')
  const success = String(query?.success || '')
  const errorMessage = String(query?.error || '')
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const { data: guildRows } = await supabase.from('guilds').select('id,name,slug,game_preset_id,owner_user_id').order('created_at').limit(1)
  const guild = guildRows?.[0]
  if (!guild) redirect('/app/onboarding')

  const manager = guild.owner_user_id === userId || Boolean((await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).in('role', ['owner','officer']).maybeSingle()).data)
  if (!manager) redirect('/app')

  const [{ data: applications }, { data: jobs }, { data: settings }] = await Promise.all([
    supabase.from('guild_applications').select('*').eq('guild_id', guild.id).order('submitted_at', { ascending: false }),
    supabase.from('game_jobs').select('code,label').eq('game_preset_id', guild.game_preset_id).eq('is_active', true).order('sort_order'),
    supabase.from('recruitment_settings').select('*').eq('guild_id', guild.id).maybeSingle(),
  ])

  const selected = (applications || []).find((item) => item.id === selectedId) || applications?.[0] || null
  let messages = []
  if (selected) {
    const result = await supabase.from('application_messages').select('*').eq('application_id', selected.id).order('created_at')
    messages = result.data || []
  }

  return (
    <main style={{ minHeight: '100vh', padding: '32px 20px 64px' }}>
      <div style={{ width: 'min(1180px,100%)', margin: '0 auto', display: 'grid', gap: 20 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', alignItems: 'end' }}>
          <div>
            <p className="eyebrow">{guild.name} · Recruitment</p>
            <h1 style={{ fontSize: 44, margin: '6px 0 8px' }}>Applicants</h1>
            <p style={{ color: '#8b96a5', margin: 0 }}>Public page: <strong>/{guild.slug}/apply</strong> · Recruitment {settings?.is_open ? 'open' : 'closed'}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href={`/${guild.slug}/apply`} style={{ padding: '10px 14px', border: '1px solid #303742', borderRadius: 10, color: 'inherit', textDecoration: 'none' }}>View public apply page</Link>
            <Link href="/app" style={{ padding: '10px 14px', border: '1px solid #303742', borderRadius: 10, color: 'inherit', textDecoration: 'none' }}>Dashboard</Link>
          </div>
        </header>

        {success ? <div style={{ padding: 12, borderRadius: 10, background: '#14301f', border: '1px solid #25633a' }}>{success}</div> : null}
        {errorMessage ? <div style={{ padding: 12, borderRadius: 10, background: '#381b1b', border: '1px solid #743333' }}>{errorMessage}</div> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          <section style={{ border: '1px solid #2b313c', borderRadius: 16, background: '#11151a', overflow: 'hidden' }}>
            <div style={{ padding: 14, borderBottom: '1px solid #252b34', fontWeight: 800 }}>{applications?.length || 0} applications</div>
            <div style={{ display: 'grid' }}>
              {(applications || []).map((app) => (
                <Link key={app.id} href={`/app/recruitment?application=${app.id}`} style={{ color: 'inherit', textDecoration: 'none', padding: 14, borderBottom: '1px solid #20262e', background: selected?.id === app.id ? '#1b222b' : 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><strong>{app.ign}</strong><span style={{ fontSize: 12, color: '#9ca7b5' }}>{app.status.toUpperCase()}</span></div>
                  <div style={{ color: '#7f8a98', fontSize: 13, marginTop: 4 }}>{app.discord_display_name || (app.discord_user_id ? 'Discord linked' : 'Discord not linked')}</div>
                </Link>
              ))}
              {!applications?.length ? <div style={{ padding: 20, color: '#7f8a98' }}>No applications yet.</div> : null}
            </div>
          </section>

          {selected ? (
            <div style={{ display: 'grid', gap: 16 }}>
              <section style={{ border: '1px solid #2b313c', borderRadius: 16, padding: 20, background: '#11151a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div><div style={{ color: '#8b96a5', fontSize: 12 }}>APPLICANT</div><h2 style={{ fontSize: 30, margin: '4px 0' }}>{selected.ign}</h2><div style={{ color: '#8b96a5' }}>{selected.job_code || 'No class selected'} · {selected.previous_guild || 'No previous guild'}</div></div>
                  <div style={{ textAlign: 'right' }}><div style={{ color: '#8b96a5', fontSize: 12 }}>STATUS</div><strong>{selected.status.toUpperCase()}</strong><div style={{ color: '#8b96a5', fontSize: 13, marginTop: 4 }}>{selected.discord_user_id ? `Discord: ${selected.discord_display_name || 'linked'}` : 'Discord not linked'}</div></div>
                </div>
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #252b34', display: 'grid', gap: 8 }}>
                  <div><span style={{ color: '#8b96a5' }}>Email:</span> {selected.email || '—'}</div>
                  {Object.entries(selected.answers || {}).map(([key, value]) => value ? <div key={key}><span style={{ color: '#8b96a5' }}>{key.replaceAll('_',' ')}:</span> {String(value)}</div> : null)}
                </div>

                {!['joined','rejected'].includes(selected.status) ? (
                  <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
                    <form action={setApplicationStatus} style={{ display: 'grid', gap: 8 }}>
                      <input type="hidden" name="application_id" value={selected.id} />
                      <textarea name="note" rows={2} maxLength={1000} placeholder="Decision/review note (optional)" style={{ padding: 10, borderRadius: 10 }} />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button name="status" value="pending" type="submit">Mark pending</button>
                        <button name="status" value="approved" type="submit">Approve</button>
                        <button name="status" value="rejected" type="submit">Reject</button>
                      </div>
                    </form>
                  </div>
                ) : null}

                {selected.status === 'approved' ? (
                  <form action={confirmApplicantJoined} style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid #252b34', display: 'grid', gap: 10 }}>
                    <h3 style={{ margin: 0 }}>Confirm in-game join</h3>
                    <p style={{ color: '#8b96a5', margin: 0 }}>This creates the active roster member and carries the applicant's Discord identity automatically.</p>
                    <input type="hidden" name="application_id" value={selected.id} />
                    <input name="ign" defaultValue={selected.ign} required maxLength={80} placeholder="Final IGN" style={{ padding: 10, borderRadius: 10 }} />
                    <select name="job_code" defaultValue={selected.job_code || ''} style={{ padding: 10, borderRadius: 10 }}><option value="">Select class</option>{(jobs || []).map((job) => <option key={job.code} value={job.code}>{job.label}</option>)}</select>
                    <input name="guild_role" maxLength={80} placeholder="Guild role (optional)" style={{ padding: 10, borderRadius: 10 }} />
                    <button type="submit" style={{ justifySelf: 'start' }}>Confirm joined → add to roster</button>
                  </form>
                ) : null}
              </section>

              <section style={{ border: '1px solid #2b313c', borderRadius: 16, padding: 20, background: '#11151a' }}>
                <h2 style={{ marginTop: 0 }}>Applicant conversation</h2>
                <div style={{ display: 'grid', gap: 10 }}>
                  {messages.map((message) => <div key={message.id} style={{ padding: 12, borderRadius: 10, background: '#171c23' }}><div style={{ color: '#8b96a5', fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong style={{ color: '#c7d0dc' }}>{message.sender_name || message.sender_type}</strong><span>{new Date(message.created_at).toLocaleString()}</span></div><p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{message.message}</p></div>)}
                </div>
                {!['joined','rejected'].includes(selected.status) ? <form action={sendOfficerApplicationMessage} style={{ display: 'grid', gap: 10, marginTop: 14 }}><input type="hidden" name="application_id" value={selected.id} /><textarea name="message" required rows={4} maxLength={3000} placeholder="Message applicant…" style={{ padding: 10, borderRadius: 10 }} /><button type="submit" style={{ justifySelf: 'start' }}>Send message</button></form> : <p style={{ color: '#8b96a5' }}>Conversation closed.</p>}
              </section>
            </div>
          ) : <section style={{ border: '1px dashed #303742', borderRadius: 16, padding: 30, color: '#8b96a5' }}>Select an application.</section>}
        </div>
      </div>
    </main>
  )
}
