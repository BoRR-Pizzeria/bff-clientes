<#
  Levanta el BFFBORR sobre la malla ZeroTier de desarrollo.

  Topologia (ver README.md):
    Front 10.144.0.3:4321  --PUBLIC_BFF_URL-->  BFF 10.144.0.2:8788  --SUPABASE_URL-->  Supa 10.144.0.1:54321

  Uso:
    .\scripts\start-bff.ps1
#>

param(
    [string]$FrontOrigin = 'http://10.144.0.3:4321'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

$ztAddr = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.InterfaceAlias -like 'ZeroTier*' } |
    Select-Object -First 1 -ExpandProperty IPAddress

if (-not $ztAddr) {
    Write-Warning "No se detecto un adaptador ZeroTier activo. Verifica el servicio 'ZeroTier One' y que la red este unida (zerotier-cli listnetworks)."
} elseif ($ztAddr -ne '10.144.0.2') {
    Write-Warning "El adaptador ZeroTier tiene la IP $ztAddr (se esperaba 10.144.0.2). Revisa la asignacion de IP del nodo en ZeroTier Central."
} else {
    Write-Host "ZeroTier OK -> $ztAddr" -ForegroundColor Green
}

Push-Location $repoRoot
try {
    if (-not (Test-Path '.env')) {
        Write-Host "Creando .env desde .env.example..." -ForegroundColor Yellow
        Copy-Item '.env.example' '.env'
    }

    if (-not (Test-Path '.dev.vars')) {
        Write-Host "Creando .dev.vars desde .env.example (+ FRONT_ORIGIN)..." -ForegroundColor Yellow
        Copy-Item '.env.example' '.dev.vars'
        Add-Content '.dev.vars' "FRONT_ORIGIN=$FrontOrigin"
    }

    if (-not (Test-Path 'node_modules')) {
        Write-Host "Instalando dependencias (npm install)..." -ForegroundColor Yellow
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install fallo (exit $LASTEXITCODE)" }
    }

    Write-Host "FRONT_ORIGIN=$FrontOrigin" -ForegroundColor DarkGray
    Write-Host "Levantando BFF en http://10.144.0.2:8788 (Ctrl+C para detener)..." -ForegroundColor Cyan
    npm run dev:zt
}
finally {
    Pop-Location
}
