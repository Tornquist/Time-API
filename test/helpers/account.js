const UUIDv4 = require('uuid/v4')
const querystring = require('querystring')

let storedTime = null;

exports.link = (providedTime) => {
  storedTime = providedTime
}

exports.create = async (userID, Time) => {
  let newAccount = new (storedTime || Time).Account()
  newAccount.register(userID)
  await newAccount.save()

  return newAccount
}

exports.getRootCategory = async (account, Time) => {
  let categories = await (storedTime || Time).Category.findForAccount(account)
  return categories.filter(category => category.name === "root")[0]
}

exports.cleanup = async (account = {}, Time) => {
  await (storedTime || Time)._db('account').where('id', account.id).del()
}
