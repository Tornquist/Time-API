const joi = require('@hapi/joi')
const boom = require('@hapi/boom')
const Time = require('time-core')()

exports.path = '/users'

const POST_DESCRIPTION = 'User Registration'
const POST_NOTES = 'This page allows new login accounts to be created.'

const POST_RESPONSES = {
  '200': {
    'description': 'Success',
    'schema': joi.object({
      id: joi.number().integer(),
      email: joi.string().email()
    })
  },
  '400': {
    'description': 'Invalid email or password format.'
  },
  '409': {
    'description': 'Duplicate email. Account already exists.'
  },
  '500': {
    'description': 'Server Error. Fallback for all other issues.'
  }
}

const PUT_DESCRIPTION = 'User Updates'
const PUT_NOTES = 'This page allows login accounts to be updated.'
const PUT_RESPONSES = Object.assign({}, POST_RESPONSES, {
  '401': {
    'description': 'Unauthorized'
  }
})

const HANDLER = async (request, h) => {
  if (
    request.params.id &&
    request.params.id !== request.auth.credentials.user_id
  ) {
    return boom.unauthorized()
  }

  try {
    let user = await (request.params.id !== undefined
      ? Time.User.fetch(request.params.id)
      : new Time.User()
    )

    if (request.payload.email)
      user.email = request.payload.email

    if (request.payload.password)
      await user.setPassword(request.payload.password)

    if (request.payload.new_password) {
      await user.verify(request.payload.old_password)
      await user.setPassword(request.payload.new_password)
    }

    await user.save()
    return { id: user.id, email: user.email }

  } catch (err) {
    switch (err) {
      case Time.Error.Data.INCORRECT_FORMAT:
      case Time.Error.Authentication.INVALID_PASSWORD:
        return boom.badRequest()
      default:
        let duplicate = err.message.includes('ER_DUP_ENTRY')
        if (duplicate)
          return boom.conflict()
        return boom.badImplementation()
    }
  }
}

const POST_PAYLOAD = joi.object().keys({
  email: joi.string().email().required(),
  password: joi.string().required()
})

const PUT_PAYLOAD = joi.object().keys({
  email: joi.string().email(),
  new_password: joi.string(),
  old_password: joi.string()
})
.or('email', 'new_password')
.and('new_password', 'old_password')

exports.post = {
  description: POST_DESCRIPTION,
  notes: POST_NOTES,
  auth: false,
  plugins: { 'hapi-swagger': { responses: POST_RESPONSES } },
  handler: HANDLER,
  validate: {
    payload: POST_PAYLOAD
  }
}

exports.put = {
  path: '/{id}',
  description: PUT_DESCRIPTION,
  notes: PUT_NOTES,
  plugins: { 'hapi-swagger': { responses: PUT_RESPONSES } },
  handler: HANDLER,
  validate: {
    payload: PUT_PAYLOAD,
    params: joi.object({ id: joi.number().integer().required() })
  }
}
