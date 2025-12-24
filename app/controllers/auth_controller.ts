import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { registerValidator, loginValidator } from '#validators/auth_validator'

export default class AuthController {
  async register({ request, response }: HttpContext) {
    const payload = await request.validateUsing(registerValidator)
    const user = await User.create(payload)
    const token = await User.accessTokens.create(user)

    return response.created({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      token: token.value!.release(),
    })
  }

  async login({ request, response, auth }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    const user = await User.verifyCredentials(email, password)
    const token = await User.accessTokens.create(user)

    return response.ok({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      token: token.value!.release(),
    })
  }

  async refresh({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const currentToken = auth.user!.currentAccessToken

    // Create new token
    const newToken = await User.accessTokens.create(user)

    // Optionally revoke old token
    if (currentToken) {
      await User.accessTokens.delete(user, currentToken.identifier)
    }

    return response.ok({
      token: newToken.value!.release(),
    })
  }

  async logout({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const token = auth.user!.currentAccessToken

    if (token) {
      await User.accessTokens.delete(user, token.identifier)
    }

    return response.noContent()
  }

  async guest({ response }: HttpContext) {
    // Create a temporary guest user or use a special guest token mechanism
    // For simplicity, we'll create a guest user with a random email
    // In production, you might want a different approach
    const guestEmail = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}@guest.local`
    const guestUser = await User.create({
      email: guestEmail,
      password: Math.random().toString(36).substring(15),
      fullName: 'Guest User',
    })

    const token = await User.accessTokens.create(guestUser, ['guest'], {
      expiresIn: '7d',
    })

    return response.created({
      token: token.value!.release(),
      expiresAt: token.expiresAt,
    })
  }
}

