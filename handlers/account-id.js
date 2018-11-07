const joi = require('joi')
const boom = require('boom')
const sdk = require('time-core')()

exports.path = '/account/{id}'

exports.get = {
  validate: {
    params: {
      id: joi.number().integer()
    }
  },
  handler: (request, h) =>
    sdk.Account.fetch(request.params.id)
      .then(account => account.props)
      .catch(err => err === sdk.Error.Data.NOT_FOUND
        ? boom.notFound()
        : boom.badImplementation()
      )
}
