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

      <main className="hero-section">
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
              <group position={[0, -7.5, 0]}>
                <PicoCADModel url="/playdate.txt" textureUrl="/playdate.png" scale={1.3} />
              </group>
              <OrbitControls enableZoom={false} enablePan={false} />
            </Canvas>
          </div>
        </div>
        
        <div className="hero-content">
          <h1 className="hero-title">
            It's a new, tiny handheld game system<br/>
            with a bunch of brand-new games.
          </h1>
        </div>
      </main>
    </div>
  );
}

export default App;
