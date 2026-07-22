$srcDir = "C:\Users\pooji\.gemini\antigravity-ide\scratch\ecoshare"

# JS files in src only
Get-ChildItem "$srcDir\src" -Filter "*.js" | ForEach-Object {
    $content = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
    $updated = $content -replace "EcoShare", "EcoCircle" -replace "ecoshare_", "ecocircle_"
    [System.IO.File]::WriteAllText($_.FullName, $updated, [System.Text.Encoding]::UTF8)
    Write-Host "Updated JS: $($_.Name)"
}

# index.html
$htmlPath = "$srcDir\index.html"
$htmlContent = [System.IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)
$htmlUpdated = $htmlContent -replace "EcoShare", "EcoCircle" -replace "ecoshare", "ecocircle"
[System.IO.File]::WriteAllText($htmlPath, $htmlUpdated, [System.Text.Encoding]::UTF8)
Write-Host "Updated HTML: index.html"

Write-Host "Done! All files renamed to EcoCircle."
