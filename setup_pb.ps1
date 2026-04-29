# PocketBase 0.36 集合创建脚本
$PB_URL = "http://127.0.0.1:8090"

# 获取管理员 token
$AUTH = curl.exe -s -X POST "$PB_URL/api/collections/_superusers/auth-with-password" -H "Content-Type: application/json" -d "@f:\web-test-codex\新建文件夹\auth.json" | ConvertFrom-Json
$TOKEN = $AUTH.token
Write-Output "Token obtained: $($TOKEN.Substring(0, 20))..."

# 集合定义
$SCHEMAS = @(
  @{
    name = "members"
    type = "base"
    schema = @(
      @{ name = "name"; type = "text"; required = $true }
      @{ name = "avatar"; type = "file"; maxSize = 5242880; maxSelect = 1; mimeTypes = @("image/jpeg", "image/png", "image/webp") }
      @{ name = "bio"; type = "text" }
      @{ name = "role"; type = "text" }
    )
    listRule = $null
    viewRule = $null
    createRule = $null
    updateRule = $null
    deleteRule = $null
  }
  @{
    name = "photos"
    type = "base"
    schema = @(
      @{ name = "title"; type = "text"; required = $true }
      @{ name = "image"; type = "file"; maxSize = 10485760; maxSelect = 1; mimeTypes = @("image/jpeg", "image/png", "image/webp") }
      @{ name = "description"; type = "text" }
      @{ name = "source_url"; type = "url" }
    )
    listRule = $null; viewRule = $null; createRule = $null; updateRule = $null; deleteRule = $null
  }
  @{
    name = "activities"
    type = "base"
    schema = @(
      @{ name = "tag"; type = "text" }
      @{ name = "title"; type = "text"; required = $true }
      @{ name = "content"; type = "text" }
      @{ name = "image"; type = "file"; maxSize = 10485760; maxSelect = 1; mimeTypes = @("image/jpeg", "image/png", "image/webp") }
      @{ name = "source_url"; type = "url" }
    )
    listRule = $null; viewRule = $null; createRule = $null; updateRule = $null; deleteRule = $null
  }
  @{
    name = "messages"
    type = "base"
    schema = @(
      @{ name = "name"; type = "text"; required = $true }
      @{ name = "content"; type = "text"; required = $true }
    )
    listRule = $null; viewRule = $null; createRule = $null; updateRule = $null; deleteRule = $null
  }
  @{
    name = "news"
    type = "base"
    schema = @(
      @{ name = "title"; type = "text"; required = $true }
      @{ name = "date"; type = "text" }
      @{ name = "content"; type = "text" }
    )
    listRule = $null; viewRule = $null; createRule = $null; updateRule = $null; deleteRule = $null
  }
  @{
    name = "memories"
    type = "base"
    schema = @(
      @{ name = "name"; type = "text" }
      @{ name = "content"; type = "text"; required = $true }
    )
    listRule = $null; viewRule = $null; createRule = $null; updateRule = $null; deleteRule = $null
  }
  @{
    name = "history"
    type = "base"
    schema = @(
      @{ name = "date"; type = "text" }
      @{ name = "title"; type = "text"; required = $true }
      @{ name = "content"; type = "text" }
    )
    listRule = $null; viewRule = $null; createRule = $null; updateRule = $null; deleteRule = $null
  }
)

# 逐个创建集合
$TEMP_FILE = "$env:TEMP\pb_create.json"
foreach ($col in $SCHEMAS) {
  Write-Output "Creating collection: $($col.name)..."
  $col | ConvertTo-Json -Depth 10 -Compress | Out-File -FilePath $TEMP_FILE -Encoding utf8
  $RESULT = curl.exe -s -X POST "$PB_URL/api/collections" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "@$TEMP_FILE"
  if ($RESULT -match '"id"') {
    $id = ($RESULT | ConvertFrom-Json).id
    Write-Output "  OK - id: $id"
  } else {
    Write-Output "  FAILED: $RESULT"
  }
  Remove-Item $TEMP_FILE -Force -ErrorAction SilentlyContinue
}

Write-Output "`nAll collections created!"
