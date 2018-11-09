var storedServer = null;

module.exports = async () => {
  if (storedServer === null) {
    storedServer = await require(process.env.PWD + '/server')
  }

  return storedServer;
};
