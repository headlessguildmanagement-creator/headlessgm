import { redirect } from 'next/navigation'
import LoginButton from './login-button'
import ThemeToggle from '../../components/theme-toggle'
import { createClient } from '../../lib/supabase/server'

export default async function LoginPage({ searchParams }) {
  const params = await searchParams
  const requestedNext = String(params?.next || '/app')
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/app'
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (!error && data?.claims) redirect(next)

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section className="panel panel-pad" style={{ width: 'min(460px, 100%)', display: 'grid', gap: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><ThemeToggle /></div>
        <div>
          <p className="eyebrow">Headless Guild Management</p>
          <h1 style={{ fontSize: 42, lineHeight: 1, letterSpacing: '-0.03em', margin: '6px 0 12px' }}>HeadlessGM</h1>
          <p className="lede" style={{ fontSize: 16, margin: 0 }}>Create or access your guild workspace. Discord is recommended because it also becomes your member identity and guild control surface, but Google and email/password accounts are supported too.</p>
        </div>
        <LoginButton next={next} />
      </section>
    </main>
  )
}
