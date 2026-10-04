import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { VoxelWorld, WORLD_SIZE_X, WORLD_SIZE_Z, WORLD_HEIGHT } from './game/world';
import { PlayerController } from './game/player';
import { EntityManager } from './game/entities';
import { BlockType, ItemId, AnyItemId, InventorySlot } from './game/types';
import { ITEM_REGISTRY } from './game/items';
import { sounds } from './game/audio';
import { RightTouchControls } from './components/RightTouchControls';
import { TouchLookPad } from './components/TouchLookPad';
import { HUD } from './components/HUD';
import { InventoryModal } from './components/InventoryModal';
import { HelpModal } from './components/HelpModal';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Core Game Engine References
  const gameRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    world: VoxelWorld;
    player: PlayerController;
    entities: EntityManager;
    dirLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
    torchLight: THREE.PointLight;
    cloudGroup: THREE.Group;
    cloudMat: THREE.MeshLambertMaterial;
    sunMesh: THREE.Mesh;
    moonMesh: THREE.Mesh;
    stars: THREE.Points;
  } | null>(null);

  // Player & Game State
  const [health, setHealth] = useState(20);
  const [maxHealth] = useState(20);
  const [hunger, setHunger] = useState(20);
  const [maxHunger] = useState(20);
  const [oxygen, setOxygen] = useState(20);
  const [maxOxygen] = useState(20);
  const [gameMode, setGameMode] = useState<'survival' | 'creative'>('survival');
  const [difficulty, setDifficulty] = useState<'peaceful' | 'easy' | 'normal'>('easy');
  const [graphicsMode, setGraphicsMode] = useState<'performance' | 'quality'>('performance');
  const [isMuted, setIsMuted] = useState(false);
  const [isNight, setIsNight] = useState(false);

  const difficultyRef = useRef<'peaceful' | 'easy' | 'normal'>('easy');
  difficultyRef.current = difficulty;

  // Throttled sync refs to prevent React 60 FPS re-render thrashing
  const lastHealthRef = useRef(20);
  const lastHungerRef = useRef(20);
  const lastOxygenRef = useRef(20);
  const lastIsNightRef = useRef(false);
  const zombieTimerRef = useRef(0);
  const peacefulHealTimerRef = useRef(0);

  // Modals
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isCraftingTableOpen, setIsCraftingTableOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Inventory & Hotbar
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hotbar, setHotbar] = useState<(InventorySlot | null)[]>([
    { itemId: ItemId.WOODEN_PICKAXE, count: 1, durability: 60 },
    { itemId: ItemId.WOODEN_SWORD, count: 1, durability: 60 },
    { itemId: ItemId.WOODEN_AXE, count: 1, durability: 60 },
    { itemId: BlockType.OAK_PLANKS, count: 24 },
    { itemId: BlockType.TORCH, count: 12 },
    { itemId: ItemId.APPLE, count: 6 },
    { itemId: BlockType.COBBLESTONE, count: 16 },
    null,
    null,
  ]);
  const [inventory, setInventory] = useState<(InventorySlot | null)[]>(
    new Array(27).fill(null)
  );

  // Control Inputs
  const inputRef = useRef({
    move: { x: 0, z: 0 },
    jump: false,
    crouch: false,
    isMining: false,
    keys: {} as Record<string, boolean>,
  });

  const selectedSlot = hotbar[selectedIndex];
  const isHoldingFood = Boolean(selectedSlot && ITEM_REGISTRY[selectedSlot.itemId]?.foodRestore);

  // Initialize Three.js Game Scene
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x72a4e8);
    scene.fog = new THREE.FogExp2(0x72a4e8, 0.025);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 150);

    // 3. Renderer - Optimized for smooth 60 FPS and low device temperature
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: false,
      powerPreference: 'high-performance',
      precision: 'mediump',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
    // Shadows disabled by default for maximum FPS & zero thermal throttling
    renderer.shadowMap.enabled = false;

    // 4. Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444455, 0.75);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.0);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = false;
    scene.add(dirLight);

    // 5. Sun & Moon in Sky with realistic atmospheric coronas
    const sunGeo = new THREE.PlaneGeometry(8, 8);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff0aa, side: THREE.DoubleSide });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    // Sun corona glow
    const sunGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshBasicMaterial({ color: 0xffdf88, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    sunGlow.position.z = -0.1;
    sunMesh.add(sunGlow);
    scene.add(sunMesh);

    const moonGeo = new THREE.PlaneGeometry(6, 6);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeffff, side: THREE.DoubleSide });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    // Moon halo
    const moonGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
    );
    moonGlow.position.z = -0.1;
    moonMesh.add(moonGlow);
    scene.add(moonMesh);

    // 6. Stars for Night
    const starGeo = new THREE.BufferGeometry();
    const starCount = 350;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 90;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi));
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, transparent: true });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // 7. Volumetric 3D Fluffy Clouds (Realism Shaders Cloud Layer)
    const cloudGroup = new THREE.Group();
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
    });
    const cloudBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    const maxCloudBlocks = 350;
    const instancedClouds = new THREE.InstancedMesh(cloudBoxGeo, cloudMat, maxCloudBlocks);
    instancedClouds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const cMat = new THREE.Matrix4();
    let cloudCount = 0;
    for (let c = 0; c < 10; c++) {
      const cx = (Math.random() - 0.5) * WORLD_SIZE_X * 2.2;
      const cz = (Math.random() - 0.5) * WORLD_SIZE_Z * 2.2;
      const cy = 25 + (c % 2) * 1.5;
      const cw = 4 + Math.floor(Math.random() * 5);
      const cd = 4 + Math.floor(Math.random() * 5);

      for (let x = 0; x < cw; x++) {
        for (let z = 0; z < cd; z++) {
          if ((x === 0 || x === cw - 1) && (z === 0 || z === cd - 1) && Math.random() < 0.6) continue;
          if (cloudCount < maxCloudBlocks) {
            cMat.makeTranslation(cx + x * 3.2, cy, cz + z * 3.2);
            cMat.scale(new THREE.Vector3(3.2, 1.2, 3.2));
            instancedClouds.setMatrixAt(cloudCount++, cMat);
          }
        }
      }
    }
    instancedClouds.count = cloudCount;
    instancedClouds.instanceMatrix.needsUpdate = true;
    cloudGroup.add(instancedClouds);
    scene.add(cloudGroup);

    // 8. Dynamic Torch Point Light (Realism Torch Glow in Caves and Hand)
    const torchLight = new THREE.PointLight(0xffa144, 0, 16, 1.8);
    scene.add(torchLight);

    // 9. Voxel World, Player Controller, Entity Manager
    const world = new VoxelWorld(scene);
    const player = new PlayerController(scene, camera, world);
    const entities = new EntityManager(scene, world);

    gameRef.current = {
      renderer,
      scene,
      camera,
      world,
      player,
      entities,
      dirLight,
      hemiLight,
      torchLight,
      cloudGroup,
      cloudMat,
      sunMesh,
      moonMesh,
      stars,
    };

    // Update held item viewmodel
    player.updateHeldItem(hotbar[0]);

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Main Game Animation Loop
    let lastTime = performance.now();
    let animId: number;
    let timeAccumulator = 0;
    let dayCycleTime = 0.25; // 0.25 = midday

    // Pre-allocated reusable colors (0 GC allocations per frame!)
    const daySkyColor = new THREE.Color(0x72a4e8);
    const sunsetSkyColor = new THREE.Color(0xd47748);
    const nightSkyColor = new THREE.Color(0x0a0e1c);
    const currentSkyColor = new THREE.Color();

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      timeAccumulator += dt;

      // Day / Night cycle progression (5-minute full cycle)
      dayCycleTime = (dayCycleTime + dt / 300) % 1.0;
      const isNightNow = dayCycleTime > 0.45 && dayCycleTime < 0.95;
      if (isNightNow !== lastIsNightRef.current) {
        lastIsNightRef.current = isNightNow;
        setIsNight(isNightNow);
      }

      // Drift Volumetric 3D Clouds (Realism Shader Atmosphere)
      cloudGroup.position.x += dt * 0.5;
      if (cloudGroup.position.x > 80) cloudGroup.position.x = -80;

      // Celestial position calculations
      const sunAngle = dayCycleTime * Math.PI * 2;
      const sunDist = 70;
      const sunX = player.position.x + Math.sin(sunAngle) * sunDist;
      const sunY = player.position.y + Math.cos(sunAngle) * sunDist;
      const sunZ = player.position.z + 10;

      sunMesh.position.set(sunX, sunY, sunZ);
      sunMesh.lookAt(player.position);

      const moonX = player.position.x - Math.sin(sunAngle) * sunDist;
      const moonY = player.position.y - Math.cos(sunAngle) * sunDist;
      const moonZ = player.position.z - 10;
      moonMesh.position.set(moonX, moonY, moonZ);
      moonMesh.lookAt(player.position);

      dirLight.position.set(sunX, sunY, sunZ);
      dirLight.target.position.copy(player.position);

      // Sky and lighting color based on sun height
      const sunElevation = Math.cos(sunAngle);
      if (sunElevation > 0.1) {
        // Daytime
        const t = Math.min(1, sunElevation * 2);
        currentSkyColor.copy(sunsetSkyColor).lerp(daySkyColor, t);
        scene.background = currentSkyColor;
        if (scene.fog) scene.fog.color = currentSkyColor;
        hemiLight.intensity = 0.6 + t * 0.4;
        dirLight.intensity = 0.4 + t * 0.8;
        stars.visible = false;
        cloudMat.color.copy(currentSkyColor).lerp(new THREE.Color(0xffffff), 0.65);
      } else if (sunElevation > -0.1) {
        // Sunset / Sunrise transition
        scene.background = sunsetSkyColor;
        if (scene.fog) scene.fog.color = sunsetSkyColor;
        hemiLight.intensity = 0.4;
        dirLight.intensity = 0.3;
        stars.visible = true;
        cloudMat.color.copy(sunsetSkyColor).lerp(new THREE.Color(0xffe4b5), 0.5);
      } else {
        // Nighttime
        scene.background = nightSkyColor;
        if (scene.fog) scene.fog.color = nightSkyColor;
        hemiLight.intensity = 0.15;
        dirLight.intensity = 0.1;
        stars.visible = true;
        cloudMat.color.copy(nightSkyColor).lerp(new THREE.Color(0x223355), 0.4);

        // Controlled night zombie spawn (every 14s, not every frame)
        if (difficultyRef.current !== 'peaceful') {
          zombieTimerRef.current += dt;
          if (zombieTimerRef.current >= 14.0) {
            zombieTimerRef.current = 0;
            entities.spawnNightZombie(player.position);
          }
        }
      }

      // Dynamic Torchlight: Realism mod held torch illumination
      const isHoldingTorch = hotbar[selectedIndex]?.itemId === BlockType.TORCH;
      if (isHoldingTorch) {
        const flicker = Math.sin(now * 0.014) * 0.15;
        torchLight.intensity = 1.9 + flicker;
        torchLight.position.copy(player.camera.position);
      } else {
        torchLight.intensity = 0;
      }

      // Underwater visual atmosphere
      const blockAtHead = world.getBlock(
        Math.floor(player.position.x),
        Math.floor(player.position.y + 1.2),
        Math.floor(player.position.z)
      );
      if (blockAtHead === BlockType.WATER) {
        const deepWater = new THREE.Color(0x0e4566);
        scene.background = deepWater;
        if (scene.fog) {
          scene.fog.color = deepWater;
          (scene.fog as THREE.FogExp2).density = 0.075;
        }
      } else {
        if (scene.fog && scene.fog.color !== currentSkyColor) {
          (scene.fog as THREE.FogExp2).density = 0.025;
        }
      }

      // Footstep dust & water splashes when moving on ground
      if (player.velocity.lengthSq() > 3.0 && player.isGrounded) {
        if (Math.random() < 0.18) {
          entities.spawnFootstepDust(player.position, player.inWater);
        }
      }

      // Peaceful mode health regeneration
      if (difficultyRef.current === 'peaceful' && player.health < player.maxHealth) {
        peacefulHealTimerRef.current += dt;
        if (peacefulHealTimerRef.current >= 2.0) {
          peacefulHealTimerRef.current = 0;
          player.health = Math.min(player.maxHealth, player.health + 1);
        }
      }

      // Input amalgamation (keyboard + touch)
      const input = inputRef.current;
      let moveX = input.move.x;
      let moveZ = input.move.z;

      // Keyboard WASD
      if (input.keys['KeyW'] || input.keys['ArrowUp']) moveZ -= 1;
      if (input.keys['KeyS'] || input.keys['ArrowDown']) moveZ += 1;
      if (input.keys['KeyA'] || input.keys['ArrowLeft']) moveX -= 1;
      if (input.keys['KeyD'] || input.keys['ArrowRight']) moveX += 1;

      // Clamp movement input
      const moveMag = Math.hypot(moveX, moveZ);
      if (moveMag > 1) {
        moveX /= moveMag;
        moveZ /= moveMag;
      }

      const isJumping = input.jump || Boolean(input.keys['Space']);
      const isCrouching = input.crouch || Boolean(input.keys['ShiftLeft'] || input.keys['ShiftRight']);

      // Update Player Controller
      player.update(dt, { x: moveX, z: moveZ }, isJumping, isCrouching);

      // Update Block Target & Mining
      const currentHeldSlot = hotbar[selectedIndex];
      player.updateMiningAndTarget(
        dt,
        input.isMining,
        currentHeldSlot,
        (pos, blockType) => {
          // Block broken callback: drop loot & spawn type-specific particles
          const info = ITEM_REGISTRY[blockType];
          const dropId = info?.dropId ?? blockType;
          const dropCount = info?.dropCount ?? 1;

          entities.spawnBlockBreakParticles(pos, blockType);
          entities.spawnDrop(dropId, dropCount, pos);
        }
      );

      // Update Entities, Mobs & Item Pickups
      entities.update(
        dt,
        player.position,
        (damage, knockbackDir) => {
          player.takeDamage(damage, knockbackDir);
        },
        (itemId, count) => {
          // Pickup item: add to hotbar or inventory
          let remaining = count;
          let added = false;
          setHotbar((prev) => {
            const next = [...prev];
            for (let i = 0; i < next.length; i++) {
              if (next[i] && next[i]!.itemId === itemId && next[i]!.count < 64) {
                const add = Math.min(remaining, 64 - next[i]!.count);
                next[i] = { ...next[i]!, count: next[i]!.count + add };
                remaining -= add;
                added = true;
                if (remaining <= 0) break;
              }
            }
            if (remaining > 0) {
              for (let i = 0; i < next.length; i++) {
                if (!next[i]) {
                  next[i] = { itemId, count: remaining };
                  remaining = 0;
                  added = true;
                  break;
                }
              }
            }
            return next;
          });

          if (remaining > 0) {
            setInventory((prev) => {
              const next = [...prev];
              for (let i = 0; i < next.length; i++) {
                if (next[i] && next[i]!.itemId === itemId && next[i]!.count < 64) {
                  const add = Math.min(remaining, 64 - next[i]!.count);
                  next[i] = { ...next[i]!, count: next[i]!.count + add };
                  remaining -= add;
                  added = true;
                  if (remaining <= 0) break;
                }
              }
              if (remaining > 0) {
                for (let i = 0; i < next.length; i++) {
                  if (!next[i]) {
                    next[i] = { itemId, count: remaining };
                    remaining = 0;
                    added = true;
                    break;
                  }
                }
              }
              return next;
            });
          }
          return added;
        },
        difficultyRef.current
      );

      // Direct DOM updates for zero React frame drop:
      // 1. Hurt vignette
      const hurtEl = document.getElementById('hurt-vignette');
      if (hurtEl) {
        const op = player.hurtTimer > 0 ? '0.75' : '0';
        if (hurtEl.style.opacity !== op) hurtEl.style.opacity = op;
      }

      // 2. Mining progress bar
      const mContainer = document.getElementById('mining-progress-container');
      const mBar = document.getElementById('mining-progress-bar');
      if (mContainer && mBar) {
        if (player.miningProgress > 0) {
          mContainer.style.display = 'flex';
          mBar.style.width = `${Math.min(100, player.miningProgress * 100)}%`;
        } else if (mContainer.style.display !== 'none') {
          mContainer.style.display = 'none';
        }
      }

      // Throttled sync state to React - only when values actually change
      if (player.health !== lastHealthRef.current) {
        lastHealthRef.current = player.health;
        setHealth(player.health);
      }
      if (player.hunger !== lastHungerRef.current) {
        lastHungerRef.current = player.hunger;
        setHunger(player.hunger);
      }
      const roundedOxygen = Math.round(player.oxygen);
      if (roundedOxygen !== lastOxygenRef.current) {
        lastOxygenRef.current = roundedOxygen;
        setOxygen(roundedOxygen);
      }

      // Render
      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Update held item model when hotbar or selectedIndex changes
  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.player.updateHeldItem(hotbar[selectedIndex]);
    }
  }, [selectedIndex, hotbar]);

  // Update gameMode
  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.player.gameMode = gameMode;
    }
  }, [gameMode]);

  // Sound mute state
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    sounds.setMuted(next);
  };

  // Keyboard Event Listeners (WASD, 1-9, E, Space, Shift)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If modal open, allow Escape or E to close
      if (isInventoryOpen || isHelpOpen) {
        if (e.code === 'KeyE' || e.code === 'Escape') {
          setIsInventoryOpen(false);
          setIsHelpOpen(false);
        }
        return;
      }

      inputRef.current.keys[e.code] = true;

      if (e.code === 'KeyE') {
        e.preventDefault();
        setIsCraftingTableOpen(false);
        setIsInventoryOpen(true);
      } else if (e.code === 'Escape') {
        setIsHelpOpen((v) => !v);
      } else if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 9) {
          setSelectedIndex(num - 1);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      inputRef.current.keys[e.code] = false;
    };

    const handleWheel = (e: WheelEvent) => {
      if (isInventoryOpen || isHelpOpen) return;
      if (e.deltaY > 0) {
        setSelectedIndex((prev) => (prev + 1) % 9);
      } else if (e.deltaY < 0) {
        setSelectedIndex((prev) => (prev - 1 + 9) % 9);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('wheel', handleWheel);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [isInventoryOpen, isHelpOpen]);

  // Mouse Click & Pointer Lock for Desktop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (isInventoryOpen || isHelpOpen) return;

      // Request pointer lock on desktop click
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }

      if (e.button === 0) {
        // Left click: Mine or Attack mob
        const player = gameRef.current?.player;
        const entities = gameRef.current?.entities;
        if (player && entities) {
          const dir = new THREE.Vector3(0, 0, -1).applyEuler(player.rotation);
          const currentHeldSlot = hotbar[selectedIndex];
          const weaponDmg = currentHeldSlot
            ? ITEM_REGISTRY[currentHeldSlot.itemId]?.attackDamage || 1
            : 1;

          const hitMob = entities.hitMobAt(player.camera.position, dir, weaponDmg);
          if (hitMob) {
            player.triggerSwing();
          } else {
            inputRef.current.isMining = true;
          }
        }
      } else if (e.button === 2) {
        // Right click: Place block or interact
        handlePlaceBlock();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        inputRef.current.isMining = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas && gameRef.current) {
        const player = gameRef.current.player;
        const sens = 0.0025;
        player.rotation.y -= e.movementX * sens;
        player.rotation.x -= e.movementY * sens;
        player.rotation.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.rotation.x));
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isInventoryOpen, isHelpOpen, selectedIndex, hotbar]);

  // Place Block or Interact with Crafting Table / Chest
  const handlePlaceBlock = useCallback(() => {
    const player = gameRef.current?.player;
    const world = gameRef.current?.world;
    if (!player || !world) return;

    // First check if player is targeting a Crafting Table block
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(player.rotation);
    const ray = world.raycastVoxel(player.camera.position, dir, 4.5);

    if (ray && ray.hit) {
      if (ray.blockType === BlockType.CRAFTING_TABLE) {
        setIsCraftingTableOpen(true);
        setIsInventoryOpen(true);
        return;
      }
    }

    const curSlot = hotbar[selectedIndex];
    if (!curSlot) return;

    const success = player.placeBlock(curSlot, (pos, type) => {
      // Decrease item from hotbar
      setHotbar((prev) => {
        const next = [...prev];
        const s = next[selectedIndex];
        if (s && gameMode === 'survival') {
          if (s.count <= 1) {
            next[selectedIndex] = null;
          } else {
            next[selectedIndex] = { ...s, count: s.count - 1 };
          }
        }
        return next;
      });
    });
  }, [selectedIndex, hotbar, gameMode]);

  // Eat held food
  const handleEat = () => {
    const curSlot = hotbar[selectedIndex];
    if (!curSlot) return;
    const info = ITEM_REGISTRY[curSlot.itemId];
    if (!info?.foodRestore) return;

    const player = gameRef.current?.player;
    if (player) {
      const ate = player.eatFood(info.foodRestore);
      if (ate) {
        setHotbar((prev) => {
          const next = [...prev];
          const s = next[selectedIndex];
          if (s && gameMode === 'survival') {
            if (s.count <= 1) next[selectedIndex] = null;
            else next[selectedIndex] = { ...s, count: s.count - 1 };
          }
          return next;
        });
      }
    }
  };

  // Touch Camera Look Drag
  const handleLookDelta = useCallback((deltaYaw: number, deltaPitch: number) => {
    if (gameRef.current) {
      const player = gameRef.current.player;
      player.rotation.y += deltaYaw;
      player.rotation.x += deltaPitch;
      player.rotation.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.rotation.x));
    }
  }, []);

  const handleSelectSlot = useCallback((idx: number) => {
    setSelectedIndex(idx);
  }, []);

  const handleOpenInventory = useCallback(() => {
    setIsCraftingTableOpen(false);
    setIsInventoryOpen(true);
  }, []);

  const handleToggleGameMode = useCallback(() => {
    setGameMode((prev) => (prev === 'survival' ? 'creative' : 'survival'));
  }, []);

  const handleToggleDifficulty = useCallback(() => {
    setDifficulty((prev) => {
      const next = prev === 'peaceful' ? 'easy' : prev === 'easy' ? 'normal' : 'peaceful';
      difficultyRef.current = next;
      return next;
    });
  }, []);

  const handleToggleGraphicsMode = useCallback(() => {
    setGraphicsMode((prev) => {
      const next = prev === 'performance' ? 'quality' : 'performance';
      if (gameRef.current) {
        const renderer = gameRef.current.renderer;
        const dirLight = gameRef.current.dirLight;
        if (next === 'performance') {
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
          renderer.shadowMap.enabled = false;
          dirLight.castShadow = false;
        } else {
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
          renderer.shadowMap.enabled = true;
          dirLight.castShadow = true;
        }
      }
      return next;
    });
  }, []);

  const handleOpenHelp = useCallback(() => {
    setIsHelpOpen(true);
  }, []);

  const handleTouchMove = useCallback((m: { x: number; z: number }) => {
    inputRef.current.move = m;
  }, []);

  const handleTouchJump = useCallback((j: boolean) => {
    inputRef.current.jump = j;
  }, []);

  const handleTouchCrouch = useCallback((c: boolean) => {
    inputRef.current.crouch = c;
  }, []);

  const handleTouchMineStart = useCallback(() => {
    const player = gameRef.current?.player;
    const entities = gameRef.current?.entities;
    if (player && entities) {
      const dir = new THREE.Vector3(0, 0, -1).applyEuler(player.rotation);
      const currentHeldSlot = hotbar[selectedIndex];
      const weaponDmg = currentHeldSlot
        ? ITEM_REGISTRY[currentHeldSlot.itemId]?.attackDamage || 1
        : 1;

      const hitMob = entities.hitMobAt(player.camera.position, dir, weaponDmg);
      if (hitMob) {
        player.triggerSwing();
        return;
      }
    }
    inputRef.current.isMining = true;
  }, [hotbar, selectedIndex]);

  const handleTouchMineEnd = useCallback(() => {
    inputRef.current.isMining = false;
  }, []);

  // Respawn Handler
  const handleRespawn = useCallback(() => {
    if (gameRef.current) {
      gameRef.current.player.respawn();
      setHealth(20);
      setHunger(20);
    }
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-black select-none">
      {/* 3D WebGL Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block touch-none cursor-crosshair" />

      {/* Touch Camera Look Pad (covers screen except right controls) */}
      <TouchLookPad onLookDelta={handleLookDelta} />

      {/* Main Minecraft HUD Overlay */}
      <HUD
        health={health}
        maxHealth={maxHealth}
        hunger={hunger}
        maxHunger={maxHunger}
        oxygen={oxygen}
        maxOxygen={maxOxygen}
        hotbar={hotbar}
        selectedIndex={selectedIndex}
        onSelectSlot={handleSelectSlot}
        onOpenInventory={handleOpenInventory}
        gameMode={gameMode}
        onToggleGameMode={handleToggleGameMode}
        difficulty={difficulty}
        onToggleDifficulty={handleToggleDifficulty}
        graphicsMode={graphicsMode}
        onToggleGraphicsMode={handleToggleGraphicsMode}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        isNight={isNight}
        onOpenHelp={handleOpenHelp}
      />

      {/* Right-Side Touch Controls (Joystick, Crouch, Jump, Hand/Mine, Place) */}
      <RightTouchControls
        onMove={handleTouchMove}
        onJump={handleTouchJump}
        onCrouch={handleTouchCrouch}
        onMineStart={handleTouchMineStart}
        onMineEnd={handleTouchMineEnd}
        onPlace={handlePlaceBlock}
        onEat={handleEat}
        isHoldingFood={isHoldingFood}
      />

      {/* Inventory & Crafting Modal */}
      <InventoryModal
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        inventory={inventory}
        hotbar={hotbar}
        onUpdateInventory={(newInv, newHb) => {
          setInventory(newInv);
          setHotbar(newHb);
        }}
        isCraftingTableOpen={isCraftingTableOpen}
        gameMode={gameMode}
      />

      {/* Help / Guide Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Game Over Screen */}
      {health <= 0 && (
        <div className="absolute inset-0 z-50 bg-red-950/85 flex flex-col items-center justify-center p-4 backdrop-blur-xs select-none">
          <h1 className="font-pixel text-4xl sm:text-6xl text-red-500 font-bold mb-4 drop-shadow-[0_4px_10px_black] tracking-wider animate-pulse">
            ÖLDÜNÜZ!
          </h1>
          <p className="font-pixel text-stone-300 text-lg sm:text-xl mb-6 text-center">
            Puanınız: 0 - Bir dahaki sefere daha dikkatli olun!
          </p>
          <button
            onClick={handleRespawn}
            className="px-8 py-3.5 mc-btn rounded-xl font-pixel text-2xl text-white font-bold tracking-wider active:scale-95 shadow-2xl"
          >
            YENİDEN DOĞ
          </button>
        </div>
      )}
    </div>
  );
}
