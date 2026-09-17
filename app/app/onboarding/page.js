import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { createGuild } from './actions'

export default async function OnboardingPage({ searchParams }) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()

  if (authError || !authData?.claims?.sub) {
    redirect('/login')
  }

  const { data: guilds } = await supabase.from('guilds').select('id').limit(1)

  if (guilds?.length) {
    redirect('/app')
  }

  const params = await searchParams
  const error = params?.error ? String(params.error) : ''

  return (
    <main style={{ minHeight: '100vh', padding: '48px 24px' }}>
      <div style={{ width: 'min(760px, 100%)', margin: '0 auto', display: 'grid', gap: 28 }}>
        <header>
          <p className="eyebrow">HeadlessGM Setup</p>
          <h1 style={{ fontSize: 52, lineHeight: 1, letterSpacing: '-0.04em' }}>Create your guild workspace.</h1>
          <p className="lede" style={{ fontSize: 18, marginTop: 18 }}>
            We’ll start with the Ragnarok Origin Classic preset. You can connect Discord after the guild workspace exists.
          </p>
        </header>

        <section style={{ border: '1px solid #232832', borderRadius: 16, padding: 24, background: '#11151a' }}>
          <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
            <strong>ROOC preset</strong>
            <span style={{ color: '#8893a1' }}>80 active members · 40-player raid · 8 parties · 5 players per party · Main + Sub</span>
            <span style={{ color: '#8893a1' }}>Beta access is applied automatically during the initial HeadlessGM beta.</span>
          </div>

          <form action={createGuild} style={{ display: 'grid', gap: 14 }}>
            <label htmlFor="name" style={{ fontWeight: 700 }}>Guild name</label>
            <input
              id="name"
              name="name"
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. Havoc"
              autoComplete="organization"
              style={{
                width: '100%',
                border: '1px solid #303742',
                borderRadius: 12,
                background: '#0b0d10',
                color: '#f5f7fa',
                padding: '14px 16px',
                fontSize: 16,
              }}
            />

            {error ? <p style={{ margin: 0, color: '#fca5a5', fontSize: 14 }}>{error}</p> : null}

            <button type="submit" style={{ marginTop: 6, border: 0, borderRadius: 12, padding: '14px 18px', fontWeight: 800, cursor: 'pointer' }}>
              Create ROOC Guild
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
