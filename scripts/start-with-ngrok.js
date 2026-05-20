#!/usr/bin/env node

/**
 * Script para iniciar la aplicación con ngrok
 * Uso: node scripts/start-with-ngrok.js
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// LOCK DESHABILITADO - Permitir múltiples instancias
const LOCK_DISABLED = true;

// Función para detener TODOS los procesos Node.js relacionados con el servidor
async function stopNodeServerProcesses() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      writeLog('Deteniendo TODOS los procesos Node.js relacionados...');
      
      // Estrategia múltiple para asegurar que se detengan todos los procesos
      let completed = 0;
      const totalChecks = 3;
      
      const checkComplete = () => {
        completed++;
        if (completed >= totalChecks) {
          writeLog('Verificación de procesos Node.js completada');
          setTimeout(resolve, 2000); // Esperar 2 segundos adicionales
        }
      };
      
      // 1. Detener procesos node.exe que ejecutan index.js en server
      const serverIndexPath = path.join(process.cwd(), 'server', 'index.js').replace(/\\/g, '\\\\');
      exec(`wmic process where "name='node.exe' and commandline like '%${serverIndexPath}%'" get processid /format:value`, (error, stdout) => {
        if (!error && stdout) {
          const pids = stdout.match(/ProcessId=(\d+)/g);
          if (pids && pids.length > 0) {
            writeLog(`Encontrados ${pids.length} proceso(s) Node.js ejecutando index.js`);
            pids.forEach(pidLine => {
              const pid = pidLine.split('=')[1];
              if (pid && pid !== process.pid.toString()) { // No detener el proceso actual
                writeLog(`Deteniendo proceso Node.js con PID: ${pid}`);
                exec(`taskkill /F /PID ${pid} /T 2>nul`, (err) => {
                  if (!err) {
                    writeLog(`Proceso ${pid} detenido`);
                  }
                });
              }
            });
          }
        }
        checkComplete();
      });
      
      // 2. Detener procesos en el puerto 5000
      exec('netstat -ano | findstr ":5000" | findstr "LISTENING"', (err, output) => {
        if (!err && output) {
          const lines = output.trim().split('\n');
          const pids = new Set();
          lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length > 0) {
              const pid = parts[parts.length - 1];
              if (pid && /^\d+$/.test(pid) && pid !== process.pid.toString()) {
                pids.add(pid);
              }
            }
          });
          if (pids.size > 0) {
            writeLog(`Encontrados ${pids.size} proceso(s) en puerto 5000`);
            pids.forEach(pid => {
              writeLog(`Deteniendo proceso en puerto 5000 con PID: ${pid}`);
              exec(`taskkill /F /PID ${pid} /T 2>nul`, () => {});
            });
          }
        }
        checkComplete();
      });
      
      // 3. Detener TODOS los procesos node.exe (más agresivo, pero necesario)
      exec('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', (error, stdout) => {
        if (!error && stdout) {
          const lines = stdout.split('\n').filter(line => line.includes('node.exe'));
          if (lines.length > 1) { // Más de uno porque el proceso actual también aparece
            writeLog(`Encontrados ${lines.length} proceso(s) node.exe en total`);
            // Extraer PIDs y detenerlos (excepto el proceso actual)
            lines.forEach(line => {
              const match = line.match(/"(\d+)"/);
              if (match) {
                const pid = match[1];
                if (pid !== process.pid.toString()) {
                  // Verificar que no sea el proceso del script actual
                  exec(`wmic process where "processid=${pid}" get commandline /format:value`, (err, cmdOutput) => {
                    if (!err && cmdOutput) {
                      // Solo detener si es el servidor o si no es este script
                      if (cmdOutput.includes('server\\index.js') || cmdOutput.includes('server/index.js')) {
                        writeLog(`Deteniendo proceso node.exe con PID: ${pid}`);
                        exec(`taskkill /F /PID ${pid} /T 2>nul`, () => {});
                      }
                    }
                  });
                }
              }
            });
          }
        }
        checkComplete();
      });
    } else {
      // En Linux/Mac, usar pkill
      exec('pkill -f "node.*server/index.js"', (error) => {
        if (!error) {
          writeLog('Procesos Node.js del servidor detenidos');
        }
        setTimeout(resolve, 2000);
      });
    }
  });
}

// Sistema de archivos .lock DESHABILITADO
const lockFile = path.join(__dirname, '../temp_start_ngrok.lock');

// Limpiar cualquier archivo .lock antiguo al iniciar
if (fs.existsSync(lockFile)) {
  try {
    fs.unlinkSync(lockFile);
    console.log('Archivo .lock antiguo eliminado');
  } catch (e) {
    // Ignorar errores
  }
}

// Funciones de limpieza vacías (sistema de lock deshabilitado)
const cleanupLockFile = () => {};

process.on('exit', cleanupLockFile);
process.on('SIGINT', () => {
  process.exit(0);
});
process.on('SIGTERM', () => {
  process.exit(0);
});
process.on('uncaughtException', (error) => {
  throw error;
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection:', reason);
});

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, total, message) {
  log(`[${step}/${total}] ${message}`, 'cyan');
}

// Crear carpeta de logs
const logsDir = path.join(__dirname, '../bat-scripts/logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Generar nombre de archivo de log con fecha y hora
const now = new Date();
const logDate = now.toISOString().slice(0, 10).replace(/-/g, '-');
const logTime = now.toTimeString().slice(0, 8).replace(/:/g, '-');
const logFile = path.join(logsDir, `ngrok_startup_${logDate}_${logTime}.log`);

function writeLog(message) {
  const timestamp = new Date().toLocaleString();
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

// Iniciar log
writeLog('========================================');
writeLog('  LOG - INICIAR APP CON NGROK');
writeLog('========================================');
writeLog(`Fecha: ${now.toLocaleString()}`);
writeLog(`Archivo de log: ${logFile}`);
writeLog(`Directorio actual: ${process.cwd()}`);
writeLog('');

log('\n========================================', 'bright');
log('  Iniciando Sistema ISP con Ngrok', 'bright');
log('========================================\n', 'bright');
log(`Log: ${logFile}\n`);

// Verificar Node.js y npm
logStep(1, 7, 'Verificando Node.js...');
writeLog('[1/7] Verificando Node.js...');
if (!process.versions.node) {
  log('ERROR: Node.js no encontrado', 'red');
  writeLog('ERROR: Node.js no encontrado');
  process.exit(1);
}
log('OK - Node.js encontrado', 'green');
writeLog('Node.js encontrado');

logStep(2, 7, 'Verificando npm...');
writeLog('[2/7] Verificando npm...');
exec('npm --version', (error) => {
  if (error) {
    log('ERROR: npm no encontrado', 'red');
    writeLog('ERROR: npm no encontrado');
    process.exit(1);
  }
  log('OK - npm encontrado', 'green');
  writeLog('npm encontrado');

  // Verificar ngrok
  logStep(3, 7, 'Buscando ngrok...');
  writeLog('[3/7] Buscando ngrok...');
  
  findNgrok((ngrokCmd) => {
    if (!ngrokCmd) {
      log('ERROR: ngrok no encontrado', 'red');
      writeLog('ERROR: ngrok no encontrado');
      log('Por favor instala ngrok: npm install -g ngrok', 'yellow');
      process.exit(1);
    }
    
    log(`OK - ngrok encontrado: ${ngrokCmd}`, 'green');
    writeLog(`ngrok encontrado: ${ngrokCmd}`);

    // Verificar package.json
    logStep(4, 7, 'Verificando proyecto...');
    writeLog('[4/7] Verificando proyecto...');
    const packageJson = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packageJson)) {
      log('ERROR: package.json no encontrado', 'red');
      writeLog('ERROR: package.json no encontrado');
      process.exit(1);
    }
    log('OK - Proyecto verificado', 'green');
    writeLog('package.json encontrado');

    // Detener servidores anteriores
    logStep(5, 7, 'Deteniendo servidores anteriores...');
    writeLog('[5/7] Deteniendo servidores anteriores...');
    // Detener procesos Node.js relacionados con el servidor
    writeLog('Deteniendo procesos Node.js del servidor...');
    stopNodeServerProcesses().then(() => {
      const stopScript = path.join(__dirname, 'stop-servers.js');
      if (fs.existsSync(stopScript)) {
        exec(`node "${stopScript}" --summary --skip-frontend`, () => {
          // Continuar aunque falle
        setTimeout(() => {
          log('OK - Servidores detenidos', 'green');
          writeLog('Servidores detenidos');

          // Construir cliente
          logStep(6, 7, 'Construyendo cliente (esto puede tardar unos minutos)...');
          writeLog('[6/7] Construyendo cliente...');
          exec('npm run build', { cwd: process.cwd() }, (error, stdout, stderr) => {
            if (error) {
              log('ERROR: Error al construir el cliente', 'red');
              writeLog(`ERROR: Error al construir el cliente\n${stderr}`);
              process.exit(1);
            }
            
            const distDir = path.join(process.cwd(), 'client', 'dist');
            if (!fs.existsSync(distDir)) {
              log('ERROR: client/dist no se creó', 'red');
              writeLog('ERROR: client/dist no se creó');
              process.exit(1);
            }
            
            log('OK - Cliente construido', 'green');
            writeLog('Cliente construido correctamente');

            // Iniciar servidor y ngrok
            logStep(7, 7, 'Iniciando servidor y ngrok...');
            writeLog('[7/7] Iniciando servidor y ngrok...');

            // Cargar configuración de ngrok si existe
            let ngrokDomain = '';
            let ngrokDomain2 = '';
            let ngrokAuthToken = '';
            const ngrokConfig = path.join(process.cwd(), 'ngrok-config.bat');
            
            if (fs.existsSync(ngrokConfig)) {
              writeLog('Cargando configuración de ngrok...');
              // Leer configuración (simplificado, asumiendo formato básico)
              try {
                const configContent = fs.readFileSync(ngrokConfig, 'utf8');
                const domainMatch = configContent.match(/set\s+NGROK_DOMAIN=(.+)/i);
                const domain2Match = configContent.match(/set\s+NGROK_DOMAIN_2=(.+)/i);
                const tokenMatch = configContent.match(/set\s+NGROK_AUTHTOKEN=(.+)/i);
                
                if (domainMatch) ngrokDomain = domainMatch[1].trim();
                if (domain2Match) ngrokDomain2 = domain2Match[1].trim();
                if (tokenMatch) ngrokAuthToken = tokenMatch[1].trim();
              } catch (e) {
                writeLog(`Advertencia: No se pudo leer ngrok-config.bat: ${e.message}`);
              }
            }

            // Configurar authtoken si existe
            if (ngrokAuthToken) {
              writeLog('Configurando authtoken de ngrok...');
              exec(`"${ngrokCmd}" config add-authtoken ${ngrokAuthToken}`, () => {
                // Continuar aunque falle
                startServerAndNgrok(ngrokCmd, ngrokDomain, ngrokDomain2);
              });
            } else {
              startServerAndNgrok(ngrokCmd, ngrokDomain, ngrokDomain2);
            }
          });
        }, 2000);
      });
    } else {
      setTimeout(() => {
        log('OK - Servidores detenidos', 'green');
        writeLog('Servidores detenidos (script no encontrado)');
        // Continuar con construcción
        logStep(6, 7, 'Construyendo cliente...');
        writeLog('[6/7] Construyendo cliente...');
        exec('npm run build', { cwd: process.cwd() }, (error, stdout, stderr) => {
          if (error) {
            log('ERROR: Error al construir el cliente', 'red');
            writeLog(`ERROR: Error al construir el cliente\n${stderr}`);
            process.exit(1);
          }
          const distDir = path.join(process.cwd(), 'client', 'dist');
          if (!fs.existsSync(distDir)) {
            log('ERROR: client/dist no se creó', 'red');
            writeLog('ERROR: client/dist no se creó');
            process.exit(1);
          }
          log('OK - Cliente construido', 'green');
          writeLog('Cliente construido correctamente');
          logStep(7, 7, 'Iniciando servidor y ngrok...');
          writeLog('[7/7] Iniciando servidor y ngrok...');
          startServerAndNgrok(ngrokCmd, '', '');
        });
      }, 2000);
    }
    }); // Cerrar el .then() de stopNodeServerProcesses
  }); // Cerrar el callback de findNgrok
}); // Cerrar el callback de exec('npm --version')

function findNgrok(callback) {
  // Buscar ngrok en varias ubicaciones
  exec('where ngrok', (error, stdout) => {
    if (!error && stdout.trim()) {
      return callback(stdout.trim().split('\n')[0]);
    }
    
    // Buscar en la carpeta del proyecto
    const ngrokExe = path.join(process.cwd(), 'ngrok.exe');
    if (fs.existsSync(ngrokExe)) {
      return callback(ngrokExe);
    }
    
    // Buscar en npm global
    const npmGlobal = path.join(process.env.APPDATA || '', 'npm', 'ngrok.cmd');
    if (fs.existsSync(npmGlobal)) {
      return callback(npmGlobal);
    }
    
    const npmGlobalExe = path.join(process.env.APPDATA || '', 'npm', 'ngrok.exe');
    if (fs.existsSync(npmGlobalExe)) {
      return callback(npmGlobalExe);
    }
    
    callback(null);
  });
}

async function stopExistingNgrokTunnels(ngrokCmd) {
  writeLog('Verificando y deteniendo túneles ngrok existentes...');
  
  return new Promise((resolve) => {
    let resolved = false;
    
    // Función para resolver solo una vez
    const doResolve = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    
    // PRIMERO: Detener todos los procesos ngrok.exe para forzar el cierre
    if (process.platform === 'win32') {
      writeLog('Deteniendo todos los procesos ngrok.exe...');
      exec('taskkill /F /IM ngrok.exe /T 2>nul', (error) => {
        if (!error) {
          writeLog('Procesos ngrok.exe detenidos');
        } else {
          writeLog('No se encontraron procesos ngrok.exe corriendo');
        }
        // Esperar un momento para que los procesos se detengan
        setTimeout(() => {
          // SEGUNDO: Intentar detener túneles usando la API de ngrok (si aún hay un proceso corriendo)
          const req = http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              try {
                const response = JSON.parse(data);
                if (response.tunnels && response.tunnels.length > 0) {
                  writeLog(`Encontrados ${response.tunnels.length} túnel(es) activo(s) después de detener procesos. Deteniéndolos vía API...`);
                  // Detener cada túnel
                  let deleteCount = 0;
                  const totalTunnels = response.tunnels.length;
                  
                  if (totalTunnels === 0) {
                    doResolve();
                    return;
                  }
                  
                  response.tunnels.forEach((tunnel) => {
                    writeLog(`Deteniendo túnel: ${tunnel.name} (${tunnel.public_url})`);
                    const deleteReq = http.request({
                      hostname: '127.0.0.1',
                      port: 4040,
                      path: `/api/tunnels/${tunnel.name}`,
                      method: 'DELETE'
                    }, (res) => {
                      deleteCount++;
                      writeLog(`Túnel ${tunnel.name} detenido (${deleteCount}/${totalTunnels})`);
                      if (deleteCount === totalTunnels) {
                        writeLog('Todos los túneles ngrok detenidos vía API');
                        // Esperar más tiempo para asegurar que se detengan completamente
                        setTimeout(doResolve, 3000);
                      }
                    });
                    deleteReq.on('error', (err) => {
                      writeLog(`Error al detener túnel ${tunnel.name}: ${err.message}`);
                      deleteCount++;
                      if (deleteCount === totalTunnels) {
                        setTimeout(doResolve, 3000);
                      }
                    });
                    deleteReq.end();
                  });
                } else {
                  writeLog('No hay túneles activos en la API');
                  doResolve();
                }
              } catch (e) {
                writeLog(`Error al parsear respuesta de API: ${e.message}`);
                doResolve();
              }
            });
          });
          
          req.on('error', (err) => {
            // Si no hay ngrok corriendo o la API no responde, continuar
            writeLog(`API de ngrok no disponible: ${err.message}`);
            doResolve();
          });
          
          req.setTimeout(3000, () => {
            req.destroy();
            writeLog('Timeout al conectar con API de ngrok');
            doResolve();
          });
        }, 2000); // Esperar 2 segundos después de detener procesos
      });
    } else {
      // Linux/Mac
      exec('pkill -f ngrok 2>/dev/null', (error) => {
        if (!error) {
          writeLog('Procesos ngrok detenidos');
        }
        setTimeout(doResolve, 2000);
      });
    }
    
    // Timeout de seguridad (más largo para dar tiempo a que se detengan)
    setTimeout(doResolve, 10000);
  });
}

async function startServerAndNgrok(ngrokCmd, domain, domain2) {
  // Primero detener túneles ngrok existentes para evitar ERR_NGROK_334
  log('Deteniendo túneles ngrok existentes...', 'yellow');
  writeLog('Deteniendo túneles ngrok existentes para evitar ERR_NGROK_334...');
  await stopExistingNgrokTunnels(ngrokCmd);
  log('Túneles ngrok existentes detenidos', 'green');
  writeLog('Esperando 5 segundos para asegurar que los túneles se detengan completamente...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Verificar una vez más que no haya túneles activos
  writeLog('Verificando que no haya túneles activos...');
  try {
    const checkReq = http.get('http://127.0.0.1:4040/api/tunnels', { timeout: 2000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.tunnels && response.tunnels.length > 0) {
            writeLog(`ADVERTENCIA: Aún hay ${response.tunnels.length} túnel(es) activo(s). Forzando detención...`);
            // Forzar detención de procesos ngrok nuevamente
            if (process.platform === 'win32') {
              exec('taskkill /F /IM ngrok.exe /T 2>nul', () => {});
            }
            // Esperar un momento más
            setTimeout(() => {
              writeLog('Continuando con inicio de nuevo túnel...');
            }, 3000);
          } else {
            writeLog('Confirmado: No hay túneles activos. Procediendo con inicio...');
          }
        } catch (e) {
          writeLog('No se pudo verificar túneles (API no disponible). Continuando...');
        }
      });
    });
    checkReq.on('error', () => {
      writeLog('API de ngrok no disponible (probablemente no hay procesos corriendo). Continuando...');
    });
    checkReq.setTimeout(2000, () => {
      checkReq.destroy();
    });
  } catch (e) {
    writeLog(`Error al verificar túneles: ${e.message}. Continuando...`);
  }
  
  // Esperar un momento adicional antes de iniciar
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Iniciar servidor
  writeLog('Iniciando servidor...');
  
  // Verificar que no haya procesos del servidor ya corriendo
  writeLog('Verificando que no haya procesos del servidor corriendo...');
  await stopNodeServerProcesses();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos más
  
  // Iniciar servidor en una ventana visible
  if (process.platform === 'win32') {
    const serverDir = path.join(process.cwd(), 'server');
    // Usar start para abrir en una nueva ventana de CMD visible
    exec(`start "Servidor Node.js - Sistema ISP" /D "${serverDir}" cmd /k "set NODE_ENV=production && node index.js"`, (error) => {
      if (error) {
        writeLog(`Error al iniciar servidor: ${error.message}`);
        log('ERROR: No se pudo iniciar el servidor', 'red');
      } else {
        writeLog('Servidor iniciado en ventana visible');
      }
    });
    
    // Verificar que el puerto 5000 esté en uso después de un momento
    setTimeout(() => {
      exec('netstat -ano | findstr ":5000" | findstr "LISTENING"', (error, stdout) => {
        if (error || !stdout) {
          writeLog('ADVERTENCIA: El puerto 5000 no está en estado LISTENING después de 5 segundos');
        } else {
          writeLog('Confirmado: Puerto 5000 está en estado LISTENING');
        }
      });
    }, 5000);
  } else {
    // En otros sistemas, usar spawn con ventana visible
    const serverOptions = {
      cwd: path.join(process.cwd(), 'server'),
      env: { ...process.env, NODE_ENV: 'production' },
      detached: true,
      stdio: 'inherit'
    };
    try {
      const serverProcess = spawn('node', ['index.js'], serverOptions);
      serverProcess.unref();
      writeLog(`Servidor iniciado con PID: ${serverProcess.pid}`);
    } catch (error) {
      writeLog(`ERROR: No se pudo iniciar servidor: ${error.message}`);
    }
  }

  // Esperar a que el servidor inicie completamente (aumentado a 10 segundos)
  setTimeout(() => {
    // Iniciar ngrok con dominio configurado
    writeLog('Iniciando ngrok...');
    const ngrokDomain = 'sistemacdcom.ngrok.dev';
    const ngrokArgs = ['http', '5000', '--domain', ngrokDomain];
    writeLog(`Usando dominio: ${ngrokDomain}`);
    
    log(`\n🌐 URL de ngrok configurada: https://${ngrokDomain}`, 'green');
    log('El navegador se abrirá automáticamente con esta URL\n', 'yellow');
    
    // Iniciar ngrok en una ventana visible
    if (process.platform === 'win32') {
      // Construir comando ngrok
      const ngrokCommand = ngrokArgs.map(arg => `"${arg}"`).join(' ');
      // Usar start para abrir en una nueva ventana de CMD visible
      exec(`start "Ngrok - Sistema ISP" cmd /k ""${ngrokCmd}" ${ngrokCommand}"`, { cwd: process.cwd() }, (error) => {
        if (error) {
          writeLog(`Error al iniciar ngrok: ${error.message}`);
          log('ERROR: No se pudo iniciar ngrok', 'red');
        } else {
          writeLog('Ngrok iniciado en ventana visible');
        }
      });
    } else {
      // En otros sistemas, usar spawn con ventana visible
      try {
        const ngrokProcess = spawn(ngrokCmd, ngrokArgs, {
          cwd: process.cwd(),
          detached: true,
          stdio: 'inherit'
        });
        ngrokProcess.unref();
        writeLog(`Ngrok iniciado con PID: ${ngrokProcess.pid}`);
      } catch (error) {
        writeLog(`ERROR: No se pudo iniciar ngrok: ${error.message}`);
      }
    }

    // Esperar un momento adicional para que ngrok se inicie completamente antes de verificar
    setTimeout(() => {
      // Esperar y obtener URL
      log('\nEsperando que ngrok esté listo...', 'yellow');
      writeLog('Esperando que ngrok esté listo...');
      
      let retries = 0;
      const maxRetries = 40; // Aumentado a 40 intentos (2 minutos)
      
      const checkNgrok = setInterval(() => {
      retries++;
      
      http.get('http://127.0.0.1:4040/api/tunnels', { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.tunnels && response.tunnels.length > 0) {
              const httpsTunnel = response.tunnels.find(t => t.proto === 'https');
              const tunnel = httpsTunnel || response.tunnels[0];
              const ngrokUrl = tunnel.public_url;
              
              // Usar URL de ngrok configurada
              const configuredUrl = 'https://sistemacdcom.ngrok.dev';
              writeLog(`📱 URL de ngrok configurada: ${configuredUrl}`);
              openBrowser(configuredUrl);
              
              if (ngrokUrl && ngrokUrl.startsWith('https://')) {
                clearInterval(checkNgrok);
                
                log('\n========================================', 'bright');
                log('  APLICACIÓN INICIADA CORRECTAMENTE', 'bright');
                log('========================================\n', 'bright');
                log(`URL de Ngrok: ${ngrokUrl}`, 'green');
                log('\nAbriendo navegador...\n', 'yellow');
                
                writeLog(`URL obtenida: ${ngrokUrl}`);
                writeLog('========================================');
                writeLog('  SCRIPT COMPLETADO EXITOSAMENTE');
                writeLog('========================================');
                
                // Esperar un momento antes de abrir el navegador
                setTimeout(() => {
                  // Abrir navegador
                  if (process.platform === 'win32') {
                    // Windows: usar start con comillas
                    exec(`start "" "${ngrokUrl}"`, (error) => {
                      if (error) {
                        writeLog(`Error al abrir navegador: ${error.message}`);
                        log('No se pudo abrir el navegador automáticamente', 'yellow');
                        log(`Por favor abre manualmente: ${ngrokUrl}`, 'cyan');
                      } else {
                        writeLog('Navegador abierto correctamente');
                      }
                    });
                  } else if (process.platform === 'darwin') {
                    exec(`open "${ngrokUrl}"`, (error) => {
                      if (error) {
                        writeLog(`Error al abrir navegador: ${error.message}`);
                      }
                    });
                  } else {
                    exec(`xdg-open "${ngrokUrl}"`, (error) => {
                      if (error) {
                        writeLog(`Error al abrir navegador: ${error.message}`);
                      }
                    });
                  }
                }, 2000);
                
                log(`Log guardado en: ${logFile}`, 'cyan');
                log('\nLa aplicación está corriendo en segundo plano.', 'green');
                log('El servidor y ngrok seguirán ejecutándose.\n', 'green');
                
                // Terminar el script después de mostrar los mensajes
                setTimeout(() => {
                  // Limpiar archivo de bloqueo
                  try {
                    if (fs.existsSync(lockFile)) {
                      fs.unlinkSync(lockFile);
                    }
                  } catch (e) {}
                  process.exit(0);
                }, 5000);
              }
            }
          } catch (e) {
            // Continuar intentando
          }
        });
      }).on('error', () => {
        // Continuar intentando
      });
      
      if (retries >= maxRetries) {
        clearInterval(checkNgrok);
        log('\nERROR: No se pudo obtener URL de ngrok', 'red');
        log('Puedes ver la URL manualmente en: http://127.0.0.1:4040', 'yellow');
        writeLog('ERROR: No se pudo obtener URL de ngrok después de 40 intentos');
        log('\nEl servidor y ngrok pueden estar corriendo.', 'yellow');
        log(`Log guardado en: ${logFile}\n`, 'cyan');
        
        // Limpiar archivo de bloqueo y salir
        setTimeout(() => {
          try {
            if (fs.existsSync(lockFile)) {
              fs.unlinkSync(lockFile);
            }
          } catch (e) {}
          process.exit(1);
        }, 5000);
      }
      }, 3000); // Intervalo de verificación cada 3 segundos
    }, 5000); // Esperar 5 segundos antes de empezar a verificar ngrok
  }, 7000); // Esperar 7 segundos para que el servidor inicie
}
