import * as THREE from 'three';
import { BlockType } from './types';
import { getBlockTextures } from './textures';

export const WORLD_SIZE_X = 48;
export const WORLD_SIZE_Z = 48;
export const WORLD_HEIGHT = 28;
export const WATER_LEVEL = 7;

// Simplex-like 2D noise generator for rolling hills
function hash2d(x: number, z: number, seed: number = 42): number {
  const n = Math.sin(x * 374.23 + z * 153.71 + seed * 91.13) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, z: number, seed: number = 42): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const z1 = z0 + 1;

  const sx = x - x0;
  const sz = z - z0;

  // Smoothstep
  const fx = sx * sx * (3 - 2 * sx);
  const fz = sz * sz * (3 - 2 * sz);

  const n00 = hash2d(x0, z0, seed);
  const n10 = hash2d(x1, z0, seed);
  const n01 = hash2d(x0, z1, seed);
  const n11 = hash2d(x1, z1, seed);

  const nx0 = n00 * (1 - fx) + n10 * fx;
  const nx1 = n01 * (1 - fx) + n11 * fx;

  return nx0 * (1 - fz) + nx1 * fz;
}

function perlin2D(x: number, z: number, seed: number = 100): number {
  let total = 0;
  let frequency = 0.04;
  let amplitude = 1.0;
  let max = 0;

  for (let i = 0; i < 3; i++) {
    total += smoothNoise(x * frequency, z * frequency, seed + i * 50) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return total / max;
}

export class VoxelWorld {
  public data: Uint8Array;
  public sizeX: number = WORLD_SIZE_X;
  public sizeY: number = WORLD_HEIGHT;
  public sizeZ: number = WORLD_SIZE_Z;

  private scene: THREE.Scene;
  private materials: Record<BlockType, THREE.Material | THREE.Material[]>;
  private instancedMeshes: Map<BlockType, THREE.InstancedMesh> = new Map();
  private meshArray: (THREE.InstancedMesh | null)[] = new Array(32).fill(null);
  private maxInstancesPerType: number = 4000;
  private boxGeometry: THREE.BoxGeometry;
  private crossGeometry: THREE.BufferGeometry;
  private torchGeometry: THREE.BoxGeometry;

  private rayResult = {
    hit: false,
    blockPos: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    placePos: new THREE.Vector3(),
    blockType: BlockType.AIR,
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.data = new Uint8Array(this.sizeX * this.sizeY * this.sizeZ);
    const { materials } = getBlockTextures();
    this.materials = materials;

    // Standard 1x1x1 block
    this.boxGeometry = new THREE.BoxGeometry(1, 1, 1);

    // Cross geometry for flowers
    const plane1 = new THREE.PlaneGeometry(0.8, 0.8);
    plane1.rotateY(Math.PI / 4);
    const plane2 = new THREE.PlaneGeometry(0.8, 0.8);
    plane2.rotateY(-Math.PI / 4);
    // Combine
    const crossGeo = new THREE.BufferGeometry();
    const pos1 = plane1.attributes.position.array;
    const pos2 = plane2.attributes.position.array;
    const combinedPos = new Float32Array(pos1.length + pos2.length);
    combinedPos.set(pos1, 0);
    combinedPos.set(pos2, pos1.length);
    crossGeo.setAttribute('position', new THREE.BufferAttribute(combinedPos, 3));
    const uv1 = plane1.attributes.uv.array;
    const uv2 = plane2.attributes.uv.array;
    const combinedUv = new Float32Array(uv1.length + uv2.length);
    combinedUv.set(uv1, 0);
    combinedUv.set(uv2, uv1.length);
    crossGeo.setAttribute('uv', new THREE.BufferAttribute(combinedUv, 2));
    this.crossGeometry = crossGeo;

    // Torch geometry: small upright post
    this.torchGeometry = new THREE.BoxGeometry(0.15, 0.7, 0.15);
    this.torchGeometry.translate(0, -0.15, 0);

    this.initMeshes();
    this.generateTerrain();
    this.rebuildAllMeshes();
  }

  private initMeshes() {
    const blockTypes = Object.values(BlockType).filter(
      (v) => typeof v === 'number' && v !== BlockType.AIR
    ) as BlockType[];

    blockTypes.forEach((type) => {
      let geo: THREE.BufferGeometry = this.boxGeometry;
      if (type === BlockType.POPPY || type === BlockType.DANDELION) {
        geo = this.crossGeometry;
      } else if (type === BlockType.TORCH) {
        geo = this.torchGeometry;
      }

      const mat = this.materials[type];
      const mesh = new THREE.InstancedMesh(geo, mat, this.maxInstancesPerType);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.scene.add(mesh);
      this.instancedMeshes.set(type, mesh);
      this.meshArray[type] = mesh;
    });
  }

  public getIndex(x: number, y: number, z: number): number {
    return x + y * this.sizeX + z * this.sizeX * this.sizeY;
  }

  public getBlock(x: number, y: number, z: number): BlockType {
    if (x < 0 || x >= this.sizeX || y < 0 || y >= this.sizeY || z < 0 || z >= this.sizeZ) {
      return BlockType.AIR;
    }
    return this.data[this.getIndex(x, y, z)];
  }

  public setBlock(x: number, y: number, z: number, type: BlockType): boolean {
    if (x < 0 || x >= this.sizeX || y < 0 || y >= this.sizeY || z < 0 || z >= this.sizeZ) {
      return false;
    }
    this.data[this.getIndex(x, y, z)] = type;
    this.rebuildAllMeshes();
    return true;
  }

  public isOpaque(type: BlockType): boolean {
    return (
      type !== BlockType.AIR &&
      type !== BlockType.WATER &&
      type !== BlockType.GLASS &&
      type !== BlockType.OAK_LEAVES &&
      type !== BlockType.POPPY &&
      type !== BlockType.DANDELION &&
      type !== BlockType.TORCH
    );
  }

  // Check if any face of the block at (x,y,z) is exposed (0 object allocations)
  public isBlockVisible(x: number, y: number, z: number): boolean {
    const type = this.getBlock(x, y, z);
    if (type === BlockType.AIR) return false;

    // Non-cube or transparent blocks are always visible
    if (!this.isOpaque(type)) return true;

    // Check top face first (most surface blocks have air above them)
    if (!this.isOpaque(this.getBlock(x, y + 1, z))) return true;
    if (!this.isOpaque(this.getBlock(x + 1, y, z))) return true;
    if (!this.isOpaque(this.getBlock(x - 1, y, z))) return true;
    if (!this.isOpaque(this.getBlock(x, y - 1, z))) return true;
    if (!this.isOpaque(this.getBlock(x, y, z + 1))) return true;
    if (!this.isOpaque(this.getBlock(x, y, z - 1))) return true;
    return false;
  }

  private generateTerrain() {
    const midX = this.sizeX / 2;
    const midZ = this.sizeZ / 2;

    for (let x = 0; x < this.sizeX; x++) {
      for (let z = 0; z < this.sizeZ; z++) {
        // Height map with Perlin noise
        const n = perlin2D(x, z, 77);
        // Valley / river dip near one side
        const distFromCenter = Math.hypot(x - midX, z - midZ) / (this.sizeX * 0.5);
        const riverNoise = Math.sin(x * 0.15) * 2 + Math.cos(z * 0.12) * 2;
        const height = Math.floor(9 + n * 8 + riverNoise * 0.5);

        for (let y = 0; y < this.sizeY; y++) {
          if (y <= height) {
            if (y === height) {
              if (y <= WATER_LEVEL + 1) {
                // Sand beach near water
                this.data[this.getIndex(x, y, z)] = BlockType.SAND;
              } else {
                this.data[this.getIndex(x, y, z)] = BlockType.GRASS;
              }
            } else if (y >= height - 3) {
              if (height <= WATER_LEVEL + 1) {
                this.data[this.getIndex(x, y, z)] = BlockType.SAND;
              } else {
                this.data[this.getIndex(x, y, z)] = BlockType.DIRT;
              }
            } else {
              // Underground stone with ores
              const oreRand = hash2d(x + y * 13, z + y * 17, 999);
              if (y < 4 && oreRand < 0.03) {
                this.data[this.getIndex(x, y, z)] = BlockType.DIAMOND_ORE;
              } else if (y < 10 && oreRand < 0.08) {
                this.data[this.getIndex(x, y, z)] = BlockType.IRON_ORE;
              } else if (oreRand < 0.14) {
                this.data[this.getIndex(x, y, z)] = BlockType.COAL_ORE;
              } else {
                this.data[this.getIndex(x, y, z)] = BlockType.STONE;
              }
            }
          } else if (y <= WATER_LEVEL) {
            // Water lake
            this.data[this.getIndex(x, y, z)] = BlockType.WATER;
          }
        }

        // Flowers and plants on grass
        if (height > WATER_LEVEL + 1 && height < this.sizeY - 8) {
          const plantRand = hash2d(x, z, 444);
          if (plantRand < 0.04) {
            this.data[this.getIndex(x, height + 1, z)] = BlockType.POPPY;
          } else if (plantRand < 0.08) {
            this.data[this.getIndex(x, height + 1, z)] = BlockType.DANDELION;
          }
        }
      }
    }

    // Generate Trees (Oak trees)
    for (let x = 4; x < this.sizeX - 4; x += 5) {
      for (let z = 4; z < this.sizeZ - 4; z += 5) {
        const treeX = x + Math.floor(hash2d(x, z, 123) * 3) - 1;
        const treeZ = z + Math.floor(hash2d(x, z, 321) * 3) - 1;

        if (treeX < 3 || treeX >= this.sizeX - 3 || treeZ < 3 || treeZ >= this.sizeZ - 3) continue;

        // Find ground height
        let groundY = -1;
        for (let y = this.sizeY - 1; y >= 0; y--) {
          const b = this.getBlock(treeX, y, treeZ);
          if (b === BlockType.GRASS) {
            groundY = y;
            break;
          }
        }

        if (groundY > WATER_LEVEL + 1 && groundY < this.sizeY - 10) {
          this.growTree(treeX, groundY + 1, treeZ);
        }
      }
    }

    // Place a starter crafting table and chest near spawn (24, ground, 24)
    const spawnX = Math.floor(this.sizeX / 2);
    const spawnZ = Math.floor(this.sizeZ / 2);
    let spawnY = 12;
    for (let y = this.sizeY - 1; y >= 0; y--) {
      if (this.getBlock(spawnX, y, spawnZ) === BlockType.GRASS) {
        spawnY = y + 1;
        break;
      }
    }
    this.data[this.getIndex(spawnX + 1, spawnY, spawnZ)] = BlockType.CRAFTING_TABLE;
    this.data[this.getIndex(spawnX - 1, spawnY, spawnZ)] = BlockType.CHEST;
    this.data[this.getIndex(spawnX, spawnY, spawnZ + 2)] = BlockType.TORCH;
  }

  private growTree(x: number, y: number, z: number) {
    const trunkHeight = 4 + Math.floor(hash2d(x, z, 888) * 2);

    // Trunk
    for (let ty = 0; ty < trunkHeight; ty++) {
      this.data[this.getIndex(x, y + ty, z)] = BlockType.OAK_WOOD;
    }

    // Leaves crown
    const crownBottom = y + trunkHeight - 2;
    const crownTop = y + trunkHeight + 1;

    for (let ly = crownBottom; ly <= crownTop; ly++) {
      const radius = ly >= crownTop ? 1 : 2;
      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (lx === 0 && lz === 0 && ly < y + trunkHeight) continue; // trunk inside
          // Corner cutting
          if (Math.abs(lx) === radius && Math.abs(lz) === radius && (ly === crownTop || hash2d(lx, lz, ly) > 0.5)) {
            continue;
          }
          const wx = x + lx;
          const wz = z + lz;
          if (wx >= 0 && wx < this.sizeX && wz >= 0 && wz < this.sizeZ && ly < this.sizeY) {
            const current = this.getBlock(wx, ly, wz);
            if (current === BlockType.AIR) {
              this.data[this.getIndex(wx, ly, wz)] = BlockType.OAK_LEAVES;
            }
          }
        }
      }
    }
  }

  public rebuildAllMeshes() {
    const counts = new Uint32Array(32);
    const matrix = new THREE.Matrix4();

    for (let i = 0; i < this.meshArray.length; i++) {
      const mesh = this.meshArray[i];
      if (mesh) mesh.count = 0;
    }

    const sx = this.sizeX;
    const sy = this.sizeY;
    const sz = this.sizeZ;
    const maxInst = this.maxInstancesPerType;

    for (let x = 0; x < sx; x++) {
      for (let y = 0; y < sy; y++) {
        for (let z = 0; z < sz; z++) {
          const type = this.data[x + y * sx + z * sx * sy];
          if (type === BlockType.AIR) continue;

          if (this.isBlockVisible(x, y, z)) {
            const mesh = this.meshArray[type];
            if (!mesh) continue;

            const currentCount = counts[type];
            if (currentCount >= maxInst) continue;

            matrix.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
            mesh.setMatrixAt(currentCount, matrix);
            counts[type] = currentCount + 1;
          }
        }
      }
    }

    for (let i = 0; i < this.meshArray.length; i++) {
      const mesh = this.meshArray[i];
      if (mesh) {
        mesh.count = counts[i];
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  // Fast DDA Voxel Raycaster (Voxel Traversal Algorithm) - Reuses rayResult
  public raycastVoxel(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number = 6.0
  ): {
    hit: boolean;
    blockPos: THREE.Vector3;
    normal: THREE.Vector3;
    placePos: THREE.Vector3;
    blockType: BlockType;
  } | null {
    let px = origin.x;
    let py = origin.y;
    let pz = origin.z;

    const dx = direction.x;
    const dy = direction.y;
    const dz = direction.z;

    let x = Math.floor(px);
    let y = Math.floor(py);
    let z = Math.floor(pz);

    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

    const deltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const deltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    const deltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;

    let maxX = dx > 0 ? (Math.floor(px) + 1 - px) * deltaX : (px - Math.floor(px)) * deltaX;
    let maxY = dy > 0 ? (Math.floor(py) + 1 - py) * deltaY : (py - Math.floor(py)) * deltaY;
    let maxZ = dz > 0 ? (Math.floor(pz) + 1 - pz) * deltaZ : (pz - Math.floor(pz)) * deltaZ;

    let normalX = 0;
    let normalY = 0;
    let normalZ = 0;

    let dist = 0;

    while (dist <= maxDistance) {
      const currentBlock = this.getBlock(x, y, z);
      // Hit a solid or non-air non-water block
      if (currentBlock !== BlockType.AIR && currentBlock !== BlockType.WATER) {
        this.rayResult.hit = true;
        this.rayResult.blockPos.set(x, y, z);
        this.rayResult.normal.set(normalX, normalY, normalZ);
        this.rayResult.placePos.set(x + normalX, y + normalY, z + normalZ);
        this.rayResult.blockType = currentBlock;
        return this.rayResult;
      }

      if (maxX < maxY) {
        if (maxX < maxZ) {
          x += stepX;
          dist = maxX;
          maxX += deltaX;
          normalX = -stepX;
          normalY = 0;
          normalZ = 0;
        } else {
          z += stepZ;
          dist = maxZ;
          maxZ += deltaZ;
          normalX = 0;
          normalY = 0;
          normalZ = -stepZ;
        }
      } else {
        if (maxY < maxZ) {
          y += stepY;
          dist = maxY;
          maxY += deltaY;
          normalX = 0;
          normalY = -stepY;
          normalZ = 0;
        } else {
          z += stepZ;
          dist = maxZ;
          maxZ += deltaZ;
          normalX = 0;
          normalY = 0;
          normalZ = -stepZ;
        }
      }
    }

    return null;
  }
}
