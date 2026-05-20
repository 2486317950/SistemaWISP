# Script PowerShell para iniciar la aplicación con ngrok
# Uso: powershell -ExecutionPolicy Bypass -File scripts/start-with-ngrok.ps1

$ErrorActionPreference = "Stop"

# Colores
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

# Crear carpeta de logs
$logsDir = Join-Path $PSScriptRoot "..\bat-scripts\logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

# Generar nombre de archivo de log
$logDate = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = Join-Path $logsDir "ngrok_startup_$logDate.log"

function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "[$timestamp] $Message"
}

# Iniciar log
Write-Log "========================================"
Write-Log "  LOG - INICIAR APP CON NGROK"
Write-Log "========================================"
Write-Log "Fecha: $(Get-Date)"
Write-Log "Archivo de log: $logFile"
Write-Log "Directorio actual: $(Get-Location)"
Write-Log ""

Write-ColorOutput Cyan "`n========================================"
Write-ColorOutput Cyan "  Iniciando Sistema ISP con Ngrok"
Write-ColorOutput Cyan "========================================`n"
Write-Output "Log: $logFile`n"

# Verificar Node.js
Write-ColorOutput Cyan "[1/7] Verificando Node.js..."
Write-Log "[1/7] Verificando Node.js..."
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw "Node.js no encontrado" }
    Write-ColorOutput Green "OK - Node.js encontrado"
    Write-Log "Node.js encontrado"
} catch {
    Write-ColorOutput Red "ERROR: Node.js no encontrado"
    Write-Log "ERROR: Node.js no encontrado"
    exit 1
}

# Verificar npm
Write-ColorOutput Cyan "[2/7] Verificando npm..."
Write-Log "[2/7] Verificando npm..."
try {
    $npmVersion = npm --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw "npm no encontrado" }
    Write-ColorOutput Green "OK - npm encontrado"
    Write-Log "npm encontrado"
} catch {
    Write-ColorOutput Red "ERROR: npm no encontrado"
    Write-Log "ERROR: npm no encontrado"
    exit 1
}

# Verificar ngrok
Write-ColorOutput Cyan "[3/7] Buscando ngrok..."
Write-Log "[3/7] Buscando ngrok..."
$ngrokCmd = $null

# Buscar ngrok
$ngrokPath = Get-Command ngrok -ErrorAction SilentlyContinue
if ($ngrokPath) {
    $ngrokCmd = $ngrokPath.Source
} elseif (Test-Path "ngrok.exe") {
    $ngrokCmd = (Resolve-Path "ngrok.exe").Path
} elseif (Test-Path "$env:APPDATA\npm\ngrok.cmd") {
    $ngrokCmd = "$env:APPDATA\npm\ngrok.cmd"
} elseif (Test-Path "$env:APPDATA\npm\ngrok.exe") {
    $ngrokCmd = "$env:APPDATA\npm\ngrok.exe"
}

if (-not $ngrokCmd) {
    Write-ColorOutput Red "ERROR: ngrok no encontrado"
    Write-Log "ERROR: ngrok no encontrado"
    Write-Output "Por favor instala ngrok: npm install -g ngrok"
    exit 1
}

Write-ColorOutput Green "OK - ngrok encontrado: $ngrokCmd"
Write-Log "ngrok encontrado: $ngrokCmd"

# Verificar package.json
Write-ColorOutput Cyan "[4/7] Verificando proyecto..."
Write-Log "[4/7] Verificando proyecto..."
$packageJson = Join-Path (Get-Location) "package.json"
if (-not (Test-Path $packageJson)) {
    Write-ColorOutput Red "ERROR: package.json no encontrado"
    Write-Log "ERROR: package.json no encontrado"
    exit 1
}
Write-ColorOutput Green "OK - Proyecto verificado"
Write-Log "package.json encontrado"

# Detener servidores anteriores
Write-ColorOutput Cyan "[5/7] Deteniendo servidores anteriores..."
Write-Log "[5/7] Deteniendo servidores anteriores..."
$stopScript = Join-Path $PSScriptRoot "stop-servers.js"
if (Test-Path $stopScript) {
    node $stopScript --summary --skip-frontend 2>&1 | Out-Null
}
Start-Sleep -Seconds 2
Write-ColorOutput Green "OK - Servidores detenidos"
Write-Log "Servidores detenidos"

# Construir cliente
Write-ColorOutput Cyan "[6/7] Construyendo cliente (esto puede tardar unos minutos)..."
Write-Log "[6/7] Construyendo cliente..."
try {
    npm run build 2>&1 | Tee-Object -Variable buildOutput | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Error al construir" }
    
    $distDir = Join-Path (Get-Location) "client\dist"
    if (-not (Test-Path $distDir)) {
        throw "client\dist no se creó"
    }
    
    Write-ColorOutput Green "OK - Cliente construido"
    Write-Log "Cliente construido correctamente"
} catch {
    Write-ColorOutput Red "ERROR: Error al construir el cliente"
    Write-Log "ERROR: Error al construir el cliente"
    Write-Output "Revisa el log: $logFile"
    exit 1
}

# Cargar configuración de ngrok
$ngrokDomain = ""
$ngrokDomain2 = ""
$ngrokAuthToken = ""
$ngrokConfig = Join-Path (Get-Location) "ngrok-config.bat"

if (Test-Path $ngrokConfig) {
    Write-Log "Cargando configuración de ngrok..."
    $configContent = Get-Content $ngrokConfig -Raw
    if ($configContent -match 'set\s+NGROK_DOMAIN=(.+)') {
        $ngrokDomain = $matches[1].Trim()
    }
    if ($configContent -match 'set\s+NGROK_DOMAIN_2=(.+)') {
        $ngrokDomain2 = $matches[1].Trim()
    }
    if ($configContent -match 'set\s+NGROK_AUTHTOKEN=(.+)') {
        $ngrokAuthToken = $matches[1].Trim()
    }
}

# Configurar authtoken si existe
if ($ngrokAuthToken) {
    Write-Log "Configurando authtoken de ngrok..."
    & $ngrokCmd config add-authtoken $ngrokAuthToken 2>&1 | Out-Null
}

# Iniciar servidor y ngrok
Write-ColorOutput Cyan "[7/7] Iniciando servidor y ngrok..."
Write-Log "[7/7] Iniciando servidor y ngrok..."

# Iniciar servidor
Write-Log "Iniciando servidor..."
$serverProcess = Start-Process -FilePath "node" -ArgumentList "index.js" -WorkingDirectory (Join-Path (Get-Location) "server") -PassThru -WindowStyle Hidden -Environment @{NODE_ENV="production"}
Write-Log "Servidor iniciado con PID: $($serverProcess.Id)"
Start-Sleep -Seconds 5

# Iniciar ngrok
Write-Log "Iniciando ngrok..."
$ngrokArgs = @("http", "5000")
if ($ngrokDomain) {
    $ngrokArgs += "--domain", $ngrokDomain
}

$ngrokProcess = Start-Process -FilePath $ngrokCmd -ArgumentList $ngrokArgs -PassThru -WindowStyle Minimized
Write-Log "Ngrok iniciado con PID: $($ngrokProcess.Id)"
Start-Sleep -Seconds 8

# Obtener URL de ngrok
Write-Output "`nEsperando que ngrok esté listo..."
Write-Log "Esperando que ngrok esté listo..."

$maxRetries = 30
$retryCount = 0
$ngrokUrl = $null

while ($retryCount -lt $maxRetries -and -not $ngrokUrl) {
    Start-Sleep -Seconds 3
    $retryCount++
    
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 3 -ErrorAction Stop
        if ($response.tunnels -and $response.tunnels.Count -gt 0) {
            $httpsTunnel = $response.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
            $tunnel = if ($httpsTunnel) { $httpsTunnel } else { $response.tunnels[0] }
            $ngrokUrl = $tunnel.public_url
            
            if ($ngrokUrl -and $ngrokUrl.StartsWith("https://")) {
                break
            }
        }
    } catch {
        # Continuar intentando
    }
}

if (-not $ngrokUrl) {
    Write-ColorOutput Red "`nERROR: No se pudo obtener URL de ngrok"
    Write-Output "Puedes ver la URL manualmente en: http://127.0.0.1:4040"
    Write-Log "ERROR: No se pudo obtener URL de ngrok después de $maxRetries intentos"
    exit 1
}

# Mostrar éxito
Clear-Host
Write-ColorOutput Cyan "`n========================================"
Write-ColorOutput Cyan "  APLICACIÓN INICIADA CORRECTAMENTE"
Write-ColorOutput Cyan "========================================`n"
Write-ColorOutput Green "URL de Ngrok: $ngrokUrl"
Write-Output "`nAbriendo navegador...`n"

Write-Log "URL obtenida: $ngrokUrl"
Write-Log "========================================"
Write-Log "  SCRIPT COMPLETADO EXITOSAMENTE"
Write-Log "========================================"

# Abrir navegador
Start-Process $ngrokUrl

Write-Output "Log guardado en: $logFile"
Write-Output "`nLa aplicación está corriendo en segundo plano."
Write-Output "Esta ventana se cerrará en 15 segundos...`n"
Start-Sleep -Seconds 15



