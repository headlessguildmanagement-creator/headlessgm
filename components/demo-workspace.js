'use client'

import { useEffect, useMemo, useState } from 'react'

const STORAGE_PREFIX = 'headlessgm.demo.v2.'
const DEMO_MEMBER_LIMIT = 15
const TIER_LABELS = {
  free: { name: 'FREE', subtitle: 'Do the work yourself' },
  guild: { name: 'GUILD', subtitle: 'Organized bidding + automation' },
  commander: { name: 'COMMANDER', subtitle: 'Custom rules + guild identity' },
}

const seedMembers = [
  ['Aster','High Wizard','DPS',1],
  ['Belial','Paladin','Support',1],
  ['Ciel','Gypsy','Support',2],
  ['Doppio','Assassin Cross','DPS',2],
  ['Eris','High Priest','Support',3],
  ['Fenrir','Sniper','DPS',3],
  ['Gale','Professor','Utility',4],
  ['Helios','Champion','DPS',4],
  ['Iris','Creator','Utility',1],
  ['Juno','Lord Knight','DPS',2],
  ['Kairo','Whitesmith','DPS',3],
  ['Luna','High Priest','Support',4],
].map(([ign,job,role,group], index) => ({
  id: 'm'+(index+1),
  ign, job, role, group,
  absent: index === 6,
  cannotBid: index === 4,
  noGold: index === 8,
  h96: index === 10,
  puppetOrder: index + 1,
}))

function defaultState(tier) {
  return {
    members: seedMembers,
    event: { name: 'Guild League · Demo Night', status: 'lineup' },
    lineup: ['m1','m2','m3','m4','m5'],
    randomOrder: [],
    featherQty: 6,
    puppetQty: 3,
    ldCap: 2,
    tsCap: 1,
    activeFeatherGroup: 2,
    puppetCursor: 0,
    reviewGenerated: false,
    applicants: tier === 'free' ? [] : [{ id:'a1', ign:'Nyx', job:'Lord Knight', status:'new' }],
    brand: { primary:'#635bff', secondary:'#22d3ee', font:'modern' },
    modules: ['stats','event','attendance','lineup','auction','operations'],
    operations: { excludeSupportFromPuppet:false, missedTurnPriority:false, lateLoaOfficerApproval:false, customReset:'event' },
    savedAt: null,
  }
}

function readState(tier) {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + tier)
    return raw ? { ...defaultState(tier), ...JSON.parse(raw) } : defaultState(tier)
  } catch {
    return defaultState(tier)
  }
}

function csvRows(text) {
  const [head, ...rows] = String(text || '').trim().split(/\r?\n/).filter(Boolean)
  if (!head || !rows.length) return []
  const headers = head.split(',').map((v) => v.trim().toLowerCase())
  return rows.map((line, index) => {
    const values = line.split(',').map((v) => v.trim())
    const row = Object.fromEntries(headers.map((h, i) => [h, values[i] || '']))
    return {
      id: 'import-' + Date.now() + '-' + index,
      ign: row.ign || row.name || ('Member ' + (index+1)),
      job: row.class || row.job || 'Unknown',
      role: row.role || row.combatrole || 'DPS',
      group: Math.max(1, Math.min(4, Number(row.group || row.feathergroup || 1) || 1)),
      absent: false,
      cannotBid: false,
      noGold: false,
      h96: false,
      puppetOrder: 99 + index,
    }
  })
}

export default function DemoWorkspace({ compact = false }) {
  const [tier, setTier] = useState('free')
  const [tab, setTab] = useState('overview')
  const [state, setState] = useState(() => defaultState('free'))
  const [hydrated, setHydrated] = useState(false)
  const [newIgn, setNewIgn] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setState(readState(tier))
    setHydrated(true)
  }, [tier])

  useEffect(() => {
    if (!hydrated) return
    const next = { ...state, savedAt: new Date().toISOString() }
    window.localStorage.setItem(STORAGE_PREFIX + tier, JSON.stringify(next))
  }, [state, tier, hydrated])

  const paid = tier !== 'free'
  const commander = tier === 'commander'
  const active = useMemo(() => state.members.filter((m) => !m.absent), [state.members])
  const eligible = useMemo(() => active.filter((m) => !m.cannotBid && !m.noGold && !m.h96), [active])
  const lineupMembers = useMemo(() => state.lineup.map((id) => state.members.find((m) => m.id === id)).filter(Boolean), [state.lineup, state.members])
  const featherEligible = useMemo(() => eligible.filter((m) => m.group === Number(state.activeFeatherGroup)), [eligible, state.activeFeatherGroup])
  const puppetQueue = useMemo(() => {
    let rows = [...eligible]
    if (commander && state.operations?.excludeSupportFromPuppet) rows = rows.filter((m) => String(m.role).toLowerCase() !== 'support')
    rows.sort((a,b) => a.puppetOrder - b.puppetOrder)
    if (commander && state.operations?.missedTurnPriority && rows.length > 2) rows = [rows[2], ...rows.filter((_,i)=>i!==2)]
    return rows
  }, [eligible, commander, state.operations])
  const puppetWinners = useMemo(() => {
    if (!puppetQueue.length) return []
    return Array.from({ length: Math.min(Number(state.puppetQty) || 0, puppetQueue.length) }, (_, i) => puppetQueue[(state.puppetCursor + i) % puppetQueue.length])
  }, [puppetQueue, state.puppetQty, state.puppetCursor])
  const featherWinners = useMemo(() => featherEligible.slice(0, Math.min(Number(state.featherQty) || 0, featherEligible.length)), [featherEligible, state.featherQty])
  const randomMembers = state.randomOrder.map((id) => state.members.find((m) => m.id === id)).filter(Boolean)
  const visibleModules = commander ? new Set(state.modules) : new Set(['stats','event','attendance','lineup','auction','operations'])
  const demoStyle = commander ? { '--demo-accent': state.brand.primary, '--demo-secondary': state.brand.secondary } : {}

  function switchTier(value) {
    setTier(value)
    setTab('overview')
    setNotice('')
  }

  function addMember(e) {
    e.preventDefault()
    const ign = newIgn.trim()
    if (!ign) return
    if (state.members.length >= DEMO_MEMBER_LIMIT) {
      setNotice('The public demo is capped at 15 members. Real workspaces support 80.')
      return
    }
    setState((s) => ({ ...s, members:[...s.members,{ id:'m-'+Date.now(), ign, job:'Unassigned', role:'DPS', group:1, absent:false, cannotBid:false, noGold:false, h96:false, puppetOrder:s.members.length+1 }] }))
    setNewIgn('')
    setNotice(ign + ' added to this browser-only demo.')
  }

  function patchMember(id, patch) {
    setState((s) => ({ ...s, members:s.members.map((m) => m.id === id ? { ...m, ...patch } : m), reviewGenerated:false }))
  }

  function randomize() {
    const shuffled = [...eligible]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    setState((s) => ({ ...s, randomOrder:shuffled.map((m) => m.id), reviewGenerated:true }))
    setNotice('Random bidder order generated from currently eligible demo members.')
  }

  function generateOrganizedReview() {
    setState((s) => ({ ...s, reviewGenerated:true }))
    setNotice('Officer Review Demo generated. Publishing/copy/export are intentionally disabled.')
  }

  function reset() {
    window.localStorage.removeItem(STORAGE_PREFIX + tier)
    setState(defaultState(tier))
    setNotice('This tier demo was reset on this device.')
  }

  async function importCsv(file) {
    if (!paid || !file) return
    const text = await file.text()
    const rows = csvRows(text)
    if (!rows.length) {
      setNotice('No CSV rows found. Try headers like IGN,Class,Role,Group.')
      return
    }
    setState((s) => ({ ...s, members:[...s.members, ...rows].slice(0,DEMO_MEMBER_LIMIT), reviewGenerated:false }))
    setNotice('Imported locally. Demo roster remains capped at 15 members.')
  }

  function addApplicant() {
    if (!paid) return
    setState((s) => ({ ...s, applicants:[...s.applicants,{ id:'a-'+Date.now(), ign:'Applicant '+(s.applicants.length+1), job:'High Priest', status:'new' }] }))
  }

  return (
    <div className={'demo-workspace' + (compact ? ' compact' : '') + (commander ? ' commander-demo' : '')} style={demoStyle}>
      <div className={'demo-watermark-layer' + (paid ? ' strong' : ' light')} aria-hidden="true"><span>HEADLESSGM DEMO ONLY</span><span>{paid ? 'NOT FOR LIVE GUILD USE' : 'BROWSER DEMO'}</span><span>HEADLESSGM DEMO ONLY</span></div>

      <div className="demo-toolbar">
        <div>
          <p className="eyebrow">LIVE BROWSER DEMO</p>
          <strong>No account. No server writes.</strong>
          <small>Saved only in this browser. GUILD/COMMANDER outputs are visibly watermarked and cannot publish, copy, download or export.</small>
        </div>
        <div className="demo-tier-switch" role="tablist" aria-label="Demo tier">
          {Object.entries(TIER_LABELS).map(([key, meta]) => (
            <button key={key} type="button" className={tier === key ? 'active' : ''} onClick={() => switchTier(key)}>
              <strong>{meta.name}</strong><small>{meta.subtitle}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="demo-app-frame">
        <aside className="demo-sidebar">
          <div className="demo-logo"><span>H</span><div><strong>{commander ? 'NIGHTFALL' : 'HEADLESSGM'}</strong><small>{TIER_LABELS[tier].name} demo</small></div></div>
          <nav>
            {['overview','members','events','auction', ...(paid ? ['recruitment'] : []), ...(commander ? ['studio'] : [])].map((item) => (
              <button type="button" key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item[0].toUpperCase()+item.slice(1)}</button>
            ))}
          </nav>
          <div className="demo-limit-note"><strong>Demo limit</strong><span>{state.members.length}/{DEMO_MEMBER_LIMIT} members</span><small>Real plans support 80.</small></div>
          <button type="button" className="demo-reset" onClick={reset}>Reset demo data</button>
        </aside>

        <section className="demo-main">
          <header className="demo-main-head">
            <div><p className="eyebrow">{TIER_LABELS[tier].name} WORKSPACE</p><h3>{tab[0].toUpperCase()+tab.slice(1)}</h3></div>
            <span className="pill">{state.members.length} / {DEMO_MEMBER_LIMIT} DEMO MEMBERS</span>
          </header>

          <div className={'demo-use-warning' + (paid ? '' : ' free-demo-warning')}><strong>DEMO ONLY{paid ? ' · NOT FOR LIVE GUILD USE' : ''}</strong><span>{paid ? 'No Discord publishing, copy-ready output, image export, download, webhook or backup is available here.' : 'FREE demo data also stays in this browser and is visibly marked as demo output.'}</span></div>
          {notice ? <div className="notice demo-notice">{notice}</div> : null}

          {tab === 'overview' ? <div className="demo-stack">
            {visibleModules.has('stats') ? <div className="demo-metrics">
              <div><small>ACTIVE</small><strong>{active.length}</strong></div>
              <div><small>ELIGIBLE</small><strong>{eligible.length}</strong></div>
              <div><small>LINEUP</small><strong>{lineupMembers.length}</strong></div>
              <div><small>{paid ? 'APPLICANTS' : 'BIDDERS'}</small><strong>{paid ? state.applicants.length : (state.randomOrder.length || eligible.length)}</strong></div>
            </div> : null}
            {visibleModules.has('event') ? <div className="demo-panel">
              <div className="demo-panel-head"><div><small>CURRENT EVENT</small><strong>{state.event.name}</strong></div><span className="pill">{state.event.status.toUpperCase()}</span></div>
              <p>{tier === 'free' ? 'FREE is intentionally manual: officers maintain attendance, lineup and FFA/Random bidding themselves.' : tier === 'guild' ? 'GUILD organizes who can bid, whose Feather group is active, who is next in Puppet Round Robin, what caps apply and what should carry forward.' : 'COMMANDER starts from the organized GUILD engine, then lets the guild redefine the rules, policies, dashboard and visual identity.'}</p>
            </div> : null}
            {visibleModules.has('operations') ? <div className="demo-ops">
              <button onClick={() => setTab('members')}>Manage roster <span>→</span></button>
              <button onClick={() => setTab('events')}>Manage eligibility <span>→</span></button>
              <button onClick={() => setTab('auction')}>{paid ? 'Organize bidding' : 'Run bidding'} <span>→</span></button>
            </div> : null}
          </div> : null}

          {tab === 'members' ? <div className="demo-stack">
            <div className="demo-panel">
              <div className="demo-panel-head"><div><small>ROSTER</small><strong>{tier === 'free' ? 'Manual member entry' : 'Roster management'}</strong></div>{paid ? <label className="button ghost demo-file">Import CSV<input type="file" accept=".csv,text/csv" onChange={(e) => importCsv(e.target.files?.[0])} /></label> : <span className="pill">MANUAL ONLY</span>}</div>
              <form className="demo-add-member" onSubmit={addMember}><input value={newIgn} onChange={(e) => setNewIgn(e.target.value)} placeholder="New member IGN" /><button className="button" type="submit">Add member</button></form>
              <div className="demo-table">
                {state.members.map((m) => <div key={m.id}><strong>{m.ign}</strong><span>{m.job}</span><span>G{m.group} · {m.role}</span><span className={m.absent ? 'demo-state absent' : 'demo-state'}>{m.absent ? 'Absent' : 'Present'}</span></div>)}
              </div>
            </div>
            <div className="notice"><strong>Public demo cap:</strong> only {DEMO_MEMBER_LIMIT} members can be used here. Real FREE, GUILD and COMMANDER workspaces support 80 active members.</div>
          </div> : null}

          {tab === 'events' ? <div className="demo-stack">
            <div className="demo-panel">
              <div className="demo-panel-head"><div><small>ATTENDANCE & ELIGIBILITY</small><strong>{state.event.name}</strong></div><span className="pill">{tier === 'free' ? 'MANUAL' : 'LOA + RULES'}</span></div>
              <p>{tier === 'free' ? 'Click a member to mark them present or absent.' : 'Use these controls to see how GUILD/COMMANDER organized bidding excludes unavailable or restricted members before allocation.'}</p>
              <div className="demo-eligibility-table">
                {state.members.map((m) => <div key={m.id}>
                  <div><strong>{m.ign}</strong><small>G{m.group} · Puppet #{m.puppetOrder}</small></div>
                  <label><input type="checkbox" checked={!m.absent} onChange={() => patchMember(m.id,{absent:!m.absent})} /> Present</label>
                  {paid ? <>
                    <label><input type="checkbox" checked={m.cannotBid} onChange={() => patchMember(m.id,{cannotBid:!m.cannotBid})} /> Cannot Bid</label>
                    <label><input type="checkbox" checked={m.noGold} onChange={() => patchMember(m.id,{noGold:!m.noGold})} /> No Gold</label>
                    <label><input type="checkbox" checked={m.h96} onChange={() => patchMember(m.id,{h96:!m.h96})} /> 96H</label>
                  </> : null}
                </div>)}
              </div>
            </div>
            <div className="demo-panel">
              <div className="demo-panel-head"><div><small>MAIN LINEUP</small><strong>Party 1</strong></div><span className="pill">{lineupMembers.length}/5</span></div>
              <div className="demo-lineup">{lineupMembers.map((m, i) => <div key={m.id}><span>{i+1}</span><strong>{m.ign}</strong><small>{m.job}</small></div>)}</div>
              {paid ? <p className="demo-footnote">Real GUILD also adds previous-lineup reuse, availability filtering, warnings and Discord publication.</p> : <p className="demo-footnote">FREE keeps lineup management manual.</p>}
            </div>
          </div> : null}

          {tab === 'auction' ? <div className="demo-stack">
            {tier === 'free' ? <>
              <div className="demo-panel">
                <div className="demo-panel-head"><div><small>BIDDING</small><strong>FFA / Random</strong></div><button type="button" className="button" onClick={randomize}>Randomize eligible bidders</button></div>
                <p>FREE gives officers a structured roster and a clean random bidder order, but the officer still runs the process manually.</p>
                <div className="demo-random">{(randomMembers.length ? randomMembers : eligible).map((m, i) => <span key={m.id}><b>{i+1}</b>{m.ign}</span>)}</div>
              </div>
            </> : <>
              <div className="demo-auction-config">
                <label><span>Active Feather group</span><select value={state.activeFeatherGroup} onChange={(e) => setState((s) => ({...s,activeFeatherGroup:Number(e.target.value),reviewGenerated:false}))}>{[1,2,3,4].map((g)=><option value={g} key={g}>Group {g}</option>)}</select></label>
                <label><span>Feather quantity</span><input type="number" min="0" max="12" value={state.featherQty} onChange={(e)=>setState((s)=>({...s,featherQty:Number(e.target.value),reviewGenerated:false}))}/></label>
                <label><span>Puppet quantity</span><input type="number" min="0" max="12" value={state.puppetQty} onChange={(e)=>setState((s)=>({...s,puppetQty:Number(e.target.value),reviewGenerated:false}))}/></label>
                <label><span>L/D cap</span><input type="number" min="0" max="9" value={state.ldCap} onChange={(e)=>setState((s)=>({...s,ldCap:Number(e.target.value),reviewGenerated:false}))}/></label>
                <label><span>T/S cap</span><input type="number" min="0" max="9" value={state.tsCap} onChange={(e)=>setState((s)=>({...s,tsCap:Number(e.target.value),reviewGenerated:false}))}/></label>
              </div>

              <div className="demo-rule-strip">
                <span><b>4 GROUP FEATHER</b> Active G{state.activeFeatherGroup}</span>
                <span><b>PUPPET ROUND ROBIN</b> Persistent queue</span>
                <span><b>ELIGIBILITY</b> LOA / Cannot Bid / No Gold / 96H</span>
                <span><b>CAPS</b> L/D {state.ldCap} · T/S {state.tsCap}</span>
              </div>

              <div className="demo-panel">
                <div className="demo-panel-head"><div><small>ORGANIZED BIDDER ENGINE</small><strong>HeadlessGM decides who should be bidding and why</strong></div><button type="button" className="button" onClick={generateOrganizedReview}>Generate officer review</button></div>
                <div className="demo-organized-grid">
                  <div><small>FEATHER · GROUP {state.activeFeatherGroup}</small><strong>{featherEligible.length} eligible</strong><div>{featherEligible.map((m)=><span key={m.id}>{m.ign}</span>)}{!featherEligible.length?<em>None eligible</em>:null}</div></div>
                  <div><small>PUPPET · NEXT IN QUEUE</small><strong>{puppetQueue.length} eligible</strong><div>{puppetQueue.slice(0,6).map((m)=><span key={m.id}>#{m.puppetOrder} {m.ign}</span>)}</div></div>
                </div>
              </div>

              {state.reviewGenerated ? <div className="demo-review-sheet">
                <div className="demo-review-watermark">DEMO ONLY · NOT FOR LIVE GUILD USE · HEADLESSGM</div>
                <div className="demo-review-head"><div><small>OFFICER REVIEW DEMO</small><strong>{state.event.name}</strong></div><span>NOT PUBLISHABLE</span></div>
                <div className="demo-review-grid">
                  <div><small>FEATHER BIDDERS · GROUP {state.activeFeatherGroup}</small>{featherWinners.map((m,i)=><p key={m.id}><b>{i+1}</b>{m.ign}<em>Eligible · within demo cap</em></p>)}{!featherWinners.length?<p>No eligible demo bidders.</p>:null}</div>
                  <div><small>PUPPET ROUND ROBIN</small>{puppetWinners.map((m,i)=><p key={m.id}><b>{i+1}</b>{m.ign}<em>Queue #{m.puppetOrder}</em></p>)}{!puppetWinners.length?<p>No eligible demo bidders.</p>:null}</div>
                </div>
                <div className="demo-review-disabled">
                  <button type="button" disabled>Copy for Discord · disabled in demo</button>
                  <button type="button" disabled>Publish to Discord · disabled in demo</button>
                  <button type="button" disabled>Download / export · disabled in demo</button>
                </div>
                <footer>Generated in HeadlessGM Interactive Demo · headlessgm · DEMO ONLY</footer>
              </div> : null}

              <div className="notice"><strong>{tier === 'guild' ? 'GUILD' : 'COMMANDER'} organized bidding:</strong> eligibility is applied first, then standard Feather/Puppet structure and caps organize the officer review. {commander ? 'COMMANDER additionally lets the guild replace these standard rules with its own methodology.' : 'GUILD uses the supported HeadlessGM operating presets.'}</div>
            </>}

            <div className="demo-entitlement-grid">
              <div><small>FREE</small><strong>FFA + Random</strong></div>
              <div className={paid ? 'enabled' : ''}><small>GUILD</small><strong>4 Group + Round Robin + eligibility + caps</strong></div>
              <div className={commander ? 'enabled' : ''}><small>COMMANDER</small><strong>Custom methodology + policies + allocation logic</strong></div>
            </div>
          </div> : null}

          {tab === 'recruitment' && paid ? <div className="demo-stack">
            <div className="demo-panel">
              <div className="demo-panel-head"><div><small>RECRUITMENT</small><strong>Applicant queue</strong></div><button type="button" className="button ghost" onClick={addApplicant}>Add demo applicant</button></div>
              <div className="demo-table">{state.applicants.map((a) => <div key={a.id}><strong>{a.ign}</strong><span>{a.job}</span><span>Public application</span><span className="demo-state">{a.status.toUpperCase()}</span></div>)}</div>
            </div>
            <div className="notice">This demo does not create a real recruitment page, applicant portal, Discord message or public URL.</div>
          </div> : null}

          {tab === 'studio' && commander ? <div className="demo-stack">
            <div className="demo-panel">
              <div className="demo-panel-head"><div><small>OPERATIONS STUDIO</small><strong>Change how your guild operates</strong></div><span className="pill">COMMANDER</span></div>
              <p>These demo rules immediately change the organized bidding model. This is the core COMMANDER difference: GUILD uses HeadlessGM's standard methodology; COMMANDER lets the guild define its own.</p>
              <div className="demo-operations-studio">
                <label><input type="checkbox" checked={Boolean(state.operations?.excludeSupportFromPuppet)} onChange={(e)=>setState((s)=>({...s,operations:{...s.operations,excludeSupportFromPuppet:e.target.checked},reviewGenerated:false}))}/><span><strong>Exclude Support from Puppet</strong><small>Custom eligibility rule</small></span></label>
                <label><input type="checkbox" checked={Boolean(state.operations?.missedTurnPriority)} onChange={(e)=>setState((s)=>({...s,operations:{...s.operations,missedTurnPriority:e.target.checked},reviewGenerated:false}))}/><span><strong>Missed turn gets priority</strong><small>Custom queue advancement</small></span></label>
                <label><input type="checkbox" checked={Boolean(state.operations?.lateLoaOfficerApproval)} onChange={(e)=>setState((s)=>({...s,operations:{...s.operations,lateLoaOfficerApproval:e.target.checked}}))}/><span><strong>Late LOA needs officer approval</strong><small>Custom attendance policy</small></span></label>
                <label><span><strong>Reward reset policy</strong><small>Custom cap/reset logic</small></span><select value={state.operations?.customReset || 'event'} onChange={(e)=>setState((s)=>({...s,operations:{...s.operations,customReset:e.target.value}}))}><option value="event">Every event</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
              </div>
              <button type="button" className="button ghost" onClick={()=>setTab('auction')}>See these rules affect organized bidding →</button>
            </div>
            <div className="demo-panel">
              <div className="demo-panel-head"><div><small>BRAND STUDIO</small><strong>Make the workspace yours</strong></div></div>
              <div className="demo-brand-grid">
                <label><span>Primary</span><input type="color" value={state.brand.primary} onChange={(e) => setState((s) => ({ ...s, brand:{...s.brand,primary:e.target.value} }))} /></label>
                <label><span>Secondary</span><input type="color" value={state.brand.secondary} onChange={(e) => setState((s) => ({ ...s, brand:{...s.brand,secondary:e.target.value} }))} /></label>
                <label><span>Typography</span><select value={state.brand.font} onChange={(e) => setState((s) => ({ ...s, brand:{...s.brand,font:e.target.value} }))}><option value="modern">Modern</option><option value="tactical">Tactical</option><option value="classic">Classic</option></select></label>
              </div>
            </div>
            <div className="demo-panel">
              <div className="demo-panel-head"><div><small>OVERVIEW STUDIO</small><strong>Choose dashboard modules</strong></div></div>
              <div className="demo-module-list">{['stats','event','attendance','lineup','auction','operations'].map((id) => <label key={id}><input type="checkbox" checked={state.modules.includes(id)} onChange={() => setState((s) => ({ ...s, modules:s.modules.includes(id) ? s.modules.filter((x) => x !== id) : [...s.modules,id] }))} /><span>{id}</span></label>)}</div>
            </div>
            <div className="notice"><strong>COMMANDER demo protection:</strong> Operations, branding and overview changes are preview-only. There is no production deploy, public-page publish, export or live workspace connection.</div>
          </div> : null}
        </section>
      </div>
    </div>
  )
}
