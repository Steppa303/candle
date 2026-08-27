import React from 'react';

export interface ToolbarItem {
  icon: React.ReactNode;
  label: string;
  id: string;
  active?: boolean;
}

interface VerticalToolbarProps {
  items: ToolbarItem[];
  position: 'left' | 'right';
  fabPosition: { x: number; y: number };
  onSelect: (id: string) => void;
  onCollapse: () => void;
}

export function VerticalToolbar({
  items,
  position,
  fabPosition,
  onSelect,
  onCollapse,
}: VerticalToolbarProps) {
  const toolbarStyle: React.CSSProperties = {
    position: 'fixed',
    top: Math.max(8, fabPosition.y - 120),
    ...(position === 'right'
      ? { left: fabPosition.x + 32 }
      : { right: window.innerWidth - fabPosition.x + 32 }),
    width: 56,
    zIndex: 99,
    backgroundColor: '#ffffff',
    border: '1px solid #000000',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '4px 0',
    gap: 2,
  };

  return (
    <div className="vertical-toolbar" style={toolbarStyle}>
      {/* Collapse button */}
      <button
        className="toolbar-collapse-btn"
        onClick={onCollapse}
        title="Schließen"
        style={{
          width: 40,
          height: 40,
          minWidth: 40,
          minHeight: 40,
          padding: 0,
          border: '1px solid #000000',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Toolbar items */}
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          {index === items.length - 1 && index > 0 && (
            <div
              style={{
                width: 32,
                height: 1,
                backgroundColor: '#000000',
                margin: '4px 0',
              }}
            />
          )}
          <button
            className="toolbar-item-btn"
            onClick={() => onSelect(item.id)}
            title={item.label}
            style={{
              width: 48,
              height: 48,
              minWidth: 48,
              minHeight: 48,
              padding: 0,
              border: '1px solid #000000',
              borderRadius: 4,
              backgroundColor: item.active ? '#000000' : '#ffffff',
              color: item.active ? '#ffffff' : '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {item.icon}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
