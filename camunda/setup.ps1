$ErrorActionPreference = "Stop"
$Base = "http://localhost:8080/engine-rest"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Bpmn = Join-Path $Root "SPIB_ObradaNarudzbe.bpmn"

Write-Host "Camunda setup SPIB..." -ForegroundColor Cyan

try {
  Invoke-RestMethod -Uri "$Base/version" -Method Get | Out-Null
} catch {
  Write-Host "Camunda ne radi na $Base - pokreni: docker start camunda" -ForegroundColor Red
  exit 1
}

Write-Host "Deploy BPMN..."
curl.exe -s -X POST "$Base/deployment/create" `
  -F "deployment-name=SPIB_ObradaNarudzbe" `
  -F "data=@$Bpmn;type=application/octet-stream"

function Ensure-Group($id, $name) {
  try {
    Invoke-RestMethod -Uri "$Base/group/create" -Method Post -ContentType "application/json" `
      -Body (@{ id = $id; name = $name; type = "WORKFLOW" } | ConvertTo-Json) | Out-Null
    Write-Host "  grupa $id"
  } catch {
    Write-Host "  grupa $id (vec postoji)"
  }
}

function Ensure-User($id, $first, $last, $groups) {
  try {
    $body = @{
      profile     = @{ id = $id; firstName = $first; lastName = $last; email = "$id@spi.local" }
      credentials = @{ password = "demo" }
    } | ConvertTo-Json -Depth 4
    Invoke-RestMethod -Uri "$Base/user/create" -Method Post -ContentType "application/json" -Body $body | Out-Null
    Write-Host "  user $id"
  } catch {
    Write-Host "  user $id (vec postoji)"
  }
  foreach ($g in $groups) {
    if ($g) {
      try {
        Invoke-RestMethod -Uri "$Base/group/$g/members/$id" -Method Put | Out-Null
      } catch { }
    }
  }
}

Write-Host "Grupe..."
Ensure-Group "djelatnik" "Djelatnik"
Ensure-Group "administrator" "Administrator"

Write-Host "Korisnici (lozinka: demo)..."
Ensure-User "kupac1" "Kupac" "Demo" @()
Ensure-User "djelatnik1" "Djelatnik" "Demo" @("djelatnik")
Ensure-User "admin1" "Admin" "Demo" @("administrator")

function Ensure-Auth($userId, $resourceType, $resourceId, [string[]]$permissions) {
  $body = @{
    type         = 1
    permissions  = $permissions
    userId       = $userId
    resourceType = $resourceType
    resourceId   = $resourceId
  } | ConvertTo-Json
  try {
    Invoke-RestMethod -Uri "$Base/authorization/create" -Method Post -ContentType "application/json" -Body $body | Out-Null
    Write-Host "  auth $userId -> $resourceId"
  } catch {
    Write-Host "  auth $userId -> $resourceId (vec postoji)"
  }
}

Write-Host "Pristup Tasklistu..."
foreach ($u in @("kupac1", "djelatnik1", "admin1")) {
  Ensure-Auth $u 0 "tasklist" @("ACCESS")
  Ensure-Auth $u 6 "SPIB_ObradaNarudzbe" @("READ", "CREATE_INSTANCE", "UPDATE", "DELETE")
  Ensure-Auth $u 7 "*" @("READ", "UPDATE", "DELETE", "CREATE", "ALL")
}

Write-Host ""
Write-Host "Gotovo." -ForegroundColor Green
Write-Host "Tasklist: http://localhost:8080/camunda/app/tasklist/"
Write-Host "SPIB UI:  http://localhost:5173/proces-narudzbe"
