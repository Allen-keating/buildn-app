import type { FileMap, ValidationResult } from '@buildn/shared'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

export function runTypeCheck(files: FileMap): ValidationResult {
  const dir = join(tmpdir(), `buildn-tc-${randomUUID()}`)
  try {
    mkdirSync(dir, { recursive: true })

    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ['**/*.ts', '**/*.tsx'],
      }),
    )

    for (const [path, content] of Object.entries(files)) {
      const fullPath = join(dir, path)
      mkdirSync(join(fullPath, '..'), { recursive: true })
      writeFileSync(fullPath, content)
    }

    execSync('npx tsc --noEmit', { cwd: dir, stdio: 'pipe', timeout: 30000 })
    return { step: 'typecheck', passed: true }
  } catch (err) {
    const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? String(err)
    const errors = stderr.split('\n').filter((l) => l.includes('error TS'))
    return { step: 'typecheck', passed: false, errors }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
