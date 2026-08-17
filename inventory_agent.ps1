# ==============================================================================
# Cisa TI - Agente de Inventario + Heartbeat
# ==============================================================================
$SERVER_URL_REPORT    = "http://172.21.20.14:8006/api/agent/report"
$SERVER_URL_HEARTBEAT = "http://172.21.20.14:8006/api/agent/heartbeat"

# Si se pasa -HeartbeatOnly, solo envía heartbeat (tarea frecuente)
param(
    [switch]$HeartbeatOnly
)

function Get-InventoryPayload {
    $cs   = Get-CimInstance -ClassName Win32_ComputerSystem
    $bios = Get-CimInstance -ClassName Win32_BIOS
    $os   = Get-CimInstance -ClassName Win32_OperatingSystem
    $cpu  = Get-CimInstance -ClassName Win32_Processor | Select-Object -First 1

    $ramBytes = (Get-CimInstance -ClassName Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum
    $ramGB    = [math]::Round($ramBytes / 1GB, 2)

    $disk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'"
    $diskTotal = if ($disk) { [math]::Round($disk.Size / 1GB, 2) } else { 0 }
    $diskFree  = if ($disk) { [math]::Round($disk.FreeSpace / 1GB, 2) } else { 0 }

    $net = Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration |
           Where-Object { $_.IPEnabled -eq $true -and $_.DefaultIPGateway -ne $null } |
           Select-Object -First 1

    $serial = if ($bios.SerialNumber) { $bios.SerialNumber.Trim() } else { "" }
    if ([string]::IsNullOrWhiteSpace($serial) -or $serial -eq "To Be Filled By O.E.M.") {
        $serial = "SN-" + $env:COMPUTERNAME
    }

    return @{
        hostname      = $env:COMPUTERNAME
        serial_number = $serial
        manufacturer  = $cs.Manufacturer
        model         = $cs.Model
        os_name       = $os.Caption
        processor     = if ($cpu) { $cpu.Name.Trim() } else { "N/A" }
        ram_gb        = $ramGB
        disk_total_gb = $diskTotal
        disk_free_gb  = $diskFree
        ip_address    = if ($net -and $net.IPAddress) { $net.IPAddress[0] } else { "N/A" }
        mac_address   = if ($net) { $net.MACAddress } else { "N/A" }
        last_user     = $cs.UserName
    }
}

try {
    $data = Get-InventoryPayload
    $json = $data | ConvertTo-Json -Depth 3

    if ($HeartbeatOnly) {
        $url = $SERVER_URL_HEARTBEAT
        $body = @{
            hostname      = $data.hostname
            serial_number = $data.serial_number
            ip_address    = $data.ip_address
        } | ConvertTo-Json
    } else {
        $url = $SERVER_URL_REPORT
        $body = $json
    }

    $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json" -TimeoutSec 15

    # En modo silencioso (tarea programada) no mostramos ventanas
    if (-not $HeartbeatOnly) {
        Write-Host "OK: $($response.message) [$($response.action)]"
    }
}
catch {
    if (-not $HeartbeatOnly) {
        Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
    exit 1
}