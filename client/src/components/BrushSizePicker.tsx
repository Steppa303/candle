import React from 'react';

interface BrushSizePickerProps {
  value: number;
  onChange: (size: number) => void;
}

const SIZES = [1, 2, 3, 4, 5];

export function BrushSizePicker({ value, onChange }: BrushSizePickerProps) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {SIZES.map((size) => {
        const isActive = value === size;
        return (
          <button
            key={size}
            onClick={() => onChange(size)}
            title={`${size}px`}
            style={{
              width: 48,
              height: 48,
              minWidth: 48,
              minHeight: 48,
              padding: 0,
              border: '1px solid #000000',
              borderRadius: 4,
              backgroundColor: isActive ? '#000000' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="32" height="20" viewBox="0 0 32 20">
              <path
                d={`M2 ${10} Q ${8} ${10 - size * 2}, ${16} ${10} Q ${24} ${10 + size * 2}, ${30} ${10}`}
                stroke={isActive ? '#ffffff' : '#000000'}
                strokeWidth={size}
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
