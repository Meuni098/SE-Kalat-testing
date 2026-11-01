Option Explicit
Dim app, doc, service, process, previous, ownedId, ownedDate, count, fileSystem, recordFile, previousLinks
Set service = GetObject("winmgmts:\\.\root\cimv2")
Set previous = CreateObject("Scripting.Dictionary")
For Each process In service.ExecQuery("SELECT ProcessId FROM Win32_Process WHERE Name='WINWORD.EXE'")
  previous.Add CStr(process.ProcessId), True
Next
On Error Resume Next
Set app = CreateObject("Word.Application")
If Err.Number <> 0 Then Fail "Word could not start."
count = 0
For Each process In service.ExecQuery("SELECT ProcessId,CreationDate FROM Win32_Process WHERE Name='WINWORD.EXE'")
  If Not previous.Exists(CStr(process.ProcessId)) Then
    count = count + 1
    ownedId = process.ProcessId
    ownedDate = process.CreationDate
  End If
Next
If count <> 1 Then
  Set app = Nothing
  WScript.Quit 2
End If
Set fileSystem = CreateObject("Scripting.FileSystemObject")
Set recordFile = fileSystem.CreateTextFile(WScript.Arguments(2), True, False)
recordFile.Write "{""id"":" & ownedId & ",""created"":""" & ownedDate & """}"
recordFile.Close
If Err.Number <> 0 Then Fail "Word process could not be isolated."
app.Visible = False
app.DisplayAlerts = 0
app.AutomationSecurity = 3
previousLinks = app.Options.UpdateLinksAtOpen
app.Options.UpdateLinksAtOpen = False
Set doc = app.Documents.Open(WScript.Arguments(0), False, True, False)
If Err.Number <> 0 Then Fail "Word could not open the temporary copy."
doc.ExportAsFixedFormat WScript.Arguments(1), 17, False
If Err.Number <> 0 Then Fail "Word PDF export failed."
doc.Close False
app.Options.UpdateLinksAtOpen = previousLinks
app.Quit
Set doc = Nothing
Set app = Nothing
WScript.Quit 0

Sub Fail(message)
  On Error Resume Next
  If IsObject(doc) Then doc.Close False
  If IsObject(app) And Not IsEmpty(previousLinks) Then app.Options.UpdateLinksAtOpen = previousLinks
  If IsObject(app) Then app.Quit
  WScript.Echo message
  WScript.Quit 1
End Sub
