$ErrorActionPreference = 'Stop'
$evidence = Split-Path -Parent $MyInvocation.MyCommand.Path
$base = 'http://127.0.0.1:3000'
Add-Type -AssemblyName System.Net.Http
$client = [System.Net.Http.HttpClient]::new()

function Invoke-ApiCase {
  param([Parameter(Mandatory)]$Case)
  $uri = $base + $Case.Path
  $requestJson = $null
  $status = $null
  $content = ''
  try {
    if ($Case.Raw) {
      $requestJson = [string]$Case.Body
    } elseif ($null -eq $Case.Body) {
    } else {
      $requestJson = $Case.Body | ConvertTo-Json -Depth 20 -Compress
    }
    $request = [System.Net.Http.HttpRequestMessage]::new(
      [System.Net.Http.HttpMethod]::new($Case.Method),
      $uri
    )
    if ($null -ne $requestJson) {
      $request.Content = [System.Net.Http.StringContent]::new(
        $requestJson,
        [Text.Encoding]::UTF8,
        'application/json'
      )
    }
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    $status = [int]$response.StatusCode
    $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $response.Dispose()
    $request.Dispose()
  } catch {
    $content = $_.Exception.Message
  }

  $parsed = $null
  try { $parsed = $content | ConvertFrom-Json } catch {}
  $pass = ($status -eq [int]$Case.ExpectedStatus)
  if ($null -ne $Case.ExpectedCode) {
    $pass = $pass -and ($null -ne $parsed) -and ($parsed.error.code -eq $Case.ExpectedCode)
  }
  if ($null -ne $Case.ExpectedAuth) {
    $pass = $pass -and ($null -ne $parsed) -and ($parsed.authenticated -eq [bool]$Case.ExpectedAuth)
  }
  if ($null -ne $Case.ExpectedPayloadVariant) {
    $pass = $pass -and ($null -ne $parsed) -and ($parsed.payloadVariant -eq $Case.ExpectedPayloadVariant)
  }
  if ($null -ne $Case.ExpectedEnabled) {
    $pass = $pass -and ($null -ne $parsed) -and ($parsed.enabled -eq [bool]$Case.ExpectedEnabled)
  }

  [ordered]@{
    name = $Case.Name
    method = $Case.Method
    path = $Case.Path
    request = if ($null -eq $requestJson) { $null } else { try { $requestJson | ConvertFrom-Json } catch { $requestJson } }
    expected = [ordered]@{
      status = [int]$Case.ExpectedStatus
      code = $Case.ExpectedCode
      authenticated = $Case.ExpectedAuth
      payloadVariant = $Case.ExpectedPayloadVariant
      enabled = $Case.ExpectedEnabled
    }
    observed = [ordered]@{
      status = $status
      body = $parsed
      raw = $content
    }
    pass = [bool]$pass
  }
}

function Case {
  param($Name, $Path, $Method, $Body, $ExpectedStatus, $ExpectedCode = $null, $ExpectedAuth = $null, $ExpectedPayloadVariant = $null, $ExpectedEnabled = $null, $Raw = $false)
  [pscustomobject]@{
    Name = $Name
    Path = $Path
    Method = $Method
    Body = $Body
    ExpectedStatus = $ExpectedStatus
    ExpectedCode = $ExpectedCode
    ExpectedAuth = $ExpectedAuth
    ExpectedPayloadVariant = $ExpectedPayloadVariant
    ExpectedEnabled = $ExpectedEnabled
    Raw = $Raw
  }
}

$login = '/api/auth/login'
$labLogin = '/api/lab/login-observation'
$secureCases = @(
  (Case 'secure correct scalar' $login 'POST' ([ordered]@{username='alice';password='synthetic-demo-password'}) 200),
  (Case 'secure wrong scalar' $login 'POST' ([ordered]@{username='alice';password='wrong-password'}) 401 'INVALID_CREDENTIALS'),
  (Case 'secure unknown username' $login 'POST' ([ordered]@{username='unknown-user';password='synthetic-demo-password'}) 401 'INVALID_CREDENTIALS'),
  (Case 'secure empty username' $login 'POST' ([ordered]@{username='';password='synthetic-demo-password'}) 400 'INVALID_INPUT'),
  (Case 'secure overlong username' $login 'POST' ([ordered]@{username=('a' * 81);password='synthetic-demo-password'}) 400 'INVALID_INPUT'),
  (Case 'secure empty password' $login 'POST' ([ordered]@{username='alice';password=''}) 400 'INVALID_INPUT'),
  (Case 'secure overlong password' $login 'POST' ([ordered]@{username='alice';password=('p' * 201)}) 400 'INVALID_INPUT'),
  (Case 'secure missing username' $login 'POST' ([ordered]@{password='synthetic-demo-password'}) 400 'INVALID_INPUT'),
  (Case 'secure missing password' $login 'POST' ([ordered]@{username='alice'}) 400 'INVALID_INPUT'),
  (Case 'secure rejects gt operator' $login 'POST' ([ordered]@{username='alice';password=[ordered]@{'$gt'=''}}) 400 'INVALID_INPUT'),
  (Case 'secure rejects gte operator' $login 'POST' ([ordered]@{username='alice';password=[ordered]@{'$gte'=''}}) 400 'INVALID_INPUT'),
  (Case 'secure rejects ne operator' $login 'POST' ([ordered]@{username='alice';password=[ordered]@{'$ne'='not-the-password'}}) 400 'INVALID_INPUT'),
  (Case 'secure rejects regex operator' $login 'POST' ([ordered]@{username='alice';password=[ordered]@{'$regex'='.*'}}) 400 'INVALID_INPUT'),
  (Case 'secure rejects nin operator' $login 'POST' ([ordered]@{username='alice';password=[ordered]@{'$nin'=@('not-the-password')}}) 400 'INVALID_INPUT'),
  (Case 'secure rejects exists operator' $login 'POST' ([ordered]@{username='alice';password=[ordered]@{'$exists'=$true}}) 400 'INVALID_INPUT'),
  (Case 'secure rejects password array' $login 'POST' ([ordered]@{username='alice';password=@('x')}) 400 'INVALID_INPUT'),
  (Case 'secure rejects password boolean' $login 'POST' ([ordered]@{username='alice';password=$true}) 400 'INVALID_INPUT'),
  (Case 'secure rejects password null' $login 'POST' ([ordered]@{username='alice';password=$null}) 400 'INVALID_INPUT'),
  (Case 'secure rejects top-level array' $login 'POST' '[{"username":"alice","password":"synthetic-demo-password"}]' 400 'INVALID_INPUT' $null $null $null $true),
  (Case 'secure rejects top-level null' $login 'POST' 'null' 400 'INVALID_JSON' $null $null $null $true),
  (Case 'secure rejects top-level string' $login 'POST' '"not-an-object"' 400 'INVALID_JSON' $null $null $null $true),
  (Case 'secure rejects unknown body field' $login 'POST' ([ordered]@{username='alice';password='synthetic-demo-password';remember=$true}) 400 'INVALID_INPUT'),
  (Case 'secure rejects empty object' $login 'POST' ([ordered]@{}) 400 'INVALID_INPUT'),
  (Case 'secure rejects malformed JSON' $login 'POST' '{"username":"alice","password":' 400 'INVALID_JSON' $null $null $null $true),
  (Case 'secure GET rejected' $login 'GET' $null 404 'NOT_FOUND'),
  (Case 'secure unknown route' '/api/auth/not-a-route' 'POST' ([ordered]@{username='alice';password='synthetic-demo-password'}) 404 'NOT_FOUND'),
  (Case 'logout endpoint' '/api/auth/logout' 'POST' ([ordered]@{}) 200),
  (Case 'unknown root route' '/not-a-route' 'GET' $null 404 'NOT_FOUND')
)

$labCases = @(
  (Case 'lab status enabled' '/api/lab/status' 'GET' $null 200 $null $null $null $true),
  (Case 'lab gt success' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$gt'=''}}) 200 $null $true '$gt'),
  (Case 'lab gte success' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$gte'=''}}) 200 $null $true '$gte'),
  (Case 'lab ne success' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$ne'='not-the-password'}}) 200 $null $true '$ne'),
  (Case 'lab regex success' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$regex'='.*'}}) 200 $null $true '$regex'),
  (Case 'lab nin success' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$nin'=@('not-the-password')}}) 200 $null $true '$nin'),
  (Case 'lab exists success' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$exists'=$true}}) 200 $null $true '$exists'),
  (Case 'lab correct scalar' $labLogin 'POST' ([ordered]@{username='alice';password='lab-only-demo-password'}) 200 $null $true 'string'),
  (Case 'lab wrong scalar' $labLogin 'POST' ([ordered]@{username='alice';password='wrong-password'}) 401 'INVALID_CREDENTIALS' $null 'string'),
  (Case 'lab gt no match' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$gt'='zzzz'}}) 401 'INVALID_CREDENTIALS' $null '$gt'),
  (Case 'lab gte no match' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$gte'='zzzz'}}) 401 'INVALID_CREDENTIALS' $null '$gte'),
  (Case 'lab ne no match' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$ne'='lab-only-demo-password'}}) 401 'INVALID_CREDENTIALS' $null '$ne'),
  (Case 'lab regex no match' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$regex'='^no-match$'}}) 401 'INVALID_CREDENTIALS' $null '$regex'),
  (Case 'lab nin no match' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$nin'=@('lab-only-demo-password')}}) 401 'INVALID_CREDENTIALS' $null '$nin'),
  (Case 'lab exists false no match' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$exists'=$false}}) 401 'INVALID_CREDENTIALS' $null '$exists'),
  (Case 'lab rejects where operator' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$where'='this.password'}}) 400 'INVALID_INPUT'),
  (Case 'lab rejects multiple operators' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$gt'='';'$ne'='x'}}) 400 'INVALID_INPUT'),
  (Case 'lab rejects numeric gt' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$gt'=1}}) 400 'INVALID_INPUT'),
  (Case 'lab rejects array gt' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$gt'=@('')}}) 400 'INVALID_INPUT'),
  (Case 'lab rejects nonboolean exists' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$exists'='true'}}) 400 'INVALID_INPUT'),
  (Case 'lab rejects empty nin' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$nin'=@()}}) 400 'INVALID_INPUT'),
  (Case 'lab rejects oversized nin' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$nin'=@('1','2','3','4','5','6')}}) 400 'INVALID_INPUT'),
  (Case 'lab rejects unknown object key' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{foo='bar'}}) 400 'INVALID_INPUT'),
  (Case 'lab rejects password array' $labLogin 'POST' ([ordered]@{username='alice';password=@('x')}) 400 'INVALID_INPUT'),
  (Case 'lab rejects null password' $labLogin 'POST' ([ordered]@{username='alice';password=$null}) 400 'INVALID_INPUT'),
  (Case 'lab rejects missing username' $labLogin 'POST' ([ordered]@{password=[ordered]@{'$gt'=''}}) 400 'INVALID_INPUT'),
  (Case 'lab rejects extra field' $labLogin 'POST' ([ordered]@{username='alice';password=[ordered]@{'$gt'=''};extra='x'}) 400 'INVALID_INPUT'),
  (Case 'lab rejects malformed JSON' $labLogin 'POST' '{"username":"alice","password":{"$gt":""}' 400 'INVALID_JSON' $null $null $null $true),
  (Case 'lab rejects top-level array' $labLogin 'POST' '[{"username":"alice","password":{"$gt":""}}]' 400 'INVALID_INPUT' $null $null $null $true),
  (Case 'lab GET rejected' $labLogin 'GET' $null 404 'NOT_FOUND'),
  (Case 'lab unknown route' '/api/lab/no-route' 'POST' ([ordered]@{username='alice';password=[ordered]@{'$gt'=''}}) 404 'NOT_FOUND'),
  (Case 'lab upper-case username normalized' $labLogin 'POST' ([ordered]@{username='ALICE';password=[ordered]@{'$gt'=''}}) 200 $null $true '$gt')
)

$secureResults = @($secureCases | ForEach-Object { Invoke-ApiCase $_ })
$labResults = @($labCases | ForEach-Object { Invoke-ApiCase $_ })
$secureSummary = [ordered]@{generatedAt=(Get-Date).ToString('o'); baseUrl=$base; mode='secure'; total=$secureResults.Count; passed=@($secureResults | Where-Object pass).Count; failed=@($secureResults | Where-Object { -not $_.pass }).Count; cases=$secureResults}
$labSummary = [ordered]@{generatedAt=(Get-Date).ToString('o'); baseUrl=$base; mode='lab'; total=$labResults.Count; passed=@($labResults | Where-Object pass).Count; failed=@($labResults | Where-Object { -not $_.pass }).Count; cases=$labResults}
$secureSummary | ConvertTo-Json -Depth 30 | Set-Content -Path (Join-Path $evidence '05-api-secure.json') -Encoding utf8
$labSummary | ConvertTo-Json -Depth 30 | Set-Content -Path (Join-Path $evidence '06-api-lab.json') -Encoding utf8
[ordered]@{
  secure = [ordered]@{total=$secureSummary.total;passed=$secureSummary.passed;failed=$secureSummary.failed}
  lab = [ordered]@{total=$labSummary.total;passed=$labSummary.passed;failed=$labSummary.failed}
} | ConvertTo-Json -Compress
