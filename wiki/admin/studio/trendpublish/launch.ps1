param(
  [Parameter(ValueFromRemainingArguments=$true)]
  [string[]]$ActivationUri
)

$ErrorActionPreference = "Stop"
$InstallRoot = "$env:LOCALAPPDATA\XiaosongTrendPublish"
$RepoRoot = Join-Path $InstallRoot "ai-trend-publish"
$settingsPath = Join-Path $InstallRoot "settings.json"
$secretsPath = Join-Path $InstallRoot "secrets.xml"
$configPath = Join-Path $RepoRoot "config\trendpublish.config.ts"

try {
  Invoke-RestMethod -Uri "http://127.0.0.1:8765/api/health" -TimeoutSec 1 | Out-Null
  exit 0
} catch {}

if (!(Test-Path $settingsPath) -or !(Test-Path $secretsPath) -or !(Test-Path $configPath)) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show("本地发布器尚未配置。请重新运行安装脚本。", "TrendPublish") | Out-Null
  exit 1
}

function Reveal([Security.SecureString]$Value) {
  if ($null -eq $Value) { return "" }
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
$secrets = Import-Clixml $secretsPath

$env:AI_BASE_URL = $settings.aiBaseUrl
$env:AI_MODEL = $settings.aiModel
$env:WEIXIN_AUTHOR = $settings.author
$env:WEIXIN_PUBLISH_PROVIDER = $settings.publishProvider
$env:TRENDPUBLISH_ALLOWED_ORIGINS = $settings.allowedOrigins
$env:TRENDPUBLISH_BRIDGE_PORT = [string]$settings.bridgePort
$env:AI_API_KEY = Reveal $secrets.AI_API_KEY
$env:WEIXIN_APP_ID = Reveal $secrets.WEIXIN_APP_ID
$env:WEIXIN_APP_SECRET = Reveal $secrets.WEIXIN_APP_SECRET
$env:WEIXIN_RELAY_URL = Reveal $secrets.WEIXIN_RELAY_URL
$env:WEIXIN_RELAY_TOKEN = Reveal $secrets.WEIXIN_RELAY_TOKEN
$env:TRENDPUBLISH_BRIDGE_KEY = Reveal $secrets.TRENDPUBLISH_BRIDGE_KEY
$env:SERVER_API_KEY = Reveal $secrets.SERVER_API_KEY
$env:TRENDPUBLISH_CONFIG = $configPath

$deno = Get-Command deno -ErrorAction Stop
$arguments = @("run", "--node-modules-dir=auto", "-A", "src/apps/collection-bridge/server.ts")
Start-Process -FilePath $deno.Source -ArgumentList $arguments -WorkingDirectory $RepoRoot -WindowStyle Hidden
