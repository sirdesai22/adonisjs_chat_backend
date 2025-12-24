import Conversation from '#models/conversation'
import ConversationParticipant from '#models/conversation_participant'
// import type { User } from '#models/user'

export default class ConversationAuthorizationService {
  /**
   * Check if user is a participant in the conversation
   */
  static async isParticipant(conversationId: number, userId: number): Promise<boolean> {
    const participant = await ConversationParticipant.query()
      .where('conversation_id', conversationId)
      .where('user_id', userId)
      .first()

    return !!participant
  }

  /**
   * Check if user is the creator of the conversation
   */
  static async isCreator(conversationId: number, userId: number): Promise<boolean> {
    const conversation = await Conversation.find(conversationId)
    return conversation?.createdBy === userId
  }

  /**
   * Ensure user is a participant, throw error if not
   */
  static async ensureParticipant(conversationId: number, userId: number): Promise<void> {
    const isParticipant = await this.isParticipant(conversationId, userId)
    if (!isParticipant) {
      throw new Error('User is not a participant in this conversation')
    }
  }

  /**
   * Ensure user is the creator, throw error if not
   */
  static async ensureCreator(conversationId: number, userId: number): Promise<void> {
    const isCreator = await this.isCreator(conversationId, userId)
    if (!isCreator) {
      throw new Error('User is not the creator of this conversation')
    }
  }

  /**
   * Get conversation with participant check
   */
  static async getConversationForUser(
    conversationId: number,
    userId: number
  ): Promise<Conversation> {
    const conversation = await Conversation.find(conversationId)
    if (!conversation) {
      throw new Error('Conversation not found')
    }

    await this.ensureParticipant(conversationId, userId)
    return conversation
  }
}

