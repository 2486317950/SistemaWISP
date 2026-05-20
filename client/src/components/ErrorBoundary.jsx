import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 24,
          maxWidth: 480,
          margin: '40px auto',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          color: '#333'
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>Algo salió mal</h1>
          <p style={{ color: '#666', marginBottom: 24 }}>
            Ocurrió un error inesperado. Recarga la página o intenta de nuevo más tarde.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              fontSize: 16,
              backgroundColor: '#0d9488',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
