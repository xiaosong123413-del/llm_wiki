param(
  [Parameter(Mandatory = $true)]
  [string]$SourceRoot,

  [Parameter(Mandatory = $true)]
  [string]$DestinationRoot
)

$ErrorActionPreference = "Stop"

$destinationSources = Join-Path $DestinationRoot "sources"
$manifestPath = Join-Path $DestinationRoot "raw_import_manifest.csv"
$excludedPattern = "\\\.(obsidian|trash|claude|claudian)(\\|$)"

function Get-StableHash([string]$Value) {
  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    $hashBytes = $sha1.ComputeHash($bytes)
    return -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
  }
  finally {
    $sha1.Dispose()
  }
}

function Sanitize-Component([string]$Value, [int]$MaxLength = 80) {
  $safe = ($Value -replace '[<>:"/\\|?*]', "-") -replace "\s+", " "
  $safe = $safe.Trim()
  if ([string]::IsNullOrWhiteSpace($safe)) {
    return "untitled"
  }
  if ($safe.Length -gt $MaxLength) {
    return $safe.Substring(0, $MaxLength).Trim()
  }
  return $safe
}

New-Item -ItemType Directory -Force -Path $destinationSources | Out-Null
Get-ChildItem -LiteralPath $destinationSources -File -Filter *.md -ErrorAction SilentlyContinue | Remove-Item -Force

$rows = New-Object System.Collections.Generic.List[object]
$files = Get-ChildItem -LiteralPath $SourceRoot -Recurse -File -Filter *.md |
  Where-Object { $_.FullName -notmatch $excludedPattern }

foreach ($file in $files) {
  $relative = $file.FullName.Substring($SourceRoot.Length).TrimStart("\")
  $relativeUnix = $relative -replace "\\", "/"
  $hash = Get-StableHash $relativeUnix

  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($relative)
  $safeBase = Sanitize-Component $baseName

  $parentPath = [System.IO.Path]::GetDirectoryName($relative)
  if ($parentPath) {
    $parentPrefix = Sanitize-Component (($parentPath -replace "\\", "__"))
    $destinationName = "${parentPrefix}__${safeBase}__$($hash.Substring(0, 8)).md"
  }
  else {
    $destinationName = "${safeBase}__$($hash.Substring(0, 8)).md"
  }

  $destinationPath = Join-Path $destinationSources $destinationName
  Copy-Item -LiteralPath $file.FullName -Destination $destinationPath -Force

  $rows.Add([pscustomobject]@{
    source_relative_path = $relativeUnix
    imported_filename   = $destinationName
    size                = $file.Length
    last_write_time     = $file.LastWriteTime.ToString("s")
  }) | Out-Null
}

$rows | Export-Csv -LiteralPath $manifestPath -NoTypeInformation -Encoding UTF8

Write-Output ("IMPORTED=" + $rows.Count)
Write-Output ("MANIFEST=" + $manifestPath)
