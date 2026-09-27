// Path prefix under which all API routes are mounted.
export const API_PREFIX = '/api'

// Page size a post list returns when the request does not ask for one.
export const DEFAULT_POST_PAGE_SIZE = 10

// Largest page a client may request from a post list.
export const MAX_POST_PAGE_SIZE = 50

// Measured in UTF-8 bytes, not characters: bcrypt folds only the first 72 bytes
// of a password into its hash, so a longer one would be silently shortened.
export const PASSWORD_MAX_BYTES = 72
