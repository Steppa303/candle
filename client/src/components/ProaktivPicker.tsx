import React from 'react';

interface ProaktivPickerProps {
  value: number;
  onChange: (delay: number) => void;
}

const OPTIONS = [
  { value: 0, label: 'Aus' },
  { value: 15000, label: '15s' },
  { value: 30000, label: '30s' },
  { value: 60000, label: '1 Min' },
  { value: 120000, label: '2 Min' },
];

export function ProaktivPicker({ value, onChange }: ProaktivPickerProps) {
  return (
    <div className="flex flex-col gap-1 p-2">
      <div className="text-xs font-bold mb-1">KI Initiativ</div>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-2 text-sm border-2 border-black text-left ${
            value === opt.value ? 'bg-black text-white' : 'bg-white'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
