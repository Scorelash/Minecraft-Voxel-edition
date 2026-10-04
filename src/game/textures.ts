import * as THREE from 'three';
import { BlockType } from './types';

// Helper to create a 16x16 canvas with pixel drawing
function createPixelCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

// Pseudo-random noise with seed
function pseudoNoise(x: number, y: number, seed: number = 1): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43758.5453) * 43758.5453;
  return n - Math.floor(n);
}

// Procedural texture generators
function genGrassTop(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  const baseGreens = ['#4c8529', '#55942d', '#5da531', '#477d26', '#64b234'];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const idx = Math.floor(pseudoNoise(x, y, 101) * baseGreens.length);
      ctx.fillStyle = baseGreens[idx];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function genGrassSide(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  const dirtBrowns = ['#866043', '#795438', '#6c4a31', '#5c3e29', '#966d4d'];
  const baseGreens = ['#4c8529', '#55942d', '#5da531', '#64b234'];

  // Fill dirt
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const idx = Math.floor(pseudoNoise(x, y, 202) * dirtBrowns.length);
      ctx.fillStyle = dirtBrowns[idx];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Grass top hanging down
  for (let x = 0; x < 16; x++) {
    const hang = 2 + Math.floor(pseudoNoise(x, 1, 303) * 3);
    for (let y = 0; y < hang; y++) {
      const idx = Math.floor(pseudoNoise(x, y, 404) * baseGreens.length);
      ctx.fillStyle = baseGreens[idx];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function genDirt(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  const dirtBrowns = ['#866043', '#795438', '#6c4a31', '#5c3e29', '#966d4d', '#543924'];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const idx = Math.floor(pseudoNoise(x, y, 505) * dirtBrowns.length);
      ctx.fillStyle = dirtBrowns[idx];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function genStone(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  const stoneGrays = ['#757575', '#6b6b6b', '#616161', '#808080', '#595959', '#8a8a8a'];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const idx = Math.floor(pseudoNoise(x, y, 606) * stoneGrays.length);
      ctx.fillStyle = stoneGrays[idx];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function genCobblestone(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  const light = '#7d7d7d';
  const mid = '#636363';
  const dark = '#3b3b3b';
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const val = pseudoNoise(x, y, 707);
      if (val < 0.25) ctx.fillStyle = dark;
      else if (val < 0.6) ctx.fillStyle = mid;
      else ctx.fillStyle = light;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Cobble cracks
  ctx.fillStyle = '#2c2c2c';
  for (let i = 0; i < 16; i += 4) {
    ctx.fillRect(i, (i * 3) % 16, 2, 1);
    ctx.fillRect((i * 5) % 16, i, 1, 2);
  }
  return canvas;
}

function genWoodSide(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  const barks = ['#675135', '#57432b', '#483722', '#725a3d', '#3d2e1b'];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      // vertical bark grain
      const grain = Math.floor(pseudoNoise(Math.floor(x / 2), y, 808) * barks.length);
      ctx.fillStyle = barks[grain];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function genWoodTop(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  const rings = ['#a28254', '#b3915f', '#876941', '#6f5533'];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5;
      const dy = y - 7.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 7) {
        ctx.fillStyle = '#57432b'; // bark edge
      } else {
        const ringIdx = Math.floor((dist + pseudoNoise(x, y, 909) * 0.5) % rings.length);
        ctx.fillStyle = rings[ringIdx];
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function genPlanks(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  const plankColors = ['#b88d57', '#ad834e', '#c4975e', '#a07743'];
  ctx.fillStyle = '#b88d57';
  ctx.fillRect(0, 0, 16, 16);

  // 4 horizontal boards
  for (let b = 0; b < 4; b++) {
    const yStart = b * 4;
    for (let y = yStart; y < yStart + 3; y++) {
      for (let x = 0; x < 16; x++) {
        const idx = Math.floor(pseudoNoise(x, y + b * 10, 111) * plankColors.length);
        ctx.fillStyle = plankColors[idx];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Board line
    ctx.fillStyle = '#5c4323';
    ctx.fillRect(0, yStart + 3, 16, 1);
  }
  // Nails/splits
  ctx.fillStyle = '#443118';
  ctx.fillRect(2, 1, 1, 1);
  ctx.fillRect(13, 5, 1, 1);
  ctx.fillRect(4, 9, 1, 1);
  ctx.fillRect(11, 13, 1, 1);
  return canvas;
}

function genLeaves(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  const leafGreens = ['#2e6f1f', '#3b8627', '#235917', '#4da333', '#1e4b14'];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const isCutout = pseudoNoise(x, y, 1234) < 0.12;
      if (isCutout) {
        ctx.clearRect(x, y, 1, 1);
      } else {
        const idx = Math.floor(pseudoNoise(x, y, 222) * leafGreens.length);
        ctx.fillStyle = leafGreens[idx];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return canvas;
}

function genSand(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  const sandYellows = ['#dbcb9e', '#d2c295', '#ded0a7', '#c7b789', '#ebdcb0'];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const idx = Math.floor(pseudoNoise(x, y, 333) * sandYellows.length);
      ctx.fillStyle = sandYellows[idx];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function genGlass(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  // Clear interior with border and highlights
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(0, 0, 16, 16);

  // Outer border
  ctx.fillStyle = 'rgba(235, 245, 255, 0.7)';
  ctx.strokeRect(0.5, 0.5, 15, 15);

  // Diagonal glare lines
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(3, 2, 2, 1);
  ctx.fillRect(5, 3, 2, 1);
  ctx.fillRect(7, 4, 2, 1);
  ctx.fillRect(10, 11, 2, 1);
  ctx.fillRect(12, 12, 2, 1);
  return canvas;
}

function genOre(fleckColor: string, fleckHighlight: string, seed: number): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  const stoneGrays = ['#757575', '#6b6b6b', '#616161', '#808080', '#595959'];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const idx = Math.floor(pseudoNoise(x, y, seed) * stoneGrays.length);
      ctx.fillStyle = stoneGrays[idx];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Ore clusters
  const spots = [
    [3, 4], [4, 4], [4, 5],
    [9, 3], [10, 3], [10, 4],
    [6, 9], [7, 9], [7, 10], [6, 10],
    [12, 11], [13, 11], [13, 12],
    [2, 12], [3, 12],
  ];
  spots.forEach(([x, y]) => {
    ctx.fillStyle = fleckColor;
    ctx.fillRect(x, y, 1, 1);
  });
  // Highlights
  [spots[0], spots[3], spots[6], spots[10]].forEach(([x, y]) => {
    ctx.fillStyle = fleckHighlight;
    ctx.fillRect(x, y, 1, 1);
  });
  return canvas;
}

function genCraftingTableTop(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  ctx.fillStyle = '#a67b4c';
  ctx.fillRect(0, 0, 16, 16);

  // 3x3 grid outline
  ctx.fillStyle = '#4c351f';
  ctx.strokeRect(2.5, 2.5, 11, 11);
  ctx.fillRect(6, 3, 1, 10);
  ctx.fillRect(10, 3, 1, 10);
  ctx.fillRect(3, 6, 10, 1);
  ctx.fillRect(3, 10, 10, 1);
  return canvas;
}

function genCraftingTableSide(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  // Planks background
  const plankCanvas = genPlanks();
  ctx.drawImage(plankCanvas, 0, 0);

  // Saw/Hammer tool outline
  ctx.fillStyle = '#2b2319';
  ctx.fillRect(3, 4, 3, 8);
  ctx.fillStyle = '#9e9e9e';
  ctx.fillRect(2, 4, 5, 2);

  // Pair of pliers / shears on side
  ctx.fillStyle = '#8f8f8f';
  ctx.fillRect(10, 4, 2, 7);
  ctx.fillRect(12, 5, 2, 5);
  return canvas;
}

function genFurnaceFront(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  const cobble = genCobblestone();
  ctx.drawImage(cobble, 0, 0);

  // Furnace face frame
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(3, 3, 10, 10);
  ctx.fillStyle = '#171717';
  ctx.fillRect(4, 4, 8, 8);

  // Opening & subtle ember
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(5, 7, 6, 4);
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(6, 9, 4, 2);
  return canvas;
}

function genTorch(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  // Clear background
  ctx.clearRect(0, 0, 16, 16);
  // Wood stick
  ctx.fillStyle = '#57432b';
  ctx.fillRect(7, 6, 2, 9);
  // Coal tip
  ctx.fillStyle = '#262626';
  ctx.fillRect(7, 4, 2, 2);
  // Flame
  ctx.fillStyle = '#ff7b00';
  ctx.fillRect(6, 2, 4, 3);
  ctx.fillStyle = '#ffe600';
  ctx.fillRect(7, 1, 2, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(7, 2, 1, 1);
  return canvas;
}

function genBricks(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  ctx.fillStyle = '#a89f91'; // mortar
  ctx.fillRect(0, 0, 16, 16);

  const brickColors = ['#9c493b', '#8f4033', '#aa5344', '#7d382d'];
  const drawBrick = (x: number, y: number, w: number, h: number) => {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        const c = brickColors[Math.floor(pseudoNoise(px, py, 777) * brickColors.length)];
        ctx.fillStyle = c;
        ctx.fillRect(px, py, 1, 1);
      }
    }
  };

  drawBrick(0, 0, 7, 3);
  drawBrick(8, 0, 8, 3);
  drawBrick(0, 4, 3, 3);
  drawBrick(4, 4, 7, 3);
  drawBrick(12, 4, 4, 3);
  drawBrick(0, 8, 7, 3);
  drawBrick(8, 8, 8, 3);
  drawBrick(0, 12, 3, 3);
  drawBrick(4, 12, 7, 3);
  drawBrick(12, 12, 4, 3);
  return canvas;
}

function genWater(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  const waterBlues = ['#296ae3', '#255ecd', '#2e75f0', '#1c4bb5'];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const idx = Math.floor(pseudoNoise(x, y, 999) * waterBlues.length);
      ctx.fillStyle = waterBlues[idx];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function genFlower(petals: string, center: string): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  ctx.clearRect(0, 0, 16, 16);
  // Stem
  ctx.fillStyle = '#3a7d25';
  ctx.fillRect(7, 7, 2, 8);
  ctx.fillRect(5, 11, 2, 2);
  ctx.fillRect(9, 9, 2, 2);
  // Petals
  ctx.fillStyle = petals;
  ctx.fillRect(6, 3, 4, 4);
  ctx.fillRect(5, 4, 6, 2);
  // Center
  ctx.fillStyle = center;
  ctx.fillRect(7, 4, 2, 2);
  return canvas;
}

function genChestTop(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  ctx.fillStyle = '#8f6735';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#573c1c';
  ctx.strokeRect(0.5, 0.5, 15, 15);
  return canvas;
}

function genChestSide(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  ctx.fillStyle = '#8f6735';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#573c1c';
  ctx.strokeRect(0.5, 0.5, 15, 15);
  ctx.fillRect(0, 5, 16, 1); // lid separation
  // Silver latch on front
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(7, 4, 2, 4);
  ctx.fillStyle = '#333333';
  ctx.fillRect(7, 6, 2, 1);
  return canvas;
}

function genBedTop(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas();
  // Red blanket
  ctx.fillStyle = '#b02e26';
  ctx.fillRect(0, 0, 16, 16);
  // White pillow top 5 rows
  ctx.fillStyle = '#e4e4e4';
  ctx.fillRect(2, 2, 12, 4);
  return canvas;
}

// Cache textures
const textureCache: Map<string, THREE.CanvasTexture> = new Map();

function canvasToTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function getBlockTextures(): {
  materials: Record<BlockType, THREE.Material | THREE.Material[]>;
} {
  // Canvases
  const grassTop = genGrassTop();
  const grassSide = genGrassSide();
  const dirt = genDirt();
  const stone = genStone();
  const cobble = genCobblestone();
  const woodSide = genWoodSide();
  const woodTop = genWoodTop();
  const planks = genPlanks();
  const leaves = genLeaves();
  const sand = genSand();
  const glass = genGlass();
  const coalOre = genOre('#2b2b2b', '#4a4a4a', 1010);
  const ironOre = genOre('#d9ab82', '#ebd0b9', 2020);
  const diamondOre = genOre('#3de8d5', '#98fff4', 3030);
  const craftTop = genCraftingTableTop();
  const craftSide = genCraftingTableSide();
  const furnaceFront = genFurnaceFront();
  const torch = genTorch();
  const bricks = genBricks();
  const water = genWater();
  const poppy = genFlower('#e62727', '#330a0a');
  const dandelion = genFlower('#f5cc00', '#c29c00');
  const chestTop = genChestTop();
  const chestSide = genChestSide();
  const bedTop = genBedTop();

  // Three.js Textures
  const tGrassTop = canvasToTexture(grassTop);
  const tGrassSide = canvasToTexture(grassSide);
  const tDirt = canvasToTexture(dirt);
  const tStone = canvasToTexture(stone);
  const tCobble = canvasToTexture(cobble);
  const tWoodSide = canvasToTexture(woodSide);
  const tWoodTop = canvasToTexture(woodTop);
  const tPlanks = canvasToTexture(planks);
  const tLeaves = canvasToTexture(leaves);
  const tSand = canvasToTexture(sand);
  const tGlass = canvasToTexture(glass);
  const tCoal = canvasToTexture(coalOre);
  const tIron = canvasToTexture(ironOre);
  const tDiamond = canvasToTexture(diamondOre);
  const tCraftTop = canvasToTexture(craftTop);
  const tCraftSide = canvasToTexture(craftSide);
  const tFurnaceFront = canvasToTexture(furnaceFront);
  const tTorch = canvasToTexture(torch);
  const tBricks = canvasToTexture(bricks);
  const tWater = canvasToTexture(water);
  const tPoppy = canvasToTexture(poppy);
  const tDandelion = canvasToTexture(dandelion);
  const tChestTop = canvasToTexture(chestTop);
  const tChestSide = canvasToTexture(chestSide);
  const tBedTop = canvasToTexture(bedTop);

  // Realistic Voxel Face Shading Helper
  // Simulates directional sunlight & ambient occlusion:
  // Top is brightly lit (1.0), East/West receive direct light (0.86), North/South receive diffuse light (0.78), Bottom is in ground shadow (0.52)
  const makeShadedBlock = (
    sideMap: THREE.Texture,
    topMap: THREE.Texture = sideMap,
    bottomMap: THREE.Texture = sideMap,
    frontMap: THREE.Texture = sideMap
  ) => [
    new THREE.MeshLambertMaterial({ map: sideMap, color: 0xdcdcdc }),
    new THREE.MeshLambertMaterial({ map: sideMap, color: 0xdcdcdc }),
    new THREE.MeshLambertMaterial({ map: topMap, color: 0xffffff }),
    new THREE.MeshLambertMaterial({ map: bottomMap, color: 0x888888 }),
    new THREE.MeshLambertMaterial({ map: frontMap, color: 0xc8c8c8 }),
    new THREE.MeshLambertMaterial({ map: frontMap, color: 0xc8c8c8 }),
  ];

  // Materials
  // Box geometry material order: +X (right), -X (left), +Y (top), -Y (bottom), +Z (front), -Z (back)
  const grassMat = [
    new THREE.MeshLambertMaterial({ map: tGrassSide, color: 0xdcdcdc }),
    new THREE.MeshLambertMaterial({ map: tGrassSide, color: 0xdcdcdc }),
    new THREE.MeshLambertMaterial({ map: tGrassTop, color: 0xffffff }),
    new THREE.MeshLambertMaterial({ map: tDirt, color: 0x888888 }),
    new THREE.MeshLambertMaterial({ map: tGrassSide, color: 0xc8c8c8 }),
    new THREE.MeshLambertMaterial({ map: tGrassSide, color: 0xc8c8c8 }),
  ];

  const woodMat = [
    new THREE.MeshLambertMaterial({ map: tWoodSide, color: 0xdcdcdc }),
    new THREE.MeshLambertMaterial({ map: tWoodSide, color: 0xdcdcdc }),
    new THREE.MeshLambertMaterial({ map: tWoodTop, color: 0xffffff }),
    new THREE.MeshLambertMaterial({ map: tWoodTop, color: 0x888888 }),
    new THREE.MeshLambertMaterial({ map: tWoodSide, color: 0xc8c8c8 }),
    new THREE.MeshLambertMaterial({ map: tWoodSide, color: 0xc8c8c8 }),
  ];

  const craftingMat = [
    new THREE.MeshLambertMaterial({ map: tCraftSide, color: 0xdcdcdc }),
    new THREE.MeshLambertMaterial({ map: tCraftSide, color: 0xdcdcdc }),
    new THREE.MeshLambertMaterial({ map: tCraftTop, color: 0xffffff }),
    new THREE.MeshLambertMaterial({ map: tPlanks, color: 0x888888 }),
    new THREE.MeshLambertMaterial({ map: tCraftSide, color: 0xc8c8c8 }),
    new THREE.MeshLambertMaterial({ map: tCraftSide, color: 0xc8c8c8 }),
  ];

  const furnaceMat = [
    new THREE.MeshLambertMaterial({ map: tCobble, color: 0xdcdcdc }),
    new THREE.MeshLambertMaterial({ map: tCobble, color: 0xdcdcdc }),
    new THREE.MeshLambertMaterial({ map: tCobble, color: 0xffffff }),
    new THREE.MeshLambertMaterial({ map: tCobble, color: 0x888888 }),
    new THREE.MeshLambertMaterial({ map: tFurnaceFront, color: 0xffffff }),
    new THREE.MeshLambertMaterial({ map: tCobble, color: 0xc8c8c8 }),
  ];

  const chestMat = [
    new THREE.MeshLambertMaterial({ map: tChestSide, color: 0xdcdcdc }),
    new THREE.MeshLambertMaterial({ map: tChestSide, color: 0xdcdcdc }),
    new THREE.MeshLambertMaterial({ map: tChestTop, color: 0xffffff }),
    new THREE.MeshLambertMaterial({ map: tPlanks, color: 0x888888 }),
    new THREE.MeshLambertMaterial({ map: tChestSide, color: 0xc8c8c8 }),
    new THREE.MeshLambertMaterial({ map: tChestSide, color: 0xc8c8c8 }),
  ];

  const bedMat = [
    new THREE.MeshLambertMaterial({ map: tPlanks, color: 0xdcdcdc }),
    new THREE.MeshLambertMaterial({ map: tPlanks, color: 0xdcdcdc }),
    new THREE.MeshLambertMaterial({ map: tBedTop, color: 0xffffff }),
    new THREE.MeshLambertMaterial({ map: tPlanks, color: 0x888888 }),
    new THREE.MeshLambertMaterial({ map: tPlanks, color: 0xc8c8c8 }),
    new THREE.MeshLambertMaterial({ map: tPlanks, color: 0xc8c8c8 }),
  ];

  const leavesMat = new THREE.MeshLambertMaterial({
    map: tLeaves,
    transparent: true,
    alphaTest: 0.35,
    color: 0x64b846,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    map: tGlass,
    transparent: true,
    opacity: 0.42,
    roughness: 0.1,
    metalness: 0.2,
  });

  const waterMat = new THREE.MeshStandardMaterial({
    map: tWater,
    transparent: true,
    opacity: 0.72,
    roughness: 0.12,
    metalness: 0.15,
    color: new THREE.Color(0x38bdf8),
  });

  const flowerPoppyMat = new THREE.MeshLambertMaterial({
    map: tPoppy,
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });

  const flowerDandelionMat = new THREE.MeshLambertMaterial({
    map: tDandelion,
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });

  const torchMat = new THREE.MeshLambertMaterial({
    map: tTorch,
    transparent: true,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0xffaa33),
    emissiveIntensity: 0.85,
  });

  const materials: Record<BlockType, THREE.Material | THREE.Material[]> = {
    [BlockType.AIR]: new THREE.MeshBasicMaterial({ visible: false }),
    [BlockType.GRASS]: grassMat,
    [BlockType.DIRT]: makeShadedBlock(tDirt),
    [BlockType.STONE]: makeShadedBlock(tStone),
    [BlockType.COBBLESTONE]: makeShadedBlock(tCobble),
    [BlockType.OAK_WOOD]: woodMat,
    [BlockType.OAK_LEAVES]: leavesMat,
    [BlockType.OAK_PLANKS]: makeShadedBlock(tPlanks),
    [BlockType.SAND]: makeShadedBlock(tSand),
    [BlockType.GLASS]: glassMat,
    [BlockType.COAL_ORE]: makeShadedBlock(tCoal),
    [BlockType.IRON_ORE]: makeShadedBlock(tIron),
    [BlockType.DIAMOND_ORE]: makeShadedBlock(tDiamond),
    [BlockType.CRAFTING_TABLE]: craftingMat,
    [BlockType.FURNACE]: furnaceMat,
    [BlockType.TORCH]: torchMat,
    [BlockType.BRICKS]: makeShadedBlock(tBricks),
    [BlockType.WATER]: waterMat,
    [BlockType.POPPY]: flowerPoppyMat,
    [BlockType.DANDELION]: flowerDandelionMat,
    [BlockType.CHEST]: chestMat,
    [BlockType.BED]: bedMat,
  };

  return { materials };
}

// Icon generator for UI items (blocks + tools)
export function getItemDataUrl(type: number): string {
  const { canvas, ctx } = createPixelCanvas();
  // If it's a block, draw an isometric or flat preview
  switch (type) {
    case BlockType.GRASS: {
      ctx.drawImage(genGrassSide(), 0, 0);
      break;
    }
    case BlockType.DIRT: {
      ctx.drawImage(genDirt(), 0, 0);
      break;
    }
    case BlockType.STONE: {
      ctx.drawImage(genStone(), 0, 0);
      break;
    }
    case BlockType.COBBLESTONE: {
      ctx.drawImage(genCobblestone(), 0, 0);
      break;
    }
    case BlockType.OAK_WOOD: {
      ctx.drawImage(genWoodSide(), 0, 0);
      break;
    }
    case BlockType.OAK_LEAVES: {
      ctx.drawImage(genLeaves(), 0, 0);
      break;
    }
    case BlockType.OAK_PLANKS: {
      ctx.drawImage(genPlanks(), 0, 0);
      break;
    }
    case BlockType.SAND: {
      ctx.drawImage(genSand(), 0, 0);
      break;
    }
    case BlockType.GLASS: {
      ctx.drawImage(genGlass(), 0, 0);
      break;
    }
    case BlockType.COAL_ORE: {
      ctx.drawImage(genOre('#2b2b2b', '#4a4a4a', 1010), 0, 0);
      break;
    }
    case BlockType.IRON_ORE: {
      ctx.drawImage(genOre('#d9ab82', '#ebd0b9', 2020), 0, 0);
      break;
    }
    case BlockType.DIAMOND_ORE: {
      ctx.drawImage(genOre('#3de8d5', '#98fff4', 3030), 0, 0);
      break;
    }
    case BlockType.CRAFTING_TABLE: {
      ctx.drawImage(genCraftingTableTop(), 0, 0);
      break;
    }
    case BlockType.FURNACE: {
      ctx.drawImage(genFurnaceFront(), 0, 0);
      break;
    }
    case BlockType.TORCH: {
      ctx.drawImage(genTorch(), 0, 0);
      break;
    }
    case BlockType.BRICKS: {
      ctx.drawImage(genBricks(), 0, 0);
      break;
    }
    case BlockType.POPPY: {
      ctx.drawImage(genFlower('#e62727', '#330a0a'), 0, 0);
      break;
    }
    case BlockType.DANDELION: {
      ctx.drawImage(genFlower('#f5cc00', '#c29c00'), 0, 0);
      break;
    }
    case BlockType.CHEST: {
      ctx.drawImage(genChestSide(), 0, 0);
      break;
    }
    case BlockType.BED: {
      ctx.drawImage(genBedTop(), 0, 0);
      break;
    }
    // Items
    case 100: { // STICK
      ctx.fillStyle = '#6d5334';
      for (let i = 3; i < 13; i++) {
        ctx.fillRect(i, 15 - i, 2, 2);
      }
      break;
    }
    case 101: // WOODEN_PICKAXE
    case 102: // STONE_PICKAXE
    case 103: // IRON_PICKAXE
    case 104: { // DIAMOND_PICKAXE
      const matColors: Record<number, string> = {
        101: '#a07743',
        102: '#808080',
        103: '#dcdcdc',
        104: '#3de8d5',
      };
      const col = matColors[type] || '#ffffff';
      // Pickaxe handle
      ctx.fillStyle = '#6d5334';
      for (let i = 2; i < 11; i++) {
        ctx.fillRect(i, 15 - i, 2, 2);
      }
      // Pickaxe head
      ctx.fillStyle = col;
      ctx.fillRect(10, 2, 4, 3);
      ctx.fillRect(8, 3, 3, 3);
      ctx.fillRect(12, 5, 3, 3);
      ctx.fillRect(7, 4, 2, 2);
      ctx.fillRect(13, 7, 2, 2);
      break;
    }
    case 105: // WOODEN_SWORD
    case 106: // STONE_SWORD
    case 107: { // IRON_SWORD
      const matColors: Record<number, string> = {
        105: '#a07743',
        106: '#808080',
        107: '#dcdcdc',
      };
      const col = matColors[type] || '#ffffff';
      // Blade
      ctx.fillStyle = col;
      for (let i = 6; i < 14; i++) {
        ctx.fillRect(i, 15 - i, 2, 2);
      }
      // Guard
      ctx.fillStyle = '#555555';
      ctx.fillRect(5, 11, 4, 2);
      ctx.fillRect(4, 10, 2, 4);
      // Handle
      ctx.fillStyle = '#6d5334';
      ctx.fillRect(2, 13, 2, 2);
      break;
    }
    case 108: // WOODEN_AXE
    case 109: // STONE_AXE
    case 110: { // IRON_AXE
      const matColors: Record<number, string> = {
        108: '#a07743',
        109: '#808080',
        110: '#dcdcdc',
      };
      const col = matColors[type] || '#ffffff';
      ctx.fillStyle = '#6d5334';
      for (let i = 2; i < 12; i++) {
        ctx.fillRect(i, 15 - i, 2, 2);
      }
      ctx.fillStyle = col;
      ctx.fillRect(8, 2, 5, 4);
      ctx.fillRect(10, 6, 3, 3);
      ctx.fillRect(6, 4, 3, 2);
      break;
    }
    case 111: { // WOODEN_SHOVEL
      ctx.fillStyle = '#6d5334';
      for (let i = 2; i < 11; i++) {
        ctx.fillRect(i, 15 - i, 2, 2);
      }
      ctx.fillStyle = '#a07743';
      ctx.fillRect(10, 2, 4, 4);
      ctx.fillRect(11, 3, 3, 3);
      break;
    }
    case 120: { // APPLE
      ctx.fillStyle = '#e62727';
      ctx.beginPath();
      ctx.arc(8, 9, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#573c1c';
      ctx.fillRect(8, 2, 1, 3);
      ctx.fillStyle = '#55942d';
      ctx.fillRect(9, 3, 2, 1);
      break;
    }
    case 121: { // RAW_PORKCHOP
      ctx.fillStyle = '#f28383';
      ctx.fillRect(4, 5, 8, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(5, 7, 2, 2);
      break;
    }
    case 122: { // COOKED_PORKCHOP
      ctx.fillStyle = '#8f4f34';
      ctx.fillRect(4, 5, 8, 7);
      ctx.fillStyle = '#c78062';
      ctx.fillRect(5, 7, 3, 3);
      break;
    }
    case 123: { // COAL
      ctx.fillStyle = '#262626';
      ctx.beginPath();
      ctx.arc(8, 8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#424242';
      ctx.fillRect(6, 6, 3, 3);
      break;
    }
    case 124: { // IRON_INGOT
      ctx.fillStyle = '#dcdcdc';
      ctx.fillRect(4, 7, 8, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(5, 6, 6, 2);
      ctx.fillStyle = '#9e9e9e';
      ctx.fillRect(4, 11, 8, 1);
      break;
    }
    case 125: { // DIAMOND
      ctx.fillStyle = '#3de8d5';
      ctx.beginPath();
      ctx.moveTo(8, 2);
      ctx.lineTo(13, 7);
      ctx.lineTo(8, 14);
      ctx.lineTo(3, 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#b7fff7';
      ctx.fillRect(6, 5, 4, 3);
      break;
    }
    case 126: { // WOOL
      ctx.fillStyle = '#e4e4e4';
      ctx.beginPath();
      ctx.arc(8, 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(5, 6, 6, 4);
      break;
    }
    default: {
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(0, 0, 16, 16);
    }
  }
  return canvas.toDataURL();
}
