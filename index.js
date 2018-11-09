'use strict';

require('./server')
.then(server => {
  console.log('Server running at:', server.info.uri)
})
.catch(err => {
  console.log(err)
  process.exit(1);
})
