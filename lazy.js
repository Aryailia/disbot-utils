function _inlineSlice(skip, until) {
  return function () {
    var length = arguments.length - until;
    var result = new Array(length - skip);
    var i = skip; while (i < length) {
      result[i - skip] = arguments[i];
      ++i;
    }
    return result;
  }
}

var _INFINITY = 1 / 0;
var _SKIP0TILL0 = _inlineSlice(0, 0);
var _SKIP1TILL0 = _inlineSlice(1, 0);
var _SKIP0TILL1 = _inlineSlice(0, 1);

var $ = {
  map: function (fn) {
    return function () {
      var source = _SKIP0TILL0.apply(null, arguments);
      var length = source.length;

      var index = -1; while (++index < length) {
        source[index] = fn(source[index]);
      }
      return source;
    }
  },
  sieve: function (fn) {
    return function () {
      var source = _SKIP0TILL0.apply(null, arguments);
      var length = source.length;

      var result = [];
      var resultIndex = -1;
      var sourceIndex = -1; while (++sourceIndex < length) {
        if (fn(source[sourceIndex])) {
          result[++resultIndex] = source[sourceIndex];
        }
      }
      return(result);
    }
  },

  foldL: function (seed, fn) {
    return function () {
      var source = _SKIP0TILL0.apply(null, arguments);
      var length = source.length;
      var accumulator = seed;
      
      var index = -1; while (++index < length) {
        // console.log(index);
        accumulator = fn(accumulator, source[index], index);
      }
      return(accumulator);
    };
  },

  chain: function () {
    var source = _SKIP0TILL0.apply(null, arguments);

    return function () {
      return $.curry.apply(null, arguments).apply(null, source);
    };
  },

  curry: _curryCustom(function (fn, source) {
    return _isArrayLike(source)
      ? fn.apply(null, source)
      : fn.call(null, source);
  }),

  curryApply: _curryCustom(function (fn, source) {
    return fn.apply(null, source);
  }),

  curryCall: _curryCustom(function (fn, source) {
    return fn.call(null, source);
  }),

  unmonad: function (fn) {
    var args = _SKIP1TILL0.apply(null, arguments);
    return function () {
      var source = _SKIP0TILL0.apply(null, arguments);
      return fn.apply(source, args);
    };
  },
  rebox: function (fn) {
    return function () {
      return [fn.apply(null, arguments)]
    };
  },
  
}

function _isArrayLike(toTest) {
  return typeof toTest === 'object' && toTest.hasOwnProperty('length');
}

// var test = [1,2,3,4,5,6,7,8,9,0];
// console.log($.chain(test)
//   ( $.map(x => { console.log('map1', x); return x + 1; })
//   , $.sieve(x => { console.log('sieve2', x); return x % 2 === 0; })
//   , $.unmonad(Array.prototype.map, x => x + 3)
//   , $.foldL(0, (acc, x) => { console.log('foldL'); return acc+x; })
//   , $.map(x => x / 3)
//   )
// );
// console.log(test);

// console.log($.curryApply
//   ( $.map(x => x + 1)
//   , $.sieve(x => x % 2 === 0)
//   , $.unmonad(Array.prototype.map, x => x + 3)
//   , $.rebox($.foldL(0, (acc, x) => acc + x))
//   , $.map(x => x / 3)
//   )(test)
// );
// console.log(test);


function _curryCustom(custom) {
  return function () {
    var fList = _SKIP0TILL0.apply(null, arguments);
    return function (source) {
      var length = fList.length;
      var queue = fList;

      var result = source;
      var index = -1; while (++index < length) { // func + arg pairs
        result = custom(queue[index], result);
      }
      return result;
    };
  };
}

function _listWrap(input) {
  var source = _isArrayLike(input) // always array
    ? input
    : ((input === void 0) ? [] : [input]); // [null] can still go through
  var index = 0;

  var obj = Object.create(null);
  obj.isNotDone = function () {
    return index < source.length;
  };
  obj.next = function () {
    return obj.isNotDone ? source[index++]: null;
  }
  return obj;
}

/**
 * @todo unit tests for _addMethods, Lazy name changes don't hurt anything 
 * @todo test for name conflicts after _addMethods perhaps?
 * @todo throughly test _pushN and _arrayWrap cases for when singleton
 * vs list are needed, perhaps opportunity for optimisation?
 * - immediately after foldL, need singleton check for _pushN
 */
/**
 * To convert all the methods from composition to dot-chainable
 */
var _addMethods = (function () {
  var strictGraph = ['foldL'];

  var lazys = ['map', 'sieve', 'unmonad'];
  var stricts = {
    'unmonad': 'seqUnmonad',
  };
  strictGraph.forEach(function (entry) { stricts[entry] = entry; });

  return function (prototype, funcQueue) {
    lazys.forEach(function (name) {
      prototype[name] = function () {
        funcQueue[funcQueue.length] = $[name].apply(null, arguments);
        return prototype;
      };
    });

    // For the functors that need the entire array evaluated before continuing
    Object.keys(stricts).forEach(function (name) {
      prototype[stricts[name]] = function () {
        var result = prototype.takeAll();
        return $[name].apply(null, arguments).apply(null, result);
      };

      // Include method if want to wrap for continued dot-chaining
      prototype[stricts[name] + 'Wrap'] = function () {
        var a = prototype[stricts[name]].apply(null, arguments);
        return Lazy(a);
      };
    });

    return prototype;
  };

})();

function _pushN(result, input, targetLength) {
  var source = _isArrayLike(input) ? input : [input];
  // var source = input;
  var sourceLength = source.length;

  var i = -1; while (++i < sourceLength && result.length < targetLength) {
    result[result.length] = source[i];
  }
};

function Lazy(input) {
  // Declaring state
  var funcQueue = [];
  var value = _listWrap(input);

  // Declaring methods
  // Inherit from exiting functional methods
  var prototype = _addMethods(Object.create(null), funcQueue);

  // Some stuff for lazy evaluation and dot chaining
  prototype.take = function (count) {
    var fn = $.curry.apply(null, funcQueue);
    funcQueue.length = 0; // Memory Safety: Kill it with fire

    var result = [];
    while (result.length < count && value.isNotDone()) {
      _pushN(result, fn(value.next()), count); 
    }
    value = prototype = null; // Memory Safety: Kill it with fire
    return result;
  };

  prototype.takeAll = function () {
    return prototype.take(_INFINITY);
  };

  prototype.seq = function () {
    return Lazy(prototype.takeAll());
  };

  // prototype.test = function () {
  //   return value;
  // }

  return prototype;
}

var test = [1,2,3,4,5,6,7,8,9,0];
console.log('Lazy basic', Lazy(test)
  .map(x => { console.log('map1', x); return x + 1; })
  .sieve(x => { console.log('sieve2', x); return x % 2 === 0; })
  .map(x => { console.log('map3', x); return x * 2; })
  .seqUnmonadWrap(Array.prototype.map, x => { console.log('map3', x); return x * 2; })
  // .foldLWrap(0, (acc, x) => acc + x)
  .take(6) 
);
module.exports = $;