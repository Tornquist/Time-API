const joi = require('joi')
const boom = require('boom')
const Time = require('time-core')()

exports.path = '/accounts'

const GET_DESCRIPTION = 'Fetch Accounts'
const GET_RESPONSES = {
  '200': {
    'description': 'Success',
    'schema': joi.array().items({
      id: joi.number().integer().required(),
      user_ids: joi.array().items(joi.number().integer()).required()
    })
  },
  '500': {
    'description': 'Server Error'
  }
}

const POST_DESCRIPTION = 'Create Account'
const POST_RESPONSES = {
  '200': {
    'description': 'Success',
    'schema': joi.object({
      id: joi.number().integer().required(),
      user_ids: joi.array().items(joi.number().integer()).required()
    })
  },
  '500': {
    'description': 'Server Error'
  }
}

const GET_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let accounts = await Time.Account.findForUser(userID)

  return accounts.map(account => ({
    id: account.id,
    user_ids: this.props.userIDs
  }))
}

const POST_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id

  let account = new Time.Account()
  account.register(userID)

  await account.save()

  return {
    id: account.id,
    user_ids: account.props.userIDs
  }
}

exports.get = {
  description: GET_DESCRIPTION,
  plugins: { 'hapi-swagger': { responses: GET_RESPONSES } },
  handler: (request, h) => GET_HANDLER
}

exports.post = {
  description: POST_DESCRIPTION,
  plugins: { 'hapi-swagger': { responses: POST_RESPONSES } },
  handler: (request, h) => POST_HANDLER
}
