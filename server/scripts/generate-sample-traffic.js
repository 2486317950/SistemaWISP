const db = require('../database');
const path = require('path');

// Este script genera datos de tráfico de ejemplo para clientes existentes

const generateSampleTraffic = () => {
  return new Promise((resolve, reject) => {
    const database = db.getDb();
    
    // Primero, obtener todos los clientes con sus IPs (si tienen)
    database.all(`
      SELECT DISTINCT
        c.id,
        ip.ip_address
      FROM clients c
      LEFT JOIN ip_credentials ip ON c.id = ip.client_id
      ORDER BY c.id
    `, [], (err, clients) => {
      if (err) {
        console.error('Error al obtener clientes:', err);
        return reject(err);
      }
      
      if (clients.length === 0) {
        console.log('No hay clientes en la base de datos. Crea algunos clientes primero.');
        return resolve();
      }
      
      // Filtrar clientes que tienen IP o generar IPs para los que no tienen
      const clientsWithIPs = clients.filter(c => c.ip_address);
      const clientsWithoutIPs = clients.filter(c => !c.ip_address);
      
      console.log(`Generando datos de tráfico para ${clients.length} clientes...`);
      if (clientsWithoutIPs.length > 0) {
        console.log(`  - ${clientsWithIPs.length} clientes con IPs configuradas`);
        console.log(`  - ${clientsWithoutIPs.length} clientes sin IPs (se generarán IPs de ejemplo)`);
      }
      
      let processed = 0;
      const statuses = ['conectado', 'desconectado', 'problema'];
      
      clients.forEach((client, index) => {
        // Usar IP existente o generar una de ejemplo
        const ipAddress = client.ip_address || `192.168.1.${100 + index}`;
        const macAddress = `00:1B:44:11:3A:B${index % 10}`;
        
        // Generar datos aleatorios de tráfico
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const downloadSpeed = status === 'conectado' 
          ? Math.random() * 100 + 10 // 10-110 Mbps
          : null;
        const uploadSpeed = status === 'conectado'
          ? Math.random() * 50 + 5 // 5-55 Mbps
          : null;
        const latency = status === 'conectado'
          ? Math.random() * 50 + 10 // 10-60 ms
          : null;
        const packetLoss = status === 'problema'
          ? Math.random() * 5 // 0-5%
          : status === 'conectado' ? Math.random() * 0.5 : null;
        
        const lastSeen = new Date().toISOString();
        
        // Verificar si ya existe un registro para este cliente
        database.get(
          'SELECT id FROM client_traffic WHERE client_id = ?',
          [client.id],
          (err, existing) => {
            if (err) {
              console.error(`Error al verificar tráfico para cliente ${client.id}:`, err);
              processed++;
              if (processed === clients.length) resolve();
              return;
            }
            
            if (existing) {
              // Actualizar registro existente
              database.run(
                `UPDATE client_traffic 
                 SET connection_status = ?,
                     download_speed = ?,
                     upload_speed = ?,
                     latency = ?,
                     packet_loss = ?,
                     last_seen = ?,
                     ip_address = ?,
                     mac_address = ?,
                     updated_at = ?
                 WHERE client_id = ?`,
                [
                  status,
                  downloadSpeed,
                  uploadSpeed,
                  latency,
                  packetLoss,
                  lastSeen,
                  ipAddress,
                  macAddress,
                  lastSeen,
                  client.id
                ],
                (err) => {
                  if (err) {
                    console.error(`Error al actualizar tráfico para cliente ${client.id}:`, err);
                  } else {
                    console.log(`✓ Tráfico actualizado para cliente ${client.id} (${status})`);
                  }
                  processed++;
                  if (processed === clients.length) {
                    console.log('\n✅ Datos de tráfico generados exitosamente!');
                    resolve();
                  }
                }
              );
            } else {
              // Crear nuevo registro
              database.run(
                `INSERT INTO client_traffic (
                  client_id, connection_status, download_speed, upload_speed, 
                  latency, packet_loss, last_seen, ip_address, mac_address, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  client.id,
                  status,
                  downloadSpeed,
                  uploadSpeed,
                  latency,
                  packetLoss,
                  lastSeen,
                  ipAddress,
                  macAddress,
                  lastSeen
                ],
                (err) => {
                  if (err) {
                    console.error(`Error al crear tráfico para cliente ${client.id}:`, err);
                  } else {
                    console.log(`✓ Tráfico creado para cliente ${client.id} (${status})`);
                  }
                  processed++;
                  if (processed === clients.length) {
                    console.log('\n✅ Datos de tráfico generados exitosamente!');
                    resolve();
                  }
                }
              );
            }
          }
        );
      });
    });
  });
};

// Ejecutar si se llama directamente
if (require.main === module) {
  db.init()
    .then(() => {
      console.log('Base de datos inicializada');
      return generateSampleTraffic();
    })
    .then(() => {
      console.log('Script completado');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = { generateSampleTraffic };

