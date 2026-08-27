import React from 'react';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

const COLORS = [
  { value: '#000000', label: 'Schwarz' },
  { value: '#333333', label: 'Dunkelgrau' },
  { value: '#666666', label: 'Grau' },
];

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {COLORS.map((color) => {
        const isActive = value === color.value;
        return (
          <button
            key={color.value}
            onClick={() => onChange(color.value)}
            title={color.label}
            style={{
              width: 48,
              height: 48,
              minWidth: 48,
              minHeight: 48,
              padding: 0,
              border: isActive ? '3px solid #000000' : '1px solid #000000',
              borderRadius: '50%',
              backgroundColor: color.value,
              cursor: 'pointer',
              outline: isActive ? '3px solid #ffffff' : 'none',
              outlineOffset: -6,
            }}
          />
        );
      })}
    </div>
  );
}
