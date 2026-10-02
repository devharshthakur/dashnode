import { useForm } from '@tanstack/react-form'
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { FeatherIcon } from 'lucide-react'

import { SessionVerificationError } from '#/components/session-error'
import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { authGaurd } from '#/lib/auth-gaurd'
import { loginSchema } from '#/lib/schemas/auth'
import { useLogin } from '#/lib/session'

export const Route = createFileRoute('/login')({
  beforeLoad: () => authGaurd('guest'),
  // The guard renders differently per visitor, so no shared cache may keep it.
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  errorComponent: SessionVerificationError,
  component: LoginPage,
  head: () => ({ meta: [{ title: 'Log in — DashNode' }] }),
})

function LoginPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const login = useLogin()

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onSubmit: loginSchema },
    onSubmit: ({ value }) => {
      login.mutate(value, {
        onSuccess: async () => {
          // Navigate before invalidating: invalidating first would re-run this
          // guest guard with the new session and redirect too early.
          await navigate({ to: '/dashboard' })
          await router.invalidate()
        },
      })
    },
  })

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <Link
              to="/"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex size-8 items-center justify-center rounded-md">
                <FeatherIcon className="size-6" />
              </div>
              <span className="sr-only">DashNode</span>
            </Link>
            <h1 className="text-xl font-bold">Welcome back</h1>
            <FieldDescription>
              Don&apos;t have an account? <Link to="/signup">Sign up</Link>
            </FieldDescription>
          </div>

          <form.Field name="email">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    autoComplete="email"
                    placeholder="m@example.com"
                    required
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={isInvalid}
                  />
                  {isInvalid ? (
                    <FieldError errors={field.state.meta.errors} />
                  ) : null}
                </Field>
              )
            }}
          </form.Field>

          <form.Field name="password">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    autoComplete="current-password"
                    required
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={isInvalid}
                  />
                  {isInvalid ? (
                    <FieldError errors={field.state.meta.errors} />
                  ) : null}
                </Field>
              )
            }}
          </form.Field>

          {login.error ? (
            <Alert variant="destructive">
              <AlertDescription>{login.error.message}</AlertDescription>
            </Alert>
          ) : null}

          <Field>
            <form.Subscribe
              selector={(state) => state.isSubmitting}
              children={(isSubmitting) => {
                const isBusy = isSubmitting || login.isPending

                return (
                  <Button type="submit" disabled={isBusy}>
                    {isBusy ? <Spinner data-icon="inline-start" /> : null}
                    Log in
                  </Button>
                )
              }}
            />
          </Field>
        </FieldGroup>
      </form>
    </main>
  )
}
