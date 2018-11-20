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
      name: joi.string(),
    })
  },
  '500': {
    'description': 'Server Error'
  }
}

const GET_HANDLER = async (request, h) => {
  let userID = request.auth.credentials.user_id
  let accounts = await Time.Account.findForUser(userID)
  let categories = await Promise.all(accounts.map(account =>
    Time.Category.findForAccount(account)
  ))

  return categories.map(category => ({
    id: category.id,
    parent_id: category.props.parent_id,
    name: category.name
  }))
}

exports.get = {
  description: GET_DESCRIPTION,
  plugins: { 'hapi-swagger': { responses: GET_RESPONSES } },
  handler: GET_HANDLER
}
