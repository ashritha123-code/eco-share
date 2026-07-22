$srcDir = "C:\Users\pooji\.gemini\antigravity-ide\scratch\ecoshare"

# Fix capitalized admin email
Get-ChildItem "$srcDir\src" -Filter "*.js" | ForEach-Object {
    $content = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
    $updated = $content -replace "admin@EcoCircle.com", "admin@ecocircle.com"
    [System.IO.File]::WriteAllText($_.FullName, $updated, [System.Text.Encoding]::UTF8)
    Write-Host "Fixed: $($_.Name)"
}
Write-Host "All admin email references fixed."
