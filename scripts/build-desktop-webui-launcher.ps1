$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$sourceDir = Join-Path $root "desktop-webui-launcher"
$outDir = Join-Path $root "dist\desktop-webui-launcher"
$outExe = Join-Path $outDir "LLM-Wiki-WebUI-Launcher.exe"
$desktopExe = Join-Path ([Environment]::GetFolderPath("DesktopDirectory")) "LLM-Wiki-WebUI-Launcher.exe"
$iconPath = Join-Path $root "desktop-webui\assets\llm-wiki.ico"
$generatedProjectRoot = Join-Path $sourceDir "BuildProjectRoot.cs"

$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) {
  $csc = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}
if (-not (Test-Path $csc)) {
  throw "csc.exe was not found. Install .NET Framework developer tools or .NET SDK."
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$escapedRoot = $root.Replace("\", "\\")

@"
namespace LlmWikiWebUiLauncher
{
    internal static class BuildProjectRoot
    {
        internal const string Value = "$escapedRoot";
    }
}
"@ | Set-Content -Path $generatedProjectRoot -Encoding UTF8

$arguments = @(
  "/nologo",
  "/target:winexe",
  "/platform:anycpu",
  "/optimize+",
  "/codepage:65001",
  "/reference:System.dll",
  "/reference:System.Core.dll",
  "/reference:System.Web.Extensions.dll",
  "/reference:System.Windows.Forms.dll",
  "/reference:System.Drawing.dll",
  "/out:$outExe"
)

if (Test-Path $iconPath) {
  $arguments += "/win32icon:$iconPath"
}

$arguments += Get-ChildItem -Path $sourceDir -Filter *.cs | Sort-Object Name | ForEach-Object { $_.FullName }

& $csc @arguments

if ($LASTEXITCODE -ne 0) {
  throw "csc.exe failed with exit code $LASTEXITCODE"
}

$runningDesktopExe = Get-Process | Where-Object { $_.Path -eq $desktopExe }
if ($runningDesktopExe) {
  $runningDesktopExe | Stop-Process -Force
  Start-Sleep -Milliseconds 300
}

Copy-Item $outExe $desktopExe -Force
if (Test-Path ([System.IO.Path]::Combine([Environment]::GetFolderPath("DesktopDirectory"), "launcher-config.json"))) {
  Remove-Item ([System.IO.Path]::Combine([Environment]::GetFolderPath("DesktopDirectory"), "launcher-config.json")) -Force
}
Write-Host "Built: $outExe"
Write-Host "Desktop exe: $desktopExe"
