const joi = require('@hapi/joi')
const boom = require('@hapi/boom')
const Time = require('time-core')()

const formatter = require('../lib/formatter')

exports.path = '/categories'

const GET_DESCRIPTION = 'Fetch All Categories'
const GET_RESPONSES = {
  '200': {
    'description': 'Success',
    'schema': joi.array().items({
      id: joi.number().integer(),
      parent_id: joi.number().integer(),
      account_id: joi.number().integer(),
      name: joi.string(),
    })
  },
  '500': {
    'description': 'Server Error'
  }
}

const POST_DESCRIPTION = 'Create New Categories'
const POST_RESPONSES = {
  '200': {
    'description': 'Success',
    'schema': joi.object().keys({
      id: joi.number().integer(),
      parent_id: joi.number().integer(),
      account_id: joi.number().integer(),
      name: joi.string(),
    })
  },
  '401': {
    'description': 'Not authorized to create for account or account does not exist'
  },
  '500': {
    'description': 'Server Error'
  }
}

const GET_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let accounts = await Time.Account.findForUser(userID)

  let filterAccountIDs = request.query.account_id
  if (filterAccountIDs)
    accounts = accounts.filter(account => filterAccountIDs.includes(account.id))

  let categoriesForAccounts = await Promise.all(accounts.map(account =>
    Time.Category.findForAccount(account)
  ))

  let categories = categoriesForAccounts.reduce((acc, cur) => acc.concat(cur), [])

  return categories.map(category => formatter.category(category))
}

const GET_QUERY = joi.object().keys({
  account_id: joi.array().items(joi.number().integer()).single()
}).allow(null)

const POST_HANDLER_REQUEST_VALIDATION = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let accounts = await Time.Account.findForUser(userID)

  // Validate if account is available to the current user
  let validAccount = accounts.reduce((acc, cur) => {
    let currentIsTarget = cur.id == request.payload.account_id
    return acc || currentIsTarget
  }, false)
  let hasAccounts = accounts.length > 0
  let allowedToAccess = hasAccounts && validAccount
  if (!allowedToAccess) throw boom.unauthorized()

  // Validate if parent exists
  let parentID = request.payload.parent_id
  if (parentID) {
    let parent = await Time.Category.fetch(parentID).catch(() => null)
    if (!parent) throw boom.badRequest()
  }
}

const POST_HANDLER = async (request, h) => {
  await POST_HANDLER_REQUEST_VALIDATION(request, h)

  let accountID = request.payload.account_id
  let name = request.payload.name
  let parentID = request.payload.parent_id

  let category = new Time.Category({ name, accountID, parentID })

  try {
    await category.save()

    return formatter.category(category)
  } catch (err) {
    switch (err) {
      case Time.Error.Category.INCONSISTENT_PARENT_AND_ACCOUNT:
        throw boom.badRequest('Mismatched Parent and Account IDs')

      // Note: Joi validation and checks above should prevent this.
      case Time.Error.Data.NOT_FOUND:
      case Time.Error.Category.INSUFFICIENT_PARENT_OR_ACCOUNT:
      default:
        throw boom.badImplementation()
    }
  }
}

const POST_PAYLOAD = joi.object().keys({
  account_id: joi.number().integer().required(),
  name: joi.string().required(),
  parent_id: joi.number().integer()
})

exports.get = {
  description: GET_DESCRIPTION,
  plugins: { 'hapi-swagger': { responses: GET_RESPONSES } },
  handler: GET_HANDLER,
  validate: { query: GET_QUERY }
}

exports.post = {
  description: POST_DESCRIPTION,
  plugins: { 'hapi-swagger': { responses: POST_RESPONSES } },
  handler: POST_HANDLER,
  validate: { payload: POST_PAYLOAD }
}
