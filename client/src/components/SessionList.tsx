import React, { useState } from 'react';

interface Session {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

interface SessionListProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onNew: () => void;
  onClose: () => void;
}

export function SessionList({
  sessions,
  currentSessionId,
  onSelect,
  onDelete,
  onNew,
  onClose
}: SessionListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white border-2 border-black w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-black">
          <h2 className="text-lg font-bold">Sessions</h2>
          <button onClick={onClose} className="text-xl font-bold p-1">
            ✕
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-ink-medium">
              Keine Sessions vorhanden
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center gap-3 p-4 border-b border-ink-lighter cursor-pointer ${
                  session.id === currentSessionId ? 'bg-ink-lighter' : ''
                }`}
                onClick={() => {
                  onSelect(session.id);
                  onClose();
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{session.name}</div>
                  <div className="text-sm text-ink-medium">
                    {formatDate(session.updated_at)}
                  </div>
                </div>
                
                {confirmDelete === session.id ? (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(session.id);
                        setConfirmDelete(null);
                      }}
                      className="px-3 py-1 text-sm bg-black text-white"
                    >
                      Löschen
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(null);
                      }}
                      className="px-3 py-1 text-sm"
                    >
                      Abbrechen
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(session.id);
                    }}
                    className="text-ink-medium hover:text-black p-2"
                    title="Löschen"
                  >
                    🗑
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer with new session button */}
        <div className="p-4 border-t-2 border-black">
          <button
            onClick={() => {
              onNew();
              onClose();
            }}
            className="w-full py-3 bg-black text-white font-bold"
          >
            + Neue Session
          </button>
        </div>
      </div>
    </div>
  );
}
