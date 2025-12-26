# Problems & Solutions

This document outlines the key challenges I personally faced during the development of the AdonisJS Chat Backend, the problems encountered, solutions implemented, and lessons learned along the way.

## Table of Contents

- [Challenge 1: Learning New Technologies](#challenge-1-learning-new-technologies)
- [Challenge 2: Implementing WhatsApp-Style Message Replies](#challenge-2-implementing-whatsapp-style-message-replies)
- [Challenge 3: Creating Temporary Guest Users](#challenge-3-creating-temporary-guest-users)

---

## Challenge 1: Learning New Technologies

### The Challenge

Coming into this project, I had to learn three completely new technologies:
- **AdonisJS**: A Node.js framework I had never used before
- **@adonisjs/lucid/orm**: AdonisJS's ORM for database operations
- **VineJS**: AdonisJS's validation library

This was a significant learning curve, especially understanding how these tools work together and their unique patterns compared to frameworks I was familiar with (like Express.js or NestJS).

### Problems Encountered

#### Problem 1: Understanding AdonisJS Architecture

**Initial Confusion:**
- The folder structure and conventions were different from what I was used to
- Understanding the difference between `app/`, `start/`, and `config/` directories
- Learning about AdonisJS's service container and dependency injection
- Figuring out how middleware works in AdonisJS vs other frameworks

**Solution:**
- Studied the official AdonisJS documentation extensively
- Created a test project to experiment with basic concepts
- Read through example projects to understand patterns
- Used the AdonisJS CLI (`ace`) to generate boilerplate and see how things are structured


#### Problem 2: Learning Lucid ORM

**Initial Challenges:**
- Coming from Sequelize/TypeORM, Lucid's decorator-based approach was different
- Understanding relationship definitions (`@hasMany`, `@belongsTo`, `@manyToMany`)
- Learning how to write migrations in AdonisJS style
- Understanding the query builder API

**Specific Issues:**
1. **Model Relationships**: Initially confused about when to use `@hasMany` vs `@belongsTo`
2. **Eager Loading**: Learning `.preload()` vs `.load()` and when to use each
3. **Migrations**: Understanding the migration syntax and how to reference tables


**Key Resources:**
- AdonisJS Lucid documentation
- Experimenting with queries in the REPL (`node ace repl`)
- Reading the source code of Lucid to understand internals

#### Problem 3: Understanding VineJS Validation

**Initial Challenges:**
- The validation syntax was completely new
- Understanding how to create custom validators
- Learning async validation (like checking unique emails)
- Integrating validators with controllers

**Specific Issues:**
1. **Schema Definition**: The `vine.object()` syntax was unfamiliar
2. **Async Validators**: How to check database uniqueness
3. **Error Messages**: Customizing validation error responses

**Solution & Implementation Steps:**

1. **Started with Simple Validators:**
   ```typescript
   // app/validators/auth_validator.ts
   import vine from '@vinejs/vine'
   
   export const loginValidator = vine.compile(
     vine.object({
       email: vine.string().email(),
       password: vine.string().minLength(8),
     })
   )
   ```

2. **Learned Async Validation:**
   ```typescript
   export const registerValidator = vine.compile(
     vine.object({
       email: vine
         .string()
         .email()
         .unique(async (db, value) => {
           const user = await db.from('users').where('email', value).first()
           return !user  // Return true if unique
         }),
       password: vine.string().minLength(8),
       fullName: vine.string().optional(),
     })
   )
   ```

3. **Used in Controllers:**
   ```typescript
   async register({ request, response }: HttpContext) {
     const payload = await request.validateUsing(registerValidator)
     // payload is now typed and validated
     const user = await User.create(payload)
   }
   ```

### Tradeoffs & Decisions

| Aspect | Option | Pros | Cons | Chosen |
|--------|--------|------|------|--------|
| Learning Approach | Tutorials and AI only | Fast start | Surface-level | ❌ |
| Learning Approach | Docs + AI | Deep understanding | Time-consuming | ✅ |
| Validation Library | Manual validation | Full control | More code | ❌ |
| Validation Library | VineJS | Type-safe, built-in | Learning curve | ✅ |

---

## Challenge 2: Implementing WhatsApp-Style Message Replies

### The Challenge

Implementing a feature where messages can reply to other messages, similar to WhatsApp's reply functionality. This required creating a self-referencing relationship in the database where a message can reference another message in the same table.

### Problems Encountered

#### Problem 1: Understanding Self-Referencing Relationships

**Initial Confusion:**
- Never implemented a self-referencing foreign key before
- How to model a message replying to another message in the same table
- Concerns about circular references and infinite loops
- Database design: Should replies be in the same table or separate?

**Solution:**
Decided on a self-referencing foreign key approach as it's the simplest and most efficient for this use case.

#### Problem 2: Database Migration

**Challenge:**
Creating a migration where a table references itself was new territory.

**Initial Attempt:**
```typescript
// First attempt - didn't work correctly
table.integer('reply_to_id').references('id').inTable('messages')
```

**Problems:**
- Migration order: The `messages` table needs to exist before referencing itself
- Nullable foreign key: Replies are optional, so `reply_to_id` must be nullable
- Cascade behavior: What happens when the original message is deleted?

**Solution & Implementation:**

1. **Created the Migration** (`database/migrations/1766586221540_create_messages_table.ts`):

**Key Decision: `onDelete('SET NULL')`**
- When the original message is deleted, the reply still exists
- The `reply_to_id` becomes `null` instead of causing a cascade delete
- This preserves the reply message content even if the original is deleted

#### Problem 3: Model Definition in Lucid

**Challenge:**
Defining a self-referencing relationship in Lucid ORM was confusing at first.

**Initial Confusion:**
- How to reference the same model class
- Understanding `@belongsTo` for the reply-to relationship
- Understanding `@hasMany` for getting all replies to a message

**Solution & Implementation:**
- Using `() => Message` instead of `Message` prevents circular import issues
- `@belongsTo` creates a relationship to the parent message
- `@hasMany` creates a relationship to all child replies

---

## Challenge 3: Creating Temporary Guest Users

### The Challenge

The requirement was to allow unauthenticated users to access the chat application using guest tokens. However, I needed to create these guest users without cluttering the database with temporary accounts that would never be used again.

### Problems Encountered

#### Problem 1: Understanding Guest Token Requirements

**Initial Confusion:**
- What is a guest token vs a regular user token?
- Should guest users be real users in the database?
- How long should guest tokens last?
- What permissions should guest users have?

**Requirements Analysis:**
- Guest users need to be able to create conversations and send messages
- They should have limited functionality (no account recovery, etc.)
- Tokens should expire after a reasonable time (7 days)
- Should not pollute the user database

#### Problem 2: Database Design

**Initial Approach (Rejected):**
Creating a separate `guest_users` table seemed like over-engineering.

**Considered Options:**
1. **Separate guest_users table**: More complex, requires separate logic
2. **User table with `is_guest` flag**: Simple but mixes concerns
3. **Regular users with special email pattern**: Chosen - simplest approach

**Solution:**
Use the existing `users` table but mark guest users with a special email pattern and token type.


### Tradeoffs & Decisions

| Decision | Option | Pros | Cons | Chosen |
|----------|--------|------|------|--------|
| Storage | Separate table | Clean separation | More complexity | ❌ |
| Storage | Same table | Simple | Mixed with real users | ✅ |
| Email Pattern | Simple | Easy | Not unique | ❌ |
| Email Pattern | Timestamp + Random | Unique, identifiable | Longer emails | ✅ |
| Cleanup | Manual | Full control | Manual work | ❌ |
| Cleanup | Scheduled job | Automatic | More setup | ⏳ (Future) |
| Cleanup | None | Simple | Database growth | ✅ (Current) |