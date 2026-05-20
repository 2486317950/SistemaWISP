const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * POST /api/server/update
 * Actualiza la aplicación desde Git y reconstruye
 * Requiere: Autenticación de administrador
 */
router.post('/update', async (req, res) => {
  // Verificar que el usuario sea admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Solo los administradores pueden actualizar el servidor' 
    });
  }

  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_REMOTE_UPDATE !== 'true') {
    return res.status(403).json({
      error: 'Actualización remota desde el panel está deshabilitada en este entorno.',
      hint: 'Solo si la necesitas, define ENABLE_REMOTE_UPDATE=true en el servidor y valora el riesgo (pull, npm y reinicio ejecutados por código).'
    });
  }

  const projectRoot = path.join(__dirname, '..', '..');
  const logs = [];
  
  // Función para agregar logs
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    logs.push({ timestamp, type, message });
    console.log(`[UPDATE ${type.toUpperCase()}] ${message}`);
  };

  // Responder inmediatamente para que el cliente no espere
  res.json({ 
    message: 'Actualización iniciada...',
    timestamp: new Date().toISOString(),
    note: 'Revisa los logs del servidor para ver el progreso'
  });

  // Ejecutar actualización de forma asíncrona
  (async () => {
    try {
      addLog('Iniciando actualización remota...', 'info');

      // Paso 1: Verificar si Git está disponible
      addLog('Verificando Git...', 'info');
      const gitAvailable = await checkCommandAvailable('git');
      if (!gitAvailable) {
        addLog('Git no está disponible. Saltando git pull.', 'warning');
      } else {
        // Paso 2: Hacer git pull
        addLog('Obteniendo últimos cambios de Git...', 'info');
        try {
          await executeCommand('git', ['pull', 'origin', 'main'], projectRoot, addLog);
          addLog('Git pull completado exitosamente', 'success');
        } catch (error) {
          addLog(`Error en git pull: ${error.message}`, 'error');
          // Continuar de todas formas
        }
      }

      // Paso 3: Instalar dependencias del servidor
      addLog('Instalando dependencias del servidor...', 'info');
      try {
        await executeCommand('npm', ['install', '--no-audit', '--no-fund'], 
          path.join(projectRoot, 'server'), addLog);
        addLog('Dependencias del servidor instaladas', 'success');
      } catch (error) {
        addLog(`Error instalando dependencias del servidor: ${error.message}`, 'error');
      }

      // Paso 4: Instalar dependencias del cliente
      addLog('Instalando dependencias del cliente...', 'info');
      try {
        await executeCommand('npm', ['install', '--no-audit', '--no-fund'], 
          path.join(projectRoot, 'client'), addLog);
        addLog('Dependencias del cliente instaladas', 'success');
      } catch (error) {
        addLog(`Error instalando dependencias del cliente: ${error.message}`, 'error');
      }

      // Paso 5: Construir el frontend
      addLog('Construyendo frontend...', 'info');
      try {
        await executeCommand('npm', ['run', 'build'], 
          path.join(projectRoot, 'client'), addLog);
        addLog('Frontend construido exitosamente', 'success');
      } catch (error) {
        addLog(`Error construyendo frontend: ${error.message}`, 'error');
        throw new Error('Error crítico: No se pudo construir el frontend');
      }

      // Paso 6: Verificar que la carpeta dist existe
      const distPath = path.join(projectRoot, 'client', 'dist');
      if (!fs.existsSync(distPath)) {
        addLog('ADVERTENCIA: La carpeta dist no existe después del build', 'warning');
      } else {
        addLog('Carpeta dist verificada correctamente', 'success');
      }

      addLog('Actualización completada exitosamente', 'success');
      addLog('El servidor se reiniciará en 3 segundos...', 'info');

      // Paso 7: Reiniciar el servidor después de un delay
      setTimeout(() => {
        addLog('Reiniciando servidor...', 'info');
        try {
          const restartScript = path.join(projectRoot, 'scripts', 'restart-server.js');
          if (fs.existsSync(restartScript)) {
            const child = spawn('node', [restartScript], {
              detached: true,
              stdio: 'ignore',
              cwd: projectRoot
            });
            child.unref();
            addLog('Comando de reinicio ejecutado', 'success');
          } else {
            addLog('Script de reinicio no encontrado. Usando process.exit', 'warning');
            process.exit(0);
          }
        } catch (error) {
          addLog(`Error al reiniciar: ${error.message}`, 'error');
          process.exit(0);
        }
      }, 3000);

    } catch (error) {
      addLog(`Error crítico durante la actualización: ${error.message}`, 'error');
      addLog('Stack: ' + error.stack, 'error');
    }
  })();
});

/**
 * GET /api/server/update/status
 * Obtiene el estado de la última actualización
 * Requiere: Autenticación de administrador
 */
router.get('/update/status', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Solo los administradores pueden ver el estado de actualización' 
    });
  }

  // Por ahora, solo devolvemos información básica
  // En el futuro, podrías guardar el estado en un archivo o base de datos
  res.json({
    message: 'Consulta los logs del servidor para ver el estado de la actualización',
    note: 'Los logs se muestran en la consola del servidor'
  });
});

// Funciones auxiliares

/**
 * Verifica si un comando está disponible
 */
function checkCommandAvailable(command) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const checkCommand = isWindows ? 'where' : 'which';
    
    const child = spawn(checkCommand, [command], {
      shell: true,
      stdio: 'ignore'
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Ejecuta un comando y captura su salida
 */
function executeCommand(command, args, cwd, addLog) {
  return new Promise((resolve, reject) => {
    addLog(`Ejecutando: ${command} ${args.join(' ')}`, 'info');
    
    const child = spawn(command, args, {
      cwd: cwd,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      // Log solo las líneas importantes
      const lines = output.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        if (line.includes('error') || line.includes('Error') || line.includes('ERROR')) {
          addLog(line, 'error');
        } else if (line.includes('warning') || line.includes('Warning')) {
          addLog(line, 'warning');
        } else if (line.includes('success') || line.includes('Success') || line.includes('✓')) {
          addLog(line, 'success');
        }
      });
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      // Log errores
      const lines = output.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        if (line && !line.includes('npm WARN')) {
          addLog(line, 'error');
        }
      });
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Comando falló con código ${code}: ${stderr || stdout}`));
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Error al ejecutar comando: ${error.message}`));
    });
  });
}

module.exports = router;


