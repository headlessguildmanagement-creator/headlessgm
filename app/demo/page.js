import Link from 'next/link'
import DemoWorkspace from '../../components/demo-workspace'

export const metadata = {
  title: 'HeadlessGM Demo',
  description: 'Try HeadlessGM without an account. Demo data is stored only in your browser.',
}

export default function DemoPage() {
  return (
    <main className="demo-page">
      <header className="demo-page-nav">
        <Link href="/" className="marketing-brand"><span className="marketing-brand-mark">H</span><span><strong>HEADLESSGM</strong><small>INTERACTIVE DEMO</small></span></Link>
        <div><Link href="/" className="button ghost">Back to website</Link><Link href="/login" className="button">Create workspace</Link></div>
      </header>
      <section className="demo-page-intro">
        <p className="eyebrow">TRY THE PRODUCT</p>
        <h1>Run HeadlessGM before you create an account.</h1>
        <p>This demo never writes to HeadlessGM servers. Your demo roster, attendance, bidders, applicants and Commander styling are saved only in this browser.</p>
      </section>
      <DemoWorkspace />
    </main>
  )
}
