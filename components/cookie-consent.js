'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'hgm-cookie-consent-v1'
const defaults = { necessary: true, preferences: false, analytics: false, marketing: false }

function readConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : null
  } catch {
    return null
  }
}

function writeConsent(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaults, ...value, necessary: true, analytics: false, marketing: false }))
  window.dispatchEvent(new Event('hgm-cookie-consent-changed'))
}

export function CookieSettingsPanel() {
  const [settings, setSettings] = useState(defaults)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSettings(readConsent() || defaults)
  }, [])

  function save() {
    writeConsent(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <section className="cookie-settings-panel">
      <div className="cookie-setting-row"><div><strong>Essential</strong><p>Authentication, security, session continuity and your cookie choices. These are required for HeadlessGM to work.</p></div><span className="pill">ALWAYS ON</span></div>
      <div className="cookie-setting-row"><div><strong>Preferences</strong><p>Remembers choices you explicitly make, such as interface preferences. HeadlessGM does not use this category for advertising.</p></div><label className="cookie-toggle"><input type="checkbox" checked={settings.preferences} onChange={(e) => setSettings({ ...settings, preferences: e.target.checked })}/><span>{settings.preferences ? 'Allowed' : 'Off'}</span></label></div>
      <div className="cookie-setting-row"><div><strong>Analytics</strong><p>HeadlessGM currently does not set analytics cookies.</p></div><span className="pill">NOT IN USE</span></div>
      <div className="cookie-setting-row"><div><strong>Marketing</strong><p>HeadlessGM currently does not set advertising or cross-site marketing cookies.</p></div><span className="pill">NOT IN USE</span></div>
      <div className="operator-actions"><button type="button" className="button" onClick={save}>Save cookie settings</button>{saved ? <span className="muted">Saved.</span> : null}</div>
    </section>
  )
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)
  const [customize, setCustomize] = useState(false)

  useEffect(() => {
    setVisible(!readConsent())
  }, [])

  if (!visible) return null

  function choose(preferences) {
    writeConsent({ ...defaults, preferences })
    setVisible(false)
  }

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie choices">
      <div>
        <strong>HeadlessGM cookie choices</strong>
        <p>We use essential session and security storage so HeadlessGM works. We do not currently use analytics or advertising cookies. You can optionally allow preference storage.</p>
        <div className="cookie-banner-links"><Link href="/legal/cookies">Cookie Policy</Link><Link href="/legal/privacy">Privacy Policy</Link></div>
      </div>
      {customize ? <CookieSettingsPanel /> : null}
      <div className="cookie-banner-actions">
        <button type="button" className="button ghost" onClick={() => choose(false)}>Necessary only</button>
        <button type="button" className="button" onClick={() => choose(true)}>Allow preferences</button>
        <button type="button" className="button ghost" onClick={() => setCustomize(!customize)}>{customize ? 'Close settings' : 'Customize'}</button>
      </div>
    </div>
  )
}
