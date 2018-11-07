'use strict';

const hapi = require('hapi')
require('dotenv').config()

const port = process.env.SERVER_PORT || process.env.PORT || 8000
const server = hapi.server({ port })

require('./lib/sdk').initialize()

const routes = require('./lib/routes')
server.route(routes)

;(async () => {
  try {
    await server.start();
  }
  catch (err) {
    console.log(err);
    process.exit(1);
  }

  console.log('Server running at:', server.info.uri)
})()
