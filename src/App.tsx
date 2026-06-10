import { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import PicoCADModel from './PicoCADModel';
import { RPGBubble } from './components/RPGBubble';
import { SEASON_ONE_ROW_1, SEASON_ONE_ROW_2, SEASON_ONE_ROW_3 } from './data/seasonOne';
import './index.css';


function SpecsArrows({ visible }: { visible: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!visible) return;

    let active = true;
    const updatePaths = () => {
      if (!active) return;

      const svg = svgRef.current;
      if (!svg) {
        requestAnimationFrame(updatePaths);
        return;
      }

      const svgRect = svg.getBoundingClientRect();

      const arrows = [
        { id: 'battery', marker: 'marker-battery', label: 'spec-battery', side: 'left' },
        { id: 'size', marker: 'marker-size', label: 'spec-size', side: 'left' },
        { id: 'wireless', marker: 'marker-wireless', label: 'spec-wireless', side: 'right' },
        { id: 'cost', marker: 'marker-cost', label: 'spec-cost', side: 'right' },
      ];

      for (const arrow of arrows) {
        const pathEl = document.getElementById(`arrow-path-${arrow.id}`);
        const circleEl = document.getElementById(`arrow-circle-${arrow.id}`);
        const headEl = document.getElementById(`arrow-head-${arrow.id}`);

        const markerEl = document.getElementById(arrow.marker);
        const labelEl = document.getElementById(arrow.label);

        if (pathEl && markerEl && labelEl) {
          const mRect = markerEl.getBoundingClientRect();
          const lRect = labelEl.getBoundingClientRect();

          // Marker center relative to SVG overlay
          const mx = mRect.left - svgRect.left + mRect.width / 2;
          const my = mRect.top - svgRect.top + mRect.height / 2;

          // Label connection point relative to SVG overlay
          // For left column, connect to the right edge of the text (.specs-text), spaced 15px
          // For right column, connect to the left edge of the group container, spaced 15px
          let lx = 0;
          if (arrow.side === 'left') {
            const textEl = labelEl.querySelector('.specs-text');
            const targetRect = textEl ? textEl.getBoundingClientRect() : lRect;
            lx = targetRect.right - svgRect.left + 15;
          } else {
            lx = lRect.left - svgRect.left - 15;
          }
          const ly = lRect.top - svgRect.top + lRect.height / 2;

          // Orthogonal path: horizontal to midpoint, vertical to label height, horizontal to label
          const midX = (mx + lx) / 2;
          const pathD = `M ${mx} ${my} L ${midX} ${my} L ${midX} ${ly} L ${lx} ${ly}`;

          pathEl.setAttribute('d', pathD);

          if (circleEl) {
            circleEl.setAttribute('cx', mx.toString());
            circleEl.setAttribute('cy', my.toString());
          }

          if (headEl) {
            if (arrow.side === 'left') {
              // Arrowhead pointing left (<)
              headEl.setAttribute('points', `${lx},${ly} ${lx + 6},${ly - 4} ${lx + 6},${ly + 4}`);
            } else {
              // Arrowhead pointing right (>)
              headEl.setAttribute('points', `${lx},${ly} ${lx - 6},${ly - 4} ${lx - 6},${ly + 4}`);
            }
          }

          pathEl.style.display = 'block';
          if (circleEl) circleEl.style.display = 'block';
          if (headEl) headEl.style.display = 'block';
        } else {
          // Hide paths if markers or labels aren't found yet
          if (pathEl) pathEl.style.display = 'none';
          if (circleEl) circleEl.style.display = 'none';
          if (headEl) headEl.style.display = 'none';
        }
      }

      requestAnimationFrame(updatePaths);
    };

    requestAnimationFrame(updatePaths);
    return () => {
      active = false;
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9,
        overflow: 'visible',
      }}
    >
      {/* Battery */}
      <path id="arrow-path-battery" fill="none" stroke="#ffe066" strokeWidth="2" strokeDasharray="4 4" />
      <circle id="arrow-circle-battery" r="4" fill="#ffe066" />
      <polygon id="arrow-head-battery" fill="#ffe066" />

      {/* Size */}
      <path id="arrow-path-size" fill="none" stroke="#ffe066" strokeWidth="2" strokeDasharray="4 4" />
      <circle id="arrow-circle-size" r="4" fill="#ffe066" />
      <polygon id="arrow-head-size" fill="#ffe066" />

      {/* Wireless */}
      <path id="arrow-path-wireless" fill="none" stroke="#ffe066" strokeWidth="2" strokeDasharray="4 4" />
      <circle id="arrow-circle-wireless" r="4" fill="#ffe066" />
      <polygon id="arrow-head-wireless" fill="#ffe066" />

      {/* Cost */}
      <path id="arrow-path-cost" fill="none" stroke="#ffe066" strokeWidth="2" strokeDasharray="4 4" />
      <circle id="arrow-circle-cost" r="4" fill="#ffe066" />
      <polygon id="arrow-head-cost" fill="#ffe066" />
    </svg>
  );
}

function App() {
  const [stage, setStage] = useState<'hero' | 'white' | 'specs' | 'orange'>('hero');
  const [specStage, setSpecStage] = useState<0 | 1 | 2 | 3>(0);
  const [blueprintOpacity, setBlueprintOpacity] = useState(0);
  const [scrollYState, setScrollYState] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      setScrollYState(scrollY);

      if (scrollY >= vh * 0.5) {
        document.body.classList.add('body-blue');
      } else {
        document.body.classList.remove('body-blue');
      }

      // Layout (in vh units from page top):
      // 0–1:    hero
      // 1–2.0:  white/catalog (100vh height - physical normal scroll page!)
      // 2.0–3.0: spec slide 1 — closed, ohno face (matches first DOM spec-slide)
      // 3.0–4.0: spec slide 2 — exploded open (matches second DOM spec-slide)
      // 4.0–5.0: spec slide 3 — assembled, angry (matches third DOM spec-slide)
      // 5.0+:   orange zoom

      if (scrollY <= vh * 0.4) {
        setStage('hero');
        setSpecStage(0);
      } else if (scrollY < vh * 2.0) {
        setStage('white');
        setSpecStage(0);
      } else if (scrollY < vh * 3.0) {
        setStage('specs');
        setSpecStage(1);
      } else if (scrollY < vh * 4.0) {
        setStage('specs');
        setSpecStage(2);
      } else if (scrollY < vh * 5.0) {
        setStage('specs');
        setSpecStage(3);
      } else {
        setStage('orange');
        setSpecStage(0);
      }

      // Blueprint Overlay Opacity: 
      // 0 below 0.5vh (hero section), 
      // 1 when approaching and scrolling the catalog/specs sections (hidden behind white-section z-index: 5, then revealed on scroll!),
      // fades out as we transition into the final orange section (past 5.0vh)
      let bOpacity = 0;
      if (scrollY >= vh * 0.5 && scrollY < vh * 5.0) {
        bOpacity = 1;
      } else if (scrollY >= vh * 5.0) {
        bOpacity = Math.max(0, 1 - (scrollY - vh * 5.0) / (vh * 0.5));
      }
      setBlueprintOpacity(bOpacity);
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.body.classList.remove('body-blue');
    };
  }, []);

  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;

  const catalogRow1 = [...SEASON_ONE_ROW_1, ...SEASON_ONE_ROW_3.slice(0, 3)];
  const catalogRow2 = [...SEASON_ONE_ROW_2, ...SEASON_ONE_ROW_3.slice(3)];

  return (
    <div className="app-container">
      {/* Fixed blueprint background — driven dynamically by scroll for maximum fluid transitions! */}
      <div
        className="blueprint-overlay"
        style={{
          opacity: blueprintOpacity,
          transition: 'none' // Override CSS transition so it reacts instantly to the scrollwheel!
        }}
      />


      
      {/* Fixed specs overlay — appears when the console explodes */}
      <div className="specs-overlay" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 20,
        opacity: (scrollYState > vh * 3.3 && scrollYState < vh * 4.6) ? 1 : 0,
        transition: 'opacity 0.4s ease'
      }}>
        <SpecsArrows visible={scrollYState > vh * 3.3 && scrollYState < vh * 4.6} />
        <div className="specs-sticky-content">
          <div className="specs-container">
            <h2 className="specs-title">The Specs.</h2>
            <div className="specs-grid">
              
              {/* Column 1 */}
              <div className="specs-column">
                <div className="specs-item">
                  <div className="specs-value-group" id="spec-battery">
                    <span className="specs-label" style={{ width: '60px', textAlign: 'right' }}>Battery</span>
                    <svg className="specs-icon" viewBox="0 0 24 24" fill="none" stroke="#ffe066" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="16" height="10" rx="2" ry="2"></rect><line x1="22" y1="11" x2="22" y2="13"></line></svg>
                    <div className="specs-text">
                      <strong>14 days standby clock</strong>
                      <strong>8 hours active</strong>
                    </div>
                  </div>
                </div>

                <div className="specs-item">
                  <div className="specs-value-group" id="spec-cpu">
                    <span className="specs-label" style={{ width: '60px', textAlign: 'right' }}>CPU</span>
                    <svg className="specs-icon" viewBox="0 0 24 24" fill="none" stroke="#ffe066" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
                    <div className="specs-text">
                      <strong>168 MHz Cortex M7</strong>
                      <strong>SDK supports Lua, C</strong>
                    </div>
                  </div>
                </div>

                <div className="specs-item">
                  <div className="specs-value-group" id="spec-storage">
                    <span className="specs-label" style={{ width: '60px', textAlign: 'right' }}>Storage</span>
                    <svg className="specs-icon" viewBox="0 0 24 24" fill="none" stroke="#ffe066" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
                    <div className="specs-text">
                      <strong>16 MB RAM</strong>
                      <strong>8 KB L1 Cache</strong>
                      <strong>4 GB Flash</strong>
                    </div>
                  </div>
                </div>

                <div className="specs-item">
                  <div className="specs-value-group" id="spec-size">
                    <span className="specs-label" style={{ width: '60px', textAlign: 'right' }}>Size</span>
                    <svg className="specs-icon" viewBox="0 0 24 24" fill="none" stroke="#ffe066" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                    <div className="specs-text">
                      <strong>76 × 74 × 9 mm</strong>
                    </div>
                  </div>
                </div>

                <div className="specs-item">
                  <div className="specs-value-group" id="spec-included">
                    <span className="specs-label" style={{ width: '60px', textAlign: 'right' }}>Included</span>
                    <svg className="specs-icon" viewBox="0 0 24 24" fill="none" stroke="#ffe066" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="m4.93 10.93 14.14-14.14"></path><path d="m2 12 20 0"></path><path d="m4.93 4.93 14.14 14.14"></path></svg>
                    <div className="specs-text">
                      <strong>Playdate</strong>
                      <strong>USB-C to A Cable</strong>
                      <strong>User Guide</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2 */}
              <div className="specs-column">
                <div className="specs-item">
                  <div className="specs-value-group" id="spec-wireless">
                    <span className="specs-label" style={{ width: '60px', textAlign: 'right' }}>Wireless</span>
                    <svg className="specs-icon" viewBox="0 0 24 24" fill="none" stroke="#ffe066" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
                    <div className="specs-text">
                      <strong>802.11bgn 2.4GHz Wi-Fi</strong>
                    </div>
                  </div>
                </div>

                <div className="specs-item">
                  <div className="specs-value-group" id="spec-sound">
                    <span className="specs-label" style={{ width: '60px', textAlign: 'right' }}>Sound</span>
                    <svg className="specs-icon" viewBox="0 0 24 24" fill="none" stroke="#ffe066" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                    <div className="specs-text">
                      <strong>Built-In Mono Speaker</strong>
                      <strong>Stereo Headphone Jack</strong>
                      <strong>Condenser Mic + TRRS Mic In</strong>
                    </div>
                  </div>
                </div>

                <div className="specs-item">
                  <div className="specs-value-group" id="spec-display">
                    <span className="specs-label" style={{ width: '60px', textAlign: 'right' }}>Display</span>
                    <svg className="specs-icon" viewBox="0 0 24 24" fill="none" stroke="#ffe066" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    <div className="specs-text">
                      <strong>400 × 240 1-bit</strong>
                    </div>
                  </div>
                </div>

                <div className="specs-item">
                  <div className="specs-value-group" id="spec-inputs">
                    <span className="specs-label" style={{ width: '60px', textAlign: 'right' }}>Inputs</span>
                    <svg className="specs-icon" viewBox="0 0 24 24" fill="none" stroke="#ffe066" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line><rect x="2" y="6" width="20" height="12" rx="2"></rect></svg>
                    <div className="specs-text">
                      <strong>D-Pad</strong>
                      <strong>A + B</strong>
                      <strong>Sleep + Menu</strong>
                      <strong>3-Axis Accelerometer</strong>
                      <strong>Crank</strong>
                    </div>
                  </div>
                </div>

                <div className="specs-item">
                  <div className="specs-value-group" id="spec-cost">
                    <span className="specs-label" style={{ width: '60px', textAlign: 'right' }}>Cost</span>
                    <svg className="specs-icon" viewBox="0 0 24 24" fill="none" stroke="#ffe066" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                    <div className="specs-text">
                      <strong>$229</strong>
                      <span>Plus Taxes & Shipping</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
      <main>
        <section className="hero-section">
          <div className="hero-logo">
            {"playdate".split("").map((char, index) => (
              <span key={index} style={{ animationDelay: `${index * 0.1}s` }}>
                {char}
              </span>
            ))}
          </div>
          <div className="hero-3d">
            <div className="canvas-container">
              <Canvas
                camera={{ position: [0, 0, 45], fov: 35 }}
                dpr={0.3}
                gl={{ antialias: false }}
                style={{ imageRendering: 'pixelated' }}
              >
                <ambientLight intensity={1.0} />
                <pointLight position={[10, 10, 10]} intensity={1.0} />
                <group position={[0, -5.5, 0]}>
                  <PicoCADModel
                    url="/playdate.txt"
                    textureUrl="/playdate.png"
                    scale={1.22}
                    stage={stage}
                    specStage={specStage}
                    showArrows={scrollYState > vh * 3.3 && scrollYState < vh * 4.6}
                  >
                    <Html position={[12, 5, 0]} center zIndexRange={[100, 0]}>
                      <RPGBubble
                        text={"Hi! I'm Playdate."}
                        direction="left"
                        width="220px"
                        visible={stage === 'hero'}
                      />
                    </Html>
                    
                    {/* Catalog Bubble: visible only while scrolling the catalog, fades out before it ends */}
                    <Html position={[0, 13, 0]} zIndexRange={[100, 0]}>
                      <div style={{ position: 'absolute', bottom: '0px', transform: 'translateX(-50%)' }}>
                        <RPGBubble
                          text={"I'm a tiny, yellow handheld game system.\n\nWith a bunch of brand-new games."}
                          direction="bottom"
                          width="450px"
                          visible={stage === 'white' && scrollYState < vh * 1.3}
                        />
                      </div>
                    </Html>

                    {/* Spec Slide 1 Bubble: pops in only after console is fully settled in the center, fades out before explosion! */}
                    <Html position={[0, 13, 0]} zIndexRange={[100, 0]}>
                      <div style={{ position: 'absolute', bottom: '0px', transform: 'translateX(-50%)' }}>
                        <RPGBubble
                          text={"Oh no!"}
                          direction="bottom"
                          width="270px"
                          visible={stage === 'specs' && specStage === 1 && scrollYState >= vh * 2.0 && scrollYState < vh * 2.8}
                        />
                      </div>
                    </Html>


                  </PicoCADModel>
                </group>
              </Canvas>
            </div>
          </div>
        </section>

        <section className="white-section bg-white">
          <div className="white-sticky-content">
            
            <div className="catalog-info-container">
              <a href="https://play.date/games" target="_blank" rel="noopener noreferrer" className="catalog-logo-link">
                <div className="catalog-logo-badge" aria-label="Playdate Catalog" />
              </a>
              <p className="catalog-description">
                The fun continues with awesome new Playdate games made by developers around the world. You can install our favorites with <a href="https://play.date/games" target="_blank" rel="noopener noreferrer" className="catalog-inline-link"><b>Catalog</b></a>, a little game store right on your Playdate.
              </p>
              <div className="catalog-btn-wrapper">
                <a href="https://play.date/games" target="_blank" rel="noopener noreferrer" className="catalog-btn-grab">
                  <svg className="catalog-btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="white" />
                    <path d="M12 7V16.5M12 16.5L8.5 13M12 16.5L15.5 13" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  Grab some games!
                </a>
              </div>
            </div>

            <div className="carousel-showcase-container">
              
              <div className="carousel-row">
                <div className="carousel-track scroll-left-track">
                  {[...catalogRow1, ...catalogRow1, ...catalogRow1].map((game, idx) => (
                    <div key={idx} className="carousel-game-card">
                      <img src={game.imageUrl} alt={game.title} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="carousel-row">
                <div className="carousel-track scroll-right-track">
                  {[...catalogRow2, ...catalogRow2, ...catalogRow2].map((game, idx) => (
                    <div key={idx} className="carousel-game-card">
                      <img src={game.imageUrl} alt={game.title} />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Spec Slide 1 — Closed, internals visible */}
        <section className="spec-slide" />

        {/* Spec Slide 2 — Exploded open */}
        <section className="spec-slide" />

        {/* Spec Slide 3 — Assembled, angry face */}
        <section className="spec-slide" />

        <section className="orange-section">
          {/* Clean spacer section for scroll transition */}
        </section>
      </main>
    </div>
  );
}

export default App;
