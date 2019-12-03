const joi = require('@hapi/joi')
const boom = require('@hapi/boom')
const Time = require('time-core')()

exports.path = '/import'

const POST_DESCRIPTION = 'Import Categories and Entries'
const POST_RESPONSES = {
  '200': {
    'description': 'Success'
  },
  '500': {
    'description': 'Server Error'
  }
}

const POST_HANDLER = async (request, h) => {
  let tree = request.payload

  let userID = request.auth.credentials.user_id
  let importRequest = await Time.Import.loadInto(userID, tree)

  return {
    id: importRequest.id,
    created_at: importRequest.createdAt,
    categories: {
      imported: importRequest.importedCategories,
      expected: importRequest.expectedCategories
    },
    entries: {
      imported: importRequest.importedEntries,
      expected: importRequest.expectedEntries
    },
    complete: importRequest.complete,
    success: importRequest.success
  }
}

exports.post = {
  description: POST_DESCRIPTION,
  plugins: { 'hapi-swagger': { responses: POST_RESPONSES } },
  handler: POST_HANDLER,
  validate: { payload: Time.Import.getRequestSchema() }
}