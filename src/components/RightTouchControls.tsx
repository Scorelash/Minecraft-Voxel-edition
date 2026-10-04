import React, { useRef, useState, useEffect } from 'react';
import { Pickaxe, Box, ArrowUp, ArrowDown, Hand, Utensils } from 'lucide-react';

interface RightTouchControlsProps {
  onMove: (move: { x: number; z: number }) => void;
  onJump: (isJumping: boolean) => void;
  onCrouch: (isCrouching: boolean) => void;
  onMineStart: () => void;
  onMineEnd: () => void;
  onPlace: () => void;
  onEat?: () => void;
  isHoldingFood?: boolean;
}

export const RightTouchControls: React.FC<RightTouchControlsProps> = React.memo(({
  onMove,
  onJump,
  onCrouch,
  onMineStart,
  onMineEnd,
  onPlace,
  onEat,
  isHoldingFood = false,
}) => {
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);
  const [isJumping, setIsJumping] = useState(false);
  const [isCrouching, setIsCrouching] = useState(false);
  const [isMining, setIsMining] = useState(false);

  // Joystick touch handlers - Zero React re-renders on move!
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    if (knobRef.current) knobRef.current.style.background = '#555555';
    updateJoystick(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        updateJoystick(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null;
        if (knobRef.current) {
          knobRef.current.style.transform = 'translate(0px, 0px)';
          knobRef.current.style.background = '#737373';
        }
        onMove({ x: 0, z: 0 });
        break;
      }
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const maxRadius = rect.width / 2;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    // Normalized move input: -1 to 1
    const normX = dx / maxRadius;
    const normZ = dy / maxRadius; // negative is forward in 3D coordinate convention
    onMove({ x: normX, z: normZ });
  };

  return (
    <div className="absolute right-3 bottom-5 z-20 flex flex-col items-end pointer-events-none select-none">
      {/* Top action button cluster */}
      <div className="flex items-center gap-3 mb-4 pointer-events-auto">
        {/* Eat food button if holding food */}
        {isHoldingFood && onEat && (
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              onEat();
            }}
            onClick={(e) => {
              e.preventDefault();
              onEat();
            }}
            className="w-14 h-14 rounded-xl mc-btn flex flex-col items-center justify-center active:scale-95 shadow-lg border-amber-600 bg-amber-800/80"
            title="Ye (Beslen)"
          >
            <Utensils className="w-6 h-6 text-amber-300" />
            <span className="text-[10px] text-amber-200 mt-0.5">YE</span>
          </button>
        )}

        {/* Place Block Button */}
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            onPlace();
          }}
          onClick={(e) => {
            e.preventDefault();
            onPlace();
          }}
          className="w-16 h-16 rounded-xl mc-btn flex flex-col items-center justify-center active:scale-95 shadow-xl bg-slate-700/90 hover:bg-slate-600"
          title="Blok Yerleştir"
        >
          <Box className="w-7 h-7 text-emerald-300" />
          <span className="text-xs text-emerald-200 font-pixel mt-0.5 tracking-wider">KOY</span>
        </button>

        {/* El / Kaz (Hand / Mine / Attack) Button */}
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            setIsMining(true);
            onMineStart();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            setIsMining(false);
            onMineEnd();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsMining(true);
            onMineStart();
          }}
          onMouseUp={(e) => {
            e.preventDefault();
            setIsMining(false);
            onMineEnd();
          }}
          className={`w-18 h-18 rounded-2xl mc-btn flex flex-col items-center justify-center active:scale-95 shadow-2xl transition-all ${
            isMining ? 'bg-red-800 scale-95 border-red-500 ring-2 ring-red-400' : 'bg-stone-700/95'
          }`}
          title="El / Kaz / Vur"
        >
          <div className="relative">
            <Hand className="w-8 h-8 text-amber-200 drop-shadow" />
            <Pickaxe className="w-4 h-4 text-white absolute -bottom-1 -right-2 drop-shadow" />
          </div>
          <span className="text-xs text-amber-100 font-pixel mt-0.5 font-bold tracking-wider">EL / KAZ</span>
        </button>
      </div>

      {/* Lower Row: Jump, Crouch, and Joystick on the right */}
      <div className="flex items-center gap-4 pointer-events-auto">
        {/* Jump & Crouch vertical stack */}
        <div className="flex flex-col gap-3">
          {/* Jump Button */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              setIsJumping(true);
              onJump(true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              setIsJumping(false);
              onJump(false);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsJumping(true);
              onJump(true);
            }}
            onMouseUp={(e) => {
              e.preventDefault();
              setIsJumping(false);
              onJump(false);
            }}
            className={`w-14 h-14 rounded-xl mc-btn flex flex-col items-center justify-center active:scale-95 shadow-lg ${
              isJumping ? 'bg-sky-700' : ''
            }`}
            title="Zıpla"
          >
            <ArrowUp className="w-6 h-6 text-sky-300" />
            <span className="text-[11px] text-sky-200 font-pixel">ZIPLA</span>
          </button>

          {/* Crouch Button */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              const next = !isCrouching;
              setIsCrouching(next);
              onCrouch(next);
            }}
            onClick={(e) => {
              e.preventDefault();
              const next = !isCrouching;
              setIsCrouching(next);
              onCrouch(next);
            }}
            className={`w-14 h-14 rounded-xl mc-btn flex flex-col items-center justify-center active:scale-95 shadow-lg ${
              isCrouching ? 'bg-amber-900 border-amber-500 ring-2 ring-amber-400' : ''
            }`}
            title="Çömel (Eğil)"
          >
            <ArrowDown className="w-6 h-6 text-amber-300" />
            <span className="text-[11px] text-amber-200 font-pixel">ÇÖMEL</span>
          </button>
        </div>

        {/* Virtual Joystick (On the Right as requested) */}
        <div
          ref={joystickRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="w-32 h-32 rounded-full border-2 border-white/30 bg-black/40 backdrop-blur-sm relative flex items-center justify-center shadow-2xl active:border-white/60 touch-none"
        >
          {/* Crosshair directional markers */}
          <div className="absolute top-1 text-[10px] text-white/50 font-pixel">▲ İLERİ</div>
          <div className="absolute bottom-1 text-[10px] text-white/50 font-pixel">▼ GERİ</div>
          <div className="absolute left-1 text-[10px] text-white/50 font-pixel">◀</div>
          <div className="absolute right-1 text-[10px] text-white/50 font-pixel">▶</div>

          {/* Joystick Knob */}
          <div
            ref={knobRef}
            className="w-14 h-14 rounded-full mc-btn flex items-center justify-center shadow-lg pointer-events-none will-change-transform"
            style={{
              transform: 'translate(0px, 0px)',
              background: '#737373',
            }}
          >
            <div className="w-4 h-4 rounded-full bg-white/40" />
          </div>
        </div>
      </div>
    </div>
  );
});
