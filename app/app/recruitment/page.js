import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { resolveGuild, withGuild } from '../../../lib/guild-context'
import AppShell from '../../../components/app-shell'
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

  const guild = await resolveGuild(supabase, query?.guild, 'id,name,slug,game_preset_id,owner_user_id')
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
  if (selected) messages = (await supabase.from('application_messages').select('*').eq('application_id', selected.id).order('created_at')).data || []

  return (
    <AppShell guildName={guild.name} guildSlug={guild.slug} eyebrow="RECRUITMENT" title="Applicants" activeHref="/app/recruitment" actions={<Link href={`/${guild.slug}/apply`} className="button ghost">Public apply page</Link>}>
      {success ? <div className="notice success">{success}</div> : null}
      {errorMessage ? <div className="notice error">{errorMessage}</div> : null}

      <section className="stats">
        <div className="stat"><label>APPLICATIONS</label><strong>{applications?.length || 0}</strong><small>Total retained history</small></div>
        <div className="stat"><label>OPEN</label><strong>{(applications || []).filter((a) => !['joined','rejected'].includes(a.status)).length}</strong><small>Needs officer attention</small></div>
        <div className="stat"><label>DISCORD LINKED</label><strong>{(applications || []).filter((a) => a.discord_user_id).length}</strong><small>Identity ready for onboarding</small></div>
        <div className="stat"><label>PUBLIC RECRUITMENT</label><strong>{settings?.is_open ? 'OPEN' : 'CLOSED'}</strong><small>/{guild.slug}/apply</small></div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,340px) minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
        <section className="panel">
          <div className="panel-pad section-head"><div><h2>Application queue</h2><p>Recruitment conversation stays attached to the application.</p></div></div>
          <div className="ops-list">
            {(applications || []).map((app) => <Link key={app.id} href={`${withGuild('/app/recruitment', guild.slug)}?application=${app.id}`} className="ops-row" style={{ gridTemplateColumns: '1fr auto', background: selected?.id === app.id ? 'var(--panel2)' : undefined }}><div><strong>{app.ign}</strong><p>{app.discord_display_name || (app.discord_user_id ? 'Discord linked' : 'Discord not linked')}</p></div><span>{app.status.toUpperCase()}</span></Link>)}
            {!applications?.length ? <div className="panel-pad muted">No applications yet.</div> : null}
          </div>
        </section>

        {selected ? <div style={{ display: 'grid', gap: 18 }}>
          <section className="panel panel-pad">
            <div className="section-head"><div><p className="eyebrow">APPLICANT</p><h2 style={{ fontSize: 28 }}>{selected.ign}</h2><p>{selected.job_code || 'No class'} · {selected.previous_guild || 'No previous guild'}</p></div><span className="pill">{selected.status.toUpperCase()}</span></div>
            <div className="table-wrap"><table><tbody><tr><th>Email</th><td>{selected.email || '—'}</td></tr><tr><th>Discord</th><td>{selected.discord_user_id ? selected.discord_display_name || 'Linked' : 'Not linked'}</td></tr>{Object.entries(selected.answers || {}).map(([key,value]) => value ? <tr key={key}><th>{key.replaceAll('_',' ')}</th><td>{String(value)}</td></tr> : null)}</tbody></table></div>

            {!['joined','rejected'].includes(selected.status) ? <form action={setApplicationStatus} style={{ display: 'grid', gap: 10, marginTop: 16 }}><input type="hidden" name="application_id" value={selected.id} /><textarea name="note" rows={2} maxLength={1000} placeholder="Decision/review note (optional)" /><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="button ghost" name="status" value="pending" type="submit">Mark pending</button><button className="button" name="status" value="approved" type="submit">Approve</button><button className="button danger" name="status" value="rejected" type="submit">Reject</button></div></form> : null}

            {selected.status === 'approved' ? <form action={confirmApplicantJoined} className="form-grid" style={{ marginTop: 20 }}><input type="hidden" name="application_id" value={selected.id} /><div className="full"><h3>Confirm in-game join</h3><p className="muted">Creates the persistent roster member and carries the applicant's Discord identity automatically.</p></div><label className="field"><span>Final IGN</span><input name="ign" defaultValue={selected.ign} required maxLength={80} /></label><label className="field"><span>Class</span><select name="job_code" defaultValue={selected.job_code || ''}><option value="">Select class</option>{(jobs || []).map((job) => <option key={job.code} value={job.code}>{job.label}</option>)}</select></label><label className="field full"><span>Guild role</span><input name="guild_role" maxLength={80} placeholder="Member / Officer / Commander / VGL / GL" /></label><div className="full"><button type="submit" className="button">Confirm joined → add to roster</button></div></form> : null}
          </section>

          <section className="panel panel-pad">
            <div className="section-head"><div><h2>Applicant conversation</h2><p>Private thread between applicant and officers.</p></div></div>
            <div style={{ display: 'grid', gap: 10 }}>{messages.map((message) => <div key={message.id} className="notice"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong>{message.sender_name || message.sender_type}</strong><span className="muted">{new Date(message.created_at).toLocaleString()}</span></div><p style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{message.message}</p></div>)}</div>
            {!['joined','rejected'].includes(selected.status) ? <form action={sendOfficerApplicationMessage} style={{ display: 'grid', gap: 10, marginTop: 14 }}><input type="hidden" name="application_id" value={selected.id} /><textarea name="message" required rows={4} maxLength={3000} placeholder="Message applicant…" /><button type="submit" className="button" style={{ justifySelf: 'start' }}>Send message</button></form> : <p className="muted">Conversation closed.</p>}
          </section>
        </div> : <section className="panel panel-pad muted">Select an application.</section>}
      </div>
    </AppShell>
  )
}
