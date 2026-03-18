export type SandboxStatus = 'idle' | 'booting' | 'installing' | 'running' | 'building' | 'error'

export interface InstallResult {
  success: boolean
  duration: number
  installedPackages?: string[]
  errors?: string[]
}

export interface BuildResult {
  success: boolean
  outputFiles: string[]
  errors?: string[]
  warnings?: string[]
}

export interface SandboxError {
  code: 'BOOT_FAILED' | 'INSTALL_FAILED' | 'SERVER_CRASH' | 'BUILD_FAILED' | 'FS_ERROR'
  message: string
  details?: string
}
