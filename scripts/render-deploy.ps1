param(
  [string]$RenderApiKey = $env:RENDER_API_KEY,
  [string]$ServiceId,
  [string]$EnvFile = '.env',
  [string]$ApiBase = 'https://api.render.com/v1',
  [switch]$SkipEnvPatch,
  [switch]$SkipDockerConfig
)

$ErrorActionPreference = 'Stop'

function Fail([string]$msg) {
  Write-Error $msg
  exit 1
}

if (-not $RenderApiKey) {
  Fail 'RENDER_API_KEY is required (pass -RenderApiKey or set env var).'
}

if (-not $ServiceId) {
  Fail 'Service ID is required (pass -ServiceId).'
}

$headers = @{
  Authorization = "Bearer $RenderApiKey"
  'Content-Type' = 'application/json'
}

function Invoke-RenderApi {
  param(
    [ValidateSet('GET','POST','PATCH')]
    [string]$Method,
    [string]$Path,
    [object]$Body
  )

  $uri = "$ApiBase$Path"
  if ($PSBoundParameters.ContainsKey('Body')) {
    $json = $Body | ConvertTo-Json -Depth 15 -Compress
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json
  }

  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
}

function Parse-EnvFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    Fail "Env file not found: $Path"
  }

  $envVars = @()
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }

    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }

    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1)

    # remove surrounding quotes if present
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    # Render injects PORT; do not override it
    if ($key -eq 'PORT') { return }

    $secure = $true
    if ($key.StartsWith('VITE_') -or $key -match 'PUBLIC|ANON') {
      $secure = $false
    }

    $envVars += @{ name = $key; value = $value; secure = $secure }
  }

  if ($envVars.Count -eq 0) {
    Fail "No env vars found in $Path"
  }

  return $envVars
}

Write-Host "Using service: $ServiceId"

if (-not $SkipEnvPatch) {
  Write-Host "Reading env file: $EnvFile"
  $vars = Parse-EnvFile -Path $EnvFile
  Write-Host "Patching $($vars.Count) env vars..."
  [void](Invoke-RenderApi -Method PATCH -Path "/services/$ServiceId" -Body @{ envVars = $vars })
  Write-Host 'Env vars patched.'
}

if (-not $SkipDockerConfig) {
  Write-Host 'Ensuring Docker service config...'
  [void](Invoke-RenderApi -Method PATCH -Path "/services/$ServiceId" -Body @{ rootDirectory = ''; dockerfilePath = 'Dockerfile'; env = 'docker' })
  Write-Host 'Docker config patched.'
}

Write-Host 'Triggering deploy...'
$deploy = Invoke-RenderApi -Method POST -Path "/services/$ServiceId/deploys" -Body @{}
if (-not $deploy.id) {
  Fail 'Failed to create deploy.'
}

$deployId = $deploy.id
Write-Host "Deploy created: $deployId"

$terminal = @('live','build_failed','update_failed','canceled','deactivated')
while ($true) {
  Start-Sleep -Seconds 5
  $statusObj = Invoke-RenderApi -Method GET -Path "/deploys/$deployId"
  $status = $statusObj.status
  Write-Host "Status: $status"

  if ($status -eq 'live') {
    Write-Host 'Deploy succeeded.'
    break
  }

  if ($terminal -contains $status) {
    Fail "Deploy ended with status: $status"
  }
}