const joi = require('joi')
const boom = require('boom')
const Time = require('time-core')()

exports.path = '/entries/{id}'

const GET_DESCRIPTION = 'Fetch an Entry'
const PUT_DESCRIPTION = 'Update Entries'
const DELETE_DESCRIPTION = 'Remove Entries'

const VALIDATE_AND_LOAD_ENTRY = async (userID, entryID) => {
  const UNAUTHORIZED = new Error("Unauthorized")
  try {
    let entry = await Time.Entry.fetch(entryID)
    let categoryID = entry.props.category_id

    let category = await Time.Category.fetch(categoryID)
    let accountID = category.account_id

    let account = await Time.Account.fetch(accountID)

    let userAuthorized = account.userIDs.includes(userID)
    if (!userAuthorized) throw UNAUTHORIZED

    return entry
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

const GET_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let entryID = request.params.id
  let entry = await VALIDATE_AND_LOAD_ENTRY(userID, entryID)

  return {
    id: entry.id,
    type: entry.type,
    category_id: entry.props.category_id,
    started_at: entry.props.started_at,
    ended_at: entry.props.ended_at
  }
}

const PUT_HANDLER = async (request, h) => {
  return boom.notImplemented()
}

const PUT_PAYLOAD = joi.object().keys({
  account_id: joi.number().integer().required(),
  name: joi.string().required(),
  parent_id: joi.number().integer()
})

const DELETE_HANDLER = async (request, h) => {
  return boom.notImplemented()
}

exports.get = {
  description: GET_DESCRIPTION,
  validate: {
    params: { id: joi.number().integer() }
  },
  handler: GET_HANDLER
}

exports.put = {
  description: PUT_DESCRIPTION,
  validate: {
    params: { id: joi.number().integer() },
    payload: PUT_PAYLOAD
  },
  handler: PUT_HANDLER
}

exports.delete = {
  description: DELETE_DESCRIPTION,
  validate: {
    params: { id: joi.number().integer() }
  },
  handler: DELETE_HANDLER
}
