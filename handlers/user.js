const joi = require('joi')
const boom = require('boom')
const Time = require('time-core')()

exports.path = '/users'

exports.post = {
  description: `User Creation`,
  auth: false,
  handler: async (request, h) => {
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
  },
  validate: {
    payload: {
      email: joi.string().email().required(),
      password: joi.string().required()
    }
  }
}
