const UUIDv4 = require('uuid/v4')
const querystring = require('querystring')

let storedTime = null;

const create = async (type, category, closed = true, Time) => {
  let newEntry = new (storedTime || Time).Entry()

  newEntry.type = type
  newEntry.category = category

  newEntry.start()
  if (closed) newEntry.stop()

  await newEntry.save()

  return newEntry
}

exports.link = (providedTime) => {
  storedTime = providedTime
}

exports.createEvent = async (category, Time) => {
  return await create('event', category, false, Time)
}

exports.createRange = async (category, closed = true, Time) => {
  return await create('range', category, closed, Time)
}

exports.create = async (type, category, closed = true, Time) => {
  return await create(type, category, closed, Time)
}
