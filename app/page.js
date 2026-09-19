import Link from 'next/link'
import ThemeToggle from '../components/theme-toggle'

const plans = [
  {
    name: 'FREE',
    price: '$0',
    suffix: '/month',
    annual: '$0/year',
    description: 'For trying HeadlessGM with a real guild workspace.',
    features: ['Guild workspace', 'Roster & member identity', 'Events, LOA & attendance', 'Lineup operations', 'Standard auction presets'],
    cta: 'Start Free',
  },
  {
    name: 'GUILD',
    price: '$15.99',
    suffix: '/month',
    annual: '$143.91/year · 25% annual discount',
    description: 'For active guilds that want the full operating workflow.',
    features: ['Everything in Free', 'Recruitment workflow', 'Discord operations', 'Persistent Puppet & Feather state', 'History, audits & guild backup'],
    cta: 'Choose Guild',
    featured: true,
  },
  {
    name: 'COMMANDER',
    price: '$24.99',
    suffix: '/month',
    annual: '$224.91/year · 25% annual discount',
    description: 'For guilds that need fully configurable operating rules.',
    features: ['Everything in Guild', 'Custom auction rules', 'Custom allocation methods', 'Advanced rule configuration', 'Granular operations control'],
    cta: 'Choose Commander',
  },
]

const workflow = [
  ['01', 'Roster', 'Import or maintain persistent member identity without tying history to IGN changes.'],
  ['02', 'Event', 'Create guild events with timezone-aware attendance and LOA deadlines.'],
  ['03', 'Lineup', 'Build Main/Sub parties, catch unavailable members and spot party composition issues.'],
  ['04', 'Auction', 'Generate rules-based bidder pools, caps, Puppet turns and Feather allocation.'],
  ['05', 'Publish', 'Review first, then deliberately publish lineup and auction output to Discord.'],
  ['06', 'History', 'Finalize once. Preserve event records, cycles, audit state and guild history.'],
]

const features = [
  ['Roster & Identity', 'Persistent member records, import tools, job/role data, Discord links and member lifecycle history.'],
  ['Attendance & LOA', 'Exception-based or configurable attendance policy with event-scoped LOA and no-show tracking.'],
  ['Main / Sub Lineups', 'Dense 8×5 party operations, previous-lineup reuse, availability checks and composition warnings.'],
  ['Puppet Rotation', 'Persistent A–Z queue, cycle progress, Cannot Bid, make-up turns, appeals and rollover behavior.'],
  ['Feather Allocation', 'Permanent groups, calendar rotation, per-person caps, No Gold / 96H exclusions and officer excess rotation.'],
  ['Recruitment', 'Public application page, applicant portal, officer review, private conversation and roster onboarding.'],
  ['Discord Operations', 'Reconnectable Discord workspace, control channel, recruitment channel and officer operations channel.'],
  ['Audit & Backup', 'Event history, cycle history, immutable published state and guild backup export.'],
]

export default function Home() {
  return (
    <main className="marketing-page">
      <header className="marketing-nav">
        <Link href="/" className="marketing-brand" aria-label="HeadlessGM home">
          <span className="marketing-brand-mark">H</span>
          <span><strong>HEADLESSGM</strong><small>HEADLESS GUILD MANAGEMENT</small></span>
        </Link>
        <nav className="marketing-links" aria-label="Primary navigation">
          <a href="#product">Product</a>
          <a href="#workflow">Workflow</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="marketing-nav-actions">
          <ThemeToggle />
          <Link href="/login" className="button ghost">Sign in</Link>
          <Link href="/login" className="button">Start Free</Link>
        </div>
      </header>

      <section className="marketing-hero">
        <div className="marketing-hero-copy">
          <p className="eyebrow">Guild operations without the spreadsheet mess</p>
          <h1>Run the guild.<br/><span>Keep the system.</span></h1>
          <p className="marketing-hero-lede">
            HeadlessGM gives officers one operating system for roster, attendance, lineups, auctions,
            recruitment, Discord publication and persistent guild history.
          </p>
          <div className="marketing-hero-actions">
            <Link href="/login" className="button marketing-primary">Start Free</Link>
            <a href="#product" className="button ghost">See the product</a>
          </div>
          <div className="marketing-proof">
            <span>Built around a proven live guild workflow</span>
            <span>Light / Dark / System</span>
            <span>Multi-tenant by design</span>
          </div>
        </div>

        <div className="marketing-product-shot" aria-label="HeadlessGM product preview">
          <div className="product-shot-top">
            <div className="product-shot-brand"><span className="product-dot"/><strong>HAVOC</strong><small>HeadlessGM workspace</small></div>
            <span className="pill">EVENT COMMAND</span>
          </div>
          <div className="product-shot-grid">
            <aside className="product-shot-sidebar">
              <span className="active">Overview</span>
              <span>Members</span>
              <span>Events</span>
              <span>Auctions</span>
              <span>Recruitment</span>
              <span>History</span>
              <span>Discord</span>
              <span>Settings</span>
            </aside>
            <div className="product-shot-main">
              <div className="product-shot-heading">
                <div><small>CURRENT EVENT</small><strong>Guild League</strong></div>
                <span className="pill">FEATHER GROUP 4</span>
              </div>
              <div className="product-metrics">
                <div><small>EXPECTED</small><strong>72</strong></div>
                <div><small>LOA / NO-SHOW</small><strong>8</strong></div>
                <div><small>LINEUP</small><strong>64</strong></div>
                <div><small>PUPPET CYCLE</small><strong>3</strong></div>
              </div>
              <div className="product-shot-panel">
                <div className="product-shot-panel-head"><strong>Officer checks</strong><span>2 alerts</span></div>
                <div className="product-row"><strong>Main · Party 3</strong><span>4/5 assigned · Support required</span></div>
                <div className="product-row"><strong>Feather</strong><span>Permanent group rotation ready</span></div>
              </div>
              <div className="product-shot-panel">
                <div className="product-shot-panel-head"><strong>Next Puppet bidders</strong><span>Cycle 3</span></div>
                <div className="product-bidders">
                  <span>1 · Aster</span><span>2 · Belial</span><span>3 · Ciel</span><span>4 · Doppio</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-trust-strip">
        <span>Roster</span><span>Attendance</span><span>Lineups</span><span>Auctions</span><span>Recruitment</span><span>Discord</span><span>History</span>
      </section>

      <section id="product" className="marketing-section">
        <div className="marketing-section-head">
          <p className="eyebrow">One operating system</p>
          <h2>Everything officers already do — in one place.</h2>
          <p>HeadlessGM keeps the operational chain connected instead of spreading it across spreadsheets, chat threads, screenshots and bot commands.</p>
        </div>
        <div className="feature-grid">
          {features.map(([title, text]) => <article key={title} className="feature-card"><span className="feature-card-mark">+</span><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>

      <section id="workflow" className="marketing-section marketing-section-alt">
        <div className="marketing-section-head">
          <p className="eyebrow">The operating flow</p>
          <h2>Roster → Event → Lineup → Auction → Discord → History.</h2>
          <p>The guild does not need a different tool for every step. HeadlessGM carries state forward and only advances persistent rotations when the event is finalized.</p>
        </div>
        <div className="workflow-grid">
          {workflow.map(([number, title, text]) => <article key={number} className="workflow-step"><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-split">
          <div>
            <p className="eyebrow">Auction system</p>
            <h2>Rules that survive the event.</h2>
            <p className="marketing-copy">HeadlessGM supports standard methods such as FFA, 4 Group Rotation, Round Robin and Random, with configurable per-person limits for Light/Dark Feather, Time/Space Feather, Puppet Fragment and Illusion Fragment.</p>
            <p className="marketing-copy">Persistent Puppet cycles, Feather groups and officer excess rotation are stored as guild state — not rebuilt from scratch every event.</p>
            <Link href="/login" className="button">Create your workspace</Link>
          </div>
          <div className="auction-preview panel">
            <div className="auction-preview-head"><div><small>AUCTION DRAFT</small><strong>Guild League · Rewards</strong></div><span className="pill">REVIEW</span></div>
            <div className="auction-preview-row"><span>Light / Dark Feather</span><strong>4 Group Rotation</strong><em>Cap 2 / person</em></div>
            <div className="auction-preview-row"><span>Time / Space Feather</span><strong>4 Group Rotation</strong><em>Cap 1 / person</em></div>
            <div className="auction-preview-row"><span>Puppet Fragment</span><strong>Round Robin</strong><em>Cycle 3</em></div>
            <div className="auction-preview-row"><span>Illusion Fragment</span><strong>FFA</strong><em>Unlimited</em></div>
            <div className="auction-preview-foot">Generate → Officer review → Publish → Finalize</div>
          </div>
        </div>
      </section>

      <section id="pricing" className="marketing-section marketing-section-alt">
        <div className="marketing-section-head">
          <p className="eyebrow">Pricing</p>
          <h2>Start free. Upgrade when the guild needs more control.</h2>
          <p>Annual billing is paid upfront and includes a 25% discount on paid plans.</p>
        </div>
        <div className="pricing-grid">
          {plans.map((plan) => <article key={plan.name} className={plan.featured ? 'pricing-card featured' : 'pricing-card'}>
            {plan.featured ? <span className="pricing-badge">MOST POPULAR</span> : null}
            <p className="eyebrow">{plan.name}</p>
            <div className="pricing-price"><strong>{plan.price}</strong><span>{plan.suffix}</span></div>
            <p className="pricing-annual">{plan.annual}</p>
            <p>{plan.description}</p>
            <div className="pricing-features">{plan.features.map((feature) => <span key={feature}>✓ {feature}</span>)}</div>
            <Link href="/login" className={plan.featured ? 'button' : 'button ghost'}>{plan.cta}</Link>
          </article>)}
        </div>
        <div className="pricing-note"><strong>COMMANDER</strong> unlocks custom auction methods and custom rules. Standard presets remain available on lower tiers according to plan capability.</div>
      </section>

      <section className="marketing-section">
        <div className="discord-banner">
          <div>
            <p className="eyebrow">Discord connected, not Discord-dependent</p>
            <h2>Your guild data stays in HeadlessGM.</h2>
            <p>Use Discord for member identity and communication. Reconnect the workspace to another Discord server without resetting roster, event history or auction state.</p>
          </div>
          <div className="discord-channels">
            <span>HEADLESSGM</span>
            <strong># headlessgm</strong>
            <strong># recruitment</strong>
            <strong># officer-ops</strong>
          </div>
        </div>
      </section>

      <section id="faq" className="marketing-section marketing-section-alt">
        <div className="marketing-section-head"><p className="eyebrow">FAQ</p><h2>Built for guild operations, not generic project management.</h2></div>
        <div className="faq-grid">
          <article><h3>Does Discord become the source of truth?</h3><p>No. HeadlessGM keeps the authoritative roster, event, lineup, auction and history state. Discord is the interaction and publication layer.</p></article>
          <article><h3>Can we change auction rules later?</h3><p>Yes. New events use the active guild rules while generated runs keep a snapshot so historical results do not rewrite themselves.</p></article>
          <article><h3>Can officers reconnect Discord?</h3><p>The guild owner can reconnect the HeadlessGM workspace to a different Discord server without deleting guild operational data.</p></article>
          <article><h3>Is HeadlessGM only for one game?</h3><p>No. The core platform is generic. Game presets and guild rule configuration define the operational behavior.</p></article>
        </div>
      </section>

      <section className="marketing-final-cta">
        <p className="eyebrow">Headless Guild Management</p>
        <h2>Stop rebuilding guild state every event.</h2>
        <p>Run the roster, event, lineup, auction and history as one connected operating system.</p>
        <div className="marketing-hero-actions"><Link href="/login" className="button marketing-primary">Start Free</Link><Link href="/login" className="button ghost">Sign in</Link></div>
      </section>

      <footer className="marketing-footer">
        <div className="marketing-brand"><span className="marketing-brand-mark">H</span><span><strong>HEADLESSGM</strong><small>HEADLESS GUILD MANAGEMENT</small></span></div>
        <p>Guild operations, without the operational mess.</p>
        <div><a href="#product">Product</a><a href="#pricing">Pricing</a><Link href="/login">Sign in</Link></div>
      </footer>
    </main>
  )
}
