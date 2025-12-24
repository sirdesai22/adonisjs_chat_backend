import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import Conversation from './conversation.js'

export default class Message extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare conversationId: number

  @column()
  declare userId: number

  @column()
  declare content: string

  @column()
  declare replyToId: number | null

  @column.dateTime()
  declare editedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Conversation, {
    foreignKey: 'conversationId',
  })
  declare conversation: BelongsTo<typeof Conversation>

  @belongsTo(() => User, {
    foreignKey: 'userId',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Message, {
    foreignKey: 'replyToId',
  })
  declare replyTo: BelongsTo<typeof Message>

  @hasMany(() => Message, {
    foreignKey: 'replyToId',
  })
  declare replies: HasMany<typeof Message>
}

