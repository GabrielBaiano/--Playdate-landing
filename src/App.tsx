import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import PicoCADModel from './PicoCADModel';
import { RPGBubble } from './components/RPGBubble';
import { SEASON_ONE_ROW_1, SEASON_ONE_ROW_2, SEASON_ONE_ROW_3 } from './data/seasonOne';
import './index.css';

function App() {
  const [stage, setStage] = useState<'hero' | 'white' | 'specs' | 'orange'>('hero');
  const [specStage, setSpecStage] = useState<0 | 1 | 2 | 3>(0);
  const [scrollYState, setScrollYState] = useState(0);
  const [blueprintOpacity, setBlueprintOpacity] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      setScrollYState(scrollY);

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
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;

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
                    specStage={specStage}
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
              
              <div className="carousel-row">
                <div className="carousel-track scroll-left-track">
                  {[...SEASON_ONE_ROW_1, ...SEASON_ONE_ROW_1, ...SEASON_ONE_ROW_1, ...SEASON_ONE_ROW_1].map((game, idx) => (
                    <div key={idx} className="carousel-game-card">
                      <img src={game.imageUrl} alt={game.title} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="carousel-row">
                <div className="carousel-track scroll-right-track">
                  {[...SEASON_ONE_ROW_2, ...SEASON_ONE_ROW_2, ...SEASON_ONE_ROW_2, ...SEASON_ONE_ROW_2].map((game, idx) => (
                    <div key={idx} className="carousel-game-card">
                      <img src={game.imageUrl} alt={game.title} />
                    </div>
                  ))}
                </div>
              </div>

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
