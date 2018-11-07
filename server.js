'use strict';

const hapi = require('hapi')
require('dotenv').config()

const port = process.env.SERVER_PORT || process.env.PORT || 8000
const server = hapi.server({ port })

server.route({
  method:'GET',
  path:'/',
  handler: (request, h) => {
    return { status: 'ok' }
  }
});

(async () => {
  try {
    await server.start();
  }
  catch (err) {
    console.log(err);
    process.exit(1);
  }

  console.log('Server running at:', server.info.uri);
})()
