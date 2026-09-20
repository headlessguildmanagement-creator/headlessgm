import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'
import { resolveGuild, withGuild } from '../../lib/guild-context'
import { havocFeatherGroupForInstant } from '../../lib/havoc-rules.mjs'
import { selectPuppetTurns } from '../../lib/puppet-engine.mjs'
import AppShell from '../../components/app-shell'
import { signOut } from './actions'

export default async function AppHome({ searchParams }) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  if (authError || !authData?.claims?.sub) redirect('/login')

  const query = await searchParams
  const guild = await resolveGuild(supabase, query?.guild, 'id,name,slug,plan_code,game_preset_id,timezone,created_at,settings')
  if (!guild) redirect('/app/onboarding')
  if (!query?.guild) redirect(`/${guild.slug}/overview`)

  const [{ data: plan }, { data: preset }, { data: members }, { data: events }, openApps, pendingMembers, { data: discord }, { data: rules }, { data: queue }] = await Promise.all([
    supabase.from('plans').select('display_name,active_member_limit').eq('code', guild.plan_code).single(),
    supabase.from('game_presets').select('name,raid_size,party_size,parties_per_raid').eq('id', guild.game_preset_id).single(),
    supabase.from('guild_members').select('id,ign,job_code,combat_role,feather_group,status,created_at').eq('guild_id', guild.id).eq('status', 'active').order('ign'),
    supabase.from('guild_events').select('id,name,event_type,starts_at,loa_deadline,status').eq('guild_id', guild.id).not('status', 'in', '(completed,cancelled)').order('starts_at', { ascending: true }).limit(12),
    supabase.from('guild_applications').select('id', { count: 'exact', head: true }).eq('guild_id', guild.id).not('status', 'in', '(rejected,joined)'),
    supabase.from('guild_members').select('id', { count: 'exact', head: true }).eq('guild_id', guild.id).eq('status', 'pending'),
    supabase.from('discord_connections').select('discord_guild_name,metadata,bot_installed').eq('guild_id', guild.id).maybeSingle(),
    supabase.from('guild_auction_rules').select('feather_mode,puppet_mode').eq('guild_id', guild.id).maybeSingle(),
    supabase.from('puppet_queue').select('guild_member_id,position,is_active').eq('guild_id', guild.id).eq('is_active', true).order('position'),
  ])

  const roster = members || []
  const activeCount = roster.length
  const activeLimit = plan?.active_member_limit ?? 80
  const currentEvent = events?.[0] || null

  let loas = []
  let absences = []
  let slots = []
  let puppetState = { current_cycle: 1 }
  let puppetExclusions = []
  let deferred = []
  let approvedAppeals = []
  let cycleProgress = []
  if (currentEvent) {
    const rows = await Promise.all([
      supabase.from('event_loas').select('guild_member_id').eq('event_id', currentEvent.id).is('cancelled_at', null),
      supabase.from('event_absences').select('guild_member_id').eq('event_id', currentEvent.id),
      supabase.from('event_lineup_slots').select('raid_code,party_no,slot_no,guild_member_id').eq('event_id', currentEvent.id).not('guild_member_id', 'is', null),
      supabase.from('guild_puppet_state').select('current_cycle').eq('guild_id', guild.id).maybeSingle(),
      supabase.from('event_puppet_exclusions').select('guild_member_id').eq('event_id', currentEvent.id),
      supabase.from('puppet_deferred_turns').select('id,guild_member_id,source_cycle,created_at,consumed_at').eq('guild_id', guild.id).is('consumed_at', null),
      supabase.from('puppet_appeals').select('id,guild_member_id,source_cycle,status,submitted_at,decided_at,consumed_at').eq('guild_id', guild.id).eq('status','approved').is('consumed_at', null),
    ])
    loas = rows[0].data || []
    absences = rows[1].data || []
    slots = rows[2].data || []
    puppetState = rows[3].data || { current_cycle: 1 }
    puppetExclusions = rows[4].data || []
    deferred = rows[5].data || []
    approvedAppeals = rows[6].data || []
    const progressResult = await supabase.from('puppet_cycle_progress').select('guild_member_id').eq('guild_id', guild.id).eq('cycle', Number(puppetState.current_cycle || 1))
    cycleProgress = progressResult.data || []
  }

  const unavailable = new Set([...loas.map((row) => row.guild_member_id), ...absences.map((row) => row.guild_member_id)])
  const assigned = new Set(slots.map((row) => row.guild_member_id))
  const attending = roster.filter((member) => !unavailable.has(member.id)).length
  const memberMap = new Map(roster.map((member) => [member.id, member]))

  const rosterAlerts = roster
    .map((member) => {
      const missing = []
      if (!member.job_code) missing.push('class')
      if (!member.combat_role) missing.push('role')
      if (rules?.feather_mode === 'four_group' && !member.feather_group) missing.push('Feather Group')
      return missing.length ? { member, missing } : null
    })
    .filter(Boolean)

  const supportAlerts = []
  for (const raid of ['main', 'sub']) {
    for (let party = 1; party <= 8; party += 1) {
      const partyMembers = slots
        .filter((slot) => slot.raid_code === raid && slot.party_no === party)
        .map((slot) => memberMap.get(slot.guild_member_id))
        .filter(Boolean)
      if (partyMembers.length && !partyMembers.some((member) => String(member.combat_role || '').toLowerCase() === 'support')) {
        supportAlerts.push({ raid, party, count: partyMembers.length })
      }
    }
  }

  const activeFeatherGroup = currentEvent && rules?.feather_mode === 'four_group' && ['guild_league','emperium_overrun'].includes(currentEvent.event_type)
    ? havocFeatherGroupForInstant(currentEvent.event_type, currentEvent.starts_at, guild.timezone || 'Asia/Manila')
    : null

  const featherCounts = [1,2,3,4].map((group) => ({ group, count: roster.filter((member) => member.feather_group === group).length }))
  const puppetTake = currentEvent?.event_type === 'emperium_overrun' ? 20 : 8
  const puppetSelection = currentEvent && rules?.puppet_mode === 'round_robin'
    ? selectPuppetTurns({
        members: roster,
        queue: queue || [],
        unavailableIds: unavailable,
        cannotBidIds: new Set(puppetExclusions.map((row) => row.guild_member_id)),
        currentCycle: Number(puppetState.current_cycle || 1),
        completedIds: new Set(cycleProgress.map((row) => row.guild_member_id)),
        deferred,
        appeals: approvedAppeals,
        requestedCount: puppetTake,
        eventStartsAt: currentEvent.starts_at,
        timeZone: guild.timezone || 'Asia/Manila',
      })
    : { assignments: [] }
  const puppetNext = puppetSelection.assignments.map((row) => ({ ...row, member: memberMap.get(row.guild_member_id) })).filter((row) => row.member)

  const overviewModules = guild.plan_code === 'commander' || guild.plan_code === 'beta'
    ? new Set(guild.settings?.overview?.modules || ['stats','current_event','alerts','events','feather','puppet','operations'])
    : guild.plan_code === 'free'
      ? new Set(['stats','current_event','events','operations'])
      : new Set(['stats','current_event','alerts','events','feather','puppet','operations'])

  const operations = [
    ['Events & Attendance', `${events?.length || 0} active/upcoming events. LOA, availability and event state live here.`, withGuild('/app/events', guild.slug)],
    ['Lineup Builder', `${preset?.raid_size || 40}-player Main · ${preset?.parties_per_raid || 8} parties × ${preset?.party_size || 5}.`, currentEvent ? `/${guild.slug}/events/${currentEvent.id}` : withGuild('/app/events', guild.slug)],
    ['Auction Rules', 'Feather and Puppet presets, Random eligibility and per-person caps.', withGuild('/app/settings/auction', guild.slug)],
    ...(guild.plan_code === 'free' ? [] : [['Recruitment', `${openApps.count ?? 0} open applications · public recruitment /${guild.slug}`, withGuild('/app/recruitment', guild.slug)]]),
    ['Members', `${activeCount} active · ${pendingMembers.count ?? 0} pending. Persistent identity and Discord links.`, withGuild('/app/members', guild.slug)],
    ...(guild.plan_code === 'free' ? [] : [['Discord', discord?.bot_installed ? `Connected to ${discord.discord_guild_name}${discord.metadata?.channel_name ? ` · #${discord.metadata.channel_name}` : ''}` : 'Not connected. Install or reconnect HeadlessGM and choose its channel.', withGuild('/app/settings/discord', guild.slug)]]),
  ]

  const actions = <form action={signOut}><button type="submit" className="button ghost">Sign out</button></form>

  return (
    <AppShell guildName={guild.name} guildSlug={guild.slug} title="Guild overview" activeHref="/app" actions={actions}>
      {overviewModules.has('stats') ? <section className="stats">
        <div className="stat"><label>ACTIVE MEMBERS</label><strong>{activeCount} / {activeLimit}</strong><small>{pendingMembers.count ?? 0} pending</small></div>
        <div className="stat"><label>CURRENT EVENT ATTENDANCE</label><strong>{currentEvent ? attending : '—'}</strong><small>{currentEvent ? `${unavailable.size} LOA / no-show` : 'No active event'}</small></div>
        <div className="stat"><label>LINEUP ASSIGNED</label><strong>{currentEvent ? assigned.size : '—'}</strong><small>{currentEvent ? `${Math.max(0, 80 - assigned.size)} of 80 slots open` : 'No active event'}</small></div>
        <div className="stat"><label>PLAN</label><strong>{plan?.display_name || 'BETA'}</strong><small>/{guild.slug} · {guild.timezone}</small></div>
      </section> : null}

      {overviewModules.has('current_event') ? (currentEvent ? <section className="panel panel-pad current-event-command">
        <div className="section-head">
          <div><p className="eyebrow">CURRENT EVENT</p><h2>{currentEvent.name}</h2><p>{currentEvent.event_type.replaceAll('_',' ').toUpperCase()} · {new Date(currentEvent.starts_at).toLocaleString('en-US', { timeZone: guild.timezone })}</p></div>
          <div className="event-command-actions">
            {activeFeatherGroup ? <span className="pill">FEATHER GROUP {activeFeatherGroup}</span> : null}
            <span className="pill">{currentEvent.status.toUpperCase()}</span>
            <Link className="button" href={`/${guild.slug}/events/${currentEvent.id}`}>Open event command</Link>
          </div>
        </div>
        <div className="event-readiness-strip">
          <div><small>Expected / eligible</small><strong>{attending}</strong></div>
          <div><small>Main + Sub assigned</small><strong>{assigned.size}</strong></div>
          <div><small>LOA</small><strong>{loas.length}</strong></div>
          <div><small>No-show</small><strong>{absences.length}</strong></div>
        </div>
      </section> : <div className="notice">No active/upcoming event exists yet. Create one from Events.</div>) : null}

      {overviewModules.has('alerts') && (rosterAlerts.length || supportAlerts.length) ? <section className="panel panel-pad">
        <div className="section-head"><div><h2>Roster and lineup checks</h2><p>Officer checks for missing roster information and started parties without Support.</p></div><span className="pill">{rosterAlerts.length + supportAlerts.length} ALERT{rosterAlerts.length + supportAlerts.length === 1 ? '' : 'S'}</span></div>
        <div className="officer-alert-columns">
          <div><h3>Missing member information</h3>
            {rosterAlerts.length ? rosterAlerts.slice(0, 12).map(({ member, missing }) => <div className="compact-alert" key={member.id}><strong>{member.ign}</strong><span>Missing: {missing.join(', ')}</span></div>) : <div className="compact-alert clear">Roster fields are complete.</div>}
            {rosterAlerts.length > 12 ? <div className="muted">+ {rosterAlerts.length - 12} more. Open Members to resolve.</div> : null}
          </div>
          <div><h3>Parties without Support</h3>
            {supportAlerts.length ? supportAlerts.map((alert) => <div className="compact-alert" key={`${alert.raid}-${alert.party}`}><strong>{alert.raid.toUpperCase()} · Party {alert.party}</strong><span>{alert.count}/5 assigned · Support required</span></div>) : <div className="compact-alert clear">Every started party has Support.</div>}
          </div>
        </div>
      </section> : null}

      {(overviewModules.has('events') || overviewModules.has('feather')) ? <div className="overview-columns">
        {overviewModules.has('events') ? <section className="panel">
          <div className="panel-pad section-head"><div><h2>Current and upcoming events</h2><p>Open an event to manage LOA, lineup, auction and finalization.</p></div><Link href={withGuild('/app/events', guild.slug)} className="button ghost">All events</Link></div>
          <div className="ops-list">
            {(events || []).slice(0,5).map((event) => <Link href={`/${guild.slug}/events/${event.id}`} className="ops-row" key={event.id}><strong>{event.name}</strong><p>{event.event_type.replaceAll('_',' ')} · {new Date(event.starts_at).toLocaleString('en-US', { timeZone: guild.timezone })}</p><span>{event.status.toUpperCase()} →</span></Link>)}
            {!events?.length ? <div className="panel-pad muted">No upcoming events.</div> : null}
          </div>
        </section> : null}

        {overviewModules.has('feather') ? <section className="panel panel-pad">
          <div className="section-head"><div><h2>Permanent Feather groups</h2><p>{rules?.feather_mode === 'four_group' ? 'Guild-wide groups with fixed ROOC event rotation.' : 'Four-group rotation is not currently selected.'}</p></div></div>
          <div className="feather-group-overview">
            {featherCounts.map(({ group, count }) => <div className={activeFeatherGroup === group ? 'feather-group-row active' : 'feather-group-row'} key={group}><span>Group {group}</span><strong>{count}</strong>{activeFeatherGroup === group ? <small>ACTIVE</small> : <small>members</small>}</div>)}
          </div>
          {guild.game_preset_id === 'rooc' && rules?.feather_mode === 'four_group' ? <p className="muted rotation-note">Guild League: 4 → 3 → 2 → 1 · Emperium Overrun: 1 → 2 → 3 → 4</p> : null}
        </section> : null}
      </div> : null}

      {overviewModules.has('puppet') && rules?.puppet_mode === 'round_robin' ? <section className="panel panel-pad">
        <div className="section-head"><div><h2>Next Puppet bidders</h2><p>Tentative current-event view using make-ups → approved appeals → current cycle → rollover. LOA/no-show, Cannot Bid and 96H are skipped without moving persistent queue position.</p></div><span className="pill">CYCLE {Number(puppetState.current_cycle || 1)} · NEXT {puppetTake}</span></div>
        <div className="puppet-next-list">{puppetNext.map((row, index) => <span className="puppet-next-item" key={row.member.id}><small>{index + 1}</small><strong>{row.member.ign}</strong><em>{row.turn_kind === 'deferred' ? 'MAKE-UP' : row.turn_kind === 'appeal' ? 'APPEAL' : row.turn_kind === 'rollover' ? 'NEXT CYCLE' : 'CURRENT'}</em></span>)}</div>
        {!puppetNext.length ? <p className="muted">No eligible Puppet bidders are currently available.</p> : null}
      </section> : null}

      {overviewModules.has('operations') ? <section className="panel">
        <div className="panel-pad section-head"><div><h2>Operations</h2><p>The same Havoc operating path, with guild-configurable rules around it.</p></div><span className="pill">{preset?.name || 'Guild Operations'}</span></div>
        <div className="ops-list">{operations.map(([title, text, href]) => <Link key={title} href={href} className="ops-row"><strong>{title}</strong><p>{text}</p><span>Open →</span></Link>)}</div>
      </section> : null}
    </AppShell>
  )
}
