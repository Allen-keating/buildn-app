export interface User {
  id: string
  email: string
  name: string
  plan: 'free' | 'pro' | 'team'
  createdAt: Date
}

export interface Project {
  id: string
  userId: string
  name: string
  description: string
  template: 'blank' | 'dashboard' | 'landing' | 'ecommerce'
  status: 'draft' | 'published'
  deployUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ProjectSummary {
  id: string
  name: string
  description: string
  status: 'draft' | 'published'
  deployUrl: string | null
  updatedAt: Date
}

export interface Snapshot {
  id: string
  projectId: string
  messageId: string | null
  description: string
  files: Record<string, string>
  createdAt: Date
}

export interface SnapshotSummary {
  id: string
  messageId: string
  description: string
  fileCount: number
  createdAt: Date
}
