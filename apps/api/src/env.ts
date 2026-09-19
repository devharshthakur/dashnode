import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error('Invalid environment variables:')
  console.error(z.prettifyError(parsedEnv.error))
  process.exit(1)
}

export const env = parsedEnv.data

export type Env = z.infer<typeof envSchema>
