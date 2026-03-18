import type { FileMap, ValidationResult } from '@buildn/shared'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

export function runBuildTest(files: FileMap): ValidationResult {
  if (!files['package.json']) {
    return { step: 'build', passed: true }
  }

  const dir = join(tmpdir(), `buildn-build-${randomUUID()}`)
  try {
    mkdirSync(dir, { recursive: true })

    for (const [path, content] of Object.entries(files)) {
      const fullPath = join(dir, path)
      mkdirSync(join(fullPath, '..'), { recursive: true })
      writeFileSync(fullPath, content)
    }

    execSync('npm install --ignore-scripts 2>/dev/null && npx vite build', {
      cwd: dir,
      stdio: 'pipe',
      timeout: 60000,
    })

    return { step: 'build', passed: true }
  } catch (err) {
    const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? String(err)
    return { step: 'build', passed: false, errors: [stderr.slice(0, 1000)] }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
