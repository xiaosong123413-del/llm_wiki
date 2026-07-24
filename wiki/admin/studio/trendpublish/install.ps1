param(
  [string]$BaseUrl = "https://llm-wiki.cn/admin/studio/trendpublish"
)

$ErrorActionPreference = "Stop"
$InstallRoot = "$env:LOCALAPPDATA\XiaosongTrendPublish"
$RepoRoot = Join-Path $InstallRoot "ai-trend-publish"
$BridgeTarget = Join-Path $RepoRoot "src\apps\collection-bridge\server.ts"
$ConfigTarget = Join-Path $RepoRoot "config\trendpublish.config.ts"

Write-Host ""
Write-Host "安装小宋公众号本地发布器" -ForegroundColor Yellow
Write-Host ""

if (!(Get-Command deno -ErrorAction SilentlyContinue)) {
  Write-Host "正在安装 Deno…"
  Invoke-RestMethod https://deno.land/install.ps1 | Invoke-Expression
  $env:Path = "$HOME\.deno\bin;$env:Path"
}
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
  throw "未检测到 Git。请先安装 Git for Windows，再重新运行此脚本。"
}

New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
if (Test-Path (Join-Path $RepoRoot ".git")) {
  Write-Host "正在更新 liyown/ai-trend-publish…"
  git -C $RepoRoot pull --ff-only
} else {
  Write-Host "正在下载 liyown/ai-trend-publish…"
  git clone --depth 1 https://github.com/liyown/ai-trend-publish.git $RepoRoot
}

New-Item -ItemType Directory -Force -Path (Split-Path $BridgeTarget) | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $ConfigTarget) | Out-Null

$downloads = @{
  "$BaseUrl/bridge/server.ts" = $BridgeTarget
  "$BaseUrl/bridge/trendpublish.config.ts" = $ConfigTarget
  "$BaseUrl/configure.ps1" = (Join-Path $InstallRoot "configure.ps1")
  "$BaseUrl/launch.ps1" = (Join-Path $InstallRoot "launch.ps1")
  "$BaseUrl/uninstall.ps1" = (Join-Path $InstallRoot "uninstall.ps1")
}
foreach ($entry in $downloads.GetEnumerator()) {
  Write-Host "下载 $($entry.Key)"
  Invoke-WebRequest -Uri $entry.Key -OutFile $entry.Value -UseBasicParsing
}

$protocolRoot = "HKCU:\Software\Classes\trendpublish"
New-Item -Path $protocolRoot -Force | Out-Null
Set-ItemProperty -Path $protocolRoot -Name "(Default)" -Value "URL:TrendPublish Protocol"
Set-ItemProperty -Path $protocolRoot -Name "URL Protocol" -Value ""
New-Item -Path "$protocolRoot\DefaultIcon" -Force | Out-Null
Set-ItemProperty -Path "$protocolRoot\DefaultIcon" -Name "(Default)" -Value "powershell.exe,0"
New-Item -Path "$protocolRoot\shell\open\command" -Force | Out-Null
$launchPath = Join-Path $InstallRoot "launch.ps1"
$command = 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $launchPath + '" "%1"'
Set-ItemProperty -Path "$protocolRoot\shell\open\command" -Name "(Default)" -Value $command

$currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $InstallRoot /inheritance:r /grant:r "${currentIdentity}:(OI)(CI)F" | Out-Null

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $InstallRoot "configure.ps1") -InstallRoot $InstallRoot

Write-Host ""
Write-Host "安装完成。返回 Collection 网站，点击『制作公众号版』即可。" -ForegroundColor Green
Write-Host "首次使用时，浏览器可能要求允许访问本地设备并打开 TrendPublish。" -ForegroundColor DarkGray
