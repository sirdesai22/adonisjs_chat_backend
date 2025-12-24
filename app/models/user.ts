import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import Message from './message.js'
import Conversation from './conversation.js'
import ConversationParticipant from './conversation_participant.js'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string | null

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => Message, {
    foreignKey: 'userId',
  })
  declare messages: HasMany<typeof Message>

  @hasMany(() => Conversation, {
    foreignKey: 'createdBy',
  })
  declare createdConversations: HasMany<typeof Conversation>

  @hasMany(() => ConversationParticipant, {
    foreignKey: 'userId',
  })
  declare conversationParticipants: HasMany<typeof ConversationParticipant>

  @manyToMany(() => Conversation, {
    pivotTable: 'conversation_participants',
    pivotForeignKey: 'user_id',
    pivotRelatedForeignKey: 'conversation_id',
    relatedKey: 'id',
    localKey: 'id',
  })
  declare conversations: ManyToMany<typeof Conversation>

  static accessTokens = DbAccessTokensProvider.forModel(User)
}