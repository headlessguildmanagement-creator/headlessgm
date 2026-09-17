export default function AuthCodeErrorPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <section style={{ width: 'min(560px, 100%)', display: 'grid', gap: 16 }}>
        <p className="eyebrow">HeadlessGM Authentication</p>
        <h1 style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.04em' }}>Discord sign-in failed.</h1>
        <p className="lede" style={{ fontSize: 18, marginTop: 0 }}>
          The OAuth callback could not create a Supabase session. Return to the login page and try again.
        </p>
        <a href="/login" style={{ color: '#c4b5fd', fontWeight: 700 }}>
          Back to login
        </a>
      </section>
    </main>
  )
}
