import type { ValidationResult } from '@buildn/shared'

export function runLintCheck(fileContent: string, filePath: string): ValidationResult {
  const errors: string[] = []

  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    if (fileContent.includes('console.log') && !filePath.includes('test')) {
      errors.push(`${filePath}: console.log found (consider removing)`)
    }
  }

  return { step: 'lint', passed: true, errors: errors.length > 0 ? errors : undefined }
}
