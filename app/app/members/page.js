import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import AppShell from '../../../components/app-shell'
import { addMember, updateMemberStatus } from './actions'

export default async function MembersPage({ searchParams }) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  if (authError || !authData?.claims?.sub) redirect('/login')

  const { data: guildRows } = await supabase.from('guilds').select('id, name, plan_code, game_preset_id').order('created_at').limit(1)
  const guild = guildRows?.[0]
  if (!guild) redirect('/app/onboarding')

  const [{ data: plan }, { data: preset }, { data: members }, { data: jobs }] = await Promise.all([
    supabase.from('plans').select('display_name, active_member_limit').eq('code', guild.plan_code).single(),
    supabase.from('game_presets').select('name, max_active_members').eq('id', guild.game_preset_id).single(),
    supabase.from('guild_members').select('id, ign, job_code, guild_role, status, is_officer, discord_user_id, created_at').eq('guild_id', guild.id).order('status').order('ign'),
    supabase.from('game_jobs').select('code, label, category, sort_order').eq('game_preset_id', guild.game_preset_id).eq('is_active', true).order('sort_order'),
  ])

  const roster = members || []
  const jobOptions = jobs || []
  const jobLabels = new Map(jobOptions.map((job) => [job.code, job.label]))
  const activeCount = roster.filter((member) => member.status === 'active').length
  const pendingCount = roster.filter((member) => member.status === 'pending').length
  const linkedCount = roster.filter((member) => member.discord_user_id).length
  const limit = plan?.active_member_limit ?? preset?.max_active_members ?? 80
  const params = await searchParams
  const error = params?.error ? String(params.error) : ''
  const success = params?.success ? String(params.success) : ''

  return (
    <AppShell guildName={guild.name} eyebrow="ROSTER" title="Members" activeHref="/app/members">
      {error ? <div className="notice error">{error}</div> : null}
      {success ? <div className="notice success">{success}</div> : null}

      <section className="stats">
        <div className="stat"><label>ACTIVE</label><strong>{activeCount} / {limit}</strong><small>{plan?.display_name || 'BETA'} plan</small></div>
        <div className="stat"><label>PENDING</label><strong>{pendingCount}</strong><small>Recruit / onboarding state</small></div>
        <div className="stat"><label>DISCORD LINKED</label><strong>{linkedCount}</strong><small>Stable provider IDs</small></div>
        <div className="stat"><label>FORMER / INACTIVE</label><strong>{roster.length - activeCount - pendingCount}</strong><small>History preserved</small></div>
      </section>

      <section className="panel">
        <div className="panel-pad section-head"><div><h2>Guild roster</h2><p>IGN is editable identity data. The member record itself persists across IGN/job/status changes.</p></div></div>
        <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
          <table>
            <thead><tr><th>IGN</th><th>Class</th><th>Guild role</th><th>Discord</th><th>Status</th><th>Update</th></tr></thead>
            <tbody>
              {roster.map((member) => (
                <tr key={member.id}>
                  <td><strong>{member.ign}</strong></td>
                  <td>{jobLabels.get(member.job_code) || member.job_code || '—'}</td>
                  <td>{member.guild_role || (member.is_officer ? 'Officer' : 'Member')}</td>
                  <td>{member.discord_user_id ? 'Linked' : 'Not linked'}</td>
                  <td><span className="pill">{member.status}</span></td>
                  <td>
                    <form action={updateMemberStatus} style={{ display: 'flex', gap: 7 }}>
                      <input type="hidden" name="guild_id" value={guild.id} />
                      <input type="hidden" name="member_id" value={member.id} />
                      <select name="status" defaultValue={member.status}><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option><option value="left">Left</option></select>
                      <button type="submit" className="button ghost">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!roster.length ? <div className="panel-pad muted">No members yet. Add the first member below or import a roster during setup.</div> : null}
      </section>

      <section className="panel panel-pad">
        <div className="section-head"><div><h2>Add member manually</h2><p>CSV/XML import will use the same canonical fields: IGN, Class, Combat Role, Guild Rank, optional Feather Group and Puppet Order.</p></div></div>
        <form action={addMember} className="form-grid">
          <input type="hidden" name="guild_id" value={guild.id} />
          <label className="field"><span>IGN</span><input name="ign" required maxLength={80} placeholder="ROOC IGN" /></label>
          <label className="field"><span>Class</span><select name="job_code" defaultValue=""><option value="">Select class</option>{jobOptions.map((job) => <option key={job.code} value={job.code}>{job.label}</option>)}</select></label>
          <label className="field"><span>Guild rank</span><input name="guild_role" placeholder="Member / Officer / Commander / VGL / GL" /></label>
          <label className="field"><span>Status</span><select name="status" defaultValue="active"><option value="active">Active</option><option value="pending">Pending</option></select></label>
          <div className="full"><button type="submit" className="button">Add member</button></div>
        </form>
      </section>
    </AppShell>
  )
}
