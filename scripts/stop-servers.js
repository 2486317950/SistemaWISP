const { execSync } = require('child_process');
const os = require('os');

const PORT_BACKEND = 5000;
const PORT_FRONTEND = 3000;

// Si se ejecuta silenciosamente (cuando se llama desde npm run dev)
const SILENT = process.argv.includes('--silent') || process.env.SILENT === 'true';
// Modo resumido: muestra información pero sin detalles excesivos
const SUMMARY = process.argv.includes('--summary') || process.env.SUMMARY === 'true';
// Omitir detener procesos del puerto 3000 (frontend)
const SKIP_FRONTEND = process.argv.includes('--skip-frontend') || process.env.SKIP_FRONTEND === 'true';

if (!SILENT && !SUMMARY) {
  console.log('🛑 Deteniendo servidores...\n');
}

function killProcessOnPort(port) {
  try {
    const platform = os.platform();
    
    if (platform === 'win32') {
      // Windows: usar netstat y taskkill
      try {
        // Buscar el PID del proceso que usa el puerto
        const netstatOutput = execSync(`netstat -ano | findstr ":${port}" | findstr "LISTENING"`, {
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        if (netstatOutput.trim()) {
          // Extraer PID (última columna)
          const lines = netstatOutput.trim().split('\n');
          const pids = new Set();
          
          lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length > 0) {
              const pid = parts[parts.length - 1];
              if (pid && /^\d+$/.test(pid)) {
                pids.add(pid);
              }
            }
          });
          
          // Matar cada proceso
          let foundAny = false;
          let stoppedCount = 0;
          pids.forEach(pid => {
            try {
              if (!SILENT && !SUMMARY) {
                console.log(`   Deteniendo proceso PID ${pid} en puerto ${port}...`);
              }
              execSync(`taskkill /F /PID ${pid}`, {
                stdio: SILENT ? 'ignore' : 'pipe',
                timeout: 5000
              });
              if (!SILENT && !SUMMARY) {
                console.log(`   ✅ Proceso ${pid} detenido`);
              }
              foundAny = true;
              stoppedCount++;
            } catch (err) {
              if (!SILENT && !SUMMARY) {
                console.log(`   ⚠️  No se pudo detener el proceso ${pid}: ${err.message}`);
              }
            }
          });
          if (SUMMARY && foundAny) {
            console.log(`   ✅ ${stoppedCount} proceso(s) detenido(s) en puerto ${port}`);
          }
          return { found: foundAny, count: stoppedCount };
        } else {
          if (!SILENT && !SUMMARY) {
            console.log(`   ℹ️  No hay procesos en el puerto ${port}`);
          }
          return { found: false, count: 0 };
        }
      } catch (err) {
        // No hay procesos en el puerto o error al buscar
        if (!SILENT && !SUMMARY) {
          console.log(`   ℹ️  No hay procesos en el puerto ${port}`);
        }
        return { found: false, count: 0 };
      }
    } else {
      // Linux/Mac: usar lsof y kill
      try {
        const lsofOutput = execSync(`lsof -ti:${port}`, {
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        if (lsofOutput.trim()) {
          const pids = lsofOutput.trim().split('\n').filter(pid => pid);
          let foundAny = false;
          let stoppedCount = 0;
          pids.forEach(pid => {
            try {
              if (!SILENT && !SUMMARY) {
                console.log(`   Deteniendo proceso PID ${pid} en puerto ${port}...`);
              }
              execSync(`kill -9 ${pid}`, {
                stdio: SILENT ? 'ignore' : 'pipe',
                timeout: 5000
              });
              if (!SILENT && !SUMMARY) {
                console.log(`   ✅ Proceso ${pid} detenido`);
              }
              foundAny = true;
              stoppedCount++;
            } catch (err) {
              if (!SILENT && !SUMMARY) {
                console.log(`   ⚠️  No se pudo detener el proceso ${pid}: ${err.message}`);
              }
            }
          });
          if (SUMMARY && foundAny) {
            console.log(`   ✅ ${stoppedCount} proceso(s) detenido(s) en puerto ${port}`);
          }
          return { found: foundAny, count: stoppedCount };
        } else {
          if (!SILENT && !SUMMARY) {
            console.log(`   ℹ️  No hay procesos en el puerto ${port}`);
          }
          return { found: false, count: 0 };
        }
      } catch (err) {
        if (!SILENT && !SUMMARY) {
          console.log(`   ℹ️  No hay procesos en el puerto ${port}`);
        }
        return { found: false, count: 0 };
      }
    }
  } catch (error) {
    if (!SILENT && !SUMMARY) {
      console.error(`   ❌ Error al detener procesos en puerto ${port}:`, error.message);
    }
    return { found: false, count: 0 };
  }
}

if (SUMMARY) {
  console.log('🔍 Verificando servidores anteriores...\n');
} else if (!SILENT) {
  console.log(`Deteniendo procesos en puerto ${PORT_BACKEND} (Backend)...`);
}
const backendResult = killProcessOnPort(PORT_BACKEND);

let frontendResult = { found: false, count: 0 };
if (!SKIP_FRONTEND) {
if (!SILENT && !SUMMARY) {
  console.log(`\nDeteniendo procesos en puerto ${PORT_FRONTEND} (Frontend)...`);
}
  frontendResult = killProcessOnPort(PORT_FRONTEND);
} else {
  if (SUMMARY) {
    console.log(`   ⏭️  Omitiendo puerto ${PORT_FRONTEND} (Frontend) - no se detendrán procesos`);
  } else if (!SILENT) {
    console.log(`\n⏭️  Omitiendo puerto ${PORT_FRONTEND} (Frontend) - no se detendrán procesos`);
  }
}

// Mostrar resumen
if (SUMMARY) {
  const totalStopped = (backendResult.count || 0) + (frontendResult.count || 0);
  if (totalStopped > 0) {
    console.log(`\n✅ Se detuvieron ${totalStopped} proceso(s) anterior(es)`);
    if (backendResult.found) {
      console.log(`   - Backend (puerto ${PORT_BACKEND}): ${backendResult.count} proceso(s)`);
    }
    if (frontendResult.found) {
      console.log(`   - Frontend (puerto ${PORT_FRONTEND}): ${frontendResult.count} proceso(s)`);
    }
  } else {
    console.log('\nℹ️  No se encontraron servidores anteriores en ejecución');
  }
  console.log('');
} else if (!SILENT) {
  console.log('\n✅ Proceso completado. Esperando 2 segundos para que los puertos se liberen...\n');
}

// Esperar 2 segundos para que los puertos se liberen
setTimeout(() => {
  if (!SILENT && !SUMMARY) {
    console.log('Los puertos deberían estar libres ahora.');
  }
  // Siempre salir con éxito, incluso si no se encontraron procesos
  process.exit(0);
}, 2000);

