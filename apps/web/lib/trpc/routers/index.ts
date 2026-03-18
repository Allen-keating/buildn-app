import { router } from '../server'
import { projectRouter } from './project'

export const appRouter = router({
  project: projectRouter,
})

export type AppRouter = typeof appRouter
