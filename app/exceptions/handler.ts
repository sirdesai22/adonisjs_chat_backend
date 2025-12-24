import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { errors as vineErrors } from '@vinejs/vine'
import { errors as authErrors } from '@adonisjs/auth'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    // Handle VineJS validation errors
    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      return ctx.response.status(422).json({
        message: 'Validation failed',
        errors: error.messages,
      })
    }

    // Handle authentication errors
    if (error instanceof authErrors.E_UNAUTHORIZED_ACCESS) {
      return ctx.response.status(401).json({
        message: 'Unauthorized access',
      })
    }

    // Handle model not found errors
    if (error.code === 'E_ROW_NOT_FOUND') {
      return ctx.response.status(404).json({
        message: 'Resource not found',
      })
    }

    // Handle custom error messages
    if (error instanceof Error) {
      // Check for common error patterns
      if (error.message.includes('not found')) {
        return ctx.response.status(404).json({
          message: error.message,
        })
      }

      if (error.message.includes('not a participant') || error.message.includes('not the creator')) {
        return ctx.response.status(403).json({
          message: error.message,
        })
      }

      if (error.message.includes('can only')) {
        return ctx.response.status(403).json({
          message: error.message,
        })
      }
    }

    // Default error handling
    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
