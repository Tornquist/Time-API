const joi = require('@hapi/joi')
const boom = require('@hapi/boom')
const Time = require('time-core')()

const loader = require('../lib/loader')
const formatter = require('../lib/formatter')

exports.path = '/entries'

const GET_DESCRIPTION = 'Fetch Entries'
const GET_RESPONSES = {
  '200': {
    'description': 'Success',
    'schema': joi.array().items({
      id: joi.number().integer(),
      type: joi.string().valid(...Object.values(Time.Type.Entry)),
      category_id: joi.number().integer(),
      started_at: joi.string().isoDate(),
      started_at_timezone: joi.string(),
      ended_at: joi.string().isoDate(),
      ended_at_timezone: joi.string(),
      deleted: joi.boolean()
    })
  },
  '500': {
    'description': 'Server Error'
  }
}
const GET_NOTES = `
By default returns all entries for all accounts that the authenticated
user has access to.

These results can be filtered using:

* **category_id**: one or many category IDs
* **account_id**: one or many account IDs
* **type**: a single type ('event' or 'range')
* **after**: an iso opening range (inclusive).
* **before**: an iso closing range (exclusive).
* **reference**: Field after and before are compared against.
* **deleted**: boolean including current status. Only included when requested
`

const POST_DESCRIPTION = 'Create New Entries'
const POST_RESPONSES = {
  '200': {
    'description': 'Success',
    'schema': joi.object({
      id: joi.number().integer(),
      type: joi.string().valid(...Object.values(Time.Type.Entry)),
      category_id: joi.number().integer(),
      started_at: joi.string().isoDate(),
      started_at_timezone: joi.string(),
      ended_at: joi.string().isoDate(),
      ended_at_timezone: joi.string()
    })
  },
  '400': { 'description': 'Bad request. ex: Stopping an EVENT' },
  '401': { 'description': 'Unauthorized action' },
  '500': {
    'description': 'Server Error'
  }
}
const POST_NOTES = `
This allows creating entries and closing entries. This is a top-level
endpoint that does not require knowledge of the specific entry that will be modified.

To record a EVENT entry, send just **category_id** with **type**.

To record a RANGE entry, send **category_id**, **type**, and **action**.

The supported actions are 'start', and 'stop'. Start will create a new entry if
one does not exist for the given category. Stop will end the current entry.
Start cannot be used when a open entry exists, and stop cannot be used when
there is no entry to stop.
`

const GET_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let accounts = await Time.Account.findForUser(userID)
  let accountIDs = accounts.map(a => a.id)

  if (request.query.account_id) {
    accountIDs = accountIDs.filter(a => request.query.account_id.includes(a))
  }

  let searchFilters = {
    account_ids: accountIDs,
    category_ids: request.query.category_id,
    type: request.query.type,
    after: request.query.after,
    before: request.query.before,
    reference: request.query.reference,
    deleted: request.query.deleted
  }
  Object.keys(searchFilters).forEach(key => {
    if (!(searchFilters[key])) { delete searchFilters[key] }
  })

  let showDeleted = searchFilters.deleted === true

  let entries = await Time.Entry.findFor(searchFilters)
  let formattedEntries = entries.map(entry => formatter.entry(entry, showDeleted))

  return formattedEntries
}

const GET_QUERY = joi.object().keys({
  category_id: joi.array().items(joi.number().integer()).single(),
  account_id: joi.array().items(joi.number().integer()).single(),
  type: joi.string().valid(...Object.values(Time.Type.Entry)),
  after: joi.string().isoDate(),
  before: joi.string().isoDate(),
  reference: joi.string().valid('start', 'end', 'update').default('start'),
  deleted: joi.boolean()
}).allow(null)

const POST_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let categoryID = request.payload.category_id
  let category = await loader.fetchCategory(userID, categoryID)

  let type = request.payload.type
  let action = request.payload.action
  let timezone = request.payload.timezone

  try {
    let entry;
    if (type === Time.Type.Entry.EVENT) {
      entry = await Time.Entry.logFor(category, timezone)
    } else if (action === START_ACTION) {
      entry = await Time.Entry.startFor(category, timezone)
    } else {
      entry = await Time.Entry.stopFor(category, timezone)
    }

    return formatter.entry(entry)
  } catch (err) {
    switch (err) {
      case Time.Error.Request.INVALID_ACTION:
        throw boom.badRequest("Unable to perform the desired action at this time")
      default:
        throw boom.badImplementation()
    }
  }
}

const START_ACTION = 'start'
const STOP_ACTION = 'stop'
const POST_PAYLOAD = joi.object().keys({
  category_id: joi.number().integer().required(),
  type: joi.string().valid(...Object.values(Time.Type.Entry)),
  action: joi.string().valid(START_ACTION, STOP_ACTION)
    .when('type', {
      is: Time.Type.Entry.RANGE,
      then: joi.required(),
      otherwise: joi.forbidden()
    }),
  timezone: joi.string().regex(/^[a-zA-Z0-9/_\-\+]+$/)
})

exports.get = {
  description: GET_DESCRIPTION,
  notes: GET_NOTES,
  plugins: { 'hapi-swagger': { responses: GET_RESPONSES } },
  handler: GET_HANDLER,
  validate: { query: GET_QUERY }
}

exports.post = {
  description: POST_DESCRIPTION,
  notes: POST_NOTES,
  plugins: { 'hapi-swagger': { responses: POST_RESPONSES } },
  handler: POST_HANDLER,
  validate: { payload: POST_PAYLOAD }
}
