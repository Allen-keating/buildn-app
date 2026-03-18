import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@buildn/shared', '@buildn/ai-engine', '@buildn/sandbox'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
