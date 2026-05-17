import { useState, useEffect, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
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
            // PicoCAD space -> Three space
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
        
        // Convert rot to radians (PicoCAD is usually degrees)
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
    // Apply normalMatrix to transform normals correctly into view space
    vNormal = normalize(normalMatrix * normal);
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec4 glPos = projectionMatrix * mvPosition;
    
    // PS1 vertex jitter
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
varying vec2 vUv;
varying vec3 vNormal;

void main() {
    vec4 texColor = texture2D(map, vUv);
    if (texColor.a < 0.1) discard; // Alpha cutout
    
    // PicoCAD-style directional lighting with pixel dithering
    // Since vNormal is in view space, vec3(0.0, 0.0, 1.0) points straight out from the camera
    vec3 lightDir = vec3(0.0, 0.0, 1.0);
    float ndotl = dot(vNormal, lightDir);
    
    // Calculate 2x2 dither checkerboard pattern using screen pixel coordinates
    float checker = mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0);
    
    float shadow = 1.0;
    // Hard shadow logic + pixelated dither transition
    if (ndotl < 0.3) {
        shadow = 0.65; // Solid shadow
    } else if (ndotl < 0.7) {
        shadow = checker > 0.5 ? 1.0 : 0.65; // Dithered transition shadow
    }
    
    gl_FragColor = vec4(texColor.rgb * shadow, 1.0);
}
`;

export default function PicoCADModel({ url, textureUrl, scale = 1, ...props }: any) {
    const [geometries, setGeometries] = useState<THREE.BufferGeometry[]>([]);
    const groupRef = useRef<THREE.Group>(null);
    const texture = useLoader(THREE.TextureLoader, textureUrl);
    
    useEffect(() => {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        
        fetch(url)
            .then(res => res.text())
            .then(text => {
                setGeometries(parsePicoCAD(text));
            });
    }, [url, texture]);

    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            time: { value: 0 },
            map: { value: texture }
        },
        side: THREE.DoubleSide
    });

    return (
        <group ref={groupRef} {...props} scale={[scale, scale, scale]}>
            {geometries.map((geo, i) => (
                <mesh key={i} geometry={geo} material={material} />
            ))}
        </group>
    );
}
