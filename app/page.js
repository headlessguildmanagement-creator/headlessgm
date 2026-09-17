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

const features = [
  ["Members", "Roster, roles and status"],
  ["Events", "Schedules, signups and deadlines"],
  ["Attendance", "Present, absent and LOA"],
  ["Teams", "Parties, raids and lineups"],
  ["Rewards", "Queues, rotations and eligibility"],
  ["History", "Changes, results and decisions"],
];

const workflow = [
  ["01", "LOA filed", "Member marked unavailable"],
  ["02", "Lineup reacts", "Open slot becomes visible"],
  ["03", "Eligibility follows", "Reward state stays aligned"],
  ["04", "History records it", "One shared timeline"],
];

const configuration = [
  "Terminology",
  "Team sizes",
  "Event rules",
  "Reward logic",
  "Permissions",
  "Branding",
];

const communities = ["Guilds", "Clans", "Raid groups", "Alliances"];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand-logo" href="#" aria-label="HeadlessGM home">
          <img
            src="/brand/headlessgm-logo-white.svg"
            alt="HeadlessGM"
            width="848"
            height="199"
          />
        </a>

        <nav className="site-nav" aria-label="Primary navigation">
          <a href="#features">Features</a>
          <a href="#connected">Connected</a>
          <a href="#customization">Customization</a>
        </nav>

        <a className="button button--small" href="/demo">
          Try Demo
        </a>
      </header>

      <section className="hero">
        <div className="hero__glow" aria-hidden="true" />
        <div className="hero__content">
          <p className="eyebrow">Headless Guild Management</p>
          <h1>
            Run the guild.
            <span>Not the spreadsheet.</span>
          </h1>
          <p className="hero__copy">
            Members, events, attendance, teams and rewards — connected in one
            system built around how your guild actually plays.
          </p>

          <div className="hero__actions">
            <a className="button" href="/demo">
              Try Interactive Demo
            </a>
            <a className="button button--secondary" href="#features">
              See What It Does
            </a>
          </div>

          <div className="hero__proof">
            <span>Game-agnostic</span>
            <span>Modular</span>
            <span>Built for guild operations</span>
          </div>
        </div>

        <div className="product-stage" aria-label="HeadlessGM interface preview">
          <div className="product-window">
            <div className="product-window__bar">
              <div className="product-window__brand">
                <img
                  src="/brand/headlessgm-logo-white.svg"
                  alt=""
                  width="848"
                  height="199"
                />
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
              </aside>

              <section className="dashboard">
                <div className="dashboard__heading">
                  <div>
                    <p className="dashboard__eyebrow">DEMO GUILD</p>
                    <h2>Good to see you, Commander.</h2>
                    <p>Your guild. Your rules.</p>
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
                        <p>Tonight · 8:30 PM</p>
                      </div>
                      <span className="mini-action">View Event</span>
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

      <section className="brand-strip" aria-label="HeadlessGM principles">
        <p>Flexible</p>
        <p>Connected</p>
        <p>Community-first</p>
        <p>Reliable</p>
        <p>Customizable</p>
      </section>

      <section className="section platform-section" id="features">
        <div className="section-heading section-heading--split">
          <div>
            <p className="eyebrow">Everything your officers use every week</p>
            <h2>One place to run the guild.</h2>
          </div>
          <p>
            Stop rebuilding the same roster, attendance and event context in
            different tools.
          </p>
        </div>

        <div className="module-grid module-grid--compact">
          {features.map(([title, text], index) => (
            <article className="module-card module-card--compact" key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section propagation-section" id="connected">
        <div className="propagation-copy">
          <p className="eyebrow">One update. Everywhere it matters.</p>
          <h2>Less guild admin. More playing.</h2>
          <p>
            A member change should not become four separate officer tasks.
          </p>
        </div>

        <div className="propagation-list">
          {workflow.map(([number, title, text]) => (
            <div className="propagation-row propagation-row--compact" key={number}>
              <span>{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section customization-section" id="customization">
        <div className="section-heading section-heading--center">
          <p className="eyebrow">Your guild. Your rules.</p>
          <h2>The system adapts to how you play.</h2>
          <p>
            Different game? Different structure? Change the setup — not the
            whole platform.
          </p>
        </div>

        <div className="config-chip-grid">
          {configuration.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>

        <div className="community-line">
          <span>Built for</span>
          {communities.map((item) => (
            <strong key={item}>{item}</strong>
          ))}
        </div>
      </section>

      <section className="demo-band">
        <div>
          <p className="eyebrow">See it working</p>
          <h2>Use the demo. Break the demo. Reset the demo.</h2>
          <p>Fictional guild data. Real HeadlessGM workflow.</p>
        </div>
        <a className="button" href="/demo">
          Launch Interactive Demo
        </a>
      </section>

      <footer className="site-footer">
        <div>
          <img
            src="/brand/headlessgm-logo-white.svg"
            alt="HeadlessGM"
            width="848"
            height="199"
          />
          <p>Guilds run better here.</p>
        </div>
        <div className="footer-links">
          <a href="#features">Features</a>
          <a href="#customization">Customization</a>
          <a href="/demo">Demo</a>
        </div>
        <p className="footer-note">Communities create greater adventures.</p>
      </footer>
    </main>
  );
}
