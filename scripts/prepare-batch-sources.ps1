param(
  [Parameter(Mandatory = $true)]
  [string]$VaultRoot,

  [Parameter(Mandatory = $true)]
  [string]$NamePattern
)

$ErrorActionPreference = "Stop"

$sourcesPath = Join-Path $VaultRoot "sources"
$fullBackupPath = Join-Path $VaultRoot "sources_full"

if (-not (Test-Path -LiteralPath $fullBackupPath)) {
  Move-Item -LiteralPath $sourcesPath -Destination $fullBackupPath
}

New-Item -ItemType Directory -Force -Path $sourcesPath | Out-Null
Get-ChildItem -LiteralPath $sourcesPath -File -ErrorAction SilentlyContinue | Remove-Item -Force

$batchFiles = Get-ChildItem -LiteralPath $fullBackupPath -File |
  Where-Object { $_.Name -like $NamePattern }

foreach ($file in $batchFiles) {
  Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $sourcesPath $file.Name) -Force
}

Write-Output ("BATCH=" + $batchFiles.Count)
Write-Output ("FULL_BACKUP=" + $fullBackupPath)
