import * as THREE from 'three';
import { BlockType, ItemId, AnyItemId, DroppedItemEntity, BlockParticle } from './types';
import { ITEM_REGISTRY } from './items';
import { VoxelWorld } from './world';
import { sounds } from './audio';

export interface VoxelMob {
  mesh: THREE.Group;
  type: 'pig' | 'sheep' | 'zombie';
  health: number;
  maxHealth: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  walkTimer: number;
  turnTimer: number;
  hurtFlashTimer: number;
  attackCooldown: number;
  isHostile: boolean;
  legAngle: number;
  legs: THREE.Mesh[];
  head: THREE.Mesh;
}

export class EntityManager {
  private scene: THREE.Scene;
  private world: VoxelWorld;
  public mobs: VoxelMob[] = [];
  public droppedItems: { entity: DroppedItemEntity; mesh: THREE.Mesh }[] = [];
  public particles: BlockParticle[] = [];
  private particlePoints: THREE.Points;
  private particleGeo: THREE.BufferGeometry;
  private particlePositions: Float32Array;
  private particleColors: Float32Array;
  private maxParticles: number = 80;

  constructor(scene: THREE.Scene, world: VoxelWorld) {
    this.scene = scene;
    this.world = world;

    // Particle system setup
    this.particleGeo = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(this.maxParticles * 3);
    this.particleColors = new Float32Array(this.maxParticles * 3);
    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    this.particleGeo.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    });
    this.particlePoints = new THREE.Points(this.particleGeo, particleMat);
    this.particlePoints.visible = false;
    this.scene.add(this.particlePoints);

    this.spawnInitialMobs();
  }

  private spawnInitialMobs() {
    // Spawn a few pigs and sheep
    for (let i = 0; i < 4; i++) {
      const rx = 10 + Math.random() * (this.world.sizeX - 20);
      const rz = 10 + Math.random() * (this.world.sizeZ - 20);
      let ry = 15;
      for (let y = this.world.sizeY - 1; y >= 0; y--) {
        if (this.world.getBlock(Math.floor(rx), y, Math.floor(rz)) !== BlockType.AIR) {
          ry = y + 1;
          break;
        }
      }
      this.createMob('pig', rx, ry, rz);
    }

    for (let i = 0; i < 3; i++) {
      const rx = 8 + Math.random() * (this.world.sizeX - 16);
      const rz = 8 + Math.random() * (this.world.sizeZ - 16);
      let ry = 15;
      for (let y = this.world.sizeY - 1; y >= 0; y--) {
        if (this.world.getBlock(Math.floor(rx), y, Math.floor(rz)) !== BlockType.AIR) {
          ry = y + 1;
          break;
        }
      }
      this.createMob('sheep', rx, ry, rz);
    }
  }

  public spawnNightZombie(playerPos: THREE.Vector3) {
    if (this.mobs.filter((m) => m.type === 'zombie').length >= 2) return;

    // Spawn 18-24 blocks away from player so they don't immediately surprise player
    const angle = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 6;
    const zx = Math.max(2, Math.min(this.world.sizeX - 2, playerPos.x + Math.cos(angle) * dist));
    const zz = Math.max(2, Math.min(this.world.sizeZ - 2, playerPos.z + Math.sin(angle) * dist));

    let zy = 15;
    for (let y = this.world.sizeY - 1; y >= 0; y--) {
      if (this.world.getBlock(Math.floor(zx), y, Math.floor(zz)) !== BlockType.AIR) {
        zy = y + 1;
        break;
      }
    }
    this.createMob('zombie', zx, zy, zz);
  }

  public createMob(type: 'pig' | 'sheep' | 'zombie', x: number, y: number, z: number) {
    const mobGroup = new THREE.Group();
    const legs: THREE.Mesh[] = [];
    let head: THREE.Mesh;
    let maxHealth = 10;
    let isHostile = false;

    if (type === 'pig') {
      const pinkMat = new THREE.MeshLambertMaterial({ color: 0xf0a19c });
      const snoutMat = new THREE.MeshLambertMaterial({ color: 0xdb7b76 });

      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.9), pinkMat);
      body.position.y = 0.55;
      mobGroup.add(body);

      // Head
      head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), pinkMat);
      head.position.set(0, 0.75, 0.5);

      // Snout
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.1), snoutMat);
      snout.position.set(0, -0.08, 0.28);
      head.add(snout);
      mobGroup.add(head);

      // 4 Legs
      const legGeo = new THREE.BoxGeometry(0.2, 0.4, 0.2);
      const legOffsets = [
        [-0.22, 0.2, 0.3],
        [0.22, 0.2, 0.3],
        [-0.22, 0.2, -0.3],
        [0.22, 0.2, -0.3],
      ];
      legOffsets.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, pinkMat);
        leg.position.set(lx, ly, lz);
        mobGroup.add(leg);
        legs.push(leg);
      });
      maxHealth = 10;
    } else if (type === 'sheep') {
      const woolMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
      const skinMat = new THREE.MeshLambertMaterial({ color: 0xcdb29a });

      // Body (Wool)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.0), woolMat);
      body.position.y = 0.65;
      mobGroup.add(body);

      // Head
      head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.45), skinMat);
      head.position.set(0, 0.85, 0.55);
      mobGroup.add(head);

      // 4 Legs
      const legGeo = new THREE.BoxGeometry(0.18, 0.45, 0.18);
      const legOffsets = [
        [-0.25, 0.23, 0.35],
        [0.25, 0.23, 0.35],
        [-0.25, 0.23, -0.35],
        [0.25, 0.23, -0.35],
      ];
      legOffsets.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, skinMat);
        leg.position.set(lx, ly, lz);
        mobGroup.add(leg);
        legs.push(leg);
      });
      maxHealth = 8;
    } else {
      // Zombie
      isHostile = true;
      maxHealth = 16;
      const greenSkinMat = new THREE.MeshLambertMaterial({ color: 0x5a8a47 });
      const blueShirtMat = new THREE.MeshLambertMaterial({ color: 0x3d7099 });
      const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2b385e });

      // Body (Shirt)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.25), blueShirtMat);
      body.position.y = 0.95;
      mobGroup.add(body);

      // Head
      head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), greenSkinMat);
      head.position.set(0, 1.5, 0);
      mobGroup.add(head);

      // Arms outstretched forward
      const armGeo = new THREE.BoxGeometry(0.18, 0.18, 0.65);
      const leftArm = new THREE.Mesh(armGeo, greenSkinMat);
      leftArm.position.set(-0.35, 1.1, 0.3);
      const rightArm = new THREE.Mesh(armGeo, greenSkinMat);
      rightArm.position.set(0.35, 1.1, 0.3);
      mobGroup.add(leftArm);
      mobGroup.add(rightArm);

      // Legs
      const legGeo = new THREE.BoxGeometry(0.2, 0.65, 0.2);
      const leftLeg = new THREE.Mesh(legGeo, pantsMat);
      leftLeg.position.set(-0.13, 0.33, 0);
      const rightLeg = new THREE.Mesh(legGeo, pantsMat);
      rightLeg.position.set(0.13, 0.33, 0);
      mobGroup.add(leftLeg);
      mobGroup.add(rightLeg);
      legs.push(leftLeg, rightLeg);
    }

    mobGroup.position.set(x, y, z);
    this.scene.add(mobGroup);

    this.mobs.push({
      mesh: mobGroup,
      type,
      health: maxHealth,
      maxHealth,
      position: new THREE.Vector3(x, y, z),
      velocity: new THREE.Vector3(),
      yaw: Math.random() * Math.PI * 2,
      walkTimer: 0,
      turnTimer: 2 + Math.random() * 3,
      hurtFlashTimer: 0,
      attackCooldown: 0,
      isHostile,
      legAngle: 0,
      legs,
      head,
    });
  }

  public spawnDrop(itemId: AnyItemId, count: number, pos: THREE.Vector3) {
    const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    // Simple colored mini cube for drop
    const mat = new THREE.MeshLambertMaterial({
      color: itemId === ItemId.DIAMOND ? 0x3de8d5 : itemId === ItemId.IRON_INGOT ? 0xdcdcdc : 0xa07743,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.position.y += 0.3;
    this.scene.add(mesh);

    this.droppedItems.push({
      entity: {
        id: Math.random().toString(),
        itemId,
        count,
        x: pos.x,
        y: pos.y + 0.3,
        z: pos.z,
        vx: (Math.random() - 0.5) * 2,
        vy: 3.5,
        vz: (Math.random() - 0.5) * 2,
        life: 0,
      },
      mesh,
    });
  }

  public spawnBlockBreakParticles(pos: THREE.Vector3, typeOrColor: BlockType | string = BlockType.STONE) {
    let colHex = 0x737373;
    if (typeof typeOrColor === 'number') {
      if (typeOrColor === BlockType.GRASS) colHex = 0x5da531;
      else if (typeOrColor === BlockType.DIRT) colHex = 0x795438;
      else if (typeOrColor === BlockType.OAK_WOOD || typeOrColor === BlockType.OAK_PLANKS) colHex = 0x8f6735;
      else if (typeOrColor === BlockType.OAK_LEAVES) colHex = 0x3b8526;
      else if (typeOrColor === BlockType.DIAMOND_ORE) colHex = 0x38e1d4;
      else if (typeOrColor === BlockType.COAL_ORE) colHex = 0x262626;
      else if (typeOrColor === BlockType.IRON_ORE) colHex = 0xd9ab82;
      else if (typeOrColor === BlockType.SAND) colHex = 0xecd698;
    } else {
      colHex = new THREE.Color(typeOrColor).getHex();
    }

    const colorObj = new THREE.Color(colHex);
    const count = 8;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      this.particles.push({
        x: pos.x + 0.5 + (Math.random() - 0.5) * 0.7,
        y: pos.y + 0.5 + (Math.random() - 0.5) * 0.7,
        z: pos.z + 0.5 + (Math.random() - 0.5) * 0.7,
        vx: (Math.random() - 0.5) * 3.5,
        vy: 2.2 + Math.random() * 2.2,
        vz: (Math.random() - 0.5) * 3.5,
        color: `#${colorObj.getHexString()}`,
        r: colorObj.r,
        g: colorObj.g,
        b: colorObj.b,
        size: 0.12,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.35,
      });
    }
  }

  public spawnFootstepDust(pos: THREE.Vector3, isWater: boolean) {
    if (this.particles.length >= this.maxParticles - 4) return;
    const colorObj = new THREE.Color(isWater ? 0x67e8f9 : 0xb48b62);
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: pos.x + (Math.random() - 0.5) * 0.4,
        y: pos.y + 0.05,
        z: pos.z + (Math.random() - 0.5) * 0.4,
        vx: (Math.random() - 0.5) * 1.0,
        vy: 0.8 + Math.random() * 0.8,
        vz: (Math.random() - 0.5) * 1.0,
        color: isWater ? '#67e8f9' : '#b48b62',
        r: colorObj.r,
        g: colorObj.g,
        b: colorObj.b,
        size: isWater ? 0.09 : 0.07,
        life: 0,
        maxLife: 0.32 + Math.random() * 0.2,
      });
    }
  }

  public hitMobAt(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    damage: number
  ): VoxelMob | null {
    const hitRadius = 1.0;
    for (const mob of this.mobs) {
      const mobCenter = mob.position.clone().add(new THREE.Vector3(0, 0.6, 0));
      const toMob = mobCenter.clone().sub(origin);
      const proj = toMob.dot(direction);

      if (proj > 0 && proj < 3.5) {
        const closestPoint = origin.clone().addScaledVector(direction, proj);
        const dist = closestPoint.distanceTo(mobCenter);
        if (dist < hitRadius) {
          // Hit this mob!
          mob.health -= damage;
          mob.hurtFlashTimer = 0.3;
          sounds.playMobHit();

          // Knockback
          mob.velocity.addScaledVector(direction, 4.0);
          mob.velocity.y += 3.0;

          if (mob.health <= 0) {
            // Drop loot
            if (mob.type === 'pig') {
              this.spawnDrop(ItemId.RAW_PORKCHOP, 1 + Math.floor(Math.random() * 2), mob.position);
            } else if (mob.type === 'sheep') {
              this.spawnDrop(ItemId.WOOL, 1 + Math.floor(Math.random() * 2), mob.position);
            } else if (mob.type === 'zombie') {
              this.spawnDrop(ItemId.IRON_INGOT, Math.random() < 0.3 ? 1 : 0, mob.position);
            }
            this.scene.remove(mob.mesh);
            this.mobs = this.mobs.filter((m) => m !== mob);
          }
          return mob;
        }
      }
    }
    return null;
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    onPlayerDamage: (amt: number, knockbackDir?: THREE.Vector3) => void,
    onPickupItem: (itemId: AnyItemId, count: number) => boolean,
    difficulty: 'peaceful' | 'easy' | 'normal' = 'normal'
  ) {
    // If peaceful mode, despawn any hostile mobs immediately
    if (difficulty === 'peaceful') {
      for (let i = this.mobs.length - 1; i >= 0; i--) {
        if (this.mobs[i].isHostile) {
          this.scene.remove(this.mobs[i].mesh);
          this.mobs.splice(i, 1);
        }
      }
    }

    // 1. Update Mobs
    for (const mob of this.mobs) {
      if (mob.attackCooldown > 0) {
        mob.attackCooldown -= dt;
      }

      // AI behavior
      if (mob.isHostile && difficulty !== 'peaceful') {
        const dx = playerPos.x - mob.position.x;
        const dz = playerPos.z - mob.position.z;
        const distToPlayer = Math.hypot(dx, dz);

        // Only pursue if within 10 blocks (not 14)
        if (distToPlayer < 10) {
          mob.yaw = Math.atan2(dx, dz);
          // Controlled zombie pace so player can outrun or fight back
          const speed = difficulty === 'easy' ? 1.3 : 1.6;
          mob.velocity.x = Math.sin(mob.yaw) * speed;
          mob.velocity.z = Math.cos(mob.yaw) * speed;

          // Attack player if within 1.3 blocks and attack cooldown is ready
          if (distToPlayer < 1.3 && Math.abs(playerPos.y - mob.position.y) < 1.5) {
            if (mob.attackCooldown <= 0) {
              mob.attackCooldown = difficulty === 'easy' ? 1.5 : 1.1; // attack cooldown
              const pushDir = new THREE.Vector3(dx, 0.25, dz).normalize();
              const dmg = difficulty === 'easy' ? 1 : 2;
              onPlayerDamage(dmg, pushDir);
            }
          }
        } else {
          // Wander casually
          mob.turnTimer -= dt;
          if (mob.turnTimer <= 0) {
            mob.turnTimer = 3 + Math.random() * 3;
            mob.yaw += (Math.random() - 0.5) * Math.PI;
          }
          mob.velocity.x = Math.sin(mob.yaw) * 0.7;
          mob.velocity.z = Math.cos(mob.yaw) * 0.7;
        }
      } else {
        // Wandering passive animals
        mob.turnTimer -= dt;
        if (mob.turnTimer <= 0) {
          mob.turnTimer = 2 + Math.random() * 4;
          mob.yaw += (Math.random() - 0.5) * Math.PI;
        }
        const speed = 1.0;
        mob.velocity.x = Math.sin(mob.yaw) * speed;
        mob.velocity.z = Math.cos(mob.yaw) * speed;
      }

      // Gravity
      mob.velocity.y -= 18 * dt;

      // Obstacle jump check: if block in front, jump!
      const frontX = Math.floor(mob.position.x + Math.sin(mob.yaw) * 0.6);
      const frontZ = Math.floor(mob.position.z + Math.cos(mob.yaw) * 0.6);
      const frontBlock = this.world.getBlock(frontX, Math.floor(mob.position.y), frontZ);
      if (frontBlock !== BlockType.AIR && frontBlock !== BlockType.WATER && mob.velocity.y <= 0) {
        mob.velocity.y = 5.5; // Jump over 1 block
      }

      // Move mob
      mob.position.x += mob.velocity.x * dt;
      mob.position.z += mob.velocity.z * dt;
      mob.position.y += mob.velocity.y * dt;

      // Simple ground clamp
      const curY = Math.floor(mob.position.y);
      const blockUnder = this.world.getBlock(Math.floor(mob.position.x), curY, Math.floor(mob.position.z));
      if (blockUnder !== BlockType.AIR && blockUnder !== BlockType.WATER) {
        mob.position.y = curY + 1.0;
        mob.velocity.y = 0;
      }

      // Mob model transforms
      mob.mesh.position.copy(mob.position);
      mob.mesh.rotation.y = mob.yaw;

      // Leg swing animation
      mob.legAngle += dt * 8;
      const legRot = Math.sin(mob.legAngle) * 0.4;
      mob.legs.forEach((leg, idx) => {
        leg.rotation.x = idx % 2 === 0 ? legRot : -legRot;
      });

      // Hurt flash red
      if (mob.hurtFlashTimer > 0) {
        mob.hurtFlashTimer -= dt;
      }
    }

    // 2. Update Dropped Items
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const drop = this.droppedItems[i];
      drop.entity.life += dt;

      // Gravity and float
      drop.entity.vy -= 12 * dt;
      drop.entity.x += drop.entity.vx * dt;
      drop.entity.y += drop.entity.vy * dt;
      drop.entity.z += drop.entity.vz * dt;
      drop.entity.vx *= 0.9;
      drop.entity.vz *= 0.9;

      // Ground collision
      const curY = Math.floor(drop.entity.y);
      const bUnder = this.world.getBlock(Math.floor(drop.entity.x), curY, Math.floor(drop.entity.z));
      if (bUnder !== BlockType.AIR) {
        drop.entity.y = curY + 1.1 + Math.sin(drop.entity.life * 4) * 0.08;
        drop.entity.vy = 0;
      }

      // Magnetism to player
      const dx = playerPos.x - drop.entity.x;
      const dy = playerPos.y + 0.5 - drop.entity.y;
      const dz = playerPos.z - drop.entity.z;
      const dist = Math.hypot(dx, dy, dz);

      if (dist < 1.8) {
        // Collect item!
        const success = onPickupItem(drop.entity.itemId, drop.entity.count);
        if (success) {
          sounds.playBlockPlace();
          this.scene.remove(drop.mesh);
          this.droppedItems.splice(i, 1);
          continue;
        }
      }

      drop.mesh.position.set(drop.entity.x, drop.entity.y, drop.entity.z);
      drop.mesh.rotation.y += dt * 2.5;
    }

    // 3. Update Particles
    if (this.particles.length > 0) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          this.particles.splice(i, 1);
          continue;
        }
        p.vy -= 14 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      }

      if (this.particles.length > 0) {
        this.particlePoints.visible = true;
        for (let i = 0; i < this.maxParticles; i++) {
          if (i < this.particles.length) {
            const p = this.particles[i];
            this.particlePositions[i * 3] = p.x;
            this.particlePositions[i * 3 + 1] = p.y;
            this.particlePositions[i * 3 + 2] = p.z;

            this.particleColors[i * 3] = p.r;
            this.particleColors[i * 3 + 1] = p.g;
            this.particleColors[i * 3 + 2] = p.b;
          } else {
            this.particlePositions[i * 3] = 0;
            this.particlePositions[i * 3 + 1] = -100;
            this.particlePositions[i * 3 + 2] = 0;
          }
        }
        this.particleGeo.attributes.position.needsUpdate = true;
        this.particleGeo.attributes.color.needsUpdate = true;
      } else {
        this.particlePoints.visible = false;
      }
    } else {
      if (this.particlePoints.visible) {
        this.particlePoints.visible = false;
      }
    }
  }
}
