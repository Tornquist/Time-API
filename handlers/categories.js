const joi = require('joi')
const boom = require('boom')
const Time = require('time-core')()

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
  let categoriesForAccounts = await Promise.all(accounts.map(account =>
    Time.Category.findForAccount(account)
  ))

  let categories = categoriesForAccounts.reduce((acc, cur) => acc.concat(cur), [])

  return categories.map(category => ({
    id: category.id,
    parent_id: category.props.parent_id,
    account_id: category.props.account_id,
    name: category.name
  }))
}

const POST_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let accounts = await Time.Account.findForUser(userID)

  let validAccount = accounts.reduce((acc, cur) => {
    let currentIsTarget = cur.id == request.payload.account_id
    return acc || currentIsTarget
  }, false)
  let hasAccounts = accounts.length > 0
  let allowedToAccess = hasAccounts && validAccount
  if (!allowedToAccess) throw boom.unauthorized()

  let account_id = request.payload.account_id
  let name = request.payload.name
  let parentID = request.payload.parent_id

  let category = new Time.Category({ name, account_id })

  if (parentID) {
    let parent = await Time.Category.fetch(parentID).catch(() => null)
    if (!parent) throw boom.badRequest()

    category.parent = parent
  }

  try {
    await category.save()

    return {
      id: category.id,
      parent_id: category.props.parent_id,
      account_id: category.props.account_id,
      name: category.name
    }
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
  handler: GET_HANDLER
}

exports.post = {
  description: POST_DESCRIPTION,
  plugins: { 'hapi-swagger': { responses: POST_RESPONSES } },
  handler: POST_HANDLER,
  validate: { payload: POST_PAYLOAD }
}
