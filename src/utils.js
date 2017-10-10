var SPACE = '[' + [
  ' ', // U+0020, regular space
  '\t', // Tab
  '\u3000', // Ideographic space, aka. full-width space
].join('') + ']';

module.exports = {
  REGEX_SPACE: SPACE,

  /**
   * Default command format for bots
   * @param {string} prefix Regex for the command prefix
   * @param {string} [separator] Regex for separator between command and
   * parameter, uses a choice between a few types of spaces as default
   * @returns {regex}
   */
  validateParseCommand: function (prefix, separator, message) {
    if (typeof seperator == 'undefined') {
      separator = SPACE;
    }
    return(
      new RegExp('^' + prefix + '(\\S+)(?:' + separator + '*([\\S\\s]+))?$')
    ).exec(message);
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
   * @param {object} defaults The structure outline and defaults
   * @param {object} toSet The values to overwrite with
   * @returns {object}
   */
  strictDefaults: function (defaults, toSet) {
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
};