export interface TagDto {
  id: string
  name: string
  slug: string
}

/** Tag listing projection with the number of published posts using the tag. */
export interface TagWithPostCountDto extends TagDto {
  postCount: number
}

export interface TagListResponse {
  tags: TagWithPostCountDto[]
}
