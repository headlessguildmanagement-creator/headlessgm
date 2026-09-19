'use client'

import { useEffect, useMemo, useState } from 'react'

const STORAGE_PREFIX = 'headlessgm.demo.v1.'
const TIER_LABELS = {
  free: { name: 'FREE', subtitle: 'Do the work yourself' },
  guild: { name: 'GUILD', subtitle: 'Automate guild operations' },
  commander: { name: 'COMMANDER', subtitle: 'Make HeadlessGM work your way' },
}

const seedMembers = [
  ['Aster','High Wizard','DPS'],
  ['Belial','Paladin','Support'],
  ['Ciel','Gypsy','Support'],
  ['Doppio','Assassin Cross','DPS'],
  ['Eris','High Priest','Support'],
  ['Fenrir','Sniper','DPS'],
  ['Gale','Professor','Utility'],
  ['Helios','Champion','DPS'],
].map(([ign,job,role], index) => ({ id: 'm'+(index+1), ign, job, role, absent: index === 6 }))

function defaultState(tier) {
  return {
    members: seedMembers,
    event: { name: 'Guild League · Demo Night', status: 'lineup' },
    lineup: ['m1','m2','m3','m4','m5'],
    randomOrder: [],
    applicants: tier === 'free' ? [] : [{ id:'a1', ign:'Nyx', job:'Lord Knight', status:'new' }],
    brand: { primary:'#635bff', secondary:'#22d3ee', font:'modern' },
    modules: ['stats','event','attendance','lineup','auction','operations'],
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
      absent: false,
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

  const active = useMemo(() => state.members.filter((m) => !m.absent), [state.members])
  const lineupMembers = useMemo(() => state.lineup.map((id) => state.members.find((m) => m.id === id)).filter(Boolean), [state.lineup, state.members])
  const paid = tier !== 'free'
  const commander = tier === 'commander'
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
    if (state.members.length >= 80) {
      setNotice('Demo roster is already at the 80-member limit.')
      return
    }
    setState((s) => ({ ...s, members:[...s.members,{ id:'m-'+Date.now(), ign, job:'Unassigned', role:'DPS', absent:false }] }))
    setNewIgn('')
    setNotice(ign + ' added locally.')
  }

  function toggleAttendance(id) {
    setState((s) => ({ ...s, members:s.members.map((m) => m.id === id ? { ...m, absent:!m.absent } : m) }))
  }

  function randomize() {
    const shuffled = [...active]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    setState((s) => ({ ...s, randomOrder:shuffled.map((m) => m.id) }))
    setNotice('Random bidder order generated from currently eligible members.')
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
      setNotice('No CSV rows found. Try headers like IGN,Class,Role.')
      return
    }
    setState((s) => ({ ...s, members:[...s.members, ...rows].slice(0,80) }))
    setNotice(rows.length + ' CSV row' + (rows.length === 1 ? '' : 's') + ' imported locally.')
  }

  function addApplicant() {
    if (!paid) return
    setState((s) => ({ ...s, applicants:[...s.applicants,{ id:'a-'+Date.now(), ign:'Applicant '+(s.applicants.length+1), job:'High Priest', status:'new' }] }))
  }

  const randomMembers = state.randomOrder.map((id) => state.members.find((m) => m.id === id)).filter(Boolean)
  const visibleModules = commander ? new Set(state.modules) : new Set(['stats','event','attendance','lineup','auction','operations'])

  return (
    <div className={'demo-workspace' + (compact ? ' compact' : '') + (commander ? ' commander-demo' : '')} style={demoStyle}>
      <div className="demo-toolbar">
        <div>
          <p className="eyebrow">LIVE BROWSER DEMO</p>
          <strong>No account. No server writes.</strong>
          <small>Everything you change here is saved only in this browser using localStorage.</small>
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
          <button type="button" className="demo-reset" onClick={reset}>Reset demo data</button>
        </aside>

        <section className="demo-main">
          <header className="demo-main-head">
            <div><p className="eyebrow">{TIER_LABELS[tier].name} WORKSPACE</p><h3>{tab[0].toUpperCase()+tab.slice(1)}</h3></div>
            <span className="pill">{state.members.length} / 80 members</span>
          </header>
          {notice ? <div className="notice demo-notice">{notice}</div> : null}

          {tab === 'overview' ? <div className="demo-stack">
            {visibleModules.has('stats') ? <div className="demo-metrics">
              <div><small>ACTIVE</small><strong>{active.length}</strong></div>
              <div><small>ABSENT</small><strong>{state.members.length-active.length}</strong></div>
              <div><small>LINEUP</small><strong>{lineupMembers.length}</strong></div>
              <div><small>{paid ? 'APPLICANTS' : 'BIDDERS'}</small><strong>{paid ? state.applicants.length : (state.randomOrder.length || active.length)}</strong></div>
            </div> : null}
            {visibleModules.has('event') ? <div className="demo-panel">
              <div className="demo-panel-head"><div><small>CURRENT EVENT</small><strong>{state.event.name}</strong></div><span className="pill">{state.event.status.toUpperCase()}</span></div>
              <p>{tier === 'free' ? 'FREE is intentionally manual: officers maintain attendance and lineup themselves.' : 'GUILD automates member LOA, import, persistent auction state and Discord workflows.'}</p>
            </div> : null}
            {visibleModules.has('operations') ? <div className="demo-ops">
              <button onClick={() => setTab('members')}>Manage roster <span>→</span></button>
              <button onClick={() => setTab('events')}>Mark attendance <span>→</span></button>
              <button onClick={() => setTab('auction')}>Run bidding <span>→</span></button>
            </div> : null}
          </div> : null}

          {tab === 'members' ? <div className="demo-stack">
            <div className="demo-panel">
              <div className="demo-panel-head"><div><small>ROSTER</small><strong>{tier === 'free' ? 'Manual member entry' : 'Roster management'}</strong></div>{paid ? <label className="button ghost demo-file">Import CSV<input type="file" accept=".csv,text/csv" onChange={(e) => importCsv(e.target.files?.[0])} /></label> : <span className="pill">MANUAL ONLY</span>}</div>
              <form className="demo-add-member" onSubmit={addMember}><input value={newIgn} onChange={(e) => setNewIgn(e.target.value)} placeholder="New member IGN" /><button className="button" type="submit">Add member</button></form>
              <div className="demo-table">
                {state.members.map((m) => <div key={m.id}><strong>{m.ign}</strong><span>{m.job}</span><span>{m.role}</span><span className={m.absent ? 'demo-state absent' : 'demo-state'}>{m.absent ? 'Absent' : 'Present'}</span></div>)}
              </div>
            </div>
            {!paid ? <div className="notice"><strong>FREE boundary:</strong> CSV/XML import is intentionally unavailable. The roster stays useful at 80 members, but officers maintain it manually.</div> : null}
          </div> : null}

          {tab === 'events' ? <div className="demo-stack">
            <div className="demo-panel">
              <div className="demo-panel-head"><div><small>ATTENDANCE</small><strong>{state.event.name}</strong></div><span className="pill">{tier === 'free' ? 'MANUAL' : 'LOA + OFFICER'}</span></div>
              <p>{tier === 'free' ? 'Click a member to mark them present or absent. There is no member-filed LOA in FREE.' : 'This demo shows the resulting availability state. In the paid app, members can file LOA themselves before the event cutoff.'}</p>
              <div className="demo-attendance">
                {state.members.map((m) => <button key={m.id} type="button" className={m.absent ? 'absent' : ''} onClick={() => toggleAttendance(m.id)}><strong>{m.ign}</strong><small>{m.absent ? 'ABSENT' : 'PRESENT'}</small></button>)}
              </div>
            </div>
            <div className="demo-panel">
              <div className="demo-panel-head"><div><small>MAIN LINEUP</small><strong>Party 1</strong></div><span className="pill">{lineupMembers.length}/5</span></div>
              <div className="demo-lineup">{lineupMembers.map((m, i) => <div key={m.id}><span>{i+1}</span><strong>{m.ign}</strong><small>{m.job}</small></div>)}</div>
              {paid ? <p className="demo-footnote">GUILD adds previous-lineup reuse, automated availability filtering and lineup warnings.</p> : <p className="demo-footnote">FREE keeps lineup management manual.</p>}
            </div>
          </div> : null}

          {tab === 'auction' ? <div className="demo-stack">
            <div className="demo-panel">
              <div className="demo-panel-head"><div><small>BIDDING</small><strong>{tier === 'free' ? 'FFA / Random' : tier === 'guild' ? 'Standard guild presets' : 'Custom allocation engine'}</strong></div><button type="button" className="button" onClick={randomize}>Randomize eligible bidders</button></div>
              <p>{tier === 'free' ? 'The standout FREE tool: randomize only the members currently marked eligible.' : 'Paid tiers add persistent Feather/Puppet rules and reward caps around the same eligibility model.'}</p>
              <div className="demo-random">
                {(randomMembers.length ? randomMembers : active).map((m, i) => <span key={m.id}><b>{i+1}</b>{m.ign}</span>)}
              </div>
            </div>
            <div className="demo-entitlement-grid">
              <div><small>FREE</small><strong>FFA + Random</strong></div>
              <div className={paid ? 'enabled' : ''}><small>GUILD</small><strong>4 Group + Round Robin + caps</strong></div>
              <div className={commander ? 'enabled' : ''}><small>COMMANDER</small><strong>Custom rules + allocation logic</strong></div>
            </div>
          </div> : null}

          {tab === 'recruitment' && paid ? <div className="demo-stack">
            <div className="demo-panel">
              <div className="demo-panel-head"><div><small>RECRUITMENT</small><strong>Applicant queue</strong></div><button type="button" className="button ghost" onClick={addApplicant}>Add demo applicant</button></div>
              <div className="demo-table">
                {state.applicants.map((a) => <div key={a.id}><strong>{a.ign}</strong><span>{a.job}</span><span>Public application</span><span className="demo-state">{a.status.toUpperCase()}</span></div>)}
              </div>
            </div>
            <div className="notice">GUILD and COMMANDER receive a public guild recruitment site. FREE does not.</div>
          </div> : null}

          {tab === 'studio' && commander ? <div className="demo-stack">
            <div className="demo-panel">
              <div className="demo-panel-head"><div><small>BRAND STUDIO</small><strong>Make the workspace yours</strong></div><span className="pill">COMMANDER</span></div>
              <div className="demo-brand-grid">
                <label><span>Primary</span><input type="color" value={state.brand.primary} onChange={(e) => setState((s) => ({ ...s, brand:{...s.brand,primary:e.target.value} }))} /></label>
                <label><span>Secondary</span><input type="color" value={state.brand.secondary} onChange={(e) => setState((s) => ({ ...s, brand:{...s.brand,secondary:e.target.value} }))} /></label>
                <label><span>Typography</span><select value={state.brand.font} onChange={(e) => setState((s) => ({ ...s, brand:{...s.brand,font:e.target.value} }))}><option value="modern">Modern</option><option value="tactical">Tactical</option><option value="classic">Classic</option></select></label>
              </div>
            </div>
            <div className="demo-panel">
              <div className="demo-panel-head"><div><small>OVERVIEW STUDIO</small><strong>Choose dashboard modules</strong></div></div>
              <div className="demo-module-list">
                {['stats','event','attendance','lineup','auction','operations'].map((id) => <label key={id}><input type="checkbox" checked={state.modules.includes(id)} onChange={() => setState((s) => ({ ...s, modules:s.modules.includes(id) ? s.modules.filter((x) => x !== id) : [...s.modules,id] }))} /><span>{id}</span></label>)}
              </div>
            </div>
          </div> : null}
        </section>
      </div>
    </div>
  )
}
