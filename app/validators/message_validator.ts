import vine from '@vinejs/vine'

export const createMessageValidator = vine.compile(
  vine.object({
    content: vine.string().trim().minLength(1),
    replyToId: vine.number().optional(),
  })
)

export const updateMessageValidator = vine.compile(
  vine.object({
    content: vine.string().trim().minLength(1),
  })
)

