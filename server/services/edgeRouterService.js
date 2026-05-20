/**
 * Servicio de integración con EdgeRouter ER-X-SFP
 * 
 * Este servicio orquesta las operaciones relacionadas con el router:
 * - Suspender/activar clientes
 * - Obtener información de conexión
 * - Manejar errores y logging
 * 
 * ACTUALMENTE EN MODO MOCK:
 * - Las operaciones solo actualizan la BD y escriben logs
 * - NO ejecutan comandos reales en el router
 */

const db = require('../database');
const edgeRouterClient = require('./edgeRouterClient');

class EdgeRouterService {
  constructor() {
    this.client = edgeRouterClient;
  }

  /**
   * Obtener información de conexión de un cliente
   * @param {number} clientId - ID del cliente
   * @returns {Promise<object>} Información de conexión (IP, MAC, etc.)
   */
  async getClientConnectionInfo(clientId) {
    return new Promise((resolve, reject) => {
      const database = db.getDb();
      
      // Obtener IP del cliente desde la tabla clients o ip_credentials
      // Nota: ip_credentials no tiene columna mac_address, solo device_type
      database.all(`
        SELECT 
          c.id,
          c.name,
          c.ip_address as client_ip,
          ip.ip_address as credential_ip,
          ip.device_type
        FROM clients c
        LEFT JOIN ip_credentials ip ON c.id = ip.client_id
        WHERE c.id = ?
        ORDER BY ip.id DESC
        LIMIT 1
      `, [clientId], (err, rows) => {
        if (err) {
          console.error(`❌ Error al obtener info de conexión del cliente ${clientId}:`, err);
          reject(err);
          return;
        }

        if (!rows || rows.length === 0) {
          reject(new Error(`Cliente ${clientId} no encontrado`));
          return;
        }

        const clientInfo = rows[0];
        const ipAddress = clientInfo.credential_ip || clientInfo.client_ip;

        if (!ipAddress) {
          reject(new Error(`Cliente ${clientId} no tiene IP configurada`));
          return;
        }

        resolve({
          clientId: clientInfo.id,
          clientName: clientInfo.name,
          ipAddress: ipAddress,
          macAddress: null, // No disponible en ip_credentials actualmente
          deviceType: clientInfo.device_type || null
        });
      });
    });
  }

  /**
   * Suspender un cliente (bloquear acceso a internet)
   * @param {number} clientId - ID del cliente
   * @param {object} options - Opciones adicionales (opcional)
   * @returns {Promise<object>} Resultado de la operación
   */
  async suspendClient(clientId, options = {}) {
    try {
      console.log(`\n🔴 [EdgeRouterService] Iniciando suspensión del cliente ${clientId}...`);

      // Obtener información de conexión del cliente
      const connectionInfo = await this.getClientConnectionInfo(clientId);
      console.log(`   Cliente: ${connectionInfo.clientName}`);
      console.log(`   IP: ${connectionInfo.ipAddress}`);

      // Conectar al router (mock por ahora)
      const connected = await this.client.connect();
      if (!connected) {
        throw new Error('No se pudo conectar al EdgeRouter');
      }

      // Suspender tráfico en el router (mock por ahora)
      const routerResult = await this.client.suspendTraffic(connectionInfo.ipAddress, options);
      
      if (!routerResult) {
        throw new Error('No se pudo suspender el tráfico en el router');
      }

      // TODO: FUTURO - Aquí se podría agregar lógica adicional:
      // - Actualizar tabla de historial de suspensiones
      // - Enviar notificación al cliente
      // - Registrar en sistema de facturación
      // - etc.

      console.log(`✅ [EdgeRouterService] Cliente ${clientId} suspendido exitosamente`);
      console.log(`   IP bloqueada: ${connectionInfo.ipAddress}\n`);

      return {
        success: true,
        clientId: clientId,
        clientName: connectionInfo.clientName,
        ipAddress: connectionInfo.ipAddress,
        action: 'suspended',
        timestamp: new Date().toISOString(),
        routerResult: routerResult
      };

    } catch (error) {
      console.error(`❌ [EdgeRouterService] Error al suspender cliente ${clientId}:`, error.message);
      
      // En modo mock, aún así retornamos éxito porque solo actualizamos BD
      // En modo real, esto debería fallar si el router no responde
      if (this.client.config.mockMode) {
        console.log(`⚠️  [EdgeRouterService] Modo mock: Continuando a pesar del error`);
        return {
          success: true,
          clientId: clientId,
          action: 'suspended',
          timestamp: new Date().toISOString(),
          warning: 'Operación completada en modo mock',
          error: error.message
        };
      }

      throw error;
    } finally {
      // Desconectar del router
      await this.client.disconnect();
    }
  }

  /**
   * Activar un cliente (permitir acceso a internet)
   * @param {number} clientId - ID del cliente
   * @param {object} options - Opciones adicionales (opcional)
   * @returns {Promise<object>} Resultado de la operación
   */
  async activateClient(clientId, options = {}) {
    try {
      console.log(`\n🟢 [EdgeRouterService] Iniciando activación del cliente ${clientId}...`);

      // Obtener información de conexión del cliente
      const connectionInfo = await this.getClientConnectionInfo(clientId);
      console.log(`   Cliente: ${connectionInfo.clientName}`);
      console.log(`   IP: ${connectionInfo.ipAddress}`);

      // Conectar al router (mock por ahora)
      const connected = await this.client.connect();
      if (!connected) {
        throw new Error('No se pudo conectar al EdgeRouter');
      }

      // Activar tráfico en el router (mock por ahora)
      const routerResult = await this.client.activateTraffic(connectionInfo.ipAddress, options);
      
      if (!routerResult) {
        throw new Error('No se pudo activar el tráfico en el router');
      }

      // TODO: FUTURO - Aquí se podría agregar lógica adicional:
      // - Actualizar tabla de historial de activaciones
      // - Enviar notificación al cliente
      // - Verificar que el cliente esté al día con pagos
      // - etc.

      console.log(`✅ [EdgeRouterService] Cliente ${clientId} activado exitosamente`);
      console.log(`   IP desbloqueada: ${connectionInfo.ipAddress}\n`);

      return {
        success: true,
        clientId: clientId,
        clientName: connectionInfo.clientName,
        ipAddress: connectionInfo.ipAddress,
        action: 'activated',
        timestamp: new Date().toISOString(),
        routerResult: routerResult
      };

    } catch (error) {
      console.error(`❌ [EdgeRouterService] Error al activar cliente ${clientId}:`, error.message);
      
      // En modo mock, aún así retornamos éxito porque solo actualizamos BD
      // En modo real, esto debería fallar si el router no responde
      if (this.client.config.mockMode) {
        console.log(`⚠️  [EdgeRouterService] Modo mock: Continuando a pesar del error`);
        return {
          success: true,
          clientId: clientId,
          action: 'activated',
          timestamp: new Date().toISOString(),
          warning: 'Operación completada en modo mock',
          error: error.message
        };
      }

      throw error;
    } finally {
      // Desconectar del router
      await this.client.disconnect();
    }
  }

  /**
   * Verificar si el servicio está disponible
   * @returns {Promise<boolean>} true si está disponible
   */
  async isAvailable() {
    try {
      const connected = await this.client.connect();
      await this.client.disconnect();
      return connected;
    } catch (error) {
      console.error('❌ [EdgeRouterService] Router no disponible:', error.message);
      return false;
    }
  }
}

// Exportar instancia singleton
module.exports = new EdgeRouterService();

