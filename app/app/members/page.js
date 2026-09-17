import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { resolveGuild } from '../../../lib/guild-context'
import AppShell from '../../../components/app-shell'
import { addMember, importMembers, updateMemberStatus } from './actions'

export default async function MembersPage({ searchParams }) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  if (authError || !authData?.claims?.sub) redirect('/login')

  const params = await searchParams
  const guild = await resolveGuild(supabase, params?.guild, 'id,name,slug,plan_code,game_preset_id')
  if (!guild) redirect('/app/onboarding')

  const [{ data: plan }, { data: preset }, { data: members }, { data: jobs }, { data: rules }] = await Promise.all([
    supabase.from('plans').select('display_name, active_member_limit').eq('code', guild.plan_code).single(),
    supabase.from('game_presets').select('name, max_active_members').eq('id', guild.game_preset_id).single(),
    supabase.from('guild_members').select('id, ign, job_code, combat_role, guild_role, feather_group, puppet_order, status, is_officer, discord_user_id, created_at').eq('guild_id', guild.id).order('status').order('ign'),
    supabase.from('game_jobs').select('code, label, category, sort_order').eq('game_preset_id', guild.game_preset_id).eq('is_active', true).order('sort_order'),
    supabase.from('guild_auction_rules').select('feather_mode,puppet_mode').eq('guild_id', guild.id).maybeSingle(),
  ])

  const roster = members || []
  const jobOptions = jobs || []
  const jobLabels = new Map(jobOptions.map((job) => [job.code, job.label]))
  const activeCount = roster.filter((member) => member.status === 'active').length
  const pendingCount = roster.filter((member) => member.status === 'pending').length
  const linkedCount = roster.filter((member) => member.discord_user_id).length
  const limit = plan?.active_member_limit ?? preset?.max_active_members ?? 80
  const error = params?.error ? String(params.error) : ''
  const success = params?.success ? String(params.success) : ''

  return (
    <AppShell guildName={guild.name} guildSlug={guild.slug} eyebrow="ROSTER" title="Members" activeHref="/app/members">
      {error ? <div className="notice error">{error}</div> : null}
      {success ? <div className="notice success">{success}</div> : null}

      <section className="stats">
        <div className="stat"><label>ACTIVE</label><strong>{activeCount} / {limit}</strong><small>{plan?.display_name || 'FREE'} plan</small></div>
        <div className="stat"><label>PENDING</label><strong>{pendingCount}</strong><small>Recruit / onboarding state</small></div>
        <div className="stat"><label>DISCORD LINKED</label><strong>{linkedCount}</strong><small>Stable provider IDs</small></div>
        <div className="stat"><label>FORMER / INACTIVE</label><strong>{roster.length - activeCount - pendingCount}</strong><small>History preserved</small></div>
      </section>

      <section className="panel panel-pad">
        <div className="section-head"><div><h2>Import roster</h2><p>CSV and XML imports are validated before any member is written. Existing members are never silently replaced.</p></div><span className="pill">CSV / XML</span></div>
        <form action={importMembers} className="form-grid">
          <input type="hidden" name="guild_id" value={guild.id} />
          <label className="field full"><span>Roster file · max 1 MB</span><input type="file" name="roster_file" accept=".csv,.xml,text/csv,application/xml,text/xml" required /></label>
          <div className="full"><button type="submit" className="button">Validate & import roster</button></div>
        </form>
        <div className="notice" style={{ marginTop: 14 }}>
          <strong>Canonical columns</strong>
          <div className="muted" style={{ marginTop: 5 }}>IGN, Class, CombatRole, GuildRank{rules?.feather_mode === 'four_group' ? ', FeatherGroup' : ', FeatherGroup (optional)'}{rules?.puppet_mode === 'round_robin' ? ', PuppetOrder' : ', PuppetOrder (optional)'}</div>
          <div className="muted" style={{ marginTop: 5 }}>FeatherGroup accepts 1–4 or A–D. PuppetOrder must be a unique positive whole number. Class names must match the ROOC preset.</div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-pad section-head"><div><h2>Guild roster</h2><p>IGN, class and roles can change. The HeadlessGM member ID is the permanent identity that history follows.</p></div></div>
        <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
          <table>
            <thead><tr><th>IGN</th><th>Class</th><th>Combat role</th><th>Guild rank</th><th>Feather</th><th>Puppet</th><th>Discord</th><th>Status</th><th>Update</th></tr></thead>
            <tbody>
              {roster.map((member) => (
                <tr key={member.id}>
                  <td><strong>{member.ign}</strong></td>
                  <td>{jobLabels.get(member.job_code) || member.job_code || '—'}</td>
                  <td>{member.combat_role || '—'}</td>
                  <td>{member.guild_role || (member.is_officer ? 'Officer' : 'Member')}</td>
                  <td>{member.feather_group ? `Group ${member.feather_group}` : '—'}</td>
                  <td>{member.puppet_order || '—'}</td>
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
        {!roster.length ? <div className="panel-pad muted">No members yet. Import a roster above or add members manually below.</div> : null}
      </section>

      <section className="panel panel-pad">
        <div className="section-head"><div><h2>Add member manually</h2><p>Manual entry uses the same member model as imports and recruitment onboarding.</p></div></div>
        <form action={addMember} className="form-grid">
          <input type="hidden" name="guild_id" value={guild.id} />
          <label className="field"><span>IGN</span><input name="ign" required maxLength={80} placeholder="ROOC IGN" /></label>
          <label className="field"><span>Class</span><select name="job_code" defaultValue=""><option value="">Select class</option>{jobOptions.map((job) => <option key={job.code} value={job.code}>{job.label}</option>)}</select></label>
          <label className="field"><span>Combat role</span><select name="combat_role" defaultValue=""><option value="">Not set</option><option value="DPS">DPS</option><option value="Support">Support</option><option value="Utility">Utility</option></select></label>
          <label className="field"><span>Guild rank</span><input name="guild_role" placeholder="Member / Officer / Commander / VGL / GL" /></label>
          <label className="field"><span>Status</span><select name="status" defaultValue="active"><option value="active">Active</option><option value="pending">Pending</option></select></label>
          <div className="full"><button type="submit" className="button">Add member</button></div>
        </form>
      </section>
    </AppShell>
  )
}
