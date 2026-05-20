Set WshShell = CreateObject("WScript.Shell")

' Detener todos los procesos node.exe y ngrok.exe
On Error Resume Next

WshShell.Run "taskkill /F /IM node.exe /T", 0, True
WshShell.Run "taskkill /F /IM ngrok.exe /T", 0, True

WScript.Sleep 1000

MsgBox "Procesos detenidos" & vbCrLf & vbCrLf & _
       "node.exe y ngrok.exe han sido cerrados.", _
       vbInformation, "Sistema ISP"




