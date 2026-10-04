import React, { useRef } from 'react';

interface TouchLookPadProps {
  onLookDelta: (deltaYaw: number, deltaPitch: number) => void;
}

export const TouchLookPad: React.FC<TouchLookPadProps> = React.memo(({ onLookDelta }) => {
  const activeTouchId = useRef<number | null>(null);
  const lastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    // Look pad covers screen except right joystick area
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      // Only pick touches on left / top 70% of the screen
      const isRightSideBottom = touch.clientX > window.innerWidth * 0.55 && touch.clientY > window.innerHeight * 0.45;
      if (!isRightSideBottom && activeTouchId.current === null) {
        activeTouchId.current = touch.identifier;
        lastPos.current = { x: touch.clientX, y: touch.clientY };
        break;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        const dx = touch.clientX - lastPos.current.x;
        const dy = touch.clientY - lastPos.current.y;
        lastPos.current = { x: touch.clientX, y: touch.clientY };

        const sensitivity = 0.005;
        onLookDelta(-dx * sensitivity, -dy * sensitivity);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        activeTouchId.current = null;
        break;
      }
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="absolute inset-0 z-10 touch-none pointer-events-auto select-none"
    />
  );
});
