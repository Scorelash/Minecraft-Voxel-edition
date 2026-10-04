import React, { useState, useEffect } from 'react';
import { InventorySlot, AnyItemId } from '../game/types';
import { ITEM_REGISTRY } from '../game/items';
import { getItemDataUrl } from '../game/textures';
import { Volume2, VolumeX, Backpack, Sun, Moon, HelpCircle, Shield, Sparkles, Smile, Flame, Zap } from 'lucide-react';

interface HUDProps {
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  oxygen: number;
  maxOxygen: number;
  hotbar: (InventorySlot | null)[];
  selectedIndex: number;
  onSelectSlot: (idx: number) => void;
  onOpenInventory: () => void;
  gameMode: 'survival' | 'creative';
  onToggleGameMode: () => void;
  difficulty: 'peaceful' | 'easy' | 'normal';
  onToggleDifficulty: () => void;
  graphicsMode: 'performance' | 'quality';
  onToggleGraphicsMode: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isNight: boolean;
  onOpenHelp: () => void;
}

export const HUD: React.FC<HUDProps> = React.memo(({
  health,
  maxHealth,
  hunger,
  maxHunger,
  oxygen,
  maxOxygen,
  hotbar,
  selectedIndex,
  onSelectSlot,
  onOpenInventory,
  gameMode,
  onToggleGameMode,
  difficulty,
  onToggleDifficulty,
  graphicsMode,
  onToggleGraphicsMode,
  isMuted,
  onToggleMute,
  isNight,
  onOpenHelp,
}) => {
  const [tooltipItem, setTooltipItem] = useState<string | null>(null);
  const [tooltipTimeout, setTooltipTimeout] = useState<number | null>(null);

  const selectedSlot = hotbar[selectedIndex];

  // Show tooltip briefly when selected index changes
  useEffect(() => {
    if (selectedSlot && selectedSlot.count > 0) {
      const name = ITEM_REGISTRY[selectedSlot.itemId]?.name || 'Bilinmeyen';
      setTooltipItem(name);
      if (tooltipTimeout) clearTimeout(tooltipTimeout);
      const timer = window.setTimeout(() => {
        setTooltipItem(null);
      }, 2000);
      setTooltipTimeout(timer);
    } else {
      setTooltipItem(null);
    }
  }, [selectedIndex, selectedSlot?.itemId]);

  // Hearts generator (10 hearts total, each heart = 2 HP)
  const renderHearts = () => {
    const hearts = [];
    const numHearts = Math.ceil(maxHealth / 2);
    for (let i = 0; i < numHearts; i++) {
      const heartValue = health - i * 2;
      const isFull = heartValue >= 2;
      const isHalf = heartValue === 1;

      hearts.push(
        <div key={i} className="relative w-4 h-4 flex items-center justify-center">
          {/* Heart background (empty) */}
          <div className="absolute inset-0 text-stone-900 text-xs">🖤</div>
          {/* Heart fill */}
          {isFull && <div className="absolute inset-0 text-red-600 text-xs animate-pulse">❤️</div>}
          {isHalf && <div className="absolute inset-0 text-red-400 text-xs">💔</div>}
        </div>
      );
    }
    return hearts;
  };

  // Hunger generator (10 drumsticks, each drumstick = 2 hunger)
  const renderHunger = () => {
    const drumsticks = [];
    const num = Math.ceil(maxHunger / 2);
    for (let i = 0; i < num; i++) {
      const val = hunger - i * 2;
      const isFull = val >= 2;
      const isHalf = val === 1;

      drumsticks.push(
        <div key={i} className="relative w-4 h-4 flex items-center justify-center">
          <div className="absolute inset-0 text-stone-900 text-xs">🦴</div>
          {isFull && <div className="absolute inset-0 text-amber-600 text-xs">🍗</div>}
          {isHalf && <div className="absolute inset-0 text-amber-500 text-xs">🍖</div>}
        </div>
      );
    }
    return drumsticks;
  };

  // Oxygen Bubbles (underwater)
  const renderBubbles = () => {
    if (oxygen >= maxOxygen) return null;
    const bubbles = [];
    const count = Math.ceil(oxygen / 2);
    for (let i = 0; i < count; i++) {
      bubbles.push(
        <div key={i} className="w-3.5 h-3.5 rounded-full bg-cyan-400 border border-blue-900 animate-pulse" />
      );
    }
    return bubbles;
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 flex flex-col justify-between p-3">
      {/* Top Header Row */}
      <div className="flex items-center justify-between w-full pointer-events-auto">
        {/* Brand & Stats */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 mc-panel rounded-lg flex items-center gap-2">
            <span className="font-pixel text-lg text-amber-300 font-bold tracking-wider drop-shadow">
              MINECRAFT <span className="text-white text-sm">VOXEL</span>
            </span>
            <span className="text-xs text-stone-600">|</span>
            <div className="flex items-center gap-1 text-xs text-stone-800 font-pixel">
              {isNight ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-700" />
                  <span>GECE</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-600" />
                  <span>GÜNDÜZ</span>
                </>
              )}
            </div>
          </div>

          {/* Game Mode Pill */}
          <button
            onClick={onToggleGameMode}
            className="px-2.5 py-1.5 mc-btn rounded-lg flex items-center gap-1.5 text-xs font-pixel active:scale-95"
            title="Oyun Modunu Değiştir"
          >
            {gameMode === 'survival' ? (
              <>
                <Shield className="w-3.5 h-3.5 text-emerald-300" />
                <span className="hidden sm:inline">HAYATTA KALMA</span>
                <span className="sm:hidden">SURVIVAL</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                <span className="hidden sm:inline">YARATICI</span>
                <span className="sm:hidden">YARATICI</span>
              </>
            )}
          </button>

          {/* Difficulty Toggle (Peaceful / Easy / Normal) */}
          {gameMode === 'survival' && (
            <button
              onClick={onToggleDifficulty}
              className={`px-2.5 py-1.5 mc-btn rounded-lg flex items-center gap-1.5 text-xs font-pixel active:scale-95 ${
                difficulty === 'peaceful'
                  ? 'border-emerald-500 text-emerald-300'
                  : difficulty === 'easy'
                  ? 'border-amber-500 text-amber-300'
                  : 'border-red-500 text-red-300'
              }`}
              title="Zorluk Derecesini Değiştir"
            >
              {difficulty === 'peaceful' ? (
                <>
                  <Smile className="w-3.5 h-3.5 text-emerald-400" />
                  <span>HUZURLU (CANAVAR YOK)</span>
                </>
              ) : difficulty === 'easy' ? (
                <>
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>KOLAY</span>
                </>
              ) : (
                <>
                  <Flame className="w-3.5 h-3.5 text-red-400" />
                  <span>NORMAL</span>
                </>
              )}
            </button>
          )}

          {/* Graphics Mode (Performance / Quality) */}
          <button
            onClick={onToggleGraphicsMode}
            className="hidden md:flex px-2.5 py-1.5 mc-btn rounded-lg items-center gap-1 text-xs font-pixel active:scale-95 text-sky-200"
            title="Performans / Görsel Modu"
          >
            <Zap className={`w-3.5 h-3.5 ${graphicsMode === 'performance' ? 'text-yellow-400' : 'text-stone-400'}`} />
            <span>{graphicsMode === 'performance' ? 'AKICI (60 FPS)' : 'GÖRSEL (GÖLGELİ)'}</span>
          </button>
        </div>

        {/* Top Right Quick Controls */}
        <div className="flex items-center gap-2">
          {/* Inventory Button */}
          <button
            onClick={onOpenInventory}
            className="px-3 py-1.5 mc-btn rounded-lg flex items-center gap-1.5 text-xs font-pixel active:scale-95 text-yellow-200"
            title="Envanter ve Zanaat (E)"
          >
            <Backpack className="w-4 h-4 text-amber-300" />
            <span className="hidden sm:inline">ÇANTA (E)</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onToggleMute}
            className="p-2 mc-btn rounded-lg active:scale-95 text-stone-200"
            title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Help Button */}
          <button
            onClick={onOpenHelp}
            className="p-2 mc-btn rounded-lg active:scale-95 text-stone-200"
            title="Kontroller ve Bilgi"
          >
            <HelpCircle className="w-4 h-4 text-sky-300" />
          </button>
        </div>
      </div>

      {/* Red Hurt Vignette when taking damage (direct DOM controlled for 0 frame drop) */}
      <div
        id="hurt-vignette"
        className="fixed inset-0 pointer-events-none z-30 transition-opacity duration-150 opacity-0"
        style={{
          boxShadow: 'inset 0 0 90px 25px rgba(220, 38, 38, 0.85)',
        }}
      />

      {/* Screen Center Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative flex items-center justify-center">
          <div className="w-4 h-0.5 bg-white/80 shadow-[0_0_2px_black]" />
          <div className="w-0.5 h-4 bg-white/80 absolute shadow-[0_0_2px_black]" />
        </div>
      </div>

      {/* Mining progress bar if mining (direct DOM controlled for 0 frame drop) */}
      <div
        id="mining-progress-container"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-6 pointer-events-none flex flex-col items-center hidden"
      >
        <div className="w-24 h-2 bg-stone-900/80 rounded-full overflow-hidden border border-white/40">
          <div
            id="mining-progress-bar"
            className="h-full bg-amber-400 w-0"
          />
        </div>
        <span className="text-[10px] text-white font-pixel mt-0.5 drop-shadow">KAZILIYOR...</span>
      </div>

      {/* Bottom HUD: Status Bars (Hearts, Hunger) & Hotbar */}
      <div className="flex flex-col items-center mb-1">
        {/* Tooltip name above hotbar */}
        {tooltipItem && (
          <div className="mb-2 px-3 py-1 bg-black/70 backdrop-blur-sm rounded border border-white/20 text-white font-pixel text-sm animate-fade-in shadow-lg">
            {tooltipItem}
          </div>
        )}

        {/* Survival Status Bars (Health & Hunger) */}
        {gameMode === 'survival' && (
          <div className="flex items-center justify-between w-full max-w-sm px-2 mb-1.5">
            {/* Hearts on left */}
            <div className="flex items-center gap-0.5 drop-shadow">{renderHearts()}</div>

            {/* Oxygen Bubbles in center if submerged */}
            <div className="flex items-center gap-1 drop-shadow">{renderBubbles()}</div>

            {/* Hunger Drumsticks on right */}
            <div className="flex items-center gap-0.5 drop-shadow">{renderHunger()}</div>
          </div>
        )}

        {/* 9-Slot Hotbar */}
        <div className="flex items-center gap-1 p-1 bg-stone-900/80 border-2 border-stone-600 rounded-lg shadow-2xl pointer-events-auto backdrop-blur-xs">
          {hotbar.map((slot, idx) => {
            const isSelected = idx === selectedIndex;
            const itemInfo = slot ? ITEM_REGISTRY[slot.itemId] : null;
            const iconUrl = slot ? getItemDataUrl(slot.itemId) : null;

            return (
              <button
                key={idx}
                onClick={() => onSelectSlot(idx)}
                className={`relative w-10 h-10 sm:w-12 sm:h-12 mc-slot flex items-center justify-center transition-all ${
                  isSelected ? 'selected scale-105 z-10' : 'hover:brightness-110'
                }`}
              >
                {/* Hotbar Slot Number Key (1-9) */}
                <span className="absolute top-0.5 left-1 text-[9px] text-stone-400 font-pixel leading-none">
                  {idx + 1}
                </span>

                {/* Item Icon */}
                {slot && iconUrl && (
                  <img
                    src={iconUrl}
                    alt={itemInfo?.name || ''}
                    className="w-7 h-7 sm:w-8 sm:h-8 object-contain pointer-events-none drop-shadow"
                    referrerPolicy="no-referrer"
                  />
                )}

                {/* Stack Count badge */}
                {slot && slot.count > 1 && (
                  <span className="absolute bottom-0 right-1 text-xs text-white font-pixel font-bold drop-shadow-[0_1px_2px_black]">
                    {slot.count}
                  </span>
                )}

                {/* Durability bar if tool */}
                {slot && slot.durability !== undefined && itemInfo?.durability && (
                  <div className="absolute bottom-0.5 left-1 right-1 h-1 bg-stone-900 rounded-xs overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${(slot.durability / itemInfo.durability) * 100}%`,
                      }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
