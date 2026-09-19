import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase/server'
import AppShell from '../../../../../components/app-shell'
import { finalizeAuction, generateAuctionDraft, publishAuction } from './actions'
import { havocFeatherGroupForInstant } from '../../../../../lib/havoc-rules.mjs'

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
  if (!manager) redirect(`/app/events/${id}`)

  const [{ data: rules }, { data: run }, { data: members }, { data: queue }, { data: loas }, { data: absences }] = await Promise.all([
    supabase.from('guild_auction_rules').select('*').eq('guild_id', guild.id).single(),
    supabase.from('auction_runs').select('*').eq('event_id', id).maybeSingle(),
    supabase.from('guild_members').select('id,ign,job_code,feather_group,status').eq('guild_id', guild.id).eq('status', 'active').order('ign'),
    supabase.from('puppet_queue').select('guild_member_id,position,is_active').eq('guild_id', guild.id).eq('is_active', true).order('position'),
    supabase.from('event_loas').select('guild_member_id').eq('event_id', id).is('cancelled_at', null),
    supabase.from('event_absences').select('guild_member_id').eq('event_id', id),
  ])

  const { data: allocations } = run
    ? await supabase.from('auction_allocations').select('*').eq('auction_run_id', run.id).order('category').order('quantity', { ascending: false })
    : { data: [] }

  const memberMap = new Map((members || []).map((member) => [member.id, member]))
  const unavailable = new Set([...(loas || []).map((x) => x.guild_member_id), ...(absences || []).map((x) => x.guild_member_id)])
  const eligibleCount = (members || []).filter((member) => !unavailable.has(member.id)).length
  const input = run?.input_data?.quantities || {}
  const ffa = run?.generated_output?.ffa || {}
  const automaticFeatherGroup = rules.feather_mode === 'four_group' && ['guild_league','emperium_overrun'].includes(event.event_type)
    ? havocFeatherGroupForInstant(event.event_type, event.starts_at, guild.timezone || 'Asia/Manila')
    : null
  const randomOrders = run?.generated_output?.random_orders || {}

  return (
    <AppShell guildName={guild.name} eyebrow="AUCTION COMMAND" title={`${event.name} · Auction`} activeHref="/app/events" actions={<Link href={`/${guild.slug}/events/${id}`} className="button ghost">Back to event</Link>}>
      {query?.error ? <div className="notice error">{String(query.error)}</div> : null}
      {query?.success ? <div className="notice success">{String(query.success)}</div> : null}

      <section className="stats">
        <div className="stat"><label>STATUS</label><strong style={{ fontSize: 22 }}>{(run?.status || 'NOT GENERATED').toUpperCase()}</strong><small>Generate → review → publish → finalize</small></div>
        <div className="stat"><label>ELIGIBLE</label><strong>{eligibleCount}</strong><small>{unavailable.size} unavailable via LOA/no-show</small></div>
        <div className="stat"><label>FEATHER</label><strong style={{ fontSize: 20 }}>{rules.feather_mode.replaceAll('_',' ').toUpperCase()}</strong><small>{rules.feather_mode === 'four_group' ? `Group ${run?.input_data?.active_feather_group || '—'}` : 'Guild preset'}</small></div>
        <div className="stat"><label>PUPPET</label><strong style={{ fontSize: 20 }}>{rules.puppet_mode.replaceAll('_',' ').toUpperCase()}</strong><small>{(queue || []).length} members in persistent queue</small></div>
      </section>

      <section className="panel panel-pad">
        <div className="section-head"><div><h2>Reward quantities</h2><p>Generation creates or replaces a <strong>draft only</strong>. It never advances Puppet rotation.</p></div><span className="pill">RULE VERSION {rules.version}</span></div>
        {run && run.status !== 'draft' ? (
          <div className="notice">This auction is {run.status}. Published/completed auctions are immutable.</div>
        ) : (
          <form action={generateAuctionDraft} className="form-grid">
            <input type="hidden" name="event_id" value={id} />
            <label className="field"><span>Light / Dark Feather quantity</span><input type="number" name="light_dark_feather" min="0" step="1" defaultValue={input.light_dark_feather ?? 0} /></label>
            <label className="field"><span>Time / Space Feather quantity</span><input type="number" name="time_space_feather" min="0" step="1" defaultValue={input.time_space_feather ?? 0} /></label>
            <label className="field"><span>Puppet Fragment quantity</span><input type="number" name="puppet_fragment" min="0" step="1" defaultValue={input.puppet_fragment ?? 0} /></label>
            <label className="field"><span>Illusion Fragment quantity</span><input type="number" name="illusion_fragment" min="0" step="1" defaultValue={input.illusion_fragment ?? 0} /></label>
            {rules.feather_mode === 'four_group' ? automaticFeatherGroup ? <><input type="hidden" name="active_feather_group" value={automaticFeatherGroup} /><div className="notice full"><strong>Feather Group {automaticFeatherGroup}</strong> is selected automatically from the proven ROOC calendar rotation for this event date.</div></> : <label className="field"><span>Active Feather group</span><select name="active_feather_group" defaultValue={String(run?.input_data?.active_feather_group || 1)}><option value="1">Group 1</option><option value="2">Group 2</option><option value="3">Group 3</option><option value="4">Group 4</option></select></label> : null}
            <div className="full"><button type="submit" className="button">{run ? 'Regenerate draft' : 'Generate draft'}</button></div>
          </form>
        )}
      </section>

      <section className="panel panel-pad">
        <div className="section-head"><div><h2>Rules snapshot</h2><p>Caps in the run are snapshotted and database-enforced. Later Settings changes do not rewrite this event.</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>Reward</th><th>Current guild cap</th><th>Draft/run cap</th></tr></thead><tbody>
          {Object.entries(labels).map(([key,label]) => <tr key={key}><td>{label}</td><td>{rules[`${key === 'light_dark_feather' ? 'light_dark_feather' : key === 'time_space_feather' ? 'time_space_feather' : key}_cap`] ?? 'Unlimited'}</td><td>{run?.rules_snapshot?.caps?.[key] ?? 'Unlimited'}</td></tr>)}
        </tbody></table></div>
      </section>

      {run ? (
        <>
          <section className="panel">
            <div className="panel-pad section-head"><div><h2>Generated assignments</h2><p>Round Robin and Random assignments are fixed in the draft. FFA categories remain open to the eligible pool, subject to the snapshotted cap.</p></div><span className="pill">{(allocations || []).length} ROWS</span></div>
            <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}><table><thead><tr><th>Reward</th><th>Member</th><th>Qty</th><th>Source</th></tr></thead><tbody>
              {(allocations || []).map((row) => <tr key={row.id}><td>{labels[row.category] || row.category}</td><td><strong>{memberMap.get(row.guild_member_id)?.ign || 'Unknown'}</strong></td><td>{row.quantity}</td><td>{row.source.replaceAll('_',' ')}</td></tr>)}
              {!allocations?.length ? <tr><td colSpan="4" className="muted">No fixed assignments in this draft.</td></tr> : null}
            </tbody></table></div>
          </section>

          {Object.keys(ffa).length ? (
            <section className="panel panel-pad">
              <div className="section-head"><div><h2>FFA categories</h2><p>Everyone listed by the event eligibility calculation may bid, but each member remains subject to the category cap.</p></div></div>
              <div className="ops-list">
                {Object.entries(ffa).map(([category,info]) => info?.quantity > 0 ? <div className="ops-row" key={category}><strong>{labels[category] || category}</strong><p>{info.quantity} available · {info.eligible_member_ids?.length || 0} eligible bidders · per-person cap {info.cap ?? 'unlimited'}</p><span>FFA</span></div> : null)}
              </div>
            </section>
          ) : null}

          {Object.values(run.generated_output?.unassigned || {}).some((value) => Number(value) > 0) ? (
            <div className="notice error">Some quantities could not be assigned because the eligible pool hit its configured caps. Review the draft before publishing.</div>
          ) : null}

          {Object.keys(randomOrders).length ? <section className="panel panel-pad">
            <div className="section-head"><div><h2>Random draw audit</h2><p>The draw order is frozen with this draft. Review and publish never rerandomize it.</p></div></div>
            <div className="ops-list">
              {Object.entries(randomOrders).map(([category, ids]) => <div className="ops-row" key={category}><strong>{labels[category] || category}</strong><p>{(ids || []).map((memberId) => memberMap.get(memberId)?.ign || 'Unknown').join(' → ') || 'No eligible bidders'}</p><span>FROZEN</span></div>)}
            </div>
          </section> : null}

          <section className="panel panel-pad">
            <div className="section-head"><div><h2>Officer review</h2><p>Publishing locks the draft. Finalization is the only step that advances persistent Puppet queue state.</p></div></div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {run.status === 'draft' ? <form action={publishAuction}><input type="hidden" name="event_id" value={id} /><input type="hidden" name="auction_run_id" value={run.id} /><button type="submit" className="button">Publish auction</button></form> : null}
              {run.status === 'published' ? <form action={finalizeAuction}><input type="hidden" name="event_id" value={id} /><input type="hidden" name="auction_run_id" value={run.id} /><button type="submit" className="button">Finalize event & advance persistent state</button></form> : null}
              {run.status === 'completed' ? <span className="pill">FINALIZED {run.completed_at ? new Date(run.completed_at).toLocaleString() : ''}</span> : null}
            </div>
          </section>
        </>
      ) : null}
    </AppShell>
  )
}
