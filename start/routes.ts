/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
const AuthController = () => import('#controllers/auth_controller')
const ConversationController = () => import('#controllers/conversation_controller')

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

// Authentication routes
router.post('/auth/register', [AuthController, 'register'])
router.post('/auth/login', [AuthController, 'login'])
router.post('/auth/refresh', [AuthController, 'refresh']).use('auth')
router.post('/auth/logout', [AuthController, 'logout']).use('auth')
router.post('/auth/guest', [AuthController, 'guest'])

// Conversation routes (all require authentication)
router
  .group(() => {
    router.get('/conversations', [ConversationController, 'index'])
    router.post('/conversations', [ConversationController, 'store'])
    router.get('/conversations/:id', [ConversationController, 'show'])
    router.put('/conversations/:id', [ConversationController, 'update'])
    router.delete('/conversations/:id', [ConversationController, 'destroy'])
    router.post('/conversations/:id/participants', [ConversationController, 'addParticipant'])
    router.delete('/conversations/:id/participants/:userId', [
      ConversationController,
      'removeParticipant',
    ])
  })
  .use('auth')
