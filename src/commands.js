var utils = require('./facade.js');


function mix(privates, fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments);
    return fn.apply(null, privates.concat(args));
  }
};

/**
 * @typedef {object} CommandStructure
 * @property {object} commands
 * @property {object} help
 * @property {function(string, Array<string>, string, string, function)} addCommand
 */
/**
 * @param {function(CommandStructure, string, object):boolean} commandPreCheck
 * If true, will continue to run the command. Run before every command
 * @param {string} prefix Prefix to show for documentation
 * @returns {CommandStructure}
 */
function makeLibrary(commandPreCheck, prefix) {
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
  var methods = {
    addCommand: mix([privates], addCommand),
    defaultHelp: mix([privates], defaultHelp),
    mergeTo: function (library) {
      library._mergeFrom(privates);
    },
    _mergeFrom: function (source) {
      var target = privates;
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
    run: function (name) {
      var args = Array.prototype.slice.call(arguments, 1);
      if (privates.commands.hasOwnProperty(name)) {
        privates.commands[name].apply(null, args);
      }
  
    },
    defaultHelp: function (isStrict, isCombine, name, channel) {
      defaultHelp(privates, isStrict, isCombine, name, channel);
    },
  };

  return methods;
  // return new testing();
}

class testing {
  constructor() {}
  hello() {}

};


/**
 * @param {CommandStructure} CommandStructure
 * @param {object} CommandStructure.tags
 * @param {object} CommandStructure.commands
 * @param {object} CommandStructure.help
 * @param {string} name
 * @param {Array<string>} tagList
 * @param {string} format
 * @param {string} summary
 * @param {string} details
 * @param {Object} permissions
 * @param {function:void} fn
 */
function addCommand(CommandStructure, name,
  tagList, format, summary, details, permissions, fn)
{
  tagList.forEach(function (tag) {
    if (!CommandStructure.tags.hasOwnProperty(tag)) {
      CommandStructure.tags[tag] = [];
    }
    CommandStructure.tags[tag].push(name);
  });

  if (CommandStructure.help.hasOwnProperty(name) ||
      CommandStructure.commands.hasOwnProperty(name)) {
    throw new SyntaxError('addCommand: already has a command named \''
      + name + '\'');
  }
  CommandStructure.help[name] = {
    summary: summary,
    format:  format,
    details: details,
    tags: tagList,
  };
  CommandStructure.commands[name] = function () {
    var commandArgs = Array.prototype.slice.call(arguments);
    var init = CommandStructure.init; // Always run before a command
    // Only continue with execution if init() tests true
    if (init.apply(null, [CommandStructure, name].concat(commandArgs))) {
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

module.exports = makeLibrary;