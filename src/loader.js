var nodePath = require('path');

/**
 * @typedef {object} loader
 * @property {Function} staticOnFalse
 * @property {function():Array<Promise>} dynamicOnTrue
 */
/**
 * Runs
 * @param {boolean} isDynamic True loads via filesystem
 * @param {object} pathList Associative array (moduleNames, path to module)
 * @returns {loader} returns a copy of {pathList} but with the values
 * replaced by the imported versions of each file
 */
function conditionalLoader(isDynamic, pathList) {
  var code = Object.create(null);
  var name = 'conditionalLoader'; // Just error throwing
  var static = 'staticOnFalse';
  var dynamic = 'dynamicOnTrue'; // Reserved name

  // Validation stuff
  if (typeof isDynamic !== 'boolean') {
    throw new SyntaxError(name + ': {isDyanmic} expected to be type Boolean');
  } if (typeof pathList !== 'object') {
    throw new SyntaxError(name + ': {pathList} expected to be type Object');
  } if (Object.prototype.hasOwnProperty.call(pathList, dynamic)) {
    throw new SyntaxError(name + ': ' + dynamic + ' in {pathList} is reserved');
  }

  code[static] = function () { // Doesn't clash with namespace
    delete code[static]; // because we delete
    staticLoad(isDynamic, code, pathList);
  };
  code[dynamic] = function () {
    dyanmicLoad(isDynamic, code, pathList);
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

module.exports = conditionalLoader;