const UUIDv4 = require('uuid/v4')
const querystring = require('querystring')

let storedTime = null;

exports.link = (providedTime) => {
  storedTime = providedTime
}

exports.create = async (name, account = null, parent = null, Time) => {
  let newCategory = new (storedTime || Time).Category()

  newCategory.name = name
  if (account) newCategory.account = account
  if (parent) newCategory.parent = parent

  await newCategory.save()

  return newCategory
}
