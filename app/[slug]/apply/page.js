import { notFound } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { submitApplication, linkApplicationDiscord, postApplicantMessage } from './actions'

function panel(children) {
  return <section style={{ border: '1px solid #2b313c', borderRadius: 16, padding: 20, background: '#11151a' }}>{children}</section>
}

export default async function ApplyPage({ params, searchParams }) {
  const { slug } = await params
  const query = await searchParams
  const token = String(query?.token || '')
  const success = String(query?.success || '')
  const errorMessage = String(query?.error || '')
  const supabase = await createClient()

  const { data: recruitment, error: recruitmentError } = await supabase.rpc('get_public_recruitment_page', { p_guild_slug: slug })
  if (recruitmentError || !recruitment?.guild) notFound()

  let portal = null
  if (token) {
    const { data, error } = await supabase.rpc('get_application_portal', { p_guild_slug: slug, p_token: token })
    if (!error) portal = data
  }

  const { data: authData } = await supabase.auth.getClaims()
  const signedIn = Boolean(authData?.claims?.sub)
  const app = portal?.application
  const closed = ['rejected', 'joined'].includes(app?.status)

  return (
    <main style={{ minHeight: '100vh', padding: '40px 20px 72px' }}>
      <div style={{ width: 'min(860px, 100%)', margin: '0 auto', display: 'grid', gap: 20 }}>
        <header>
          <p className="eyebrow">{recruitment.guild.name} · Recruitment</p>
          <h1 style={{ fontSize: 48, lineHeight: 1.05, letterSpacing: '-0.04em', margin: '8px 0 12px' }}>{recruitment.recruitment.title || `Apply to ${recruitment.guild.name}`}</h1>
          <p className="lede" style={{ margin: 0 }}>{recruitment.recruitment.intro || 'Submit your application. Your recruitment thread stays attached to this application from review through onboarding.'}</p>
        </header>

        {success ? <div style={{ padding: 14, borderRadius: 12, background: '#14301f', border: '1px solid #25633a' }}>{success}</div> : null}
        {errorMessage ? <div style={{ padding: 14, borderRadius: 12, background: '#381b1b', border: '1px solid #743333' }}>{errorMessage}</div> : null}

        {token && portal ? (
          <>
            {panel(<>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: '#8b96a5', fontSize: 12, fontWeight: 800, letterSpacing: '.12em' }}>PRIVATE APPLICATION PORTAL</div>
                  <h2 style={{ margin: '8px 0 4px' }}>{app.ign}</h2>
                  <div style={{ color: '#8b96a5' }}>Status: <strong style={{ color: '#fff' }}>{String(app.status).toUpperCase()}</strong></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#8b96a5', fontSize: 12 }}>Discord</div>
                  <div style={{ fontWeight: 700 }}>{app.discord_linked ? (app.discord_display_name || 'Connected') : 'Not connected'}</div>
                </div>
              </div>

              {!app.discord_linked && !closed ? (
                <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #252b34' }}>
                  <h3 style={{ marginTop: 0 }}>Connect Discord</h3>
                  <p style={{ color: '#8b96a5' }}>This keeps your Discord identity attached to the application and carries it into the roster automatically if you join.</p>
                  {signedIn ? (
                    <form action={linkApplicationDiscord}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="token" value={token} />
                      <button type="submit" style={{ padding: '12px 16px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>Finish Discord connection</button>
                    </form>
                  ) : (
                    <a href={`/login?next=${encodeURIComponent(`/${slug}/apply?token=${token}`)}`} style={{ display: 'inline-block', padding: '12px 16px', borderRadius: 10, background: '#fff', color: '#111', textDecoration: 'none', fontWeight: 800 }}>Continue with Discord</a>
                  )}
                </div>
              ) : null}
            </>)}

            {panel(<>
              <h2 style={{ marginTop: 0 }}>Application</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
                <div><span style={{ color: '#8b96a5' }}>IGN</span><div style={{ fontWeight: 700 }}>{app.ign}</div></div>
                <div><span style={{ color: '#8b96a5' }}>Class</span><div style={{ fontWeight: 700 }}>{app.job_code || '—'}</div></div>
                <div><span style={{ color: '#8b96a5' }}>Previous guild</span><div style={{ fontWeight: 700 }}>{app.previous_guild || '—'}</div></div>
                <div><span style={{ color: '#8b96a5' }}>Submitted</span><div style={{ fontWeight: 700 }}>{new Date(app.submitted_at).toLocaleString()}</div></div>
              </div>
              {app.decision_note ? <p style={{ marginBottom: 0, paddingTop: 12, borderTop: '1px solid #252b34' }}>{app.decision_note}</p> : null}
            </>)}

            {panel(<>
              <h2 style={{ marginTop: 0 }}>Conversation</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {(portal.messages || []).map((message) => (
                  <div key={message.id} style={{ padding: 12, borderRadius: 10, background: '#171c23' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#8b96a5', fontSize: 12 }}>
                      <strong style={{ color: '#c7d0dc' }}>{message.sender_name || message.sender_type}</strong>
                      <span>{new Date(message.created_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{message.message}</p>
                  </div>
                ))}
              </div>

              {!closed ? (
                <form action={postApplicantMessage} style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="token" value={token} />
                  <textarea name="message" required maxLength={3000} rows={4} placeholder="Reply to the officers…" style={{ width: '100%', borderRadius: 10, padding: 12, background: '#0d1116', color: '#fff' }} />
                  <button type="submit" style={{ justifySelf: 'start', padding: '10px 14px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>Send message</button>
                </form>
              ) : <p style={{ color: '#8b96a5', marginBottom: 0 }}>This recruitment conversation is closed.</p>}
            </>)}

            <p style={{ color: '#8b96a5', fontSize: 13 }}>Keep this private URL as a backup until onboarding is complete. Once Discord is connected, your identity can carry into the guild roster without linking twice.</p>
          </>
        ) : (
          recruitment.recruitment.is_open ? panel(<form action={submitApplication} style={{ display: 'grid', gap: 16 }}>
            <input type="hidden" name="slug" value={slug} />
            <label style={{ display: 'grid', gap: 6 }}>In-game name<input name="ign" required maxLength={80} style={{ padding: 12, borderRadius: 10 }} /></label>
            <label style={{ display: 'grid', gap: 6 }}>Class<select name="job_code" defaultValue="" style={{ padding: 12, borderRadius: 10 }}><option value="">Select class</option>{(recruitment.jobs || []).map((job) => <option key={job.code} value={job.code}>{job.label}</option>)}</select></label>
            <label style={{ display: 'grid', gap: 6 }}>Email <span style={{ color: '#8b96a5', fontSize: 12 }}>(optional backup contact)</span><input type="email" name="email" maxLength={320} style={{ padding: 12, borderRadius: 10 }} /></label>
            <label style={{ display: 'grid', gap: 6 }}>Previous guild<input name="previous_guild" maxLength={120} style={{ padding: 12, borderRadius: 10 }} /></label>
            <label style={{ display: 'grid', gap: 6 }}>Why do you want to join?<textarea name="why_join" rows={4} maxLength={2000} style={{ padding: 12, borderRadius: 10 }} /></label>
            <label style={{ display: 'grid', gap: 6 }}>Event availability<textarea name="availability" rows={3} maxLength={1000} style={{ padding: 12, borderRadius: 10 }} /></label>
            <label style={{ display: 'grid', gap: 6 }}>Anything else?<textarea name="notes" rows={3} maxLength={1500} style={{ padding: 12, borderRadius: 10 }} /></label>
            <button type="submit" style={{ padding: '13px 18px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>Submit application</button>
          </form>) : panel(<><h2 style={{ marginTop: 0 }}>Recruitment is currently closed</h2><p style={{ color: '#8b96a5', marginBottom: 0 }}>Check back later for openings.</p></>)}
      </div>
    </main>
  )
}
