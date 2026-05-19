import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import PicoCADModel from './PicoCADModel';
import { RPGBubble } from './components/RPGBubble';
import { SEASON_ONE_ROW_1, SEASON_ONE_ROW_2, SEASON_ONE_ROW_3 } from './data/seasonOne';
import './index.css';

function App() {
  const [stage, setStage] = useState<'hero' | 'white' | 'specs' | 'orange'>('hero');

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      
      if (scrollY <= vh * 0.4) {
        setStage('hero');
      } else if (scrollY > vh * 0.4 && scrollY < vh * 3.3) {
        // Only show bubble inside the white narrative section
        setStage('white');
      } else if (scrollY >= vh * 3.3 && scrollY < vh * 6.0) {
        // Specs section active
        setStage('specs');
      } else {
        // Zoom-in close-up section
        setStage('orange');
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="app-container">
      <main>
        <section className="hero-section">
          <div className="hero-logo">
            {"playdate".split("").map((letter, idx) => (
              <span key={idx} style={{ animationDelay: `${1.5 + idx * 0.08}s` }}>
                {letter}
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
                  >
                    <Html position={[12, 5, 0]} center zIndexRange={[100, 0]}>
                      <RPGBubble 
                        text={"Hi! I'm Playdate."}
                        direction="left"
                        width="220px"
                        visible={stage === 'hero'}
                      />
                    </Html>
                    <Html position={[0, 13, 0]} zIndexRange={[100, 0]}>
                      <div style={{ position: 'absolute', bottom: '0px', transform: 'translateX(-50%)' }}>
                        <RPGBubble 
                          text={"I'm a tiny, yellow handheld game system.\n\nWith a bunch of brand-new games."}
                          direction="bottom"
                          width="450px"
                          visible={stage === 'white'}
                        />
                      </div>
                    </Html>
                  </PicoCADModel>
                </group>
              </Canvas>
            </div>
          </div>
        </section>

        <section className="white-section">
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
              
              {/* Carousel Row 1 - Scrolls Left */}
              <div className="carousel-row">
                <div className="carousel-track scroll-left-track">
                  {[...SEASON_ONE_ROW_1, ...SEASON_ONE_ROW_1, ...SEASON_ONE_ROW_1, ...SEASON_ONE_ROW_1].map((game, idx) => (
                    <div key={idx} className="carousel-game-card">
                      <img src={game.imageUrl} alt={game.title} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Carousel Row 2 - Scrolls Right */}
              <div className="carousel-row">
                <div className="carousel-track scroll-right-track">
                  {[...SEASON_ONE_ROW_2, ...SEASON_ONE_ROW_2, ...SEASON_ONE_ROW_2, ...SEASON_ONE_ROW_2].map((game, idx) => (
                    <div key={idx} className="carousel-game-card">
                      <img src={game.imageUrl} alt={game.title} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Carousel Row 3 - Scrolls Left */}
              <div className="carousel-row">
                <div className="carousel-track scroll-left-track">
                  {[...SEASON_ONE_ROW_3, ...SEASON_ONE_ROW_3, ...SEASON_ONE_ROW_3, ...SEASON_ONE_ROW_3].map((game, idx) => (
                    <div key={idx} className="carousel-game-card">
                      <img src={game.imageUrl} alt={game.title} />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </section>

        <section className="specs-section">
          <div className="specs-sticky-content">
            <div className="specs-container">
              <h2 className="specs-title">The Specs.</h2>
              <div className="specs-grid">
                
                {/* Column 1 */}
                <div className="specs-column">
                  
                  <div className="specs-item">
                    <span className="specs-label">Battery</span>
                    <div className="specs-value-group">
                      <svg className="specs-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2" y="6" width="16" height="12" rx="2" stroke="#FFCC00" strokeWidth="2.5" />
                        <line x1="6" y1="10" x2="6" y2="14" stroke="#FFCC00" strokeWidth="2" strokeLinecap="round" />
                        <line x1="10" y1="10" x2="10" y2="14" stroke="#FFCC00" strokeWidth="2" strokeLinecap="round" />
                        <line x1="14" y1="10" x2="14" y2="14" stroke="#FFCC00" strokeWidth="2" strokeLinecap="round" />
                        <path d="M20 9V15M20 9C20.8 9 21.5 9.5 21.5 10.5V13.5C21.5 14.5 20.8 15 20 15V9Z" fill="#FFCC00" />
                      </svg>
                      <div className="specs-text">
                        <strong>14 days standby clock</strong>
                        <span>8 hours active</span>
                      </div>
                    </div>
                  </div>

                  <div className="specs-item">
                    <span className="specs-label">CPU</span>
                    <div className="specs-value-group">
                      <svg className="specs-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="5" width="14" height="14" rx="2" stroke="#FFCC00" strokeWidth="2.5" />
                        <rect x="9" y="9" width="6" height="6" fill="#FFCC00" />
                        <path d="M9 2V5M15 2V5M9 19V22M15 19V22M2 9H5M2 15H5M19 9H22M19 15H22" stroke="#FFCC00" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <div className="specs-text">
                        <strong>168 MHz Cortex M7</strong>
                        <span>SDK supports Lua, C</span>
                      </div>
                    </div>
                  </div>

                  <div className="specs-item">
                    <span className="specs-label">Storage</span>
                    <div className="specs-value-group">
                      <svg className="specs-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4H16L20 8V20C20 21.1 19.1 22 18 22H6C4.9 22 4 21.1 4 20V4Z" stroke="#FFCC00" strokeWidth="2.5" fill="none" />
                        <rect x="7" y="4" width="8" height="6" fill="#FFCC00" />
                        <rect x="8" y="13" width="8" height="6" stroke="#FFCC00" strokeWidth="2" fill="none" />
                      </svg>
                      <div className="specs-text">
                        <strong>16 MB RAM</strong>
                        <span>8 KB L1 Cache, 4 GB Flash</span>
                      </div>
                    </div>
                  </div>

                  <div className="specs-item">
                    <span className="specs-label">Size</span>
                    <div className="specs-value-group">
                      <svg className="specs-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="4" y="4" width="16" height="16" rx="2" stroke="#FFCC00" strokeWidth="2.5" />
                        <line x1="4" y1="9" x2="20" y2="9" stroke="#FFCC00" strokeWidth="1.5" strokeDasharray="3 3" />
                        <line x1="4" y1="14" x2="20" y2="14" stroke="#FFCC00" strokeWidth="1.5" strokeDasharray="3 3" />
                        <line x1="9" y1="4" x2="9" y2="20" stroke="#FFCC00" strokeWidth="1.5" strokeDasharray="3 3" />
                        <line x1="14" y1="4" x2="14" y2="20" stroke="#FFCC00" strokeWidth="1.5" strokeDasharray="3 3" />
                      </svg>
                      <div className="specs-text">
                        <strong>76 × 74 × 9 mm</strong>
                      </div>
                    </div>
                  </div>

                  <div className="specs-item">
                    <span className="specs-label">Included</span>
                    <div className="specs-value-group">
                      <svg className="specs-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2V22M2 12H22M5 5L19 19M5 19L19 5" stroke="#FFCC00" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      <div className="specs-text">
                        <strong>Playdate console</strong>
                        <span>USB-C to A Cable, User Guide</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Column 2 */}
                <div className="specs-column">
                  
                  <div className="specs-item">
                    <span className="specs-label">Wireless</span>
                    <div className="specs-value-group">
                      <svg className="specs-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 19C13.1046 19 14 18.1046 14 17C14 15.8954 13.1046 15 12 15C10.8954 15 10 15.8954 10 17C10 18.1046 10.8954 19 12 19Z" fill="#FFCC00" />
                        <path d="M8 13C10.5 10.5 13.5 10.5 16 13" stroke="#FFCC00" strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M5 10C9 6 15 6 19 10" stroke="#FFCC00" strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M2 7C8 1 16 1 22 7" stroke="#FFCC00" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                      <div className="specs-text">
                        <strong>802.11bgn 2.4GHz Wi-Fi</strong>
                      </div>
                    </div>
                  </div>

                  <div className="specs-item">
                    <span className="specs-label">Sound</span>
                    <div className="specs-value-group">
                      <svg className="specs-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 9H8L13 5V19L8 15H4V9Z" fill="#FFCC00" stroke="#FFCC00" strokeWidth="2.5" strokeLinejoin="round" />
                        <path d="M17 9C18 10 18 14 17 15" stroke="#FFCC00" strokeWidth="2" strokeLinecap="round" fill="none" />
                        <path d="M20 6C22 8.5 22 15.5 20 18" stroke="#FFCC00" strokeWidth="2" strokeLinecap="round" fill="none" />
                      </svg>
                      <div className="specs-text">
                        <strong>Built-In Mono Speaker</strong>
                        <span>Stereo Headphone Jack</span>
                        <span>Condenser Mic + TRRS Mic In</span>
                      </div>
                    </div>
                  </div>

                  <div className="specs-item">
                    <span className="specs-label">Display</span>
                    <div className="specs-value-group">
                      <svg className="specs-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z" stroke="#FFCC00" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
                        <circle cx="12" cy="12" r="3" fill="#FFCC00" />
                      </svg>
                      <div className="specs-text">
                        <strong>400 × 240 1-bit display</strong>
                      </div>
                    </div>
                  </div>

                  <div className="specs-item">
                    <span className="specs-label">Inputs</span>
                    <div className="specs-value-group">
                      <svg className="specs-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="6" cy="12" r="3" fill="#FFCC00" stroke="#FFCC00" strokeWidth="1.5" />
                        <path d="M12 9V15M9 12H15" stroke="#FFCC00" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="18" cy="9" r="2" fill="#FFCC00" />
                        <circle cx="18" cy="15" r="2" fill="#FFCC00" />
                      </svg>
                      <div className="specs-text">
                        <strong>D-Pad, A + B Buttons</strong>
                        <span>3-Axis Accelerometer, Crank</span>
                      </div>
                    </div>
                  </div>

                  <div className="specs-item">
                    <span className="specs-label">Cost</span>
                    <div className="specs-value-group">
                      <svg className="specs-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.5 4.5L13.5 11.5M20.5 4.5H15M20.5 4.5V10M11 6H6C4.9 6 4 6.9 4 8V18C4 19.1 4.9 20 6 20H16C17.1 20 18 19.1 18 18V13" stroke="#FFCC00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                      </svg>
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
        </section>

        <section className="orange-section">
          {/* Clean spacer section for scroll transition */}
        </section>
      </main>
    </div>
  );
}

export default App;
