const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

// Función para obtener la ruta del escritorio
function getDesktopPath() {
  const homeDir = os.homedir();
  const platform = os.platform();
  
  if (platform === 'win32') {
    // En Windows, intentar OneDrive primero, luego Desktop normal
    const oneDriveDesktop = path.join(homeDir, 'OneDrive', 'Escritorio');
    const normalDesktop = path.join(homeDir, 'Desktop');
    const spanishDesktop = path.join(homeDir, 'Escritorio');
    
    // Verificar cuál existe
    if (fs.existsSync(oneDriveDesktop)) {
      return oneDriveDesktop;
    } else if (fs.existsSync(spanishDesktop)) {
      return spanishDesktop;
    } else if (fs.existsSync(normalDesktop)) {
      return normalDesktop;
    } else {
      // Si no existe ninguno, crear Desktop
      return normalDesktop;
    }
  } else if (platform === 'darwin') {
    // macOS
    return path.join(homeDir, 'Desktop');
  } else {
    // Linux
    return path.join(homeDir, 'Desktop');
  }
}

// Configurar multer para guardar archivos en el escritorio
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const desktopPath = getDesktopPath();
      if (!fs.existsSync(desktopPath)) {
        fs.mkdirSync(desktopPath, { recursive: true });
      }
      cb(null, desktopPath);
    },
    filename: (req, file, cb) => {
      // Generar nombre con fecha y hora legible
      const now = new Date();
      const dateStr = now.toISOString()
        .replace(/T/, '_')
        .replace(/:/g, '-')
        .replace(/\..+/, ''); // Formato: YYYY-MM-DD_HH-MM-SS
      const originalName = file.originalname.replace(/\.zip$/i, ''); // Quitar .zip si existe
      const safeName = originalName.replace(/[^a-zA-Z0-9_-]/g, '_'); // Limpiar nombre
      cb(null, `update_${dateStr}_${safeName}.zip`);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB máximo
  fileFilter: (req, file, cb) => {
    // Solo permitir archivos ZIP
    if (file.mimetype === 'application/zip' || 
        file.mimetype === 'application/x-zip-compressed' ||
        file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos ZIP'));
    }
  }
});

/**
 * POST /api/server/upload-update
 * Sube un archivo ZIP con actualizaciones y las aplica
 * Requiere: Autenticación de administrador
 */
router.post('/upload-update', authenticateToken, upload.single('updateFile'), async (req, res) => {
  // Verificar que el usuario sea admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Solo los administradores pueden subir actualizaciones' 
    });
  }

  if (!req.file) {
    return res.status(400).json({ 
      error: 'No se proporcionó ningún archivo' 
    });
  }

  const projectRoot = path.join(__dirname, '..', '..');
  const zipPath = req.file.path;
  const extractPath = path.join(projectRoot, 'temp', `extract_${Date.now()}`);
  const logs = [];
  
  // Función para agregar logs
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    logs.push({ timestamp, type, message });
    console.log(`[FILE UPDATE ${type.toUpperCase()}] ${message}`);
  };

  // Responder inmediatamente
  res.json({ 
    message: 'Archivo recibido. Procesando actualización...',
    timestamp: new Date().toISOString(),
    note: 'Revisa los logs del servidor para ver el progreso'
  });

  // Procesar actualización de forma asíncrona
  (async () => {
    try {
      addLog('Iniciando procesamiento de actualización desde archivo...', 'info');
      addLog(`Archivo: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`, 'info');

      // Paso 1: Verificar si adm-zip está disponible
      let AdmZip;
      try {
        AdmZip = require('adm-zip');
        addLog('Librería de descompresión encontrada', 'success');
      } catch (error) {
        addLog('ERROR: adm-zip no está instalado. Instalando...', 'warning');
        await installPackage('adm-zip', projectRoot, addLog);
        AdmZip = require('adm-zip');
      }

      // Paso 2: Crear directorio de extracción
      if (!fs.existsSync(extractPath)) {
        fs.mkdirSync(extractPath, { recursive: true });
        addLog(`Directorio de extracción creado: ${extractPath}`, 'info');
      }

      // Paso 3: Descomprimir el archivo ZIP
      addLog('Descomprimiendo archivo...', 'info');
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractPath, true);
      addLog('Archivo descomprimido exitosamente', 'success');

      // Paso 4: Analizar el contenido del ZIP
      const extractedFiles = getAllFiles(extractPath);
      addLog(`Archivos encontrados en el ZIP: ${extractedFiles.length}`, 'info');

      // Paso 5: Validar estructura del ZIP
      // El ZIP debe tener una estructura similar al proyecto:
      // - client/ (opcional, para actualizar frontend)
      // - server/ (opcional, para actualizar backend)
      // - package.json (opcional, para actualizar dependencias raíz)
      
      const hasClient = fs.existsSync(path.join(extractPath, 'client'));
      const hasServer = fs.existsSync(path.join(extractPath, 'server'));
      const hasRootFiles = fs.existsSync(path.join(extractPath, 'package.json'));

      if (!hasClient && !hasServer && !hasRootFiles) {
        addLog('ADVERTENCIA: El ZIP no contiene estructura reconocible (client/, server/, o package.json)', 'warning');
        addLog('Intentando copiar todos los archivos al directorio raíz...', 'info');
      }

      // Paso 6: Hacer backup antes de actualizar
      addLog('Creando backup de archivos críticos...', 'info');
      const backupDir = path.join(projectRoot, 'backups', `backup_${Date.now()}`);
      if (!fs.existsSync(path.join(projectRoot, 'backups'))) {
        fs.mkdirSync(path.join(projectRoot, 'backups'), { recursive: true });
      }
      fs.mkdirSync(backupDir, { recursive: true });
      
      // Backup de archivos importantes
      const importantFiles = [
        'package.json',
        'server/package.json',
        'client/package.json',
        'server/database.sqlite'
      ];
      
      for (const file of importantFiles) {
        const sourcePath = path.join(projectRoot, file);
        if (fs.existsSync(sourcePath)) {
          const destPath = path.join(backupDir, file);
          const destDir = path.dirname(destPath);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          fs.copyFileSync(sourcePath, destPath);
        }
      }
      addLog(`Backup creado en: ${backupDir}`, 'success');

      // Paso 7: Copiar archivos actualizados
      addLog('Aplicando actualizaciones...', 'info');
      
      if (hasClient) {
        addLog('Actualizando archivos del cliente...', 'info');
        await copyDirectory(
          path.join(extractPath, 'client'),
          path.join(projectRoot, 'client'),
          addLog
        );
      }

      if (hasServer) {
        addLog('Actualizando archivos del servidor...', 'info');
        // Excluir database.sqlite de la actualización
        await copyDirectory(
          path.join(extractPath, 'server'),
          path.join(projectRoot, 'server'),
          addLog,
          ['database.sqlite', 'node_modules']
        );
      }

      if (hasRootFiles) {
        addLog('Actualizando archivos raíz...', 'info');
        const rootFiles = fs.readdirSync(extractPath);
        for (const file of rootFiles) {
          const sourcePath = path.join(extractPath, file);
          const destPath = path.join(projectRoot, file);
          
          // Omitir directorios y archivos temporales
          if (fs.statSync(sourcePath).isDirectory()) {
            if (file !== 'client' && file !== 'server' && file !== 'temp' && file !== 'backups') {
              await copyDirectory(sourcePath, destPath, addLog);
            }
          } else if (!file.startsWith('.') && file !== 'update_') {
            fs.copyFileSync(sourcePath, destPath);
            addLog(`Archivo copiado: ${file}`, 'info');
          }
        }
      } else {
        // Si no hay estructura reconocible, copiar todo excepto temp y backups
        addLog('Copiando todos los archivos (estructura no reconocible)...', 'info');
        const allFiles = getAllFiles(extractPath);
        for (const file of allFiles) {
          const relativePath = path.relative(extractPath, file);
          const destPath = path.join(projectRoot, relativePath);
          
          // Omitir archivos sensibles
          if (relativePath.includes('database.sqlite') || 
              relativePath.includes('node_modules') ||
              relativePath.includes('temp') ||
              relativePath.includes('backups')) {
            continue;
          }
          
          const destDir = path.dirname(destPath);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          fs.copyFileSync(file, destPath);
        }
        addLog('Archivos copiados', 'success');
      }

      // Paso 8: Instalar dependencias si hay cambios en package.json
      const packageJsonChanged = 
        fs.existsSync(path.join(extractPath, 'package.json')) ||
        fs.existsSync(path.join(extractPath, 'server', 'package.json')) ||
        fs.existsSync(path.join(extractPath, 'client', 'package.json'));

      if (packageJsonChanged) {
        addLog('Detectados cambios en package.json. Instalando dependencias...', 'info');
        
        // Instalar dependencias raíz
        if (fs.existsSync(path.join(projectRoot, 'package.json'))) {
          await executeCommand('npm', ['install', '--no-audit', '--no-fund'], projectRoot, addLog);
        }
        
        // Instalar dependencias del servidor
        if (fs.existsSync(path.join(projectRoot, 'server', 'package.json'))) {
          await executeCommand('npm', ['install', '--no-audit', '--no-fund'], 
            path.join(projectRoot, 'server'), addLog);
        }
        
        // Instalar dependencias del cliente
        if (fs.existsSync(path.join(projectRoot, 'client', 'package.json'))) {
          await executeCommand('npm', ['install', '--no-audit', '--no-fund'], 
            path.join(projectRoot, 'client'), addLog);
        }
      }

      // Paso 9: Construir el frontend si hay cambios en client
      if (hasClient || packageJsonChanged) {
        addLog('Construyendo frontend...', 'info');
        try {
          await executeCommand('npm', ['run', 'build'], 
            path.join(projectRoot, 'client'), addLog);
          addLog('Frontend construido exitosamente', 'success');
        } catch (error) {
          addLog(`Error construyendo frontend: ${error.message}`, 'error');
          // Continuar de todas formas
        }
      }

      // Paso 10: Limpiar archivos temporales de extracción (pero mantener el ZIP en el escritorio)
      addLog('Limpiando archivos temporales de extracción...', 'info');
      try {
        // No eliminar el ZIP, se mantiene en el escritorio para referencia
        // Solo eliminar la carpeta de extracción temporal
        fs.rmSync(extractPath, { recursive: true, force: true });
        addLog('Archivos temporales de extracción eliminados', 'success');
        addLog(`ZIP guardado en el escritorio: ${zipPath}`, 'info');
      } catch (error) {
        addLog(`Advertencia: No se pudieron eliminar algunos archivos temporales: ${error.message}`, 'warning');
      }

      addLog('Actualización completada exitosamente', 'success');
      addLog('El servidor se reiniciará en 3 segundos...', 'info');

      // Paso 11: Reiniciar el servidor
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
      
      // Limpiar en caso de error (solo la extracción, mantener el ZIP para diagnóstico)
      try {
        // Mantener el ZIP en el escritorio incluso si hay error, para poder revisarlo
        if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });
        addLog(`ZIP guardado en el escritorio para revisión: ${zipPath}`, 'info');
      } catch (cleanupError) {
        // Ignorar errores de limpieza
      }
    }
  })();
});

// Funciones auxiliares

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

async function copyDirectory(source, dest, addLog, exclude = []) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const files = fs.readdirSync(source);
  for (const file of files) {
    // Omitir archivos excluidos
    if (exclude.includes(file)) {
      addLog(`Omitiendo: ${file}`, 'info');
      continue;
    }

    const sourcePath = path.join(source, file);
    const destPath = path.join(dest, file);

    if (fs.statSync(sourcePath).isDirectory()) {
      await copyDirectory(sourcePath, destPath, addLog, exclude);
    } else {
      fs.copyFileSync(sourcePath, destPath);
      addLog(`Archivo actualizado: ${path.relative(dest, destPath)}`, 'info');
    }
  }
}

function installPackage(packageName, cwd, addLog) {
  return new Promise((resolve, reject) => {
    addLog(`Instalando ${packageName}...`, 'info');
    const child = spawn('npm', ['install', packageName, '--no-audit', '--no-fund'], {
      cwd: cwd,
      shell: process.platform === 'win32',
      stdio: 'pipe'
    });

    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        addLog(`${packageName} instalado exitosamente`, 'success');
        resolve();
      } else {
        reject(new Error(`Error instalando ${packageName}: código ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Error al ejecutar npm install: ${error.message}`));
    });
  });
}

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

