$Base = "http://localhost:8080/engine-rest"

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
    Write-Host "  auth $userId -> $resourceId ($($permissions -join ','))"
  } catch {
    Write-Host "  auth $userId -> $resourceId (vec postoji ili preskoceno)"
  }
}

$users = @("kupac1", "djelatnik1", "admin1")
foreach ($u in $users) {
  Ensure-Auth $u 0 "tasklist" @("ACCESS")
  Ensure-Auth $u 6 "SPIB_ObradaNarudzbe" @("READ", "CREATE_INSTANCE", "UPDATE", "DELETE")
  Ensure-Auth $u 7 "*" @("READ", "UPDATE", "DELETE", "CREATE", "ALL")
}

Write-Host "Autorizacije postavljene."
