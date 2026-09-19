'use client'

import { useMemo, useState } from 'react'

export default function LineupSearch({ rows = [] }) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle.length < 2) return []
    return rows
      .filter((row) => `${row.ign} ${row.job || ''} ${row.raid || ''} ${row.party || ''}`.toLowerCase().includes(needle))
      .slice(0, 12)
  }, [query, rows])

  return (
    <section className="panel panel-pad lineup-finder">
      <div className="section-head">
        <div><h2>Find a lineup assignment</h2><p>Search by IGN or class to see Main/Sub and party placement.</p></div>
        <span className="pill">{rows.length} ASSIGNED</span>
      </div>
      <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player or class" />
      <div className="lineup-search-results">
        {query.trim().length < 2 ? <span className="muted">Start typing at least two characters.</span> : null}
        {query.trim().length >= 2 && !matches.length ? <span className="muted">No assigned player matches that search.</span> : null}
        {matches.map((row) => (
          <div className="lineup-search-result" key={row.memberId}>
            <div><strong>{row.ign}</strong><small>{row.job || 'Class not set'}</small></div>
            <span className="pill">{String(row.raid).toUpperCase()} · Party {row.party} · Slot {row.slot}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
