const stats = [
  { value: "80", label: "Active Members" },
  { value: "6", label: "LOA" },
  { value: "40/40", label: "Main Raid" },
];

const activity = [
  ["Sub Raid", "38 / 40 assigned"],
  ["Puppet", "4 members in queue"],
  ["Feathers", "Groups and rotation ready"],
];

const features = [
  ["Discord", "Connect the server, roles and roster"],
  ["LOA + Attendance", "Deadlines, status and voice checks"],
  ["Raid Lineup", "Main + Sub Raid with 8 × 5 parties"],
  ["Puppet", "Queue, turns and completed positions"],
  ["Feathers", "Permanent groups and rotation rules"],
  ["Rewards", "Eligibility, auctions and distributions"],
];

const onboarding = [
  ["01", "Continue with Discord", "Authorize HeadlessGM once"],
  ["02", "Choose your server", "Select the guild Discord"],
  ["03", "Select ROOC", "HeadlessGM loads ROOC structure"],
  ["04", "Import the roster", "Map Discord → IGN → Job"],
];

const workflow = [
  ["01", "LOA filed", "Member becomes unavailable"],
  ["02", "Lineup reacts", "Open party slot is visible"],
  ["03", "Eligibility follows", "Reward state stays aligned"],
  ["04", "Discord stays current", "Officers and members see the same state"],
];

const roocNative = [
  "80-member roster",
  "ROOC jobs + classes",
  "8 × 5 parties",
  "Main + Sub Raid",
  "Guild League",
  "Voice attendance",
  "Puppet queue",
  "Feather groups",
  "Auction distribution",
];

const plans = [
  ["FREE", "Up to 20 members", "Try the full HeadlessGM idea without running a complete ROOC guild."],
  ["GUILD", "Full 80-member guild", "Run your actual ROOC roster, raids, attendance and rewards."],
  ["COMMAND", "Automate operations", "Scheduled reminders, automated attendance and deeper workflows."],
];

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
          <a href="#features">ROOC Features</a>
          <a href="#discord">Discord Setup</a>
          <a href="#plans">Plans</a>
        </nav>

        <a className="button button--small" href="/demo">
          Try ROOC Demo
        </a>
      </header>

      <section className="hero">
        <div className="hero__glow" aria-hidden="true" />
        <div className="hero__content">
          <p className="eyebrow">HeadlessGM for Ragnarok Origin Classic</p>
          <h1>
            Run the guild.
            <span>Not the spreadsheet.</span>
          </h1>
          <p className="hero__copy">
            Roster, LOA, Guild League, Main/Sub raids, Puppet, Feathers and
            rewards — built around how an 80-member ROOC guild actually runs.
          </p>

          <div className="hero__actions">
            <a className="button" href="/demo">
              Try ROOC Demo
            </a>
            <a className="button button--secondary" href="#features">
              See ROOC Features
            </a>
          </div>

          <div className="hero__proof">
            <span>80-member guild</span>
            <span>8 × 5 Main/Sub Raid</span>
            <span>Discord-first</span>
          </div>
        </div>

        <div className="product-stage" aria-label="HeadlessGM ROOC interface preview">
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
              <div className="product-window__search">Search ROOC guild operations</div>
              <div className="avatar">GM</div>
            </div>

            <div className="product-window__body">
              <aside className="app-nav">
                <span className="app-nav__active">Overview</span>
                <span>Members</span>
                <span>Events</span>
                <span>Attendance</span>
                <span>Raid Lineup</span>
                <span>Rewards</span>
              </aside>

              <section className="dashboard">
                <div className="dashboard__heading">
                  <div>
                    <p className="dashboard__eyebrow">ROOC GUILD</p>
                    <h2>Good to see you, Commander.</h2>
                    <p>Ragnarok Origin Classic · 80-member roster</p>
                  </div>
                  <span className="sample-pill">Discord Connected ✓</span>
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
                        <p>Tonight · Call time 8:30 PM</p>
                      </div>
                      <span className="mini-action">View Lineup</span>
                    </div>
                  </article>

                  <article className="activity-card">
                    <p className="card-label">ROOC OPERATIONS</p>
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

      <section className="brand-strip" aria-label="ROOC product highlights">
        <p>80 Members</p>
        <p>8 × 5 Parties</p>
        <p>Main + Sub Raid</p>
        <p>LOA + Attendance</p>
        <p>Puppet + Feathers</p>
      </section>

      <section className="section platform-section" id="features">
        <div className="section-heading section-heading--split">
          <div>
            <p className="eyebrow">Built for Ragnarok Origin Classic</p>
            <h2>Your weekly guild work. Already understood.</h2>
          </div>
          <p>
            No generic setup language. HeadlessGM starts with the workflows a
            ROOC officer already recognizes.
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

      <section className="section propagation-section" id="discord">
        <div className="propagation-copy">
          <p className="eyebrow">Setup should be stupidly easy</p>
          <h2>Discord in. ROOC guild ready.</h2>
          <p>
            One HeadlessGM app. No bot tokens. No developer portal. Connect the
            server and start mapping the roster.
          </p>
        </div>

        <div className="propagation-list">
          {onboarding.map(([number, title, text]) => (
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

      <section className="section propagation-section" id="connected">
        <div className="propagation-copy">
          <p className="eyebrow">One update. Everywhere it matters.</p>
          <h2>File LOA once.</h2>
          <p>
            HeadlessGM keeps attendance, lineups, rewards and officer context
            aligned from the same member state.
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

      <section className="section customization-section" id="rooc-native">
        <div className="section-heading section-heading--center">
          <p className="eyebrow">ROOC-native from day one</p>
          <h2>No universal guild engine to configure.</h2>
          <p>
            Select Ragnarok Origin Classic and start from the structures and
            workflows your guild already uses.
          </p>
        </div>

        <div className="config-chip-grid">
          {roocNative.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="section platform-section" id="plans">
        <div className="section-heading section-heading--split">
          <div>
            <p className="eyebrow">Simple path to upgrade</p>
            <h2>Try it. Run the guild. Automate it.</h2>
          </div>
          <p>
            Free proves the system. Guild runs the full 80-member roster.
            Command removes more officer admin.
          </p>
        </div>

        <div className="module-grid module-grid--compact">
          {plans.map(([title, limit, text], index) => (
            <article className="module-card module-card--compact" key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{limit}</p>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="demo-band">
        <div>
          <p className="eyebrow">See ROOC HeadlessGM working</p>
          <h2>Use the demo. Break the demo. Reset the demo.</h2>
          <p>Fictional ROOC guild data. Real HeadlessGM workflow.</p>
        </div>
        <a className="button" href="/demo">
          Launch ROOC Demo
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
          <a href="#features">ROOC Features</a>
          <a href="#discord">Discord Setup</a>
          <a href="#plans">Plans</a>
          <a href="/demo">Demo</a>
        </div>
        <p className="footer-note">Built for Ragnarok Origin Classic first.</p>
      </footer>
    </main>
  );
}
