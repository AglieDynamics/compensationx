import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './landing.css';

/** Entry point into the platform — mirrors the original landing's primary CTA target. */
const PLATFORM_PATH = '/capital/cost-of-inaction';
const AGILE_DYNAMICS = 'https://agiledynamics.co';

/** Outbound targets for the five ecosystem-layer cards. */
const ECOSYSTEM_LINKS = {
  astroArmadillos: 'https://astroarmadillos.io/',
  cryptoPayScale: 'https://cryptopayscale.io/',
  syntheticEquity: 'https://syntheticequity.io/',
  agileDynamics: 'https://agiledynamics.co/',
  cryptoPayroll: 'https://cryptopayroll.ai/',
} as const;

/**
 * CryptoPayScale marketing landing — a 1:1 port of CryptoPayScale_Website.html.
 * Renders standalone (outside the app shell) at `/`; all styling is scoped under
 * `.cps` in landing.css. The original page's inline scripts (nav scroll state,
 * mobile menu, reveal-on-scroll) are reimplemented here as React effects.
 */
export function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // Nav background state + back-to-top visibility on scroll.
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      setShowTop(window.scrollY > 600);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Smooth in-page scrolling + dark page background, only while the landing is mounted.
  useEffect(() => {
    const html = document.documentElement;
    const prevScrollBehavior = html.style.scrollBehavior;
    const prevBodyBg = document.body.style.background;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) html.style.scrollBehavior = 'smooth';
    document.body.style.background = '#060D1F';
    return () => {
      html.style.scrollBehavior = prevScrollBehavior;
      document.body.style.background = prevBodyBg;
    };
  }, []);

  // Reveal-on-scroll: fade/slide each `.reveal` element into view once.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('.reveal'));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px' },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="cps" ref={rootRef}>
      <nav className={scrolled ? 'scrolled' : undefined}>
        <div className="nav-inner">
          <a href="#top" className="brand" onClick={closeMenu}>
            <img src="/landing/logo.png" alt="CryptoPayScale logo" />
            <span className="word">
              Crypto<span>PayScale</span>
            </span>
          </a>
          <div className={menuOpen ? 'nav-links open' : 'nav-links'}>
            <a href="#problem" onClick={closeMenu}>
              Why
            </a>
            <a href="#products" onClick={closeMenu}>
              Products
            </a>
            <a href="#frontier" onClick={closeMenu}>
              The Frontier
            </a>
            <a href="#roadmap" onClick={closeMenu}>
              Roadmap
            </a>
            <a href="#ecosystem" onClick={closeMenu}>
              Ecosystem
            </a>
            <Link className="nav-cta" to={PLATFORM_PATH} onClick={closeMenu}>
              Open the platform
            </Link>
          </div>
          <button
            className={menuOpen ? 'burger open' : 'burger'}
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      <header id="top">
        <div className="hero-bg" />
        <div className="hero-inner">
          <div className="hero-tag">
            Compensation Intelligence · Blockchain · DeFi · FinTech · AI/ML · iGaming · PSPs · Web3
          </div>
          <h1>
            The benchmark is where pay <span className="accent">stops being guesswork</span>
          </h1>
          <p className="hero-sub">
            CryptoPayScale.io turns market data into governed pay decisions — pricing every hire,
            designing every range, and showing the cost of every gap in one closed-loop platform.
          </p>
          <div className="hero-ctas">
            <Link className="btn btn-primary" to={PLATFORM_PATH}>
              Open the platform →
            </Link>
            <a className="btn btn-ghost" href="#products">
              See the products
            </a>
          </div>
          <div className="hero-meta">
            <div>
              <div className="k">Live today</div>
              <div className="v">150+ companies benchmarking</div>
            </div>
            <div>
              <div className="k">Built for</div>
              <div className="v">CHRO · CFO · Total Rewards</div>
            </div>
            <div>
              <div className="k">Regulatory</div>
              <div className="v">EU Pay Transparency ready</div>
            </div>
          </div>
        </div>
      </header>

      {/* ============ PROBLEM ============ */}
      <section id="problem" className="tint">
        <div className="wrap">
          <div className="reveal">
            <div className="eyebrow">The problem it solves</div>
            <h2 className="sec-title">Traditional benchmarking fails in three ways</h2>
            <p className="sec-lede">
              Pull a survey, check the compa-ratio, adjust to the 50th percentile — a method never
              designed for an AI-augmented, transparency-regulated, globally distributed workforce.
              Each failure compounds the others.
            </p>
          </div>
          <div className="fail-grid">
            <div className="fail reveal">
              <div className="num">FAILURE 01 / TEMPORAL</div>
              <h3>The market moves faster than the survey</h3>
              <p>
                Most surveys are annual and published with a lag. A team benchmarked in January and
                untouched since is almost certainly paying below market — even if it believed it sat
                at the 60th percentile when the survey ran.
              </p>
            </div>
            <div className="fail reveal">
              <div className="num">FAILURE 02 / DIMENSIONAL</div>
              <h3>A median says nothing about returns</h3>
              <p>
                A compa-ratio of 0.95 says someone is paid 5% below midpoint. It does not say whether
                that person is a top performer whose departure costs 150% of salary to replace. Pay
                is never connected to productivity, attrition risk, or vacancy cost.
              </p>
            </div>
            <div className="fail reveal">
              <div className="num">FAILURE 03 / STRUCTURAL</div>
              <h3>HR snapshots, not financial planning</h3>
              <p>
                Labour is 60–70% of the cost base in professional services. Managing it with survey
                snapshots and gut instinct is like running a capital-intensive operation without
                real-time production data.
              </p>
            </div>
          </div>
          <div className="stat-band reveal">
            <div className="stat">
              <div className="big">20%</div>
              <div className="lbl">Of employees engaged at work in 2025 (Gallup)</div>
            </div>
            <div className="stat">
              <div className="big">$10T</div>
              <div className="lbl">Annual lost productivity — 9% of global GDP</div>
            </div>
            <div className="stat">
              <div className="big">7 Jun 2026</div>
              <div className="lbl">EU Pay Transparency Directive deadline</div>
            </div>
          </div>
          <div className="takeaway reveal">
            The market does not need another salary survey. It needs the intelligence to know where
            pay is generating returns — and where it is quietly leaking value.
          </div>
        </div>
      </section>

      {/* ============ PRODUCTS ============ */}
      <section id="products" className="dark">
        <div className="wrap">
          <div className="reveal">
            <div className="eyebrow">The platform</div>
            <h2 className="sec-title">A decision engine, not a salary lookup</h2>
            <p className="sec-lede">
              One source of truth for jobs, incumbents, market data, and cost — governed by explicit
              policy rather than analyst formulas hidden in local files. The distance between
              benchmark insight and operational action collapses to near zero.
            </p>
          </div>

          {/* Product 1 */}
          <div className="prod reveal">
            <div className="prod-copy">
              <div className="prod-kicker">Product 01 · Job Pricing Engine</div>
              <h3>Every hire priced. Every offer defensible.</h3>
              <p className="desc">
                Prices a new hire by balancing three forces — the firm&apos;s target market position,
                the internal value of the role, and the pay of comparable incumbents. Survey data is a
                core input, never the sole determinant.
              </p>
              <div className="flow">
                Job Intake → Benchmark Match → Pricing Engine → Internal Equity → Governed Offer
              </div>
              <ul>
                <li>
                  <span>
                    <b>Floor, target, stretch</b> — a defensible range with the reasoning attached,
                    never a single unqualified number.
                  </span>
                </li>
                <li>
                  <span>
                    <b>Equity flags</b> warn before an offer creates compression, inversion, or an
                    outlier compa-ratio.
                  </span>
                </li>
                <li>
                  <span>
                    <b>Content-based matching</b> at ~70% similarity — not title alone — with all
                    market data aged to a common date.
                  </span>
                </li>
              </ul>
            </div>
            <div className="panel">
              <div className="panel-title">The governed output</div>
              <div className="row">
                <span className="l">Floor</span>
                <span className="r">
                  Lowest defensible offer given range minimum, market floor, internal parity
                </span>
              </div>
              <div className="row">
                <span className="l">Target</span>
                <span className="r">
                  Recommended offer for a solid-fit candidate at expected proficiency
                </span>
              </div>
              <div className="row">
                <span className="l">Stretch</span>
                <span className="r">Upper bound for scarce skills, with added approval</span>
              </div>
              <div className="row">
                <span className="l">Equity flag</span>
                <span className="r">
                  Compression, inversion, and outlier warnings before the offer goes out
                </span>
              </div>
              <div className="row">
                <span className="l">Rationale</span>
                <span className="r">
                  Market source, peer group, percentile target, every deviation — documented
                </span>
              </div>
            </div>
          </div>

          {/* Product 2 */}
          <div className="prod flip reveal">
            <div className="prod-copy">
              <div className="prod-kicker">Product 02 · Compensation Ranges Designer</div>
              <h3>Salary structures designed by policy, not spreadsheet</h3>
              <p className="desc">
                The decision-support workspace to design, test, govern, and publish salary structures
                using multiple market-data providers — while preserving internal equity,
                affordability, and policy consistency.
              </p>
              <ul>
                <li>
                  <span>
                    <b>Provider Hub</b> ingests survey files and APIs from multiple providers,
                    applying aging and normalization.
                  </span>
                </li>
                <li>
                  <span>
                    <b>Structure Designer</b> builds grades, bands, midpoint progression, spread and
                    overlap rules.
                  </span>
                </li>
                <li>
                  <span>
                    <b>Cost Simulator</b> estimates the cost of moving employees to policy positions —
                    with phased cost curves.
                  </span>
                </li>
                <li>
                  <span>
                    <b>Governance Console</b> manages approvals, exceptions, and audit logs — any
                    historical design can be reproduced exactly and defended to a regulator.
                  </span>
                </li>
              </ul>
            </div>
            <div className="shot glow">
              <img src="/landing/product.png" alt="CryptoPayScale benchmark dashboards on tablet" />
            </div>
          </div>

          {/* Product 3 */}
          <div className="prod reveal">
            <div className="prod-copy">
              <div className="prod-kicker">Product 03 · The Compensation Control Tower</div>
              <h3>Compensation as a management system, not an HR report</h3>
              <p className="desc">
                Links market competitiveness, affordability, internal equity, and workforce
                productivity in one decision environment — built for leaders who need three answers
                fast: where pay is misaligned, what it costs to fix, and whether the fix improves
                workforce value creation.
              </p>
              <p className="desc">
                Governance by exception: the dashboard surfaces below-market critical roles,
                over-market low performers, red-circle cases, and units with rising cost but weak
                productivity — while role-based access keeps employee-level pay data with reward
                specialists.
              </p>
            </div>
            <div className="uc-grid">
              <div className="uc">
                <div className="k">USE CASE 01</div>
                <h4>Compensation Control Tower</h4>
                <p>
                  Market compensation ratio, compa-ratio, compensation per FTE, revenue per employee,
                  and human capital ROI — each with current value, trend, and policy target.
                </p>
              </div>
              <div className="uc">
                <div className="k">USE CASE 02</div>
                <h4>Job Family Positioning Console</h4>
                <p>
                  A line-by-line grid by family, role, grade, geography, and incumbent — with
                  criticality and recommended action.
                </p>
              </div>
              <div className="uc">
                <div className="k">USE CASE 03</div>
                <h4>Adjustment Simulator</h4>
                <p>
                  Models the cost of moving cohorts to policy targets across one-off, phased, and
                  budget-constrained scenarios.
                </p>
              </div>
              <div className="uc">
                <div className="k">USE CASE 04</div>
                <h4>Workforce Economics Cockpit</h4>
                <p>
                  Correlates pay spend with revenue per employee, operating profit per FTE, and human
                  capital ROI.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FRONTIER ============ */}
      <section id="frontier">
        <div className="wrap">
          <div className="reveal">
            <div className="eyebrow">The differentiated lens</div>
            <h2 className="sec-title">The Pay-Productivity Frontier</h2>
          </div>
          <div className="frontier">
            <div
              className="quad reveal"
              role="img"
              aria-label="Two-by-two matrix of market pay position against realized workforce productivity"
            >
              <div className="q-zone lvl">LATENT VALUE LEAKAGE</div>
              <div className="q-zone siz">STRATEGIC INVESTMENT ZONE</div>
              <div className="grid-area">
                <div className="q-cell q1">
                  <div className="q-pill">
                    Underpaid /<br />
                    High-Performing
                  </div>
                </div>
                <div className="q-cell q2">
                  <div className="q-pill">
                    Well-Paid /<br />
                    High-Performing
                  </div>
                </div>
                <div className="q-cell q3">
                  <div className="q-pill">
                    Underpaid /<br />
                    Underperforming
                  </div>
                </div>
                <div className="q-cell q4">
                  <div className="q-pill">
                    Well-Paid /<br />
                    Low-Performing
                  </div>
                </div>
              </div>
              <div className="axis x">Market Pay Position →</div>
              <div className="axis y">Realized Workforce Productivity →</div>
            </div>
            <div className="frontier-copy reveal">
              <h3>The most dangerous quadrant isn&apos;t the underperformers</h3>
              <p>
                It is the <b>underpaid high-performers</b> — latent value leakage, where the firm
                extracts above-market output from people who will eventually discover their market
                value and leave.
              </p>
              <p>
                The <b>well-paid high-performers</b> are the strategic investment zone, where premium
                pay generates premium returns. No single metric reveals either: the intelligence lies
                in the relationships, tracked by job family, geography, and business unit.
              </p>
              <div className="takeaway" style={{ marginTop: 34 }}>
                A firm that knows its top 15% of delivery talent generates 40% of margin has a
                rational basis to pay that cohort at the 75th percentile — and to hold the rest at
                median without losing them.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ROADMAP ============ */}
      <section id="roadmap" className="dark">
        <div className="wrap">
          <div className="reveal">
            <div className="eyebrow">The intelligence roadmap</div>
            <h2 className="sec-title">From dashboard to decision engine</h2>
            <p className="sec-lede">
              A four-phase evolution toward the question a CFO actually asks — not &quot;what is the
              market,&quot; but &quot;what should we do, at what cost, with what return.&quot;
            </p>
          </div>
          <div className="phases reveal">
            <div className="phase">
              <div className="dot">1</div>
              <h4>Descriptive Dashboards</h4>
              <p>Where pay sits today — market position, compa-ratios, structure health.</p>
            </div>
            <div className="phase">
              <div className="dot">2</div>
              <h4>Diagnostic Anomaly Detection</h4>
              <p>Which gaps matter — outliers, compression, and misalignment surfaced automatically.</p>
            </div>
            <div className="phase">
              <div className="dot">3</div>
              <h4>Predictive Forecasting</h4>
              <p>What happens next — pay actions modeled against attrition, productivity, and return.</p>
            </div>
            <div className="phase">
              <div className="dot">4</div>
              <h4>Prescriptive Capital Allocation</h4>
              <p>
                What to do, at what cost, with what return — workforce capital allocated like any
                other capital.
              </p>
            </div>
          </div>
          <div className="engines">
            <div className="engine reveal">
              <div className="k">01</div>
              <h4>Workforce Economics Forecaster</h4>
              <p>
                Models how compensation actions affect revenue per employee, operating profit per
                employee, and Return on Human Investment over future periods. Compensation decisions
                stop being made in a financial vacuum.
              </p>
            </div>
            <div className="engine reveal">
              <div className="k">02</div>
              <h4>Workforce Value Density Index</h4>
              <p>
                A proprietary metric measuring economic output relative to total workforce cost —
                identifying which talent pools create disproportionate enterprise value and justify
                differentiated pay.
              </p>
            </div>
            <div className="engine reveal">
              <div className="k">03</div>
              <h4>Cost of Inaction Engine</h4>
              <p>
                Estimates the cost of <em>not</em> correcting below-market pay: regretted attrition,
                slower hiring, contractor dependency, burnout-driven productivity loss. From &quot;what
                does it cost to fix&quot; to &quot;what does it cost to leave broken.&quot;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ECOSYSTEM ============ */}
      <section id="ecosystem" className="tint">
        <div className="wrap">
          <div className="reveal" style={{ textAlign: 'center', maxWidth: 820, margin: '0 auto' }}>
            <div className="eyebrow" style={{ justifyContent: 'center' }}>
              Where it sits
            </div>
            <h2 className="sec-title" style={{ margin: '0 auto' }}>
              The integrated ecosystem for Web3 talent, rewards and payroll execution
            </h2>
            <p className="sec-lede" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
              AgileDynamics.co evolves from advisory firm into an integrated operating platform:
              educating the market, benchmarking talent value, designing reward architecture,
              tokenising incentives, and executing compliant on-chain payroll.
            </p>
          </div>
          <div className="loop reveal">
            <span className="step">Educate</span>
            <span className="arr">→</span>
            <span className="step hot">Benchmark</span>
            <span className="arr">→</span>
            <span className="step">Incentivise</span>
            <span className="arr">→</span>
            <span className="step">Design</span>
            <span className="arr">→</span>
            <span className="step">Execute</span>
          </div>
          <div className="layers">
            <a
              className="layer reveal"
              href={ECOSYSTEM_LINKS.astroArmadillos}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="layer-num">Layer 01</div>
              <h4>AstroArmadillos.io</h4>
              <p>
                Web3 education and GameFi adoption layer. Builds a community of Web3-literate users
                through gamified learning, NFTs, $ASTROS and learn-to-earn experiences.
              </p>
              <div className="layer-role">Educate &amp; Adopt</div>
            </a>
            <a
              className="layer hot reveal"
              href={ECOSYSTEM_LINKS.cryptoPayScale}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="layer-num">Layer 02</div>
              <h4>CryptoPayScale.io</h4>
              <p>
                AI-powered compensation benchmarking and pay strategy platform. Converts market data,
                role architecture and pay transparency needs into structured compensation
                intelligence.
              </p>
              <div className="layer-role">Benchmark &amp; Model</div>
            </a>
            <a
              className="layer reveal"
              href={ECOSYSTEM_LINKS.syntheticEquity}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="layer-num">Layer 03</div>
              <h4>SyntheticEquity.io</h4>
              <p>
                Tokenised performance incentives. Gives employees, partners and contributors
                ownership-like economics without voting dilution or transfer of actual shares.
              </p>
              <div className="layer-role">Incentivise</div>
            </a>
            <a
              className="layer reveal"
              href={ECOSYSTEM_LINKS.agileDynamics}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="layer-num">Layer 04</div>
              <h4>AgileDynamics Advisory</h4>
              <p>
                Human-led strategy, organization, total rewards and blockchain advisory. Designs the
                governance, contribution logic, compliance model and implementation roadmap.
              </p>
              <div className="layer-role">Design</div>
            </a>
            <a
              className="layer reveal"
              href={ECOSYSTEM_LINKS.cryptoPayroll}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="layer-num">Layer 05</div>
              <h4>CryptoPayroll.ai</h4>
              <p>
                Non-custodial, multi-chain execution layer for borderless payroll. Converts
                compensation designs into batch payments, off-cycle payroll, audit receipts and
                KYC/AML-ready workflows.
              </p>
              <div className="layer-role">Execute &amp; Pay</div>
            </a>
          </div>
          <div className="takeaway reveal" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
            Compliance with the EU Pay Transparency Directive is structurally impossible without
            defensible, current benchmark data — and CryptoPayScale.io captures it at the moment of
            design, as an auditable methodology rather than a report.
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="dark cta-final">
        <div className="wrap reveal">
          <h2>
            The firms that win won&apos;t pay the median.
            <br />
            They&apos;ll <span className="accent">know the gap</span>.
          </h2>
          <p>
            Real-time benchmark data. Predictive analytics that connect pay to attrition and output.
            Integrated execution that closes the loop to settlement. The data moat deepens with every
            client; the intelligence compounds with every cycle.
          </p>
          <div className="hero-ctas">
            <Link className="btn btn-primary" to={PLATFORM_PATH}>
              Open the platform →
            </Link>
            <a className="btn btn-ghost" href={AGILE_DYNAMICS} target="_blank" rel="noopener noreferrer">
              Talk to Agile Dynamics
            </a>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap foot">
          <a href="#top" className="brand">
            <img src="/landing/logo.png" alt="CryptoPayScale logo" />
            <span className="word">
              Crypto<span>PayScale</span>
            </span>
          </a>
          <small>
            Prepared by{' '}
            <a href={AGILE_DYNAMICS} target="_blank" rel="noopener noreferrer">
              Agile Dynamics
            </a>{' '}
            · Strategy &amp; Web3 Advisory · © 2026
          </small>
        </div>
      </footer>

      <button
        className={showTop ? 'to-top show' : 'to-top'}
        aria-label="Back to top"
        onClick={scrollToTop}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}
