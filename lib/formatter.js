exports.entry = (entry) => ({
  id: entry.id,
  type: entry.type,
  category_id: entry.category_id,
  started_at: entry.startedAt,
  ended_at: entry.endedAt
})

exports.category = (category) => ({
  id: category.id,
  parent_id: category.parent_id,
  account_id: category.account_id,
  name: category.name
})
