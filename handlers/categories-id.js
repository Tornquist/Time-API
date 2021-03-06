const joi = require('@hapi/joi')
const boom = require('@hapi/boom')
const Time = require('time-core')()

const formatter = require('../lib/formatter')

exports.path = '/categories/{id}'

const GET_DESCRIPTION = 'Fetch a Category'
const GENERAL_RESPONSES = {
  '200': {
    'description': 'Success',
    'schema': joi.object().keys({
      id: joi.number().integer(),
      parent_id: joi.number().integer(),
      account_id: joi.number().integer(),
      name: joi.string(),
    })
  },
  '400': {
    'description': 'Bad request. Invalid user input'
  },
  '401': {
    'description': 'Unauthorized. Resources are not available to user.'
  },
  '500': {
    'description': 'Server Error'
  }
}

const PUT_DESCRIPTION = 'Update a Category'
const DELETE_DESCRIPTION = 'Delete a Category'
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

const VALIDATE_ACCOUNT = async (accountID, userID) => {
  let account = await Time.Account.fetch(accountID)
  let authorized = account.userIDs.includes(userID)
  if (!authorized) throw boom.unauthorized()
}

const HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let categoryID = request.params.id
  let category = await Time.Category.fetch(categoryID).catch(() => { throw boom.notFound() })

  await VALIDATE_ACCOUNT(category.accountID, userID)

  switch (request.method) {
    case 'get':
      return formatter.category(category)
    case 'put':
      let validatedPayload = await VALIDATE_PUT(userID, request.payload)
      return await HANDLE_PUT(category, validatedPayload)
    case 'delete':
      return HANDLE_DELETE(category, request.payload)
    default:
      return boom.badImplementation()
  }
}

const VALIDATE_PUT = async (userID, payload) => {
  let validatedPayload = Object.assign({}, payload)

  if (payload.account_id)
    await VALIDATE_ACCOUNT(payload.account_id, userID)

  if (payload.parent_id) {
    let parent = await Time.Category.fetch(payload.parent_id)
    await VALIDATE_ACCOUNT(parent.accountID, userID)

    // Avoid pulling data twice
    validatedPayload.parent = parent
  }

  return validatedPayload
}

const HANDLE_PUT = async (category, payload) => {
  if (payload.name) category.name = payload.name
  if (payload.account_id) category.account = payload.account_id
  if (payload.parent) category.parent = payload.parent

  try {
    await category.save()
  } catch (err) {
    switch (err) {
      case Time.Error.Category.INCONSISTENT_PARENT_AND_ACCOUNT:
        throw boom.badRequest('Mismatched Parent and Account IDs')
      default:
        throw boom.badImplementation()
    }
  }

  return formatter.category(category)
}

const HANDLE_DELETE = async (category, payload) => {
  let deleteChildren = (payload || {}).delete_children || false
  await category.delete(deleteChildren)
  return { success: true }
}

const PUT_PAYLOAD = joi.object().keys({
  account_id: joi.number().integer(),
  name: joi.string(),
  parent_id: joi.number().integer()
}).or('account_id', 'name', 'parent_id')

const DELETE_PAYLOAD = joi.object().keys({
  delete_children: joi.boolean()
}).allow(null)

exports.get = {
  description: GET_DESCRIPTION,
  validate: {
    params: joi.object({ id: joi.number().integer() })
  },
  plugins: { 'hapi-swagger': { responses: GENERAL_RESPONSES } },
  handler: HANDLER
}

exports.put = {
  description: PUT_DESCRIPTION,
  validate: {
    params: joi.object({ id: joi.number().integer() }),
    payload: PUT_PAYLOAD
  },
  plugins: { 'hapi-swagger': { responses: GENERAL_RESPONSES } },
  handler: HANDLER
}

exports.delete = {
  description: DELETE_DESCRIPTION,
  validate: {
    params: joi.object({ id: joi.number().integer() }),
    payload: DELETE_PAYLOAD
  },
  plugins: { 'hapi-swagger': { responses: DELETE_RESPONSES } },
  handler: HANDLER
}
