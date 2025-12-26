# Problems & Solutions

This document outlines the key challenges faced during the development of the AdonisJS Chat Backend, the solutions implemented, tradeoffs considered, and step-by-step implementation guides for major features.

## Table of Contents

- [Authentication & JWT Implementation](#authentication--jwt-implementation)
- [Authorization Service Pattern](#authorization-service-pattern)
- [Message Reply Functionality](#message-reply-functionality)
- [Many-to-Many Relationships](#many-to-many-relationships)
- [Database Schema Design](#database-schema-design)
- [Middleware Configuration](#middleware-configuration)
- [Request Validation](#request-validation)
- [Error Handling Strategy](#error-handling-strategy)

---

## Authentication & JWT Implementation

### Problem

Implementing secure authentication with JWT tokens, refresh tokens, and guest token support while maintaining security best practices.

**Challenges:**
- Choosing between session-based and token-based authentication
- Implementing token refresh without compromising security
- Creating guest tokens for unauthenticated users
- Ensuring tokens are properly stored and validated

### Solution

Implemented JWT-based authentication using AdonisJS Auth with database-backed access tokens.

**Key Decisions:**
1. **Database-backed tokens** instead of stateless JWTs for better revocation control
2. **Access tokens** stored in `access_tokens` table with expiration
3. **Guest tokens** with limited scope and shorter expiration (7 days)
4. **Token refresh** creates new token and optionally revokes old one

### Implementation Steps

1. **Configure Auth Provider** (`config/auth.ts`):
   ```typescript
   api: tokensGuard({
     provider: tokensUserProvider({
       tokens: 'accessTokens',
       model: () => import('#models/user')
     }),
   })
   ```

2. **Setup User Model** with AuthFinder mixin:
   ```typescript
   const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
     uids: ['email'],
     passwordColumnName: 'password',
   })
   
   export default class User extends compose(BaseModel, AuthFinder) {
     static accessTokens = DbAccessTokensProvider.forModel(User)
   }
   ```

3. **Create Auth Controller** methods:
   - `register()`: Create user and generate token
   - `login()`: Verify credentials and generate token
   - `refresh()`: Create new token, optionally revoke old
   - `logout()`: Revoke current token
   - `guest()`: Create temporary guest user and token

4. **Create Access Tokens Migration**:
   - Store token hash (not plain token)
   - Include expiration, type, and user reference
   - Enable efficient token lookup and revocation

### Tradeoffs

| Approach | Pros | Cons | Chosen |
|----------|------|------|--------|
| Stateless JWT | Simple, scalable | Hard to revoke | ❌ |
| Database tokens | Revocable, trackable | Database queries | ✅ |
| Session-based | Server control | Not stateless | ❌ |

**Why Database Tokens?**
- Better security: Can revoke compromised tokens
- Audit trail: Track token usage
- Flexibility: Different token types (user, guest)
- Scalability: Can add token metadata later

---

## Authorization Service Pattern

### Problem

Authorization logic was scattered across controllers, leading to code duplication and inconsistent permission checks.

**Challenges:**
- Ensuring only participants can access conversations
- Ensuring only creators can modify/delete conversations
- Ensuring only message owners can edit/delete messages
- Maintaining consistent error messages

### Solution

Created a centralized `ConversationAuthorizationService` that encapsulates all authorization logic.

**Design Pattern:** Service Layer Pattern

### Implementation Steps

1. **Create Authorization Service** (`app/services/conversation_authorization_service.ts`):
   ```typescript
   export default class ConversationAuthorizationService {
     static async isParticipant(conversationId, userId): Promise<boolean>
     static async isCreator(conversationId, userId): Promise<boolean>
     static async ensureParticipant(conversationId, userId): Promise<void>
     static async ensureCreator(conversationId, userId): Promise<void>
     static async getConversationForUser(conversationId, userId): Promise<Conversation>
   }
   ```

2. **Use in Controllers**:
   ```typescript
   // Before accessing conversation
   await ConversationAuthorizationService.ensureParticipant(conversationId, user.id)
   
   // Before modifying conversation
   await ConversationAuthorizationService.ensureCreator(conversationId, user.id)
   ```

3. **Error Handling**:
   - Service throws descriptive errors
   - Controllers catch and convert to HTTP responses
   - Consistent error messages across endpoints

### Benefits

- **DRY Principle**: Authorization logic in one place
- **Testability**: Easy to unit test authorization logic
- **Maintainability**: Changes in one place
- **Consistency**: Same checks everywhere

### Tradeoffs

| Approach | Pros | Cons | Chosen |
|----------|------|------|--------|
| Inline checks | Simple | Duplication | ❌ |
| Service layer | DRY, testable | Extra abstraction | ✅ |
| Policy classes | Very flexible | More complex | ❌ |

---

## Message Reply Functionality

### Problem

Implementing WhatsApp-style message replies where messages can reference other messages, creating a self-referencing relationship.

**Challenges:**
- Self-referencing foreign key in same table
- Ensuring reply-to message exists and is in same conversation
- Loading reply relationships efficiently
- Handling circular references

### Solution

Implemented self-referencing relationship using Lucid ORM's `belongsTo` and `hasMany` decorators.

### Implementation Steps

1. **Database Migration** (`create_messages_table.ts`):
   ```typescript
   table
     .integer('reply_to_id')
     .unsigned()
     .nullable()
     .references('id')
     .inTable('messages')
     .onDelete('SET NULL')  // Prevent cascade deletion
   ```

2. **Model Definition** (`app/models/message.ts`):
   ```typescript
   @belongsTo(() => Message, {
     foreignKey: 'replyToId',
   })
   declare replyTo: BelongsTo<typeof Message>
   
   @hasMany(() => Message, {
     foreignKey: 'replyToId',
   })
   declare replies: HasMany<typeof Message>
   ```

3. **Validation in Controller**:
   ```typescript
   if (payload.replyToId) {
     const replyToMessage = await Message.find(payload.replyToId)
     if (!replyToMessage) {
       return response.notFound({ message: 'Message to reply to not found' })
     }
     if (replyToMessage.conversationId !== conversationId) {
       return response.badRequest({
         message: 'Cannot reply to a message from a different conversation',
       })
     }
   }
   ```

4. **Eager Loading**:
   ```typescript
   .preload('replyTo', (query) => {
     query.select('id', 'content', 'user_id')
     query.preload('user', (query) => {
       query.select('id', 'email', 'fullName')
     })
   })
   ```

### Key Design Decisions

1. **`onDelete('SET NULL')`**: When original message is deleted, reply still exists but `replyToId` becomes null
2. **Validation**: Ensure reply-to message exists and is in same conversation
3. **Eager Loading**: Load reply relationships to avoid N+1 queries

### Tradeoffs

| Approach | Pros | Cons | Chosen |
|----------|------|------|--------|
| Self-reference | Simple, efficient | Requires validation | ✅ |
| Separate replies table | Normalized | More complex queries | ❌ |
| Thread model | Supports threading | Over-engineered | ❌ |

---

## Many-to-Many Relationships

### Problem

Conversations have multiple participants, and users can be in multiple conversations. Need to model this many-to-many relationship efficiently.

**Challenges:**
- Storing participant relationships
- Tracking when users joined
- Preventing duplicate participants
- Efficiently querying user's conversations

### Solution

Created a pivot table `conversation_participants` with additional metadata (joined_at timestamp).

### Implementation Steps

1. **Create Pivot Table Migration**:
   ```typescript
   table.integer('conversation_id').references('id').inTable('conversations')
   table.integer('user_id').references('id').inTable('users')
   table.timestamp('joined_at').notNullable()
   table.unique(['conversation_id', 'user_id'])  // Prevent duplicates
   ```

2. **Create Pivot Model** (`app/models/conversation_participant.ts`):
   ```typescript
   export default class ConversationParticipant extends BaseModel {
     @column()
     declare conversationId: number
     
     @column()
     declare userId: number
     
     @column.dateTime()
     declare joinedAt: DateTime
   }
   ```

3. **Define Relationships**:
   ```typescript
   // In Conversation model
   @hasMany(() => ConversationParticipant, {
     foreignKey: 'conversationId',
   })
   declare participants: HasMany<typeof ConversationParticipant>
   
   @manyToMany(() => User, {
     pivotTable: 'conversation_participants',
     pivotForeignKey: 'conversation_id',
     pivotRelatedForeignKey: 'user_id',
   })
   declare users: ManyToMany<typeof User>
   ```

4. **Query User's Conversations**:
   ```typescript
   const conversations = await Conversation.query()
     .whereHas('participants', (query) => {
       query.where('user_id', user.id)
     })
     .preload('participants')
   ```

### Key Design Decisions

1. **Explicit Pivot Model**: Instead of using Lucid's implicit pivot, created explicit model for:
   - Better type safety
   - Ability to add metadata (joined_at)
   - Easier querying

2. **Unique Constraint**: Prevents duplicate participant entries

3. **Cascade Deletes**: When conversation or user is deleted, participants are automatically removed

### Tradeoffs

| Approach | Pros | Cons | Chosen |
|----------|------|------|--------|
| Explicit pivot model | Metadata, type safety | More code | ✅ |
| Implicit pivot | Less code | Limited metadata | ❌ |
| JSON array column | Simple | Hard to query | ❌ |

---

## Database Schema Design

### Problem

Designing a normalized, efficient database schema that supports all features while maintaining data integrity.

**Challenges:**
- Foreign key relationships
- Cascade delete behavior
- Indexing for performance
- Nullable vs non-nullable fields

### Solution

Designed normalized schema with proper foreign keys, constraints, and cascade behaviors.

### Implementation Steps

1. **Users Table**:
   - Primary key: `id`
   - Unique constraint: `email`
   - Password stored as hash (never plain text)

2. **Access Tokens Table**:
   - Foreign key to users
   - Token hash (not plain token)
   - Expiration tracking

3. **Conversations Table**:
   - Foreign key to users (creator)
   - Nullable name/description (flexibility)

4. **Conversation Participants Table**:
   - Composite unique constraint: `(conversation_id, user_id)`
   - Foreign keys with CASCADE delete
   - `joined_at` timestamp

5. **Messages Table**:
   - Foreign keys to conversation and user
   - Self-referencing foreign key for replies
   - `onDelete('SET NULL')` for reply_to_id
   - `onDelete('CASCADE')` for conversation_id

### Key Design Decisions

1. **CASCADE vs SET NULL**:
   - CASCADE: When user/conversation deleted, delete related records
   - SET NULL: When message deleted, keep replies but nullify reference

2. **Timestamps**:
   - `created_at`, `updated_at`: Standard timestamps
   - `joined_at`: When user joined conversation
   - `edited_at`: When message was edited

3. **Indexing Strategy**:
   - Primary keys: Auto-indexed
   - Foreign keys: Auto-indexed
   - Unique constraints: Auto-indexed
   - Consider adding indexes on frequently queried fields

### Tradeoffs

| Decision | Pros | Cons | Chosen |
|----------|------|------|--------|
| CASCADE delete | Data consistency | Can't recover | ✅ |
| SET NULL | Preserves data | Orphaned records | ✅ (for replies) |
| Soft deletes | Recoverable | More complex | ❌ |

---

## Middleware Configuration

### Problem

Configuring middleware stack to handle authentication, CORS, JSON responses, and request parsing in the correct order.

**Challenges:**
- Middleware execution order
- Global vs route-specific middleware
- Error handling in middleware
- JSON response enforcement

### Solution

Structured middleware into server-level and router-level stacks with proper ordering.

### Implementation Steps

1. **Server Middleware** (`start/kernel.ts`):
   ```typescript
   server.use([
     () => import('#middleware/container_bindings_middleware'),
     () => import('#middleware/force_json_response_middleware'),
     () => import('@adonisjs/cors/cors_middleware'),
   ])
   ```
   - Runs on ALL requests
   - Order: Container bindings → JSON response → CORS

2. **Router Middleware**:
   ```typescript
   router.use([
     () => import('@adonisjs/core/bodyparser_middleware'),
     () => import('@adonisjs/auth/initialize_auth_middleware'),
   ])
   ```
   - Runs on requests with matching routes
   - Order: Body parser → Auth initialization

3. **Named Middleware** (Route-specific):
   ```typescript
   export const middleware = router.named({
     auth: () => import('#middleware/auth_middleware')
   })
   ```
   - Applied to specific routes
   - Used in route definitions: `.use(middleware.auth())`

4. **Custom Middleware**:
   - `force_json_response_middleware`: Ensures all responses are JSON
   - `auth_middleware`: Validates JWT tokens

### Middleware Execution Order

```
Request
  ↓
Server Middleware (all requests)
  ├─ Container Bindings
  ├─ Force JSON Response
  └─ CORS
  ↓
Router Middleware (matched routes)
  ├─ Body Parser
  └─ Auth Initialization
  ↓
Route-Specific Middleware (if applied)
  └─ Auth Middleware
  ↓
Controller
  ↓
Response
```

### Tradeoffs

| Approach | Pros | Cons | Chosen |
|----------|------|------|--------|
| Global middleware | Always runs | Can't skip | ✅ (for CORS, JSON) |
| Route middleware | Selective | Must remember to add | ✅ (for auth) |
| Controller-level | Fine-grained | More code | ❌ |

---

## Request Validation

### Problem

Validating incoming request data to ensure data integrity and prevent invalid data from reaching the database.

**Challenges:**
- Type safety
- Consistent validation rules
- Clear error messages
- Reusable validation schemas

### Solution

Used VineJS (AdonisJS's validation library) to create reusable validation schemas.

### Implementation Steps

1. **Create Validator Files** (`app/validators/`):
   ```typescript
   // auth_validator.ts
   export const registerValidator = vine.compile(
     vine.object({
       email: vine.string().email().unique(async (db, value) => {
         const user = await db.from('users').where('email', value).first()
         return !user
       }),
       password: vine.string().minLength(8),
       fullName: vine.string().optional(),
     })
   )
   ```

2. **Use in Controllers**:
   ```typescript
   const payload = await request.validateUsing(registerValidator)
   ```

3. **Validation Features Used**:
   - Type checking
   - String validation (email, minLength, trim)
   - Number validation
   - Optional fields
   - Custom async validators (unique email check)

### Benefits

- **Type Safety**: Validated data is typed
- **Reusability**: Validators can be reused
- **Clear Errors**: Automatic error messages
- **Async Support**: Can check database uniqueness

### Tradeoffs

| Approach | Pros | Cons | Chosen |
|----------|------|------|--------|
| VineJS | Type-safe, async | Learning curve | ✅ |
| Manual validation | Full control | More code | ❌ |
| Zod/Yup | Popular | Not native to AdonisJS | ❌ |

---

## Error Handling Strategy

### Problem

Handling errors consistently across the application with proper HTTP status codes and user-friendly messages.

**Challenges:**
- Different error types (validation, authorization, not found)
- Consistent error format
- Proper HTTP status codes
- Security (don't leak sensitive info)

### Solution

Implemented centralized error handling with custom exceptions and consistent error responses.

### Implementation Steps

1. **Exception Handler** (`app/exceptions/handler.ts`):
   - Catches all exceptions
   - Converts to appropriate HTTP responses
   - Logs errors for debugging

2. **Error Patterns in Controllers**:
   ```typescript
   try {
     await ConversationAuthorizationService.ensureParticipant(conversationId, user.id)
     // ... business logic
   } catch (error: any) {
     if (error.message === 'User is not a participant in this conversation') {
       return response.forbidden({ message: 'You are not a participant in this conversation' })
     }
     throw error  // Re-throw unknown errors
   }
   ```

3. **HTTP Status Codes**:
   - `200 OK`: Successful GET/PUT
   - `201 Created`: Successful POST
   - `204 No Content`: Successful DELETE
   - `400 Bad Request`: Validation errors
   - `401 Unauthorized`: Missing/invalid token
   - `403 Forbidden`: Valid token but insufficient permissions
   - `404 Not Found`: Resource doesn't exist

4. **Error Response Format**:
   ```json
   {
     "message": "User-friendly error message"
   }
   ```

### Error Handling Flow

```
Controller Action
  ↓
Try/Catch Block
  ↓
Service/Model Operation
  ↓
Error Thrown?
  ↓ Yes
Catch Block
  ├─ Known Error → Convert to HTTP Response
  └─ Unknown Error → Re-throw
  ↓
Exception Handler
  ↓
HTTP Response with Status Code
```

### Tradeoffs

| Approach | Pros | Cons | Chosen |
|----------|------|------|--------|
| Try/catch in controllers | Explicit | Verbose | ✅ |
| Global exception handler | Less code | Less control | ✅ (for unknown errors) |
| Error classes | Type-safe | More setup | ❌ (future improvement) |

---

## Additional Challenges & Solutions

### Challenge: Guest Token Implementation

**Problem**: Creating temporary guest users without cluttering the database.

**Solution**: 
- Generate unique guest emails (`guest_${timestamp}_${random}@guest.local`)
- Mark tokens with 'guest' type
- Set shorter expiration (7 days)
- Could be improved with cleanup job for expired guest users

### Challenge: Pagination

**Problem**: Loading all messages could be slow for large conversations.

**Solution**:
- Implemented pagination using Lucid's `paginate()` method
- Default: 50 messages per page
- Query parameters: `?page=1&limit=50`

### Challenge: Eager Loading Relationships

**Problem**: N+1 query problem when loading related data.

**Solution**:
- Use `.preload()` to eager load relationships
- Select only needed fields to reduce payload
- Load nested relationships (e.g., message → user, message → replyTo → user)

---

## Future Improvements

1. **Error Classes**: Create custom error classes for better type safety
2. **Caching**: Add Redis caching for frequently accessed data
3. **Rate Limiting**: Implement rate limiting for API endpoints
4. **WebSocket Support**: Add real-time messaging with WebSockets
5. **Message Search**: Implement full-text search for messages
6. **File Attachments**: Support file uploads in messages
7. **Read Receipts**: Track message read status
8. **Guest User Cleanup**: Automated job to remove expired guest users

---

## Lessons Learned

1. **Service Layer Pattern**: Centralizing authorization logic improved maintainability
2. **Explicit Models**: Creating explicit pivot models provides better type safety
3. **Validation First**: Validating input before processing prevents many bugs
4. **Error Handling**: Consistent error handling improves developer experience
5. **Database Design**: Proper foreign keys and constraints prevent data inconsistencies
6. **Middleware Order**: Understanding middleware execution order is crucial

---

**Document Version**: 1.0  
**Last Updated**: 2024

