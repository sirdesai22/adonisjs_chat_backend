import type { HttpContext } from '@adonisjs/core/http'
import Message from '#models/message'
import Conversation from '#models/conversation'
import ConversationAuthorizationService from '#services/conversation_authorization_service'
import { createMessageValidator, updateMessageValidator } from '#validators/message_validator'

export default class MessageController {
  async index({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = params.id

    try {
      // Ensure user is a participant
      await ConversationAuthorizationService.ensureParticipant(conversationId, user.id)

      // Pagination
      const page = request.input('page', 1)
      const limit = request.input('limit', 50)

      const messages = await Message.query()
        .where('conversation_id', conversationId)
        .preload('user', (query) => {
          query.select('id', 'email', 'fullName')
        })
        .preload('replyTo', (query) => {
          query.select('id', 'content', 'user_id')
          query.preload('user', (query) => {
            query.select('id', 'email', 'fullName')
          })
        })
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      return response.ok(messages)
    } catch (error: any) {
      if (error.message === 'User is not a participant in this conversation') {
        return response.forbidden({ message: 'You are not a participant in this conversation' })
      }
      throw error
    }
  }

  async store({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = params.id
    const payload = await request.validateUsing(createMessageValidator)

    try {
      // Ensure user is a participant
      await ConversationAuthorizationService.ensureParticipant(conversationId, user.id)

      // If replying to a message, verify it exists and is in the same conversation
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

      const message = await Message.create({
        conversationId,
        userId: user.id,
        content: payload.content,
        replyToId: payload.replyToId || null,
      })

      // Load relationships
      await message.load('user', (query) => {
        query.select('id', 'email', 'fullName')
      })
      if (message.replyToId) {
        await message.load('replyTo', (query) => {
          query.select('id', 'content', 'user_id')
          query.preload('user', (query) => {
            query.select('id', 'email', 'fullName')
          })
        })
      }

      return response.created(message)
    } catch (error: any) {
      if (error.message === 'User is not a participant in this conversation') {
        return response.forbidden({ message: 'You are not a participant in this conversation' })
      }
      throw error
    }
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const messageId = params.id

    const message = await Message.find(messageId)
    if (!message) {
      return response.notFound({ message: 'Message not found' })
    }

    try {
      // Ensure user is a participant in the conversation
      await ConversationAuthorizationService.ensureParticipant(message.conversationId, user.id)

      await message.load('user', (query) => {
        query.select('id', 'email', 'fullName')
      })
      await message.load('conversation', (query) => {
        query.select('id', 'name')
      })
      if (message.replyToId) {
        await message.load('replyTo', (query) => {
          query.select('id', 'content', 'user_id')
          query.preload('user', (query) => {
            query.select('id', 'email', 'fullName')
          })
        })
      }

      return response.ok(message)
    } catch (error: any) {
      if (error.message === 'User is not a participant in this conversation') {
        return response.forbidden({ message: 'You are not a participant in this conversation' })
      }
      throw error
    }
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const messageId = params.id
    const payload = await request.validateUsing(updateMessageValidator)

    const message = await Message.find(messageId)
    if (!message) {
      return response.notFound({ message: 'Message not found' })
    }

    // Check ownership
    if (message.userId !== user.id) {
      return response.forbidden({ message: 'You can only edit your own messages' })
    }

    message.content = payload.content
    message.editedAt = new Date()
    await message.save()

    await message.load('user', (query) => {
      query.select('id', 'email', 'fullName')
    })
    if (message.replyToId) {
      await message.load('replyTo', (query) => {
        query.select('id', 'content', 'user_id')
        query.preload('user', (query) => {
          query.select('id', 'email', 'fullName')
        })
      })
    }

    return response.ok(message)
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const messageId = params.id

    const message = await Message.find(messageId)
    if (!message) {
      return response.notFound({ message: 'Message not found' })
    }

    // Check ownership
    if (message.userId !== user.id) {
      return response.forbidden({ message: 'You can only delete your own messages' })
    }

    await message.delete()

    return response.noContent()
  }
}

