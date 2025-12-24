import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import Message from './message.js'
import ConversationParticipant from './conversation_participant.js'

export default class Conversation extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string | null

  @column()
  declare description: string | null

  @column()
  declare createdBy: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User, {
    foreignKey: 'createdBy',
  })
  declare creator: BelongsTo<typeof User>

  @hasMany(() => Message, {
    foreignKey: 'conversationId',
  })
  declare messages: HasMany<typeof Message>

  @hasMany(() => ConversationParticipant, {
    foreignKey: 'conversationId',
  })
  declare participants: HasMany<typeof ConversationParticipant>

  @manyToMany(() => User, {
    pivotTable: 'conversation_participants',
    pivotForeignKey: 'conversation_id',
    pivotRelatedForeignKey: 'user_id',
    relatedKey: 'id',
    localKey: 'id',
  })
  declare users: ManyToMany<typeof User>
}

