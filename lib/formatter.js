exports.entry = (entry, includeDeleted = false) => {
  let response = {
    id: entry.id,
    type: entry.type,
    category_id: entry.categoryID,
    started_at: entry.startedAt,
    started_at_timezone: entry.startedAtTimezone,
    ended_at: entry.endedAt,
    ended_at_timezone: entry.endedAtTimezone,
  }

  if (includeDeleted) {
    response.deleted = entry.deleted
  }
  
  return response
}

exports.category = (category) => ({
  id: category.id,
  parent_id: category.parentID,
  account_id: category.accountID,
  name: category.name
})
