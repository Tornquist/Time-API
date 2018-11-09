'use strict';

const hapi = require('hapi')
const inert = require('inert');
const vision = require('vision');
const hapiSwagger = require('hapi-swagger');
const apiPackage = require('./package');

require('dotenv').config()
require('./lib/sdk').initialize()
const routes = require('./lib/routes')

module.exports = (async () => {
  const port = process.env.SERVER_PORT || process.env.PORT || 8000
  const server = await new hapi.server({ port })

  server.route(routes)

  const swaggerOptions = {
    info: {
      title: 'Time API Documentation',
      version: apiPackage.version
    },
    documentationPath: '/docs'
  }

  await server.register([
    inert,
    vision,
    {
      plugin: hapiSwagger,
      options: swaggerOptions
    }
  ])

  let oauthSchema = require('./lib/auth')
  await oauthSchema.connect(server)

  await server.start();

  return server
})()
