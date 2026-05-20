/**
 * Script para actualizar la aplicación remotamente
 * 
 * Uso:
 *   node scripts/update-remote.js [--token TOKEN] [--url URL]
 * 
 * Ejemplo:
 *   node scripts/update-remote.js --token "tu_token_jwt" --url "https://tu-app.com"
 */

const https = require('https');
const http = require('http');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Parsear argumentos de línea de comandos
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    token: null,
    url: 'http://localhost:5000'
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--token' && args[i + 1]) {
      config.token = args[i + 1];
      i++;
    } else if (args[i] === '--url' && args[i + 1]) {
      config.url = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
${colors.bright}Script de Actualización Remota${colors.reset}

Uso:
  node scripts/update-remote.js [opciones]

Opciones:
  --token TOKEN    Token JWT de administrador (requerido)
  --url URL        URL del servidor (default: http://localhost:5000)
  --help, -h       Muestra esta ayuda

Ejemplos:
  # Actualizar servidor local
  node scripts/update-remote.js --token "tu_token_jwt"

  # Actualizar servidor remoto
  node scripts/update-remote.js --token "tu_token_jwt" --url "https://tu-app.com"

Nota: Necesitas un token JWT de un usuario administrador.
Para obtenerlo, inicia sesión en la aplicación y copia el token del localStorage
o de las cookies de sesión.
      `);
      process.exit(0);
    }
  }

  return config;
}

// Realizar petición HTTP/HTTPS
function makeRequest(url, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Función principal
async function main() {
  log('\n🔄 Script de Actualización Remota\n', 'bright');

  const config = parseArgs();

  // Validar token
  if (!config.token) {
    log('❌ Error: Se requiere un token JWT', 'red');
    log('   Usa: node scripts/update-remote.js --token "tu_token"', 'yellow');
    log('   O usa: node scripts/update-remote.js --help', 'yellow');
    process.exit(1);
  }

  const updateUrl = `${config.url}/api/server/update`;

  log(`📡 Conectando a: ${config.url}`, 'cyan');
  log(`🔐 Usando token: ${config.token.substring(0, 20)}...`, 'cyan');
  log('');

  try {
    log('⏳ Iniciando actualización...', 'yellow');
    const response = await makeRequest(updateUrl, config.token);

    if (response.status === 200 || response.status === 201) {
      log('✅ Actualización iniciada exitosamente', 'green');
      log('');
      log('📝 Respuesta del servidor:', 'cyan');
      console.log(JSON.stringify(response.data, null, 2));
      log('');
      log('💡 Nota: La actualización se está ejecutando en segundo plano.', 'yellow');
      log('   Revisa los logs del servidor para ver el progreso.', 'yellow');
      log('   El servidor se reiniciará automáticamente cuando termine.', 'yellow');
    } else if (response.status === 403) {
      log('❌ Error: No tienes permisos de administrador', 'red');
      log('   Asegúrate de usar un token de un usuario con rol "admin"', 'yellow');
      process.exit(1);
    } else if (response.status === 401) {
      log('❌ Error: Token inválido o expirado', 'red');
      log('   Obtén un nuevo token iniciando sesión en la aplicación', 'yellow');
      process.exit(1);
    } else {
      log(`❌ Error: El servidor respondió con código ${response.status}`, 'red');
      console.log('Respuesta:', response.data);
      process.exit(1);
    }
  } catch (error) {
    log('❌ Error al conectar con el servidor:', 'red');
    log(`   ${error.message}`, 'red');
    log('');
    log('💡 Verifica que:', 'yellow');
    log('   - El servidor esté corriendo', 'yellow');
    log('   - La URL sea correcta', 'yellow');
    log('   - Tengas conexión a internet', 'yellow');
    process.exit(1);
  }
}

// Ejecutar
main().catch((error) => {
  log('❌ Error inesperado:', 'red');
  console.error(error);
  process.exit(1);
});


