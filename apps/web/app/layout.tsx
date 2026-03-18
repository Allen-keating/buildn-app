import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { TRPCProvider } from '@/lib/trpc/provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '造 Buildn',
  description: 'AI-powered web application builder',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-neutral-950 text-white antialiased`}>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  )
}
