$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$desktopRoot = Join-Path $projectRoot "desktop-webui"
$wikiCloneRoot = Join-Path $projectRoot "wiki-clone"
$electronRoot = Join-Path $desktopRoot "node_modules\\electron"
$electronDist = Join-Path $electronRoot "dist"
$localElectronRoot = "E:\electron"
$desktopIconPath = Join-Path $desktopRoot "assets\\llm-wiki.ico"
$launcherPath = Join-Path $PSScriptRoot "start-desktop-webui.ps1"
$desktopShortcutPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "LLM Wiki WebUI.lnk"
$wikiCloneUrl = "http://127.0.0.1:4176/"

function Get-WikiRoot {
    $configPath = Join-Path $projectRoot "sync-compile-config.json"
    if (-not (Test-Path $configPath)) {
        return $null
    }

    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        if ($config.runtime_output_root) {
            return (Join-Path ([string]$config.runtime_output_root) "wiki")
        }
    } catch {
        return $null
    }

    return $null
}

function Ensure-LocalElectron {
    if (Test-Path (Join-Path $electronDist "electron.exe")) {
        return
    }

    if (-not (Test-Path (Join-Path $localElectronRoot "electron.exe"))) {
        throw "Electron binary not found. Expected either $electronDist\\electron.exe or E:\\electron\\electron.exe."
    }

    New-Item -ItemType Directory -Force -Path $electronDist | Out-Null
    robocopy $localElectronRoot $electronDist /E /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
    Set-Content -Path (Join-Path $electronRoot "path.txt") -Value "electron.exe" -NoNewline
}

function Ensure-DesktopShortcut {
    if (-not (Test-Path $desktopIconPath)) {
        return
    }

    try {
        $wshShell = New-Object -ComObject WScript.Shell
        $shortcut = $wshShell.CreateShortcut($desktopShortcutPath)
        $shortcut.TargetPath = "powershell.exe"
        $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File ""$launcherPath"""
        $shortcut.WorkingDirectory = $projectRoot
        $shortcut.IconLocation = $desktopIconPath
        $shortcut.Description = "LLM Wiki WebUI"
        $shortcut.Save()
    } catch {
        Write-Warning "Desktop shortcut update failed, continuing launch: $($_.Exception.Message)"
    }
}

function Get-DesktopProcesses {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            ($_.Name -eq "electron.exe" -and $_.CommandLine -like "*llm-wiki-compiler-main*desktop-webui*") -or
            ($_.Name -eq "node.exe" -and $_.CommandLine -like "*llm-wiki-compiler-main*web*server/index.ts*")
        }
}

function Test-VisibleElectronWindow {
    $electronProcesses = Get-Process electron -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -like "*llm-wiki-compiler-main*desktop-webui*" }
    foreach ($process in $electronProcesses) {
        if ($process.MainWindowHandle -ne 0 -and -not [string]::IsNullOrWhiteSpace($process.MainWindowTitle)) {
            return $true
        }
    }
    return $false
}

function Test-WikiCloneServer {
    try {
        $response = Invoke-WebRequest -Uri $wikiCloneUrl -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -lt 500
    } catch {
        return $false
    }
}

function Start-WikiCloneServer {
    if (-not (Test-Path $wikiCloneRoot)) {
        return
    }

    if (Test-WikiCloneServer) {
        return
    }

    if (-not (Test-Path (Join-Path $wikiCloneRoot ".next\\BUILD_ID"))) {
        $buildProc = Start-Process -FilePath "npm.cmd" `
            -ArgumentList "run", "build" `
            -WorkingDirectory $wikiCloneRoot `
            -WindowStyle Hidden `
            -PassThru -Wait
        if ($buildProc.ExitCode -ne 0) {
            throw "wiki-clone build failed (exit $($buildProc.ExitCode))"
        }
    }

    $wikiRoot = Get-WikiRoot
    if ($wikiRoot) {
        $env:WIKI_ROOT = $wikiRoot
    }

    Start-Process -FilePath "npm.cmd" `
        -ArgumentList "run", "start" `
        -WorkingDirectory $wikiCloneRoot `
        -WindowStyle Hidden | Out-Null

    for ($i = 0; $i -lt 20; $i += 1) {
        Start-Sleep -Milliseconds 500
        if (Test-WikiCloneServer) {
            return
        }
    }
}

function Stop-StaleDesktopProcesses {
    $stale = Get-DesktopProcesses
    foreach ($process in $stale) {
        try {
            Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
        } catch {
            # Best effort cleanup. If a process already exited, continue.
        }
    }
}

Ensure-LocalElectron
Ensure-DesktopShortcut
Start-WikiCloneServer

if (Test-VisibleElectronWindow) {
    exit 0
}

Stop-StaleDesktopProcesses
Start-Sleep -Milliseconds 500

# Build the shared web client bundle before launching the desktop shell.
$webBuildProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run web:build" `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -PassThru -Wait
if ($webBuildProc.ExitCode -ne 0) {
    throw "web build failed (exit $($webBuildProc.ExitCode))"
}

# Build TypeScript synchronously so dist/ is up-to-date before launching.
$buildProc = Start-Process -FilePath "npm.cmd" `
    -ArgumentList "run", "build" `
    -WorkingDirectory $desktopRoot `
    -WindowStyle Hidden `
    -PassThru -Wait
if ($buildProc.ExitCode -ne 0) {
    throw "desktop-webui build failed (exit $($buildProc.ExitCode))"
}

# Launch electron.exe directly – avoids the npm→cmd→batch→node chain
# that can silently fail when called from a hidden launcher context.
$electronExe = Join-Path $electronRoot "dist\electron.exe"
Start-Process -FilePath $electronExe -ArgumentList $desktopRoot
