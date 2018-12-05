const joi = require('joi')
const boom = require('boom')
const Time = require('time-core')()

const loader = require('../lib/loader')

exports.path = '/entries/{id}'

const GET_DESCRIPTION = 'Fetch an Entry'
const PUT_DESCRIPTION = 'Update an Entry'
const GENERAL_RESPONSES = {
  '200': {
    'description': 'Success',
    'schema': joi.object({
      id: joi.number().integer(),
      type: joi.string().valid(Object.values(Time.Type.Entry)),
      category_id: joi.number().integer(),
      started_at: joi.string().isoDate(),
      ended_at: joi.string().isoDate()
    })
  },
  '400': { 'description': 'Bad request' },
  '401': { 'description': 'Unauthorized action' },
  '404': { 'description': 'Unable to find requested object' },
  '500': { 'description': 'Server Error' }
}

const DELETE_DESCRIPTION = 'Remove an Entry'
const DELETE_RESPONSES = {
  '200': {
    'description': 'Success',
    'schema': joi.object().keys({
      success: joi.boolean()
    })
  },
  '500': {
    'description': 'Server Error'
  }
}

const FORMAT_RETURN = (entry) => ({
  id: entry.id,
  type: entry.type,
  category_id: entry.category_id,
  started_at: entry.startedAt,
  ended_at: entry.endedAt
})

const GET_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let entryID = request.params.id
  let entry = await loader.fetchEntry(userID, entryID)

  return FORMAT_RETURN(entry)
}

const PUT_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let entryID = request.params.id
  let entry = await loader.fetchEntry(userID, entryID)

  if (request.payload.category_id) {
    let categoryID = request.payload.category_id
    let category = await loader.fetchCategory(userID, categoryID)

    entry.category = category
  }

  if (request.payload.type) {
    entry.type = request.payload.type
  }

  if (request.payload.started_at) {
    entry.startedAt = request.payload.started_at
  }

  if (request.payload.ended_at) {
    try {
      entry.endedAt = request.payload.ended_at
    } catch (err) {
      throw (err === Time.Error.Request.INVALID_STATE)
        ? boom.badRequest()
        : boom.badImplementation()
    }
  }

  await entry.save()

  return FORMAT_RETURN(entry)
}

const PUT_PAYLOAD = joi.object().keys({
  category_id: joi.number().integer(),
  type: joi.string().valid(Object.values(Time.Type.Entry)),
  started_at: joi.string().isoDate(),
  ended_at: joi.string().isoDate()
    .when('type', {
      is: Time.Type.Entry.EVENT,
      then: joi.forbidden()
    })
}).or('category_id', 'type', 'started_at', 'ended_at')

const DELETE_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let entryID = request.params.id
  let entry = await loader.fetchEntry(userID, entryID)
  await entry.delete()
  return { success: true }
}

exports.get = {
  description: GET_DESCRIPTION,
  validate: {
    params: { id: joi.number().integer() }
  },
  plugins: { 'hapi-swagger': { responses: GENERAL_RESPONSES } },
  handler: GET_HANDLER
}

exports.put = {
  description: PUT_DESCRIPTION,
  validate: {
    params: { id: joi.number().integer() },
    payload: PUT_PAYLOAD
  },
  plugins: { 'hapi-swagger': { responses: GENERAL_RESPONSES } },
  handler: PUT_HANDLER
}

exports.delete = {
  description: DELETE_DESCRIPTION,
  validate: {
    params: { id: joi.number().integer() }
  },
  plugins: { 'hapi-swagger': { responses: DELETE_RESPONSES } },
  handler: DELETE_HANDLER
}
