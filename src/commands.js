var utils = require('./facade.js');

/**
 * TODO:
 * make a destroy method
 * unit tests
 * make all type, id, and level for permissions necessary, throw syntax error
 * figure out how to do jsdoc options for Permission.type typdef
 * fill out CommandLibrary definition?
 */

var PERM_LEVEL_DENY = -1;
var PERM_LEVEL_NEUTRAL = 0;
var DEFAULT_LEVEL = PERM_LEVEL_NEUTRAL;

/**
 * Need to add more but not sure if worth doing so
 * @typedef {object} CommandLibrary
 * @property {object} commands
 * @property {object} help
 * @property {function(string, Array<string>, string, string, function)} addCommand
 */

/**
 * @typedef {object} Permission
 * @property {string} type  See the PERM_TYPE stuff
 * @property {string} value The value to check user's eligibilty
 * @property {number} level The permission level assigned, see PERM_LEVEL stuff
 */


var toExport = {
  PERM_TYPE_USER: 1,
  PERM_TYPE_ROLE: 2,
  PERM_TYPE_PERM: 3,
  PERM_LEVEL_DENY: PERM_LEVEL_DENY,
  PERM_LEVEL_NEUTRAL: PERM_LEVEL_NEUTRAL,
  
  defaultHelp: makeHelp,
  findPermissionLevel: findPermLevel,

  /**
   * Returns an object with all the methods of {mixin} (have to see source)
   * 
   * @param {function(CommandLibrary, string, object):boolean} commandPreCheck
   * If true, will continue to run the command. Run before every command
   * @param {string} prefix Prefix to show for documentation
   * 
   * @returns {CommandLibrary}
   */
  makeLibrary: function (commandPreCheck, prefix) {
    var preCheck = commandPreCheck == undefined
      ? function () { return(true); }
      : commandPreCheck;
  
    var privates = {
      prefix: prefix == undefined ? '' : prefix,
      tags: {},
      commands: {},
      help: {},
      permissions: {},
      init: preCheck,
    };
  
    // Mix in methods of library
    var library = Object.create(null);
    Object.keys(mixin).forEach(function (key) {
      library[key] = function () {
        var args = Array.prototype.slice.call(arguments);
        return(mixin[key].apply(null, [privates].concat(args)));
      };
    });
  
    return(library);
  },
};


var mixin = {
  /**
   * Adds a command to the library
   * 
   * @param {string} name command
   * @param {Array<string>} tagList list of labels for organizing help
   * @param {string} format 
   * @param {string} summary
   * @param {string} details
   * @param {Array<Permission>} permissions An array of applicable permissions
   * @param {function:void} fn
   */
  addCommand: function (
      state, name, tagList, format, summary, details, permissions, fn)
  {
    // Throw error if command already has
    if (state.help.hasOwnProperty(name) ||
        state.commands.hasOwnProperty(name))
    {
      throw new SyntaxError(
        'addCommand: already has a command named \'' + name + '\'');
    }

    state.help[name] = {
      summary: summary,
      format:  format,
      details: details,
      tags: tagList,
    };
    state.permissions[name] = permissions;

    state.commands[name] = function () {
      var commandArgs = Array.prototype.slice.call(arguments);
      var init = state.init; // Always run before a command
      // Only continue with execution if init() tests true
      if (init.apply(null, [state, name].concat(commandArgs))) {
        fn.apply(null, commandArgs);
      }
    };
  },

  mergeTo: function (privates, library) {
    library._mergeFrom(privates);
  },

  _mergeFrom: function (target, source) {
    Object.keys(source.commands).forEach(function (key) {
      if (target.commands.hasOwnProperty(name)) {
        throw new SyntaxError('merge: Command conflict \'' + name + '\'');
      } else {
        target.tags[key] = source.tags[key];
        target.commands[key] = source.commands[key];
        target.help[key] = source.help[key];
      }
    });
  },

  /**
   * Runs a command with name
   * @param {Object} state Private hash of variables that are appended on mix
   * @param {string} name Command to execute
   */
  run: function (state, name) {
    var args = Array.prototype.slice.call(arguments, 2); // Skip first two param
    if (state.commands.hasOwnProperty(name)) {
      state.commands[name].apply(null, args);
    }

  },
  
  defaultHelp: function (state, channel, author, member, commandName,
      strict, combine)
  {
    var permHash = state.permissions;
    var helpHash = state.help;

    // Filter any commands that {author}/{member} has no access to 
    // Copy {helpHash} since deleting keys
    var help = {};
    Object.keys(state.help).forEach(function (command) {
      if (findPermLevel(permHash[command], author, member) > 0) {
        help[command] = helpHash[command];
      }
    });

    utils.massMessage(makeHelp(help, state.prefix, permHash, commandName,
      strict, combine), channel);
  },

  findPermissionLevel: function (state, command, author, member) {
    return(findPermLevel(state.permissions[command], author, member));
  },

  fMapPermissions: function (privates, name, fn) {
    var list = privates.permissions[name];
    var len = list.length;
    var target = new Array(len);
    var elem;
    for (var i = 0; i < len; ++i) {
      elem = list[i];
      target[i] = fn(elem.type, elem.value, elem.level);
    }
    return(target);
  },

  fSomePermissions: function (privates, name, fn) {
    var list = privates.permissions[name];
    var len = list.length;
    var elem;
    for (var i = 0; i < len; ++i) {
      elem = list[i];
      if (fn(elem.type, elem.value, elem.level)) {
        return(true);
      }
    }
    return(false);
  }, 
};

/**
 * Finds the highest level permission with {permissionsArray} for a user
 * specified by {author} and {member}. Denial of permission takes precedence
 * over all permission levels.
 * 
 * The default level if the user isn't found to meet any of the conditions
 * in {permissionsArray} is given by {DEFAULT_LEVEL} in this file.
 * @param {Array<Object<string, any, number>>} permissionsArray
 * @param {Discord.User} author
 * @param {Discord.GuildMember} member 
 */
function findPermLevel(permissionsArray, author, member) {
  var USER = toExport.PERM_TYPE_USER;
  var ROLE = toExport.PERM_TYPE_ROLE;
  var PERM = toExport.PERM_TYPE_PERM;

  // Convert {permissionsArray} to number for whether the user, indicated by
  // {author} and {member} meets that requirement. {DEFAULT_LEVEL} by default
  var levels = permissionsArray.map(function (entry) {
    // The structure of {entry} (of {permissionsArray}) may change in the
    // future, so pulling out the variables now for easy modifying
    var type = entry.type;
    var value = entry.value;
    var level = entry.level;

    var t; // set boolean {t} depending on switch on {type}
    switch (type) {
      case USER: t = value === author.id; break;
      case ROLE: t = (member == null)
        ? false // {member} is null When in private messages
        : member.roles.some(function (role) { return(value === role.id); });
      break;
      case PERM: t = member.hasPermission(value, false, false, false); break;
      default:   t = false;
    }
    return(t ? level : DEFAULT_LEVEL);
  });

  // Find max permission, but {PERM_LEVEL_DENY} takes priority 
  return levels.reduce(function (acc, value) {
    if (acc === PERM_LEVEL_DENY || value === PERM_LEVEL_DENY) { 
      return(PERM_LEVEL_DENY);
    } else if (value >= acc) {
      return(value);
    } else {
      return(acc);
    }
  }, 0);
}

/**
 * Prints help information. If a valid command name is passed to {name}, it
 * will display the prefix, command, format, and the detailed information
 * for that command. If no valid command is passed it'll display the general
 * help information.
 * 
 * General help lists all the commands and their associated sumamries by
 * grouping them into categories specified by {CommandLibrary.tags}. Since
 * commands can have multiple tags, if {isStrict} is set to false, this will
 * display the command for each tag it is labelled under.
 * {isPrintCombinations} enumerates all the combinations of tags rather than
 * just listing them one by one. (So N choose 1 to N to use probability speak
 * for all present combinations.) These are arranged by most tags first, then
 * alphabetically.
 * 
 * Also note, everything is case sensitive.
 * 
 * @example
 * command1 has tags ['Tag A', 'Tag B']
 * command2 has tags ['Tag A']
 * command3 had tags ['Tag B']
 * 
 * @example (isStrict = true, isPrintCombinations = true) =>
 * Tag A, Tag B
 * command1
 * 
 * Tag A
 * command2
 * 
 * Tag B
 * command3
 * 
 * @example (isStrict = false, isPrintCombinations = true) =>
 * Tag A, Tag B
 * command1
 * command2
 * 
 * Tag A
 * command1
 * command2
 * 
 * Tag B
 * command1
 * command3
 * 
 * @example (isStrict = true, isPrintCombinations = false) =>
 * Tag A
 * command1
 * command2
 * 
 * Tag B
 * command3
 * 
 * @example (isStrict = false, isPrintCombinations = false) =>
 * Tag A
 * command1
 * command2
 * 
 * Tag B
 * command1
 * command3
 *  
 * @param {object} channel the channel to send to
 * @param {Discord.Member} author authorId of message for permissions
 * @param {Discord.GuildMember} member {author}'s GuildMember object for perms
 * @param {string} cmdName Name of the command, you may want to .tolowerCase
 * If the command is not on the list it displays a not found message.
 * @param {boolean} strict True if print a command only once for the first
 * category it is in. False if it prints for every category it is part of
 * @param {boolean} combine evaluate all combinations of
 * categories. 
 * @param {Object} help help for all commands, see makeLibrary() 
 * @param {string} prefix {author}'s guildmember's object
 * @param {Array<Object>} permHash permissions info for all commands
 * @returns {Promise} normal output
 */
function makeHelp(help, prefix, permHash, cmdName, strict, combine) {
  // Three different types of help displays
  var strList; // Set strList with if statement
  if (help.hasOwnProperty(cmdName)) { // Specific command, details
    strList = ['**' + prefix + cmdName + '**' +
      help[cmdName].format + '\n' + help[cmdName].details];
    
  } else if (cmdName !== '') { // Specified
    strList = [
      'The command **' + prefix + cmdName + '** is unavailable.',
      'Try typing **' + prefix + 'help** instead'
    ];
    
  } else { // All commands
    strList = allHelpStr(cmdName, strict, combine, help, prefix, permHash); 
  }
  return strList;
}

function allHelpStr(cmdName, strict, combine, help, prefix, permissionHash) {
  // Variable declerations
  var strList = [];
  var commandByTag = {}; // Reverse indexing of helper[*].tags
  Object.keys(help).forEach(function (command) { // Populate {commandByTag}
    help[command].tags.forEach(function (tag) {
      (!commandByTag.hasOwnProperty(tag)) // Add command under {tag}-category
        ? commandByTag[tag] = [command]
        : commandByTag[tag].push(command);
    });
  });
  var sortedTags = Object.keys(commandByTag).sort(); // Alphabetical order


  // Set {tagKeys} and {tagValues} with if statement
  var tagKeys, tagValues; // Keys = tag clusters, values = commands
  if (combine) { // List by all combinations of tags
    tagKeys = [];
    tagValues = {};
    var indexedTags = {}; // ??
    var headers = {}; // ??

    // Invert {sortedTags}. {indexedTags} is the index of SortedTags
    sortedTags.forEach(function (tag, i) { indexedTags[tag] = i; });
    
    // Adds all unordered combinations of tags to {headers}
    Object.keys(help).forEach(function (command) { // Populate {headers}
      var key = ''; // The key of {headers}
      // Each time {str} grows, add a new entry
      help[command].tags
        .map(function (tag) { return(indexedTags[tag]); })
        .sort(function (a, b) { return(a - b); }) // Least to greatest
        .forEach(function (tag) {
          key += '.' + tag; // Grow key
          if (!headers.hasOwnProperty(key)) { headers[key] = []; }
          headers[key].push(command);
        });
    });

    // Populate {tagKeys} and {tagValues}
    Object.keys(headers) // Populate tagStruct
      .sort(function (a, b) { // Longest first, then alphabetically
        var difference = b.split('.').length - a.split('.').length;
        return(difference === 0 ? a > b : difference);
      }).forEach(function (combination) {
        var list = combination.substr(1).split('.')
          .map(function (index) { return(sortedTags[index]); });
        var expandedTag = list.join(', '); // Just join them version
        
        // Serial comma version
        //var last = list.pop();
        //var expandedTag = (list.join(', ') +
        //  (list.length > 1 ?  ',' : '') + // Serial comma
        //  (list.length > 0 ? ' and ' : '') +
        //  last);

        tagKeys.push(expandedTag);
        tagValues[expandedTag] = headers[combination];
      });
  } else { // Or just list by tags sorted alphabetically
    tagKeys = sortedTags;
    tagValues = commandByTag;
  }
  
  // Display from {tagKeys} and {tagValues}
  tagKeys.forEach(function (tag) {
    // If commandList still has one of the commands
    var values = tagValues[tag];
    if (values.some(function (x) { return(help.hasOwnProperty(x)); })) {
      strList.push('__' + tag + '__\n');
      values.forEach(function (command) {
        if (help.hasOwnProperty(command)) {
          strList.push('**' + prefix + command + '** - ' +
            help[command].summary + '\n');
        }
        // Remove since already displayed
        if (strict) { delete help[command]; }
      });
      strList.push('\n');
    }
  });
  return strList;
}

module.exports = toExport;