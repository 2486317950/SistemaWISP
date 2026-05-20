import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'
import './styles/responsive.css'

console.log('🚀 Iniciando aplicación React...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('❌ No se encontró el elemento root');
  document.body.innerHTML = '<h1 style="padding: 20px; color: red;">Error: No se encontró el elemento root</h1>';
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
    
    console.log('✅ Aplicación React renderizada correctamente');
  } catch (error) {
    console.error('❌ Error crítico al renderizar la aplicación:', error);
    rootElement.innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: Arial, sans-serif; background: #f5f5f5; min-height: 100vh;">
        <h1 style="color: #e74c3c;">⚠️ Error al cargar la aplicación</h1>
        <p style="color: #7f8c8d; margin: 20px 0;">${error.message}</p>
        <pre style="background: #2c3e50; color: #ecf0f1; padding: 20px; border-radius: 5px; text-align: left; overflow: auto; max-width: 800px; margin: 20px auto;">
${error.stack || error.toString()}
        </pre>
        <button 
          onclick="window.location.reload()" 
          style="padding: 12px 24px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; margin-top: 20px;"
        >
          Recargar página
        </button>
      </div>
    `;
  }
}
