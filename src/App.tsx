import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center } from '@react-three/drei';
import PicoCADModel from './PicoCADModel';

function App() {
  return (
    <div className="app-container">
      <nav className="nav-bar">
        <div className="logo">playdate</div>
        <div className="nav-links">
          <a href="#games"><span>✨</span> Games</a>
          <a href="#dev"><span>💻</span> Dev</a>
          <a href="#education"><span>🎓</span> Education</a>
          <a href="#help"><span>❓</span> Help</a>
          <a href="#signin"><span>👤</span> Sign In</a>
          <a href="#buy" className="btn-buy"><span>🛍️</span> Buy Now!!</a>
        </div>
      </nav>

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
                  <PicoCADModel url="/playdate.txt" textureUrl="/playdate.png" scale={1.22} />
                </group>
              </Canvas>
            </div>
          </div>
        </section>

        <section className="yellow-section">
          <div className="yellow-container">
            <div className="speech-bubble">
              <h2 className="speech-title">It's a new, tiny handheld game system.</h2>
              <p className="speech-text">With a bunch of brand-new games.<br/>We made Playdate just for fun.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
