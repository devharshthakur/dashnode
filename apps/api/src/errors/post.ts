export class InvalidPostIdError extends Error {
  constructor() {
    super('Invalid post id')
    this.name = 'InvalidPostIdError'
  }
}

export class PostNotFoundError extends Error {
  constructor() {
    super('Post not found')
    this.name = 'PostNotFoundError'
  }
}

export class PostForbiddenError extends Error {
  constructor() {
    super('You can only modify your own posts')
    this.name = 'PostForbiddenError'
  }
}
