[CmdletBinding()]
param([switch]$BuildBackend)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
    & docker info --format '{{.ServerVersion}}' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Inicie Docker Desktop y espere a que el motor esté disponible.' }
    $composeJson = & docker compose config --format json
    if ($LASTEXITCODE -ne 0) { throw 'La configuración de Compose no es válida.' }
    $compose = $composeJson | ConvertFrom-Json
    $networkName = $compose.networks.icase_network.name
    if (-not $networkName) { throw 'No se pudo determinar la red de ICASE.' }

    # Docker Desktop may retain a healthy DB process with no network endpoint after restarting.
    foreach ($service in @('postgres', 'postgres_codegen', 'backend')) {
        $containerId = & docker compose ps --all --quiet $service
        if ($LASTEXITCODE -ne 0) { throw "No se pudo consultar $service." }
        if (-not $containerId) { continue }
        $containerJson = & docker inspect $containerId
        if ($LASTEXITCODE -ne 0) { throw "No se pudo inspeccionar $service." }
        $container = @($containerJson | ConvertFrom-Json)[0]
        $attached = @($container.NetworkSettings.Networks.PSObject.Properties.Name) -contains $networkName
        $missingPort = $false
        if ($container.State.Running) {
            foreach ($binding in $container.HostConfig.PortBindings.PSObject.Properties) {
                $actual = @($container.NetworkSettings.Ports.($binding.Name))
                foreach ($expected in @($binding.Value)) {
                    if (-not ($actual | Where-Object { $_.HostPort -eq $expected.HostPort -and (-not $expected.HostIp -or $_.HostIp -eq $expected.HostIp) })) { $missingPort = $true }
                }
            }
        }
        if (-not $attached -or $missingPort) {
            if ($service -in @('postgres', 'postgres_codegen')) {
                $volumeKey = if ($service -eq 'postgres') { 'postgres_data' } else { 'postgres_codegen_data' }
                $expectedVolume = $compose.volumes.$volumeKey.name
                $existingVolume = @($container.Mounts | Where-Object { $_.Destination -eq '/var/lib/postgresql/data' })[0]
                if (-not $expectedVolume -or $existingVolume.Type -ne 'volume' -or $existingVolume.Name -ne $expectedVolume) {
                    throw "El volumen de $service no coincide con Compose. No se recreo el contenedor."
                }
            }
            Write-Host "[ICASE] Reparando red/puertos de $service; se conservan los volumenes."
            & docker compose up -d --no-deps --force-recreate $service
            if ($LASTEXITCODE -ne 0) { throw "No se pudo recuperar $service." }
        }
    }
    if ($BuildBackend) {
        & docker compose build backend
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo construir el backend.' }
    }
    & docker compose up -d postgres postgres_codegen backend frontend
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar ICASE.' }
    & docker compose ps
} finally { Pop-Location }
