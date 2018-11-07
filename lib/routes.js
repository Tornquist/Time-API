const requireDir = require('require-dir')
const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options']

const handlers = Object.values(requireDir('../handlers'))
const validHandlers = handlers.filter(handler => handler.path !== undefined)

const groupedRoutes = validHandlers.map(handler =>
  httpMethods.map(method => {
    if (!(method in handler)) { return null }
    return {
      method: method.toUpperCase(),
      path: handler.path,
      config: handler[method]
    }
  }).filter(x => !!x)
)

const routes = [].concat.apply([], groupedRoutes)

module.exports = routes
