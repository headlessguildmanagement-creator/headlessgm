import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'
import { signOut } from './actions'

export default async function AppHome() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    redirect('/login')
  }

  const claims = data.claims

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '48px 24px',
      }}
    >
      <div style={{ width: 'min(900px, 100%)', margin: '0 auto', display: 'grid', gap: 32 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'center' }}>
          <div>
            <p className="eyebrow">HeadlessGM App</p>
            <h1 style={{ fontSize: 48, lineHeight: 1, letterSpacing: '-0.04em' }}>Authentication works.</h1>
          </div>
          <form action={signOut}>
            <button type="submit" style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer' }}>
              Sign out
            </button>
          </form>
        </header>

        <section
          style={{
            border: '1px solid #232832',
            borderRadius: 16,
            padding: 24,
            background: '#11151a',
          }}
        >
          <p style={{ marginTop: 0, color: '#8893a1' }}>Discord identity connected</p>
          <p style={{ marginBottom: 8 }}><strong>Email:</strong> {claims.email || 'Not supplied'}</p>
          <p style={{ margin: 0 }}><strong>User ID:</strong> {claims.sub}</p>
        </section>

        <p style={{ color: '#727d8c', margin: 0 }}>
          Next milestone: create the guild workspace, apply the Ragnarok Origin Classic preset, and connect a Discord server.
        </p>
      </div>
    </main>
  )
}
