import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — serahill.net",
  description: "Terms of Service for serahill.net Blackjack Statistics Tracker.",
};

const EFFECTIVE_DATE = "March 15, 2025";
const CONTACT_EMAIL = "rayaserahill@gmail.com";

interface SectionProps {
  number: string;
  title: string;
  children: React.ReactNode;
}

function Section({ number, title, children }: SectionProps) {
  return (
    <section className="tos-section">
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

function BulletList({ items }: { items: string[] }) {
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

        /* ── TOC ── */
        .toc {
          margin: 3rem 0 0;
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
        .callout p {
          font-size: 0.88rem !important;
          line-height: 1.65 !important;
          color: var(--text) !important;
          margin: 0 !important;
        }
        .callout strong {
          color: var(--heading);
          font-weight: 500;
        }

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
        .tos-footer a {
          color: var(--accent);
          text-decoration: none;
        }
        .tos-footer a:hover { text-decoration: underline; }

        @media (max-width: 540px) {
          .toc-list { grid-template-columns: 1fr; }
          .section-number { font-size: 1.4rem; min-width: 1.8rem; }
          .section-title { font-size: 1.1rem; }
        }
      `}</style>

      <div className="tos-page">
        <header className="tos-header">
          <p className="header-eyebrow">Legal</p>
          <h1 className="header-title">Terms of Service</h1>
          <p className="header-site">serahill.net</p>
          <span className="header-date">Effective {EFFECTIVE_DATE}</span>
        </header>

        <div className="tos-container">
          {/* Table of Contents */}
          <nav className="toc" aria-label="Table of contents">
            <p className="toc-title">Contents</p>
            <ol className="toc-list">
              {[
                "Acceptance of Terms",
                "Description of the Service",
                "Eligibility",
                "Account Registration",
                "User-Submitted Data",
                "Public Profile Pages",
                "Data Storage and Privacy",
                "Account Deletion",
                "Prohibited Conduct",
                "Disclaimer of Warranties",
                "Limitation of Liability",
                "Modifications to the Terms",
                "Termination",
                "Governing Law",
                "Contact Information",
              ].map((title, i) => (
                <li key={i}>
                  <a href={`#section-${i + 1}`}>
                    <span className="toc-num">{String(i + 1).padStart(2, "0")}.</span>
                    {title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Sections */}
          <Section number="01" title="Acceptance of Terms">
            <p>
              By creating an account on serahill.net (the &ldquo;Service&rdquo;), you agree to be
              bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these
              Terms, do not register for or use the Service. These Terms constitute a legally
              binding agreement between you (&ldquo;User&rdquo; or &ldquo;Dealer&rdquo;) and the
              operator of serahill.net.
            </p>
          </Section>

          <Section number="02" title="Description of the Service">
            <p>
              serahill.net is a statistics tracking platform for Blackjack hosts
              (&ldquo;Dealers&rdquo;). The Service allows registered Dealers to:
            </p>
            <BulletList
              items={[
                "Record and store data about Blackjack sessions they host, including rounds hosted, profit/loss figures, and volume of money exchanged.",
                "Display a public profile page accessible at serahill.net/stats/<username>, showing aggregated statistics and leaderboards.",
                "Search through player histories associated with their own hosted sessions.",
              ]}
            />
            <p>
              The Service is intended solely for personal record-keeping and statistical display
              purposes. It is not a gambling platform, does not facilitate gambling activity, and
              does not process any real or virtual currency transactions.
            </p>
          </Section>

          <Section number="03" title="Eligibility">
            <p>
              You must be at least 18 years of age to register for and use the Service. By creating
              an account, you confirm that you meet this requirement. If you are under 18, you are
              not permitted to use the Service.
            </p>
          </Section>

          <Section number="04" title="Account Registration">
            <p>To use the Service, you must create an account by providing the following:</p>
            <BulletList
              items={[
                "A unique username (used as your public profile URL extension).",
                "A valid email address.",
                "A password.",
                "A display name.",
                "Optionally, a linked Discord account.",
              ]}
            />
            <p>
              You are responsible for maintaining the confidentiality of your login credentials and
              for all activity that occurs under your account. You agree to notify us immediately of
              any unauthorized use at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--accent)" }}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
            <p>
              You must provide accurate and truthful information during registration. Impersonation
              of another person or entity is strictly prohibited.
            </p>
          </Section>

          <Section number="05" title="User-Submitted Data">
            <p>
              You retain full ownership of all data you submit to the Service (&ldquo;User
              Data&rdquo;). By submitting data, you grant serahill.net a limited, non-exclusive
              license to store and display that data on your public profile page for the purpose of
              providing the Service.
            </p>
            <p>
              You are solely responsible for the accuracy, legality, and appropriateness of the
              data you upload. You agree not to submit data that:
            </p>
            <BulletList
              items={[
                "Is false, misleading, or fraudulent.",
                "Violates the privacy or rights of any third party.",
                "Contains personally identifiable information of others without their consent.",
                "Violates any applicable law or regulation.",
              ]}
            />
            <p>
              We reserve the right to remove any data that we determine, in our sole discretion,
              violates these Terms.
            </p>
          </Section>

          <Section number="06" title="Public Profile Pages">
            <p>
              Your profile page at{" "}
              <code style={{ fontFamily: "monospace", color: "var(--accent)", fontSize: "0.85em" }}>
                serahill.net/stats/&lt;username&gt;
              </code>{" "}
              is publicly accessible to anyone with the URL. By using the Service, you acknowledge
              and consent to this public display.
            </p>
            <p>
              Player names and statistics that appear on your profile are derived from the data you
              submit. You are responsible for ensuring you have appropriate basis to upload and
              publicly display information about the players you record.
            </p>
          </Section>

          <Section number="07" title="Data Storage and Privacy">
            <SubSection title="7.1 — What We Store">
              <p>
                We collect and store only the information necessary to provide the Service, including
                your account registration details (username, email, display name, hashed password,
                optional Discord link) and the Blackjack session data you submit.
              </p>
            </SubSection>
            <SubSection title="7.2 — How Your Data Is Used">
              <p>
                Your data is used exclusively to operate the Service — to power your profile page
                and the statistics displayed on it. We do not:
              </p>
              <BulletList
                items={[
                  "Sell your data to any third party.",
                  "Share your data with any third-party service (except as described in §7.3).",
                  "Use your data for advertising or marketing purposes.",
                  "Use your data for any purpose other than displaying it on your profile.",
                ]}
              />
            </SubSection>
            <SubSection title="7.3 — Infrastructure">
              <p>
                The Service&rsquo;s database is hosted on infrastructure provided by Vercel. By
                using the Service, you acknowledge that your data is stored on Vercel&rsquo;s
                servers and is subject to Vercel&rsquo;s data handling practices in addition to
                these Terms. We have no control over Vercel&rsquo;s infrastructure policies.
              </p>
            </SubSection>
            <SubSection title="7.4 — Open Source">
              <p>
                The source code for this Service is publicly available. The underlying logic of the
                Service is transparent and auditable. No private user data (passwords, emails) is
                exposed through the source code.
              </p>
            </SubSection>
          </Section>

          <Section number="08" title="Account Deletion and Data Removal">
            <p>
              You may delete your account at any time through the Service interface. Upon deletion,
              all data associated with your account — including your profile, session records, and
              registration details — will be permanently removed from the Service&rsquo;s database.
            </p>
            <p>
              If you are unable to delete your account through the interface, you may contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--accent)" }}>
                {CONTACT_EMAIL}
              </a>{" "}
              to request manual deletion.
            </p>
          </Section>

          <Section number="09" title="Prohibited Conduct">
            <p>You agree not to use the Service to:</p>
            <BulletList
              items={[
                "Violate any applicable local, national, or international law or regulation.",
                "Attempt to gain unauthorized access to any part of the Service, its servers, or its database.",
                "Scrape, harvest, or collect data from other users' profiles without authorization.",
                "Upload malicious code, scripts, or content intended to disrupt the Service.",
                "Circumvent, disable, or interfere with security features of the Service.",
                "Create multiple accounts for the purpose of circumventing restrictions or bans.",
                "Use the Service in any way that could damage, overburden, or impair its operation.",
              ]}
            />
          </Section>

          <Section number="10" title="Disclaimer of Warranties">
            <div className="callout">
              <p>
                The Service is provided <strong>&ldquo;as is&rdquo;</strong> and{" "}
                <strong>&ldquo;as available&rdquo;</strong> without warranties of any kind, either
                express or implied. We do not warrant that the Service will be uninterrupted,
                error-free, or free of harmful components. We make no guarantees regarding the
                accuracy or completeness of any statistics displayed. You use the Service entirely
                at your own risk.
              </p>
            </div>
          </Section>

          <Section number="11" title="Limitation of Liability">
            <p>
              To the fullest extent permitted by applicable law, serahill.net and its operator
              shall not be liable for any indirect, incidental, special, consequential, or punitive
              damages arising out of or related to your use of (or inability to use) the Service,
              even if advised of the possibility of such damages.
            </p>
          </Section>

          <Section number="12" title="Modifications to the Terms">
            <p>
              We reserve the right to update or modify these Terms at any time. When we do, we will
              update the &ldquo;Effective Date&rdquo; at the top of this page. Your continued use
              of the Service after any modification constitutes your acceptance of the updated
              Terms. We encourage you to review these Terms periodically.
            </p>
          </Section>

          <Section number="13" title="Termination">
            <p>
              We reserve the right to suspend or terminate your account at any time, with or
              without notice, if we believe you have violated these Terms or are misusing the
              Service. You may stop using the Service and delete your account at any time as
              described in Section 8.
            </p>
          </Section>

          <Section number="14" title="Governing Law">
            <p>
              These Terms shall be governed by and construed in accordance with applicable law. Any
              disputes arising from these Terms or your use of the Service shall be resolved through
              good-faith negotiation where possible. If you have a concern, please reach out to us
              before pursuing any formal action.
            </p>
          </Section>

          <Section number="15" title="Contact Information">
            <p>
              If you have any questions, concerns, or requests regarding these Terms or your data,
              please contact us:
            </p>
            <div className="callout" style={{ marginTop: "1rem" }}>
              <p>
                <strong>Email:</strong>{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--accent)" }}>
                  {CONTACT_EMAIL}
                </a>
              </p>
            </div>
          </Section>

          <footer className="tos-footer">
            <p>serahill.net — Blackjack Statistics Tracker</p>
            <p style={{ marginTop: "0.4rem" }}>
              Questions?{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
