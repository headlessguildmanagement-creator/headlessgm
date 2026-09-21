import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase/server'
import AppShell from '../../../../../components/app-shell'
import { finalizeAuction, generateAuctionDraft, publishAuction, setPuppetCannotBid, setFeatherExclusion, setPuppetCycleComplete, decidePuppetAppeal, publishTentativeBidders, setAuctionTransferPassword, setAuctionProxyBidder } from './actions'
import { havocFeatherGroupForInstant } from '../../../../../lib/havoc-rules.mjs'
import { isPuppet96hPenalty } from '../../../../../lib/puppet-engine.mjs'

const labels = {
  light_dark_feather: 'Light / Dark Feather',
  time_space_feather: 'Time / Space Feather',
  puppet_fragment: 'Puppet Fragment',
  illusion_fragment: 'Illusion Fragment',
}

export default async function AuctionPage({ params, searchParams }) {
  const { id } = await params
  const query = await searchParams
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const { data: event } = await supabase.from('guild_events').select('*').eq('id', id).maybeSingle()
  if (!event) notFound()
  const { data: guild } = await supabase.from('guilds').select('id,name,slug,owner_user_id,timezone').eq('id', event.guild_id).single()
  const manager = guild.owner_user_id === userId || Boolean((await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).in('role', ['owner','officer']).maybeSingle()).data)
  if (!manager) redirect(`/${guild.slug}/events/${id}`)

  const [{ data: rules }, { data: run }, { data: members }, { data: queue }, { data: loas }, { data: absences }, { data: puppetState }, { data: puppetExclusions }, { data: featherExclusions }, { data: deferred }, { data: appeals }, { data: officerQueue }] = await Promise.all([
    supabase.from('guild_auction_rules').select('*').eq('guild_id', guild.id).single(),
    supabase.from('auction_runs').select('*').eq('event_id', id).maybeSingle(),
    supabase.from('guild_members').select('id,ign,job_code,combat_role,feather_group,status,created_at,is_officer').eq('guild_id', guild.id).eq('status', 'active').order('ign'),
    supabase.from('puppet_queue').select('guild_member_id,position,is_active').eq('guild_id', guild.id).eq('is_active', true).order('position'),
    supabase.from('event_loas').select('guild_member_id').eq('event_id', id).is('cancelled_at', null),
    supabase.from('event_absences').select('guild_member_id').eq('event_id', id),
    supabase.from('guild_puppet_state').select('current_cycle,feather_officer_rotation_index').eq('guild_id', guild.id).maybeSingle(),
    supabase.from('event_puppet_exclusions').select('guild_member_id,reason').eq('event_id', id),
    supabase.from('event_feather_exclusions').select('guild_member_id,reason').eq('event_id', id),
    supabase.from('puppet_deferred_turns').select('*').eq('guild_id', guild.id).is('consumed_at', null).order('source_cycle'),
    supabase.from('puppet_appeals').select('*').eq('guild_id', guild.id).is('consumed_at', null).order('submitted_at'),
    supabase.from('feather_officer_queue').select('guild_member_id,position,is_active').eq('guild_id', guild.id).eq('is_active', true).order('position'),
  ])

  const currentCycle = Number(puppetState?.current_cycle || 1)
  const { data: progress } = await supabase.from('puppet_cycle_progress').select('guild_member_id,completed_at,turn_kind').eq('guild_id', guild.id).eq('cycle', currentCycle)
  const [{ data: allocations }, { data: proxies }, { data: proofs }, { data: transferPasswordConfigured }] = run
    ? await Promise.all([
        supabase.from('auction_allocations').select('*').eq('auction_run_id', run.id).order('category').order('quantity', { ascending: false }),
        supabase.from('auction_bidder_proxies').select('*').eq('auction_run_id', run.id),
        supabase.from('auction_bid_proofs').select('*').eq('auction_run_id', run.id).order('submitted_at'),
        supabase.rpc('guild_transfer_password_configured', { p_guild_id: guild.id }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: false }]

  const memberMap = new Map((members || []).map((member) => [member.id, member]))
  const unavailable = new Set([...(loas || []).map((x) => x.guild_member_id), ...(absences || []).map((x) => x.guild_member_id)])
  const completed = new Set((progress || []).map((row) => row.guild_member_id))
  const cannotBid = new Set((puppetExclusions || []).map((row) => row.guild_member_id))
  const featherBlocked = new Map((featherExclusions || []).map((row) => [row.guild_member_id, row.reason]))
  const penalty = new Set((members || []).filter((member) => isPuppet96hPenalty(member, event.starts_at, guild.timezone || 'Asia/Manila')).map((member) => member.id))
  const eligibleCount = (members || []).filter((member) => !unavailable.has(member.id)).length
  const input = run?.input_data?.quantities || {}
  const ffa = run?.generated_output?.ffa || {}
  const automaticFeatherGroup = rules.feather_mode === 'four_group' && ['guild_league','emperium_overrun'].includes(event.event_type) ? havocFeatherGroupForInstant(event.event_type, event.starts_at, guild.timezone || 'Asia/Manila') : null
  const randomOrders = run?.generated_output?.random_orders || {}
  const featherDistribution = run?.generated_output?.feather_distribution || null
  const puppetSelection = run?.generated_output?.puppet_selection || null
  const puppetRows = (queue || []).map((row) => ({ ...row, member: memberMap.get(row.guild_member_id) })).filter((row) => row.member)
  const activeGroup = run?.input_data?.active_feather_group || automaticFeatherGroup
  const featherRows = (members || []).filter((member) => !activeGroup || member.feather_group === Number(activeGroup)).sort((a,b)=>a.ign.localeCompare(b.ign))
  const pendingAppeals = (appeals || []).filter((appeal) => appeal.status === 'pending')
  const approvedAppeals = (appeals || []).filter((appeal) => appeal.status === 'approved')
  const deferredIds = new Set((deferred || []).map((row) => row.guild_member_id))
  const proxyMap = new Map((proxies || []).map((row) => [row.allocation_id, row]))
  const proofByMember = new Map((proofs || []).map((row) => [row.bidder_member_id, row]))
  const effectiveBidderIds = [...new Set((allocations || []).map((row) => proxyMap.get(row.id)?.bidder_member_id || row.guild_member_id))]
  const submittedBidderIds = effectiveBidderIds.filter((memberId) => proofByMember.has(memberId))
  const missingBidderIds = effectiveBidderIds.filter((memberId) => !proofByMember.has(memberId))

  return (
    <AppShell guildName={guild.name} guildSlug={guild.slug} eyebrow="AUCTION COMMAND" title={`${event.name} · Auction`} activeHref="/app/events" actions={<Link href={`/${guild.slug}/events/${id}`} className="button ghost">Back to event</Link>}>
      {query?.error ? <div className="notice error">{String(query.error)}</div> : null}
      {query?.success ? <div className="notice success">{String(query.success)}</div> : null}

      <section className="stats">
        <div className="stat"><label>STATUS</label><strong style={{ fontSize: 22 }}>{(run?.status || 'NOT GENERATED').toUpperCase()}</strong><small>Generate → review → publish → finalize</small></div>
        <div className="stat"><label>ELIGIBLE</label><strong>{eligibleCount}</strong><small>{unavailable.size} unavailable via LOA/no-show</small></div>
        <div className="stat"><label>PUPPET CYCLE</label><strong>{currentCycle}</strong><small>{completed.size} completed · {deferred?.length || 0} deferred</small></div>
        <div className="stat"><label>FEATHER</label><strong style={{ fontSize: 20 }}>{rules.feather_mode.replaceAll('_',' ').toUpperCase()}</strong><small>{rules.feather_mode === 'four_group' ? `Group ${activeGroup || '—'}` : 'Guild preset'}</small></div>
      </section>

      <section className="panel panel-pad">
        <div className="section-head"><div><h2>Pre-event reminder</h2><p>Publishes the current possible bidders only. This is intentionally not the official bidding list.</p></div><form action={publishTentativeBidders}><input type="hidden" name="event_id" value={id}/><button type="submit" className="button ghost">Publish Possible Bidders</button></form></div>
        <div className="notice"><strong>Standard preset:</strong> possible Puppet bidders are limited to {event.event_type === 'emperium_overrun' ? 20 : 8} for this event type. Final bidders still depend on current-cycle state, make-ups, appeals, 96H, LOA/no-show and Cannot Bid.</div>
      </section>

      {rules.puppet_mode === 'round_robin' ? <section className="panel">
        <div className="panel-pad section-head"><div><h2>Puppet A–Z rotation · Cycle {currentCycle}</h2><p>Deferred old-cycle obligations first, approved appeals second, current cycle next, then rollover only when the cycle can finish.</p></div><span className="pill">{approvedAppeals.length} APPROVED APPEAL{approvedAppeals.length===1?'':'S'}</span></div>
        <div className="table-wrap" style={{ border:0,borderRadius:0 }}><table><thead><tr><th>Pos</th><th>Member</th><th>Cycle state</th><th>Event state</th><th>Action</th></tr></thead><tbody>
          {puppetRows.map((row,index)=>{
            const member=row.member
            const eventState = unavailable.has(member.id) ? 'LOA / NO-SHOW' : cannotBid.has(member.id) ? 'CANNOT BID' : penalty.has(member.id) ? '96H' : 'AVAILABLE'
            const cycleState = deferredIds.has(member.id) ? 'MAKE-UP' : completed.has(member.id) ? 'DONE' : 'PENDING'
            return <tr key={member.id}><td>#{index+1}</td><td><strong>{member.ign}</strong></td><td><span className="pill">{cycleState}</span></td><td><span className="pill">{eventState}</span></td><td><div className="queue-actions">
              {!completed.has(member.id) ? <form action={setPuppetCycleComplete}><input type="hidden" name="event_id" value={id}/><input type="hidden" name="guild_member_id" value={member.id}/><input type="hidden" name="complete" value="true"/><button className="button ghost" type="submit">Complete</button></form> : <form action={setPuppetCycleComplete}><input type="hidden" name="event_id" value={id}/><input type="hidden" name="guild_member_id" value={member.id}/><input type="hidden" name="complete" value="false"/><button className="button ghost" type="submit">Set Pending</button></form>}
              {!completed.has(member.id) && !unavailable.has(member.id) && !penalty.has(member.id) ? <form action={setPuppetCannotBid}><input type="hidden" name="event_id" value={id}/><input type="hidden" name="guild_member_id" value={member.id}/><input type="hidden" name="blocked" value={cannotBid.has(member.id)?'false':'true'}/><button className="button ghost" type="submit">{cannotBid.has(member.id)?'Can Bid Again':'Cannot Bid'}</button></form> : null}
            </div></td></tr>
          })}
        </tbody></table></div>
      </section> : null}

      {pendingAppeals.length ? <section className="panel">
        <div className="panel-pad section-head"><div><h2>Pending Puppet appeals</h2><p>Approved appeals become make-up obligations and are selected before the normal current-cycle queue.</p></div></div>
        <div className="table-wrap" style={{border:0,borderRadius:0}}><table><thead><tr><th>Member</th><th>Source cycle</th><th>Reason</th><th>Submitted</th><th>Decision</th></tr></thead><tbody>{pendingAppeals.map((appeal)=><tr key={appeal.id}><td><strong>{memberMap.get(appeal.guild_member_id)?.ign || 'Unknown'}</strong></td><td>Cycle {appeal.source_cycle}</td><td>{appeal.reason}</td><td>{new Date(appeal.submitted_at).toLocaleString()}</td><td><div className="queue-actions"><form action={decidePuppetAppeal}><input type="hidden" name="event_id" value={id}/><input type="hidden" name="appeal_id" value={appeal.id}/><button name="status" value="approved" className="button" type="submit">Approve</button></form><form action={decidePuppetAppeal}><input type="hidden" name="event_id" value={id}/><input type="hidden" name="appeal_id" value={appeal.id}/><button name="status" value="rejected" className="button ghost" type="submit">Reject</button></form></div></td></tr>)}</tbody></table></div>
      </section> : null}

      {rules.feather_mode === 'four_group' ? <section className="panel">
        <div className="panel-pad section-head"><div><h2>Feather bidder eligibility · Group {activeGroup || '—'}</h2><p>LOA/no-show and 96H are excluded automatically. Officers can additionally mark No Gold or a manual 96-Hour Penalty.</p></div><span className="pill">OFFICER ROTATION {Number(puppetState?.feather_officer_rotation_index || 0)+1}</span></div>
        <div className="table-wrap" style={{border:0,borderRadius:0}}><table><thead><tr><th>Member</th><th>Role</th><th>Eligibility</th><th>Reason / action</th></tr></thead><tbody>{featherRows.map((member)=>{
          const auto = unavailable.has(member.id) ? 'ABSENT' : penalty.has(member.id) ? 'PENALTY_96H' : null
          const manual = featherBlocked.get(member.id)
          const reason = auto || manual
          return <tr key={member.id}><td><strong>{member.ign}</strong></td><td>{member.combat_role || '—'}{member.is_officer ? ' · Officer' : ''}</td><td><span className="pill">{reason ? 'INELIGIBLE' : 'ELIGIBLE'}</span></td><td>{auto ? auto.replaceAll('_',' ') : manual ? <form action={setFeatherExclusion} className="inline-action"><input type="hidden" name="event_id" value={id}/><input type="hidden" name="guild_member_id" value={member.id}/><input type="hidden" name="excluded" value="false"/><span>{manual.replaceAll('_',' ')}</span><button className="button ghost" type="submit">Restore</button></form> : <form action={setFeatherExclusion} className="inline-action"><input type="hidden" name="event_id" value={id}/><input type="hidden" name="guild_member_id" value={member.id}/><input type="hidden" name="excluded" value="true"/><select name="reason" defaultValue="NO_GOLD"><option value="NO_GOLD">No Gold</option><option value="PENALTY_96H">96-Hour Penalty</option><option value="ABSENT">Absent</option></select><button className="button ghost" type="submit">Mark ineligible</button></form>}</td></tr>
        })}</tbody></table></div>
      </section> : null}

      <section className="panel panel-pad">
        <div className="section-head"><div><h2>Reward quantities</h2><p>Generation creates or replaces a <strong>draft only</strong>. It never advances persistent Puppet or Feather rotation state.</p></div><span className="pill">RULE VERSION {rules.version}</span></div>
        {run && run.status !== 'draft' ? <div className="notice">This auction is {run.status}. Published/completed auctions are immutable.</div> : <form action={generateAuctionDraft} className="form-grid">
          <input type="hidden" name="event_id" value={id}/>
          <label className="field"><span>Light / Dark Feather quantity</span><input type="number" name="light_dark_feather" min="0" step="1" defaultValue={input.light_dark_feather ?? 0}/></label>
          <label className="field"><span>Time / Space Feather quantity</span><input type="number" name="time_space_feather" min="0" step="1" defaultValue={input.time_space_feather ?? 0}/></label>
          <label className="field"><span>Puppet Fragment quantity</span><input type="number" name="puppet_fragment" min="0" step="1" defaultValue={input.puppet_fragment ?? 0}/></label>
          <label className="field"><span>Illusion Fragment quantity</span><input type="number" name="illusion_fragment" min="0" step="1" defaultValue={input.illusion_fragment ?? 0}/></label>
          {rules.feather_mode === 'four_group' ? automaticFeatherGroup ? <><input type="hidden" name="active_feather_group" value={automaticFeatherGroup}/><div className="notice full"><strong>Feather Group {automaticFeatherGroup}</strong> is selected automatically from the configured ROOC calendar rotation for this event date.</div></> : <label className="field"><span>Active Feather group</span><select name="active_feather_group" defaultValue={String(run?.input_data?.active_feather_group || 1)}>{[1,2,3,4].map((group)=><option value={group} key={group}>Group {group}</option>)}</select></label> : null}
          <div className="full"><button type="submit" className="button">{run?'Regenerate draft':'Generate draft'}</button></div>
        </form>}
      </section>

      <section className="panel panel-pad"><div className="section-head"><div><h2>Rules snapshot</h2><p>Caps in the run are snapshotted and database-enforced. Later Settings changes do not rewrite this event.</p></div></div><div className="table-wrap"><table><thead><tr><th>Reward</th><th>Current guild cap</th><th>Draft/run cap</th></tr></thead><tbody>{Object.entries(labels).map(([key,label])=><tr key={key}><td>{label}</td><td>{rules[`${key}_cap`] ?? 'Unlimited'}</td><td>{run?.rules_snapshot?.caps?.[key] ?? 'Unlimited'}</td></tr>)}</tbody></table></div></section>

      {run ? <>
        {featherDistribution ? <section className="panel panel-pad"><div className="section-head"><div><h2>Feather fairness calculation</h2><p>Combined equal rounds first; remaining boxes go through persistent officer excess rotation without breaking caps.</p></div><span className="pill">{featherDistribution.bidder_count} BIDDERS</span></div><div className="event-readiness-strip"><div><small>Regular total</small><strong>{featherDistribution.equal_combined_total ?? 'Varies'}</strong></div><div><small>Officer excess L/D</small><strong>{featherDistribution.officer_excess_ld || 0}</strong></div><div><small>Officer excess T/S</small><strong>{featherDistribution.officer_excess_ts || 0}</strong></div><div><small>Next officer pointer</small><strong>{Number(run.generated_output?.officer_rotation_next ?? 0)+1}</strong></div></div></section> : null}
        {puppetSelection ? <section className="panel panel-pad"><div className="section-head"><div><h2>Puppet draft summary</h2><p>Old-cycle make-ups and approved appeals do not consume a member's normal current-cycle turn.</p></div><span className="pill">CYCLE {puppetSelection.current_cycle}</span></div><div className="event-readiness-strip"><div><small>Deferred make-ups</small><strong>{puppetSelection.counts?.deferred || 0}</strong></div><div><small>Appeals</small><strong>{puppetSelection.counts?.appeal || 0}</strong></div><div><small>Current-cycle</small><strong>{puppetSelection.counts?.normal || 0}</strong></div><div><small>Rollover</small><strong>{puppetSelection.counts?.rollover || 0}</strong></div></div></section> : null}
        <section className="panel">
          <div className="panel-pad section-head"><div><h2>Generated assignments</h2><p>The original rights owner stays in the audit trail. A Give / Proxy replacement changes only the bidder shown on the final published list and must be completed before publication.</p></div><span className="pill">{(allocations||[]).length} ROWS</span></div>
          {run.status === 'draft' ? <div className="panel-pad" style={{paddingTop:0}}>
            <div className="notice"><strong>Internal Give / Proxy password:</strong> {transferPasswordConfigured ? 'configured' : 'not configured yet'}. Only the guild owner can set or replace it.</div>
            {guild.owner_user_id === userId ? <form action={setAuctionTransferPassword} className="inline-action" style={{marginTop:12}}>
              <input type="hidden" name="event_id" value={id}/>
              <input type="password" name="transfer_password" minLength="4" maxLength="64" required placeholder={transferPasswordConfigured ? 'Replace transfer password' : 'Set transfer password'}/>
              <button className="button ghost" type="submit">{transferPasswordConfigured ? 'Replace password' : 'Set password'}</button>
            </form> : null}
          </div> : null}
          <div className="table-wrap" style={{border:0,borderRadius:0}}><table><thead><tr><th>Reward</th><th>Rights owner</th><th>Published bidder</th><th>Qty</th><th>Source</th>{run.status==='draft'?<th>Give / Proxy</th>:null}</tr></thead><tbody>
            {(allocations||[]).map((row)=>{
              const proxy=proxyMap.get(row.id)
              const effectiveId=proxy?.bidder_member_id || row.guild_member_id
              return <tr key={row.id}>
                <td>{labels[row.category]||row.category}</td>
                <td><strong>{memberMap.get(row.guild_member_id)?.ign||'Unknown'}</strong></td>
                <td><strong>{memberMap.get(effectiveId)?.ign||'Unknown'}</strong>{proxy ? <div className="muted">Proxy / gifted bidding right</div> : null}</td>
                <td>{row.quantity}</td>
                <td>{row.source.replaceAll('_',' ')}{row.metadata?.turn_kind ? ` · ${row.metadata.turn_kind.replaceAll('_',' ')}` : ''}</td>
                {run.status==='draft'?<td><form action={setAuctionProxyBidder} className="inline-action">
                  <input type="hidden" name="event_id" value={id}/><input type="hidden" name="allocation_id" value={row.id}/>
                  <select name="bidder_member_id" defaultValue={effectiveId}>{(members||[]).map((member)=><option value={member.id} key={member.id}>{member.ign}</option>)}</select>
                  <input type="password" name="transfer_password" required placeholder="Transfer password"/>
                  <button className="button ghost" type="submit">{proxy ? 'Update' : 'Give / Proxy'}</button>
                </form></td>:null}
              </tr>
            })}
            {!allocations?.length?<tr><td colSpan={run.status==='draft'?6:5} className="muted">No fixed assignments in this draft.</td></tr>:null}
          </tbody></table></div>
        </section>
        {run.status !== 'draft' && effectiveBidderIds.length ? <section className="panel panel-pad">
          <div className="section-head"><div><h2>Auction screenshot proof</h2><p>Discord proof must use the IGN shown on the published bidding list. HeadlessGM records only proof status and Discord audit identifiers; screenshot files are not stored.</p></div><span className="pill">{submittedBidderIds.length}/{effectiveBidderIds.length} SUBMITTED</span></div>
          <div className="event-readiness-strip">
            <div><small>Submitted</small><strong>{submittedBidderIds.length}</strong></div>
            <div><small>Missing</small><strong>{missingBidderIds.length}</strong></div>
          </div>
          <div className="table-wrap" style={{marginTop:16}}><table><thead><tr><th>Published bidder</th><th>Proof</th><th>Submitted</th></tr></thead><tbody>
            {effectiveBidderIds.map((memberId)=>{
              const proof=proofByMember.get(memberId)
              return <tr key={memberId}><td><strong>{memberMap.get(memberId)?.ign||'Unknown'}</strong></td><td><span className="pill">{proof?'SUBMITTED':'MISSING'}</span></td><td>{proof?new Date(proof.submitted_at).toLocaleString():'—'}</td></tr>
            })}
          </tbody></table></div>
          {missingBidderIds.length ? <div className="notice error" style={{marginTop:16}}><strong>Missing screenshot proof:</strong> {missingBidderIds.map((memberId)=>memberMap.get(memberId)?.ign||'Unknown').join(', ')}</div> : <div className="notice success" style={{marginTop:16}}>All published bidders have submitted proof.</div>}
        </section> : null}
        {Object.keys(ffa).length ? <section className="panel panel-pad"><div className="section-head"><div><h2>FFA categories</h2><p>Eligible bidder lists are frozen with this run and caps remain enforceable.</p></div></div><div className="ops-list">{Object.entries(ffa).map(([category,info])=>info?.quantity>0?<div className="ops-row" key={category}><strong>{labels[category]||category}</strong><p>{info.quantity} available · {info.eligible_member_ids?.length||0} eligible bidders · cap {info.cap??'unlimited'}</p><span>FFA</span></div>:null)}</div></section>:null}
        {Object.values(run.generated_output?.unassigned||{}).some((value)=>Number(value)>0)?<div className="notice error">Some quantities remain unassigned because the eligible regular/officer pools reached the configured caps or no eligible bidder remained.</div>:null}
        {Object.keys(randomOrders).length ? <section className="panel panel-pad"><div className="section-head"><div><h2>Random draw audit</h2><p>The randomized order is frozen with this draft. Review and publish never rerandomize it.</p></div></div><div className="ops-list">{Object.entries(randomOrders).map(([category,ids])=><div className="ops-row" key={category}><strong>{labels[category]||category}</strong><p>{(ids||[]).map((memberId)=>memberMap.get(memberId)?.ign||'Unknown').join(' → ')||'No eligible bidders'}</p><span>FROZEN</span></div>)}</div></section>:null}
        <section className="panel panel-pad"><div className="section-head"><div><h2>Officer review</h2><p>Publishing locks the draft. Finalization advances persistent Puppet cycle and Feather officer rotation. Midnight PHT auto-complete reconciles past generated events.</p></div></div><div className="operator-actions">{run.status==='draft'?<form action={publishAuction}><input type="hidden" name="event_id" value={id}/><input type="hidden" name="auction_run_id" value={run.id}/><button type="submit" className="button">Publish auction</button></form>:null}{run.status==='published'?<form action={finalizeAuction}><input type="hidden" name="event_id" value={id}/><input type="hidden" name="auction_run_id" value={run.id}/><button type="submit" className="button">Finalize event & advance persistent state</button></form>:null}{run.status==='completed'?<span className="pill">FINALIZED {run.completed_at?new Date(run.completed_at).toLocaleString():''}</span>:null}</div></section>
      </> : null}
    </AppShell>
  )
}
