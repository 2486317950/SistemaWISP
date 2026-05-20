import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const { user } = useAuth();
  const [theme, setTheme] = useState('light');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadTheme();
    }
  }, [user]);

  const loadTheme = async () => {
    try {
      const response = await api.get('/theme-settings');
      if (response.data && response.data.theme_mode) {
        setTheme(response.data.theme_mode);
        applyTheme(response.data.theme_mode);
      }
    } catch (error) {
      console.error('Error al cargar tema:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (themeMode) => {
    document.documentElement.setAttribute('data-theme', themeMode);
    if (themeMode === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    applyTheme(newTheme);

    try {
      await api.put('/theme-settings', { theme_mode: newTheme });
    } catch (error) {
      console.error('Error al guardar tema:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
};











