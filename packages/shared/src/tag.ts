export interface TagDto {
  id: string
  name: string
  slug: string
}

/**
 * Tag listing projection with the number of published posts using the tag. The
 * directory only carries tags at least one published post uses, so `postCount`
 * is 1 or more.
 */
export interface TagWithPostCountDto extends TagDto {
  postCount: number
}

export interface TagListResponse {
  tags: TagWithPostCountDto[]
}
