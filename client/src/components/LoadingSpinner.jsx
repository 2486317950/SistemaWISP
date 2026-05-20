import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ message = 'Cargando...', fullScreen = false, size = 'medium' }) => {
  const sizeClass = `spinner-${size}`;
  
  if (fullScreen) {
    return (
      <div className="loading-spinner-fullscreen">
        <div className="loading-spinner-container">
          <div className={`loading-spinner ${sizeClass}`}>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          {message && <p className="loading-message">{message}</p>}
        </div>
      </div>
    );
  }
  
  return (
    <div className="loading-spinner-container">
      <div className={`loading-spinner ${sizeClass}`}>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;




















