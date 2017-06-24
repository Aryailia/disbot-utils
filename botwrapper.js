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
  setupCommand: setupCommand,
  addCommand: addCommand,
  makeDefaultHelpCommand: makeDefaultHelpCommand,
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
function strictDefaults(outlineDefaults, overwrites) {
  var toAdd = overwrites == undefined ? {} : overwrites;
  var obj = Object.create(null);
  // If I want to change to non-mutating
  //var check = Object.create(null); // To see if {overwrites} has extra keys
  //Object.keys(overwrites).forEach(function (key) { check[key] = true; });
  Object.keys(outlineDefaults).forEach(function (key) {
    var base = toAdd.hasOwnProperty(key)
      ? toAdd[key]
      : outlineDefaults[key];
    // Shallow copies any entries
    // Note tha
    obj[key] = typeof base === 'object'
      ? Object.assign(base.constructor(), toAdd[key]) // One-level deep clone
      : base; // Or just straight copy
    //delete check[key]; // If I want to change to non-mutating
    delete toAdd[key];
  });

  // See if any un-copied properties are left over
  //if (Object.keys(check).length > 0) { // If I want to change to non-mutating
  if (Object.keys(toAdd).length > 0) {
    throw new Error('{overwrites} passed with invalid arguments' + toAdd);
  }
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
 * @param {function(string, CommandStructure):boolean} runBeforeCommands IF
 * true, will continue to run the command. Run before every command
 * @returns {CommandStructure}
 */
function setupCommand(runBeforeCommands) {
  var setup = runBeforeCommands == undefined
    ? function () { return true; }
    : runBeforeCommands;
  var CommandStructure = {
    tags: {},
    commands: {},
    help: {},
    addCommand: function (name) {
      if (setup(CommandStructure, name)) {
        utils.addCommand.apply(null, [CommandStructure].concat(
          Array.prototype.slice.call(arguments)));
      }
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
 * @param {CommandStructure} CommandStructure
 * @param {object} CommandStructure.tags
 * @param {object} CommandStructure.commands
 * @param {object} CommandStructure.help
 * @param {boolean} strict
 */
function makeDefaultHelpCommand(CommandStructure, isStrict, isPrintCombinations) {
  return function (text, message) {
    var helpStruct = CommandStructure.help;
    var strList = [];

    if (helpStruct.hasOwnProperty(text)) {
      strList.push('**' + text + '**' + helpStruct[text].format + '\n' +
        helpStruct[text].details);
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

      if (isPrintCombinations) { // List by all combinations of tags
        // Invert {sortedTags}. {indexedTags} is the index of SortedTags
        sortedTags.forEach(function (tag, i) { indexedTags[tag] = i; });
        
        // Adds all unordered combinations of tags to {headers}
        Object.keys(helpStruct).forEach(function (command) { // Populate {headers}
          var key = ''; // The key of {headers}
          // Each time {str} grows, add a new entry
          helpStruct[command].tags
            .map(function (tag) { return indexedTags[tag]; })
            .sort(function (a, b) { return a - b; }) // least to greatest
            .forEach(function (tag) {
              key += '.' + tag;
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
            var last = list.pop();
            var expandedTag = (list.join(', ') +
              (list.length > 1 ?  ',' : '') + // Serial comma
              (list.length > 0 ? ' and ' : '') +
              last);
            
            tagKeys.push(expandedTag);
            tagValues[expandedTag] = headers[combination];
          });
      } else { // Or just list by tags sorted alphabetically
        tagKeys = sortedTags;
        tagValues = CommandStructure.tags;
      }
      
      // Display
      tagKeys.forEach(function (tag) {
        // If commandList still has one of the commands
        var values = tagValues[tag];
        if (values.some(function (x) { return isAvailable[x]; })) {
          strList.push('**' + tag + '**\n');
          values.forEach(function (command) {
            if (isAvailable[command]) {
              strList.push('**' + command + '** - '
                + helpStruct[command].summary + '\n');
            }
            
            if (isStrict) {
              delete isAvailable[command];
            }
          });
          strList.push('\n');
        }
      });
    }
    utils.massMessage(strList, message.channel);
  };
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