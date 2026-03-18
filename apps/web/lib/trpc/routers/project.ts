import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../server'
import { PLAN_LIMITS } from '@buildn/shared'

export const projectRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    return data
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('projects')
        .select('*')
        .eq('id', input.id)
        .single()
      if (error || !data) throw new TRPCError({ code: 'NOT_FOUND' })
      return data
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        template: z.enum(['blank', 'dashboard', 'landing', 'ecommerce']).default('blank'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const plan = ctx.profile.plan as keyof typeof PLAN_LIMITS
      const limit = PLAN_LIMITS[plan] ?? 5

      const { count } = await ctx.supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })

      if ((count ?? 0) >= limit) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Project limit reached (${limit} for ${plan} plan)`,
        })
      }

      const { data, error } = await ctx.supabase
        .from('projects')
        .insert({ user_id: ctx.user.id, name: input.name, template: input.template })
        .select()
        .single()
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input
      const { data, error } = await ctx.supabase
        .from('projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error || !data) throw new TRPCError({ code: 'NOT_FOUND' })
      return data
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.from('projects').delete().eq('id', input.id)
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),
})
