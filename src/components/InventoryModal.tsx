import React, { useState } from 'react';
import { InventorySlot, AnyItemId, BlockType, ItemId } from '../game/types';
import { ITEM_REGISTRY, RECIPES } from '../game/items';
import { getItemDataUrl } from '../game/textures';
import { sounds } from '../game/audio';
import { X, Hammer, BookOpen, Sparkles, Trash2, ArrowRight } from 'lucide-react';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: (InventorySlot | null)[]; // 27 slots
  hotbar: (InventorySlot | null)[]; // 9 slots
  onUpdateInventory: (
    newInv: (InventorySlot | null)[],
    newHotbar: (InventorySlot | null)[]
  ) => void;
  isCraftingTableOpen: boolean;
  gameMode: 'survival' | 'creative';
}

export const InventoryModal: React.FC<InventoryModalProps> = React.memo(({
  isOpen,
  onClose,
  inventory,
  hotbar,
  onUpdateInventory,
  isCraftingTableOpen,
  gameMode,
}) => {
  // Grid size: 3x3 for crafting table, 2x2 for player crafting
  const gridSize = isCraftingTableOpen ? 3 : 2;
  const gridSlotCount = gridSize * gridSize;

  const [craftGrid, setCraftGrid] = useState<(InventorySlot | null)[]>(
    new Array(gridSlotCount).fill(null)
  );
  const [craftOutput, setCraftOutput] = useState<InventorySlot | null>(null);
  const [activeTab, setActiveTab] = useState<'craft' | 'recipes' | 'creative'>('craft');
  const [selectedSlotRef, setSelectedSlotRef] = useState<{
    area: 'inv' | 'hotbar' | 'craft';
    index: number;
  } | null>(null);

  if (!isOpen) return null;

  // Recipe check whenever craftGrid changes
  const evaluateCrafting = (grid: (InventorySlot | null)[]) => {
    // Look through RECIPES
    for (const recipe of RECIPES) {
      if (recipe.gridSize === 2 && gridSize === 2) {
        // Check 2x2
        if (recipe.ingredients) {
          // Shapeless recipe (e.g. 1 wood -> 4 planks)
          const totalItems = grid.filter((s) => s && s.count > 0);
          if (totalItems.length === recipe.ingredients.length) {
            let match = true;
            for (const ing of recipe.ingredients) {
              const countInGrid = grid.reduce(
                (sum, s) => (s && s.itemId === ing.id ? sum + s.count : sum),
                0
              );
              if (countInGrid < ing.count) {
                match = false;
                break;
              }
            }
            if (match) {
              setCraftOutput({ ...recipe.result });
              return;
            }
          }
        } else if (recipe.shape) {
          // Shaped 2x2
          let match = true;
          for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 2; c++) {
              const expected = recipe.shape[r]?.[c] ?? null;
              const actual = grid[r * 2 + c]?.itemId ?? null;
              if (expected !== actual) {
                match = false;
                break;
              }
            }
            if (!match) break;
          }
          if (match) {
            setCraftOutput({ ...recipe.result });
            return;
          }
        }
      } else if (recipe.gridSize === 3 && gridSize === 3) {
        // Check 3x3 shaped
        if (recipe.shape) {
          let match = true;
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              const expected = recipe.shape[r]?.[c] ?? null;
              const actual = grid[r * 3 + c]?.itemId ?? null;
              if (expected !== actual) {
                match = false;
                break;
              }
            }
            if (!match) break;
          }
          if (match) {
            setCraftOutput({ ...recipe.result });
            return;
          }
        }
      }
    }
    setCraftOutput(null);
  };

  // Quick craft from recipe book
  const craftRecipeDirectly = (recipeId: string) => {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return;

    // Check if player has necessary ingredients
    const allSlots = [...hotbar, ...inventory];
    const newHotbar = [...hotbar];
    const newInv = [...inventory];

    const getAvailableCount = (id: AnyItemId) => {
      let count = 0;
      allSlots.forEach((s) => {
        if (s && s.itemId === id) count += s.count;
      });
      return count;
    };

    const consumeItem = (id: AnyItemId, amount: number) => {
      let needed = amount;
      for (let i = 0; i < newHotbar.length; i++) {
        if (newHotbar[i] && newHotbar[i]!.itemId === id) {
          const take = Math.min(needed, newHotbar[i]!.count);
          newHotbar[i]!.count -= take;
          needed -= take;
          if (newHotbar[i]!.count <= 0) newHotbar[i] = null;
          if (needed <= 0) return true;
        }
      }
      for (let i = 0; i < newInv.length; i++) {
        if (newInv[i] && newInv[i]!.itemId === id) {
          const take = Math.min(needed, newInv[i]!.count);
          newInv[i]!.count -= take;
          needed -= take;
          if (newInv[i]!.count <= 0) newInv[i] = null;
          if (needed <= 0) return true;
        }
      }
      return needed <= 0;
    };

    // Determine required items
    const required: Record<number, number> = {};
    if (recipe.ingredients) {
      recipe.ingredients.forEach((ing) => {
        required[ing.id] = (required[ing.id] || 0) + ing.count;
      });
    } else if (recipe.shape) {
      recipe.shape.flat().forEach((id) => {
        if (id !== null) {
          required[id] = (required[id] || 0) + 1;
        }
      });
    }

    // Verify all present
    for (const [idStr, needed] of Object.entries(required)) {
      const id = Number(idStr) as AnyItemId;
      if (getAvailableCount(id) < needed) {
        return; // not enough materials
      }
    }

    // Consume
    for (const [idStr, needed] of Object.entries(required)) {
      const id = Number(idStr) as AnyItemId;
      consumeItem(id, needed);
    }

    // Add result to inventory or hotbar
    addItemToSlots(recipe.result.itemId, recipe.result.count, newHotbar, newInv);
    onUpdateInventory(newInv, newHotbar);
    sounds.playCraft();
  };

  const addItemToSlots = (
    itemId: AnyItemId,
    count: number,
    hb: (InventorySlot | null)[],
    inv: (InventorySlot | null)[]
  ) => {
    let remaining = count;
    const maxStack = ITEM_REGISTRY[itemId]?.maxStack || 64;

    // First try stacking into hotbar
    for (let i = 0; i < hb.length; i++) {
      if (hb[i] && hb[i]!.itemId === itemId && hb[i]!.count < maxStack) {
        const canAdd = Math.min(remaining, maxStack - hb[i]!.count);
        hb[i]!.count += canAdd;
        remaining -= canAdd;
        if (remaining <= 0) return;
      }
    }
    // Then stack into inv
    for (let i = 0; i < inv.length; i++) {
      if (inv[i] && inv[i]!.itemId === itemId && inv[i]!.count < maxStack) {
        const canAdd = Math.min(remaining, maxStack - inv[i]!.count);
        inv[i]!.count += canAdd;
        remaining -= canAdd;
        if (remaining <= 0) return;
      }
    }
    // Then empty slots in hotbar
    for (let i = 0; i < hb.length; i++) {
      if (!hb[i]) {
        hb[i] = { itemId, count: remaining };
        return;
      }
    }
    // Then empty slots in inv
    for (let i = 0; i < inv.length; i++) {
      if (!inv[i]) {
        inv[i] = { itemId, count: remaining };
        return;
      }
    }
  };

  // Taking craft output
  const handleTakeCraftOutput = () => {
    if (!craftOutput) return;

    const newHotbar = [...hotbar];
    const newInv = [...inventory];
    addItemToSlots(craftOutput.itemId, craftOutput.count, newHotbar, newInv);

    // Consume 1 item from each used slot in craftGrid
    const newCraftGrid = craftGrid.map((s) => {
      if (!s) return null;
      if (s.count <= 1) return null;
      return { ...s, count: s.count - 1 };
    });

    setCraftGrid(newCraftGrid);
    evaluateCrafting(newCraftGrid);
    onUpdateInventory(newInv, newHotbar);
    sounds.playCraft();
  };

  // Slot click router (move/swap)
  const handleSlotClick = (area: 'inv' | 'hotbar' | 'craft', index: number) => {
    sounds.playClick();
    if (!selectedSlotRef) {
      // Pick up item
      let hasItem = false;
      if (area === 'inv' && inventory[index]) hasItem = true;
      if (area === 'hotbar' && hotbar[index]) hasItem = true;
      if (area === 'craft' && craftGrid[index]) hasItem = true;

      if (hasItem) {
        setSelectedSlotRef({ area, index });
      }
      return;
    }

    // Placing / Swapping
    const from = selectedSlotRef;
    if (from.area === area && from.index === index) {
      setSelectedSlotRef(null);
      return;
    }

    const newInv = [...inventory];
    const newHotbar = [...hotbar];
    const newCraft = [...craftGrid];

    // Get item from source
    let fromItem: InventorySlot | null = null;
    if (from.area === 'inv') fromItem = newInv[from.index];
    else if (from.area === 'hotbar') fromItem = newHotbar[from.index];
    else if (from.area === 'craft') fromItem = newCraft[from.index];

    // Get item at target
    let targetItem: InventorySlot | null = null;
    if (area === 'inv') targetItem = newInv[index];
    else if (area === 'hotbar') targetItem = newHotbar[index];
    else if (area === 'craft') targetItem = newCraft[index];

    // Swap
    if (from.area === 'inv') newInv[from.index] = targetItem;
    else if (from.area === 'hotbar') newHotbar[from.index] = targetItem;
    else if (from.area === 'craft') newCraft[from.index] = targetItem;

    if (area === 'inv') newInv[index] = fromItem;
    else if (area === 'hotbar') newHotbar[index] = fromItem;
    else if (area === 'craft') newCraft[index] = fromItem;

    onUpdateInventory(newInv, newHotbar);
    setCraftGrid(newCraft);
    evaluateCrafting(newCraft);
    setSelectedSlotRef(null);
  };

  // Creative Mode: Click to spawn item
  const handleSpawnCreativeItem = (id: AnyItemId) => {
    const newHotbar = [...hotbar];
    const newInv = [...inventory];
    const count = ITEM_REGISTRY[id]?.maxStack || 64;
    addItemToSlots(id, count, newHotbar, newInv);
    onUpdateInventory(newInv, newHotbar);
    sounds.playBlockPlace();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs select-none">
      <div className="mc-panel w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl p-4 flex flex-col gap-4 text-stone-900 animate-scale-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b-2 border-stone-400 pb-2">
          <div className="flex items-center gap-2">
            <Hammer className="w-5 h-5 text-stone-800" />
            <h2 className="font-pixel text-xl sm:text-2xl text-stone-900 font-bold tracking-wider">
              {isCraftingTableOpen ? 'ÇALIŞMA MASASI (3x3)' : 'ENVANTER VE ÜRETİM'}
            </h2>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('craft')}
              className={`px-3 py-1 mc-btn rounded text-xs font-pixel ${
                activeTab === 'craft' ? 'active' : ''
              }`}
            >
              ÜRETİM
            </button>
            <button
              onClick={() => setActiveTab('recipes')}
              className={`px-3 py-1 mc-btn rounded text-xs font-pixel ${
                activeTab === 'recipes' ? 'active' : ''
              }`}
            >
              TARİF KİTABI
            </button>
            {gameMode === 'creative' && (
              <button
                onClick={() => setActiveTab('creative')}
                className={`px-3 py-1 mc-btn rounded text-xs font-pixel ${
                  activeTab === 'creative' ? 'active' : ''
                }`}
              >
                SINIRSIZ EŞYALAR
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 mc-btn rounded text-stone-800 hover:text-red-700 ml-2"
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area Based on Active Tab */}
        {activeTab === 'craft' && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
            {/* Crafting Grid */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-pixel text-stone-700 mb-1">
                {isCraftingTableOpen ? '3x3 Zanaat Izgarası' : '2x2 Zanaat Izgarası'}
              </span>
              <div
                className="grid gap-1.5 p-2 bg-stone-500/30 rounded-lg border-2 border-stone-400"
                style={{
                  gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                }}
              >
                {craftGrid.map((slot, idx) => {
                  const isSelected =
                    selectedSlotRef?.area === 'craft' && selectedSlotRef.index === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSlotClick('craft', idx)}
                      className={`w-12 h-12 mc-slot relative flex items-center justify-center ${
                        isSelected ? 'selected' : ''
                      }`}
                    >
                      {slot && (
                        <>
                          <img
                            src={getItemDataUrl(slot.itemId)}
                            alt=""
                            className="w-8 h-8 object-contain pointer-events-none"
                            referrerPolicy="no-referrer"
                          />
                          {slot.count > 1 && (
                            <span className="absolute bottom-0 right-1 text-xs text-white font-pixel font-bold drop-shadow">
                              {slot.count}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center text-stone-600">
              <ArrowRight className="w-8 h-8 animate-pulse hidden sm:block" />
              <div className="w-8 h-1 bg-stone-600 sm:hidden my-2" />
            </div>

            {/* Craft Output */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-pixel text-stone-700 mb-1">Sonuç</span>
              <button
                onClick={handleTakeCraftOutput}
                disabled={!craftOutput}
                className={`w-14 h-14 mc-slot relative flex items-center justify-center ${
                  craftOutput ? 'ring-2 ring-emerald-500 cursor-pointer animate-bounce' : 'opacity-50'
                }`}
                title="Ürünü Al"
              >
                {craftOutput && (
                  <>
                    <img
                      src={getItemDataUrl(craftOutput.itemId)}
                      alt=""
                      className="w-10 h-10 object-contain pointer-events-none drop-shadow"
                      referrerPolicy="no-referrer"
                    />
                    {craftOutput.count > 1 && (
                      <span className="absolute bottom-0 right-1 text-sm text-white font-pixel font-bold drop-shadow">
                        {craftOutput.count}
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Recipe Book Tab */}
        {activeTab === 'recipes' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
            {RECIPES.filter((r) => isCraftingTableOpen || r.gridSize === 2).map((r) => {
              return (
                <button
                  key={r.id}
                  onClick={() => craftRecipeDirectly(r.id)}
                  className="p-2 mc-btn rounded flex items-center gap-2.5 text-left active:scale-98 hover:brightness-105"
                >
                  <img
                    src={getItemDataUrl(r.result.itemId)}
                    alt=""
                    className="w-8 h-8 object-contain shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-pixel text-amber-200 truncate">{r.name}</span>
                    <span className="text-[10px] text-stone-300 font-pixel">Tıkla ve Üret</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Creative Item Spawner Tab */}
        {activeTab === 'creative' && (
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-56 overflow-y-auto p-1 bg-stone-400/30 rounded-lg">
            {Object.values(ITEM_REGISTRY)
              .filter((item) => item.id !== BlockType.AIR)
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSpawnCreativeItem(item.id)}
                  className="w-11 h-11 mc-slot relative flex items-center justify-center hover:scale-105 transition-transform"
                  title={`${item.name} al`}
                >
                  <img
                    src={getItemDataUrl(item.id)}
                    alt={item.name}
                    className="w-8 h-8 object-contain pointer-events-none drop-shadow"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
          </div>
        )}

        {/* Main 27-slot Inventory */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-pixel text-stone-700 self-start">Envanter (27 Yuva)</span>
          <div className="grid grid-cols-9 gap-1.5 p-2 bg-stone-500/20 rounded-lg border border-stone-400">
            {inventory.map((slot, idx) => {
              const isSelected = selectedSlotRef?.area === 'inv' && selectedSlotRef.index === idx;
              return (
                <button
                  key={idx}
                  onClick={() => handleSlotClick('inv', idx)}
                  className={`w-10 h-10 sm:w-11 sm:h-11 mc-slot relative flex items-center justify-center ${
                    isSelected ? 'selected' : ''
                  }`}
                >
                  {slot && (
                    <>
                      <img
                        src={getItemDataUrl(slot.itemId)}
                        alt=""
                        className="w-7 h-7 sm:w-8 sm:h-8 object-contain pointer-events-none drop-shadow"
                        referrerPolicy="no-referrer"
                      />
                      {slot.count > 1 && (
                        <span className="absolute bottom-0 right-1 text-xs text-white font-pixel font-bold drop-shadow">
                          {slot.count}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 9-Slot Hotbar in Inventory */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-pixel text-stone-700 self-start">Hızlı Erişim Çubuğu (Hotbar)</span>
          <div className="grid grid-cols-9 gap-1.5 p-2 bg-stone-600/30 rounded-lg border-2 border-stone-400">
            {hotbar.map((slot, idx) => {
              const isSelected = selectedSlotRef?.area === 'hotbar' && selectedSlotRef.index === idx;
              return (
                <button
                  key={idx}
                  onClick={() => handleSlotClick('hotbar', idx)}
                  className={`w-10 h-10 sm:w-11 sm:h-11 mc-slot relative flex items-center justify-center ${
                    isSelected ? 'selected' : ''
                  }`}
                >
                  {slot && (
                    <>
                      <img
                        src={getItemDataUrl(slot.itemId)}
                        alt=""
                        className="w-7 h-7 sm:w-8 sm:h-8 object-contain pointer-events-none drop-shadow"
                        referrerPolicy="no-referrer"
                      />
                      {slot.count > 1 && (
                        <span className="absolute bottom-0 right-1 text-xs text-white font-pixel font-bold drop-shadow">
                          {slot.count}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
