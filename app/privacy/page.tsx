import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — serahill.net",
  description: "Privacy Policy for serahill.net Blackjack Statistics Tracker.",
};

const EFFECTIVE_DATE = "March 15, 2025";
const CONTACT_EMAIL = "rayaserahill@gmail.com";

interface SectionProps {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}

function Section({ id, number, title, children }: SectionProps) {
  return (
    <section id={id} className="tos-section">
      <div className="section-header">
        <span className="section-number">{number}</span>
        <h2 className="section-title">{title}</h2>
      </div>
      <div className="section-body">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="subsection">
      <h3 className="subsection-title">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <ul className="bullet-list">
      {items.map((item, i) => (
        <li key={i}>
          <span className="bullet-icon">◆</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Callout({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={accent ? "callout callout--accent" : "callout"}>
      {children}
    </div>
  );
}

function RightCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="right-card">
      <span className="right-card-icon">{icon}</span>
      <div>
        <p className="right-card-title">{title}</p>
        <p className="right-card-desc">{description}</p>
      </div>
    </div>
  );
}

const tocItems = [
  { id: "section-1",  label: "Who We Are" },
  { id: "section-2",  label: "Data We Collect" },
  { id: "section-3",  label: "How We Use Your Data" },
  { id: "section-4",  label: "Legal Basis for Processing" },
  { id: "section-5",  label: "Public Profiles & Player Data" },
  { id: "section-6",  label: "Data Sharing & Third Parties" },
  { id: "section-7",  label: "Data Retention" },
  { id: "section-8",  label: "Your GDPR Rights" },
  { id: "section-9",  label: "Right to Be Removed (Players)" },
  { id: "section-10", label: "Cookies & Tracking" },
  { id: "section-11", label: "Children's Privacy" },
  { id: "section-12", label: "Security" },
  { id: "section-13", label: "Changes to This Policy" },
  { id: "section-14", label: "Contact & Data Controller" },
];

export default function Page() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');

        :root {
          --bg:        #0d0f0e;
          --surface:   #141714;
          --border:    #1f241f;
          --accent:    #ff9fc6;
          --accent-dim:#ff9fc6;
          --text:      #e8ede9;
          --muted:     #6b7a6d;
          --heading:   #f0f5f1;
          --number:    #4ade80;
          --amber:     #f59e0b;
          --amber-dim: #78450a;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .tos-page {
          background: var(--bg);
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          font-weight: 300;
          min-height: 100vh;
          padding-bottom: 6rem;
        }

        /* ── Header ── */
        .tos-header {
          border-bottom: 1px solid var(--border);
          padding: 3.5rem 2rem 3rem;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .tos-header::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 70% 120% at 50% 0%, #7d4b60 0%, transparent 70%);
          pointer-events: none;
        }
        .header-eyebrow {
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          font-size: 0.7rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 1rem;
        }
        .header-title {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(2.5rem, 6vw, 4rem);
          color: var(--heading);
          line-height: 1.1;
          margin-bottom: 0.75rem;
        }
        .header-site {
          font-family: 'DM Serif Display', serif;
          font-style: italic;
          font-size: 1rem;
          color: var(--muted);
          margin-bottom: 1.5rem;
        }
        .header-date {
          display: inline-block;
          font-size: 0.78rem;
          color: var(--muted);
          border: 1px solid var(--border);
          border-radius: 2px;
          padding: 0.3rem 0.85rem;
          letter-spacing: 0.05em;
        }

        /* ── Layout ── */
        .tos-container {
          max-width: 780px;
          margin: 0 auto;
          padding: 0 1.5rem;
        }

        /* ── GDPR badge ── */
        .gdpr-badge {
          margin: 2.5rem 0 0;
          display: flex;
          align-items: center;
          gap: 1rem;
          background: var(--surface);
          border: 1px solid var(--accent-dim);
          padding: 1rem 1.5rem;
        }
        .gdpr-badge-icon {
          font-size: 1.6rem;
          flex-shrink: 0;
        }
        .gdpr-badge p {
          font-size: 0.82rem;
          line-height: 1.6;
          color: var(--muted);
        }
        .gdpr-badge strong { color: var(--accent); font-weight: 500; }

        /* ── TOC ── */
        .toc {
          margin: 2rem 0 0;
          background: var(--surface);
          border: 1px solid var(--border);
          border-left: 3px solid var(--accent-dim);
          padding: 1.75rem 2rem;
        }
        .toc-title {
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 1.1rem;
        }
        .toc-list {
          list-style: none;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.3rem 2rem;
        }
        .toc-list li a {
          font-size: 0.82rem;
          color: var(--muted);
          text-decoration: none;
          transition: color 0.15s;
          display: flex;
          gap: 0.5rem;
        }
        .toc-list li a:hover { color: var(--accent); }
        .toc-num { color: var(--accent-dim); font-variant-numeric: tabular-nums; }

        /* ── Sections ── */
        .tos-section {
          margin-top: 3.5rem;
          scroll-margin-top: 5rem;
        }
        .section-header {
          display: flex;
          align-items: baseline;
          gap: 1rem;
          margin-bottom: 1.25rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border);
        }
        .section-number {
          font-family: 'DM Serif Display', serif;
          font-size: 2rem;
          color: var(--accent-dim);
          line-height: 1;
          min-width: 2.5rem;
        }
        .section-title {
          font-family: 'DM Serif Display', serif;
          font-size: 1.35rem;
          color: var(--heading);
          font-weight: 400;
        }
        .section-body p {
          font-size: 0.9rem;
          line-height: 1.75;
          color: var(--text);
          margin-bottom: 0.9rem;
        }
        .section-body p:last-child { margin-bottom: 0; }

        /* ── Sub-sections ── */
        .subsection {
          margin: 1.2rem 0;
        }
        .subsection-title {
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 0.6rem;
        }

        /* ── Bullet list ── */
        .bullet-list {
          list-style: none;
          margin: 0.6rem 0 0.9rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .bullet-list li {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          font-size: 0.88rem;
          line-height: 1.65;
          color: var(--text);
        }
        .bullet-icon {
          color: var(--accent-dim);
          font-size: 0.5rem;
          margin-top: 0.45rem;
          flex-shrink: 0;
        }

        /* ── Callout ── */
        .callout {
          background: var(--surface);
          border: 1px solid var(--border);
          border-left: 3px solid var(--accent);
          padding: 1rem 1.25rem;
          margin: 1rem 0;
        }
        .callout--accent {
          border-left-color: var(--amber);
          border-color: var(--amber-dim);
        }
        .callout p {
          font-size: 0.88rem !important;
          line-height: 1.65 !important;
          color: var(--text) !important;
          margin-bottom: 0.5rem !important;
        }
        .callout p:last-child { margin-bottom: 0 !important; }
        .callout strong { color: var(--heading); font-weight: 500; }
        .callout a { color: var(--accent); }

        /* ── GDPR Rights Grid ── */
        .rights-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin: 1rem 0;
        }
        .right-card {
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 1rem 1.1rem;
          display: flex;
          gap: 0.9rem;
          align-items: flex-start;
        }
        .right-card-icon {
          font-size: 1.3rem;
          flex-shrink: 0;
          margin-top: 0.1rem;
        }
        .right-card-title {
          font-size: 0.8rem !important;
          font-weight: 500 !important;
          color: var(--heading) !important;
          margin-bottom: 0.25rem !important;
        }
        .right-card-desc {
          font-size: 0.78rem !important;
          line-height: 1.5 !important;
          color: var(--muted) !important;
          margin-bottom: 0 !important;
        }

        /* ── Removal steps ── */
        .steps {
          display: flex;
          flex-direction: column;
          gap: 0;
          margin: 1rem 0;
        }
        .step {
          display: flex;
          gap: 1.25rem;
          align-items: flex-start;
          position: relative;
        }
        .step:not(:last-child)::before {
          content: '';
          position: absolute;
          left: 1.05rem;
          top: 2.2rem;
          bottom: -0.5rem;
          width: 1px;
          background: var(--border);
        }
        .step-num {
          width: 2.1rem;
          height: 2.1rem;
          border-radius: 50%;
          border: 1px solid var(--accent-dim);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--accent);
          flex-shrink: 0;
          background: var(--surface);
          z-index: 1;
        }
        .step-content {
          padding: 0.35rem 0 1.25rem;
        }
        .step-content p {
          font-size: 0.88rem !important;
          line-height: 1.65 !important;
          color: var(--text) !important;
          margin-bottom: 0 !important;
        }
        .step-content strong { color: var(--heading); font-weight: 500; }

        /* ── Footer ── */
        .tos-footer {
          margin-top: 5rem;
          padding-top: 2rem;
          border-top: 1px solid var(--border);
          text-align: center;
        }
        .tos-footer p {
          font-size: 0.78rem;
          color: var(--muted);
          letter-spacing: 0.04em;
        }
        .tos-footer a { color: var(--accent); text-decoration: none; }
        .tos-footer a:hover { text-decoration: underline; }

        @media (max-width: 560px) {
          .toc-list { grid-template-columns: 1fr; }
          .rights-grid { grid-template-columns: 1fr; }
          .section-number { font-size: 1.4rem; min-width: 1.8rem; }
          .section-title { font-size: 1.1rem; }
        }
      `}</style>

      <div className="tos-page">
        <header className="tos-header">
          <p className="header-eyebrow">Legal</p>
          <h1 className="header-title">Privacy Policy</h1>
          <p className="header-site">serahill.net</p>
          <span className="header-date">Effective {EFFECTIVE_DATE}</span>
        </header>

        <div className="tos-container">

          {/* GDPR Badge */}
          <div className="gdpr-badge">
            <span className="gdpr-badge-icon">🇪🇺</span>
            <p>
              This policy is written in compliance with the{" "}
              <strong>General Data Protection Regulation (GDPR)</strong>. If you are located in the
              European Economic Area (EEA), you have specific legal rights regarding your personal
              data, described in full in{" "}
              <a href="#section-8" style={{ color: "var(--accent)" }}>Section 8</a>.
            </p>
          </div>

          {/* TOC */}
          <nav className="toc" aria-label="Table of contents">
            <p className="toc-title">Contents</p>
            <ol className="toc-list">
              {tocItems.map((item, i) => (
                <li key={item.id}>
                  <a href={`#${item.id}`}>
                    <span className="toc-num">{String(i + 1).padStart(2, "0")}.</span>
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* ── 1. Who We Are ── */}
          <Section id="section-1" number="01" title="Who We Are">
            <p>
              serahill.net (&ldquo;the Service,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
              &ldquo;our&rdquo;) is a Blackjack statistics tracking platform for Blackjack hosts.
              The Service is operated independently. For the purposes of GDPR, the operator of
              serahill.net is the <strong style={{ color: "var(--heading)", fontWeight: 500 }}>data controller</strong>.
            </p>
            <p>
              If you have any questions about this Privacy Policy or how your data is handled,
              contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--accent)" }}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          {/* ── 2. Data We Collect ── */}
          <Section id="section-2" number="02" title="Data We Collect">
            <SubSection title="2.1 — Account Data (Registered Dealers)">
              <p>When you register as a Dealer, we collect:</p>
              <BulletList
                items={[
                  "Username (used as your public profile URL)",
                  "Email address",
                  "Display name",
                  "Password (stored as a secure hash — never in plain text)",
                  "Discord user ID (optional, only if you choose to link it)",
                ]}
              />
            </SubSection>
            <SubSection title="2.2 — Session Data (Submitted by Dealers)">
              <p>
                Dealers submit Blackjack session records to the Service. This data may include
                player names or identifiers, round counts, profit/loss figures, and money volume
                statistics. This data is submitted entirely at the Dealer&rsquo;s discretion and
                under their responsibility.
              </p>
            </SubSection>
            <SubSection title="2.3 — Data We Do Not Collect">
              <p>We do not collect:</p>
              <BulletList
                items={[
                  "Payment or financial information of any kind.",
                  "Device fingerprints, advertising IDs, or behavioural tracking data.",
                  "Location data.",
                  "Any data from minors under the age of 18.",
                ]}
              />
            </SubSection>
          </Section>

          {/* ── 3. How We Use Your Data ── */}
          <Section id="section-3" number="03" title="How We Use Your Data">
            <p>We use the data we collect solely to provide the Service. Specifically:</p>
            <BulletList
              items={[
                "To create and authenticate your Dealer account.",
                "To store and display your Blackjack session statistics on your public profile page.",
                "To enable player search functionality within your own session history.",
                "To respond to support requests or data inquiries sent to our contact email.",
              ]}
            />
            <p>
              We do <strong style={{ color: "var(--heading)", fontWeight: 500 }}>not</strong> use
              your data for advertising, profiling, automated decision-making, or any purpose
              beyond operating the Service.
            </p>
          </Section>

          {/* ── 4. Legal Basis ── */}
          <Section id="section-4" number="04" title="Legal Basis for Processing (GDPR)">
            <p>
              Under GDPR, we must have a lawful basis for processing personal data. Our bases are:
            </p>
            <BulletList
              items={[
                <><strong style={{ color: "var(--heading)", fontWeight: 500 }}>Contract (Art. 6(1)(b)):</strong> Processing your account data is necessary to provide the Service you registered for.</>,
                <><strong style={{ color: "var(--heading)", fontWeight: 500 }}>Legitimate Interests (Art. 6(1)(f)):</strong> We have a legitimate interest in maintaining the security and integrity of the Service.</>,
                <><strong style={{ color: "var(--heading)", fontWeight: 500 }}>Legal Obligation (Art. 6(1)(c)):</strong> In limited circumstances, we may be required to process or retain data to comply with applicable law.</>,
              ]}
            />
            <p>
              For player data submitted by Dealers (names and statistics appearing on profile
              pages), the legal basis is <strong style={{ color: "var(--heading)", fontWeight: 500 }}>legitimate interests</strong> of the Dealer in
              maintaining their own records. Any player who wishes to be removed may exercise their
              rights as described in <a href="#section-9" style={{ color: "var(--accent)" }}>Section 9</a>.
            </p>
          </Section>

          {/* ── 5. Public Profiles & Player Data ── */}
          <Section id="section-5" number="05" title="Public Profiles & Player Data">
            <p>
              Dealer profile pages at{" "}
              <code style={{ fontFamily: "monospace", color: "var(--accent)", fontSize: "0.85em" }}>
                serahill.net/stats/&lt;username&gt;
              </code>{" "}
              are publicly accessible. These pages may display player names and associated
              statistics (rounds played, profit/loss, etc.) as submitted by the Dealer.
            </p>
            <Callout accent>
              <p>
                <strong>Important for players:</strong> If your name or data appears on a Dealer&rsquo;s
                profile and you did not consent to this, or you wish to be removed for any reason,
                you have the right to request removal. See{" "}
                <a href="#section-9">Section 9</a> for how to do this.
              </p>
            </Callout>
            <p>
              Dealers are solely responsible for ensuring they have a lawful basis to submit and
              publicly display information about the players they record. By submitting player data,
              Dealers represent that they are not violating any applicable privacy law.
            </p>
          </Section>

          {/* ── 6. Data Sharing ── */}
          <Section id="section-6" number="06" title="Data Sharing & Third Parties">
            <p>We do not sell, rent, or trade your personal data. We do not share your data with any third party for marketing or commercial purposes.</p>
            <p>
              The only third party with access to stored data is{" "}
              <strong style={{ color: "var(--heading)", fontWeight: 500 }}>Vercel</strong>, which
              provides the database and hosting infrastructure on which the Service runs. Vercel
              acts as a data processor on our behalf. We have no control over Vercel&rsquo;s
              internal infrastructure policies; by using the Service you acknowledge that data is
              stored on Vercel&rsquo;s servers.
            </p>
            <p>
              We may also disclose data if required to do so by law, court order, or governmental
              authority.
            </p>
          </Section>

          {/* ── 7. Retention ── */}
          <Section id="section-7" number="07" title="Data Retention">
            <p>
              We retain your personal data for as long as your account remains active. When you
              delete your account, all associated data — including your profile, session records,
              and registration details — is permanently deleted from the Service&rsquo;s database.
            </p>
            <p>
              If you are a player (not a registered Dealer) and your data appears on a Dealer&rsquo;s
              profile, your data is retained for as long as the Dealer&rsquo;s account exists or
              until a removal request is processed under{" "}
              <a href="#section-9" style={{ color: "var(--accent)" }}>Section 9</a>.
            </p>
          </Section>

          {/* ── 8. GDPR Rights ── */}
          <Section id="section-8" number="08" title="Your GDPR Rights">
            <p>
              If you are located in the European Economic Area (EEA), you have the following rights
              under the General Data Protection Regulation. To exercise any of these rights, email
              us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--accent)" }}>
                {CONTACT_EMAIL}
              </a>
              . We will respond to all requests{" "}
              <strong style={{ color: "var(--heading)", fontWeight: 500 }}>within 30 days</strong>.
            </p>

            <div className="rights-grid">
              <RightCard
                icon="📋"
                title="Right of Access"
                description="Request a copy of all personal data we hold about you."
              />
              <RightCard
                icon="✏️"
                title="Right to Rectification"
                description="Request correction of inaccurate or incomplete personal data."
              />
              <RightCard
                icon="🗑️"
                title="Right to Erasure"
                description='Request deletion of your personal data ("right to be forgotten").'
              />
              <RightCard
                icon="⏸️"
                title="Right to Restrict Processing"
                description="Request that we limit how we use your data in certain circumstances."
              />
              <RightCard
                icon="📦"
                title="Right to Data Portability"
                description="Request your data in a structured, machine-readable format."
              />
              <RightCard
                icon="🚫"
                title="Right to Object"
                description="Object to processing based on legitimate interests."
              />
            </div>

            <Callout>
              <p>
                <strong>Response time commitment:</strong> We will acknowledge all data rights
                requests promptly and provide a full response within{" "}
                <strong>30 calendar days</strong> of receiving your request. If your request is
                complex or numerous, we may extend this by up to an additional 60 days, in which
                case we will notify you within the first 30 days and explain the reason.
              </p>
            </Callout>
          </Section>

          {/* ── 9. Right to Be Removed (Players) ── */}
          <Section id="section-9" number="09" title="Right to Be Removed — Players">
            <p>
              If you are a player whose name or statistics appear on a Dealer&rsquo;s public
              profile page on serahill.net, you have the right to request removal of your data
              from the Service — regardless of whether you are located in the EEA.
            </p>
            <p>
              To request removal, follow these steps:
            </p>

            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-content">
                  <p>
                    <strong>Send an email</strong> to{" "}
                    <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--accent)" }}>
                      {CONTACT_EMAIL}
                    </a>{" "}
                    with the subject line: <em style={{ color: "var(--muted)" }}>&ldquo;Player Data Removal Request&rdquo;</em>.
                  </p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-content">
                  <p>
                    <strong>Include in your email:</strong> the name or identifier under which you
                    appear on the Service, and optionally the URL of the profile page(s) where your
                    data is displayed.
                  </p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-content">
                  <p>
                    <strong>We will process your request</strong> and confirm removal within{" "}
                    <strong>30 calendar days</strong>. Your data will be permanently deleted from
                    the Service&rsquo;s database.
                  </p>
                </div>
              </div>
            </div>

            <Callout accent>
              <p>
                <strong>No account required.</strong> You do not need to be a registered user of
                serahill.net to submit a removal request. Anyone whose data appears on the Service
                may request removal at any time, for any reason, with no questions asked.
              </p>
            </Callout>
          </Section>

          {/* ── 10. Cookies ── */}
          <Section id="section-10" number="10" title="Cookies & Tracking">
            <p>
              serahill.net uses only the cookies strictly necessary to operate the Service, such as
              session authentication tokens. We do not use advertising cookies, third-party
              tracking cookies, or analytics cookies that identify individual users.
            </p>
            <p>
              Because we use only strictly necessary cookies, no cookie consent banner is required
              under EU law. If this changes in the future, this policy will be updated accordingly.
            </p>
          </Section>

          {/* ── 11. Children ── */}
          <Section id="section-11" number="11" title="Children's Privacy">
            <p>
              The Service is intended for users aged 18 and over. We do not knowingly collect
              personal data from anyone under the age of 18. If you believe a minor&rsquo;s data
              has been submitted to the Service, please contact us immediately at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--accent)" }}>
                {CONTACT_EMAIL}
              </a>{" "}
              and we will remove it promptly.
            </p>
          </Section>

          {/* ── 12. Security ── */}
          <Section id="section-12" number="12" title="Security">
            <p>
              We take reasonable technical measures to protect the data stored on the Service,
              including password hashing and secure infrastructure provided by Vercel. However, no
              system is completely secure. We cannot guarantee the absolute security of your data
              and encourage you to use a strong, unique password for your account.
            </p>
            <p>
              The source code for this Service is open source and publicly auditable, which enables
              the community to identify and report potential security issues. If you discover a
              vulnerability, please disclose it responsibly by contacting us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--accent)" }}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          {/* ── 13. Changes ── */}
          <Section id="section-13" number="13" title="Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we do, we will revise the
              &ldquo;Effective Date&rdquo; at the top of this page. We encourage you to review this
              page periodically. Your continued use of the Service after any update constitutes
              acceptance of the revised policy.
            </p>
          </Section>

          {/* ── 14. Contact ── */}
          <Section id="section-14" number="14" title="Contact & Data Controller">
            <p>
              For all privacy-related inquiries — including GDPR rights requests, data removal
              requests, and general questions about this policy — contact us at:
            </p>
            <Callout>
              <p>
                <strong>Data Controller:</strong> serahill.net
              </p>
              <p>
                <strong>Contact Email:</strong>{" "}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              </p>
              <p>
                <strong>Response Time:</strong> Within 30 calendar days for all GDPR-related requests.
              </p>
            </Callout>
          </Section>

          <footer className="tos-footer">
            <p>serahill.net — Blackjack Statistics Tracker</p>
            <p style={{ marginTop: "0.4rem" }}>
              Privacy questions?{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          </footer>

        </div>
      </div>
    </>
  );
}
