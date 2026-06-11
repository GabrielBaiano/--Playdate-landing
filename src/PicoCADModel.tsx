import { useState, useEffect, useRef, useMemo } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

export interface PicoCADPart {
    geometry: THREE.BufferGeometry;
    pos: [number, number, number];
    rot: [number, number, number];
}

export function parsePicoCAD(text: string): PicoCADPart[] {
    const parts: PicoCADPart[] = [];
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

        // Translate the vertices to their absolute positions
        geometry.translate(pos[0], -pos[1], -pos[2]);

        parts.push({
            geometry,
            pos: [pos[0], -pos[1], -pos[2]],
            rot: [rot[0], rot[1], rot[2]]
        });
    }

    return parts;
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
    
    bool isScreen = false;
    // Replace screen pixels with canvas face texture
    if (vUv.x >= screenBounds.x && vUv.x <= screenBounds.z && 
        vUv.y >= screenBounds.y && vUv.y <= screenBounds.w) {
        
        isScreen = true;
        vec2 vidUv = vec2(
            (vUv.x - screenBounds.x) / (screenBounds.z - screenBounds.x),
            (vUv.y - screenBounds.y) / (screenBounds.w - screenBounds.y)
        );
        
        vec4 vidColor = texture2D(videoMap, vidUv);
        texColor = vidColor;
    }
    
    // Calculate simple flat lighting based on normals
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n; // Fix inverted picoCAD normals!
    
    vec3 lightDir = normalize(vec3(-0.2, 0.8, 1.0)); // Light from top, slightly left
    float ndotl = max(0.0, dot(n, lightDir));
    
    // Create a stepped shadow multiplier (retro flat shading style)
    float shadowMult = 1.0;
    if (ndotl < 0.25) {
        shadowMult = 0.65; // Dark shadow
    } else if (ndotl < 0.65) {
        shadowMult = 0.85; // Mid tone
    }
    
    if (isScreen) shadowMult = 1.0; // The screen emits its own light!
    
    gl_FragColor = vec4(texColor.rgb * shadowMult, 1.0);
}
`;

const drawFace = (ctx: CanvasRenderingContext2D, faceType: 'surprised' | 'happy' | 'normal' | 'ohno' | 'dead' | 'angry' | 'relieved', time: number) => {
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

    } else if (faceType === 'dead') {
        // X X eyes
        ctx.lineWidth = 14;
        ctx.beginPath();
        // Left X
        ctx.moveTo(110, 100); ctx.lineTo(150, 140);
        ctx.moveTo(150, 100); ctx.lineTo(110, 140);
        // Right X
        ctx.moveTo(250, 100); ctx.lineTo(290, 140);
        ctx.moveTo(290, 100); ctx.lineTo(250, 140);
        ctx.stroke();

        // Dead straight mouth
        ctx.beginPath();
        ctx.moveTo(170, 180);
        ctx.lineTo(230, 180);
        ctx.stroke();

    } else if (faceType === 'normal') {
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

        // Friendly smile curve (no nose!)
        ctx.strokeStyle = "#1b1f1a";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(200, 155, 15, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();

    } else if (faceType === 'angry') {
        // Angry angled eyebrows (V shape, very aggressive!)
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#1b1f1a';
        ctx.beginPath();
        ctx.moveTo(85, 80); ctx.lineTo(160, 105); // Left eyebrow \
        ctx.moveTo(315, 80); ctx.lineTo(240, 105);  // Right eyebrow /
        ctx.stroke();

        // Frown lines between eyes (||)
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(188, 92); ctx.lineTo(188, 112);
        ctx.moveTo(212, 92); ctx.lineTo(212, 112);
        ctx.stroke();

        // Sharp triangular angry eyes (thick black border, screen-colored inside)
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#1b1f1a';
        ctx.fillStyle = '#b5c2a3';

        // Left eye
        ctx.beginPath();
        ctx.moveTo(95, 100);
        ctx.lineTo(155, 135);
        ctx.lineTo(165, 105);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Right eye
        ctx.beginPath();
        ctx.moveTo(305, 100);
        ctx.lineTo(245, 135);
        ctx.lineTo(235, 105);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Big wavy angry screaming mouth
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#1b1f1a';
        ctx.fillStyle = '#1b1f1a'; // Deep screaming open void
        ctx.beginPath();
        ctx.moveTo(130, 160);
        ctx.quadraticCurveTo(165, 140, 200, 165); // Top-left hump
        ctx.quadraticCurveTo(235, 140, 270, 160); // Top-right hump
        ctx.quadraticCurveTo(275, 205, 255, 215); // Right corner to bottom
        ctx.quadraticCurveTo(200, 225, 145, 215); // Bottom center curve
        ctx.quadraticCurveTo(125, 205, 130, 160); // Left corner back to top
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Anime vein pop symbol (💢) in the upper right forehead corner
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#1b1f1a';
        ctx.lineCap = 'round';

        const vx = 345;
        const vy = 55;
        const size = 15;

        // Top-left curve of vein
        ctx.beginPath();
        ctx.arc(vx - size, vy - size, size, 0, Math.PI / 2, false);
        ctx.stroke();

        // Top-right curve of vein
        ctx.beginPath();
        ctx.arc(vx + size, vy - size, size, Math.PI / 2, Math.PI, false);
        ctx.stroke();

        // Bottom-left curve of vein
        ctx.beginPath();
        ctx.arc(vx - size, vy + size, size, 1.5 * Math.PI, 0, false);
        ctx.stroke();

        // Bottom-right curve of vein
        ctx.beginPath();
        ctx.arc(vx + size, vy + size, size, Math.PI, 1.5 * Math.PI, false);
        ctx.stroke();

    } else if (faceType === 'relieved') {
        // Relieved eyes (closed, happy curves ^^)
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#1b1f1a';
        ctx.beginPath();
        ctx.arc(130, 120, 20, Math.PI + 0.5, Math.PI * 2 - 0.5, false);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(270, 120, 20, Math.PI + 0.5, Math.PI * 2 - 0.5, false);
        ctx.stroke();

        // Small relieved smile
        ctx.beginPath();
        ctx.arc(200, 160, 15, 0.2 * Math.PI, 0.8 * Math.PI, false);
        ctx.stroke();

        // Sweat drop of relief
        const sweatY = 70;
        ctx.fillStyle = '#b5c2a3';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(320, sweatY + 12, 8, 0.15 * Math.PI, 0.85 * Math.PI, false);
        ctx.lineTo(320, sweatY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();



    } else if (faceType === 'ohno') {
        // Wide scared O eyes
        ctx.fillStyle = '#1b1f1a';
        ctx.beginPath();
        ctx.arc(130, 120, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b5c2a3';
        ctx.beginPath();
        ctx.arc(120, 110, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1b1f1a';
        ctx.beginPath();
        ctx.arc(270, 120, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b5c2a3';
        ctx.beginPath();
        ctx.arc(260, 110, 8, 0, Math.PI * 2);
        ctx.fill();

        // Open O mouth (wide open shock!)
        ctx.fillStyle = '#1b1f1a';
        ctx.beginPath();
        ctx.arc(200, 185, 18, 0, Math.PI * 2);
        ctx.fill();

        // Beautiful 1-bit screen-authentic cartoon sweat drop (sharp outline, matching screen-color fill)
        const sweatY = 60;
        ctx.strokeStyle = '#1b1f1a';
        ctx.fillStyle = '#b5c2a3';
        ctx.lineWidth = 6;

        ctx.beginPath();
        ctx.arc(345, sweatY + 12, 10, 0.15 * Math.PI, 0.85 * Math.PI, false); // rounded bottom
        ctx.lineTo(345, sweatY); // sharp tip pointing up
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
};

const drawStatic = (ctx: CanvasRenderingContext2D, time: number) => {
    const width = 400;
    const height = 240;

    // Multi-stage CRT distortion & flickering
    const seed = Math.floor(time * 60); // 60fps seed
    const flickerVal = Math.sin(time * 75);

    if (flickerVal > 0.88) {
        // Black screen (sync loss)
        ctx.fillStyle = "#1b1f1a";
        ctx.fillRect(0, 0, width, height);
        return;
    } else if (flickerVal < -0.94) {
        // Bright flash
        ctx.fillStyle = "#b5c2a3";
        ctx.fillRect(0, 0, width, height);
        return;
    }

    // Draw 1-bit retro static noise
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        const isDark = Math.random() < 0.5;
        data[i] = isDark ? 27 : 181;     // R
        data[i + 1] = isDark ? 31 : 194; // G
        data[i + 2] = isDark ? 26 : 163; // B
        data[i + 3] = 255;               // A
    }
    ctx.putImageData(imgData, 0, 0);

    // Glitch horizontal bands
    ctx.strokeStyle = "#1b1f1a";
    ctx.fillStyle = "#1b1f1a";

    // Large static bar rolling down
    const barY = Math.floor((time * 180) % (height + 40)) - 20;
    if (barY >= 0 && barY < height) {
        ctx.fillRect(0, barY, width, 16);
    }

    // Tiny flickering horizontal lines
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
        const y = Math.floor(((seed * (i + 13)) % 100) / 100 * height);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
};

function splitGeometryByX3(geom: THREE.BufferGeometry) {
    geom.computeBoundingBox();
    const box = geom.boundingBox!;
    // Front cover (screen side)
    const splitFront = box.max.x - (box.max.x - box.min.x) * 0.15;
    // Back cover (playdate logo side)
    const splitBack = box.min.x + (box.max.x - box.min.x) * 0.15;

    const pos = geom.attributes.position.array as Float32Array;
    const uv = geom.attributes.uv.array as Float32Array;
    const norm = geom.attributes.normal ? (geom.attributes.normal.array as Float32Array) : null;

    const frontPos = [], frontUv = [], frontNorm = [];
    const midPos = [], midUv = [], midNorm = [];
    const backPos = [], backUv = [], backNorm = [];

    for (let i = 0; i < pos.length; i += 9) {
        const x = (pos[i] + pos[i + 3] + pos[i + 6]) / 3;

        if (x > splitFront) {
            frontPos.push(pos[i], pos[i + 1], pos[i + 2], pos[i + 3], pos[i + 4], pos[i + 5], pos[i + 6], pos[i + 7], pos[i + 8]);
            frontUv.push(uv[(i / 3) * 2], uv[(i / 3) * 2 + 1], uv[(i / 3) * 2 + 2], uv[(i / 3) * 2 + 3], uv[(i / 3) * 2 + 4], uv[(i / 3) * 2 + 5]);
            if (norm) frontNorm.push(norm[i], norm[i + 1], norm[i + 2], norm[i + 3], norm[i + 4], norm[i + 5], norm[i + 6], norm[i + 7], norm[i + 8]);
        } else if (x < splitBack) {
            backPos.push(pos[i], pos[i + 1], pos[i + 2], pos[i + 3], pos[i + 4], pos[i + 5], pos[i + 6], pos[i + 7], pos[i + 8]);
            backUv.push(uv[(i / 3) * 2], uv[(i / 3) * 2 + 1], uv[(i / 3) * 2 + 2], uv[(i / 3) * 2 + 3], uv[(i / 3) * 2 + 4], uv[(i / 3) * 2 + 5]);
            if (norm) backNorm.push(norm[i], norm[i + 1], norm[i + 2], norm[i + 3], norm[i + 4], norm[i + 5], norm[i + 6], norm[i + 7], norm[i + 8]);
        } else {
            midPos.push(pos[i], pos[i + 1], pos[i + 2], pos[i + 3], pos[i + 4], pos[i + 5], pos[i + 6], pos[i + 7], pos[i + 8]);
            midUv.push(uv[(i / 3) * 2], uv[(i / 3) * 2 + 1], uv[(i / 3) * 2 + 2], uv[(i / 3) * 2 + 3], uv[(i / 3) * 2 + 4], uv[(i / 3) * 2 + 5]);
            if (norm) midNorm.push(norm[i], norm[i + 1], norm[i + 2], norm[i + 3], norm[i + 4], norm[i + 5], norm[i + 6], norm[i + 7], norm[i + 8]);
        }
    }

    const createGeom = (p: number[], u: number[], n: number[]) => {
        const g = new THREE.BufferGeometry();
        if (p.length > 0) {
            g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
            if (norm) g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
        }
        return g;
    };

    return {
        front: createGeom(frontPos, frontUv, frontNorm),
        mid: createGeom(midPos, midUv, midNorm),
        back: createGeom(backPos, backUv, backNorm)
    };
}

export default function PicoCADModel({
    url,
    textureUrl,
    scale = 1,
    children,
    stage = "hero",
    specStage = 0,
    showArrows = false,
    ...props
}: any) {
    const [parts, setParts] = useState<PicoCADPart[]>([]);
    const groupRef = useRef<THREE.Group>(null);
    const rotationGroupRef = useRef<THREE.Group>(null);
    const crankGroupRef = useRef<THREE.Group>(null);
    const frontRef = useRef<THREE.Group>(null);
    const midRef = useRef<THREE.Group>(null);
    const backRef = useRef<THREE.Group>(null);
    const internalsRef = useRef<THREE.Group>(null);
    const markerBatteryRef = useRef<THREE.Group>(null);
    const markerWirelessRef = useRef<THREE.Group>(null);
    const texture = useLoader(THREE.TextureLoader, textureUrl);
    const prevRotY = useRef(0);
    const crankRotRef = useRef(0);
    const prevScrollY = useRef(0);

    const [showStatic, setShowStatic] = useState(false);
    const [showVideo, setShowVideo] = useState(false);

    useEffect(() => {
        if (stage === 'orange') {
            setShowStatic(true);
            setShowVideo(false);
            const timer = setTimeout(() => {
                setShowStatic(false);
                setShowVideo(true);
            }, 800); // 800ms transition
            return () => clearTimeout(timer);
        } else {
            setShowStatic(false);
            setShowVideo(false);
        }
    }, [stage]);

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

    const { front, mid, back } = useMemo(() => {
        if (parts.length < 3) return { front: null, mid: null, back: null };
        return splitGeometryByX3(parts[0].geometry);
    }, [parts]);

    const internals = useMemo(() => {
        const inst = new THREE.Group();

        // --- STRUCTURED INTERNALS (PCB, Battery, Chips) ---
        const pcbMat = new THREE.MeshBasicMaterial({ color: 0x1b4428 }); // Dark green PCB
        const chipMat = new THREE.MeshBasicMaterial({ color: 0x111111 }); // Black chips
        const batteryMat = new THREE.MeshBasicMaterial({ color: 0x999999 }); // Silver battery
        const portMat = new THREE.MeshBasicMaterial({ color: 0x777777 }); // Silver USB-C
        const goldMat = new THREE.MeshBasicMaterial({ color: 0xd4af37 }); // Gold contacts

        // Grouping items so they can slide independently!
        const pcbGroup = new THREE.Group();
        pcbGroup.userData.baseX = -2.0;
        pcbGroup.userData.targetX = -4.5; // Entre o meio e a tampa traseira, totalmente desprendido
        pcbGroup.position.set(-2.0, 0, 0);

        const batteryGroup = new THREE.Group();
        batteryGroup.userData.baseX = -2.0;
        batteryGroup.userData.targetX = -6.5; // Logo atrás da placa verde
        batteryGroup.position.set(-2.0, 0, 0);

        const screwGroup = new THREE.Group();
        screwGroup.userData.baseX = -2.0;
        screwGroup.userData.targetX = -12.0; // Fica a uma distância elegante (2 unidades) atrás da tampa amarela
        screwGroup.position.set(-2.0, 0, 0);

        // 1. Main Motherboard (T-shaped using two boxes)
        const boardTopGeom = new THREE.BoxGeometry(0.2, 6.0, 14.0);
        const boardTop = new THREE.Mesh(boardTopGeom, pcbMat);
        boardTop.position.set(0, 8.0, 2.28);
        pcbGroup.add(boardTop);

        const boardBotGeom = new THREE.BoxGeometry(0.2, 5.0, 8.0);
        const boardBot = new THREE.Mesh(boardBotGeom, pcbMat);
        boardBot.position.set(0, 2.5, 2.28);
        pcbGroup.add(boardBot);

        // 2. Battery Pack (Thick silver rectangle behind the PCB)
        const batteryGeom = new THREE.BoxGeometry(1.2, 6.0, 8.0);
        const battery = new THREE.Mesh(batteryGeom, batteryMat);
        battery.position.set(0, 8.0, 4.0);
        batteryGroup.add(battery);

        // Battery warning label (dark grey strip)
        const labelGeom = new THREE.BoxGeometry(1.25, 4.0, 6.0);
        const label = new THREE.Mesh(labelGeom, new THREE.MeshBasicMaterial({ color: 0x333333 }));
        label.position.set(0, 8.0, 4.0);
        batteryGroup.add(label);

        // 3. Processing Chips (Mounted on the FRONT of the PCB to sit between front cover and PCB)
        const chipGeom = new THREE.BoxGeometry(0.3, 1.0, 1.0);

        // Main CPU
        const cpu = new THREE.Mesh(chipGeom, chipMat);
        cpu.scale.set(1.0, 3.5, 3.5);
        cpu.position.set(0.3, 8.5, 2.28); // Positive X = sticking towards the front cover!
        pcbGroup.add(cpu);

        // RAM / Flash Memory
        const ram1 = new THREE.Mesh(chipGeom, chipMat);
        ram1.scale.set(1.0, 2.0, 2.5);
        ram1.position.set(0.3, 6.0, 4.5);
        pcbGroup.add(ram1);

        const ram2 = new THREE.Mesh(chipGeom, chipMat);
        ram2.scale.set(1.0, 2.0, 2.5);
        ram2.position.set(0.3, 6.0, 0.0);
        pcbGroup.add(ram2);

        // Small controller chip
        const ctrl = new THREE.Mesh(chipGeom, chipMat);
        ctrl.scale.set(1.0, 1.5, 1.5);
        ctrl.position.set(0.3, 2.5, 2.28);
        pcbGroup.add(ctrl);

        // 4. USB-C Port at the bottom of the PCB
        const portGeom = new THREE.BoxGeometry(0.5, 1.0, 2.5);
        const port = new THREE.Mesh(portGeom, portMat);
        port.position.set(0, -0.5, 2.28);
        pcbGroup.add(port);

        // 5. Gold Contact Pads
        const padGeom = new THREE.BoxGeometry(0.3, 0.4, 0.4);
        for (let i = 0; i < 4; i++) {
            const pad = new THREE.Mesh(padGeom, goldMat);
            pad.position.set(0.1, 10.0, 0.0 + i * 1.5);
            pcbGroup.add(pad);
        }

        // 6. 4 Screws in the corners
        const cylGeom = new THREE.CylinderGeometry(0.12, 0.12, 1.6, 6);
        const screwMat = new THREE.MeshBasicMaterial({ color: 0x999999 });
        const screwHeadGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 6);

        // Exact absolute corners derived from the model's true geometry!
        const screwPositions = [
            [11.4, 9.0],    // Top-Left (Y, Z)
            [11.4, -4.4],    // Top-Right
            [-1.4, 9.0],    // Bottom-Left
            [-1.4, -4.4]     // Bottom-Right
        ];

        screwPositions.forEach(pos => {
            // Screw body
            const mesh = new THREE.Mesh(cylGeom, screwMat);
            mesh.position.set(0, pos[0], pos[1]);
            mesh.rotation.z = Math.PI / 2; // Point along X axis
            screwGroup.add(mesh);

            // Screw head (at the furthest back end of the screw)
            const head = new THREE.Mesh(screwHeadGeom, screwMat);
            head.position.set(-0.8, pos[0], pos[1]);
            head.rotation.z = Math.PI / 2;
            screwGroup.add(head);
        });

        inst.add(pcbGroup);
        inst.add(batteryGroup);
        inst.add(screwGroup);

        return inst;
    }, []);

    useEffect(() => {
        const tex = Array.isArray(texture) ? texture[0] : texture;
        if (tex) {
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.colorSpace = THREE.SRGBColorSpace;
        }

        fetch(url)
            .then(res => res.text())
            .then(text => {
                setParts(parsePicoCAD(text));
            });
    }, [url, texture]);

    useEffect(() => {
        // Setup initial intro spin as soon as parts are loaded and rendered in the DOM
        if (parts.length >= 3 && rotationGroupRef.current && groupRef.current) {
            rotationGroupRef.current.rotation.y = -Math.PI / 2 + Math.PI * 6; // 3 full spins starting from target
            rotationGroupRef.current.rotation.x = 0;
            groupRef.current.scale.set(0.001, 0.001, 0.001); // Start tiny for Mario 64 zoom
        }

    }, [parts]);

    useFrame((state, delta) => {
        if (groupRef.current && rotationGroupRef.current) {
            const t = state.clock.elapsedTime;
            const scrollY = window.scrollY;
            const vh = window.innerHeight;

            // Dynamic Face / Rotation speed check (Defined globally inside useFrame to avoid ReferenceErrors!)
            const deltaRotY = Math.abs(rotationGroupRef.current.rotation.y - prevRotY.current);
            prevRotY.current = rotationGroupRef.current.rotation.y;
            const rotSpeed = deltaRotY / Math.max(0.001, delta);

            // Scroll Animation Logic
            // Stage 1: Bottom left corner
            let progress1 = 0;
            if (scrollY > vh * 0.4) {
                progress1 = Math.min(1, (scrollY - vh * 0.4) / (vh * 0.6));
            }
            const ease1 = 1 - Math.pow(1 - progress1, 3);

            // Entry smooth animation into spec stage 1 (driven by scroll, same as before)
            let progressSpecsEntry = 0;
            if (scrollY > vh * 1.0) {
                progressSpecsEntry = Math.min(1, (scrollY - vh * 1.0) / (vh * 1.0));
            }
            const easeSpecsEntry = 1 - Math.pow(1 - progressSpecsEntry, 3);

            // Stage 3: Giant center screen zoom (orange section)
            let progress2 = 0;
            if (scrollY > vh * 5.0) {
                progress2 = Math.min(1, (scrollY - vh * 5.0) / (vh * 1.0));
            }
            const ease2 = 1 - Math.pow(1 - progress2, 3);

            // Gyroscopic wobble effect — fades out as we enter specs
            let currentWobbleIntensity = 1.0;
            if (ease1 > 0) currentWobbleIntensity = 1 - (ease1 * 0.85);
            if (easeSpecsEntry > 0) currentWobbleIntensity = THREE.MathUtils.lerp(currentWobbleIntensity, 0.0, easeSpecsEntry);
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

            // Apply Stage 1 Blends (Catalog bottom-left)
            if (ease1 > 0) {
                const idleFloat = Math.sin(t * 2.5) * 0.25 * ease1;
                currentTargetX = -17 * ease1;
                currentTargetY = -3.5 + (0.5 * ease1) + idleFloat;
                currentTargetScale = scale * (1 - 0.45 * ease1);

                currentTargetRotY = -Math.PI / 2 + wobbleY + (ease1 * Math.PI / 6);
                currentTargetRotX = wobbleX - (ease1 * Math.PI / 12);
                currentTargetRotZ = wobbleZ - (ease1 * Math.PI / 16);
            }

            let currentTargetFrontX = 0;
            let currentTargetBackX = 0;
            let currentTargetInternalsSlide = 0;
            let targetFaceType: 'surprised' | 'happy' | 'normal' | 'ohno' | 'dead' | 'angry' | 'relieved' = 'normal';

            // Fully continuous, scroll-driven specs section targets!
            if (scrollY >= vh * 2.0) {
                if (scrollY < vh * 3.0) {
                    // Spec Slide 1: closed console, looking angled, showing ohno face
                    currentTargetX = 0;
                    currentTargetY = 0;
                    currentTargetScale = scale * 0.9;
                    currentTargetRotY = -Math.PI / 2 - Math.PI * 0.26;
                    currentTargetRotX = 0.20;
                    currentTargetRotZ = 0;

                    currentTargetFrontX = 0;
                    currentTargetBackX = 0;
                    currentTargetInternalsSlide = 0;
                    targetFaceType = 'ohno';
                } else if (scrollY < vh * 4.0) {
                    // Spec Slide 2: disassembling! Driven completely by scroll progress.
                    const progressExplode = Math.min(1, Math.max(0, (scrollY - vh * 3.0) / vh));

                    currentTargetX = -1.5 * progressExplode;
                    currentTargetY = 0;
                    currentTargetScale = scale * (0.9 - 0.10 * progressExplode);
                    currentTargetRotY = -Math.PI / 2 - Math.PI * 0.26;
                    currentTargetRotX = 0.20;
                    currentTargetRotZ = 0;

                    currentTargetFrontX = 6.0 * progressExplode;
                    currentTargetBackX = -8.0 * progressExplode;
                    currentTargetInternalsSlide = progressExplode;
                    targetFaceType = progressExplode > 0.5 ? 'dead' : 'ohno';
                } else if (scrollY < vh * 5.0) {
                    // Spec Slide 3: re-assembling, centering, facing camera, becoming angry!
                    const progressAssemble = Math.min(1, Math.max(0, (scrollY - vh * 4.0) / vh));

                    currentTargetX = -1.5 * (1 - progressAssemble);
                    currentTargetY = 0;
                    currentTargetScale = scale * (0.80 + 0.25 * progressAssemble);
                    currentTargetRotY = THREE.MathUtils.lerp(-Math.PI / 2 - Math.PI * 0.26, -Math.PI / 2, progressAssemble);
                    currentTargetRotX = THREE.MathUtils.lerp(0.20, 0, progressAssemble);
                    currentTargetRotZ = 0;

                    currentTargetFrontX = 6.0 * (1 - progressAssemble);
                    currentTargetBackX = -8.0 * (1 - progressAssemble);
                    currentTargetInternalsSlide = 1.0 * (1 - progressAssemble);
                    targetFaceType = progressAssemble > 0.5 ? 'normal' : 'dead';
                } else {
                    // End of spec slides, in the orange zone
                    currentTargetX = 0;
                    currentTargetY = 0;
                    currentTargetScale = scale * 1.05;
                    currentTargetRotY = -Math.PI / 2;
                    currentTargetRotX = 0;
                    currentTargetRotZ = 0;
                    currentTargetFrontX = 0;
                    currentTargetBackX = 0;
                    currentTargetInternalsSlide = 0;
                    targetFaceType = 'normal';
                }
            } else {
                // Catalog / White Section or Hero Section
                if (easeSpecsEntry > 0) {
                    currentTargetX = THREE.MathUtils.lerp(currentTargetX, 0, easeSpecsEntry);
                    currentTargetY = THREE.MathUtils.lerp(currentTargetY, 0, easeSpecsEntry);
                    currentTargetScale = THREE.MathUtils.lerp(currentTargetScale, scale * 0.9, easeSpecsEntry);
                    currentTargetRotY = THREE.MathUtils.lerp(currentTargetRotY, -Math.PI / 2 - Math.PI * 0.26, easeSpecsEntry);
                    currentTargetRotX = THREE.MathUtils.lerp(currentTargetRotX, 0.20, easeSpecsEntry);
                    currentTargetRotZ = THREE.MathUtils.lerp(currentTargetRotZ, 0.0, easeSpecsEntry);
                }

                targetFaceType = stage === 'hero' ? 'happy' : 'normal';

                // Keep surprised spin check
                // deltaRotY commented
                // rotSpeed commented
                if (rotSpeed > 0.8 && state.clock.elapsedTime < 2.5) {
                    targetFaceType = 'surprised';
                }
            }

            // Apply Stage 3 Blends (orange zoom — overrides everything)
            if (ease2 > 0) {
                currentTargetX = THREE.MathUtils.lerp(currentTargetX, 0, ease2);
                currentTargetY = THREE.MathUtils.lerp(currentTargetY, -16.0, ease2);
                currentTargetScale = THREE.MathUtils.lerp(currentTargetScale, scale * 2.3, ease2);

                currentTargetRotY = THREE.MathUtils.lerp(currentTargetRotY, -Math.PI / 2, ease2);
                currentTargetRotX = THREE.MathUtils.lerp(currentTargetRotX, 0, ease2);
                currentTargetRotZ = THREE.MathUtils.lerp(currentTargetRotZ, 0, ease2);

                currentTargetFrontX = THREE.MathUtils.lerp(currentTargetFrontX, 0, ease2);
                currentTargetBackX = THREE.MathUtils.lerp(currentTargetBackX, 0, ease2);
                currentTargetInternalsSlide = THREE.MathUtils.lerp(currentTargetInternalsSlide, 0, ease2);
                targetFaceType = 'normal';
            }

            // Apply final computed targets (Increased damping to 8.0+ for high snappiness)
            groupRef.current.position.x = THREE.MathUtils.damp(groupRef.current.position.x, currentTargetX, 8.0, delta);
            groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, currentTargetY, 8.0, delta);

            const currentScale = groupRef.current.scale.x;
            const newScale = THREE.MathUtils.damp(currentScale, currentTargetScale, 8.0, delta);
            groupRef.current.scale.set(newScale, newScale, newScale);

            rotationGroupRef.current.rotation.y = THREE.MathUtils.damp(rotationGroupRef.current.rotation.y, currentTargetRotY, 8.5, delta);
            rotationGroupRef.current.rotation.x = THREE.MathUtils.damp(rotationGroupRef.current.rotation.x, currentTargetRotX, 8.5, delta);
            rotationGroupRef.current.rotation.z = THREE.MathUtils.damp(rotationGroupRef.current.rotation.z, currentTargetRotZ, 8.5, delta);

            if (frontRef.current) {
                frontRef.current.position.x = THREE.MathUtils.damp(frontRef.current.position.x, currentTargetFrontX, 9.0, delta);
            }
            if (backRef.current) {
                backRef.current.position.x = THREE.MathUtils.damp(backRef.current.position.x, currentTargetBackX, 9.0, delta);
            }
            if (internalsRef.current) {
                internalsRef.current.scale.setScalar(1);

                const prevSlide = internalsRef.current.userData.slide || 0;
                const newSlide = THREE.MathUtils.damp(prevSlide, currentTargetInternalsSlide, 9.0, delta);
                internalsRef.current.userData.slide = newSlide;

                // Internals visible whenever we start to explode (Front cover starts to separate)
                internalsRef.current.visible = currentTargetFrontX > 0.1;
                if (currentTargetFrontX > 0.1) {
                    internalsRef.current.traverse(child => {
                        if (child.userData && child.userData.baseX !== undefined && child.userData.targetX !== undefined) {
                            child.position.x = THREE.MathUtils.lerp(child.userData.baseX, child.userData.targetX, newSlide);
                        }
                    });
                }
            }

            const pcbSlideX = THREE.MathUtils.lerp(-2.0, -4.5, internalsRef.current?.userData.slide || 0);
            const batterySlideX = THREE.MathUtils.lerp(-2.0, -6.5, internalsRef.current?.userData.slide || 0);

            if (markerBatteryRef.current) {
                markerBatteryRef.current.position.set(batterySlideX, 8.0, 4.0);
            }
            if (markerWirelessRef.current) {
                markerWirelessRef.current.position.set(pcbSlideX, 10.0, 1.5);
            }

            // Dynamic Face Logic or TV Static
            if (showStatic) {
                drawStatic(ctx, state.clock.elapsedTime);
            } else {
                drawFace(ctx, targetFaceType, state.clock.elapsedTime);
            }
            canvasTexture.needsUpdate = true;

            // Interactive Winding Crank Logic
            if (crankGroupRef.current) {
                // 1. Calculate scrolling speed in pixels per second
                const scrollDelta = Math.abs(scrollY - prevScrollY.current);
                prevScrollY.current = scrollY;
                const scrollSpeed = scrollDelta / Math.max(0.001, delta);

                // 2. Compute dynamic, blended speeds:
                // - Idle speed (almost still, 0.05 rad/s) when not scrolling and not in stage 2
                const idleSpeed = 0.05 * (1 - ease2);
                // - Scroll-driven speed (highly responsive, capped at 12.0 rad/s for high energy)
                const scrollSpeedContribution = Math.min(12.0, (scrollSpeed / 80.0) * 2.5);
                // - Initial intro spin speed (synchronizes crank with the fast entry Y-rotation)
                const introSpinContribution = Math.min(12.0, rotSpeed * 1.0);
                // - Continuous video-playback speed (smooth 5.0 rad/s) when zoomed in stage 2
                const playbackSpeed = ease2 * 5.0;

                // Total combined rotation speed
                let crankSpeed = idleSpeed + scrollSpeedContribution + introSpinContribution + playbackSpeed;

                // Stop crank from spinning when console is disassembled (stage 2)
                if (specStage === 2) {
                    crankSpeed = 0;
                    // Align to nearest multiple of 2*PI (vertical) to prevent wild rewind spins!
                    const nearestAlign = Math.round(crankRotRef.current / (2 * Math.PI)) * (2 * Math.PI);
                    crankRotRef.current = THREE.MathUtils.damp(crankRotRef.current, nearestAlign, 6.0, delta);
                } else {
                    crankRotRef.current += delta * crankSpeed;
                }

                crankGroupRef.current.rotation.z = crankRotRef.current; // Spin around the pivot Z-axis!
                crankGroupRef.current.rotation.x = 0;
                crankGroupRef.current.rotation.y = 0;
            }
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

    if (parts.length < 3) return null;

    const shaftPart = parts[1];
    const handlePart = parts[2];

    // The absolute world coordinates of the crank attachment hinge point on the side
    const pivotX = -0.45;
    const pivotY = 5.2;
    const pivotZ = -7.6;

    return (
        <group ref={groupRef} {...props}>
            <group ref={rotationGroupRef}>
                {/* Front Cover */}
                <group ref={frontRef}>
                    {front && <mesh geometry={front} material={material} />}
                    {showArrows && (
                        <>
                            <group position={[1.5, 0, -5]}><Html><div id="marker-size" /></Html></group>
                        </>
                    )}
                    {stage === 'orange' && showVideo && (
                        <Html transform position={[0.39, 8.015, 0.634]} rotation={[0, Math.PI / 2, 0]} scale={1.20}>
                            <div style={{ width: '356px', height: '240px', background: '#b5c2a3', overflow: 'hidden' }}>
                                <iframe
                                    width="356"
                                    height="240"
                                    src="https://www.youtube.com/embed/HdF3CnFvxg4?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=HdF3CnFvxg4"
                                    title="YouTube video player"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen>
                                </iframe>
                            </div>
                        </Html>
                    )}
                </group>

                {/* Mid Frame + Internals + Crank */}
                <group ref={midRef}>
                    {mid && <mesh geometry={mid} material={material} />}

                    {/* Exploding Internals (Chips, screws, cables) */}
                    <group ref={internalsRef} scale={0}>
                        <primitive object={internals} />
                    </group>

                    {showArrows && (
                        <>
                            <group ref={markerBatteryRef}><Html><div id="marker-battery" /></Html></group>
                            <group ref={markerWirelessRef}><Html><div id="marker-wireless" /></Html></group>
                        </>
                    )}

                    {/* Interactive Rotating Crank */}
                    <group ref={crankGroupRef} position={[pivotX, pivotY, pivotZ]}>
                        <mesh position={[-pivotX, -pivotY, -pivotZ]} geometry={shaftPart.geometry} material={material} />
                        <mesh position={[-pivotX, -pivotY, -pivotZ]} geometry={handlePart.geometry} material={material} />
                    </group>
                </group>

                {/* Back Cover */}
                <group ref={backRef}>
                    {back && <mesh geometry={back} material={material} />}
                    {showArrows && (
                        <group position={[-2.0, 4.0, 2.0]}><Html><div id="marker-cost" /></Html></group>
                    )}
                </group>
            </group>
            {children}
        </group>
    );
}
