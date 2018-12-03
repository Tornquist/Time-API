const joi = require('joi')
const boom = require('boom')
const Time = require('time-core')()

exports.path = '/entries'

const GET_DESCRIPTION = 'Fetch Entries'

const POST_DESCRIPTION = 'Create New Entries'
const START_ACTION = 'start'
const STOP_ACTION = 'stop'

const GET_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let accounts = await Time.Account.findForUser(userID)
  let accountIDs = accounts.map(a => a.id)

  let searchFilters = {}

  if (request.query.account_id) {
    accountIDs = accountIDs.filter(a => request.query.account_id.includes(a))
  }
  searchFilters.account_ids = accountIDs

  if (request.query.category_id) {
    searchFilters.category_ids = request.query.category_id
  }

  if (request.query.type) {
    searchFilters.type = request.query.type
  }

  let entries = await Time.Entry.findFor(searchFilters)
  let formattedEntries = entries.map(entry => ({
    id: entry.id,
    type: entry.type,
    category_id: entry.props.category_id,
    started_at: entry.startedAt,
    ended_at: entry.endedAt
  }))

  return formattedEntries
}

const GET_QUERY = joi.object().keys({
  category_id: joi.array().items(joi.number().integer()).single(),
  account_id: joi.array().items(joi.number().integer()).single(),
  type: joi.string().valid(Object.values(Time.Type.Entry))
}).allow(null)

const VALIDATE_AND_LOAD_CATEGORY = async (userID, categoryID) => {
  const UNAUTHORIZED = new Error("Unauthorized")
  try {
    let category = await Time.Category.fetch(categoryID)
    let accountID = category.account_id

    let account = await Time.Account.fetch(accountID)

    let userAuthorized = account.userIDs.includes(userID)
    if (!userAuthorized) throw UNAUTHORIZED

    return category
  } catch (err) {
    switch (err) {
      case UNAUTHORIZED:
        throw boom.unauthorized()
      case Time.Error.Data.NOT_FOUND:
        throw boom.badRequest()
      default:
        throw boom.badImplementation()
    }
  }
}

const POST_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let categoryID = request.payload.category_id
  let category = await VALIDATE_AND_LOAD_CATEGORY(userID, categoryID)

  let type = request.payload.type
  let action = request.payload.action

  try {
    let entry;
    if (type === Time.Type.Entry.EVENT) {
      entry = await Time.Entry.logFor(category)
    } else if (action === START_ACTION) {
      entry = await Time.Entry.startFor(category)
    } else {
      entry = await Time.Entry.stopFor(category)
    }

    return {
      id: entry.id,
      type: entry.type,
      category_id: entry.props.category_id,
      started_at: entry.startedAt,
      ended_at: entry.endedAt
    }
  } catch (err) {
    switch (err) {
      case Time.Error.Request.INVALID_ACTION:
        throw boom.badRequest("Unable to perform the desired action at this time")
      default:
        throw boom.badImplementation()
    }
  }
}

const POST_PAYLOAD = joi.object().keys({
  category_id: joi.number().integer().required(),
  type: joi.string().valid(Object.values(Time.Type.Entry)),
  action: joi.string().valid(START_ACTION, STOP_ACTION)
    .when('type', {
      is: Time.Type.Entry.RANGE,
      then: joi.required(),
      otherwise: joi.forbidden()
    })
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
