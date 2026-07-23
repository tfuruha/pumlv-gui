<#
.SYNOPSIS
    pumlv-gui のリリース用パッケージ (ZIP) を作成するスクリプト

.DESCRIPTION
    Wails アプリをビルドし、実行バイナリと MANUAL.md を集めて dist/ ディレクトリに ZIP アーカイブを出力します。

.PARAMETER Platform
    Wails のビルドターゲットプラットフォーム (デフォルト: windows/amd64)

.EXAMPLE
    .\build-release.ps1
    .\build-release.ps1 -Platform windows/amd64
#>
[CmdletBinding()]
param (
    [string]$Platform = "windows/amd64"
)

$ErrorActionPreference = "Stop"

# リポジトリルートパスの取得
$RootDir = $PSScriptRoot
if (-not $RootDir) {
    $RootDir = Get-Location
}

$DistDir = Join-Path $RootDir "dist"
$BuildBinDir = Join-Path $RootDir "build\bin"
$ManualFile = Join-Path $RootDir "MANUAL.md"

# プラットフォーム文字列から識別用サフィックスへのマッピング
$PlatformSuffix = switch ($Platform) {
    "windows/amd64" { "win-x64" }
    "windows/arm64" { "win-arm64" }
    "darwin/amd64"  { "mac-x64" }
    "darwin/arm64"  { "mac-arm64" }
    "linux/amd64"   { "linux-x64" }
    default         { $Platform.Replace("/", "-") }
}

$ZipName = "pumlv-gui-${PlatformSuffix}.zip"
$ZipPath = Join-Path $DistDir $ZipName

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Building pumlv-gui for $Platform" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. wails build の実行
wails build -platform $Platform
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
    Write-Error "Wails build failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

# 実行ファイル名の特定 (Windows 以外は拡張子なし)
$ExeName = "pumlv-gui.exe"
if ($Platform -notlike "windows*") {
    $ExeName = "pumlv-gui"
}

# build/bin 内から対象バイナリを探索
$TargetBinary = Get-ChildItem -Path $BuildBinDir -File | Where-Object { $_.Name -eq $ExeName -or $_.Name -eq "pumlv-gui" } | Select-Object -First 1

if (-not $TargetBinary) {
    Write-Error "Built binary ($ExeName) not found in $BuildBinDir"
    exit 1
}

if (-not (Test-Path $ManualFile)) {
    Write-Error "MANUAL.md not found at $ManualFile"
    exit 1
}

# 2. dist ディレクトリおよび一時ステージングフォルダの準備
if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir | Out-Null
}

$StagingDir = Join-Path $DistDir "staging_${PlatformSuffix}"
if (Test-Path $StagingDir) {
    Remove-Item -Path $StagingDir -Recurse -Force
}
New-Item -ItemType Directory -Path $StagingDir | Out-Null

try {
    # 3. バイナリと MANUAL.md をステージングフォルダに収集
    Write-Host "Collecting release artifacts to $StagingDir ..." -ForegroundColor Yellow
    Copy-Item -Path $TargetBinary.FullName -Destination (Join-Path $StagingDir $TargetBinary.Name)
    Copy-Item -Path $ManualFile -Destination (Join-Path $StagingDir "MANUAL.md")

    # 既存の同名 ZIP があれば削除
    if (Test-Path $ZipPath) {
        Remove-Item -Path $ZipPath -Force
    }

    # 4. ZIP アーカイブ作成 (.NET ZipFile)
    Write-Host "Creating zip archive: $ZipPath" -ForegroundColor Green
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($StagingDir, $ZipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)

    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host " Release package created successfully!" -ForegroundColor Cyan
    Write-Host " Output: $ZipPath" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
}
finally {
    # 一時フォルダのクリーンアップ
    if (Test-Path $StagingDir) {
        Remove-Item -Path $StagingDir -Recurse -Force
    }
}
