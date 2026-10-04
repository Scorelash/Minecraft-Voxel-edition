export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  COBBLESTONE = 4,
  OAK_WOOD = 5,
  OAK_LEAVES = 6,
  OAK_PLANKS = 7,
  SAND = 8,
  GLASS = 9,
  COAL_ORE = 10,
  IRON_ORE = 11,
  DIAMOND_ORE = 12,
  CRAFTING_TABLE = 13,
  FURNACE = 14,
  TORCH = 15,
  BRICKS = 16,
  WATER = 17,
  POPPY = 18,
  DANDELION = 19,
  CHEST = 20,
  BED = 21,
}

export enum ItemId {
  STICK = 100,
  WOODEN_PICKAXE = 101,
  STONE_PICKAXE = 102,
  IRON_PICKAXE = 103,
  DIAMOND_PICKAXE = 104,
  WOODEN_SWORD = 105,
  STONE_SWORD = 106,
  IRON_SWORD = 107,
  WOODEN_AXE = 108,
  STONE_AXE = 109,
  IRON_AXE = 110,
  WOODEN_SHOVEL = 111,
  APPLE = 120,
  RAW_PORKCHOP = 121,
  COOKED_PORKCHOP = 122,
  COAL = 123,
  IRON_INGOT = 124,
  DIAMOND = 125,
  WOOL = 126,
}

export type AnyItemId = BlockType | ItemId;

export interface ItemInfo {
  id: AnyItemId;
  name: string;
  isBlock: boolean;
  blockType?: BlockType;
  maxStack: number;
  durability?: number;
  hardness?: number; // Break time base in seconds
  preferredTool?: 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'none';
  harvestLevel?: number; // 0: hand, 1: wood, 2: stone, 3: iron, 4: diamond
  toolLevel?: number;
  attackDamage?: number;
  foodRestore?: number;
  dropId?: AnyItemId;
  dropCount?: number;
}

export interface InventorySlot {
  itemId: AnyItemId;
  count: number;
  durability?: number;
}

export interface Recipe {
  id: string;
  name: string;
  gridSize: 2 | 3;
  shape?: (AnyItemId | null)[][]; // 2x2 or 3x3
  ingredients?: { id: AnyItemId; count: number }[]; // For shapeless
  result: InventorySlot;
}

export interface MobEntity {
  id: string;
  type: 'pig' | 'sheep' | 'zombie' | 'spider';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  health: number;
  maxHealth: number;
  isHostile: boolean;
  walkTimer: number;
  hurtTimer: number;
  speed: number;
}

export interface DroppedItemEntity {
  id: string;
  itemId: AnyItemId;
  count: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

export interface BlockParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  r: number;
  g: number;
  b: number;
  size: number;
  life: number;
  maxLife: number;
}
