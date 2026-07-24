$ErrorActionPreference = "Stop"
$InstallRoot = "$env:LOCALAPPDATA\XiaosongTrendPublish"
Remove-Item -Path "HKCU:\Software\Classes\trendpublish" -Recurse -Force -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*collection-bridge/server.ts*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Remove-Item -Path $InstallRoot -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "TrendPublish 本地发布器已移除。"
