const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./middleware/auth');

let io = null;

/**
 * Inicializa Socket.IO con el servidor HTTP
 * @param {http.Server} server - Servidor HTTP de Express
 * @returns {SocketIOServer} Instancia de Socket.IO
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: false
    },
    transports: ['websocket', 'polling'],
    // Configuración para ngrok y proxies reversos
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    // Permitir upgrade de polling a websocket
    upgradeTimeout: 30000,
    // Configuración para trabajar detrás de proxies
    path: '/socket.io/',
    // Asegurar que funcione con ngrok
    serveClient: true
  });

  // Middleware de autenticación para Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      // Permitir conexiones sin token, pero marcar como no autenticado
      socket.user = null;
      return next();
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        // Si el token es inválido, permitir la conexión pero sin usuario
        socket.user = null;
        return next();
      }
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado (Socket ID: ${socket.id})`);
    if (socket.user) {
      console.log(`   Usuario: ${socket.user.username} (Rol: ${socket.user.role || 'N/A'})`);
    } else {
      console.log(`   Usuario: No autenticado`);
    }

    // Evento de prueba de conexión
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Cliente desconectado (Socket ID: ${socket.id})`);
    });
  });

  console.log('✅ Socket.IO inicializado');
  return io;
}

/**
 * Obtiene la instancia de Socket.IO
 * @returns {SocketIOServer|null} Instancia de Socket.IO o null si no está inicializada
 */
function getIO() {
  return io;
}

/**
 * Emite un evento a todos los clientes conectados
 * @param {string} event - Nombre del evento
 * @param {any} data - Datos a enviar
 */
function emitToAll(event, data) {
  if (io) {
    io.emit(event, data);
    console.log(`📡 Evento emitido a todos: ${event}`);
  }
}

/**
 * Emite un evento a todos excepto al socket que originó el cambio
 * @param {string} event - Nombre del evento
 * @param {any} data - Datos a enviar
 * @param {string} excludeSocketId - ID del socket a excluir
 */
function emitToOthers(event, data, excludeSocketId) {
  if (io) {
    if (excludeSocketId) {
      io.except(excludeSocketId).emit(event, data);
      console.log(`📡 Evento emitido a otros: ${event} (excluyendo ${excludeSocketId})`);
    } else {
      emitToAll(event, data);
    }
  }
}

/**
 * Emite un evento de actualización para una entidad específica
 * @param {string} entity - Nombre de la entidad (clients, payments, etc.)
 * @param {string} action - Acción realizada (created, updated, deleted)
 * @param {any} data - Datos relacionados
 * @param {string} excludeSocketId - ID del socket a excluir (opcional)
 */
function emitEntityUpdate(entity, action, data, excludeSocketId = null) {
  const event = `${entity}:${action}`;
  const payload = {
    entity,
    action,
    data,
    timestamp: new Date().toISOString()
  };

  if (excludeSocketId) {
    emitToOthers(event, payload, excludeSocketId);
  } else {
    emitToAll(event, payload);
  }
}

/**
 * Emite cuando se desbloquea el portal de un cliente (reset manual o expiración).
 * Los clientes en pantalla bloqueada verifican block-status al recibir este evento.
 */
function emitPortalBlockCleared(ip) {
  if (io) {
    io.emit('portal_block_cleared', { ip, timestamp: new Date().toISOString() });
  }
}

module.exports = {
  initSocket,
  getIO,
  emitToAll,
  emitToOthers,
  emitEntityUpdate,
  emitPortalBlockCleared
};

















