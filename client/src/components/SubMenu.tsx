import React, { useEffect, useRef } from 'react';

interface SubMenuProps {
  position: 'left' | 'right';
  anchorPosition: { x: number; y: number };
  anchorTop: number;
  onClose: () => void;
  children: React.ReactNode;
}

export function SubMenu({
  position,
  anchorPosition,
  anchorTop,
  onClose,
  children,
}: SubMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay to avoid immediate close from the same click that opened the submenu
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [onClose]);

  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorTop,
    ...(position === 'right'
      ? { left: anchorPosition.x + 96 }
      : { right: window.innerWidth - anchorPosition.x + 96 }),
    minWidth: 160,
    zIndex: 98,
    backgroundColor: '#ffffff',
    border: '1px solid #000000',
    borderRadius: 8,
    padding: 8,
  };

  return (
    <div ref={ref} className="submenu" style={style}>
      {children}
    </div>
  );
}
