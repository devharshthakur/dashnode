import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { CircleAlertIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
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
import { Textarea } from '#/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { ApiError } from '#lib/config/axios'
import { useCreatePost } from '#lib/posts'
import { createPostFormSchema, toCreatePostInput } from '#lib/schemas/post'

import type { CreatePostFormValues } from '#lib/schemas/post'

// Annotated rather than written inline: an untyped default value would widen
// `status` to `string`, which the form's validator then no longer matches.
const EMPTY_POST: CreatePostFormValues = {
  title: '',
  content: '',
  tags: '',
  status: 'draft',
}

export function CreatePostForm() {
  const navigate = useNavigate()
  const createPost = useCreatePost()

  const form = useForm({
    defaultValues: EMPTY_POST,
    validators: { onSubmit: createPostFormSchema },
    onSubmit: ({ value }) => {
      createPost.mutate(toCreatePostInput(value), {
        onSuccess: () => void navigate({ to: '/dashboard' }),
      })
    },
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void form.handleSubmit()
      }}
    >
      <FieldGroup>
        <form.Field name="title">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Title</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  placeholder="Building a REST API with Express"
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

        <form.Field name="content">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Content</FieldLabel>
                <Textarea
                  id={field.name}
                  name={field.name}
                  rows={10}
                  placeholder={'# Hello\n\nWrite in Markdown.'}
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

        <form.Field name="tags">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Tags</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  placeholder="node, express, mongodb"
                  required
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={isInvalid}
                />
                <FieldDescription>Separate them with commas.</FieldDescription>
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
            )
          }}
        </form.Field>

        <form.Field name="status">
          {(field) => (
            <Field>
              <FieldLabel>Visibility</FieldLabel>
              <ToggleGroup
                value={[field.state.value]}
                onValueChange={([next]) => {
                  // The group holds only these two, so the narrowing
                  // is a formality rather than a filter.
                  if (next === 'draft' || next === 'published') {
                    field.handleChange(next)
                  }
                }}
              >
                <ToggleGroupItem value="draft">Draft</ToggleGroupItem>
                <ToggleGroupItem value="published">Publish</ToggleGroupItem>
              </ToggleGroup>
            </Field>
          )}
        </form.Field>

        {createPost.isError ? (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>The post was not saved</AlertTitle>
            <AlertDescription>
              {createPost.error instanceof ApiError
                ? createPost.error.message
                : 'The API could not be reached. Please try again.'}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => void navigate({ to: '/dashboard' })}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createPost.isPending}>
            {createPost.isPending ? <Spinner data-icon="inline-start" /> : null}
            Save post
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
