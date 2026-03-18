import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@buildn/shared', '@buildn/ai-engine'],
}

export default nextConfig
