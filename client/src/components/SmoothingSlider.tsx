import React from 'react';

interface SmoothingSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function SmoothingSlider({ value, onChange }: SmoothingSliderProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', minWidth: 140 }}>
      <label
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: '#000000',
          textAlign: 'center',
        }}
      >
        Glättung: {value.toFixed(2)}
      </label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%',
          height: 48,
          WebkitAppearance: 'none',
          appearance: 'none',
          background: 'transparent',
          cursor: 'pointer',
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          fontSize: 12,
          color: '#666666',
        }}
      >
        <span>0.00</span>
        <span>1.00</span>
      </div>
    </div>
  );
}
