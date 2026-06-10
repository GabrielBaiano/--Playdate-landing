import fs from 'fs';

const text = fs.readFileSync('public/playdate.txt', 'utf8');
const objBlocks = text.split("name=");
const block = objBlocks[1];
const posMatch = block.match(/pos={([^}]+)}/);
const pos = posMatch ? posMatch[1].split(',').map(Number) : [0, 0, 0];

const vBlockStart = block.indexOf('v={') + 3;
const vBlockEnd = block.indexOf('f={', vBlockStart);
const vBlock = block.substring(vBlockStart, vBlockEnd);

const vertices = [];
const vRegex = /{(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+)}/g;
let vM;
while ((vM = vRegex.exec(vBlock)) !== null) {
    vertices.push([
        parseFloat(vM[1]) + pos[0],
        -parseFloat(vM[2]) - pos[1],
        -parseFloat(vM[3]) - pos[2]
    ]);
}

const fBlockStart = block.indexOf('f={') + 3;
const fBlock = block.substring(fBlockStart);
const lines = fBlock.split('\n');

let count = 0;
for (const line of lines) {
    if (!line.includes('c=')) continue;
    if (count === 2) { // Face 2 is the 3rd face (index 2)
        const indicesMatch = line.match(/{([\d,\s]+)c=/);
        const indices = indicesMatch[1].split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        console.log(`Face 2 line: ${line.trim()}`);
        console.log("Vertices:");
        for (const idx of indices) {
            console.log(`  Index ${idx}: [${vertices[idx - 1].join(', ')}]`);
        }
        break;
    }
    count++;
}
