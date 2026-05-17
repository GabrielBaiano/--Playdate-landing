import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import PicoCADModel from './PicoCADModel';

function App() {
  return (
    <div className="app-container">
      <nav className="nav-bar">
        <div className="logo">RETRO WORLD EXPO // 26</div>
        <div className="nav-links">
          <a href="#about">ABOUT</a>
          <a href="#schedule">SCHEDULE</a>
          <a href="#exhibitors">EXHIBITORS</a>
        </div>
      </nav>

      <main className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="text-offset-1">PLAYDATE</span>
            <br />
            <span className="text-offset-2">SHOWCASE</span>
          </h1>
          <p className="hero-subtitle">
            Experience the latest and greatest in indie handheld gaming. 
            Join us for an exclusive look at upcoming Playdate titles, hardware mods, and developer panels.
          </p>
          <div className="action-buttons">
            <button className="btn-primary">GET TICKETS</button>
            <button className="btn-secondary">VIEW SCHEDULE</button>
          </div>
        </div>

        <div className="hero-3d">
          <div className="canvas-container">
            <Canvas camera={{ position: [0, 0, 25], fov: 45 }}>
              <color attach="background" args={['#0f172a']} />
              <ambientLight intensity={0.5} />
              <pointLight position={[10, 10, 10]} intensity={1} />
              <PicoCADModel url="/playdate.txt" textureUrl="/playdate.png" scale={1.5} position={[0, -2, 0]} />
              <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} />
            </Canvas>
          </div>
          <div className="model-caption">
            &gt; INTERACTIVE 3D MODEL // RENDERED IN PICO-CAD FORMAT
          </div>
        </div>
      </main>
      
      <div className="grid-overlay"></div>
    </div>
  );
}

export default App;
