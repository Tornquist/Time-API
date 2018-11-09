const joi = require('joi')
let apiPackage = require('../package.json')
let version = apiPackage.version

exports.path = '/'

exports.get = {
  description: `Status page.`,
  notes: 'This page will return the API status and version.',
  auth: false,
  plugins: {
    'hapi-swagger': {
      responses: {
        '200': {
          'description': 'Success',
          'schema': joi.object({
            status: joi.string().required(),
            version: joi.string().required()
          })
        }
      }
    }
  },
  handler: (request, h) => {
    return { status: 'ok', version }
  }
}
