const http = require('http');

/**
 * Verifica si ngrok está corriendo y obtiene la URL pública
 * @returns {Promise<string|null>} URL pública de ngrok o null si no está corriendo
 */
function checkNgrok() {
  return new Promise((resolve) => {
    // Ngrok API local por defecto
    const options = {
      hostname: '127.0.0.1',
      port: 4040,
      path: '/api/tunnels',
      method: 'GET',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.tunnels && response.tunnels.length > 0) {
            // Buscar el túnel HTTP/HTTPS
            const httpsTunnel = response.tunnels.find(t => t.proto === 'https');
            const httpTunnel = response.tunnels.find(t => t.proto === 'http');
            const tunnel = httpsTunnel || httpTunnel;
            
            if (tunnel) {
              resolve(tunnel.public_url);
            } else {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        } catch (error) {
          resolve(null);
        }
      });
    });

    req.on('error', () => {
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

// Si se ejecuta directamente, mostrar la URL
if (require.main === module) {
  checkNgrok()
    .then((url) => {
      if (url) {
        console.log(url);
        process.exit(0);
      } else {
        console.log('Ngrok no está corriendo o no está disponible');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Error al verificar ngrok:', error.message);
      process.exit(1);
    });
}

module.exports = { checkNgrok };

























