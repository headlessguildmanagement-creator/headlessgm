import { notFound } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { submitApplication, linkApplicationDiscord, postApplicantMessage } from './actions'

function panel(children) {
  return <section style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 20, background: 'var(--panel)' }}>{children}</section>
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

  const { data: authData } = await supabase.auth.getClaims()
  const signedIn = Boolean(authData?.claims?.sub)

  let portal = null
  let portalMode = ''
  if (token) {
    const { data, error } = await supabase.rpc('get_application_portal', { p_guild_slug: slug, p_token: token })
    if (!error && data) { portal = data; portalMode = 'token' }
  } else if (signedIn) {
    const { data, error } = await supabase.rpc('get_my_application', { p_guild_slug: slug })
    if (!error && data) { portal = data; portalMode = 'discord' }
  }

  const app = portal?.application
  const closed = ['rejected', 'joined'].includes(app?.status)

  return (
    <main style={{ minHeight: '100vh', padding: '40px 20px 72px' }}>
      <div style={{ width: 'min(860px, 100%)', margin: '0 auto', display: 'grid', gap: 20 }}>
        <header>
          <p className="eyebrow">{recruitment.guild.name} · Recruitment</p>
          <h1 style={{ fontSize: 42, lineHeight: 1.05, letterSpacing: '-0.03em', margin: '8px 0 12px' }}>{recruitment.recruitment.title || `Apply to ${recruitment.guild.name}`}</h1>
          <p className="lede" style={{ margin: 0 }}>{recruitment.recruitment.intro || 'Submit your application. Your recruitment thread stays attached to this application from review through onboarding.'}</p>
        </header>

        {success ? <div className="notice success">{success}</div> : null}
        {errorMessage ? <div className="notice error">{errorMessage}</div> : null}

        {portal ? (
          <>
            {panel(<>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start', flexWrap: 'wrap' }}>
                <div>
                  <div className="eyebrow">APPLICANT PORTAL</div>
                  <h2 style={{ margin: '8px 0 4px' }}>{app.ign}</h2>
                  <div className="muted">Status: <strong style={{ color: 'var(--text)' }}>{String(app.status).toUpperCase()}</strong></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="muted" style={{ fontSize: 12 }}>Access</div>
                  <div style={{ fontWeight: 700 }}>{portalMode === 'discord' ? 'Discord identity' : 'Private link'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{app.discord_linked ? (app.discord_display_name || 'Discord connected') : 'Discord not connected'}</div>
                </div>
              </div>

              {!app.discord_linked && !closed ? (
                <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
                  <h3 style={{ marginTop: 0 }}>Connect Discord</h3>
                  <p className="muted">After this one-time connection you can return to this portal by signing in with Discord. If accepted, the same Discord identity carries into your roster member record.</p>
                  {signedIn ? (
                    <form action={linkApplicationDiscord}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="token" value={token} />
                      <button type="submit" className="button">Finish Discord connection</button>
                    </form>
                  ) : (
                    <a href={`/login?next=${encodeURIComponent(`/${slug}/apply?token=${token}`)}`} className="button" style={{ display: 'inline-block', textDecoration: 'none' }}>Continue with Discord</a>
                  )}
                </div>
              ) : null}
            </>)}

            {panel(<>
              <h2 style={{ marginTop: 0 }}>Application</h2>
              <div className="form-grid">
                <div><span className="muted">IGN</span><div style={{ fontWeight: 700 }}>{app.ign}</div></div>
                <div><span className="muted">Class</span><div style={{ fontWeight: 700 }}>{app.job_code || '—'}</div></div>
                <div><span className="muted">Previous guild</span><div style={{ fontWeight: 700 }}>{app.previous_guild || '—'}</div></div>
                <div><span className="muted">Submitted</span><div style={{ fontWeight: 700 }}>{new Date(app.submitted_at).toLocaleString()}</div></div>
              </div>
              {app.decision_note ? <p style={{ marginBottom: 0, paddingTop: 12, borderTop: '1px solid var(--line)' }}>{app.decision_note}</p> : null}
            </>)}

            {panel(<>
              <h2 style={{ marginTop: 0 }}>Conversation</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {(portal.messages || []).map((message) => (
                  <div key={message.id} style={{ padding: 12, borderRadius: 10, background: 'var(--panel2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }} className="muted">
                      <strong style={{ color: 'var(--text)' }}>{message.sender_name || message.sender_type}</strong>
                      <span style={{ fontSize: 12 }}>{new Date(message.created_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{message.message}</p>
                  </div>
                ))}
              </div>

              {!closed ? (
                <form action={postApplicantMessage} style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                  <input type="hidden" name="slug" value={slug} />
                  {portalMode === 'token' ? <input type="hidden" name="token" value={token} /> : null}
                  <textarea name="message" required maxLength={3000} rows={4} placeholder="Reply to the officers…" />
                  <button type="submit" className="button" style={{ justifySelf: 'start' }}>Send message</button>
                </form>
              ) : <p className="muted" style={{ marginBottom: 0 }}>This recruitment conversation is closed.</p>}
            </>)}

            {portalMode === 'token' ? <p className="muted" style={{ fontSize: 13 }}>Keep this private URL as a backup until Discord is connected. After connecting, you can remove the token from the URL and use your Discord login instead.</p> : <p className="muted" style={{ fontSize: 13 }}>This portal is being resolved from your connected Discord identity. No private token is needed on this device while signed in.</p>}
          </>
        ) : (
          recruitment.recruitment.is_open ? panel(<>
            {signedIn ? <div className="notice" style={{ marginBottom: 16 }}>No application for this guild is linked to your current Discord account yet. You can submit a new application below, or open an existing private application link once to connect it.</div> : null}
            <form action={submitApplication} style={{ display: 'grid', gap: 16 }}>
              <input type="hidden" name="slug" value={slug} />
              <label className="field">In-game name<input name="ign" required maxLength={80} /></label>
              <label className="field">Class<select name="job_code" defaultValue=""><option value="">Select class</option>{(recruitment.jobs || []).map((job) => <option key={job.code} value={job.code}>{job.label}</option>)}</select></label>
              <label className="field">Email <span className="muted">optional backup contact</span><input type="email" name="email" maxLength={320} /></label>
              <label className="field">Previous guild<input name="previous_guild" maxLength={120} /></label>
              <label className="field">Why do you want to join?<textarea name="why_join" rows={4} maxLength={2000} /></label>
              <label className="field">Event availability<textarea name="availability" rows={3} maxLength={1000} /></label>
              <label className="field">Anything else?<textarea name="notes" rows={3} maxLength={1500} /></label>
              <button type="submit" className="button">Submit application</button>
            </form>
          </>) : panel(<><h2 style={{ marginTop: 0 }}>Recruitment is currently closed</h2><p className="muted" style={{ marginBottom: 0 }}>Check back later for openings.</p></>)
        )}
      </div>
    </main>
  )
}
