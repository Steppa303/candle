import React from 'react';

interface FABProps {
  position: { x: number; y: number };
  onPointerDown: (e: React.PointerEvent) => void;
}

export function FAB({ position, onPointerDown }: FABProps) {
  return (
    <div
      className="fab"
      style={{
        position: 'fixed',
        left: position.x - 24,
        top: position.y - 24,
        width: 48,
        height: 48,
        zIndex: 100,
        backgroundColor: '#000000',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Pen/brush icon */}
        <path
          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
          fill="white"
        />
      </svg>
    </div>
  );
}
