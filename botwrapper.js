var fs = require('fs');
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
    return new RegExp('^' + prefix + '(\\S+)' + separator + '*([\\S\\s]+)?$');
  },

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
   * @param {Function(string)} sender Outputs to your
   */
  massMessage: function (messageList, sender) {
    messageList
      // Refine list separation to prioritize messageList boundaries but fit into limit
      .reduce(fitIntoLimit, [{ size: 0, buffer: []}]) // Combine what will fit into a limit
      .reduce(function (list, x) { return list.concat(x.buffer); }, []) // Flatten

      // Refine list separation to prioritize newlines
      .map(function (messages) {
        var group = messages.split('\n') // Split along new lines
          .reduce(fitIntoLimit, [{ size: 0, buffer: []}]); // Combine if limit allows
        return group.map(function (newLineGroup) { 
          return newLineGroup.buffer.join(''); // Then flatten into string
        }); // return Array<Array<strings>>
      })
      .reduce(function (list, x) { return list.concat(x); }, []) // Flatten

      // Display
      .forEach(function (message) {
        var index = 0;
        var length = message.length;
        while (index < length) { // Not guarenteed to be under limit still
          sender(message.substr(index, DISCORD_MESSAGE_LIMIT));
          index += DISCORD_MESSAGE_LIMIT;
        }
      });
  },

  /**
   * Runs
   * @param {boolean} isDev True loads via filesystem
   * @param {Object} pathList Associative array (moduleNames, path to module)
   * @returns {Object} returns a copy of {pathList} but with the values
   * replaced by the imported versions of each file
   */
  conditionalLoader: function (isDev, pathList) {
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
      staticLoadIfNotDev(isDev, code, pathList);
    };
    code[dynamic] = function () {
      return dynamicLoadIfDev(isDev, code, pathList);
    };
    return code;
  },

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
   * @param {Object} outlineDefaults The structure outline and defaults
   * @param {Object} overwrites The values to overwrite with
   * @returns {Object}
   */
  imposeKeyValueStructure: function (outlineDefaults, overwrites) {
    var obj = Object.create(null);
    // If I want to change to non-mutating
    //var check = Object.create(null); // To see if {overwrites} has extra keys
    //Object.keys(overwrites).forEach(function (key) { check[key] = true; });
    Object.keys(outlineDefaults).forEach(function (key) {
      var toAdd = overwrites.hasOwnProperty(key)
        ? overwrites[key]
        : outlineDefaults[key];
      // Shallow copies any entries
      // Note tha
      obj[key] = typeof toAdd === 'object'
        ? Object.assign(toAdd.constructor(), overwrites) // One-level deep clone
        : toAdd; // Or just straight copy
      //delete check[key]; // If I want to change to non-mutating
      delete overwrites[key];
    });

    // See if any un-copied properties are left over
    //if (Object.keys(check).length > 0) { // If I want to change to non-mutating
    if (Object.keys(overwrites).length > 0) {
      throw new Error('{overwrites} passed with invalid arguments' + overwrites);
    }
    return obj;
  },
};

function fitIntoLimit(lines, text) {
  var message = text + '\n';
  var last = lines[lines.length - 1];
  if (last.size <= DISCORD_MESSAGE_LIMIT) {
    last.buffer.push(message);
    last.size += message.length;
  } else {
    lines.push({ size: message.length, buffer: [message] });
  }
  return lines;
}

function staticLoadIfNotDev(isDev, codeContainer, path) {
  if (!isDev) {
    Object.keys(path).forEach(function (moduleName) {
      codeContainer[moduleName] = require(path[moduleName]);
    });
  }
}

function dynamicLoadIfDev(isDev, codeContainer, path) {
  return(isDev
    ? Object.keys(path).map(
      function (modName) {
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
              codeContainer[modName] = eval(data);
              load.resolve(); // And signal commands loaded
            } catch (e) { // Fail if there are any
              load.reject(e); // Load fail
            }
          }
        });
        return loadPromise;
      })
    : [Promise.resolve()]
  );
}

module.exports = utils;