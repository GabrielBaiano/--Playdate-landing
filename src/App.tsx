import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import PicoCADModel from './PicoCADModel';
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
                  />
                </group>
              </Canvas>
            </div>
          </div>
        </section>

        <section className="white-section">
          {/* Empty white section as requested */}
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
