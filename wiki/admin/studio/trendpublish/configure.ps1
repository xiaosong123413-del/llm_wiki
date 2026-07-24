param(
  [string]$InstallRoot = "$env:LOCALAPPDATA\XiaosongTrendPublish"
)

$ErrorActionPreference = "Stop"
$settingsPath = Join-Path $InstallRoot "settings.json"
$secretsPath = Join-Path $InstallRoot "secrets.xml"
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

function Read-Default([string]$Prompt, [string]$Default) {
  $value = Read-Host "$Prompt [$Default]"
  if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
  return $value.Trim()
}

Write-Host ""
Write-Host "配置小宋公众号本地发布器" -ForegroundColor Yellow
Write-Host "密钥仅保存在当前 Windows 用户的本地目录。" -ForegroundColor DarkGray
Write-Host ""

$aiBaseUrl = Read-Default "AI API Base URL" "https://api.deepseek.com/v1"
$aiModel = Read-Default "AI 模型" "deepseek-chat"
$author = Read-Default "公众号作者名" "小宋"
$publishProvider = Read-Default "发布方式 weixin / weixin-relay" "weixin"
$allowedOrigins = Read-Default "允许访问本地发布器的网站" "https://llm-wiki.cn"

$aiKey = Read-Host "AI API Key" -AsSecureString
$wechatAppId = Read-Host "微信公众号 AppID" -AsSecureString
$wechatAppSecret = Read-Host "微信公众号 AppSecret" -AsSecureString
$relayUrl = ConvertTo-SecureString "" -AsPlainText -Force
$relayToken = ConvertTo-SecureString "" -AsPlainText -Force
if ($publishProvider -eq "weixin-relay") {
  $relayUrl = Read-Host "Weixin Relay URL" -AsSecureString
  $relayToken = Read-Host "Weixin Relay Token" -AsSecureString
}

$randomBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($randomBytes)
$bridgeKeyPlain = [Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+','-').Replace('/','_')
$bridgeKey = ConvertTo-SecureString $bridgeKeyPlain -AsPlainText -Force
$serverApiKey = ConvertTo-SecureString ([guid]::NewGuid().ToString("N")) -AsPlainText -Force

@{
  aiBaseUrl = $aiBaseUrl
  aiModel = $aiModel
  author = $author
  publishProvider = $publishProvider
  allowedOrigins = $allowedOrigins
  bridgePort = 8765
} | ConvertTo-Json | Set-Content -Path $settingsPath -Encoding UTF8

[pscustomobject]@{
  AI_API_KEY = $aiKey
  WEIXIN_APP_ID = $wechatAppId
  WEIXIN_APP_SECRET = $wechatAppSecret
  WEIXIN_RELAY_URL = $relayUrl
  WEIXIN_RELAY_TOKEN = $relayToken
  TRENDPUBLISH_BRIDGE_KEY = $bridgeKey
  SERVER_API_KEY = $serverApiKey
} | Export-Clixml -Path $secretsPath

try {
  Set-Clipboard -Value $bridgeKeyPlain
  Write-Host ""
  Write-Host "本地配对密钥已复制到剪贴板。首次在网站生成或发送时粘贴一次。" -ForegroundColor Green
} catch {
  Write-Host "本地配对密钥：$bridgeKeyPlain" -ForegroundColor Green
}

Write-Host "配置已保存：$InstallRoot" -ForegroundColor Green
