import vine from '@vinejs/vine'

export const createConversationValidator = vine.compile(
  vine.object({
    name: vine.string().optional(),
    description: vine.string().optional(),
    participantIds: vine.array(vine.number()).minLength(1),
  })
)

export const updateConversationValidator = vine.compile(
  vine.object({
    name: vine.string().optional(),
    description: vine.string().optional(),
  })
)

export const addParticipantValidator = vine.compile(
  vine.object({
    userId: vine.number(),
  })
)

