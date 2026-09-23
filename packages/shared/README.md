# Shared contracts

This package exports TypeScript types for the API's JSON contract, including post inputs and responses, post statuses, authors, and tags. The API uses these types; the web app does not yet consume them.

The package contains types only. Request validation belongs to the API's Zod schemas, so these types do not validate incoming data at runtime. Exports are defined in [`src/index.ts`](./src/index.ts).
