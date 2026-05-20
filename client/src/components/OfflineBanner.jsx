import React from 'react';
import { useOnline } from '../hooks/useOnline';
import './OfflineBanner.css';

export default function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-banner" role="alert" aria-live="polite">
      Sin conexión. Revisa tu red e inténtalo de nuevo.
    </div>
  );
}
