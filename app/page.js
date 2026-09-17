import Link from 'next/link'

export default function Home() {
  return (
    <main className="bootstrap">
      <div className="bootstrap__content">
        <p className="eyebrow">Headless Guild Management</p>
        <h1>HeadlessGM</h1>
        <p className="lede">
          Run your guild operations from one workspace, with Discord connected as
          the interaction layer.
        </p>
        <div style={{ marginTop: 24 }}>
          <Link
            href="/login"
            style={{
              display: 'inline-block',
              borderRadius: 12,
              padding: '14px 18px',
              fontSize: 16,
              fontWeight: 700,
              textDecoration: 'none',
              background: 'white',
              color: 'black',
            }}
          >
            Continue with Discord
          </Link>
        </div>
      </div>
    </main>
  )
}
