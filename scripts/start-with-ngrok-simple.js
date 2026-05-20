#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('  Sistema ISP - Iniciar con Ngrok');
console.log('========================================\n');

// Dominio configurado
const NGROK_DOMAIN = 'sistemacdcom.ngrok.dev';
const NGROK_URL = `https://${NGROK_DOMAIN}`;

console.log('🚀 Iniciando servicios...\n');

// Limpiar caché y reconstruir cliente
console.log('🔨 Reconstruyendo cliente frontend...');
console.log('⏳ Esto puede tardar un momento...\n');

const buildProcess = spawn('npm', ['run', 'build'], {
  cwd: path.join(__dirname, '../client'),
  stdio: 'inherit',
  shell: true
});

buildProcess.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Error al reconstruir el cliente');
    process.exit(1);
  }
  
  console.log('✅ Cliente reconstruido exitosamente\n');
  
  // Iniciar servidor backend
  console.log('📦 Iniciando servidor backend...');
try {
  const serverProcess = spawn('node', ['index.js'], {
    cwd: path.join(__dirname, '../server'),
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  serverProcess.unref();
  console.log('✅ Servidor backend iniciado\n');
} catch (e) {
  console.error('❌ Error al iniciar servidor:', e.message);
  process.exit(1);
}

// Iniciar cliente (Vite)
console.log('🎨 Iniciando cliente frontend...');
try {
  const clientProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '../client'),
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    shell: true
  });
  clientProcess.unref();
  console.log('✅ Cliente frontend iniciado\n');
} catch (e) {
  console.error('❌ Error al iniciar cliente:', e.message);
}

setTimeout(() => {
  // Iniciar ngrok apuntando al cliente (puerto 3000 de Vite)
  console.log(`🌐 Iniciando ngrok con dominio: ${NGROK_DOMAIN}...`);
  console.log('⚠️  Ngrok apuntará al cliente de desarrollo (puerto 3000)\n');
  try {
    const ngrokProcess = spawn('ngrok', ['http', '3000', '--domain', NGROK_DOMAIN], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    ngrokProcess.unref();
    console.log('✅ Ngrok iniciado\n');
  } catch (e) {
    console.error('❌ Error al iniciar ngrok:', e.message);
    console.error('Asegúrate de que ngrok esté instalado');
    process.exit(1);
  }
  
  setTimeout(() => {
      console.log('========================================');
      console.log('  APLICACIÓN LISTA');
      console.log('========================================\n');
      console.log(`🌐 URL: ${NGROK_URL}`);
      console.log('📊 Panel ngrok: http://127.0.0.1:4040\n');
      console.log('🌐 Abriendo navegador...\n');
      
      // Abrir navegador
      if (process.platform === 'win32') {
        exec(`start "" "${NGROK_URL}"`);
      } else if (process.platform === 'darwin') {
        exec(`open "${NGROK_URL}"`);
      } else {
        exec(`xdg-open "${NGROK_URL}"`);
      }
      
      console.log('✅ Sistema iniciado correctamente');
      console.log('   El servidor y ngrok están corriendo en segundo plano\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⚠️  NO CIERRES ESTA VENTANA');
      console.log('   Los servicios seguirán corriendo mientras esté abierta\n');
      console.log('   Para detener: Presiona Ctrl+C o cierra esta ventana');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // Mantener el proceso vivo
      setInterval(() => {
        // No hacer nada, solo mantener el proceso corriendo
      }, 60000);
    }, 5000);
  }, 3000);
});

