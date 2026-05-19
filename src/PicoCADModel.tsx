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
        const pos = posMatch ? posMatch[1].split(',').map(Number) : [0, 0, 0];
        const rot = rotMatch ? rotMatch[1].split(',').map(Number) : [0, 0, 0];

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
            const uvVals = uvMatch ? uvMatch[1].split(',').map(Number) : [0, 0, 0, 0, 0, 0, 0, 0];

            if (indices.length >= 4) {
                const i1 = indices[0] - 1, i2 = indices[1] - 1, i3 = indices[2] - 1, i4 = indices[3] - 1;

                positions.push(...vertices[i1], ...vertices[i2], ...vertices[i3]);
                uvs.push(
                    uvVals[0] / 16, 1.0 - uvVals[1] / 16,
                    uvVals[2] / 16, 1.0 - uvVals[3] / 16,
                    uvVals[4] / 16, 1.0 - uvVals[5] / 16
                );

                positions.push(...vertices[i1], ...vertices[i3], ...vertices[i4]);
                uvs.push(
                    uvVals[0] / 16, 1.0 - uvVals[1] / 16,
                    uvVals[4] / 16, 1.0 - uvVals[5] / 16,
                    uvVals[6] / 16, 1.0 - uvVals[7] / 16
                );
            } else if (indices.length === 3) {
                const i1 = indices[0] - 1, i2 = indices[1] - 1, i3 = indices[2] - 1;
                positions.push(...vertices[i1], ...vertices[i2], ...vertices[i3]);
                uvs.push(
                    uvVals[0] / 16, 1.0 - uvVals[1] / 16,
                    uvVals[2] / 16, 1.0 - uvVals[3] / 16,
                    uvVals[4] / 16, 1.0 - uvVals[5] / 16
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
    
    // Replace screen pixels with canvas face texture
    if (vUv.x >= screenBounds.x && vUv.x <= screenBounds.z && 
        vUv.y >= screenBounds.y && vUv.y <= screenBounds.w) {
        
        vec2 vidUv = vec2(
            (vUv.x - screenBounds.x) / (screenBounds.z - screenBounds.x),
            (vUv.y - screenBounds.y) / (screenBounds.w - screenBounds.y)
        );
        
        vec4 vidColor = texture2D(videoMap, vidUv);
        texColor = vidColor;
    }
    
    // Set shader shadow multiplier to 1.0 to remove dithered shadows on 3D elements
    gl_FragColor = vec4(texColor.rgb, 1.0);
}
`;

const drawFace = (ctx: CanvasRenderingContext2D, faceType: 'surprised' | 'happy' | 'normal', time: number) => {
    // Fill background with Playdate classic screen color (retro green-grey LCD)
    ctx.fillStyle = "#b5c2a3"; // Classic Playdate retro LCD color!
    ctx.fillRect(0, 0, 400, 240);
    
    // Set line and fill styles
    ctx.strokeStyle = "#1b1f1a"; // Off-black classic ink
    ctx.fillStyle = "#1b1f1a";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    if (faceType === 'surprised') {
        // @ @ (Surprised spiral eyes!)
        // Left eye spiral
        ctx.beginPath();
        for (let i = 0; i < 30; i++) {
            const angle = 0.3 * i;
            const r = 2 + 1.2 * i;
            const x = 130 + r * Math.cos(angle + time * 6);
            const y = 120 + r * Math.sin(angle + time * 6);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        // Right eye spiral
        ctx.beginPath();
        for (let i = 0; i < 30; i++) {
            const angle = 0.3 * i;
            const r = 2 + 1.2 * i;
            const x = 270 + r * Math.cos(angle - time * 6);
            const y = 120 + r * Math.sin(angle - time * 6);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        // Small surprised open mouth (o)
        ctx.beginPath();
        ctx.arc(200, 185, 12, 0, Math.PI * 2);
        ctx.fill();
        
    } else if (faceType === 'happy') {
        // > < (Happy blinking chevron eyes!)
        // Left eye >
        ctx.beginPath();
        ctx.moveTo(110, 95);
        ctx.lineTo(150, 120);
        ctx.lineTo(110, 145);
        ctx.stroke();
        
        // Right eye <
        ctx.beginPath();
        ctx.moveTo(290, 95);
        ctx.lineTo(250, 120);
        ctx.lineTo(290, 145);
        ctx.stroke();
        
        // Cute happy open smile mouth (U)
        ctx.beginPath();
        ctx.arc(200, 160, 20, 0, Math.PI);
        ctx.stroke();
        
    } else {
        // Normal open eyes (nice friendly circles with white shine!)
        // Left eye circle
        ctx.beginPath();
        ctx.arc(130, 120, 22, 0, Math.PI * 2);
        ctx.fill();
        // Left eye shine
        ctx.fillStyle = "#b5c2a3";
        ctx.beginPath();
        ctx.arc(122, 112, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Right eye circle
        ctx.fillStyle = "#1b1f1a";
        ctx.beginPath();
        ctx.arc(270, 120, 22, 0, Math.PI * 2);
        ctx.fill();
        // Right eye shine
        ctx.fillStyle = "#b5c2a3";
        ctx.beginPath();
        ctx.arc(262, 112, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Friendly smile curve
        ctx.strokeStyle = "#1b1f1a";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(200, 155, 15, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
    }
};

export default function PicoCADModel({
    url,
    textureUrl,
    scale = 1,
    children,
    stage = "hero",
    ...props
}: any) {
    const [geometries, setGeometries] = useState<THREE.BufferGeometry[]>([]);
    const groupRef = useRef<THREE.Group>(null);
    const rotationGroupRef = useRef<THREE.Group>(null);
    const texture = useLoader(THREE.TextureLoader, textureUrl);
    const prevRotY = useRef(0);

    // Create offscreen canvas reactively
    const canvas = useMemo(() => {
        const c = document.createElement("canvas");
        c.width = 400;
        c.height = 240;
        return c;
    }, []);
    const ctx = useMemo(() => canvas.getContext("2d")!, [canvas]);

    // Create canvas texture
    const canvasTexture = useMemo(() => {
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.NearestFilter;
        tex.magFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }, [canvas]);

    useEffect(() => {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;

        // Setup initial intro spin
        if (rotationGroupRef.current && groupRef.current) {
            rotationGroupRef.current.rotation.y = -Math.PI / 2 + Math.PI * 6; // 3 full spins starting from target
            rotationGroupRef.current.rotation.x = 0;
            groupRef.current.scale.set(0.001, 0.001, 0.001); // Start tiny for Mario 64 zoom
        }

        fetch(url)
            .then(res => res.text())
            .then(text => {
                setGeometries(parsePicoCAD(text));
            });
    }, [url, texture]);

    useFrame((state, delta) => {
        if (groupRef.current && rotationGroupRef.current) {
            const t = state.clock.elapsedTime;
            const scrollY = window.scrollY;
            const vh = window.innerHeight;

            // Scroll Animation Logic
            // Stage 1: Bottom left corner
            let progress1 = 0;
            if (scrollY > vh * 0.4) {
                progress1 = Math.min(1, (scrollY - vh * 0.4) / (vh * 0.6));
            }
            const ease1 = 1 - Math.pow(1 - progress1, 3);

            // Stage 2: Giant center screen
            let progress2 = 0;
            if (scrollY > vh * 2.0) {
                progress2 = Math.min(1, (scrollY - vh * 2.0) / (vh * 1.0));
            }
            const ease2 = 1 - Math.pow(1 - progress2, 3);

            // Gyroscopic wobble effect
            let currentWobbleIntensity = 1.0;
            if (ease1 > 0) currentWobbleIntensity = 1 - (ease1 * 0.85);
            if (ease2 > 0) currentWobbleIntensity = THREE.MathUtils.lerp(currentWobbleIntensity, 0, ease2);

            const wobbleY = Math.sin(t * 1.4) * 0.30 * currentWobbleIntensity;
            const wobbleX = Math.cos(t * 1.1) * 0.20 * currentWobbleIntensity;
            const wobbleZ = Math.sin(t * 1.7) * 0.10 * currentWobbleIntensity;

            // Base Targets (Top of page)
            let currentTargetX = 0;
            let currentTargetY = -3.5;
            let currentTargetScale = scale;
            let currentTargetRotX = wobbleX;
            let currentTargetRotY = -Math.PI / 2 + wobbleY;
            let currentTargetRotZ = wobbleZ;

            // Apply Stage 1 Blends
            if (ease1 > 0) {
                const idleFloat = Math.sin(t * 2.5) * 0.25 * ease1;
                currentTargetX = -17 * ease1;
                currentTargetY = -3.5 + (0.5 * ease1) + idleFloat;
                currentTargetScale = scale * (1 - 0.45 * ease1);

                currentTargetRotY = -Math.PI / 2 + wobbleY + (ease1 * Math.PI / 6);
                currentTargetRotX = wobbleX - (ease1 * Math.PI / 12);
                currentTargetRotZ = wobbleZ - (ease1 * Math.PI / 16);
            }

            // Apply Stage 2 Blends (Overrides Stage 1)
            if (ease2 > 0) {
                currentTargetX = THREE.MathUtils.lerp(currentTargetX, 0, ease2);
                currentTargetY = THREE.MathUtils.lerp(currentTargetY, -16.0, ease2); // Lowered even further down
                currentTargetScale = THREE.MathUtils.lerp(currentTargetScale, scale * 2.3, ease2); // Shrunk to a reasonable giant size

                currentTargetRotY = THREE.MathUtils.lerp(currentTargetRotY, -Math.PI / 2, ease2); // Face perfectly forward
                currentTargetRotX = THREE.MathUtils.lerp(currentTargetRotX, 0, ease2);
                currentTargetRotZ = THREE.MathUtils.lerp(currentTargetRotZ, 0, ease2);
            }

            // Apply final computed targets
            groupRef.current.position.x = THREE.MathUtils.damp(groupRef.current.position.x, currentTargetX, 4.0, delta);
            groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, currentTargetY, 4.0, delta);

            const currentScale = groupRef.current.scale.x;
            const newScale = THREE.MathUtils.damp(currentScale, currentTargetScale, 3.5, delta);
            groupRef.current.scale.set(newScale, newScale, newScale);

            rotationGroupRef.current.rotation.y = THREE.MathUtils.damp(rotationGroupRef.current.rotation.y, currentTargetRotY, 3.5, delta);
            rotationGroupRef.current.rotation.x = THREE.MathUtils.damp(rotationGroupRef.current.rotation.x, currentTargetRotX, 3.5, delta);
            rotationGroupRef.current.rotation.z = THREE.MathUtils.damp(rotationGroupRef.current.rotation.z, currentTargetRotZ, 3.5, delta);

            // Dynamic Face Logic
            const deltaRotY = Math.abs(rotationGroupRef.current.rotation.y - prevRotY.current);
            prevRotY.current = rotationGroupRef.current.rotation.y;
            const rotSpeed = deltaRotY / Math.max(0.001, delta);

            let faceType: 'surprised' | 'happy' | 'normal' = 'normal';
            if (rotSpeed > 0.8 && state.clock.elapsedTime < 2.5) { // Dizzy spinning ONLY during initial intro spin
                faceType = 'surprised';
            } else if (stage === 'hero') { // Active friendly float stage
                faceType = 'happy';
            }

            drawFace(ctx, faceType, state.clock.elapsedTime);
            canvasTexture.needsUpdate = true;
        }
    });

    const material = useMemo(() => new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            time: { value: 0 },
            map: { value: texture },
            videoMap: { value: canvasTexture },
            // Estimating the screen UV bounds on the atlas. You can tweak these!
            // x: minU, y: minV, z: maxU, w: maxV
            screenBounds: { value: new THREE.Vector4(0.032, 0.758, 0.438, 0.969) }
        },
        side: THREE.DoubleSide
    }), [texture, canvasTexture]);

    return (
        <group ref={groupRef} {...props}>
            <group ref={rotationGroupRef}>
                {geometries.map((geo, i) => (
                    <mesh key={i} geometry={geo} material={material} />
                ))}
            </group>
            {children}
        </group>
    );
}
