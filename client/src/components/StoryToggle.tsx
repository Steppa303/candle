import React from 'react';

interface StoryToggleProps {
  storyMode: boolean;
  onToggle: () => void;
}

export function StoryToggle({ storyMode, onToggle }: StoryToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 active:bg-gray-200 transition-colors"
      style={{ minHeight: 48 }}
      title={storyMode ? 'Story-Modus deaktivieren' : 'Story-Modus aktivieren'}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 4h2v16H4V4zm4 0h12c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H8V4zm2 4h8v2h-2v-2zm0 4h8v2h-2v-2z"
          fill={storyMode ? '#333' : '#999'}
        />
      </svg>
      <span className="text-sm font-medium" style={{ color: storyMode ? '#333' : '#999' }}>
        {storyMode ? 'Story AN' : 'Story AUS'}
      </span>
    </button>
  );
}
