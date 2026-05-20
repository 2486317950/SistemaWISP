# Despliegue SistemaWISP a AWS
# Ejecutar desde PowerShell en la raíz del proyecto: .\deploy-aws.ps1
#
# Si da "Permission denied (publickey)":
# 1. Comprueba que Wisp.pem es la clave de esta instancia (52.14.80.92).
# 2. Prueba cambiar $User a "ec2-user" (Amazon Linux) si usas ubuntu y falla.

$ErrorActionPreference = "Stop"
$Key = "D:\Escritorio\Wisp_AWS.pem"
$ServerHost = "52.14.80.92"
# Usuario: ubuntu (Ubuntu AMI) o ec2-user (Amazon Linux). Cambia si hace falta.
$User = "ubuntu"
$Remote = "${User}@${ServerHost}"
$ProjectRoot = $PSScriptRoot

Write-Host "=== Build frontend ===" -ForegroundColor Cyan
Set-Location "$ProjectRoot\client"
npm run build
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`n=== Subir client/dist a AWS ===" -ForegroundColor Cyan
# Crear directorio remoto si no existe y subir
ssh -i $Key -o ConnectTimeout=15 -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL $Remote "mkdir -p SistemaWISP/client/dist"
scp -i $Key -o ConnectTimeout=15 -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL -r "$ProjectRoot\client\dist\*" "${Remote}:SistemaWISP/client/dist/"
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`n=== Subir server a AWS (solo código, sin node_modules/.env/BD) ===" -ForegroundColor Cyan
ssh -i $Key -o ConnectTimeout=15 -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL $Remote "mkdir -p SistemaWISP/server"
# Copiar a carpeta temporal excluyendo node_modules, .env, backups, uploads, BD
$ServerDeploy = "$ProjectRoot\server_deploy_aws"
if (Test-Path $ServerDeploy) { Remove-Item -Recurse -Force $ServerDeploy }
$null = New-Item -ItemType Directory -Path $ServerDeploy -Force
robocopy "$ProjectRoot\server" $ServerDeploy /E /XD node_modules backups uploads /XF .env *.sqlite /NFL /NDL /NJH /NJS
scp -i $Key -o ConnectTimeout=15 -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL -r "$ServerDeploy\*" "${Remote}:SistemaWISP/server/"
$scpOk = $LASTEXITCODE -eq 0
Remove-Item -Recurse -Force $ServerDeploy -ErrorAction SilentlyContinue
if (-not $scpOk) { exit 1 }

Write-Host "`n=== Instalar dependencias en el servidor (npm install) ===" -ForegroundColor Cyan
ssh -i $Key -o ConnectTimeout=15 -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL $Remote "cd ~/SistemaWISP/server && npm install --production"
Write-Host "`n=== Reiniciar backend (PM2) ===" -ForegroundColor Cyan
ssh -i $Key -o ConnectTimeout=15 -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL $Remote "cd ~/SistemaWISP/server && pm2 restart sistemawisp || (pm2 start server.js --name sistemawisp)"
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`n=== Listo. App en http://${ServerHost} (o puerto que uses) ===" -ForegroundColor Green
