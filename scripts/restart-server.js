const { spawn, execSync, exec } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const projectRoot = path.join(__dirname, '..');
const isWindows = os.platform() === 'win32';
const currentPid = process.pid;

console.log('🔄 Iniciando reinicio completo del servidor...\n');
console.log(`📌 PID del proceso actual: ${currentPid}\n`);

// Función para matar todos los procesos de Node.js relacionados con el proyecto (excepto el actual)
function killAllNodeProcesses() {
  try {
    if (isWindows) {
      console.log('📋 Cerrando todos los procesos de Node.js (excepto este script)...');
      
      // Obtener todos los procesos de node.exe
      try {
        const tasklistOutput = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', {
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        if (tasklistOutput && tasklistOutput.trim()) {
          const lines = tasklistOutput.trim().split('\n').slice(1); // Saltar encabezado
          let killedCount = 0;
          
          lines.forEach(line => {
            if (line.trim()) {
              // Extraer PID del CSV (segunda columna)
              const match = line.match(/"([^"]+)","([^"]+)"/);
              if (match && match[2]) {
                const pid = match[2].trim();
                // NO matar el proceso actual
                if (pid !== String(currentPid)) {
                  try {
                    execSync(`taskkill /F /PID ${pid}`, {
                      stdio: 'ignore',
                      timeout: 3000
                    });
                    killedCount++;
                  } catch (err) {
                    // Ignorar errores al matar procesos
                  }
                }
              }
            }
          });
          
          if (killedCount > 0) {
            console.log(`   ✅ ${killedCount} proceso(s) de Node.js cerrado(s)`);
          } else {
            console.log(`   ℹ️  No se encontraron otros procesos de Node.js`);
          }
        }
      } catch (err) {
        // Si no hay procesos, continuar
        console.log(`   ℹ️  No se encontraron procesos de Node.js`);
      }
      
      // También cerrar procesos en puertos específicos
      console.log('📋 Cerrando procesos en puertos 5000 y 3000...');
      const ports = [5000, 3000];
      let portsKilled = 0;
      
      ports.forEach(port => {
        try {
          const netstatOutput = execSync(`netstat -ano | findstr ":${port}" | findstr "LISTENING"`, {
            encoding: 'utf8',
            stdio: 'pipe'
          });
          
          if (netstatOutput.trim()) {
            const lines = netstatOutput.trim().split('\n');
            lines.forEach(line => {
              const parts = line.trim().split(/\s+/);
              if (parts.length > 0) {
                const pid = parts[parts.length - 1];
                if (pid && /^\d+$/.test(pid) && pid !== String(currentPid)) {
                  try {
                    execSync(`taskkill /F /PID ${pid}`, {
                      stdio: 'ignore',
                      timeout: 3000
                    });
                    portsKilled++;
                  } catch (err) {
                    // Ignorar errores
                  }
                }
              }
            });
          }
        } catch (err) {
          // No hay procesos en el puerto
        }
      });
      
      if (portsKilled > 0) {
        console.log(`   ✅ ${portsKilled} proceso(s) en puertos cerrado(s)`);
      }
      
      // Cerrar ventanas de consola relacionadas
      console.log('📋 Cerrando ventanas de consola relacionadas...');
      try {
        execSync('taskkill /FI "WINDOWTITLE eq Sistema ISP*" /F', {
          stdio: 'ignore',
          timeout: 2000
        });
      } catch (err) {
        // Ignorar si no hay ventanas
      }
      
      try {
        execSync('taskkill /FI "WINDOWTITLE eq *Sistema ISP*" /F', {
          stdio: 'ignore',
          timeout: 2000
        });
      } catch (err) {
        // Ignorar si no hay ventanas
      }
      
    } else {
      // Linux/Mac
      console.log('📋 Cerrando todos los procesos de Node.js (excepto este script)...');
      try {
        const pids = execSync('pgrep -f node', {
          encoding: 'utf8',
          stdio: 'pipe'
        }).trim().split('\n');
        
        let killedCount = 0;
        pids.forEach(pid => {
          if (pid && pid !== String(currentPid)) {
            try {
              execSync(`kill -9 ${pid}`, {
                stdio: 'ignore',
                timeout: 3000
              });
              killedCount++;
            } catch (err) {
              // Ignorar errores
            }
          }
        });
        
        if (killedCount > 0) {
          console.log(`   ✅ ${killedCount} proceso(s) de Node.js cerrado(s)`);
        }
      } catch (err) {
        // No hay procesos
      }
      
      // Cerrar procesos en puertos específicos
      const ports = [5000, 3000];
      ports.forEach(port => {
        try {
          const pids = execSync(`lsof -ti:${port}`, {
            encoding: 'utf8',
            stdio: 'pipe'
          }).trim().split('\n');
          
          pids.forEach(pid => {
            if (pid && pid !== String(currentPid)) {
              try {
                execSync(`kill -9 ${pid}`, {
                  stdio: 'ignore',
                  timeout: 3000
                });
              } catch (err) {
                // Ignorar errores
              }
            }
          });
        } catch (err) {
          // No hay procesos en el puerto
        }
      });
    }
    
    console.log('   ✅ Procesos cerrados\n');
  } catch (error) {
    console.log('   ⚠️  Error al cerrar procesos (continuando...)\n');
  }
}

// Función para esperar a que los puertos se liberen
function waitForPortsFree() {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 15; // Aumentar a 15 intentos (7.5 segundos)
    
    const checkPorts = () => {
      attempts++;
      let portsFree = true;
      
      try {
        if (isWindows) {
          try {
            const port5000 = execSync('netstat -ano | findstr ":5000" | findstr "LISTENING"', {
              encoding: 'utf8',
              stdio: 'pipe'
            }).trim();
            
            const port3000 = execSync('netstat -ano | findstr ":3000" | findstr "LISTENING"', {
              encoding: 'utf8',
              stdio: 'pipe'
            }).trim();
            
            if (port5000 || port3000) {
              portsFree = false;
            }
          } catch (err) {
            // Los puertos están libres
            portsFree = true;
          }
        } else {
          try {
            execSync('lsof -ti:5000', { stdio: 'ignore' });
            portsFree = false;
          } catch (err) {
            // Puerto libre
          }
          
          try {
            execSync('lsof -ti:3000', { stdio: 'ignore' });
            portsFree = false;
          } catch (err) {
            // Puerto libre
          }
        }
      } catch (err) {
        // Los puertos están libres
        portsFree = true;
      }
      
      if (portsFree || attempts >= maxAttempts) {
        if (portsFree) {
          console.log(`   ✅ Puertos liberados después de ${attempts} intento(s)`);
        } else {
          console.log(`   ⚠️  Continuando después de ${maxAttempts} intentos (algunos puertos pueden seguir en uso)`);
        }
        resolve();
      } else {
        if (attempts % 3 === 0) {
          console.log(`   ⏳ Esperando... (intento ${attempts}/${maxAttempts})`);
        }
        setTimeout(checkPorts, 500);
      }
    };
    
    checkPorts();
  });
}

// Función principal de reinicio
async function restartServer() {
  try {
    // Paso 1: Cerrar todos los procesos (excepto este)
    killAllNodeProcesses();
    
    // Paso 2: Esperar un momento antes de verificar puertos
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Paso 3: Esperar a que los puertos se liberen
    console.log('⏳ Esperando a que los puertos se liberen...');
    await waitForPortsFree();
    console.log('');
    
    // Paso 4: Esperar un momento adicional para asegurar que todo esté cerrado
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Paso 5: Iniciar el servidor desde cero
    console.log('🚀 Iniciando servidor desde cero...\n');
    
    if (isWindows) {
      // En Windows, usar el script batch de inicio si existe
      const startScript = path.join(projectRoot, 'bat-scripts', 'INICIAR_APP_SIMPLE.bat');
      
      if (fs.existsSync(startScript)) {
        // Ejecutar el script batch en una nueva ventana para que se vea el proceso
        console.log('   📝 Usando script de inicio: INICIAR_APP_SIMPLE.bat');
        const startScriptPath = path.resolve(startScript);
        console.log(`   📂 Ruta del script: ${startScriptPath}`);
        // Usar exec para ejecutar el comando start correctamente
        // Esto maneja mejor los espacios y caracteres especiales
        const command = `start "Sistema ISP - Reinicio" "${startScriptPath}"`;
        exec(command, {
          cwd: projectRoot,
          detached: true
        }, (error, stdout, stderr) => {
          if (error) {
            console.error(`   ❌ Error al ejecutar script: ${error.message}`);
          }
        });
        child.unref();
      } else {
        // Si no existe el script batch, iniciar directamente con npm
        console.log('   📝 Iniciando con: npm run dev');
        const child = spawn('npm', ['run', 'dev'], {
          detached: true,
          stdio: 'inherit',
          cwd: projectRoot,
          shell: true
        });
        child.unref();
      }
    } else {
      // En Linux/Mac, usar npm dev
      console.log('   📝 Iniciando con: npm run dev');
      const child = spawn('npm', ['run', 'dev'], {
        detached: true,
        stdio: 'inherit',
        cwd: projectRoot,
        shell: false
      });
      child.unref();
    }
    
    console.log('✅ Reinicio completado. El servidor se está iniciando en una nueva ventana...\n');
    console.log('⏳ Este script se cerrará en 3 segundos...\n');
    
    // Esperar un momento antes de salir para asegurar que el proceso se inició
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante el reinicio:', error);
    console.log('\n⚠️  Intentando iniciar el servidor de todas formas...\n');
    
    // Intentar iniciar de todas formas
    try {
      if (isWindows) {
        const startScript = path.join(projectRoot, 'bat-scripts', 'INICIAR_APP_SIMPLE.bat');
        if (fs.existsSync(startScript)) {
          const startScriptPath = path.resolve(startScript);
          const command = `start "Sistema ISP - Reinicio" "${startScriptPath}"`;
          exec(command, {
            cwd: projectRoot,
            detached: true
          });
        } else {
          // Si no existe el script, usar npm directamente
          spawn('npm.cmd', ['run', 'dev'], {
            detached: true,
            stdio: 'inherit',
            cwd: projectRoot,
            shell: false
          });
        }
      }
    } catch (err) {
      // Ignorar errores
    }
    
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  }
}

// Ejecutar el reinicio
restartServer();


