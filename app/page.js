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

const problems = [
  {
    number: "01",
    title: "Spreadsheets",
    text: "Roster lists, attendance sheets, reward trackers and lineup drafts all become separate sources of truth.",
  },
  {
    number: "02",
    title: "Chat threads",
    text: "Important decisions disappear between pings, screenshots, reactions and officer-only conversations.",
  },
  {
    number: "03",
    title: "Manual updates",
    text: "One absence can mean editing attendance, lineups, eligibility and announcements by hand.",
  },
  {
    number: "04",
    title: "Rules in people’s heads",
    text: "When guild logic only lives with a few officers, consistency becomes difficult to scale.",
  },
];

const modules = [
  ["Members", "Profiles, roles, groups, status and roster context in one place."],
  ["Events", "Create repeatable event structures with dates, deadlines and participation rules."],
  ["Attendance", "Track presence, absence, LOA and event history without separate sheets."],
  ["Teams", "Build parties, raid groups, squads or any structure your game requires."],
  ["Rewards", "Manage queues, rotations, allocations and eligibility from shared rules."],
  ["Communication", "Turn operational state into clear announcements and publish-ready outputs."],
  ["History", "Keep the record of what changed, who was affected and what happened before."],
  ["Configuration", "Change terminology, workflows, rules and structures without rebuilding the product."],
];

const propagation = [
  ["01", "A member files LOA", "Availability changes for the upcoming event."],
  ["02", "Attendance updates", "The event roster reflects the absence automatically in the operating view."],
  ["03", "The lineup is affected", "Officers can immediately see which slot or team needs attention."],
  ["04", "Eligibility follows", "Reward or rotation logic can use the same attendance state."],
  ["05", "The record stays connected", "History and communication can reference the same operational change."],
];

const configuration = [
  ["Terminology", "Guild, clan, alliance, squad, party, raid — label the system like your community."],
  ["Event rules", "Deadlines, attendance states, recurring formats and participation requirements."],
  ["Team structure", "Different party sizes, raid structures, main/sub groups or custom team models."],
  ["Reward logic", "Queues, rotations, eligibility, officer decisions and game-specific allocation rules."],
  ["Permissions", "Control who can view, edit, approve, publish or manage sensitive operations."],
  ["Branding", "Give the system your guild name, identity and presentation instead of a generic template."],
];

const audiences = [
  ["Guilds", "Organized communities that need a reliable day-to-day operating layer."],
  ["Clans", "Competitive or social groups coordinating members, events and progression."],
  ["Raid groups", "Teams where attendance, compositions and rewards need to stay aligned."],
  ["Alliances", "Larger structures coordinating multiple teams, leaders or communities."],
];

const faqs = [
  [
    "Is HeadlessGM tied to one game?",
    "No. The product is designed around configurable terminology, event structures, teams, attendance and reward logic so the operating model can change with the community.",
  ],
  [
    "Is the demo connected to a real guild?",
    "No. The presentation demo uses fictional sample data and is intentionally separate from live guild systems, accounts and production data.",
  ],
  [
    "Can different guilds use different rules?",
    "That is the point of HeadlessGM. The product should adapt to the guild’s structure and processes rather than forcing every community into one fixed workflow.",
  ],
  [
    "Does everything have to be used at once?",
    "No. The system is modular. A community can start with the operational areas it needs and connect more workflows as its process becomes more mature.",
  ],
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand-logo" href="#" aria-label="HeadlessGM home">
          <img
            src="/brand/headlessgm-logo-white.webp"
            alt="HeadlessGM"
            width="900"
            height="240"
          />
        </a>

        <nav className="site-nav" aria-label="Primary navigation">
          <a href="#platform">Platform</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#customization">Customization</a>
          <a href="#communities">Communities</a>
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
            A configurable guild management platform that connects members,
            events, attendance, teams, rewards, communication and history into
            one operating system built around how your community actually plays.
          </p>

          <div className="hero__actions">
            <a className="button" href="/demo">
              Try Interactive Demo
            </a>
            <a className="button button--secondary" href="#platform">
              Explore the Platform
            </a>
          </div>

          <div className="hero__proof">
            <span>Game-agnostic</span>
            <span>Modular by design</span>
            <span>Built for real guild operations</span>
          </div>
        </div>

        <div className="product-stage" aria-label="HeadlessGM interface preview">
          <div className="product-window">
            <div className="product-window__bar">
              <div className="product-window__brand">
                <img
                  src="/brand/headlessgm-logo-white.webp"
                  alt=""
                  width="900"
                  height="240"
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
        <p>Community-focused</p>
        <p>Reliable</p>
        <p>Customizable</p>
      </section>

      <section className="section section--intro">
        <div className="section-heading">
          <p className="eyebrow">The problem is not a lack of tools</p>
          <h2>Guild operations are fragmented.</h2>
          <p>
            Most organized communities already have spreadsheets, Discord,
            forms and officer notes. The problem is that those tools do not
            understand the relationships between your members, events, teams,
            attendance rules and rewards.
          </p>
        </div>

        <div className="problem-grid">
          {problems.map((item) => (
            <article className="problem-card" key={item.number}>
              <span>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section platform-section" id="platform">
        <div className="section-heading section-heading--split">
          <div>
            <p className="eyebrow">One connected operating layer</p>
            <h2>Everything officers manage. Connected.</h2>
          </div>
          <p>
            HeadlessGM turns separate operational tasks into modules that share
            the same guild state. You stop maintaining the same information in
            five different places.
          </p>
        </div>

        <div className="module-grid">
          {modules.map(([title, text], index) => (
            <article className="module-card" key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section workflow-section" id="how-it-works">
        <div className="section-heading section-heading--center">
          <p className="eyebrow">How HeadlessGM works</p>
          <h2>Configure once. Operate from one system.</h2>
          <p>
            The platform separates the rules of the guild from the mechanics of
            the software, so different communities can run very different
            operations without rebuilding the product.
          </p>
        </div>

        <div className="steps-grid">
          <article>
            <span>01</span>
            <h3>Define your guild</h3>
            <p>
              Set terminology, roles, team structures, event formats,
              attendance states and reward rules.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Run the operation</h3>
            <p>
              Officers work from the same member, event and eligibility context
              instead of recreating it per workflow.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Let changes carry through</h3>
            <p>
              A change in one operational area can be reflected wherever that
              state matters next.
            </p>
          </article>
        </div>
      </section>

      <section className="section propagation-section">
        <div className="propagation-copy">
          <p className="eyebrow">Connected consequences</p>
          <h2>One absence should not create five admin tasks.</h2>
          <p>
            HeadlessGM is designed around the relationship between guild
            operations. The value is not only storing information — it is
            keeping the downstream context aligned.
          </p>
        </div>

        <div className="propagation-list">
          {propagation.map(([number, title, text]) => (
            <div className="propagation-row" key={number}>
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
        <div className="section-heading">
          <p className="eyebrow">The system adapts to the guild</p>
          <h2>Configuration, not hard-coded assumptions.</h2>
          <p>
            Different games use different language, party sizes, event rules,
            reward systems and officer structures. HeadlessGM treats those
            differences as configuration.
          </p>
        </div>

        <div className="configuration-grid">
          {configuration.map(([title, text]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>

        <div className="configuration-note">
          <span>Same platform.</span>
          <strong>Different rules. Different language. Different guild.</strong>
        </div>
      </section>

      <section className="section communities-section" id="communities">
        <div className="section-heading section-heading--split">
          <div>
            <p className="eyebrow">Built for organized communities</p>
            <h2>Not just one kind of guild.</h2>
          </div>
          <p>
            HeadlessGM is for communities that coordinate people and recurring
            operations — whether the game calls them guilds, clans, alliances,
            raid groups or something else entirely.
          </p>
        </div>

        <div className="audience-grid">
          {audiences.map(([title, text]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="demo-band">
        <div>
          <p className="eyebrow">See the operating model</p>
          <h2>Do not just read about it. Use it.</h2>
          <p>
            The HeadlessGM demo uses fictional guild data so you can explore
            the product experience without connecting to a live community.
          </p>
        </div>
        <a className="button" href="/demo">
          Launch Interactive Demo
        </a>
      </section>

      <section className="section faq-section">
        <div className="section-heading">
          <p className="eyebrow">Questions</p>
          <h2>What HeadlessGM is built to be.</h2>
        </div>

        <div className="faq-list">
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <div>
          <img
            src="/brand/headlessgm-logo-white.webp"
            alt="HeadlessGM"
            width="900"
            height="240"
          />
          <p>Guilds run better here.</p>
        </div>
        <div className="footer-links">
          <a href="#platform">Platform</a>
          <a href="#customization">Customization</a>
          <a href="/demo">Demo</a>
        </div>
        <p className="footer-note">Communities create greater adventures.</p>
      </footer>
    </main>
  );
}
