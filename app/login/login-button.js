'use client'

import { useState } from 'react'
import { createClient } from '../../lib/supabase/client'

export default function LoginButton({ next = '/app' }) {
  const [errorMessage, setErrorMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState('')
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function safeNext() {
    return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/app'
  }

  async function oauth(provider) {
    setLoading(provider)
    setErrorMessage('')
    setNotice('')
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext())}`
    const options = { redirectTo }
    if (provider === 'discord') options.scopes = 'identify email guilds'
    const { error } = await supabase.auth.signInWithOAuth({ provider, options })
    if (error) {
      setErrorMessage(error.message)
      setLoading('')
    }
  }

  async function emailAuth(event) {
    event.preventDefault()
    setLoading('email')
    setErrorMessage('')
    setNotice('')
    const supabase = createClient()

    if (mode === 'signup') {
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext())}`
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } })
      if (error) setErrorMessage(error.message)
      else if (data?.session) window.location.assign(safeNext())
      else setNotice('Account created. Check your email to confirm your address, then return to HeadlessGM.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setErrorMessage(error.message)
      else window.location.assign(safeNext())
    }
    setLoading('')
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <button type="button" className="button" onClick={() => oauth('discord')} disabled={Boolean(loading)} style={{ width: '100%', padding: '13px 16px' }}>
        {loading === 'discord' ? 'Connecting…' : 'Continue with Discord · Recommended'}
      </button>
      <button type="button" className="button ghost" onClick={() => oauth('google')} disabled={Boolean(loading)} style={{ width: '100%', padding: '13px 16px' }}>
        {loading === 'google' ? 'Connecting…' : 'Continue with Google'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ height: 1, background: 'var(--line)', flex: 1 }} /><span className="muted" style={{ fontSize: 12 }}>OR EMAIL</span><span style={{ height: 1, background: 'var(--line)', flex: 1 }} /></div>

      <div className="theme-switcher" style={{ width: '100%' }}>
        <button type="button" className={mode === 'signin' ? 'theme-switcher__button is-active' : 'theme-switcher__button'} style={{ flex: 1 }} onClick={() => setMode('signin')}>Sign in</button>
        <button type="button" className={mode === 'signup' ? 'theme-switcher__button is-active' : 'theme-switcher__button'} style={{ flex: 1 }} onClick={() => setMode('signup')}>Create account</button>
      </div>

      <form onSubmit={emailAuth} style={{ display: 'grid', gap: 10 }}>
        <label className="field"><span>Email</span><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="field"><span>Password</span><input type="password" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button type="submit" className="button ghost" disabled={Boolean(loading)}>{loading === 'email' ? 'Working…' : mode === 'signup' ? 'Create account with email' : 'Sign in with email'}</button>
      </form>

      {notice ? <div className="notice success">{notice}</div> : null}
      {errorMessage ? <div className="notice error">{errorMessage}</div> : null}
    </div>
  )
}
