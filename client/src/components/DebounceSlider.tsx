import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'candle_debounce';
const MIN_MS = 200;
const MAX_MS = 3000;
const DEFAULT_MS = 500;

interface DebounceSliderProps {
  onChange?: (value: number) => void;
}

export function DebounceSlider({ onChange }: DebounceSliderProps) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_MS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(value));
    onChange?.(value);
  }, [value, onChange]);

  return (
    <div className="flex flex-col items-center gap-1">
      <label className="text-xs text-ink-medium whitespace-nowrap">
        Verzögerung: {value}ms
      </label>
      <input
        type="range"
        min={MIN_MS}
        max={MAX_MS}
        step={100}
        value={value}
        onChange={(e) => setValue(parseInt(e.target.value, 10))}
        className="w-24"
      />
    </div>
  );
}
