const db = require('../database');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class TrafficMonitor {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.interval = 60000; // 1 minuto por defecto
    this.clients = new Map(); // Cache de clientes con sus IPs
  }

  // Iniciar el monitoreo
  start(intervalSeconds = 60) {
    if (this.isRunning) {
      console.log('⚠️  El monitor de tráfico ya está en ejecución');
      return;
    }

    this.interval = intervalSeconds * 1000;
    this.isRunning = true;
    
    console.log(`🚀 Iniciando monitor de tráfico (intervalo: ${intervalSeconds} segundos)`);
    
    // Cargar clientes con IPs al iniciar
    this.loadClientsWithIPs();
    
    // Ejecutar monitoreo inmediatamente
    this.monitor();
    
    // Ejecutar periódicamente
    this.intervalId = setInterval(() => {
      this.monitor();
    }, this.interval);
  }

  // Detener el monitoreo
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('⏹️  Monitor de tráfico detenido');
  }

  // Cargar clientes con sus IPs desde la base de datos
  loadClientsWithIPs() {
    const database = db.getDb();
    
    // Obtener clientes con IPs desde dos fuentes:
    // 1. Tabla ip_credentials (puede tener múltiples IPs por cliente)
    // 2. Columna ip_address en clients (una IP por cliente)
    database.all(`
      SELECT 
        c.id as client_id,
        ip.ip_address,
        ip.device_type,
        'ip_credential' as source
      FROM clients c
      INNER JOIN ip_credentials ip ON c.id = ip.client_id
      WHERE ip.ip_address IS NOT NULL AND ip.ip_address != '' AND ip.ip_address != '0.0.0.0'
      
      UNION ALL
      
      SELECT 
        c.id as client_id,
        c.ip_address as ip_address,
        NULL as device_type,
        'client' as source
      FROM clients c
      WHERE c.ip_address IS NOT NULL AND c.ip_address != '' AND c.ip_address != '0.0.0.0'
        AND NOT EXISTS (
          SELECT 1 FROM ip_credentials ip2 
          WHERE ip2.client_id = c.id 
          AND ip2.ip_address = c.ip_address
        )
      
      ORDER BY client_id, ip_address
    `, [], (err, rows) => {
      if (err) {
        console.error('Error al cargar clientes con IPs:', err);
        return;
      }

      this.clients.clear();
      
      if (rows && rows.length > 0) {
        console.log(`🔍 Encontradas ${rows.length} filas con IPs`);
        rows.forEach((row, index) => {
          const key = `${row.client_id}_${row.ip_address}`;
          if (!this.clients.has(key)) {
            this.clients.set(key, {
              client_id: row.client_id,
              ip_address: row.ip_address,
              mac_address: null, // No disponible en la tabla actual
              device_type: row.device_type || null
            });
            if (index < 5) { // Log primeros 5 para debug
              console.log(`   - Cliente ${row.client_id}: ${row.ip_address} (${row.source || 'unknown'})`);
            }
          }
        });
        
        const uniqueClients = new Set(rows.map(r => r.client_id));
        console.log(`📋 Cargados ${this.clients.size} registros de IPs para ${uniqueClients.size} clientes únicos`);
      } else {
        console.log('⚠️  No hay clientes con IPs configuradas para monitoreo.');
        console.log('   Para monitorear clientes:');
        console.log('   1. Agrega IPs en la sección "IPs y Contraseñas"');
        console.log('   2. O agrega IPs directamente en el formulario de clientes (campo "Dirección IP")');
        console.log('   3. O usa el botón "Generar Datos de Ejemplo" en la página de Tráfico');
      }
    });
  }

  // Monitorear todos los clientes
  async monitor() {
    if (!this.isRunning) return;

    console.log(`🔍 Iniciando monitoreo de tráfico (${new Date().toLocaleTimeString()})...`);
    
    // Recargar clientes periódicamente (cada 10 ciclos)
    if (!this.lastReload || Date.now() - this.lastReload > 600000) { // 10 minutos
      this.loadClientsWithIPs();
      this.lastReload = Date.now();
    }

    const database = db.getDb();
    const now = new Date().toISOString();
    let monitored = 0;
    let updated = 0;
    let onlineCount = 0;
    let offlineCount = 0;

    // Monitorear cada cliente (secuencial para evitar sobrecarga de red)
    for (const [key, clientInfo] of this.clients.entries()) {
      try {
        // Hacer ping a la IP (funciona independientemente de la red del servidor si hay routing)
        let status = await this.checkClientStatus(clientInfo.ip_address);
        
        // Si el ping falla, intentar verificación alternativa (HTTP) para dispositivos que no responden a ping
        if (!status.isOnline) {
          const httpStatus = await this.checkHttpStatus(clientInfo.ip_address);
          if (httpStatus.isOnline) {
            // Si HTTP responde, considerar el dispositivo como online
            status.isOnline = true;
            status.latency = httpStatus.latency || status.latency;
            console.log(`⚠️  ${clientInfo.ip_address} no responde a ping pero responde a HTTP - marcado como online`);
          }
        }
        
        // Si está online, obtener métricas
        const metrics = status.isOnline 
          ? await this.getClientMetrics(clientInfo.ip_address)
          : await this.getClientMetrics(clientInfo.ip_address); // Obtener métricas incluso si está offline
        
        // Combinar métricas con estadísticas de paquetes del ping
        metrics.packetsSent = status.packetsSent || 0;
        metrics.packetsReceived = status.packetsReceived || 0;
        metrics.packetsTotal = (status.packetsSent || 0) + (status.packetsReceived || 0);
        
        if (status.isOnline) {
          onlineCount++;
        } else {
          offlineCount++;
        }
        
        // Actualizar o crear registro en la base de datos
        database.get(
          'SELECT id, bandwidth_usage FROM client_traffic WHERE client_id = ?',
          [clientInfo.client_id],
          (err, existing) => {
            if (err) {
              console.error(`Error al verificar tráfico para cliente ${clientInfo.client_id}:`, err);
              return;
            }

            // Obtener métricas primero
            const downloadSpeed = metrics.downloadSpeed;
            const uploadSpeed = metrics.uploadSpeed;
            const latency = metrics.latency;
            const packetLoss = metrics.packetLoss;
            const packetsSent = metrics.packetsSent || 0;
            const packetsReceived = metrics.packetsReceived || 0;
            const packetsTotal = metrics.packetsTotal || 0;

            // Estimar consumo (bytes) en este ciclo: velocidad × tiempo × factor de utilización (~15 %)
            const intervalSeconds = this.interval / 1000;
            const speedMbps = (parseFloat(downloadSpeed) || 0) + (parseFloat(uploadSpeed) || 0);
            const bytesThisCycle = status.isOnline && speedMbps > 0
              ? Math.round(speedMbps * 1e6 / 8 * intervalSeconds * 0.15)
              : 0;
            const currentUsage = parseFloat(existing?.bandwidth_usage) || 0;
            const newBandwidthUsage = currentUsage + bytesThisCycle;
            
            // Determinar estado de conexión basado en métricas
            let connectionStatus = 'desconectado';
            
            if (status.isOnline) {
              // Si está online, verificar si hay problemas
              const hasHighLatency = latency && latency > 200; // Latencia mayor a 200ms
              const hasHighPacketLoss = packetLoss && packetLoss > 3; // Pérdida de paquetes mayor a 3%
              const hasPartialResponse = packetsReceived > 0 && packetsReceived < packetsSent; // Respuestas parciales
              const hasVeryLowSpeed = downloadSpeed && downloadSpeed < 1; // Velocidad muy baja (< 1 Mbps)
              
              // Calcular pérdida de paquetes real si no está en métricas
              const calculatedPacketLoss = packetsSent > 0 
                ? ((packetsSent - packetsReceived) / packetsSent) * 100 
                : null;
              const hasCalculatedHighLoss = calculatedPacketLoss && calculatedPacketLoss > 3;
              
              // Marcar como problema si cumple alguna condición
              if (hasHighLatency || hasHighPacketLoss || hasCalculatedHighLoss || hasPartialResponse || hasVeryLowSpeed) {
                connectionStatus = 'problema';
              } else {
                connectionStatus = 'conectado';
              }
            }
            
            // Calcular pérdida de paquetes final (usar calculada si no hay métrica)
            const finalPacketLoss = packetLoss || (packetsSent > 0 ? ((packetsSent - packetsReceived) / packetsSent) * 100 : null);

            if (existing) {
              // Actualizar registro existente
              database.run(
                `UPDATE client_traffic 
                 SET connection_status = ?,
                     download_speed = ?,
                     upload_speed = ?,
                     latency = ?,
                     packet_loss = ?,
                     packets_sent = ?,
                     packets_received = ?,
                     packets_total = ?,
                     bandwidth_usage = ?,
                     last_seen = ?,
                     ip_address = ?,
                     mac_address = ?,
                     device_type = ?,
                     updated_at = ?
                 WHERE client_id = ?`,
                [
                  connectionStatus,
                  downloadSpeed,
                  uploadSpeed,
                  latency,
                  finalPacketLoss,
                  packetsSent,
                  packetsReceived,
                  packetsTotal,
                  newBandwidthUsage,
                  status.isOnline ? now : null,
                  clientInfo.ip_address,
                  clientInfo.mac_address || null,
                  clientInfo.device_type || null,
                  now,
                  clientInfo.client_id
                ],
                (err) => {
                  if (err) {
                    console.error(`Error al actualizar tráfico para cliente ${clientInfo.client_id}:`, err);
                  } else {
                    updated++;
                    monitored++;
                    if (monitored === this.clients.size) {
                      console.log(`✅ Monitoreo completado: ${updated} clientes actualizados`);
                    }
                  }
                }
              );
            } else {
              // Crear nuevo registro
              database.run(
                `INSERT INTO client_traffic (
                  client_id, connection_status, download_speed, upload_speed, 
                  latency, packet_loss, packets_sent, packets_received, packets_total,
                  bandwidth_usage, last_seen, ip_address, mac_address, device_type, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  clientInfo.client_id,
                  connectionStatus,
                  downloadSpeed,
                  uploadSpeed,
                  latency,
                  finalPacketLoss,
                  packetsSent,
                  packetsReceived,
                  packetsTotal,
                  newBandwidthUsage,
                  status.isOnline ? now : null,
                  clientInfo.ip_address,
                  clientInfo.mac_address || null,
                  clientInfo.device_type || null,
                  now
                ],
                (err) => {
                  if (err) {
                    console.error(`Error al crear tráfico para cliente ${clientInfo.client_id}:`, err);
                  } else {
                    updated++;
                    monitored++;
                    if (monitored === this.clients.size) {
                      console.log(`✅ Monitoreo completado: ${updated} clientes actualizados`);
                    }
                  }
                }
              );
            }
          }
        );
      } catch (error) {
        console.error(`Error al monitorear cliente ${clientInfo.client_id}:`, error);
        monitored++;
        offlineCount++;
      }
    }

    // Mostrar resumen del monitoreo
    if (this.clients.size === 0) {
      console.log('ℹ️  No hay clientes con IPs configuradas para monitorear');
    } else {
      console.log(`✅ Monitoreo completado: ${onlineCount} online, ${offlineCount} offline de ${this.clients.size} IPs`);
    }
  }

  // Verificar si un cliente está online (ping)
  async checkClientStatus(ipAddress) {
    try {
      const platform = process.platform;
      let command;

      if (platform === 'win32') {
        // Windows: ping con 4 paquetes, timeout de 4 segundos (aumentado para mayor confiabilidad)
        // No usar -4 ya que puede causar problemas en algunas versiones de Windows
        command = `ping -n 4 -w 4000 ${ipAddress}`;
      } else {
        // Linux/Mac: ping con 4 paquetes, timeout de 4 segundos
        command = `ping -c 4 -W 4 ${ipAddress}`;
      }

      let stdout = '';
      let stderr = '';
      
      try {
        const result = await execAsync(command, { 
          timeout: 10000, // Timeout más largo para dar más tiempo
          maxBuffer: 1024 * 1024 // Buffer más grande
        });
        stdout = result.stdout || '';
        stderr = result.stderr || '';
      } catch (execError) {
        // El ping puede fallar si el dispositivo no responde, esto es normal
        // Intentar extraer stdout y stderr del error si están disponibles
        stdout = execError.stdout || '';
        stderr = execError.stderr || '';
        
        // Si no hay stdout/stderr en el error, el dispositivo probablemente está offline
        // Esto no es un error crítico, solo significa que el ping no tuvo éxito
        if (!stdout && !stderr) {
          // No hay salida, el dispositivo está offline
          return {
            isOnline: false,
            latency: null,
            packetsSent: 4,
            packetsReceived: 0
          };
        }
      }
      
      // Log para depuración (solo para IPs problemáticas)
      const debugIPs = ['192.168.0.192', '192.168.0.202'];
      const shouldDebug = debugIPs.includes(ipAddress);
      
      if (shouldDebug) {
        console.log(`🔍 Debug ping ${ipAddress}:`);
        console.log(`   stdout: ${stdout.substring(0, 400)}`);
        console.log(`   stderr: ${stderr || 'none'}`);
      }
      
      // Normalizar la salida para análisis
      const output = (stdout || '').toLowerCase();
      const hasError = stderr && stderr.trim().length > 0;
      
      // Verificar si el ping fue exitoso - múltiples patrones mejorados para Windows y Linux
      // Incluye más variaciones para dispositivos TPLink, Ubiquiti y otros
      const isOnline = !hasError && (
        // Windows patterns (mejorados)
        output.includes('ttl') || 
        output.includes('ttl=') ||
        output.includes('respuesta desde') || // Español Windows
        output.includes('reply from') || // Inglés Windows
        output.includes('bytes=') ||
        output.includes('bytes from') ||
        output.includes('tiempo') || // Español
        output.includes('time') ||
        // Linux/Mac patterns (mejorados)
        output.includes('time=') ||
        output.includes('time<') ||
        output.includes('0% packet loss') ||
        output.includes('0% pérdida') ||
        output.includes('1 received') ||
        output.includes('2 received') ||
        output.includes('3 received') ||
        output.includes('4 received') ||
        output.includes('icmp_seq') || // Linux ping response
        // Patrones adicionales mejorados
        /ttl\s*=\s*\d+/i.test(stdout) ||
        /time[<=]\d+ms/i.test(stdout) ||
        /time[<=]\d+\.\d+ms/i.test(stdout) ||
        /\d+\s*bytes\s*from/i.test(stdout) ||
        /\d+\s*bytes\s*recibidos/i.test(stdout) ||
        /\d+\s*bytes\s*received/i.test(stdout) ||
        // Patrones para dispositivos que responden de forma diferente
        /from\s+\d+\.\d+\.\d+\.\d+/i.test(stdout) ||
        /desde\s+\d+\.\d+\.\d+\.\d+/i.test(stdout) ||
        // Verificar que NO contiene mensajes de error comunes
        (!output.includes('host de destino inaccesible') &&
         !output.includes('destination host unreachable') &&
         !output.includes('timeout') &&
         !output.includes('expiró') &&
         !output.includes('100% loss') &&
         !output.includes('100% pérdida') &&
         stdout.length > 50) // Debe tener contenido significativo
      );

      // Extraer latencia promedio si está online
      let latency = null;
      let packetsSent = 4; // Por defecto enviamos 4 paquetes (aumentado para mayor confiabilidad)
      let packetsReceived = 0;
      
      if (isOnline) {
        // Buscar patrones de latencia en diferentes formatos
        const latencyPatterns = [
          /time[<=](\d+)/i,           // time=123 o time<123
          /TTL.*time[<=](\d+)/i,      // TTL=64 time=123
          /(\d+)ms/i,                 // 123ms
          /tiempo[<=](\d+)/i,         // tiempo=123 (español)
          /time=(\d+\.?\d*)/i,        // time=123.45
          /<(\d+)ms/i,                // <123ms
          /=(\d+)ms/i                 // =123ms
        ];
        
        for (const pattern of latencyPatterns) {
          const match = stdout.match(pattern);
          if (match) {
            latency = parseFloat(match[1]);
            break;
          }
        }
        
        // Extraer información de paquetes del ping
        // Windows: "Paquetes: enviados = 2, recibidos = 2, perdidos = 0"
        // Linux: "2 packets transmitted, 2 received, 0% packet loss"
        const windowsPacketsMatch = stdout.match(/Paquetes:\s*enviados\s*=\s*(\d+),\s*recibidos\s*=\s*(\d+)/i) ||
                                   stdout.match(/Packets:\s*Sent\s*=\s*(\d+),\s*Received\s*=\s*(\d+)/i);
        const linuxPacketsMatch = stdout.match(/(\d+)\s+packets?\s+transmitted[,\s]+(\d+)\s+received/i);
        
        if (windowsPacketsMatch) {
          packetsSent = parseInt(windowsPacketsMatch[1]) || 2;
          packetsReceived = parseInt(windowsPacketsMatch[2]) || 0;
        } else if (linuxPacketsMatch) {
          packetsSent = parseInt(linuxPacketsMatch[1]) || 2;
          packetsReceived = parseInt(linuxPacketsMatch[2]) || 0;
        } else {
          // Si no encontramos el patrón, contar las respuestas exitosas de múltiples formas
          const ttlMatches = (stdout.match(/TTL=/gi) || []).length;
          const timeMatches = (stdout.match(/time[<=]/gi) || []).length;
          const replyMatches = (stdout.match(/reply from/gi) || stdout.match(/respuesta desde/gi) || []).length;
          const bytesMatches = (stdout.match(/\d+\s*bytes\s*from/gi) || stdout.match(/\d+\s*bytes\s*recibidos/gi) || []).length;
          const icmpMatches = (stdout.match(/icmp_seq/gi) || []).length;
          
          // Usar el mayor número de coincidencias encontradas
          const responseCount = Math.max(ttlMatches, timeMatches, replyMatches, bytesMatches, icmpMatches);
          packetsReceived = responseCount > 0 ? responseCount : (isOnline ? 4 : 0);
        }
        
        if (shouldDebug) {
          console.log(`   ✅ Detectado como ONLINE con latencia: ${latency}ms, paquetes: ${packetsReceived}/${packetsSent}`);
        }
      } else {
        if (shouldDebug) {
          console.log(`   ❌ Detectado como OFFLINE`);
        }
      }

      return {
        isOnline,
        latency: latency || null,
        packetsSent,
        packetsReceived
      };
    } catch (error) {
      // Log para depuración
      const debugIPs = ['192.168.0.192', '192.168.0.202'];
      if (debugIPs.includes(ipAddress)) {
        console.log(`⚠️  Error al hacer ping a ${ipAddress}: ${error.message}`);
        console.log(`   Error completo:`, error);
      }
      
      return {
        isOnline: false,
        latency: null,
        packetsSent: 4,
        packetsReceived: 0
      };
    }
  }

  // Verificación alternativa mediante HTTP para dispositivos que no responden a ping
  async checkHttpStatus(ipAddress) {
    try {
      const http = require('http');
      const https = require('https');
      
      return new Promise((resolve) => {
        const startTime = Date.now();
        
        // Intentar HTTP primero (puerto 80)
        const req = http.request({
          hostname: ipAddress,
          port: 80,
          path: '/',
          method: 'HEAD',
          timeout: 3000
        }, (res) => {
          const latency = Date.now() - startTime;
          resolve({
            isOnline: true,
            latency: latency
          });
        });
        
        req.on('error', () => {
          // Si HTTP falla, intentar HTTPS (puerto 443)
          const httpsReq = https.request({
            hostname: ipAddress,
            port: 443,
            path: '/',
            method: 'HEAD',
            timeout: 3000,
            rejectUnauthorized: false // Aceptar certificados autofirmados
          }, (res) => {
            const latency = Date.now() - startTime;
            resolve({
              isOnline: true,
              latency: latency
            });
          });

          httpsReq.on('error', () => {
            resolve({
              isOnline: false,
              latency: null
            });
          });

          httpsReq.on('timeout', () => {
            httpsReq.destroy();
            resolve({
              isOnline: false,
              latency: null
            });
          });

          httpsReq.end();
        });

        req.on('timeout', () => {
          req.destroy();
          // Intentar HTTPS si HTTP timeout
          const httpsReq = https.request({
            hostname: ipAddress,
            port: 443,
            path: '/',
            method: 'HEAD',
            timeout: 3000,
            rejectUnauthorized: false
          }, (res) => {
            const latency = Date.now() - startTime;
            resolve({
              isOnline: true,
              latency: latency
            });
          });

          httpsReq.on('error', () => {
            resolve({
              isOnline: false,
              latency: null
            });
          });

          httpsReq.on('timeout', () => {
            httpsReq.destroy();
            resolve({
              isOnline: false,
              latency: null
            });
          });

          httpsReq.end();
        });

        req.end();
      });
    } catch (error) {
      return {
        isOnline: false,
        latency: null
      };
    }
  }

  // Obtener métricas de un cliente (simulado por ahora, puede mejorarse con herramientas reales)
  async getClientMetrics(ipAddress) {
    try {
      // Primero verificar si está online
      const status = await this.checkClientStatus(ipAddress);
      
      if (!status.isOnline) {
        return {
          downloadSpeed: null,
          uploadSpeed: null,
          latency: null,
          packetLoss: null
        };
      }

      // Para métricas reales, necesitarías herramientas como:
      // - iperf3 para velocidad
      // - MRTG/SNMP para monitoreo continuo
      // - Router APIs para datos reales
      
      // Por ahora, retornamos valores simulados basados en latencia
      // En producción, esto debería venir de un sistema de monitoreo real
      const baseSpeed = 50; // Mbps base
      const latencyFactor = status.latency ? Math.max(0, 1 - (status.latency / 100)) : 0.5;
      
      return {
        downloadSpeed: status.isOnline ? (baseSpeed * latencyFactor + Math.random() * 20) : null,
        uploadSpeed: status.isOnline ? (baseSpeed * latencyFactor * 0.5 + Math.random() * 10) : null,
        latency: status.latency,
        packetLoss: status.isOnline ? (Math.random() * 0.5) : null
      };
    } catch (error) {
      return {
        downloadSpeed: null,
        uploadSpeed: null,
        latency: null,
        packetLoss: null
      };
    }
  }

  // Obtener estadísticas del monitor
  getStats() {
    return {
      isRunning: this.isRunning,
      interval: this.interval / 1000, // en segundos
      clientsMonitored: this.clients.size,
      lastReload: this.lastReload ? new Date(this.lastReload).toISOString() : null
    };
  }
}

// Crear instancia singleton
const trafficMonitor = new TrafficMonitor();

module.exports = trafficMonitor;

