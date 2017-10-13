var utils = require('./facade.js');

/**
 * TODO:
 * make a destroy method
 * unit tests
 */
// @property {function(string, Array<string>, string, string, function)} addCommand

var toExport = {
  PERM_TYPE_USER: 1,
  PERM_TYPE_ROLE: 2,
  PERM_TYPE_PERM: 3,
  PERM_LEVEL_PREVENT: -1,
  PERM_LEVEL_NOACCESS: 0,

  /**
   * @param {function(CommandStructure, string, object):boolean} commandPreCheck
   * If true, will continue to run the command. Run before every command
   * @param {string} prefix Prefix to show for documentation
   * @returns {CommandStructure}
   */
  makeLibrary: function (commandPreCheck, prefix) {
    var preCheck = commandPreCheck == undefined
      ? function () { return true; }
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
        return mixin[key].apply(null, [privates].concat(args));
      };
    });
  
    return library;
  },
};

var mixin = {
  addCommand: addCommand,

  defaultHelp: defaultHelp,

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

  run: function (privates, name) {
    var args = Array.prototype.slice.call(arguments, 2);
    if (privates.commands.hasOwnProperty(name)) {
      privates.commands[name].apply(null, args);
    }

  },
  
  defaultHelp: defaultHelp,

  findPermissionLevel: function (privates, command, author, member) {
    const USER = toExport.PERM_TYPE_USER;
    const ROLE = toExport.PERM_TYPE_ROLE;
    const PERM = toExport.PERM_TYPE_PERM;
    const DEFAULT_LEVEL = 0;
    const parser = function (type, value, level) {
      var t;
      switch (type) {
        case USER: t = value === author.id; break;
        case ROLE: t = member.roles.some(role => value === role.id); break;
        case PERM: t = member.hasPermission(value, false, false, false); break;
        default:   t = false;
      }
      return t ? level : DEFAULT_LEVEL;
    };

    const levels = mixin.fMapPermissions(privates, command, parser);
    // Find the highest permission level, or if ever
    return levels.reduce(function (acc, value) {
      if (acc === -1 || value === -1) { // If disallowed then always false
        return -1;
      } else if (value >= acc) { 
        return value;
      } else {
        return acc;
      }
    }, 0);

  },

  fMapPermissions: function (privates, name, fn) {
    var list = privates.permissions[name];
    var len = list.length;
    var target = new Array(len);
    var elem;
    for (var i = 0; i < len; ++i) {
      elem = list[i];
      target[i] = fn(elem.type, elem.id, elem.level);
    }
    return target;
  },

  fSomePermissions: function (privates, name, fn) {
    var list = privates.permissions[name];
    var len = list.length;
    var elem;
    for (var i = 0; i < len; ++i) {
      elem = list[i];
      if (fn(elem.type, elem.id, elem.level)) {
        return true;
      }
    }
    return false;
  }, 
};

/**
 * @param {string} name command
 * @param {Array<string>} tagList list of labels for organizing help
 * @param {string} format 
 * @param {string} summary
 * @param {string} details
 * @param {Object} permissions
 * @param {function:void} fn
 */
function addCommand(library, name, tagList,
    format, summary, details, permissions, fn)
{
  tagList.forEach(function (tag) {
    if (!library.tags.hasOwnProperty(tag)) {
      library.tags[tag] = [];
    }
    library.tags[tag].push(name);
  });

  if (library.help.hasOwnProperty(name) ||
      library.commands.hasOwnProperty(name)) {
    throw new SyntaxError('addCommand: already has a command named \''
      + name + '\'');
  }
  library.help[name] = {
    summary: summary,
    format:  format,
    details: details,
    tags: tagList,
  };
  library.permissions[name] = permissions;

  library.commands[name] = function () {
    var commandArgs = Array.prototype.slice.call(arguments);
    var init = library.init; // Always run before a command
    // Only continue with execution if init() tests true
    if (init.apply(null, [library, name].concat(commandArgs))) {
      fn.apply(null, commandArgs);
    }
  };
}

/**
 * Prints help information. If a valid command name is passed to {name}, it
 * will display the prefix, command, format, and the detailed information
 * for that command. If no valid command is passed it'll display the general
 * help information.
 * 
 * General help lists all the commands and their associated sumamries by
 * grouping them into categories specified by {CommandStructure.tags}. Since
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
 * 
 * @param {CommandStructure} CommandStructure Made by setupCommands, but
 * nothing particularly special about it other than it tags, commands, and
 * help as properties which this will search
 * @param {object} CommandStructure.tags 
 * @param {object} CommandStructure.commands
 * @param {object} CommandStructure.help
 * @param {boolean} isStrict True if print a command only once for the first
 * category it is in. False if it prints for every category it is part of
 * @param {boolean} isCombine evaluate all combinations of
 * categories. 
 * @param {string} name Name of the command, you may want to .tolowerCase this
 * If the command is not on the list it displays a not found message.
 * @param {object} channel the channel to send to
 * @returns {Promise} normal output
 */
function defaultHelp(CommandStructure, isStrict, isCombine, name, channel) {
  var commandName = String(name);
  var helpStruct = CommandStructure.help;
  var prefix = CommandStructure.prefix;
  var strList = [];

  if (helpStruct.hasOwnProperty(commandName)) {
    strList.push('**' + prefix + commandName + '**' +
      helpStruct[commandName].format + '\n' + helpStruct[commandName].details);
  } else if (commandName !== '') {
    strList.push('The command **' + prefix + commandName + '** is unavailable.');
    strList.push('Try typing **' + prefix + 'help** instead');
  } else {
    var tagStruct = CommandStructure.tags;
    var isAvailable = {}; // For deleting used commands
    var indexedTags = {};
    var headers = {};
    var sortedTags = Object.keys(tagStruct).sort();
    var tagKeys, tagValues; // Keys = tag clusters, values = commands

    Object.keys(helpStruct).forEach(function (command) {
      isAvailable[command] = true;  // Populate {commandList}
    });

    if (isCombine) { // List by all combinations of tags
      // Invert {sortedTags}. {indexedTags} is the index of SortedTags
      sortedTags.forEach(function (tag, i) { indexedTags[tag] = i; });
      
      // Adds all unordered combinations of tags to {headers}
      Object.keys(helpStruct).forEach(function (command) { // Populate {headers}
        var key = ''; // The key of {headers}
        // Each time {str} grows, add a new entry
        helpStruct[command].tags
          .map(function (tag) { return indexedTags[tag]; })
          .sort(function (a, b) { return a - b; }) // Least to greatest
          .forEach(function (tag) {
            key += '.' + tag; // Grow key
            if (!headers.hasOwnProperty(key)) { headers[key] = []; }
            headers[key].push(command);
          });
      });

      tagKeys = [];
      tagValues = {};
      Object.keys(headers) // Populate tagStruct
        .sort(function (a, b) { // Longest first, then alphabetically
          var difference = b.split('.').length - a.split('.').length;
          return difference === 0 ? a > b : difference;
        }).forEach(function (combination) {
          var list = combination.substr(1).split('.')
            .map(function (index) { return sortedTags[index]; });
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
      tagValues = CommandStructure.tags;
    }
    
    // Display from {tagKeys} and {tagValues}
    tagKeys.forEach(function (tag) {
      // If commandList still has one of the commands
      var values = tagValues[tag];
      if (values.some(function (x) { return isAvailable[x]; })) {
        strList.push('__' + tag + '__\n');
        values.forEach(function (command) {
          if (isAvailable[command]) {
            strList.push('**' + prefix + command + '** - ' +
              helpStruct[command].summary + '\n');
          }
          // Remove since already displayed
          if (isStrict) { delete isAvailable[command]; }
        });
        strList.push('\n');
      }
    });
  }
  utils.massMessage(strList, channel);
}

module.exports = toExport;