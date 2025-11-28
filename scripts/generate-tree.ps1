# scripts/generate-tree.ps1
# Genere l'arborescence du projet dans docs/project-structure.md

$projectRoot = Get-Location
$outputFile = Join-Path $projectRoot "docs/project-structure.md"

# Creer le dossier docs s'il n'existe pas
$docsDir = Join-Path $projectRoot "docs"
if (-not (Test-Path $docsDir)) {
    New-Item -ItemType Directory -Path $docsDir | Out-Null
}

# Dossiers a exclure
$excludeDirs = @(
    'node_modules',
    '.next',
    '.git',
    '.vercel',
    'coverage',
    '.turbo'
)

function Get-Tree {
    param (
        [string]$Path,
        [string]$Prefix = "",
        [int]$MaxDepth = 5,
        [int]$CurrentDepth = 0
    )
    
    if ($CurrentDepth -ge $MaxDepth) {
        return @()
    }
    
    $items = Get-ChildItem -Path $Path -Force | Where-Object {
        if ($_.PSIsContainer) {
            return -not ($_.Name.StartsWith('.') -and $_.Name -ne '.vscode') -and 
                   -not ($excludeDirs -contains $_.Name)
        }
        return -not ($_.Name -match '^\.') -or $_.Name -eq '.env.local' -or $_.Name -eq '.gitignore'
    } | Sort-Object { -not $_.PSIsContainer }, Name
    
    $output = @()
    $count = $items.Count
    $index = 0
    
    foreach ($item in $items) {
        $index++
        $isLast = ($index -eq $count)
        
        if ($isLast) {
            $connector = "+-- "
            $newPrefix = "$Prefix    "
        } else {
            $connector = "|-- "
            $newPrefix = "$Prefix|   "
        }
        
        $line = "$Prefix$connector$($item.Name)"
        
        if ($item.PSIsContainer) {
            $line += "/"
            $output += $line
            $output += Get-Tree -Path $item.FullName -Prefix $newPrefix -MaxDepth $MaxDepth -CurrentDepth ($CurrentDepth + 1)
        } else {
            $output += $line
        }
    }
    
    return $output
}

# Generer le contenu
$date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$projectName = Split-Path $projectRoot -Leaf

$header = @"
# Structure du projet - $projectName

*Genere le $date*
``````
$projectName/
"@

$tree = Get-Tree -Path $projectRoot -MaxDepth 5
$treeContent = $tree -join "`n"

$footer = @"
``````

## Fichiers cles

| Fichier | Description |
|---------|-------------|
| app/layout.tsx | Layout racine avec ThemeProvider |
| app/(auth)/ | Pages authentification |
| app/(dashboard)/ | Pages du dashboard |
| middleware.ts | Protection des routes |
| lib/infrastructure/ | Clients Supabase, Zoho |
| components/ | Composants React |
| types/ | Types TypeScript |

---

*Genere automatiquement par scripts/generate-tree.ps1*
"@

$content = $header + "`n" + $treeContent + "`n" + $footer

# Ecrire le fichier
$content | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "Arborescence generee dans: $outputFile" -ForegroundColor Green
