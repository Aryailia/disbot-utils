var nodePath = require('path');
var SPACE = '[' + [
  ' ', // U+0020, regular space
  '\t', // Tab
  '\u3000', // Ideographic space, aka. full-width space
].join('') + ']';
var DISCORD_MESSAGE_LIMIT = 2000;

var utils = {
  /**
   * Default command format for bots
   * @param {string} prefix Regex for the command prefix
   * @param {string} [separator] Regex for separator between command and
   * parameter, uses a choice between a few types of spaces as default
   * @returns {regex}
   */
  checkCommandFormat: function (prefix, separator) {
    if (typeof seperator == 'undefined') {
      separator = SPACE;
    }
    return new RegExp('^'+prefix+'(\\S+)(?:'+separator+'*([\\S\\s]+))?$');
  },
  strictDefaults: strictDefaults,
  massMessage: massMessage,
  setupCommands: setupCommands,
  addCommand: addCommand,
  defaultHelp: defaultHelp,
  conditionalLoader: conditionalLoader,
};


/**
 * Set defaults values for keys that can be copied over by the provided
 * {overwrites} object. Will only copy the keys defined by {possiblities}
 * and will issue an error.
 * 
 * Note: Mutates {overwrites} by deleting used entries and places in return
 * Note: Shallow copies any objects in either {overwrites}
 * 
 * ({a: '', b: ['!']}, {a: 5}) => {a: 5, b: ['!']}
 * // Array for .b is different refernce from outline
 * ({a: '', b: ['!']}, {c: 5}) => SyntaxError
 * 
 * 
 * @param {object} outlineDefaults The structure outline and defaults
 * @param {object} overwrites The values to overwrite with
 * @returns {object}
 */
function strictDefaults(defaults, toSet) {
  var obj = defaults.constructor();
  Object.keys(defaults).forEach(function (key) {
    obj[key] = typeof defaults[key] === 'object'
      ? defaults[key].constructor() : defaults[key];
  });
  Object.keys(toSet).forEach(function (key) {
    if (obj.hasOwnProperty(key)) {
      obj[key] = toSet[key];
    } else {
      throw new Error('strictDefaults() - \'' + key +
        '\' is not a valid property for {toSet}');
    }
  });
  return obj;
}

/**
 * Outputs lists of messages with the a buffer limit in mind. Prioritizes
 * that individual elements of messageList be kept together, then
 * prioritizes that each of those elments be seperated across newlines
 * if the limit is exceeded. Otherwise combines as many messages as will
 * fit within the buffer limit.
 * 
 * Buffer size limit provided by {DISCORD_MESSAGE_LIMIT}
 * 
 * @param {Array<string>} messageList Output
 * @param {TextChannel} channel Channel with send method, has to be channel
 * otherwise will run into problems with the channel calling {this}
 */
function massMessage(messageList, channel) {
  if (typeof messageList !== 'object' || !messageList.hasOwnProperty('length')) {
    throw new SyntaxError('massMessage: expects an Array for {messageList}');
  }
  messageList
    // Breakup any entries along their any newlies
    .reduce(function (list, x) { 
      var lines = x.split('\n');
      var last = lines.pop(); // Dd not add any newlines not already present
      var cons = lines.map(function (x) { return x + '\n'; });
      return list.concat(cons).concat([last]);
    }, [])
    // Combine what will fit into a limit
    .reduce(function (lines, text) {
      var last = lines[lines.length - 1];
      if (last.size <= DISCORD_MESSAGE_LIMIT) {
        last.buffer.push(text);
        last.size += text.length;
      } else {
        lines.push({ size: text.length, buffer: [text] });
      }
      return lines;
    }, [{ size: 0, buffer: []}])
    // Flatten from array of buffers to array
    .reduce(function (list, obj) {
      list.push(obj.buffer.join('')); // also join buffer into string
      return list;
    }, [])
    // Display
    .forEach(function (message) {
      var index = 0;
      var length = message.length;
      while (index < length) { // Not guarenteed to be under limit still
        channel.send(message.substr(index, DISCORD_MESSAGE_LIMIT));
        index += DISCORD_MESSAGE_LIMIT;
      }
    });
}


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
function setupCommands(commandPreCheck, prefix) {
  var setup = commandPreCheck == undefined
    ? function () { return true; }
    : commandPreCheck;
  var CommandStructure = {
    prefix: prefix == undefined ? '' : prefix,
    tags: {},
    commands: {},
    help: {},
    addCommand: function (name) {
      var setupArgs = Array.prototype.slice.call(arguments);
      var fn = setupArgs.pop();
      setupArgs[setupArgs.length] = function () {
        var commandArgs = Array.prototype.slice.call(arguments);
        if (setup.apply(null, [CommandStructure, name].concat(commandArgs))) {
          fn.apply(null, commandArgs);
        }
      };
      utils.addCommand.apply(null, [CommandStructure].concat(setupArgs));
    },
  };
  return CommandStructure;
}

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
 * @param {function:void} fn
 */
function addCommand(CommandStructure, name, tagList, format, summary, details, fn) {
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
  CommandStructure.commands[name] = fn;
}

/**
 * Prints help information. If a valid command name is passed to {name}
 * it'll display the prefix, command, its format, and the detailed information
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
        strList.push('__**' + tag + '**__\n');
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



/**
 * @typedef {object} loader
 * @property {Function} staticLoadIfNotDev
 * @property {function():Array<Promise>} dynamicLoadIfDev
 */
/**
 * Runs
 * @param {boolean} isDev True loads via filesystem
 * @param {object} pathList Associative array (moduleNames, path to module)
 * @returns {loader} returns a copy of {pathList} but with the values
 * replaced by the imported versions of each file
 */
function conditionalLoader(isDev, pathList) {
  var code = Object.create(null);
  var name = 'conditionalLoader'; // Just error throwing
  var dynamic = 'dynamicLoadIfDev'; // Reserved name

  // Validation stuff
  if (typeof isDev !== 'boolean') {
    throw new SyntaxError(name + ': {isDev} expected to be type Boolean');
  } if (typeof pathList !== 'object') {
    throw new SyntaxError(name + ': {pathList} expected to be type Object');
  } if (Object.prototype.hasOwnProperty.call(pathList, dynamic)) {
    throw new SyntaxError(name + ': ' + dynamic + ' in {pathList} is reserved');
  }

  code.staticLoadIfNotDev = function () { // Doesn't clash with namespace
    delete code.staticLoadIfNotDev; // because we delete
    staticLoad(isDev, code, pathList);
  };
  code[dynamic] = function () {
    dyanmicLoad(isDev, code, pathList);
  };
  return code;
}

function staticLoad(isDev, codeContainer, path) {
  if (!isDev) {
    Object.keys(path).forEach(function (moduleName) {
      codeContainer[moduleName] = require(path[moduleName]);
    });
  }
}

function dyanmicLoad(isDev, codeContainer, path) {
  if (isDev) {
    // Delete cache each time to prevent collisions (I think) in cache
    // Sometimes after successsive executions of dynamicLoad(), non-native
    // modules loaded via require() would register retrieve a different module
    // from cache, usually after two executions of dynamicLoad() in a loop.
    Object.keys(require.cache).forEach(function (key) {
      // Doesn't seem like I can delete native modules from require.cache
      // so don't need all these garbage, but saves memory?
      if (key.startsWith(nodePath.resolve('.'))) {
        delete require.cache[key];
      }
    });
    Object.keys(path).forEach(function (modName) {
      codeContainer[modName] = require(path[modName]);
    });
  }
}

/*function dyanmicLoadFileSystem(isDev, codeContainer, path) {
  // Delete cache each time to prevent collisions (I think) in cache
  // Sometimes after successsive executions of dynamicLoad(), non-native
  // modules loaded via require() would register retrieve a different module
  // from cache, usually after two executions of dynamicLoad() in a loop.

  // Not even sure this step is necessary anymore since it works without
  // clearing the cache always, not sure what problem i was encountering before
  //Object.keys(require.cache).forEach(function (key) {
    // Doesn't seem like I can delete native modules from require.cache
    // so don't need all these garbage

    //if (key.startsWith(nodePath.resolve('.'))) {
  //  delete require.cache[key];
    //}
  //});

  return(isDev
    ? Object.keys(path).map(function (modName) {
      var load = {};
      var loadPromise = new Promise(function (resolve, reject) {
        load.resolve = resolve;
        load.reject  = reject;
      });

      fs.readFile(path[modName], 'utf8', function (err, data) {
        if (err) {
          load.reject(err); // Load fail
        } else {
          try { // Test any problems in code
            codeContainer[modName] = eval('(function(){eval(data)}());');
            load.resolve(); // And signal commands loaded
          } catch (e) { // Fail if there are any
            load.reject(e); // Load fail
          }
        }
      });
      return loadPromise; })
    : [Promise.resolve()]
  );
}*/

module.exports = utils;