var utils = require('./src/utils.js');
var discordFacade = require('./src/facade.js');
var commandLibrary = require('./src/monad.js');
var conditionalLodaer = require('./src/loader.js');

var package = {
  REGEX_SPACE: utils.REGEX_SPACE,
  validateParseCommand: utils.validateParseCommand,
  strictDefaults: utils.strictDefaults,
  massMessage: discordFacade.massMessage,
  setupCommands: commandLibrary.setupCommands,
  // setupCommands: commandLibrary.setupCommands,
  // addCommand: commandLibrary.addCommand,
  // defaultHelp: commandLibrary.defaultHelp,
  conditionalLoader: conditionalLodaer,  
};

module.exports = package;