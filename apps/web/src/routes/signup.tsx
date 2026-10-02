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
import { signupSchema } from '#/lib/schemas/auth'
import { useSignup } from '#/lib/session'
import { requireGuest } from '#/lib/session-guard'

export const Route = createFileRoute('/signup')({
  beforeLoad: requireGuest,
  // The guard renders differently for a visitor who already has a session, so
  // the response is per-visitor and no shared cache may keep a copy of it.
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  errorComponent: SessionVerificationError,
  component: SignupPage,
  head: () => ({ meta: [{ title: 'Create an account — DashNode' }] }),
})

function SignupPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const signup = useSignup()

  const form = useForm({
    defaultValues: { name: '', email: '', password: '' },
    validators: { onSubmit: signupSchema },
    onSubmit: ({ value }) => {
      signup.mutate(value, {
        onSuccess: async () => {
          // Navigating first, then invalidating, is what keeps the two from
          // racing: invalidating here would re-run this route's guest guard with
          // the new session in hand and redirect before the dashboard loaded.
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
            <h1 className="text-xl font-bold">Create your account</h1>
            <FieldDescription>
              Already have an account? <Link to="/login">Log in</Link>
            </FieldDescription>
          </div>

          <form.Field name="name">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    autoComplete="name"
                    placeholder="Ada Lovelace"
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
                    autoComplete="new-password"
                    required
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={isInvalid}
                  />
                  <FieldDescription>
                    Must be at least 8 characters.
                  </FieldDescription>
                  {isInvalid ? (
                    <FieldError errors={field.state.meta.errors} />
                  ) : null}
                </Field>
              )
            }}
          </form.Field>

          {signup.error ? (
            <Alert variant="destructive">
              <AlertDescription>{signup.error.message}</AlertDescription>
            </Alert>
          ) : null}

          <Field>
            <form.Subscribe
              selector={(state) => state.isSubmitting}
              children={(isSubmitting) => {
                const isBusy = isSubmitting || signup.isPending

                return (
                  <Button type="submit" disabled={isBusy}>
                    {isBusy ? <Spinner data-icon="inline-start" /> : null}
                    Create account
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
