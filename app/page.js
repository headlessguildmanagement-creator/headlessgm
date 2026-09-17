import { KineticTextReveal } from "../components/ui/kinetic-text-reveal";
import { MagnetLines } from "../components/ui/magnet-lines";
import { HomepageModuleDock } from "../components/home/homepage-module-dock";

const stats = [
  { value: "80", label: "Members" },
  { value: "12", label: "Upcoming Events" },
  { value: "94%", label: "Attendance" },
];

const activity = [
  ["Attendance", "6 members currently on LOA"],
  ["Lineup", "Main Raid ready for review"],
  ["Rewards", "Rotation eligibility updated"],
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#" aria-label="HeadlessGM home">
          <span className="wordmark__headless">Headless</span>
          <span className="wordmark__gm">GM</span>
        </a>

        <nav className="site-nav" aria-label="Primary navigation">
          <a href="#features">Features</a>
          <a href="#system">How It Works</a>
          <a href="#customization">Customization</a>
          <a href="/demo">Demo</a>
        </nav>

        <a className="button button--small" href="/demo">
          Try Demo
        </a>
      </header>

      <section className="hero">
        <div className="hero__glow" aria-hidden="true" />
        <div className="hero__magnet-field" aria-hidden="true">
          <MagnetLines rows={5} columns={8} />
        </div>
        <div className="hero__content">
          <p className="eyebrow">Headless Guild Management</p>
          <h1>
            <KineticTextReveal
              text="Run the guild."
              className="kinetic-line"
              splitBy="words"
              delay={0.08}
              stagger={0.08}
            />
            <KineticTextReveal
              text="Not the spreadsheet."
              className="kinetic-line kinetic-line--accent"
              splitBy="words"
              delay={0.28}
              stagger={0.075}
            />
          </h1>
          <p className="hero__copy">
            A fully customizable guild management system built around how your
            guild actually plays. Members, events, attendance, teams, rewards,
            rotations and communication — connected.
          </p>

          <div className="hero__actions">
            <a className="button" href="/demo">
              Try Interactive Demo
            </a>
            <a className="button button--secondary" href="#features">
              Explore HeadlessGM
            </a>
          </div>

          <p className="hero__note">
            Different games. Different rules. One configurable system.
          </p>
        </div>

        <div className="product-stage" aria-label="HeadlessGM interface preview">
          <div className="product-window">
            <div className="product-window__bar">
              <div className="product-window__brand">
                <span className="brand-dot">H</span>
                <span>Headless<span>GM</span></span>
              </div>
              <div className="product-window__search">Search guild operations</div>
              <div className="avatar">GM</div>
            </div>

            <div className="product-window__body">
              <aside className="app-nav">
                <span className="app-nav__active">Overview</span>
                <span>Members</span>
                <span>Events</span>
                <span>Attendance</span>
                <span>Lineups</span>
                <span>Rewards</span>
                <span>History</span>
                <span>Configuration</span>
              </aside>

              <section className="dashboard">
                <div className="dashboard__heading">
                  <div>
                    <p className="dashboard__eyebrow">DEMO GUILD</p>
                    <h2>Good to see you, Commander.</h2>
                    <p>Your guild. Your rules. Built for what&apos;s next.</p>
                  </div>
                  <span className="sample-pill">Sample Configuration</span>
                </div>

                <div className="stats-grid">
                  {stats.map((stat) => (
                    <article className="stat-card" key={stat.label}>
                      <strong>{stat.value}</strong>
                      <span>{stat.label}</span>
                    </article>
                  ))}
                </div>

                <div className="dashboard-grid">
                  <article className="event-card">
                    <p className="card-label">NEXT EVENT</p>
                    <div className="event-card__row">
                      <div className="event-art" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </div>
                      <div>
                        <h3>Guild League</h3>
                        <p>Tonight · Sample event</p>
                      </div>
                      <button type="button">View Event</button>
                    </div>
                  </article>

                  <article className="activity-card">
                    <p className="card-label">CONNECTED SYSTEM</p>
                    <div className="activity-list">
                      {activity.map(([label, text]) => (
                        <div className="activity-row" key={label}>
                          <span>{label}</span>
                          <p>{text}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      <HomepageModuleDock />

      <section className="brand-strip" id="features">
        <p>Flexible</p>
        <p>Connected</p>
        <p>Community-focused</p>
        <p>Reliable</p>
        <p>Customizable</p>
      </section>

      <section className="statement" id="system">
        <p className="eyebrow">The operating layer behind the guild</p>
        <h2>
          More than tools.
          <span>A stronger guild.</span>
        </h2>
        <p>
          HeadlessGM connects the operational pieces that usually live across
          spreadsheets, chat messages, screenshots and officer notes — so one
          change can update everywhere it matters.
        </p>
      </section>

      <section className="configuration-preview" id="customization">
        <div>
          <p className="eyebrow">Fully customizable</p>
          <h2>The system adapts to the guild.</h2>
          <p>
            Terminology, attendance rules, team structures, reward strategies,
            permissions and workflows are configuration — not assumptions.
          </p>
        </div>
        <div className="config-pills" aria-label="Configuration examples">
          <span>Guild structure</span>
          <span>Events</span>
          <span>Attendance</span>
          <span>Teams</span>
          <span>Rewards</span>
          <span>Permissions</span>
          <span>Branding</span>
          <span>Integrations</span>
        </div>
      </section>
    </main>
  );
}
