const joi = require('joi')
const boom = require('boom')
const Time = require('time-core')()

const loader = require('../lib/loader')
const formatter = require('../lib/formatter')

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
      started_at_timezone: joi.string(),
      ended_at: joi.string().isoDate(),
      ended_at_timezone: joi.string()
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

const GET_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let entryID = request.params.id
  let entry = await loader.fetchEntry(userID, entryID)

  return formatter.entry(entry)
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

  let safeSet = (source, dest) => {
    if (request.payload[source]) {
      try {
        entry[dest] = request.payload[source]
      } catch (err) {
        throw (err === Time.Error.Request.INVALID_STATE)
          ? boom.badRequest()
          : boom.badImplementation()
      }
    }
  }

  safeSet('type', 'type')
  safeSet('started_at', 'startedAt')
  safeSet('started_at_timezone', 'startedAtTimezone')
  safeSet('ended_at', 'endedAt')
  safeSet('ended_at_timezone', 'endedAtTimezone')

  await entry.save()

  return formatter.entry(entry)
}

const PUT_PAYLOAD = joi.object().keys({
  category_id: joi.number().integer(),
  type: joi.string().valid(Object.values(Time.Type.Entry)),
  started_at: joi.string().isoDate(),
  started_at_timezone: joi.string().regex(/^[a-zA-Z0-9/_\-\+]+$/),
  ended_at: joi.string().isoDate()
    .when('type', {
      is: Time.Type.Entry.EVENT,
      then: joi.forbidden()
    }),
  ended_at_timezone: joi.string().regex(/^[a-zA-Z0-9/_\-\+]+$/)
    .when('type', {
      is: Time.Type.Entry.EVENT,
      then: joi.forbidden()
    })
}).or('category_id', 'type', 'started_at', 'started_at_timezone', 'ended_at', 'ended_at_timezone')

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
