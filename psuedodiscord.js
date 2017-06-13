const VALID_EVENTS = [
  'message', 'ready'
];

const PsuedoDiscord = {
  Client: function () {
    const state = {
      status: 0,
      send: function (msg) {
        console.log(msg);
        if (state.handler.hasOwnProperty('message')) {
          state.handler.message(msg);
        }
      },
      handler: {},
    };
    state.handler.ready = function () {}; // default blank

    process.stdin.resume(); // Read stdin so the process does not exit.
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', function (text) {
      const line = text.replace(/\s*$/,'');
      state.handler.message({
        channel: {
          send: state.send
        },
        content: line,
      });
      //if (line === 'quit\n') {
      //  console.log('process.stdin is paused and done');
      //  process.exit();
      //}
    });
    
    return {
      login: function () {
        state.status = 1;
      },
      
      on: function (eventName, handle) {
        return VALID_EVENTS.some(function (type) {
          const valid = type === eventName.toLowerCase();
          if (valid) { // use {type} cause do not trust user input
            state.handler[type] = handle;
          }
          if (type === 'ready' && state.handler.hasOwnProperty('ready')) {
            state.handler.ready();
          }
          return valid;
        });
      }
    };
  }
};

module.exports = PsuedoDiscord;