var utils = require('./src/utils.js');
var discordFacade = require('./src/facade.js');
var library = require('./src/commands.js');
var conditionalLodaer = require('./src/loader.js');

var package = {
  REGEX_SPACE: utils.REGEX_SPACE,
  validateParseCommand: utils.validateParseCommand,
  strictDefaults: utils.strictDefaults,
  massMessage: discordFacade.massMessage,
  makeLibrary: library.makeLibrary,
  PERM_TYPE_USER: library.PERM_TYPE_USER,
  PERM_TYPE_ROLE: library.PERM_TYPE_ROLE,
  PERM_TYPE_PERM: library.PERM_TYPE_PERM,
  conditionalLoader: conditionalLodaer,  
};

module.exports = package;