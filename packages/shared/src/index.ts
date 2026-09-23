/**
 * Wire contract shared by the API (`apps/api`) and the web app (`apps/web`).
 *
 * Types only: the API owns validation and persistence, the web app owns
 * rendering. Markdown is transported verbatim in `content`; neither side
 * parses it here.
 */

export * from './author'
export * from './post'
export * from './tag'
export * from './user'
