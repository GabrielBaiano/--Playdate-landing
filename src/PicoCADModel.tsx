import { useState, useEffect, useRef, useMemo } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function parsePicoCAD(text: string) {
    const geometries: THREE.BufferGeometry[] = [];
    const objBlocks = text.split("name=");
    for (let i = 1; i < objBlocks.length; i++) {
        const block = objBlocks[i];
        
        const posMatch = block.match(/pos={([^}]+)}/);
        const rotMatch = block.match(/rot={([^}]+)}/);
        const pos = posMatch ? posMatch[1].split(',').map(Number) : [0,0,0];
        const rot = rotMatch ? rotMatch[1].split(',').map(Number) : [0,0,0];
        
        const vBlockStart = block.indexOf('v={') + 3;
        const vBlockEnd = block.indexOf('f={', vBlockStart);
        if (vBlockStart < 3 || vBlockEnd === -1) continue;
        const vBlock = block.substring(vBlockStart, vBlockEnd);
        
        const vertices: number[][] = [];
        const vRegex = /{(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+)}/g;
        let vM;
        while ((vM = vRegex.exec(vBlock)) !== null) {
            vertices.push([parseFloat(vM[1]), -parseFloat(vM[2]), -parseFloat(vM[3])]);
        }
        
        const fBlockStart = block.indexOf('f={') + 3;
        const fBlock = block.substring(fBlockStart);
        
        const positions: number[] = [];
        const uvs: number[] = [];
        
        const lines = fBlock.split('\n');
        for (const line of lines) {
            if (!line.includes('c=')) continue;
            
            const indicesMatch = line.match(/{([\d,\s]+)c=/);
            if (!indicesMatch) continue;
            const indices = indicesMatch[1].split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
            
            const uvMatch = line.match(/uv={([^}]+)}/);
            const uvVals = uvMatch ? uvMatch[1].split(',').map(Number) : [0,0,0,0,0,0,0,0];
            
            if (indices.length >= 4) {
                const i1 = indices[0]-1, i2 = indices[1]-1, i3 = indices[2]-1, i4 = indices[3]-1;
                
                positions.push(...vertices[i1], ...vertices[i2], ...vertices[i3]);
                uvs.push(
                    uvVals[0]/16, 1.0 - uvVals[1]/16,
                    uvVals[2]/16, 1.0 - uvVals[3]/16,
                    uvVals[4]/16, 1.0 - uvVals[5]/16
                );
                
                positions.push(...vertices[i1], ...vertices[i3], ...vertices[i4]);
                uvs.push(
                    uvVals[0]/16, 1.0 - uvVals[1]/16,
                    uvVals[4]/16, 1.0 - uvVals[5]/16,
                    uvVals[6]/16, 1.0 - uvVals[7]/16
                );
            } else if (indices.length === 3) {
                const i1 = indices[0]-1, i2 = indices[1]-1, i3 = indices[2]-1;
                positions.push(...vertices[i1], ...vertices[i2], ...vertices[i3]);
                uvs.push(
                    uvVals[0]/16, 1.0 - uvVals[1]/16,
                    uvVals[2]/16, 1.0 - uvVals[3]/16,
                    uvVals[4]/16, 1.0 - uvVals[5]/16
                );
            }
        }
        
        if (positions.length === 0) continue;
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        
        geometry.computeVertexNormals();
        
        const euler = new THREE.Euler(rot[0] * Math.PI / 180, -rot[1] * Math.PI / 180, -rot[2] * Math.PI / 180); 
        const quaternion = new THREE.Quaternion().setFromEuler(euler);
        geometry.applyQuaternion(quaternion);
        geometry.translate(pos[0], -pos[1], -pos[2]); 
        
        geometries.push(geometry);
    }
    
    return geometries;
}

const vertexShader = `
uniform float time;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec4 glPos = projectionMatrix * mvPosition;
    
    float resolution = 160.0;
    glPos.xyz = glPos.xyz / glPos.w;
    glPos.x = floor(glPos.x * resolution) / resolution;
    glPos.y = floor(glPos.y * resolution) / resolution;
    glPos.xyz *= glPos.w;
    
    gl_Position = glPos;
}
`;

const fragmentShader = `
uniform sampler2D map;
uniform sampler2D videoMap;
uniform vec4 screenBounds;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
    vec4 texColor = texture2D(map, vUv);
    if (texColor.a < 0.1) discard;
    
    // Replace screen pixels with video (commented out for now)
    /*
    if (vUv.x >= screenBounds.x && vUv.x <= screenBounds.z && 
        vUv.y >= screenBounds.y && vUv.y <= screenBounds.w) {
        
        vec2 vidUv = vec2(
            (vUv.x - screenBounds.x) / (screenBounds.z - screenBounds.x),
            (vUv.y - screenBounds.y) / (screenBounds.w - screenBounds.y)
        );
        
        vec4 vidColor = texture2D(videoMap, vidUv);
        texColor = vidColor;
    }
    */
    
    vec3 normal = vNormal;
    if (!gl_FrontFacing) normal = -normal;
    
    vec3 lightDir = normalize(vec3(-0.5, 0.5, 1.0));
    float ndotl = dot(normal, lightDir);
    
    float checker = mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0);
    
    float shadow = 1.0;
    if (ndotl < 0.1) {
        shadow = 0.65;
    } else if (ndotl < 0.5) {
        shadow = checker > 0.5 ? 1.0 : 0.65;
    }
    
    gl_FragColor = vec4(texColor.rgb * shadow, 1.0);
}
`;

export default function PicoCADModel({ url, textureUrl, scale = 1, ...props }: any) {
    const [geometries, setGeometries] = useState<THREE.BufferGeometry[]>([]);
    const groupRef = useRef<THREE.Group>(null);
    const texture = useLoader(THREE.TextureLoader, textureUrl);
    
    // Create video element
    const [video] = useState(() => {
        const vid = document.createElement("video");
        vid.src = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
        vid.crossOrigin = "Anonymous";
        vid.loop = true;
        vid.muted = true;
        vid.play().catch(e => console.error("Video play failed", e));
        return vid;
    });
    
    // Create video texture
    const videoTexture = useMemo(() => {
        const tex = new THREE.VideoTexture(video);
        tex.minFilter = THREE.NearestFilter;
        tex.magFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }, [video]);
    
    useEffect(() => {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        
        // Setup initial intro spin
        if (groupRef.current) {
            groupRef.current.rotation.y = -Math.PI / 2 + Math.PI * 6; // 3 full spins starting from target
            groupRef.current.rotation.x = 0;
            groupRef.current.scale.set(0.001, 0.001, 0.001); // Start tiny for Mario 64 zoom
        }
        
        fetch(url)
            .then(res => res.text())
            .then(text => {
                setGeometries(parsePicoCAD(text));
            });
    }, [url, texture]);

    useFrame((state, delta) => {
        if (groupRef.current) {
            const t = state.clock.elapsedTime;
            const scrollY = window.scrollY;
            const vh = window.innerHeight;
            
            // Gyroscopic wobble effect
            const wobbleY = Math.sin(t * 1.4) * 0.30;
            const wobbleX = Math.cos(t * 1.1) * 0.20;
            const wobbleZ = Math.sin(t * 1.7) * 0.10;
            
            // Scroll Animation Logic
            let progress = 0;
            if (scrollY > vh * 0.4) {
                progress = Math.min(1, (scrollY - vh * 0.4) / (vh * 0.6));
            }
            
            // Smooth ease-out cubic curve
            const ease = 1 - Math.pow(1 - progress, 3);
            
            // Position targets: bottom left (less extreme)
            const targetX = -17 * ease; // more to the left
            const targetY = -3.5 + (0.5 * ease); // higher up (ends up at -3.0)
            
            groupRef.current.position.x = THREE.MathUtils.damp(groupRef.current.position.x, targetX, 4.0, delta);
            groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, targetY, 4.0, delta);
            
            // Rotation targets: idle pose showing bottom and crank
            const targetRotY = -Math.PI / 2 + wobbleY + (ease * Math.PI / 6); // slightly less rotation
            const targetRotX = wobbleX - (ease * Math.PI / 12); // less backwards tilt
            const targetRotZ = wobbleZ - (ease * Math.PI / 32); // much less Z tilt
            
            groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetRotY, 3.5, delta);
            groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, targetRotX, 3.5, delta);
            groupRef.current.rotation.z = THREE.MathUtils.damp(groupRef.current.rotation.z, targetRotZ, 3.5, delta);
            
            // Scale target: gets smaller
            const targetScale = scale * (1 - 0.45 * ease); // 45% smaller
            const currentScale = groupRef.current.scale.x;
            const newScale = THREE.MathUtils.damp(currentScale, targetScale, 3.5, delta);
            groupRef.current.scale.set(newScale, newScale, newScale);
        }
    });

    const material = useMemo(() => new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            time: { value: 0 },
            map: { value: texture },
            videoMap: { value: videoTexture },
            // Estimating the screen UV bounds on the atlas. You can tweak these!
            // x: minU, y: minV, z: maxU, w: maxV
            screenBounds: { value: new THREE.Vector4(0.05, 0.65, 0.45, 0.90) }
        },
        side: THREE.DoubleSide
    }), [texture, videoTexture]);

    return (
        <group ref={groupRef} {...props}>
            {geometries.map((geo, i) => (
                <mesh key={i} geometry={geo} material={material} />
            ))}
        </group>
    );
}
