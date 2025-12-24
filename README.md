Goal: Design and implement a production-grade backend service for a multi-room chat application using AdonisJS with TypeScript.
The goal of this assignment is to evaluate your understanding of backend fundamentals, API design, authentication, data modeling, and software engineering best practices.

Tech Stack
Framework: AdonisJS
Language: TypeScript
Database: SQL (PostgreSQL preferred)
Authentication: JWT-based
API Style: REST

Fundamental Requirements

Project Setup
Initialize an AdonisJS backend project using TypeScript, environment-based configuration, proper folder structure, and database migrations.

Authentication & Authorization
User registration and login using email and password
Secure password hashing
JWT-based authentication, refresh tokens
Guest token creation for unauthenticated users.

Conversations
CRUD APIs for conversations with multiple participants. 
Only participants can access or modify a conversation.
Messages
CRUD APIs for messages within conversations. 
Only participants can read/send messages. 
Users can modify only their own messages.

Message Replies
Support replying to a specific message similar to WhatsApp's

Security & Middleware
JWT authentication middleware
Authorization checks, 
Request validation
Proper HTTP status codes
Error handling.
