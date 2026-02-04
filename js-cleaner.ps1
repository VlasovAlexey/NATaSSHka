# Script for removing comments, trailing whitespace and ALL empty lines in JS and CSS files
# Works in current directory and all subdirectories
# Does NOT use regular expressions to avoid breaking code

# Directories to ignore (comma-separated list)
$ignoreDirectories = @("node_modules","uploads","autolinker.js","backup-rooms.json")

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

# Helper function to check if string contains only whitespace
function Is-StringEmptyOrWhitespace {
    param([string]$String)
    
    if ([string]::IsNullOrEmpty($String)) {
        return $true
    }
    
    # Check each character
    foreach ($char in $String.ToCharArray()) {
        # Check for any non-whitespace character
        if ($char -ne ' ' -and $char -ne "`t" -and $char -ne "`r" -and $char -ne "`n" -and [int][char]$char -ne 65279) {
            return $false
        }
    }
    
    return $true
}

foreach ($file in $files) {
    $currentFile++
    $percentComplete = [math]::Round(($currentFile / $totalFiles) * 100)
    
    # Progress bar
    Write-Progress -Activity "Processing files" `
                   -Status "Processing: $($file.Name)" `
                   -PercentComplete $percentComplete `
                   -CurrentOperation "$currentFile of $totalFiles"
    
    try {
        # Read file content with UTF8 encoding and handle BOM
        $originalContent = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        
        # Remove BOM if present
        if ($originalContent.Length -gt 0 -and [int][char]$originalContent[0] -eq 65279) {
            $originalContent = $originalContent.Substring(1)
        }
        
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
                    if ($testChar -ne ' ' -and $testChar -ne "`t" -and $testChar -ne "`r" -and $testChar -ne "`n" -and [int][char]$testChar -ne 65279) {
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
                
                # Add line only if it's not empty and not in a block comment
                if (-not $inBlockComment) {
                    $newLines += $resultLine
                } elseif ($resultLine -ne '') {
                    # If we're in a block comment but line has non-comment content
                    $newLines += $resultLine
                }
            }
            
            # REMOVE ALL EMPTY AND WHITESPACE-ONLY LINES
            $cleanedLines = @()
            
            foreach ($line in $newLines) {
                # Check if line is empty or contains only whitespace/BOM
                $isEmpty = Is-StringEmptyOrWhitespace -String $line
                
                if (-not $isEmpty) {
                    $cleanedLines += $line
                } else {
                    $fileModified = $true
                }
            }
            
            $content = $cleanedLines -join "`r`n"
            
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
                    if ($testChar -ne ' ' -and $testChar -ne "`t" -and $testChar -ne "`r" -and $testChar -ne "`n" -and [int][char]$testChar -ne 65279) {
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
                
                # Add line only if it's not empty and not in a block comment
                if (-not $inBlockComment) {
                    $newLines += $resultLine
                } elseif ($resultLine -ne '') {
                    # If we're in a block comment but line has non-comment content
                    $newLines += $resultLine
                }
            }
            
            # REMOVE ALL EMPTY AND WHITESPACE-ONLY CSS LINES
            $cleanedLines = @()
            
            foreach ($line in $newLines) {
                # Check if line is empty or contains only whitespace/BOM
                $isEmpty = Is-StringEmptyOrWhitespace -String $line
                
                if (-not $isEmpty) {
                    $cleanedLines += $line
                } else {
                    $fileModified = $true
                }
            }
            
            $content = $cleanedLines -join "`r`n"
        }
        
        # Remove leading/trailing blank lines one more time
        $finalLines = @()
        if ($content.Contains("`r`n")) {
            $finalLines = $content -split "`r`n"
        } else {
            $finalLines = $content -split "`n"
        }
        
        # Remove leading blank lines
        $leadingRemoved = 0
        while ($finalLines.Count -gt 0) {
            $firstLine = $finalLines[0]
            $isEmpty = Is-StringEmptyOrWhitespace -String $firstLine
            if ($isEmpty) {
                $finalLines = $finalLines[1..($finalLines.Count-1)]
                $fileModified = $true
                $leadingRemoved++
            } else {
                break
            }
        }
        
        # Remove trailing blank lines
        $trailingRemoved = 0
        while ($finalLines.Count -gt 0) {
            $lastLine = $finalLines[$finalLines.Count-1]
            $isEmpty = Is-StringEmptyOrWhitespace -String $lastLine
            if ($isEmpty) {
                $finalLines = $finalLines[0..($finalLines.Count-2)]
                $fileModified = $true
                $trailingRemoved++
            } else {
                break
            }
        }
        
        $content = $finalLines -join "`r`n"
        
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
                
                # Simple check for obvious syntax issues
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
            
            # Write the file (without BOM)
            [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
            
            $newSize = $content.Length
            $saved = $originalSize - $newSize
            $modifiedFiles++
            
            # Count removed empty and problematic lines
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
            
            # Count removed lines
            if ($originalLines.Count -gt $newLines.Count) {
                $totalLinesRemoved = $originalLines.Count - $newLines.Count
                
                Write-Log "Modified: $($file.Name)" -Level "INFO"
                Write-Log "  Size: $originalSize -> $newSize (saved: $saved chars)" -Level "INFO"
                Write-Log "  Total lines removed: $totalLinesRemoved" -Level "INFO"
                if ($leadingRemoved -gt 0) {
                    Write-Log "  Leading empty lines removed: $leadingRemoved" -Level "INFO"
                }
                if ($trailingRemoved -gt 0) {
                    Write-Log "  Trailing empty lines removed: $trailingRemoved" -Level "INFO"
                }
            } else {
                Write-Log "Modified: $($file.Name)" -Level "INFO"
                Write-Log "  Size: $originalSize -> $newSize (saved: $saved chars)" -Level "INFO"
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