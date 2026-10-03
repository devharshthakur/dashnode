import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { CircleAlertIcon, PenLineIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
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
import { ApiError } from '#/lib/config/axios'
import { useCreatePost } from '#/lib/posts'
import { createPostFormSchema, toCreatePostInput } from '#/lib/schemas/post'

import type { CreatePostFormValues } from '#/lib/schemas/post'

// Annotated rather than written inline: an untyped default value would widen
// `status` to `string`, which the form's validator then no longer matches.
const EMPTY_POST: CreatePostFormValues = {
  title: '',
  content: '',
  tags: '',
  status: 'draft',
}

/**
 * The right rail's way into writing: one button, and the composer it opens.
 * Kept here rather than on its own route because a draft belongs next to the
 * feed it will join — the dashboard is where a writer already is.
 */
export function CreatePostCard() {
  const createPost = useCreatePost()
  const [open, setOpen] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)

  const form = useForm({
    defaultValues: EMPTY_POST,
    validators: { onSubmit: createPostFormSchema },
    onSubmit: ({ value }) => {
      createPost.mutate(toCreatePostInput(value), {
        onSuccess: ({ post }) => {
          setOpen(false)
          setNotice(
            post.status === 'published'
              ? `“${post.title}” is now in the feed.`
              : `“${post.title}” was saved as a draft.`,
          )
        },
      })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Write something</CardTitle>
        <CardDescription>
          Keep a post as a draft, or publish it straight to the feed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {notice === null ? null : (
            <Alert>
              <CircleAlertIcon />
              <AlertTitle>Saved</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            {/*
             * The composer is emptied when it opens, not when it closes. A
             * successful save closes it from here rather than through Base UI,
             * so a close handler would never run for that case and the next
             * open would still be holding the post just saved.
             */}
            <Button
              onClick={() => {
                form.reset()
                createPost.reset()
                setNotice(null)
                setOpen(true)
              }}
            >
              <PenLineIcon data-icon="inline-start" />
              Create post
            </Button>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create a post</DialogTitle>
                <DialogDescription>
                  Markdown is stored exactly as you write it and rendered by the
                  client.
                </DialogDescription>
              </DialogHeader>
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
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
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
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
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
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            aria-invalid={isInvalid}
                          />
                          <FieldDescription>
                            Separate them with commas.
                          </FieldDescription>
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
                          <ToggleGroupItem value="published">
                            Publish
                          </ToggleGroupItem>
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

                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>
                      Cancel
                    </DialogClose>
                    <Button type="submit" disabled={createPost.isPending}>
                      {createPost.isPending ? (
                        <Spinner data-icon="inline-start" />
                      ) : null}
                      Save post
                    </Button>
                  </DialogFooter>
                </FieldGroup>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}
