var utils = require('./src/utils.js');
var discordFacade = require('./src/facade.js');
var commandLibrary = require('./src/commands.js');
var conditionalLodaer = require('./src/loader.js');

var package = {
  REGEX_SPACE: utils.REGEX_SPACE,
  validateParseCommand: utils.validateParseCommand,
  strictDefaults: utils.strictDefaults,
  massMessage: discordFacade.massMessage,
  makeLibrary: commandLibrary,
  conditionalLoader: conditionalLodaer,  
};

module.exports = package;