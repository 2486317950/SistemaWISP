import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const useKeyboardShortcuts = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K o Cmd+K para búsqueda global
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
          searchInput.focus();
        }
      }

      // Ctrl+1-9 para navegación rápida
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const shortcuts = {
      '1': '/sistema',
      '2': '/sistema/clients',
      '3': '/sistema/payments',
      '4': '/sistema/installations',
          '5': '/folios',
          '6': '/monthly-reports',
          '7': '/settings'
        };
        const route = shortcuts[e.key];
        if (route) {
          navigate(route);
        }
      }

      // Escape para cerrar modales
      if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => {
          const closeBtn = modal.querySelector('.btn-cancel, [onClick*="close"]');
          if (closeBtn) {
            closeBtn.click();
          }
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
};











