export interface Profile {
  id: string
  name: string
  avatar_url: string | null
  plan: 'free' | 'pro' | 'team'
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  description: string
  template: string
  status: 'draft' | 'published'
  deploy_url: string | null
  github_repo: string | null
  created_at: string
  updated_at: string
}

export const PLAN_LIMITS = { free: 5, pro: 50, team: 200 } as const
