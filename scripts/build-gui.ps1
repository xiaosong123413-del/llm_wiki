$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$sourceDir = Join-Path $root "gui\LlmWikiGui"
$outDir = Join-Path $root "dist\gui"
$outExe = Join-Path $outDir "LlmWikiCompilerPanel.exe"
$desktopExe = Join-Path ([Environment]::GetFolderPath("DesktopDirectory")) "LLM-Wiki-Compiler-Panel.exe"

$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) {
  $csc = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}
if (-not (Test-Path $csc)) {
  throw "csc.exe was not found. Install .NET Framework developer tools or .NET SDK."
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

& $csc `
  /nologo `
  /target:winexe `
  /platform:anycpu `
  /optimize+ `
  /codepage:65001 `
  /reference:System.dll `
  /reference:System.Core.dll `
  /reference:System.Drawing.dll `
  /reference:System.Web.Extensions.dll `
  /reference:System.Windows.Forms.dll `
  "/out:$outExe" `
  (Join-Path $sourceDir "Program.cs") `
  (Join-Path $sourceDir "MainForm.cs")

Copy-Item $outExe $desktopExe -Force
Write-Host "Built: $outExe"
Write-Host "Desktop exe: $desktopExe"
