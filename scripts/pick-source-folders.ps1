Add-Type -AssemblyName System.Windows.Forms

$folders = New-Object System.Collections.Generic.List[string]

while ($true) {
  $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
  $dialog.Description = "Select one source folder. Click OK to add it. Click Cancel when you are done."
  $dialog.ShowNewFolderButton = $false

  $result = $dialog.ShowDialog()
  if ($result -ne [System.Windows.Forms.DialogResult]::OK) {
    break
  }

  if (-not $folders.Contains($dialog.SelectedPath)) {
    $folders.Add($dialog.SelectedPath) | Out-Null
  }
}

$folders | ConvertTo-Json -Depth 2
