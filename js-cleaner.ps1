# Script for removing comments and trailing whitespace in JS and CSS files
# Works in current directory and all subdirectories
# Does NOT use regular expressions for comment removal to avoid breaking code

# Directories to ignore (comma-separated list)
$ignoreDirectories = @("node_modules","uploads","autolinker.js")

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "$timestamp [$Level] $Message"
    
    switch ($Level) {
        "ERROR" { Write-Host $logMessage -ForegroundColor Red }
        "WARNING" { Write-Host $logMessage -ForegroundColor Yellow }
        "INFO" { Write-Host $logMessage -ForegroundColor Green }
        "DEBUG" { Write-Host $logMessage -ForegroundColor Gray }
        default { Write-Host $logMessage }
    }
}

Write-Log "=== Processing started ==="

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Log "Working directory: $scriptDir"

# Find all JS and CSS files, excluding ignored directories
$allFiles = Get-ChildItem -Path . -Recurse -Include *.js, *.css | Where-Object { -not $_.PSIsContainer }

# Filter out files in ignored directories
$files = @()
foreach ($file in $allFiles) {
    $skipFile = $false
    
    foreach ($ignoreDir in $ignoreDirectories) {
        if ($file.FullName -like "*\$ignoreDir\*" -or $file.Name -eq $ignoreDir) {
            $skipFile = $true
            break
        }
    }
    
    if (-not $skipFile) {
        $files += $file
    }
}

$totalFiles = $files.Count
$currentFile = 0
$modifiedFiles = 0

Write-Log "Files found for processing: $totalFiles (after filtering)"
Write-Log "Ignored directories: $($ignoreDirectories -join ', ')"

foreach ($file in $files) {
    $currentFile++
    $percentComplete = [math]::Round(($currentFile / $totalFiles) * 100)
    
    # Progress bar
    Write-Progress -Activity "Processing files" `
                   -Status "Processing: $($file.Name)" `
                   -PercentComplete $percentComplete `
                   -CurrentOperation "$currentFile of $totalFiles"
    
    try {
        # Read file content
        $originalContent = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $content = $originalContent
        
        # Save original size
        $originalSize = $content.Length
        $fileModified = $false
        
        # Process based on file type
        if ($file.Extension -eq '.js') {
            # For JS files - NO REGEX approach
            
            # Split by lines (handling both Windows \r\n and Unix \n)
            if ($content.Contains("`r`n")) {
                $lines = $content -split "`r`n"
            } else {
                $lines = $content -split "`n"
            }
            
            $newLines = @()
            
            # State tracking
            $inBlockComment = $false
            $inSingleQuote = $false
            $inDoubleQuote = $false
            $inTemplateLiteral = $false
            $escapeNext = $false
            
            foreach ($line in $lines) {
                $originalLine = $line
                $resultLine = ""
                
                # Reset string states for new line (strings don't continue across lines without \)
                $inSingleQuote = $false
                $inDoubleQuote = $false
                $inTemplateLiteral = $false
                $escapeNext = $false
                
                # Check if line starts with // or /* at the beginning (after whitespace)
                # If not, we should be very careful with comment removal
                $trimmedStart = $line.TrimStart()
                $startsWithComment = $false
                
                if ($trimmedStart.StartsWith("//")) {
                    $startsWithComment = $true
                } elseif ($trimmedStart.StartsWith("/*")) {
                    $startsWithComment = $true
                }
                
                $i = 0
                while ($i -lt $line.Length) {
                    $char = $line[$i]
                    $nextChar = if ($i -lt $line.Length - 1) { $line[$i+1] } else { '' }
                    
                    # Handle escape sequences
                    if ($escapeNext) {
                        $resultLine += $char
                        $escapeNext = $false
                        $i++
                        continue
                    }
                    
                    if ($char -eq '\' -and ($inSingleQuote -or $inDoubleQuote -or $inTemplateLiteral)) {
                        $escapeNext = $true
                        $resultLine += $char
                        $i++
                        continue
                    }
                    
                    # Handle strings
                    if (-not $inBlockComment) {
                        if ($char -eq "'" -and -not $inDoubleQuote -and -not $inTemplateLiteral) {
                            $inSingleQuote = -not $inSingleQuote
                            $resultLine += $char
                            $i++
                            continue
                        }
                        
                        if ($char -eq '"' -and -not $inSingleQuote -and -not $inTemplateLiteral) {
                            $inDoubleQuote = -not $inDoubleQuote
                            $resultLine += $char
                            $i++
                            continue
                        }
                        
                        if ($char -eq '`' -and -not $inSingleQuote -and -not $inDoubleQuote) {
                            $inTemplateLiteral = -not $inTemplateLiteral
                            $resultLine += $char
                            $i++
                            continue
                        }
                    }
                    
                    # Handle comments (only when not in strings)
                    if (-not $inSingleQuote -and -not $inDoubleQuote -and -not $inTemplateLiteral) {
                        # Handle block comments
                        if ($inBlockComment) {
                            # Look for end of block comment */
                            if ($char -eq '*' -and $nextChar -eq '/') {
                                $inBlockComment = $false
                                $i += 2 # Skip */
                                continue
                            }
                            # Still in block comment - skip this character
                            $i++
                            continue
                        }
                        
                        # Check for start of block comment /*
                        if ($char -eq '/' -and $nextChar -eq '*') {
                            # Only remove if line starts with this comment
                            if ($startsWithComment) {
                                $inBlockComment = $true
                                $i += 2 # Skip /*
                                continue
                            } else {
                                # Could be regex or division - leave as is
                                $resultLine += $char
                                $i++
                                continue
                            }
                        }
                        
                        # Check for single line comment //
                        if ($char -eq '/' -and $nextChar -eq '/') {
                            # Only remove if line starts with this comment
                            if ($startsWithComment) {
                                # Single line comment - skip rest of line
                                break
                            } else {
                                # Could be regex or division - leave as is
                                $resultLine += $char
                                $i++
                                continue
                            }
                        }
                    }
                    
                    # If we get here, add the character
                    $resultLine += $char
                    $i++
                }
                
                # Remove trailing whitespace (without regex)
                # Find last non-whitespace character
                $lastNonSpace = -1
                for ($j = 0; $j -lt $resultLine.Length; $j++) {
                    $testChar = $resultLine[$j]
                    if ($testChar -ne ' ' -and $testChar -ne "`t") {
                        $lastNonSpace = $j
                    }
                }
                
                if ($lastNonSpace -ge 0) {
                    $trimmedLine = $resultLine.Substring(0, $lastNonSpace + 1)
                } else {
                    $trimmedLine = ""
                }
                
                $resultLine = $trimmedLine
                
                # Check if line was modified
                if ($resultLine -ne $originalLine) {
                    $fileModified = $true
                }
                
                # Don't add empty lines that were created by removing whole-line comments
                # but keep empty lines that separate code blocks
                if (-not $inBlockComment) {
                    $newLines += $resultLine
                } elseif ($resultLine -ne '') {
                    # If we're in a block comment but line has non-comment content
                    $newLines += $resultLine
                }
            }
            
            # Rebuild content
            $content = $newLines -join "`r`n"
            
            # Remove multiple consecutive blank lines (without regex)
            $cleanedLines = @()
            $blankLineCount = 0
            
            foreach ($line in $newLines) {
                if ($line -eq '') {
                    $blankLineCount++
                    if ($blankLineCount -le 2) {
                        $cleanedLines += $line
                    } else {
                        $fileModified = $true
                    }
                } else {
                    $blankLineCount = 0
                    $cleanedLines += $line
                }
            }
            
            $content = $cleanedLines -join "`r`n"
            
            # Remove leading/trailing blank lines
            $finalLines = @()
            if ($content.Contains("`r`n")) {
                $finalLines = $content -split "`r`n"
            } else {
                $finalLines = $content -split "`n"
            }
            
            # Remove leading blank lines
            while ($finalLines.Count -gt 0 -and $finalLines[0] -eq '') {
                $finalLines = $finalLines[1..($finalLines.Count-1)]
                $fileModified = $true
            }
            
            # Remove trailing blank lines
            while ($finalLines.Count -gt 0 -and $finalLines[$finalLines.Count-1] -eq '') {
                $finalLines = $finalLines[0..($finalLines.Count-2)]
                $fileModified = $true
            }
            
            $content = $finalLines -join "`r`n"
            
        } elseif ($file.Extension -eq '.css') {
            # For CSS files - NO REGEX approach
            
            # Split by lines
            if ($content.Contains("`r`n")) {
                $lines = $content -split "`r`n"
            } else {
                $lines = $content -split "`n"
            }
            
            $newLines = @()
            
            # State tracking for CSS (only block comments)
            $inBlockComment = $false
            
            foreach ($line in $lines) {
                $originalLine = $line
                $resultLine = ""
                
                # Check if line starts with /* at the beginning (after whitespace)
                $trimmedStart = $line.TrimStart()
                $startsWithComment = $trimmedStart.StartsWith("/*")
                
                $i = 0
                while ($i -lt $line.Length) {
                    $char = $line[$i]
                    $nextChar = if ($i -lt $line.Length - 1) { $line[$i+1] } else { '' }
                    
                    # Handle CSS block comments
                    if ($inBlockComment) {
                        # Look for end of block comment */
                        if ($char -eq '*' -and $nextChar -eq '/') {
                            $inBlockComment = $false
                            $i += 2 # Skip */
                            continue
                        }
                        # Still in block comment - skip this character
                        $i++
                        continue
                    }
                    
                    # Check for start of block comment /*
                    if ($char -eq '/' -and $nextChar -eq '*') {
                        # Only remove if line starts with this comment
                        if ($startsWithComment) {
                            $inBlockComment = $true
                            $i += 2 # Skip /*
                            continue
                        } else {
                            # Could be something else - leave as is
                            $resultLine += $char
                            $i++
                            continue
                        }
                    }
                    
                    # If we get here, add the character
                    $resultLine += $char
                    $i++
                }
                
                # Remove trailing whitespace (without regex)
                # Find last non-whitespace character
                $lastNonSpace = -1
                for ($j = 0; $j -lt $resultLine.Length; $j++) {
                    $testChar = $resultLine[$j]
                    if ($testChar -ne ' ' -and $testChar -ne "`t") {
                        $lastNonSpace = $j
                    }
                }
                
                if ($lastNonSpace -ge 0) {
                    $trimmedLine = $resultLine.Substring(0, $lastNonSpace + 1)
                } else {
                    $trimmedLine = ""
                }
                
                $resultLine = $trimmedLine
                
                # Check if line was modified
                if ($resultLine -ne $originalLine) {
                    $fileModified = $true
                }
                
                # Don't add empty lines that were created by removing whole-line comments
                if (-not $inBlockComment) {
                    $newLines += $resultLine
                } elseif ($resultLine -ne '') {
                    # If we're in a block comment but line has non-comment content
                    $newLines += $resultLine
                }
            }
            
            # Rebuild content
            $content = $newLines -join "`r`n"
            
            # Remove multiple consecutive blank lines (without regex)
            $cleanedLines = @()
            $blankLineCount = 0
            
            foreach ($line in $newLines) {
                if ($line -eq '') {
                    $blankLineCount++
                    if ($blankLineCount -le 2) {
                        $cleanedLines += $line
                    } else {
                        $fileModified = $true
                    }
                } else {
                    $blankLineCount = 0
                    $cleanedLines += $line
                }
            }
            
            $content = $cleanedLines -join "`r`n"
            
            # Remove leading/trailing blank lines
            $finalLines = @()
            if ($content.Contains("`r`n")) {
                $finalLines = $content -split "`r`n"
            } else {
                $finalLines = $content -split "`n"
            }
            
            # Remove leading blank lines
            while ($finalLines.Count -gt 0 -and $finalLines[0] -eq '') {
                $finalLines = $finalLines[1..($finalLines.Count-1)]
                $fileModified = $true
            }
            
            # Remove trailing blank lines
            while ($finalLines.Count -gt 0 -and $finalLines[$finalLines.Count-1] -eq '') {
                $finalLines = $finalLines[0..($finalLines.Count-2)]
                $fileModified = $true
            }
            
            $content = $finalLines -join "`r`n"
        }
        
        # Only write if file was modified
        if ($fileModified -and $content -ne $originalContent) {
            # Basic validation without regex
            $isValid = $true
            
            if ($file.Extension -eq '.js') {
                # Check for string balance (very basic check)
                $singleQuoteCount = 0
                $doubleQuoteCount = 0
                
                foreach ($char in $content.ToCharArray()) {
                    if ($char -eq "'") { $singleQuoteCount++ }
                    if ($char -eq '"') { $doubleQuoteCount++ }
                }
                
                # Strings should have even number of quotes (very basic check)
                if ($singleQuoteCount % 2 -ne 0) {
                    Write-Log "Warning: $($file.Name) may have unbalanced single quotes" -Level "WARNING"
                    # Don't skip, just warn
                }
                
                if ($doubleQuoteCount % 2 -ne 0) {
                    Write-Log "Warning: $($file.Name) may have unbalanced double quotes" -Level "WARNING"
                    # Don't skip, just warn
                }
                
                # Check for obvious syntax issues
                $lines = if ($content.Contains("`r`n")) {
                    $content -split "`r`n"
                } else {
                    $content -split "`n"
                }
                
                foreach ($line in $lines) {
                    $trimmedLine = $line.Trim()
                    if ($trimmedLine -eq '+' -or $trimmedLine -eq '/*' -or $trimmedLine -eq '*/') {
                        Write-Log "Warning: $($file.Name) has suspicious line: $trimmedLine" -Level "WARNING"
                        # Don't skip, just warn
                    }
                }
            }
            
            # Write the file
            [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
            
            $newSize = $content.Length
            $saved = $originalSize - $newSize
            $modifiedFiles++
            
            Write-Log "Modified: $($file.Name)" -Level "INFO"
            Write-Log "  Size: $originalSize -> $newSize (saved: $saved chars)" -Level "INFO"
            
            # Show line count change
            $originalLines = if ($originalContent.Contains("`r`n")) {
                $originalContent -split "`r`n"
            } else {
                $originalContent -split "`n"
            }
            
            $newLines = if ($content.Contains("`r`n")) {
                $content -split "`r`n"
            } else {
                $content -split "`n"
            }
            
            if ($originalLines.Count -gt $newLines.Count) {
                $linesRemoved = $originalLines.Count - $newLines.Count
                Write-Log "  Lines removed: $linesRemoved" -Level "INFO"
            }
        }
        
    } catch {
        $errorMsg = "Error processing file '$($file.Name)': $_"
        Write-Log $errorMsg -Level "ERROR"
        Write-Log "  File will be skipped" -Level "WARNING"
    }
}

Write-Progress -Activity "Processing files" -Completed

Write-Log "=== Processing completed ==="
Write-Log "Total files: $totalFiles"
Write-Log "Modified files: $modifiedFiles"
Write-Log "Unchanged files: $($totalFiles - $modifiedFiles)"