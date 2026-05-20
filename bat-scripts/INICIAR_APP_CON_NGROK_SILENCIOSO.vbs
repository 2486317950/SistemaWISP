Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Obtener el directorio del proyecto (subir un nivel desde bat-scripts)
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

' Cambiar al directorio del proyecto
WshShell.CurrentDirectory = projectDir

' Detener procesos anteriores (silenciosamente)
On Error Resume Next
WshShell.Run "taskkill /F /IM node.exe /T", 0, True
WshShell.Run "taskkill /F /IM ngrok.exe /T", 0, True
On Error Goto 0

' Esperar a que los procesos se detengan
WScript.Sleep 2000

' Iniciar servidor backend en segundo plano
WshShell.Run "cmd /c cd server && start /B node index.js", 0, False

' Esperar a que el servidor inicie
WScript.Sleep 3000

' Iniciar ngrok en segundo plano
WshShell.Run "cmd /c start /B ngrok http 5000 --domain sistemacdcom.ngrok.dev", 0, False

' Esperar a que ngrok se conecte
WScript.Sleep 5000

' Abrir navegador con la URL de ngrok
WshShell.Run "https://sistemacdcom.ngrok.dev", 1, False

' Mostrar notificación
MsgBox "Sistema ISP iniciado correctamente" & vbCrLf & vbCrLf & _
       "URL: https://sistemacdcom.ngrok.dev" & vbCrLf & vbCrLf & _
       "El servidor y ngrok están corriendo en segundo plano.", _
       vbInformation, "Sistema ISP"

