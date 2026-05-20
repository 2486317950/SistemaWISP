# Muestra la clave pública de tu .pem para copiarla al servidor
$Key = "D:\Escritorio\Wisp_AWS.pem"
if (-not (Test-Path $Key)) {
    Write-Host "No se encuentra: $Key" -ForegroundColor Red
    exit 1
}
Write-Host "Clave publica (copiala completa y pegala en el servidor):" -ForegroundColor Cyan
Write-Host ""
ssh-keygen -y -f $Key
Write-Host ""
Write-Host "Paso 2: En AWS -> Conectar a la instancia (navegador) -> ejecuta:" -ForegroundColor Yellow
Write-Host '  echo "LA_LINEA_DE_ARRIBA" >> ~/.ssh/authorized_keys' -ForegroundColor White
