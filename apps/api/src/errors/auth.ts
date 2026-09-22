export class EmailTakenError extends Error {
  constructor() {
    super('An account with this email already exists')
    this.name = 'EmailTakenError'
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password')
    this.name = 'InvalidCredentialsError'
  }
}
