import { redirect } from 'next/navigation'
import LoginButton from './login-button'
import { createClient } from '../../lib/supabase/server'

export default async function LoginPage({ searchParams }) {
  const params = await searchParams
  const requestedNext = String(params?.next || '/app')
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/app'
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (!error && data?.claims) {
    redirect(next)
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <section style={{ width: 'min(440px, 100%)', display: 'grid', gap: 24 }}>
        <div>
          <p className="eyebrow">Headless Guild Management</p>
          <h1 style={{ fontSize: 48, lineHeight: 1, letterSpacing: '-0.04em' }}>HeadlessGM</h1>
          <p className="lede" style={{ fontSize: 18, marginTop: 18 }}>
            Sign in with Discord to continue.
          </p>
        </div>
        <LoginButton next={next} />
      </section>
    </main>
  )
}
