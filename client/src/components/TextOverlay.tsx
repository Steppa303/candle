import React, { useEffect, useState } from 'react';

interface TextOverlayProps {
  text: string | null;
  duration?: number; // Auto-dismiss in ms
  onDismiss?: () => void;
}

export function TextOverlay({ text, duration = 8000, onDismiss }: TextOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (text) {
      setVisible(true);
      
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [text, duration, onDismiss]);

  if (!visible || !text) return null;

  return (
    <div 
      className="absolute bottom-20 left-4 right-4 z-10"
      onClick={() => {
        setVisible(false);
        onDismiss?.();
      }}
    >
      <div 
        className="bg-white border-2 border-black p-4 shadow-lg"
        style={{ 
          maxHeight: '200px', 
          overflowY: 'auto',
          fontSize: '18px',
          lineHeight: '1.5'
        }}
      >
        <div className="flex justify-between items-start gap-2">
          <p className="text-black font-medium flex-1">{text}</p>
          <button 
            className="text-black font-bold text-xl leading-none p-1"
            onClick={(e) => {
              e.stopPropagation();
              setVisible(false);
              onDismiss?.();
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
