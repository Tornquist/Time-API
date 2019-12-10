const joi = require('@hapi/joi')
const boom = require('@hapi/boom')
const Time = require('time-core')()

const loader = require('../lib/loader')
const formatter = require('../lib/formatter')

exports.path = '/import'

const GENERAL_RESPONSE = joi.object({
  id: joi.number().integer(),
  created_at: joi.string().isoDate(),
  updated_at: joi.string().isoDate(),
  categories: joi.object({
    imported: joi.number().integer().required(),
    expected: joi.number().integer().required()
  }).required(),
  entries: joi.object({
    imported: joi.number().integer().required(),
    expected: joi.number().integer().required()
  }).required(),
  complete: joi.boolean().required(),
  success: joi.boolean().required()
})

const POST_DESCRIPTION = 'Create a new Import Request'
const POST_RESPONSES = {
  '200': {
    'description': 'Success',
    'schema': GENERAL_RESPONSE
  },
  '400': { 'description': 'Bad request' },
  '500': { 'description': 'Server Error' }
}

const POST_HANDLER = async (request, h) => {
  let tree = request.payload
  let userID = request.auth.credentials.user_id
  let importRequest = null;

  try {
    importRequest = await Time.Import.loadInto(userID, tree)  
  } catch (err) {
    switch (err) {
      case Time.Error.Data.INCORRECT_FORMAT:
        throw boom.badRequest('Invalid input format')
      default:
        throw boom.badImplementation()
    }
  }

  return formatter.import(importRequest)
}

exports.post = {
  description: POST_DESCRIPTION,
  plugins: { 'hapi-swagger': { responses: POST_RESPONSES } },
  handler: POST_HANDLER,
  validate: { payload: Time.Import.getRequestSchema() }
}