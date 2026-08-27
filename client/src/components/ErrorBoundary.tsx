import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Candle Error]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'white',
          color: 'black',
          padding: '20px',
          fontFamily: 'monospace',
          fontSize: '14px',
          zIndex: 9999,
          overflow: 'auto'
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>🕯️ Candle — Fehler</h2>
          <p style={{ marginBottom: '10px' }}>{this.state.error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              background: '#000',
              color: '#fff',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Neu laden
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
