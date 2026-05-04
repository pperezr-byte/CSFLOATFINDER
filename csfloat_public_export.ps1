[CmdletBinding()]
param(
    [string]$Weapon,
    [string]$MarketHashName,
    [string]$CookieHeader,
    [int]$Pages = 1,
    [int]$PageSize = 50,
    [ValidateSet("lowest_price", "highest_price", "most_recent", "expires_soon", "lowest_float", "highest_float", "best_deal", "highest_discount", "float_rank", "num_bids")]
    [string]$SortBy = "most_recent",
    [double]$MinFloat,
    [double]$MaxFloat,
    [int]$MinPrice,
    [int]$MaxPrice,
    [string]$Output = "csfloat_export.csv"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RarityName {
    param([object]$Rarity)

    $map = @{
        "1" = "Consumer Grade"
        "2" = "Industrial Grade"
        "3" = "Mil-Spec"
        "4" = "Restricted"
        "5" = "Classified"
        "6" = "Covert"
        "7" = "Contraband"
    }

    if ($null -eq $Rarity) {
        return $null
    }

    $key = [string]$Rarity
    if ($map.ContainsKey($key)) {
        return $map[$key]
    }

    return "Unknown"
}

function Get-ListingsFromBody {
    param([object]$Body)

    if ($Body -is [System.Array]) {
        return ,$Body
    }

    foreach ($propertyName in @("data", "listings", "results")) {
        if ($Body.PSObject.Properties.Name -contains $propertyName) {
            return ,$Body.$propertyName
        }
    }

    return @()
}

function Get-NextCursor {
    param(
        [object]$Body,
        [object]$Headers
    )

    foreach ($propertyName in @("next_cursor", "cursor", "nextCursor")) {
        if ($Body.PSObject.Properties.Name -contains $propertyName) {
            $value = $Body.$propertyName
            if (-not [string]::IsNullOrWhiteSpace([string]$value)) {
                return [string]$value
            }
        }
    }

    foreach ($headerName in @("x-next-cursor", "next-cursor", "cursor")) {
        if ($Headers[$headerName]) {
            return [string]$Headers[$headerName]
        }
    }

    return $null
}

if ($PageSize -lt 1 -or $PageSize -gt 50) {
    throw "PageSize debe estar entre 1 y 50."
}

if ($Pages -lt 1) {
    throw "Pages debe ser mayor o igual a 1."
}

$baseUrl = "https://csfloat.com/api/v1/listings"
$query = [ordered]@{
    limit   = $PageSize
    sort_by = $SortBy
}

if ($MarketHashName) { $query["market_hash_name"] = $MarketHashName }
if ($PSBoundParameters.ContainsKey("MinFloat")) { $query["min_float"] = $MinFloat }
if ($PSBoundParameters.ContainsKey("MaxFloat")) { $query["max_float"] = $MaxFloat }
if ($PSBoundParameters.ContainsKey("MinPrice")) { $query["min_price"] = $MinPrice }
if ($PSBoundParameters.ContainsKey("MaxPrice")) { $query["max_price"] = $MaxPrice }

$cursor = $null
$rows = New-Object System.Collections.Generic.List[object]

for ($page = 1; $page -le $Pages; $page++) {
    $pageQuery = [ordered]@{}
    foreach ($entry in $query.GetEnumerator()) {
        $pageQuery[$entry.Key] = $entry.Value
    }

    if ($cursor) {
        $pageQuery["cursor"] = $cursor
    }

    $queryString = ($pageQuery.GetEnumerator() | ForEach-Object {
        "{0}={1}" -f [System.Uri]::EscapeDataString([string]$_.Key), [System.Uri]::EscapeDataString([string]$_.Value)
    }) -join "&"

    $uri = "{0}?{1}" -f $baseUrl, $queryString
    Write-Host "Consultando pagina $page -> $uri"

    $headers = @{
        "Accept"     = "application/json"
        "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CSFloatExport/1.0"
    }

    if ($CookieHeader) {
        $headers["Cookie"] = $CookieHeader
    }

    $response = Invoke-WebRequest -Uri $uri -Headers $headers

    $body = $response.Content | ConvertFrom-Json
    $listings = Get-ListingsFromBody -Body $body

    if (-not $listings -or $listings.Count -eq 0) {
        Write-Host "No hubo resultados en la pagina $page."
        break
    }

    foreach ($listing in $listings) {
        $item = $listing.item
        $weaponName = if ($item.item_name) { [string]$item.item_name } else { [string]$item.market_hash_name }

        if ($Weapon) {
            if ($weaponName -notlike "*$Weapon*" -and [string]$item.market_hash_name -notlike "*$Weapon*") {
                continue
            }
        }

        $rows.Add([PSCustomObject]@{
            listing_id       = [string]$listing.id
            price_cents      = $listing.price
            price            = if ($null -ne $listing.price) { [math]::Round(([decimal]$listing.price / 100), 2) } else { $null }
            float            = $item.float_value
            rareza           = $item.rarity
            rareza_nombre    = Get-RarityName -Rarity $item.rarity
            arma             = $weaponName
            market_hash_name = $item.market_hash_name
            coleccion        = $item.collection
            fecha            = $listing.created_at
            tipo             = $listing.type
            estado           = $listing.state
        })
    }

    $cursor = Get-NextCursor -Body $body -Headers $response.Headers
    if (-not $cursor) {
        Write-Host "No se encontro cursor para seguir paginando; se detiene en la pagina $page."
        break
    }
}

if ($rows.Count -eq 0) {
    Write-Warning "No se encontraron resultados con los filtros indicados."
    return
}

$outputPath = Join-Path -Path (Get-Location) -ChildPath $Output
$rows | Export-Csv -Path $outputPath -NoTypeInformation -Encoding UTF8

Write-Host ""
Write-Host "Registros exportados: $($rows.Count)"
Write-Host "Archivo: $outputPath"
