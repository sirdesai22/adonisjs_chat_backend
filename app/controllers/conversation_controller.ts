import type { HttpContext } from '@adonisjs/core/http'
import Conversation from '#models/conversation'
import ConversationParticipant from '#models/conversation_participant'
import User from '#models/user'
import ConversationAuthorizationService from '#services/conversation_authorization_service'
import {
  createConversationValidator,
  updateConversationValidator,
  addParticipantValidator,
} from '#validators/conversation_validator'
import { DateTime } from 'luxon'

export default class ConversationController {
  async index({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const conversations = await Conversation.query()
      .whereHas('participants', (query) => {
        query.where('user_id', user.id)
      })
      .preload('creator', (query) => {
        query.select('id', 'email', 'fullName')
      })
      .preload('participants', (query) => {
        query.preload('user', (query) => {
          query.select('id', 'email', 'fullName')
        })
      })
      .orderBy('created_at', 'desc')

    return response.ok(conversations)
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(createConversationValidator)

    // Create conversation
    const conversation = await Conversation.create({
      name: payload.name,
      description: payload.description,
      createdBy: user.id,
    })

    // Add creator as participant
    await ConversationParticipant.create({
      conversationId: conversation.id,
      userId: user.id,
      joinedAt: DateTime.now(),
    })

    // Add other participants
    const participantIds = payload.participantIds.filter((id) => id !== user.id)
    if (participantIds.length > 0) {
      // Verify all participant IDs exist
      const users = await User.query().whereIn('id', participantIds)
      if (users.length !== participantIds.length) {
        return response.badRequest({ message: 'One or more participant IDs are invalid' })
      }

      await ConversationParticipant.createMany(
        participantIds.map((userId) => ({
          conversationId: conversation.id,
          userId,
          joinedAt: DateTime.now(),
        }))
      )
    }

    // Load relationships
    await conversation.load('creator', (query) => {
      query.select('id', 'email', 'fullName')
    })
    await conversation.load('participants', (query) => {
      query.preload('user', (query) => {
        query.select('id', 'email', 'fullName')
      })
    })

    return response.created(conversation)
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = params.id

    try {
      const conversation = await ConversationAuthorizationService.getConversationForUser(
        conversationId,
        user.id
      )

      await conversation.load('creator', (query) => {
        query.select('id', 'email', 'fullName')
      })
      await conversation.load('participants', (query) => {
        query.preload('user', (query) => {
          query.select('id', 'email', 'fullName')
        })
      })

      return response.ok(conversation)
    } catch (error: any) {
      if (error.message === 'Conversation not found') {
        return response.notFound({ message: 'Conversation not found' })
      }
      if (error.message === 'User is not a participant in this conversation') {
        return response.forbidden({ message: 'You are not a participant in this conversation' })
      }
      throw error
    }
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = params.id
    const payload = await request.validateUsing(updateConversationValidator)

    try {
      await ConversationAuthorizationService.ensureCreator(conversationId, user.id)

      const conversation = await Conversation.findOrFail(conversationId)
      conversation.merge(payload)
      await conversation.save()

      await conversation.load('creator', (query) => {
        query.select('id', 'email', 'fullName')
      })
      await conversation.load('participants', (query) => {
        query.preload('user', (query) => {
          query.select('id', 'email', 'fullName')
        })
      })

      return response.ok(conversation)
    } catch (error: any) {
      if (error.message === 'User is not the creator of this conversation') {
        return response.forbidden({ message: 'Only the creator can update this conversation' })
      }
      throw error
    }
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = params.id

    try {
      await ConversationAuthorizationService.ensureCreator(conversationId, user.id)

      const conversation = await Conversation.findOrFail(conversationId)
      await conversation.delete()

      return response.noContent()
    } catch (error: any) {
      if (error.message === 'User is not the creator of this conversation') {
        return response.forbidden({ message: 'Only the creator can delete this conversation' })
      }
      throw error
    }
  }

  async addParticipant({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = params.id
    const { userId } = await request.validateUsing(addParticipantValidator)

    try {
      await ConversationAuthorizationService.ensureParticipant(conversationId, user.id)

      // Check if user is already a participant
      const existingParticipant = await ConversationParticipant.query()
        .where('conversation_id', conversationId)
        .where('user_id', userId)
        .first()

      if (existingParticipant) {
        return response.badRequest({ message: 'User is already a participant' })
      }

      // Verify user exists
      const targetUser = await User.find(userId)
      if (!targetUser) {
        return response.notFound({ message: 'User not found' })
      }

      await ConversationParticipant.create({
        conversationId,
        userId,
        joinedAt: DateTime.now(),
      })

      return response.ok({ message: 'Participant added successfully' })
    } catch (error: any) {
      if (error.message === 'User is not a participant in this conversation') {
        return response.forbidden({ message: 'You are not a participant in this conversation' })
      }
      throw error
    }
  }

  async removeParticipant({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = params.id
    const userId = params.userId

    try {
      await ConversationAuthorizationService.ensureParticipant(conversationId, user.id)

      const participant = await ConversationParticipant.query()
        .where('conversation_id', conversationId)
        .where('user_id', userId)
        .first()

      if (!participant) {
        return response.notFound({ message: 'Participant not found' })
      }

      await participant.delete()

      return response.ok({ message: 'Participant removed successfully' })
    } catch (error: any) {
      if (error.message === 'User is not a participant in this conversation') {
        return response.forbidden({ message: 'You are not a participant in this conversation' })
      }
      throw error
    }
  }
}

