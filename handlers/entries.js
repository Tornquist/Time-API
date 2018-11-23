const joi = require('joi')
const boom = require('boom')
const Time = require('time-core')()

exports.path = '/entries'

const GET_DESCRIPTION = 'Fetch Entries'

const POST_DESCRIPTION = 'Create New Entries'

const GET_HANDLER = async (request, h) => {
  return boom.notImplemented()
}

const POST_HANDLER = async (request, h) => {
  return boom.notImplemented()
}

const POST_PAYLOAD = joi.object().keys({
  account_id: joi.number().integer().required(),
  name: joi.string().required(),
  parent_id: joi.number().integer()
})

exports.get = {
  description: GET_DESCRIPTION,
  handler: GET_HANDLER
}

exports.post = {
  description: POST_DESCRIPTION,
  handler: POST_HANDLER,
  validate: { payload: POST_PAYLOAD }
}
