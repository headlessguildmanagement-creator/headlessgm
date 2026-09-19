import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { resolveGuild, withGuild } from '../../../lib/guild-context'
import AppShell from '../../../components/app-shell'
import { movePuppetQueueMember, setMemberFeatherGroup } from './actions'

export default async function AuctionsPage({ searchParams }) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const params = await searchParams
  const guild = await resolveGuild(supabase, params?.guild, 'id,name,slug,owner_user_id,game_preset_id')
  if (!guild) redirect('/app/onboarding')
  const manager = guild.owner_user_id === userId || Boolean((await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).in('role', ['owner','officer']).maybeSingle()).data)
  if (!manager) redirect(`/${guild.slug}`)

  const [{ data: events }, { data: members }, { data: queue }, { data: rules }, { data: jobs }] = await Promise.all([
    supabase.from('guild_events').select('id,name,event_type,starts_at,status').eq('guild_id', guild.id).order('starts_at', { ascending: false }).limit(30),
    supabase.from('guild_members').select('id,ign,job_code,combat_role,feather_group,puppet_order,status').eq('guild_id', guild.id).eq('status', 'active').order('ign'),
    supabase.from('puppet_queue').select('guild_member_id,position,is_active').eq('guild_id', guild.id).eq('is_active', true).order('position'),
    supabase.from('guild_auction_rules').select('feather_mode,puppet_mode,version').eq('guild_id', guild.id).maybeSingle(),
    supabase.from('game_jobs').select('code,label').eq('game_preset_id', guild.game_preset_id).eq('is_active', true),
  ])

  const eventIds = (events || []).map((event) => event.id)
  const { data: runs } = eventIds.length
    ? await supabase.from('auction_runs').select('id,event_id,status,generated_at,published_at,completed_at,input_data').in('event_id', eventIds)
    : { data: [] }

  const runMap = new Map((runs || []).map((run) => [run.event_id, run]))
  const memberMap = new Map((members || []).map((member) => [member.id, member]))
  const jobMap = Object.fromEntries((jobs || []).map((job) => [job.code, job.label]))
  const queueRows = (queue || []).map((row) => ({ ...row, member: memberMap.get(row.guild_member_id) })).filter((row) => row.member)
  const groups = [1,2,3,4].map((group) => ({ group, members: (members || []).filter((member) => member.feather_group === group) }))
  const ungrouped = (members || []).filter((member) => ![1,2,3,4].includes(member.feather_group))

  return (
    <AppShell guildName={guild.name} guildSlug={guild.slug} eyebrow="AUCTION" title="Auction Operations" activeHref="/app/auctions">
      {params?.success ? <div className="notice success">{String(params.success)}</div> : null}
      {params?.error ? <div className="notice error">{String(params.error)}</div> : null}

      <section className="panel">
        <div className="panel-pad section-head">
          <div><h2>Event auctions</h2><p>Generate draft → officer review → publish → finalize. Persistent rotations advance only on finalization.</p></div>
          <Link href={withGuild('/app/settings/auction', guild.slug)} className="button ghost">Rules & caps · v{rules?.version || 1}</Link>
        </div>
        <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
          <table>
            <thead><tr><th>Event</th><th>Date</th><th>Event state</th><th>Auction</th><th>Rewards entered</th><th></th></tr></thead>
            <tbody>
              {(events || []).map((event) => {
                const run = runMap.get(event.id)
                const quantities = run?.input_data?.quantities || {}
                const total = Object.values(quantities).reduce((sum, value) => sum + (Number(value) || 0), 0)
                return <tr key={event.id}>
                  <td><strong>{event.name}</strong><div className="muted" style={{ fontSize: 12 }}>{event.event_type.replaceAll('_',' ')}</div></td>
                  <td>{new Date(event.starts_at).toLocaleString()}</td>
                  <td><span className="pill">{event.status}</span></td>
                  <td><span className="pill">{run?.status || 'not generated'}</span></td>
                  <td>{run ? total : '—'}</td>
                  <td><Link href={withGuild(`/app/events/${event.id}/auction`, guild.slug)}>Open →</Link></td>
                </tr>
              })}
              {!events?.length ? <tr><td colSpan="6" className="muted">No events yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {rules?.puppet_mode === 'round_robin' ? <section className="panel">
        <div className="panel-pad section-head">
          <div><h2>Persistent Puppet rotation</h2><p>The queue is guild-wide, not rebuilt per event. New active members join the back; event LOA/no-show only skips the current event.</p></div>
          <span className="pill">{queueRows.length} ACTIVE</span>
        </div>
        <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
          <table>
            <thead><tr><th>Position</th><th>IGN</th><th>Class</th><th>Role</th><th>Adjust</th></tr></thead>
            <tbody>
              {queueRows.map((row, index) => <tr key={row.guild_member_id}>
                <td><strong>#{index + 1}</strong><div className="muted" style={{ fontSize: 10 }}>stored {row.position}</div></td>
                <td><strong>{row.member.ign}</strong></td>
                <td>{jobMap[row.member.job_code] || row.member.job_code || '—'}</td>
                <td>{row.member.combat_role || '—'}</td>
                <td><div className="queue-actions">
                  <form action={movePuppetQueueMember}><input type="hidden" name="guild_id" value={guild.id}/><input type="hidden" name="guild_member_id" value={row.guild_member_id}/><input type="hidden" name="direction" value="up"/><button className="button ghost" type="submit" disabled={index === 0}>↑</button></form>
                  <form action={movePuppetQueueMember}><input type="hidden" name="guild_id" value={guild.id}/><input type="hidden" name="guild_member_id" value={row.guild_member_id}/><input type="hidden" name="direction" value="down"/><button className="button ghost" type="submit" disabled={index === queueRows.length - 1}>↓</button></form>
                </div></td>
              </tr>)}
              {!queueRows.length ? <tr><td colSpan="5" className="muted">No active Puppet queue members.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section> : <div className="notice">Puppet is currently configured as <strong>{rules?.puppet_mode?.replaceAll('_',' ') || 'not configured'}</strong>. Persistent queue controls appear when Round Robin is selected.</div>}

      {rules?.feather_mode === 'four_group' ? <section className="panel panel-pad">
        <div className="section-head"><div><h2>Permanent Feather groups</h2><p>Group membership persists across events. ROOC Guild League and Emperium Overrun choose the active group from the fixed calendar rotation.</p></div><span className="pill">{ungrouped.length ? `${ungrouped.length} MISSING` : 'ROSTER COMPLETE'}</span></div>
        <div className="feather-admin-grid">
          {groups.map(({ group, members: groupMembers }) => <div className="feather-admin-group" key={group}>
            <div className="section-head"><div><h3>Group {group}</h3><p>{groupMembers.length} members</p></div></div>
            <div className="feather-admin-members">
              {groupMembers.map((member) => <div className="feather-admin-member" key={member.id}><div><strong>{member.ign}</strong><small>{jobMap[member.job_code] || member.job_code || 'Class not set'}</small></div><form action={setMemberFeatherGroup}><input type="hidden" name="guild_id" value={guild.id}/><input type="hidden" name="guild_member_id" value={member.id}/><select name="feather_group" defaultValue={String(group)}>{[1,2,3,4].map((value) => <option value={value} key={value}>G{value}</option>)}</select><button type="submit" className="button ghost">Move</button></form></div>)}
            </div>
          </div>)}
        </div>
        {ungrouped.length ? <div className="notice error" style={{ marginTop: 14 }}><strong>Missing Feather Group:</strong> {ungrouped.map((member) => member.ign).join(', ')}. Assign every active member before using four-group auctions.</div> : null}
      </section> : null}
    </AppShell>
  )
}
