'use client'

import { useMemo, useState } from 'react'

const fontOptions = [
  ['modern', 'Modern Sans'],
  ['compact', 'Compact / Tactical'],
  ['editorial', 'Editorial Serif'],
  ['classic', 'Classic Guild'],
]

function toHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
}

function dominantColors(data) {
  const buckets = new Map()
  for (let i = 0; i < data.length; i += 16) {
    const a = data[i + 3]
    if (a < 160) continue
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    if (max < 35 || min > 235 || max - min < 18) continue
    const qr = Math.round(r / 32) * 32
    const qg = Math.round(g / 32) * 32
    const qb = Math.round(b / 32) * 32
    const key = `${qr},${qg},${qb}`
    buckets.set(key, (buckets.get(key) || 0) + 1)
  }
  const ranked = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const parsed = ranked.map(([key]) => key.split(',').map(Number))
  if (!parsed.length) return ['#635bff', '#22d3ee']
  const primary = parsed[0]
  const secondary = parsed.find((c) => Math.abs(c[0]-primary[0]) + Math.abs(c[1]-primary[1]) + Math.abs(c[2]-primary[2]) > 110) || parsed[1] || [34,211,238]
  return [toHex(...primary), toHex(...secondary)]
}

export default function BrandStudio({ action, guildId, logoUrl, brand = {}, modules = [], allModules = [] }) {
  const [primary, setPrimary] = useState(brand.primary || '#635bff')
  const [secondary, setSecondary] = useState(brand.secondary || '#22d3ee')
  const [status, setStatus] = useState('')
  const selected = useMemo(() => new Set(modules), [modules])

  async function useLogoColors() {
    if (!logoUrl) {
      setStatus('Upload a guild logo first, then return here.')
      return
    }
    setStatus('Reading logo colors…')
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = logoUrl
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = 48
      canvas.height = 48
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, 48, 48)
      const [a, b] = dominantColors(ctx.getImageData(0, 0, 48, 48).data)
      setPrimary(a)
      setSecondary(b)
      setStatus('Palette generated from the guild logo. Save to apply it.')
    } catch {
      setStatus('Could not sample this logo automatically. Choose colors manually.')
    }
  }

  return (
    <form action={action} style={{ display: 'grid', gap: 18 }}><input type="hidden" name="guild_id" value={guildId} />
      <section className="panel panel-pad">
        <div className="section-head">
          <div><h2>Logo-derived palette</h2><p>COMMANDER can theme both Guild Ops and the public recruitment site from the guild identity.</p></div>
          <button type="button" className="button ghost" onClick={useLogoColors}>Use logo colors</button>
        </div>
        {status ? <div className="notice" style={{ marginBottom: 14 }}>{status}</div> : null}
        <div className="form-grid">
          <label className="field"><span>Primary accent</span><input type="color" name="primary" value={primary} onChange={(e) => setPrimary(e.target.value)} /></label>
          <label className="field"><span>Secondary accent</span><input type="color" name="secondary" value={secondary} onChange={(e) => setSecondary(e.target.value)} /></label>
          <label className="field"><span>Typography</span><select name="font_style" defaultValue={brand.fontStyle || 'modern'}>{fontOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="field"><span>Interface corners</span><select name="radius" defaultValue={brand.radius || '12'}><option value="6">Sharp</option><option value="12">Balanced</option><option value="18">Soft</option></select></label>
        </div>
      </section>

      <section className="panel panel-pad">
        <div className="section-head"><div><h2>Overview Studio</h2><p>Choose which operational modules officers see on the guild overview. This configuration is stored for the guild.</p></div></div>
        <div className="brand-module-grid">
          {allModules.map((item) => <label key={item.id} className="brand-module-option"><input type="checkbox" name="overview_modules" value={item.id} defaultChecked={selected.has(item.id)} /><span><strong>{item.label}</strong><small>{item.id}</small></span></label>)}
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="button" type="submit">Save COMMANDER appearance</button></div>
    </form>
  )
}
