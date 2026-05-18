import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import PicoCADModel from './PicoCADModel';
import { RPGBubble } from './components/RPGBubble';
import './index.css';

function App() {
  const [stage, setStage] = useState<'hero' | 'white' | 'orange'>('hero');

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      
      if (scrollY <= vh * 0.4) {
        setStage('hero');
      } else if (scrollY > vh * 0.4 && scrollY < vh * 1.8) {
        // Only show bubble inside the white narrative section
        setStage('white');
      } else {
        // Absolutely no balloons in the orange section
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
          <div className="hero-logo">playdate</div>
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
                  <PicoCADModel url="/playdate.txt" textureUrl="/playdate.png" scale={1.22}>
                    <Html position={[12, 5, 0]} center zIndexRange={[100, 0]}>
                      <RPGBubble 
                        text={"Hi."}
                        direction="left"
                        width="120px"
                        visible={stage === 'hero'}
                      />
                    </Html>
                    <Html position={[0, 13, 0]} zIndexRange={[100, 0]}>
                      <div style={{ position: 'absolute', bottom: '0px', transform: 'translateX(-50%)' }}>
                        <RPGBubble 
                          text={"It's a new, tiny handheld game system.\n\nWith a bunch of brand-new games.\nWe made Playdate just for fun."}
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
          {/* Empty white section, content is now tracked to the 3D model via <Html> */}
        </section>
        
        <section className="orange-section">
          {/* Final giant screen section */}
        </section>
      </main>
    </div>
  );
}

export default App;
