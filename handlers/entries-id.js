const joi = require('joi')
const boom = require('boom')
const Time = require('time-core')()

exports.path = '/entries/{id}'

const GET_DESCRIPTION = 'Fetch an Entry'
const PUT_DESCRIPTION = 'Update Entries'
const DELETE_DESCRIPTION = 'Remove Entries'

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

const VALIDATE_AND_LOAD_ENTRY = async (userID, entryID) => {
  try {
    let entry = await Time.Entry.fetch(entryID)
    let categoryID = entry.props.category_id

    let category = await VALIDATE_AND_LOAD_CATEGORY(userID, categoryID)

    return entry
  } catch (err) {
    switch (err) {
      case Time.Error.Data.NOT_FOUND:
        throw boom.badRequest()
      default:
        throw err
    }
  }
}

const FORMAT_RETURN = (entry) => ({
  id: entry.id,
  type: entry.type,
  category_id: entry.props.category_id,
  started_at: entry.startedAt,
  ended_at: entry.endedAt
})

const GET_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let entryID = request.params.id
  let entry = await VALIDATE_AND_LOAD_ENTRY(userID, entryID)

  return FORMAT_RETURN(entry)
}

const PUT_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let entryID = request.params.id
  let entry = await VALIDATE_AND_LOAD_ENTRY(userID, entryID)

  if (request.payload.category_id) {
    let categoryID = request.payload.category_id
    let category = await VALIDATE_AND_LOAD_CATEGORY(userID, categoryID)

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
  let entry = await VALIDATE_AND_LOAD_ENTRY(userID, entryID)
  await entry.delete()
  return { success: true }
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
