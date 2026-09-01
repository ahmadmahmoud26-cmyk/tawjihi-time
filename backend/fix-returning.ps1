param([string]$file)

$content = Get-Content $file -Raw

# Remove RETURNING clauses from INSERT statements
# Pattern: INSERT ... VALUES (...) RETURNING ...
$content = $content -replace '\n\s*RETURNING\s+[^`]*?(?=`)', '`'

# Remove RETURNING clauses from UPDATE statements  
# Pattern: UPDATE ... SET ... WHERE ... RETURNING ...
$content = $content -replace ',\s*RETURNING\s+[^`]*?`', '`'

# Handle NOW() function
$content = $content -replace 'NOW\(\)', "datetime('now')"

# Handle NOW() + INTERVAL patterns
$content = $content -replace "NOW\(\)\s*\+\s*INTERVAL\s+'(\d+)\s+(\w+)'", "datetime('now', '+`$1 `$2')"

# Handle CONCAT function (PostgreSQL)
# SQLite uses || for string concatenation
$content = $content -replace 'CONCAT\((.*?)\)', '($1)'

# Remove ::int casting  
$content = $content -replace '::int', ''
$content = $content -replace '::\w+', ''

Set-Content $file $content
Write-Host "Fixed RETURNING clauses in $file"
