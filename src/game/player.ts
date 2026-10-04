import * as THREE from 'three';
import { VoxelWorld, WATER_LEVEL } from './world';
import { BlockType, ItemId, AnyItemId, InventorySlot } from './types';
import { ITEM_REGISTRY } from './items';
import { sounds } from './audio';

export interface PlayerStats {
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  oxygen: number;
  maxOxygen: number;
  isCrouching: boolean;
  isGrounded: boolean;
  inWater: boolean;
  gameMode: 'survival' | 'creative';
}

export class PlayerController {
  public camera: THREE.PerspectiveCamera;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public rotation: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');

  public width: number = 0.6;
  public height: number = 1.8;
  public crouchHeight: number = 1.4;
  public eyeHeight: number = 1.62;
  public crouchEyeHeight: number = 1.25;

  public isGrounded: boolean = false;
  public isCrouching: boolean = false;
  public inWater: boolean = false;

  public health: number = 20; // 10 hearts
  public maxHealth: number = 20;
  public hunger: number = 20; // 10 drumsticks
  public maxHunger: number = 20;
  public oxygen: number = 20; // 10 bubbles
  public maxOxygen: number = 20;
  public gameMode: 'survival' | 'creative' = 'survival';

  // Fall damage tracking
  private highestYDuringFall: number = 0;
  private wasInAir: boolean = false;

  // Viewmodel (First-person hand/tool)
  public handGroup: THREE.Group;
  private handMesh: THREE.Mesh;
  public toolContainer: THREE.Group;
  public swingProgress: number = 0;
  public isSwinging: boolean = false;
  private bobTimer: number = 0;
  private currentHeldItemId: AnyItemId | null = null;

  // Mining state
  public currentMiningPos: THREE.Vector3 | null = null;
  public miningProgress: number = 0; // 0 to 1
  public invulnerableTimer: number = 0; // i-frames cooldown
  public hurtTimer: number = 0; // Visual red damage flash
  private digSoundTimer: number = 0;
  private stepSoundTimer: number = 0;
  private hungerTimer: number = 0;
  private regenTimer: number = 0;
  private drownTimer: number = 0;

  // Visual selection box for target
  public selectionBox: THREE.LineSegments;
  public breakOverlay: THREE.Mesh;

  private world: VoxelWorld;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, world: VoxelWorld) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;

    // Spawn point at center of world
    const spawnX = Math.floor(world.sizeX / 2) + 0.5;
    const spawnZ = Math.floor(world.sizeZ / 2) + 0.5;
    let spawnY = 16;
    for (let y = world.sizeY - 1; y >= 0; y--) {
      if (world.getBlock(Math.floor(spawnX), y, Math.floor(spawnZ)) !== BlockType.AIR) {
        spawnY = y + 2;
        break;
      }
    }

    this.position = new THREE.Vector3(spawnX, spawnY, spawnZ);
    this.camera.position.copy(this.position);
    this.camera.position.y += this.eyeHeight;

    // Build First-person Arm / Tool Group
    this.handGroup = new THREE.Group();
    this.camera.add(this.handGroup);
    this.scene.add(this.camera);

    // Voxel Steve-like arm
    const armGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    armGeo.translate(0, -0.25, 0);
    const armMat = new THREE.MeshLambertMaterial({ color: 0xcd946a }); // flesh tone
    this.handMesh = new THREE.Mesh(armGeo, armMat);
    this.handMesh.position.set(0.35, -0.3, -0.5);
    this.handMesh.rotation.set(0.3, -0.2, 0.1);
    this.handGroup.add(this.handMesh);

    // Tool / Held item container (3D voxel model)
    this.toolContainer = new THREE.Group();
    this.toolContainer.position.set(0.3, -0.22, -0.44);
    this.toolContainer.rotation.set(0.15, -0.1, 0.35);
    this.handGroup.add(this.toolContainer);

    // Selection wireframe for targeted block
    const boxGeo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
    const edges = new THREE.EdgesGeometry(boxGeo);
    this.selectionBox = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
    );
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);

    // Break progress overlay cube (flickers/grows cracks)
    const breakMat = new THREE.MeshBasicMaterial({
      color: 0x222222,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
    });
    this.breakOverlay = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), breakMat);
    this.breakOverlay.visible = false;
    this.scene.add(this.breakOverlay);
  }

  // Build high-detail 3D models for held items (Pickaxe, Sword, Axe, Torch, Food, Blocks)
  public updateHeldItem(item: InventorySlot | null) {
    // Clear existing held item 3D parts
    while (this.toolContainer.children.length > 0) {
      const child = this.toolContainer.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      this.toolContainer.remove(child);
    }

    if (!item || item.count <= 0) {
      this.currentHeldItemId = null;
      this.handMesh.visible = true;
      this.toolContainer.visible = false;
      return;
    }

    this.currentHeldItemId = item.itemId;
    this.toolContainer.visible = true;
    this.handMesh.visible = true;

    const id = item.itemId;
    const info = ITEM_REGISTRY[id];

    // 1. Pickaxes (3D curved head with pointed picks)
    if (
      id === ItemId.WOODEN_PICKAXE ||
      id === ItemId.STONE_PICKAXE ||
      id === ItemId.IRON_PICKAXE ||
      id === ItemId.DIAMOND_PICKAXE
    ) {
      const woodMat = new THREE.MeshLambertMaterial({ color: 0x854d0e });
      let headColor = 0x854d0e;
      let emissive = 0x000000;
      if (id === ItemId.STONE_PICKAXE) headColor = 0x78716c;
      else if (id === ItemId.IRON_PICKAXE) headColor = 0xe2e8f0;
      else if (id === ItemId.DIAMOND_PICKAXE) {
        headColor = 0x38e1d4;
        emissive = 0x0ea5e9;
      }

      const headMat = new THREE.MeshLambertMaterial({
        color: headColor,
        emissive: new THREE.Color(emissive),
        emissiveIntensity: emissive ? 0.35 : 0,
      });

      // Shaft
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.44, 0.035), woodMat);
      shaft.position.y = 0.05;
      this.toolContainer.add(shaft);

      // Iron band collar
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.045), new THREE.MeshLambertMaterial({ color: 0x334155 }));
      collar.position.y = 0.22;
      this.toolContainer.add(collar);

      // Pick center block
      const center = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.06), headMat);
      center.position.y = 0.24;
      this.toolContainer.add(center);

      // Left curved pick
      const leftPick = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.04), headMat);
      leftPick.position.set(-0.08, 0.23, 0);
      leftPick.rotation.z = -0.25;
      this.toolContainer.add(leftPick);

      // Right curved pick
      const rightPick = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.04), headMat);
      rightPick.position.set(0.08, 0.23, 0);
      rightPick.rotation.z = 0.25;
      this.toolContainer.add(rightPick);
    }
    // 2. Swords (3D crossguard, grip, and double-edged blade)
    else if (id === ItemId.WOODEN_SWORD || id === ItemId.STONE_SWORD || id === ItemId.IRON_SWORD) {
      let bladeColor = 0xe2e8f0;
      if (id === ItemId.WOODEN_SWORD) bladeColor = 0xa16207;
      if (id === ItemId.STONE_SWORD) bladeColor = 0x78716c;

      const bladeMat = new THREE.MeshLambertMaterial({ color: bladeColor });
      const hiltMat = new THREE.MeshLambertMaterial({ color: 0x451a03 });
      const guardMat = new THREE.MeshLambertMaterial({ color: 0xca8a04 });

      // Handle grip
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.15, 0.035), hiltMat);
      grip.position.y = -0.05;
      this.toolContainer.add(grip);

      // Pommel
      const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), guardMat);
      pommel.position.y = -0.13;
      this.toolContainer.add(pommel);

      // Crossguard
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.05), guardMat);
      guard.position.y = 0.03;
      this.toolContainer.add(guard);

      // Blade
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.44, 0.02), bladeMat);
      blade.position.y = 0.26;
      this.toolContainer.add(blade);
    }
    // 3. Axes (3D curved haft and wedge blade)
    else if (id === ItemId.WOODEN_AXE || id === ItemId.STONE_AXE || id === ItemId.IRON_AXE) {
      const woodMat = new THREE.MeshLambertMaterial({ color: 0x854d0e });
      let headColor = id === ItemId.IRON_AXE ? 0xe2e8f0 : id === ItemId.STONE_AXE ? 0x78716c : 0xa16207;
      const headMat = new THREE.MeshLambertMaterial({ color: headColor });

      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.44, 0.035), woodMat);
      shaft.position.y = 0.05;
      this.toolContainer.add(shaft);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.04), headMat);
      blade.position.set(0.06, 0.22, 0);
      this.toolContainer.add(blade);
    }
    // 4. Torch (burning 3D post with glowing flame cube)
    else if (id === BlockType.TORCH) {
      const woodMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
      const coalMat = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.36, 0.04), woodMat);
      this.toolContainer.add(stick);

      const coal = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.05), coalMat);
      coal.position.y = 0.16;
      this.toolContainer.add(coal);

      const flame = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.08, 0.065), flameMat);
      flame.position.y = 0.22;
      this.toolContainer.add(flame);
    }
    // 5. Apple (3D red apple with stalk and leaf)
    else if (id === ItemId.APPLE) {
      const appleMat = new THREE.MeshLambertMaterial({ color: 0xdc2626 });
      const stalkMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
      const leafMat = new THREE.MeshLambertMaterial({ color: 0x22c55e });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), appleMat);
      this.toolContainer.add(body);

      const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), stalkMat);
      stalk.position.y = 0.08;
      this.toolContainer.add(stalk);

      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.01), leafMat);
      leaf.position.set(0.02, 0.09, 0);
      this.toolContainer.add(leaf);
    }
    // 6. Generic Mini Voxel Block in hand
    else if (info?.isBlock) {
      const blockMat = new THREE.MeshLambertMaterial({ color: 0x10b981 });
      const miniCube = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), blockMat);
      miniCube.position.set(0, 0.05, 0);
      this.toolContainer.add(miniCube);
    }
    // 7. General Items (Iron Ingot, Wool, Meat)
    else {
      let col = 0xffffff;
      if (id === ItemId.RAW_PORKCHOP) col = 0xf43f5e;
      else if (id === ItemId.COOKED_PORKCHOP) col = 0xb45309;
      else if (id === ItemId.IRON_INGOT) col = 0xd1d5db;
      else if (id === ItemId.COAL) col = 0x262626;
      else if (id === ItemId.DIAMOND) col = 0x38bdf8;
      else if (id === ItemId.STICK) col = 0x854d0e;

      const itemMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.28, 0.04),
        new THREE.MeshLambertMaterial({ color: col })
      );
      itemMesh.position.set(0, 0.04, 0);
      this.toolContainer.add(itemMesh);
    }
  }

  public triggerSwing() {
    this.isSwinging = true;
    this.swingProgress = 0;
  }

  public takeDamage(amount: number, knockbackDir?: THREE.Vector3) {
    if (this.gameMode === 'creative') return;
    if (this.invulnerableTimer > 0) return; // Prevent rapid-fire / instant death damage

    this.health = Math.max(0, this.health - amount);
    this.invulnerableTimer = 0.6; // 0.6s grace period
    this.hurtTimer = 0.45; // Screen vignette flash
    sounds.playHurt();

    if (knockbackDir) {
      this.applyKnockback(knockbackDir, 5.0);
    }
  }

  public applyKnockback(dir: THREE.Vector3, force: number = 5.0) {
    this.velocity.x += dir.x * force;
    this.velocity.z += dir.z * force;
    this.velocity.y = Math.max(this.velocity.y, 3.5);
  }

  public eatFood(restoreAmount: number) {
    if (this.hunger < this.maxHunger) {
      this.hunger = Math.min(this.maxHunger, this.hunger + restoreAmount);
      sounds.playEat();
      return true;
    }
    return false;
  }

  public respawn() {
    const spawnX = Math.floor(this.world.sizeX / 2) + 0.5;
    const spawnZ = Math.floor(this.world.sizeZ / 2) + 0.5;
    let spawnY = 16;
    for (let y = this.world.sizeY - 1; y >= 0; y--) {
      if (this.world.getBlock(Math.floor(spawnX), y, Math.floor(spawnZ)) !== BlockType.AIR) {
        spawnY = y + 2;
        break;
      }
    }
    this.position.set(spawnX, spawnY, spawnZ);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.oxygen = this.maxOxygen;
  }

  public update(
    dt: number,
    moveInput: { x: number; z: number }, // x: strafe (-1 to 1), z: forward (-1 to 1)
    jumpPressed: boolean,
    crouchPressed: boolean
  ) {
    this.isCrouching = crouchPressed;

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
    }

    // Check if player is in water
    const blockAtFeet = this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y),
      Math.floor(this.position.z)
    );
    const blockAtHead = this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 1.2),
      Math.floor(this.position.z)
    );
    const wasInWater = this.inWater;
    this.inWater = blockAtFeet === BlockType.WATER || blockAtHead === BlockType.WATER;

    // Realistic water entry/exit splash
    if (this.inWater !== wasInWater) {
      sounds.playWaterSplash();
    }
    // Realistic submerged acoustic muffling
    sounds.setUnderwater(blockAtHead === BlockType.WATER);

    // Water breathing / drowning
    if (blockAtHead === BlockType.WATER) {
      this.drownTimer += dt;
      if (this.drownTimer >= 1.0) {
        this.drownTimer = 0;
        this.oxygen = Math.max(0, this.oxygen - 1);
        if (this.oxygen <= 0) {
          this.takeDamage(2);
        }
      }
    } else {
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + dt * 8);
      this.drownTimer = 0;
    }

    // Hunger drain and natural health regeneration
    this.hungerTimer += dt;
    if (this.hungerTimer >= 12.0) {
      this.hungerTimer = 0;
      if (this.gameMode === 'survival') {
        this.hunger = Math.max(0, this.hunger - 1);
      }
    }

    if (this.hunger >= 18 && this.health < this.maxHealth) {
      this.regenTimer += dt;
      if (this.regenTimer >= 4.0) {
        this.regenTimer = 0;
        this.health = Math.min(this.maxHealth, this.health + 1);
      }
    } else if (this.hunger === 0) {
      this.regenTimer += dt;
      if (this.regenTimer >= 3.0) {
        this.regenTimer = 0;
        this.takeDamage(1); // Starvation
      }
    }

    // Horizontal Movement
    const moveSpeed = this.inWater ? 3.0 : this.isCrouching ? 2.5 : 5.0;
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.y);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.y);

    const moveVector = new THREE.Vector3();
    moveVector.addScaledVector(forward, -moveInput.z);
    moveVector.addScaledVector(right, moveInput.x);

    if (moveVector.lengthSq() > 0) {
      moveVector.normalize();
      this.velocity.x = moveVector.x * moveSpeed;
      this.velocity.z = moveVector.z * moveSpeed;

      // Footstep sounds
      if (this.isGrounded && !this.inWater) {
        this.stepSoundTimer += dt;
        if (this.stepSoundTimer >= (this.isCrouching ? 0.6 : 0.38)) {
          this.stepSoundTimer = 0;
          const underBlock = this.world.getBlock(
            Math.floor(this.position.x),
            Math.floor(this.position.y - 0.2),
            Math.floor(this.position.z)
          );
          if (underBlock === BlockType.STONE || underBlock === BlockType.COBBLESTONE) {
            sounds.playStep('stone');
          } else if (underBlock === BlockType.OAK_WOOD || underBlock === BlockType.OAK_PLANKS) {
            sounds.playStep('wood');
          } else {
            sounds.playStep('grass');
          }
        }
      }
    } else {
      // Damping
      this.velocity.x *= 0.6;
      this.velocity.z *= 0.6;
    }

    // Vertical physics (Gravity & Jump)
    if (this.inWater) {
      if (jumpPressed) {
        this.velocity.y = 3.5; // Swim up
      } else if (crouchPressed) {
        this.velocity.y = -3.5; // Sink down
      } else {
        this.velocity.y = -0.8; // Gentle drift
      }
    } else {
      const gravity = 22.0;
      this.velocity.y -= gravity * dt;

      if (this.isGrounded && jumpPressed) {
        this.velocity.y = 8.5; // Jump
        this.isGrounded = false;
        sounds.playJump();
      }
    }

    // Fall damage tracking
    if (!this.isGrounded && !this.inWater) {
      if (!this.wasInAir) {
        this.wasInAir = true;
        this.highestYDuringFall = this.position.y;
      } else {
        if (this.position.y > this.highestYDuringFall) {
          this.highestYDuringFall = this.position.y;
        }
      }
    }

    // AABB Separation Collision
    this.moveWithCollision(dt);

    // Check landing fall damage
    if (this.isGrounded && this.wasInAir) {
      const fallDistance = this.highestYDuringFall - this.position.y;
      if (fallDistance > 3.5 && !this.inWater) {
        const damage = Math.floor((fallDistance - 3.0) * 1.5);
        if (damage > 0) {
          this.takeDamage(damage);
        }
      }
      this.wasInAir = false;
      this.highestYDuringFall = this.position.y;
    }

    // Edge-safe sneaking: if crouching and grounded, don't fall off ledges
    if (this.isCrouching && this.isGrounded) {
      this.constrainCrouchEdges();
    }

    // Realistic Camera position with dynamic head bobbing
    const currentEyeHeight = this.isCrouching ? this.crouchEyeHeight : this.eyeHeight;
    let bobY = 0;
    if (moveVector.lengthSq() > 0 && this.isGrounded && !this.inWater) {
      this.bobTimer += dt * 9;
      bobY = Math.sin(this.bobTimer) * (this.isCrouching ? 0.015 : 0.035);
    } else {
      this.bobTimer = 0;
    }

    this.camera.position.set(this.position.x, this.position.y + currentEyeHeight + bobY, this.position.z);
    this.camera.rotation.copy(this.rotation);

    // Realistic strafe banking: camera banks slightly when moving left or right
    const targetRoll = -moveInput.x * 0.022;
    this.camera.rotation.z = THREE.MathUtils.lerp(this.camera.rotation.z, targetRoll, 0.2);

    // Realistic Hand swing and walking bobbing animation
    if (this.isSwinging) {
      this.swingProgress += dt * 6.5;
      if (this.swingProgress >= 1.0) {
        this.swingProgress = 0;
        this.isSwinging = false;
      }
      const swingAngle = Math.sin(this.swingProgress * Math.PI);
      this.handGroup.rotation.x = swingAngle * 0.85;
      this.handGroup.rotation.y = -swingAngle * 0.3;
      this.handGroup.rotation.z = -swingAngle * 0.45;
      this.handGroup.position.z = -swingAngle * 0.12;
    } else {
      // Walking bobbing & subtle sway
      if (moveVector.lengthSq() > 0 && this.isGrounded) {
        this.handGroup.position.y = Math.sin(this.bobTimer) * 0.02;
        this.handGroup.position.x = Math.cos(this.bobTimer * 0.5) * 0.015;
        this.handGroup.rotation.z = Math.sin(this.bobTimer * 0.5) * 0.025;
      } else {
        this.handGroup.position.set(0, 0, 0);
        this.handGroup.rotation.set(0, 0, 0);
      }
    }
  }

  // AABB Collision vs Voxel World
  private moveWithCollision(dt: number) {
    const halfW = this.width / 2;
    const curH = this.isCrouching ? this.crouchHeight : this.height;

    // X axis movement
    const dx = this.velocity.x * dt;
    if (dx !== 0) {
      const targetX = this.position.x + dx;
      if (!this.checkAABBCollision(targetX, this.position.y, this.position.z, halfW, curH)) {
        this.position.x = targetX;
      } else {
        this.velocity.x = 0;
      }
    }

    // Z axis movement
    const dz = this.velocity.z * dt;
    if (dz !== 0) {
      const targetZ = this.position.z + dz;
      if (!this.checkAABBCollision(this.position.x, this.position.y, targetZ, halfW, curH)) {
        this.position.z = targetZ;
      } else {
        this.velocity.z = 0;
      }
    }

    // Y axis movement
    const dy = this.velocity.y * dt;
    if (dy !== 0) {
      const targetY = this.position.y + dy;
      if (!this.checkAABBCollision(this.position.x, targetY, this.position.z, halfW, curH)) {
        this.position.y = targetY;
        this.isGrounded = false;
      } else {
        if (dy < 0) {
          // Hit ground
          this.isGrounded = true;
          this.position.y = Math.floor(targetY) + 1.0;
        } else {
          // Hit ceiling
          this.position.y = Math.ceil(targetY + curH) - curH - 0.001;
        }
        this.velocity.y = 0;
      }
    }

    // Map bounds clamp
    this.position.x = Math.max(1, Math.min(this.world.sizeX - 1, this.position.x));
    this.position.z = Math.max(1, Math.min(this.world.sizeZ - 1, this.position.z));
    if (this.position.y < -10) {
      // Void fall
      this.takeDamage(20);
      this.respawn();
    }
  }

  private checkAABBCollision(x: number, y: number, z: number, halfW: number, height: number): boolean {
    const minX = Math.floor(x - halfW);
    const maxX = Math.floor(x + halfW);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + height);
    const minZ = Math.floor(z - halfW);
    const maxZ = Math.floor(z + halfW);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const block = this.world.getBlock(bx, by, bz);
          // Solid blocks collide
          if (
            block !== BlockType.AIR &&
            block !== BlockType.WATER &&
            block !== BlockType.POPPY &&
            block !== BlockType.DANDELION
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private constrainCrouchEdges() {
    // If the block directly underneath the center of the player is air, nudge back
    const blockUnder = this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y - 0.1),
      Math.floor(this.position.z)
    );
    if (blockUnder === BlockType.AIR || blockUnder === BlockType.WATER) {
      // Pull player back towards safe center
      const prevX = Math.round(this.position.x) + 0.5;
      const prevZ = Math.round(this.position.z) + 0.5;
      this.position.x = THREE.MathUtils.lerp(this.position.x, prevX, 0.2);
      this.position.z = THREE.MathUtils.lerp(this.position.z, prevZ, 0.2);
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
  }

  // Update target wireframe and mining state
  public updateMiningAndTarget(
    dt: number,
    isMining: boolean,
    heldItem: InventorySlot | null,
    onBlockBroken: (pos: THREE.Vector3, type: BlockType) => void
  ) {
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(this.rotation);
    const ray = this.world.raycastVoxel(this.camera.position, dir, 5.0);

    if (ray && ray.hit) {
      // Show wireframe box on targeted block
      this.selectionBox.visible = true;
      this.selectionBox.position.set(ray.blockPos.x + 0.5, ray.blockPos.y + 0.5, ray.blockPos.z + 0.5);

      if (isMining) {
        this.triggerSwing();

        // Check if continuing same block or starting new one
        if (
          !this.currentMiningPos ||
          !this.currentMiningPos.equals(ray.blockPos)
        ) {
          this.currentMiningPos = ray.blockPos.clone();
          this.miningProgress = 0;
        }

        // Dig sound with metallic clink for ores
        this.digSoundTimer += dt;
        if (this.digSoundTimer >= 0.25) {
          this.digSoundTimer = 0;
          if (
            ray.blockType === BlockType.DIAMOND_ORE ||
            ray.blockType === BlockType.IRON_ORE
          ) {
            sounds.playOreHit();
          } else {
            sounds.playDig();
          }
        }

        // Calculate break speed based on tool
        const blockInfo = ITEM_REGISTRY[ray.blockType];
        const baseHardness = blockInfo?.hardness ?? 1.5;

        let toolMultiplier = 1.0;
        if (heldItem) {
          const itemInfo = ITEM_REGISTRY[heldItem.itemId];
          if (
            itemInfo &&
            itemInfo.preferredTool &&
            blockInfo?.preferredTool === itemInfo.preferredTool
          ) {
            toolMultiplier = (itemInfo.toolLevel || 1) * 3.5;
          }
        }

        // Creative mode instant break
        if (this.gameMode === 'creative') {
          toolMultiplier = 999;
        }

        const breakSpeed = (toolMultiplier / Math.max(0.1, baseHardness)) * 0.8;
        this.miningProgress += dt * breakSpeed;

        // Show break cracks
        this.breakOverlay.visible = true;
        this.breakOverlay.position.copy(this.selectionBox.position);
        const scale = 1.002 + this.miningProgress * 0.03;
        this.breakOverlay.scale.set(scale, scale, scale);

        if (this.miningProgress >= 1.0) {
          // Block broken!
          sounds.playBlockBreak();
          this.world.setBlock(ray.blockPos.x, ray.blockPos.y, ray.blockPos.z, BlockType.AIR);
          onBlockBroken(ray.blockPos, ray.blockType);

          this.currentMiningPos = null;
          this.miningProgress = 0;
          this.breakOverlay.visible = false;
        }
      } else {
        this.currentMiningPos = null;
        this.miningProgress = 0;
        this.breakOverlay.visible = false;
      }
    } else {
      this.selectionBox.visible = false;
      this.breakOverlay.visible = false;
      this.currentMiningPos = null;
      this.miningProgress = 0;
    }
  }

  public placeBlock(
    heldItem: InventorySlot | null,
    onBlockPlaced: (pos: THREE.Vector3, type: BlockType) => void
  ): boolean {
    if (!heldItem || heldItem.count <= 0) return false;

    const info = ITEM_REGISTRY[heldItem.itemId];
    if (!info?.isBlock || info.blockType === undefined) return false;

    const dir = new THREE.Vector3(0, 0, -1).applyEuler(this.rotation);
    const ray = this.world.raycastVoxel(this.camera.position, dir, 5.0);

    if (ray && ray.hit) {
      const targetPos = ray.placePos;

      // Don't place inside player AABB
      const halfW = this.width / 2;
      const curH = this.isCrouching ? this.crouchHeight : this.height;
      if (
        this.checkAABBCollisionWithBlock(
          this.position.x,
          this.position.y,
          this.position.z,
          halfW,
          curH,
          targetPos.x,
          targetPos.y,
          targetPos.z
        )
      ) {
        return false;
      }

      // Place block!
      this.world.setBlock(targetPos.x, targetPos.y, targetPos.z, info.blockType);
      sounds.playBlockPlace();
      this.triggerSwing();
      onBlockPlaced(targetPos, info.blockType);
      return true;
    }

    return false;
  }

  private checkAABBCollisionWithBlock(
    px: number,
    py: number,
    pz: number,
    halfW: number,
    height: number,
    bx: number,
    by: number,
    bz: number
  ): boolean {
    return (
      px + halfW > bx &&
      px - halfW < bx + 1 &&
      py + height > by &&
      py < by + 1 &&
      pz + halfW > bz &&
      pz - halfW < bz + 1
    );
  }
}
