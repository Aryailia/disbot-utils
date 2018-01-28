var utils = require('./src/utils.js');
var discordFacade = require('./src/facade.js');
var library = require('./src/commands.js');
var conditionalLodaer = require('./src/loader.js');

var package = {
  'pseudodiscord.js': require('./psuedodiscord'),
  
  REGEX_SPACE: utils.REGEX_SPACE,
  validateParseCommand: utils.validateParseCommand,
  strictDefaults: utils.strictDefaults,
  massMessage: discordFacade.massMessage,
  conditionalLoader: conditionalLodaer,  
  
  makeLibrary: library.makeLibrary,
  defaultHelp: library.defaultHelp,
  findPermissionLevel: library.findPermissionLevel,
  PERM_TYPE_USER: library.PERM_TYPE_USER,
  PERM_TYPE_ROLE: library.PERM_TYPE_ROLE,
  PERM_TYPE_PERM: library.PERM_TYPE_PERM,
  PERM_LEVEL_DENY: library.PERM_LEVEL_DENY,
  PERM_LEVEL_NEUTRAL: library.PERM_LEVEL_NEUTRAL,
};


module.exports = package;