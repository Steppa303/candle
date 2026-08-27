import React from 'react';
import { DebounceSlider } from './DebounceSlider';

interface ToolbarProps {
  sessionName: string;
  onSessionClick: () => void;
  strokeColor: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onWidthChange: (width: number) => void;
  onClear: () => void;
  onNewSession: () => void;
  isThinking: boolean;
  smoothingEnabled: boolean;
  onSmoothingChange: (enabled: boolean) => void;
}

const COLORS = [
  { value: '#000000', label: 'Schwarz' },
  { value: '#333333', label: 'Dunkelgrau' },
  { value: '#666666', label: 'Grau' },
];

const WIDTHS = [1, 2, 3, 4, 5];

export function Toolbar({
  sessionName,
  onSessionClick,
  strokeColor,
  onColorChange,
  strokeWidth,
  onWidthChange,
  onClear,
  onNewSession,
  isThinking,
  smoothingEnabled,
  onSmoothingChange
}: ToolbarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-black">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        {/* Left: Session name */}
        <button
          onClick={onSessionClick}
          className="flex-shrink-0 px-3 py-2 text-sm font-medium truncate max-w-[120px] border-2 border-black"
          title="Session wechseln"
        >
          {sessionName || 'Keine Session'}
        </button>

        {/* Center: Drawing tools */}
        <div className="flex items-center gap-2 flex-1 justify-center">
          {/* Color picker */}
          <div className="flex gap-1">
            {COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => onColorChange(color.value)}
                className="w-8 h-8 border-2 border-black"
                style={{ 
                  backgroundColor: color.value,
                  outline: strokeColor === color.value ? '3px solid white' : 'none',
                  outlineOffset: '-3px'
                }}
                title={color.label}
              />
            ))}
          </div>

          {/* Width picker */}
          <select
            value={strokeWidth}
            onChange={(e) => onWidthChange(parseInt(e.target.value, 10))}
            className="h-8 px-2 border-2 border-black bg-white text-sm"
          >
            {WIDTHS.map((w) => (
              <option key={w} value={w}>
                {w}px
              </option>
            ))}
          </select>

          {/* Clear button */}
          <button
            onClick={onClear}
            className="px-3 py-2 text-sm border-2 border-black"
            title="Canvas leeren"
          >
            Löschen
          </button>

          {/* Smoothing toggle */}
          <button
            onClick={() => onSmoothingChange(!smoothingEnabled)}
            className={`px-3 py-2 text-sm border-2 border-black ${
              smoothingEnabled ? 'bg-black text-white' : 'bg-white text-black'
            }`}
            title={smoothingEnabled ? 'Glättung AN' : 'Glättung AUS'}
          >
            {smoothingEnabled ? '◉ Glatt' : '○ Raw'}
          </button>
        </div>

        {/* Right: Debounce + New Session */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <DebounceSlider />
          
          <button
            onClick={onNewSession}
            className="px-3 py-2 text-sm font-bold border-2 border-black"
            title="Neue Session"
          >
            + Neu
          </button>
        </div>
      </div>

      {/* Thinking indicator */}
      {isThinking && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-1 text-sm">
          KI denkt nach...
        </div>
      )}
    </div>
  );
}
