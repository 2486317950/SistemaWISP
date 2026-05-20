import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    return {
      socket: null,
      isConnected: false,
      subscribe: () => {},
      unsubscribe: () => {}
    };
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      // Si no está autenticado, no crear conexión
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Obtener la URL del servidor
    const getServerURL = () => {
      if (import.meta.env.DEV) {
        // En desarrollo, el servidor está en localhost:5000
        return 'http://localhost:5000';
      }
      // En producción, usar la misma URL del frontend
      return window.location.origin;
    };

    const serverURL = getServerURL();
    const token = localStorage.getItem('token');

    // Crear conexión Socket.IO
    const newSocket = io(serverURL, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket.IO conectado:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Socket.IO desconectado');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Error de conexión Socket.IO:', error.message);
      setIsConnected(false);
    });

    newSocket.on('pong', (data) => {
      console.log('🏓 Pong recibido:', data);
    });

    setSocket(newSocket);

    // Limpiar al desmontar o al cambiar de usuario
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [isAuthenticated, user]);

  /**
   * Suscribirse a eventos de una entidad específica
   * @param {string} entity - Nombre de la entidad (clients, payments, etc.)
   * @param {function} callback - Función a llamar cuando se recibe un evento
   */
  const subscribe = (entity, callback) => {
    if (!socket || !isConnected) {
      console.warn('Socket no está conectado, no se puede suscribir a:', entity);
      return () => {};
    }

    const events = [`${entity}:created`, `${entity}:updated`, `${entity}:deleted`];
    
    events.forEach(event => {
      socket.on(event, (data) => {
        console.log(`📡 Evento recibido: ${event}`, data);
        callback(event, data);
      });
    });

    // Retornar función para desuscribirse
    return () => {
      events.forEach(event => {
        socket.off(event);
      });
    };
  };

  /**
   * Desuscribirse de eventos de una entidad específica
   * @param {string} entity - Nombre de la entidad
   */
  const unsubscribe = (entity) => {
    if (!socket) return;

    const events = [`${entity}:created`, `${entity}:updated`, `${entity}:deleted`];
    events.forEach(event => {
      socket.off(event);
    });
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, subscribe, unsubscribe }}>
      {children}
    </SocketContext.Provider>
  );
};

























