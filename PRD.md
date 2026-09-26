# Hashnode Platform — Product Requirement Document

> **A Developer-First Blogging & Publishing Platform**  
> Built on the **Pure MERN Stack**: MongoDB · Express.js · React.js · Node.js

---

## Table of Contents

- [1. Project Summary](#1-project-summary)
  - [1.1 Project Metadata](#11-project-metadata)
  - [1.2 Product Overview](#12-product-overview)
  - [1.3 Learning Objectives](#13-learning-objectives)
  - [1.4 Scope Statement](#14-scope-statement)
- [2. Functional Requirements](#2-functional-requirements)
  - [2.1 MVP / Must-Have Requirements](#21-mvp--must-have-requirements)
  - [2.2 Nice-to-Have / Stretch Goals](#22-nice-to-have--stretch-goals)
- [3. Technical Architecture](#3-technical-architecture)
  - [3.1 High-Level Architecture](#31-high-level-architecture)
  - [3.2 Authentication Flow](#32-authentication-flow)
  - [3.3 Frontend Folder Structure](#33-frontend-folder-structure)
  - [3.4 Backend Folder Structure](#34-backend-folder-structure)
- [4. Database Design](#4-database-design)
  - [4.1 User Model](#41-user-model)
  - [4.2 Post Model](#42-post-model)
  - [4.3 Tag Model](#43-tag-model)
  - [4.4 Entity Relationships](#44-entity-relationships)
- [5. REST API Specification](#5-rest-api-specification)
  - [5.1 Authentication Endpoints](#51-authentication-endpoints)
  - [5.2 Post Endpoints](#52-post-endpoints)
  - [5.3 Tag Endpoints](#53-tag-endpoints)
  - [5.4 User Endpoints](#54-user-endpoints)
- [6. Frontend Pages & Components](#6-frontend-pages--components)
  - [6.1 Routes](#61-routes)
  - [6.2 Reusable Components](#62-reusable-components)
  - [6.3 State Management](#63-state-management)
- [7. Implementation Plan](#7-implementation-plan)
  - [7.1 Phase 1 — Backend Foundation](#71-phase-1--backend-foundation-days-14)
  - [7.2 Phase 2 — Core Post API](#72-phase-2--core-post-api-days-57)
  - [7.3 Phase 3 — React Foundation & Public Feed](#73-phase-3--react-foundation--public-feed-days-810)
  - [7.4 Phase 4 — Dashboard, Editor & Profiles](#74-phase-4--dashboard-editor--profiles-days-1114)
  - [7.5 Phase 5 — Polish, Testing & Deployment](#75-phase-5--polish-testing--deployment-days-1518)
- [8. Testing & Acceptance Checklist](#8-testing--acceptance-checklist)
- [9. Evaluation Rubric](#9-evaluation-rubric)
  - [9.1 Baseline Pass Requirements](#91-baseline-pass-requirements)
- [10. Required Tools & Packages](#10-required-tools--packages)
  - [10.1 Development Environment](#101-development-environment)
  - [10.2 Server Packages](#102-server-packages)
  - [10.3 Client Packages](#103-client-packages)
  - [10.4 Deployment Platforms](#104-deployment-platforms)
- [11. Definition of Done](#11-definition-of-done)

---

# 1. Project Summary

## 1.1 Project Metadata

| Attribute                   | Detail                                                   |
| --------------------------- | -------------------------------------------------------- |
| **Project Name**            | Hashnode                                                 |
| **Project Type**            | Individual Capstone Project — Full Stack Web Development |
| **Target Level**            | Beginner to Intermediate                                 |
| **Team Size**               | 1 Student — Solo Build                                   |
| **Duration**                | 3 Weeks — approximately 15–18 working days               |
| **Technology Stack**        | MongoDB, Express.js, React.js, Node.js                   |
| **Architecture Constraint** | Pure MERN; no TypeScript; no SSR                         |
| **Document Owner**          | Full Stack Development Program                           |
| **Document Status**         | Approved for Student Distribution                        |

## 1.2 Product Overview

Hashnode is a full-stack publishing platform designed for developers to write, format, publish, and share technical content with a public audience.

The product focuses on developer-centric publishing workflows, including:

- Writing articles in **Markdown**.
- Embedding fenced code blocks with **syntax highlighting**.
- Organizing articles using **technology tags/topics**.
- Browsing a public feed containing published articles from other developers.
- Maintaining a personal publishing dashboard for drafts and published content.
- Viewing developer profiles and their published posts.

The platform must support both authenticated and unauthenticated usage:

### Public visitors can

- Browse the public article feed.
- Search published posts by title keyword.
- Open individual published posts.
- Filter posts by tag.
- Browse the available tags.
- View public author profiles.

### Registered users can additionally

- Create posts.
- Save posts as drafts.
- Publish posts.
- Edit their own posts.
- Delete their own posts.
- Manage their own profile.
- Access a private dashboard containing both draft and published posts.

## 1.3 Learning Objectives

The project is intended to demonstrate practical full-stack development skills across the complete MERN stack.

By completing the project, the student should demonstrate the ability to:

1. **Implement secure authentication**
   - Register users.
   - Hash passwords with `bcryptjs`.
   - Authenticate users using email and password.
   - Issue and verify JWTs.
   - Protect routes on both the client and server.

2. **Build a structured REST API**
   - Separate routes, controllers, middleware, models, and utilities.
   - Implement consistent request handling and error handling.
   - Enforce authorization and ownership checks in backend controllers.

3. **Model application data with MongoDB and Mongoose**
   - Create `User`, `Post`, and `Tag` collections.
   - Use ObjectId references between collections.
   - Represent one-to-many and many-to-many relationships.

4. **Support developer-focused Markdown publishing**
   - Store post content as raw Markdown.
   - Render Markdown in the frontend.
   - Render fenced code blocks with language-aware syntax highlighting.

5. **Build a multi-page React SPA**
   - Use React Router for public, protected, and dynamic routes.
   - Support routes such as `/post/:slug`, `/tag/:slug`, and `/profile/:id`.

6. **Manage application state appropriately**
   - Use React Context for global authentication state.
   - Use local component/page state for forms, fetched data, loading, and errors.

7. **Consume REST APIs from React**
   - Use Axios for HTTP requests.
   - Send JWTs on protected requests.
   - Handle loading and error states.

8. **Follow realistic project conventions**
   - Use environment variables.
   - Keep frontend and backend concerns separated.
   - Support local development and production deployment workflows.

9. **Apply content-focused UI/UX fundamentals**
   - Maintain readable typography.
   - Provide responsive layouts.
   - Present clear visual hierarchy for article-heavy pages.

## 1.4 Scope Statement

This is a **solo educational capstone project**. The student is responsible for the full application lifecycle, including:

- MongoDB schema design.
- Express API implementation.
- Authentication and authorization.
- React user interface.
- Markdown rendering.
- Testing.
- Deployment.

> **Educational-use note:** The specification is for learning purposes within a Full Stack Development program. The project is an independent student implementation and is not affiliated with or endorsed by any company.

---

# 2. Functional Requirements

Requirements are divided into:

- **Must-Have / MVP** requirements — required for the graded minimum viable product.
- **Nice-to-Have / Stretch Goals** — optional additions that should only be attempted after the MVP is complete and tested.

## 2.1 MVP / Must-Have Requirements

### A. User Authentication

#### Registration

A visitor must be able to create an account using:

- Name.
- Email address.
- Password.

#### Login

A registered user must be able to log in using:

- Email address.
- Password.

After successful authentication:

- The backend returns a JWT.
- The frontend stores the token in `localStorage`.
- The user remains signed in across page refreshes.
- The token is validated when the application loads.

#### Password Security

Passwords must **never** be stored in plain text.

Before saving a user record:

- The password must be hashed using `bcryptjs`.
- API responses must not expose password data.

#### Logout

A logged-in user must be able to log out.

Logging out must clear the client-side authenticated session.

#### Protected Routes

The following pages require authentication:

- Dashboard.
- New Post.
- Edit Post.
- Profile Settings.

If a visitor attempts to access a protected page without a valid token, the frontend must redirect the visitor to `/login`.

Backend protected endpoints must also independently verify the JWT.

---

### B. Post Management — CRUD

A logged-in user must be able to create, read, update, and delete their own posts.

#### Create Post

A new post supports:

- Title.
- Markdown content/body.
- Cover image URL.
- One or more tags.
- Publication status.

A post can be saved as either:

- `draft`
- `published`

#### Markdown Support

Post content must support common Markdown syntax, including:

- Headings.
- Bold text.
- Italic text.
- Links.
- Ordered lists.
- Unordered lists.
- Fenced code blocks.

#### Syntax Highlighting

When a published post contains a fenced code block, the reader-facing page must render the code with language-aware syntax highlighting rather than plain text formatting.

#### Edit Post

A logged-in author must be able to edit their own post, including:

- Title.
- Markdown content.
- Tags.
- Cover image.
- Draft/published status.

#### Delete Post

A logged-in author must be able to delete their own post.

Deletion must include a **confirmation step** before the record is removed.

#### Ownership Enforcement

A user must not be able to edit or delete a post created by another user.

This restriction must be enforced by the backend controller, not only by hiding controls in the frontend.

Directly manipulating an edit URL or manually calling the API must not bypass the ownership restriction.

#### Automatic Post Metadata

Every post must automatically record:

- Author.
- Creation date/time.
- Last-updated date/time.

---

### C. Tags / Topics

#### Assign Tags

While creating or editing a post, the author must be able to:

- Select one or more existing tags.
- Create a new tag while writing.

Example tags include:

- `javascript`
- `mongodb`
- `career`

#### Tag Filtering

Clicking a tag on a post must open a filtered feed containing all **published** posts associated with that tag.

#### Tags Directory

The application must include a dedicated Tags page showing:

- All available tags.
- The number of posts associated with each tag.

---

### D. Public Developer Feed

The public feed must be accessible to both logged-in users and visitors.

#### Feed Ordering

Published posts must be shown newest first, ordered by the time each post was
published rather than the time its draft was created. A draft created earlier
but published later therefore appears above older posts. Editing a published
post does not change its publication date; unpublishing and publishing it again
counts as a new publication.

#### Feed Card Content

Each post card must display:

- Cover image.
- Post title.
- Short excerpt.
- Author name.
- Publish date.
- Associated tags.

#### Search

Visitors must be able to search the feed by keyword.

Search matches against post titles.

#### Post Navigation

Clicking a feed card must open the complete article on its own post-detail page.

#### Feed Pagination

The API serves the feed in bounded pages and returns a cursor for reaching older
posts (see [Post list pagination](#post-list-pagination)). Pagination controls in
the client remain optional; the server never loads an unbounded number of posts
for one request.

#### Draft Visibility Rule

Draft posts must never appear in:

- The public feed.
- Tag feeds.
- Public author profiles.

Only published posts are publicly visible.

---

### E. User Profiles & Dashboard

#### Public Profile

Visitors must be able to view another user's profile.

A public profile shows:

- Display name.
- Bio.
- Published posts authored by that user.

#### Edit Own Profile

A logged-in user must be able to update:

- Display name.
- Short bio.
- Avatar URL.

#### Private Dashboard

A logged-in user must have access to a private dashboard containing **all** posts authored by that user, including:

- Draft posts.
- Published posts.

Each dashboard item must provide quick actions for:

- Edit.
- Delete.

---

## 2.2 Nice-to-Have / Stretch Goals

The following features are optional and should only be attempted after all MVP requirements are complete and tested:

- Post likes/reactions with a visible count.
- Threaded comments on individual posts.
- Reading-time estimate based on word count.
- Follow/unfollow functionality for authors.
- Personalized feed based on followed authors.
- Pagination on the public feed.
- Infinite scrolling as an alternative to pagination.
- Image uploads through a service such as Cloudinary instead of manually pasting image URLs.
- Dark mode with per-user persistence.
- Bookmark/save-for-later functionality.

---

# 3. Technical Architecture

## 3.1 High-Level Architecture

The application follows a decoupled MERN architecture.

The React frontend **must not** communicate directly with MongoDB.

All data reads and writes flow through the Express REST API.

```text
[ React Client (Vite) ]
          |
          | Axios (HTTP/JSON)
          | JWT in Authorization header for protected requests
          v
[ Express.js REST API ]
          |
          | Mongoose ODM
          v
[ MongoDB Database ]
```

### Architectural responsibilities

#### React Client

Responsible for:

- Rendering the UI.
- Client-side routing.
- Form handling.
- Calling the API through Axios.
- Storing authentication state.
- Rendering Markdown and syntax-highlighted code.

#### Express REST API

Responsible for:

- Authentication.
- Authorization.
- Ownership validation.
- Request validation.
- Business logic.
- Error handling.
- Database access through Mongoose.

#### MongoDB

Responsible for persistent storage of:

- Users.
- Posts.
- Tags.

The server is the source of truth for authorization and data access.

## 3.2 Authentication Flow

```text
Client
  |
  | POST /api/auth/login
  v
Express Server
  |
  | Verify email + password
  | Sign JWT
  v
Client
  |
  | Store JWT
  | Send JWT with future protected requests
  v
Authorization: Bearer <token>
  |
  v
Auth Middleware
  |
  | Verify JWT
  v
Protected Controller
```

Expected sequence:

1. The client submits login credentials to `/api/auth/login`.
2. The server verifies the credentials.
3. The server creates and returns a signed JWT.
4. The client stores the token in `localStorage`.
5. The client sends the token on each protected request in the `Authorization` header.
6. Authentication middleware verifies the token.
7. Only verified requests continue to the protected controller.

## 3.3 Frontend Folder Structure

```text
client/
├── public/
├── src/
│   ├── api/
│   │   └── axios.js               # Pre-configured Axios instance
│   ├── assets/
│   ├── components/
│   │   ├── layout/                # Navbar, Footer, ProtectedRoute
│   │   ├── post/                  # PostCard, PostList, TagPill
│   │   └── editor/                # MarkdownEditor, MarkdownPreview
│   ├── context/
│   │   └── AuthContext.jsx        # Global auth state: user, token, status
│   ├── pages/
│   │   ├── Feed.jsx
│   │   ├── PostDetail.jsx
│   │   ├── TagPage.jsx
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Dashboard.jsx
│   │   ├── PostEditor.jsx         # Used for both create and edit
│   │   └── Profile.jsx
│   ├── hooks/
│   │   └── useAuth.js
│   ├── App.jsx
│   └── main.jsx
├── .env
└── package.json
```

> The frontend is a single-page application. React Router handles navigation; the backend returns JSON and does not render HTML pages.

## 3.4 Backend Folder Structure

```text
server/
├── config/
│   └── db.js                      # MongoDB connection
├── models/
│   ├── User.js
│   ├── Post.js
│   └── Tag.js
├── controllers/
│   ├── authController.js
│   ├── postController.js
│   ├── tagController.js
│   └── userController.js
├── routes/
│   ├── authRoutes.js
│   ├── postRoutes.js
│   ├── tagRoutes.js
│   └── userRoutes.js
├── middleware/
│   ├── authMiddleware.js          # JWT verification
│   └── errorMiddleware.js
├── utils/
│   └── generateToken.js
├── .env
├── server.js
└── package.json
```

---

# 4. Database Design

Three core MongoDB collections are required for the MVP:

1. `User`
2. `Post`
3. `Tag`

Posts reference:

- Their author through a `User` ObjectId.
- Their tags through one or more `Tag` ObjectIds.

## 4.1 User Model

```js
// models/User.js
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    }, // stored as bcrypt hash
    bio: {
      type: String,
      maxlength: 200,
      default: '',
    },
    avatarUrl: {
      type: String,
      default: '',
    },
  },
  { timestamps: true },
)
```

### User fields

| Field       | Type   |  Required | Notes                        |
| ----------- | ------ | --------: | ---------------------------- |
| `name`      | String |       Yes | Trimmed display name         |
| `email`     | String |       Yes | Unique and lowercased        |
| `password`  | String |       Yes | Stored as bcrypt hash        |
| `bio`       | String |        No | Maximum 200 characters       |
| `avatarUrl` | String |        No | Defaults to empty string     |
| `createdAt` | Date   | Automatic | Added by Mongoose timestamps |
| `updatedAt` | Date   | Automatic | Added by Mongoose timestamps |

## 4.2 Post Model

```js
// models/Post.js
const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    content: {
      type: String,
      required: true,
    }, // raw Markdown
    excerpt: {
      type: String,
      maxlength: 250,
    },
    coverImage: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag',
      },
    ],
  },
  { timestamps: true },
)
```

### Post fields

| Field         | Type             |  Required | Notes                                       |
| ------------- | ---------------- | --------: | ------------------------------------------- |
| `title`       | String           |       Yes | Trimmed                                     |
| `slug`        | String           |       Yes | Unique, used in public post URLs            |
| `content`     | String           |       Yes | Raw Markdown                                |
| `excerpt`     | String           |        No | Maximum 250 characters                      |
| `coverImage`  | String           |        No | URL; defaults to empty string               |
| `status`      | String           |        No | `draft` or `published`; defaults to `draft` |
| `publishedAt` | Date             |        No | Set when published, `null` for drafts       |
| `author`      | ObjectId → User  |       Yes | Identifies post owner                       |
| `tags`        | ObjectId[] → Tag |        No | Supports multiple tags                      |
| `createdAt`   | Date             | Automatic | Added by timestamps                         |
| `updatedAt`   | Date             | Automatic | Added by timestamps                         |

## 4.3 Tag Model

```js
// models/Tag.js
const tagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { timestamps: true },
)
```

### Tag fields

| Field       | Type   |  Required | Notes                       |
| ----------- | ------ | --------: | --------------------------- |
| `name`      | String |       Yes | Unique, trimmed, lowercased |
| `slug`      | String |       Yes | Unique URL-safe identifier  |
| `createdAt` | Date   | Automatic | Added by timestamps         |
| `updatedAt` | Date   | Automatic | Added by timestamps         |

## 4.4 Entity Relationships

### User → Post

- Relationship: **one-to-many**.
- One user can author many posts.
- `Post.author` references `User._id`.

```text
User (1) ─────────< Post (many)
```

### Post ↔ Tag

- Relationship: **many-to-many**.
- One post can have many tags.
- One tag can be associated with many posts.
- `Post.tags` stores references to `Tag` records.

```text
Post (many) >────────< Tag (many)
```

### Slug Usage

`Post.slug` is used to create readable public URLs, for example:

```text
/post/building-a-rest-api-with-express
```

---

# 5. REST API Specification

## API Security Rules

All protected endpoints require a valid JWT in the HTTP header:

```http
Authorization: Bearer <token>
```

Ownership-sensitive operations must be validated on the backend.

The frontend must never be treated as the security boundary.

## 5.1 Authentication Endpoints

Base path:

```text
/api/auth
```

| Method | Route                | Access    | Request Body                | Purpose                                         |
| ------ | -------------------- | --------- | --------------------------- | ----------------------------------------------- |
| `POST` | `/api/auth/register` | Public    | `{ name, email, password }` | Create a new account                            |
| `POST` | `/api/auth/login`    | Public    | `{ email, password }`       | Authenticate user and return JWT                |
| `GET`  | `/api/auth/me`       | Protected | —                           | Return the current authenticated user's profile |

## 5.2 Post Endpoints

Base path:

```text
/api/posts
```

| Method   | Route                  | Access                 | Request Body / Query                           | Purpose                                         |
| -------- | ---------------------- | ---------------------- | ---------------------------------------------- | ----------------------------------------------- |
| `GET`    | `/api/posts`           | Public                 | Query: `search`, `tag`, `limit`, `cursor`      | List published posts for the public feed        |
| `GET`    | `/api/posts/:slug`     | Public                 | —                                              | Return one published post by slug               |
| `POST`   | `/api/posts`           | Protected              | `{ title, content, tags, coverImage, status }` | Create a draft or published post                |
| `PUT`    | `/api/posts/:id`       | Protected — owner only | `{ title, content, tags, coverImage, status }` | Update an existing post                         |
| `DELETE` | `/api/posts/:id`       | Protected — owner only | —                                              | Delete an existing post                         |
| `GET`    | `/api/posts/mine/list` | Protected              | Query: `limit`, `cursor`                       | List the current user's posts, including drafts |

### Required post endpoint behavior

- `GET /api/posts` must exclude drafts.
- Public feeds (`GET /api/posts`, `GET /api/tags/:slug/posts`, and the posts on `GET /api/users/:id`) order published posts by `publishedAt`, most recent first.
- `publishedAt` is set when a post is created as published or transitions from draft to published, cleared when a published post is unpublished, and returned by the post endpoints (`null` for drafts). Post payloads include it alongside `createdAt`/`updatedAt`.
- Public post lookup by slug must return published posts only.
- Update and delete operations must verify that the current user owns the post.
- `GET /api/posts/mine/list` returns both draft and published posts belonging to the authenticated user. Its two-segment path keeps it from shadowing the single-segment public `GET /api/posts/:slug` lookup.

### Post list pagination

Every endpoint that returns a list of posts reads one bounded page instead of
every match. A page holds 10 posts by default and accepts a `limit` query
parameter of 1–50. The response includes an opaque `nextCursor`; sending it back
as the `cursor` query parameter returns the next page, and `null` marks the last
page. Pages are keyset-paginated over the ordering key plus `_id`, so paging
stays cheap at any depth and ordering is deterministic when timestamps tie.
Pagination controls in the client remain optional; the limit here exists so one
request can never read an unbounded number of posts or their Markdown bodies.

## 5.3 Tag Endpoints

Base path:

```text
/api/tags
```

| Method | Route                   | Access | Request Body | Purpose                                    |
| ------ | ----------------------- | ------ | ------------ | ------------------------------------------ |
| `GET`  | `/api/tags`             | Public | —            | List all tags with post counts             |
| `GET`  | `/api/tags/:slug/posts` | Public | —            | List published posts associated with a tag |

## 5.4 User Endpoints

Base path:

```text
/api/users
```

| Method | Route            | Access    | Request Body               | Purpose                                     |
| ------ | ---------------- | --------- | -------------------------- | ------------------------------------------- |
| `GET`  | `/api/users/:id` | Public    | —                          | Return a public profile and published posts |
| `PUT`  | `/api/users/me`  | Protected | `{ name, bio, avatarUrl }` | Update the authenticated user's profile     |

---

# 6. Frontend Pages & Components

## 6.1 Routes

| Route          | Page Component        | Access            | Purpose                                                |
| -------------- | --------------------- | ----------------- | ------------------------------------------------------ |
| `/`            | `Feed.jsx`            | Public            | Public feed of published posts with search             |
| `/post/:slug`  | `PostDetail.jsx`      | Public            | Render full post with Markdown and syntax highlighting |
| `/tag/:slug`   | `TagPage.jsx`         | Public            | Show published posts for a selected tag                |
| `/login`       | `Login.jsx`           | Public            | Login form                                             |
| `/register`    | `Register.jsx`        | Public            | Registration form                                      |
| `/dashboard`   | `Dashboard.jsx`       | Protected         | Show current user's draft and published posts          |
| `/editor/new`  | `PostEditor.jsx`      | Protected         | Create a new post                                      |
| `/editor/:id`  | `PostEditor.jsx`      | Protected — owner | Edit an existing post                                  |
| `/profile/:id` | `Profile.jsx`         | Public            | Public author profile and published posts              |
| `/settings`    | `ProfileSettings.jsx` | Protected         | Edit current user's profile                            |

## 6.2 Reusable Components

### `Navbar`

Responsibilities:

- Show `Login` and `Register` when the user is logged out.
- Show Dashboard access, avatar, and Logout when the user is logged in.

### `ProtectedRoute`

Responsibilities:

- Wrap protected pages.
- Check whether a valid authentication token is present.
- Redirect unauthenticated visitors to `/login`.

### `PostCard`

Displays a feed preview containing:

- Cover image.
- Title.
- Excerpt.
- Author.
- Date.
- Tag pills.

### `PostList`

Renders a collection of `PostCard` components.

Expected usage:

- Feed page.
- Tag page.
- Public profile page.

### `TagPill`

A small clickable badge linked to:

```text
/tag/:slug
```

### `MarkdownEditor`

Provides a Markdown text input area for composing post content.

It is paired with a live preview.

### `MarkdownPreview`

Responsibilities:

- Convert Markdown into rendered HTML/UI.
- Render fenced code blocks.
- Apply code syntax highlighting.

### `AuthForm`

A shared authentication form layout used by:

- Login page.
- Register page.

### `LoadingSpinner`

Reusable loading feedback for data-fetching pages.

### `ErrorMessage`

Reusable user-facing error feedback for failed requests and other page-level errors.

## 6.3 State Management

### Global State — React Context API

`AuthContext` should manage:

- Current authenticated user.
- JWT token.
- Authentication status.

Suggested authentication status values include:

- Loading.
- Authenticated.
- Guest.

The state is exposed to components through a `useAuth` hook.

### Local State

Use `useState` or `useReducer` for:

- Form inputs.
- Feed data.
- Single-post data.
- Profile data.
- Loading flags.
- Error messages.

### Explicit Scope Constraint

Redux or another external global state library is **not required**.

React Context plus local state is the expected approach.

---

# 7. Implementation Plan

The project is planned for approximately **3 weeks**, with roughly **4–6 hours of work per day** across **15–18 working days**.

Each phase must end with a working checkpoint before the next phase begins.

## 7.1 Phase 1 — Backend Foundation (Days 1–4)

### Tasks

- [ ] Initialize the Express server.
- [ ] Connect the server to MongoDB using Mongoose.
- [ ] Configure environment variables.
- [ ] Create the `User` model.
- [ ] Create the `Post` model.
- [ ] Create the `Tag` model.
- [ ] Implement user registration.
- [ ] Hash passwords using `bcryptjs`.
- [ ] Implement login.
- [ ] Generate JWTs.
- [ ] Create authentication middleware for protected routes.

### Checkpoint

The backend should be testable through Postman or Thunder Client.

The student should be able to:

- Register a new user.
- Log in successfully.
- Receive a JWT.
- Access a protected endpoint with a valid token.
- Confirm a protected endpoint rejects a request without a valid token.

## 7.2 Phase 2 — Core Post API (Days 5–7)

### Tasks

- [ ] Implement post creation.
- [ ] Implement public post retrieval.
- [ ] Implement post update.
- [ ] Implement post deletion.
- [ ] Enforce ownership checks on update/delete.
- [ ] Generate slugs from post titles.
- [ ] Build tag endpoints.
- [ ] Implement tag-to-post linking.

### Checkpoint

Through the API, the student should be able to:

- Create a post.
- Read a post.
- Update a post.
- Delete a post.
- Verify that unauthorized users cannot update/delete someone else's post.
- Verify that draft posts do not appear in the public feed endpoint.

## 7.3 Phase 3 — React Foundation & Public Feed (Days 8–10)

### Tasks

- [ ] Scaffold the React application with Vite.
- [ ] Configure React Router.
- [ ] Create the shared Axios instance.
- [ ] Create `AuthContext`.
- [ ] Connect the Login page to the backend.
- [ ] Connect the Register page to the backend.
- [ ] Build the public Feed page.
- [ ] Build `PostCard`.
- [ ] Build `PostDetail`.
- [ ] Add Markdown rendering.
- [ ] Add code syntax highlighting.

### Checkpoint

A logged-out visitor should be able to:

- Open the site.
- Browse the public feed.
- Open a published post.
- Read properly rendered Markdown.
- See fenced code blocks with syntax highlighting.

## 7.4 Phase 4 — Dashboard, Editor & Profiles (Days 11–14)

### Tasks

- [ ] Build `ProtectedRoute`.
- [ ] Protect Dashboard.
- [ ] Protect Post Editor.
- [ ] Protect Profile Settings.
- [ ] Build the post editor.
- [ ] Add Markdown input.
- [ ] Add live Markdown preview.
- [ ] Reuse the editor for both create and edit modes.
- [ ] Build the Dashboard.
- [ ] Show both draft and published posts in the Dashboard.
- [ ] Add edit actions.
- [ ] Add delete actions.
- [ ] Build the public Profile page.
- [ ] Build Profile Settings.

### Checkpoint

A logged-in user should be able to:

1. Create a draft.
2. Edit the draft.
3. Publish the draft.
4. See the published post appear on the public feed.
5. Update their own profile.

## 7.5 Phase 5 — Polish, Testing & Deployment (Days 15–18)

### Tasks

- [ ] Add loading states.
- [ ] Add empty states.
- [ ] Add user-facing error messages.
- [ ] Test attempts to edit another user's post through a direct URL.
- [ ] Test API-level ownership bypass attempts.
- [ ] Test expired tokens.
- [ ] Test invalid form submissions.
- [ ] Add responsive styling.
- [ ] Improve article typography.
- [ ] Improve spacing.
- [ ] Improve code-block contrast/readability.
- [ ] Deploy the backend.
- [ ] Deploy the frontend.
- [ ] Configure production environment variables.
- [ ] Connect deployed frontend and backend.

### Checkpoint

The final public deployment should work for:

- A logged-out visitor.
- A logged-in author.

---

# 8. Testing & Acceptance Checklist

The following checklist converts the PRD requirements into implementation-verification items.

## Authentication & Security

- [ ] A visitor can register with name, email, and password.
- [ ] Passwords are hashed before being stored.
- [ ] A registered user can log in.
- [ ] Login returns a JWT.
- [ ] The token is persisted on the client.
- [ ] The session survives a page refresh.
- [ ] Invalid or missing tokens are rejected by protected backend endpoints.
- [ ] Protected frontend pages redirect unauthenticated users to `/login`.
- [ ] Logging out clears the client session.
- [ ] Sensitive password data is not returned in API responses.

## Posts

- [ ] Authenticated users can create posts.
- [ ] Posts can be saved as drafts.
- [ ] Posts can be published.
- [ ] Markdown syntax renders correctly.
- [ ] Fenced code blocks receive syntax highlighting.
- [ ] Authors can edit their own posts.
- [ ] Authors can delete their own posts.
- [ ] Delete includes a confirmation step.
- [ ] A user cannot edit another user's post.
- [ ] A user cannot delete another user's post.
- [ ] Ownership is enforced on the backend.
- [ ] Post author is stored automatically.
- [ ] Post creation/update timestamps are stored automatically.
- [ ] Drafts are excluded from public endpoints.

## Tags

- [ ] Authors can assign multiple tags to a post.
- [ ] Authors can use existing tags.
- [ ] Authors can create a new tag while writing.
- [ ] Tag pages show published posts for the selected tag.
- [ ] Tags page lists available tags.
- [ ] Tags page includes post counts.

## Public Feed

- [ ] Public feed is accessible without authentication.
- [ ] Feed contains published posts only.
- [ ] Feed is ordered newest first.
- [ ] Feed cards contain title, excerpt, cover image, author, date, and tags.
- [ ] Search filters by title keyword.
- [ ] Clicking a card opens the full post.

## Profiles & Dashboard

- [ ] Public profile displays user name.
- [ ] Public profile displays bio.
- [ ] Public profile shows published posts only.
- [ ] Logged-in users can edit their own name.
- [ ] Logged-in users can edit their own bio.
- [ ] Logged-in users can edit their own avatar URL.
- [ ] Dashboard shows drafts.
- [ ] Dashboard shows published posts.
- [ ] Dashboard provides edit actions.
- [ ] Dashboard provides delete actions.

## UX & Reliability

- [ ] Loading states are visible during network requests.
- [ ] Empty states are displayed when no data exists.
- [ ] User-facing error messages are shown when requests fail.
- [ ] Layout remains usable on mobile widths.
- [ ] Long-form article text is readable.
- [ ] Code blocks have sufficient visual contrast.

## Deployment

- [ ] Backend is publicly hosted.
- [ ] Frontend is publicly hosted.
- [ ] Database is accessible from the deployed backend.
- [ ] Production environment variables are configured.
- [ ] Frontend successfully communicates with the backend in production.
- [ ] Logged-out flows work on the deployed site.
- [ ] Logged-in author flows work on the deployed site.

---

# 9. Evaluation Rubric

The project is graded out of **100 points**.

| Category                      |  Points | What Is Evaluated                                                                                     |
| ----------------------------- | ------: | ----------------------------------------------------------------------------------------------------- |
| **Authentication & Security** |      20 | JWT implementation, bcrypt hashing, protected routes on client/server, no sensitive data exposed      |
| **Post CRUD & Ownership**     |      20 | Complete create/read/update/delete flow and server-side author ownership enforcement                  |
| **Markdown & Code Rendering** |      15 | Correct Markdown rendering, syntax-highlighted fenced code blocks, safe content rendering             |
| **Tags & Public Feed**        |      15 | Tag filtering, draft exclusion, working search                                                        |
| **API Design & Code Quality** |      15 | RESTful naming, route/controller separation, consistent error handling, readable code, commit history |
| **UI/UX & Responsiveness**    |      10 | Clean layout, readable content, mobile usability, loading/empty/error states                          |
| **Deployment**                |       5 | Publicly reachable application with working frontend/backend connection                               |
| **Total**                     | **100** |                                                                                                       |

## 9.1 Baseline Pass Requirements

Regardless of the total score, the submission cannot pass if any of the following are true:

- [ ] Passwords are stored in plain text or proper password hashing is missing.
- [ ] Any user can edit or delete another user's post through a direct API request.
- [ ] Draft posts appear in the public feed.
- [ ] The application cannot be run locally from the submitted repository by following the student's own README.

---

# 10. Required Tools & Packages

## 10.1 Development Environment

| Tool                                          | Purpose                                                        |
| --------------------------------------------- | -------------------------------------------------------------- |
| **Node.js (LTS) & npm**                       | JavaScript runtime and package manager for client and server   |
| **Visual Studio Code**                        | Primary code editor                                            |
| **MongoDB Community Server or MongoDB Atlas** | Local or cloud-hosted database                                 |
| **MongoDB Compass**                           | GUI for inspecting collections and documents                   |
| **Postman or Thunder Client**                 | Manual API testing before frontend integration                 |
| **Git & GitHub**                              | Version control and project submission                         |
| **Chrome/Firefox DevTools**                   | Debug network requests, console errors, and responsive layouts |

## 10.2 Server Packages

| Package        | Purpose                                     |
| -------------- | ------------------------------------------- |
| `express`      | Web server and REST routing                 |
| `mongoose`     | MongoDB object modeling                     |
| `jsonwebtoken` | Issue and verify JWTs                       |
| `bcryptjs`     | Password hashing                            |
| `cors`         | Allow frontend requests from another origin |
| `dotenv`       | Load environment variables from `.env`      |
| `nodemon`      | Development-only automatic server restart   |

## 10.3 Client Packages

| Package                                      | Purpose                                    |
| -------------------------------------------- | ------------------------------------------ |
| `react`                                      | Core UI library                            |
| `react-dom`                                  | DOM renderer for React                     |
| `react-router-dom`                           | Client-side routing                        |
| `axios`                                      | HTTP requests to the Express API           |
| `react-markdown`                             | Render Markdown content                    |
| `react-syntax-highlighter` or `highlight.js` | Syntax highlighting for fenced code blocks |
| `vite`                                       | Frontend development server and build tool |

## 10.4 Deployment Platforms

Free-tier-suitable options listed in the PRD:

### Backend

- Render.
- Railway.

### Frontend

- Vercel.
- Netlify.

### Database

- MongoDB Atlas — free M0 cluster.

---

# 11. Definition of Done

The MVP can be considered complete when all of the following are true:

- [ ] A new user can register and log in securely.
- [ ] Passwords are stored only as bcrypt hashes.
- [ ] JWT authentication protects required client and server routes.
- [ ] Users can create, edit, publish, unpublish/save drafts, and delete their own posts as supported by the status field and editor flow.
- [ ] Users cannot modify posts belonging to another author.
- [ ] Markdown posts render correctly.
- [ ] Code blocks render with syntax highlighting.
- [ ] Posts support tags.
- [ ] Tag filtering works.
- [ ] The public feed displays published posts only and supports title search.
- [ ] Drafts remain private.
- [ ] Public user profiles show published posts.
- [ ] Logged-in users can edit their profile.
- [ ] The private Dashboard shows both draft and published posts.
- [ ] Loading, empty, and error states are implemented.
- [ ] The interface is responsive and readable.
- [ ] The project runs locally using the repository README instructions.
- [ ] The frontend, backend, and database are deployed and connected successfully.

---

## Source

This Markdown document is a structured conversion of the supplied **Hashnode Platform — Product Requirement Document** PDF. It preserves the original scope, MERN-only architecture, feature requirements, schemas, API routes, frontend pages, implementation phases, grading criteria, and tool/package requirements while reorganizing them into GitHub-friendly Markdown.
