'use client';

import Link from 'next/link';
import { useAuth } from '../lib/auth-context';

export default function Home() {
  const { user, token } = useAuth();
  const isLoggedIn = !!user && !!token;

  return (
    <main>
      <nav className="nav">
        <Link className="brand" href="/">
          <span className="brandMark">Z</span>
          <span>Zeivio</span>
        </Link>

        <div className="navLinks">
          <a href="#product">Product</a>
          <a href="#features">Features</a>
          <a href="#education">Education</a>
        </div>

        <div className="navActions">
          {isLoggedIn ? (
            <>
              <Link href="/profile" className="profilePillNav">
                <span className="userAvatarSmall">{user.name.charAt(0).toUpperCase()}</span>
                <span>{user.name}</span>
              </Link>
              <Link href="/dashboard" className="buttonPrimary">
                Zum Dashboard →
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="buttonGhost">
                Anmelden
              </Link>
              <Link href="/register" className="buttonPrimary">
                Registrieren
              </Link>
            </>
          )}
        </div>
      </nav>

      <section className="hero">
        <div className="heroContent">
          <div className="eyebrow">
            Presentations, rethought.
          </div>

          <h1>
            Present ideas.
            <br />
            <span>Involve everyone.</span>
          </h1>

          <p className="heroText">
            Create beautiful presentations and turn your audience
            into active participants — without switching tools.
          </p>

          <div className="heroActions">
            <Link
              href={isLoggedIn ? "/dashboard" : "/register"}
              className="buttonPrimary buttonLarge"
            >
              {isLoggedIn ? "Dashboard öffnen" : "Start creating"}
              <span>→</span>
            </Link>

            <a href="#features" className="buttonSecondary buttonLarge">
              Explore Zeivio
            </a>
          </div>

          <p className="heroNote">
            Free to start · No credit card required
          </p>
        </div>

        <div className="productPreview">
          <div className="previewGlow" />

          <div className="appWindow">
            <div className="appTopbar">
              <div className="miniBrand">
                <span className="miniLogo">Z</span>
                Zeivio
              </div>

              <div className="documentName">
                Climate change
              </div>

              <div className="appActions">
                <button>Share</button>
                <button className="presentButton">Present</button>
              </div>
            </div>

            <div className="editor">
              <aside className="slideSidebar">
                <div className="slide activeSlide">
                  <span>1</span>
                  <div className="slideMini">
                    <strong>Our planet.</strong>
                  </div>
                </div>

                <div className="slide">
                  <span>2</span>
                  <div className="slideMini slideMiniTwo">
                    <strong>Why now?</strong>
                  </div>
                </div>

                <div className="slide">
                  <span>3</span>
                  <div className="slideMini slideMiniThree">
                    <strong>Poll</strong>
                  </div>
                </div>

                <button className="addSlide">+ Add slide</button>
              </aside>

              <div className="canvasArea">
                <div className="presentationCanvas">
                  <div className="canvasBadge">
                    CLIMATE / 2026
                  </div>

                  <h2>
                    Our planet
                    <br />
                    is changing.
                  </h2>

                  <p>
                    Understanding the numbers behind a changing climate.
                  </p>

                  <div className="canvasStat">
                    <strong>1.5°</strong>
                    <span>matters.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="floatingCard pollCard">
            <div className="cardIcon">↗</div>
            <div>
              <strong>Live interaction</strong>
              <span>Audience connected</span>
            </div>
            <div className="liveDot" />
          </div>

          <div className="floatingCard audienceCard">
            <div className="audienceNumber">24</div>
            <div>
              <strong>Participants</strong>
              <span>Joined instantly</span>
            </div>
          </div>
        </div>
      </section>

      <section className="statement" id="product">
        <p className="sectionLabel">THE IDEA</p>

        <h2>
          Slides shouldn't be
          <br />
          a one-way conversation.
        </h2>

        <p>
          Zeivio combines presentation, interaction and audience
          participation in one focused workspace.
        </p>
      </section>

      <section className="features" id="features">
        <article className="feature featureLarge">
          <div>
            <span className="featureNumber">01</span>
            <h3>Build without fighting the editor.</h3>
          </div>

          <p>
            A focused presentation editor built around content,
            not menus and configuration.
          </p>

          <div className="editorDemo">
            <div className="demoToolbar">
              <span>Text</span>
              <span>Media</span>
              <span>Chart</span>
              <span>Interact</span>
            </div>

            <div className="demoCanvas">
              <span>Ideas deserve attention.</span>
            </div>
          </div>
        </article>

        <article className="feature">
          <span className="featureNumber">02</span>

          <h3>Bring the room into your presentation.</h3>

          <p>
            Polls, questions and feedback happen directly alongside
            your slides.
          </p>

          <div className="pollDemo">
            <span>What do you think?</span>

            <div className="pollOption">
              <div style={{ width: "72%" }} />
              <span>72%</span>
            </div>

            <div className="pollOption">
              <div style={{ width: "41%" }} />
              <span>41%</span>
            </div>

            <div className="pollOption">
              <div style={{ width: "24%" }} />
              <span>24%</span>
            </div>
          </div>
        </article>

        <article className="feature">
          <span className="featureNumber">03</span>

          <h3>Join with one scan.</h3>

          <p>
            Your audience opens Zeivio on any device. No account,
            download or setup required.
          </p>

          <div className="joinDemo">
            <div className="fakeQr">
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
            </div>

            <div>
              <span>JOIN PRESENTATION</span>
              <strong>zeiv.io/8KF2</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="education" id="education">
        <div>
          <span className="sectionLabel">BUILT FOR REAL ROOMS</span>

          <h2>
            Made for people
            <br />
            with something to say.
          </h2>
        </div>

        <div className="educationText">
          <p>
            From classrooms and universities to workshops and team
            meetings, Zeivio keeps the presenter and audience in the
            same experience.
          </p>

          <button className="textButton">
            Discover use cases →
          </button>
        </div>
      </section>

      <section className="finalCta">
        <div className="finalAccent" />

        <span className="sectionLabel">ZEIVIO</span>

        <h2>
          Your next presentation
          <br />
          should feel different.
        </h2>

        <p>
          Create it. Present it. Let people take part.
        </p>

        <Link
          href={isLoggedIn ? "/dashboard" : "/register"}
          className="buttonPrimary buttonLarge"
        >
          {isLoggedIn ? "Zum Dashboard" : "Create a presentation"}
          <span>→</span>
        </Link>
      </section>

      <footer>
        <Link className="brand footerBrand" href="/">
          <span className="brandMark">Z</span>
          <span>Zeivio</span>
        </Link>

        <p>Presentations with participation built in.</p>

        <div className="footerLinks">
          <a href="#">Privacy</a>
          <a href="#">Imprint</a>
          <span>© 2026 Zeivio</span>
        </div>
      </footer>
    </main>
  );
}