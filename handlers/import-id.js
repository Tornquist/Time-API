const joi = require('@hapi/joi')
const boom = require('@hapi/boom')
const Time = require('time-core')()

const loader = require('../lib/loader')
const formatter = require('../lib/formatter')

exports.path = '/import/{id}'

const GET_DESCRIPTION = 'Fetch an Import Request'
const GET_RESPONSES = {
  '200': {
    'description': 'Success',
    'schema': joi.object({
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
  },
  '400': { 'description': 'Bad request' },
  '401': { 'description': 'Unauthorized action' },
  '404': { 'description': 'Unable to find requested object' },
  '500': { 'description': 'Server Error' }
}

const GET_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let importID = request.params.id
  let importRequest = await loader.fetchImport(userID, importID)

  return formatter.import(importRequest)
}

exports.get = {
  description: GET_DESCRIPTION,
  plugins: { 'hapi-swagger': { responses: GET_RESPONSES } },
  handler: GET_HANDLER,
  validate: { params: joi.object({ id: joi.number().integer().required() }) }
}