const http = require('http');
const { exec } = require('child_process');
const os = require('os');

// URL de ngrok configurada
const NGROK_URL = 'https://sistemacdcom.ngrok.dev';
const CLIENT_URL = NGROK_URL; // Usar ngrok en lugar de localhost
const SERVER_URL = 'http://localhost:5000';
const MAX_ATTEMPTS = 60; // Máximo 60 intentos (5 minutos)
const DELAY = 5000; // 5 segundos entre intentos

let attempts = 0;

console.log('🌐 [Browser] Esperando a que los servidores estén listos...\n');

let serverReady = false;
let clientReady = false;

function checkServer(url, name) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      resolve(true);
    });
    
    req.on('error', (err) => {
      reject(false);
    });
    
    req.setTimeout(3000, () => {
      req.destroy();
      reject(false);
    });
  });
}

async function waitForServers() {
  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    
    try {
      // Verificar servidor backend
      if (!serverReady) {
        try {
          await checkServer(SERVER_URL, 'Backend');
          serverReady = true;
          console.log('✅ [Browser] Servidor backend listo (puerto 5000)');
        } catch (e) {
          // Backend aún no está listo
        }
      }
      
      // Verificar cliente frontend
      if (!clientReady) {
        try {
          await checkServer(CLIENT_URL, 'Frontend');
          clientReady = true;
          console.log('✅ [Browser] Cliente frontend listo (puerto 3000)');
        } catch (e) {
          // Cliente aún no está listo
        }
      }
      
      // Si el servidor está listo, abrir navegador con ngrok
      if (serverReady) {
        console.log('\n🚀 [Browser] Servidor listo! Abriendo navegador con ngrok...\n');
        console.log(`🌐 [Browser] URL de ngrok: ${NGROK_URL}\n`);
        openBrowser(NGROK_URL);
        // Mantener el proceso vivo para que concurrently no lo termine
        // El proceso seguirá ejecutándose pero sin hacer nada más
        setInterval(() => {
          // Mantener el proceso vivo
        }, 60000); // Verificar cada minuto que el navegador siga accesible
        return;
      }
      
      // Mostrar progreso cada 12 intentos (cada minuto)
      if (attempts % 12 === 0) {
        const status = [];
        if (serverReady) status.push('Backend ✅');
        else status.push('Backend ⏳');
        if (clientReady) status.push('Frontend ✅');
        else status.push('Frontend ⏳');
        console.log(`⏳ [Browser] Esperando... ${status.join(' | ')} (${Math.floor(attempts * 5 / 60)}m ${(attempts * 5) % 60}s)`);
      }
      
      await new Promise(resolve => setTimeout(resolve, DELAY));
      
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, DELAY));
    }
  }
  
  console.error('❌ Tiempo de espera agotado. El servidor no está respondiendo.');
  console.error('   Verifica que el servidor se haya iniciado correctamente.');
  console.error(`   Puedes abrir manualmente: ${NGROK_URL}`);
  // No terminamos el proceso, solo informamos el error
  // El proceso continuará ejecutándose para que los servidores sigan corriendo
}

function openBrowser(url) {
  const platform = os.platform();
  let command;
  
  switch (platform) {
    case 'win32':
      command = `start "" "${url}"`;
      break;
    case 'darwin':
      command = `open "${url}"`;
      break;
    case 'linux':
      command = `xdg-open "${url}"`;
      break;
    default:
      console.log(`🌐 [Browser] Abre manualmente: ${url}`);
      return;
  }
  
  exec(command, (error) => {
    if (error) {
      console.error(`❌ [Browser] No se pudo abrir el navegador automáticamente.`);
      console.log(`🌐 [Browser] Por favor, abre manualmente: ${url}`);
    } else {
      console.log(`✅ [Browser] Navegador abierto en: ${url}\n`);
      console.log(`💡 [Browser] La aplicación está lista para usar.`);
      console.log(`   Si el navegador no se abrió, visita: ${url}\n`);
    }
  });
}

// Esperar un poco antes de empezar a verificar (dar tiempo a que los servidores inicien)
setTimeout(() => {
  waitForServers();
}, 3000);

