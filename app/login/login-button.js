'use client'

import { useState } from 'react'
import { createClient } from '../../lib/supabase/client'

export default function LoginButton() {
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function signInWithDiscord() {
    setLoading(true)
    setErrorMessage('')

    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=/app`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo,
        scopes: 'identify email guilds',
      },
    })

    if (error) {
      setErrorMessage(error.message)
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <button
        type="button"
        onClick={signInWithDiscord}
        disabled={loading}
        style={{
          border: 0,
          borderRadius: 12,
          padding: '14px 18px',
          fontSize: 16,
          fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {loading ? 'Connecting…' : 'Continue with Discord'}
      </button>
      {errorMessage ? (
        <p style={{ margin: 0, color: '#fca5a5', fontSize: 14 }}>{errorMessage}</p>
      ) : null}
    </div>
  )
}
