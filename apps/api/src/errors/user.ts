export class InvalidUserIdError extends Error {
  constructor() {
    super('Invalid user id')
    this.name = 'InvalidUserIdError'
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super('User not found')
    this.name = 'UserNotFoundError'
  }
}
