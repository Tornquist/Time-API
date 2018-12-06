exports.entry = (entry) => ({
  id: entry.id,
  type: entry.type,
  category_id: entry.categoryID,
  started_at: entry.startedAt,
  ended_at: entry.endedAt
})

exports.category = (category) => ({
  id: category.id,
  parent_id: category.parentID,
  account_id: category.accountID,
  name: category.name
})
