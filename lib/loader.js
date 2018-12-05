const boom = require('boom')
const Time = require('time-core')()

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

exports.fetchCategory = VALIDATE_AND_LOAD_CATEGORY
exports.fetchEntry = VALIDATE_AND_LOAD_ENTRY
