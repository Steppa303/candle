import React, { useState, useCallback, useMemo } from 'react';
import { useDrag } from '../hooks/useDrag';
import { FAB } from './FAB';
import { VerticalToolbar, ToolbarItem } from './VerticalToolbar';
import { SubMenu } from './SubMenu';
import { BrushSizePicker } from './BrushSizePicker';
import { SmoothingSlider } from './SmoothingSlider';
import { ColorPicker } from './ColorPicker';
import { ProaktivPicker } from './ProaktivPicker';

interface FloatingToolboxProps {
  strokeColor: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onWidthChange: (width: number) => void;
  smoothingValue: number;
  onSmoothingValueChange: (value: number) => void;
  aiEnabled: boolean;
  onAiToggle: () => void;
  storyMode: boolean;
  onStoryToggle: () => void;
  v2Mode: boolean;
  onV2Toggle: () => void;
  proaktivDelay: number;
  onProaktivDelayChange: (delay: number) => void;
}

type SubmenuType = 'brush' | 'smoothing' | 'color' | 'proaktiv' | null;

type MenuItemId = SubmenuType | 'ai';

export function FloatingToolbox({
  strokeColor,
  onColorChange,
  strokeWidth,
  onWidthChange,
  smoothingValue,
  onSmoothingValueChange,
  aiEnabled,
  onAiToggle,
  storyMode,
  onStoryToggle,
  v2Mode,
  onV2Toggle,
  proaktivDelay,
  onProaktivDelayChange,
}: FloatingToolboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuType>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        setActiveSubmenu(null);
      }
      return !prev;
    });
  }, []);

  const handleCollapse = useCallback(() => {
    setIsOpen(false);
    setActiveSubmenu(null);
  }, []);

  const handleSelect = useCallback((id: string) => {
    if (id === 'ai') {
      onAiToggle();
      return;
    }
    if (id === 'story') {
      onStoryToggle();
      return;
    }
    if (id === 'v2') {
      onV2Toggle();
      return;
    }
    setActiveSubmenu((prev) => (prev === id ? null : id as SubmenuType));
  }, [onAiToggle, onStoryToggle, onV2Toggle]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // useDrag at orchestrator level so we have position for toolbar placement
  const { position: fabPosition, onPointerDown } = useDrag({
    onTap: handleToggle,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
  });

  // Determine toolbar position relative to FAB
  const toolbarPosition: 'left' | 'right' = useMemo(() => {
    return fabPosition.x < window.innerWidth / 2 ? 'right' : 'left';
  }, [fabPosition.x]);

  // Toolbar items
  const toolbarItems: ToolbarItem[] = useMemo(
    () => [
      {
        id: 'brush',
        label: 'Stift-Dicke',
        active: activeSubmenu === 'brush',
        icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" strokeWidth="1" />
            <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" />
            <line x1="4" y1="16" x2="20" y2="16" stroke="currentColor" strokeWidth="3" />
          </svg>
        ),
      },
      {
        id: 'smoothing',
        label: 'Glättung',
        active: activeSubmenu === 'smoothing',
        icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M2 16 Q 6 8, 12 12 Q 18 16, 22 8"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
      {
        id: 'color',
        label: 'Farbe',
        active: activeSubmenu === 'color',
        icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8" fill={strokeColor} stroke="currentColor" strokeWidth="1" />
          </svg>
        ),
      },
      {
        id: 'story',
        label: storyMode ? 'Story AN' : 'Story AUS',
        active: storyMode,
        icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 4h2v16H4V4zm4 0h12c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H8V4zm2 4h8v2h-2v-2zm0 4h8v2h-2v-2z"
              fill={storyMode ? '#333' : '#999'}
            />
          </svg>
        ),
      },
      {
        id: 'v2',
        label: v2Mode ? 'V2 AN' : 'V2 AUS',
        active: v2Mode,
        icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
            <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">V2</text>
          </svg>
        ),
      },
      {
        id: 'proaktiv',
        label: 'KI Initiativ',
        active: activeSubmenu === 'proaktiv',
        icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
            <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">⚡</text>
          </svg>
        ),
      },
      {
        id: 'ai',
        label: aiEnabled ? 'KI AN' : 'KI AUS',
        active: aiEnabled,
        icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
            <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor">AI</text>
          </svg>
        ),
      },
    ],
    [activeSubmenu, strokeColor, aiEnabled, storyMode, v2Mode]
  );

  // Calculate submenu anchor position
  const submenuAnchorTop = useMemo(() => {
    if (!activeSubmenu) return 0;
    const itemIndex = toolbarItems.findIndex((item) => item.id === activeSubmenu);
    // Each item is 48px + 2px gap, collapse button is 40px + 4px margin + 4px padding
    return Math.max(8, fabPosition.y - 120) + 48 + itemIndex * 50;
  }, [activeSubmenu, fabPosition.y, toolbarItems]);

  return (
    <>
      {/* FAB */}
      <FAB position={fabPosition} onPointerDown={onPointerDown} />

      {/* Vertical Toolbar */}
      {isOpen && !isDragging && (
        <VerticalToolbar
          items={toolbarItems}
          position={toolbarPosition}
          fabPosition={fabPosition}
          onSelect={handleSelect}
          onCollapse={handleCollapse}
        />
      )}

      {/* Submenus */}
      {isOpen && activeSubmenu === 'brush' && (
        <SubMenu
          position={toolbarPosition}
          anchorPosition={fabPosition}
          anchorTop={submenuAnchorTop}
          onClose={() => setActiveSubmenu(null)}
        >
          <BrushSizePicker value={strokeWidth} onChange={onWidthChange} />
        </SubMenu>
      )}

      {isOpen && activeSubmenu === 'smoothing' && (
        <SubMenu
          position={toolbarPosition}
          anchorPosition={fabPosition}
          anchorTop={submenuAnchorTop}
          onClose={() => setActiveSubmenu(null)}
        >
          <SmoothingSlider value={smoothingValue} onChange={onSmoothingValueChange} />
        </SubMenu>
      )}

      {isOpen && activeSubmenu === 'color' && (
        <SubMenu
          position={toolbarPosition}
          anchorPosition={fabPosition}
          anchorTop={submenuAnchorTop}
          onClose={() => setActiveSubmenu(null)}
        >
          <ColorPicker value={strokeColor} onChange={onColorChange} />
        </SubMenu>
      )}

      {isOpen && activeSubmenu === 'proaktiv' && (
        <SubMenu
          position={toolbarPosition}
          anchorPosition={fabPosition}
          anchorTop={submenuAnchorTop}
          onClose={() => setActiveSubmenu(null)}
        >
          <ProaktivPicker value={proaktivDelay} onChange={onProaktivDelayChange} />
        </SubMenu>
      )}
    </>
  );
}
