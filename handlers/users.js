const joi = require('joi')
const boom = require('boom')
const Time = require('time-core')()

exports.path = '/users'

const POST_DESCRIPTION = 'User Creation'
const POST_NOTES = 'This page allows new login accounts to be created.'
const POST_RESPONSES = {
  '200': {
    'description': 'Success',
    'schema': joi.object({
      id: joi.number().integer()
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

const POST_HANDLER = async (request, h) => {
  try {
    let user = new Time.User()
    user.email = request.payload.email
    await user.setPassword(request.payload.password)
    await user.save()
    return { id: user.id }
  } catch (err) {
    switch (err) {
      case Time.Error.Data.INCORRECT_FORMAT:
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

exports.post = {
  description: POST_DESCRIPTION,
  notes: POST_NOTES,
  auth: false,
  plugins: { 'hapi-swagger': { responses: POST_RESPONSES } },
  handler: POST_HANDLER,
  validate: {
    payload: POST_PAYLOAD
  }
}
