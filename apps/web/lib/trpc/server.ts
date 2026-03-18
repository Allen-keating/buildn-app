import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { createClient } from '@/lib/supabase/server'

export const createTRPCContext = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

const t = initTRPC
  .context<Awaited<ReturnType<typeof createTRPCContext>>>()
  .create({ transformer: superjson })

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('*')
    .eq('id', ctx.user.id)
    .single()

  if (!profile) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Profile not found' })
  }

  return next({ ctx: { ...ctx, user: ctx.user, profile } })
})
