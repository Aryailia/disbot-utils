/**
 * @todo Add message limit of 2000
 */

const VALID_EVENTS = [
  'message', 'ready'
];

const STATE_INITIAL = 0;
const STATE_LOGIN = 1;
const USER_ID = Symbol(); // ES6 symbol

function _null() {
}

/**
 * 
 * @param {Object} state 
 * @param {string} text Text of message to send
 */
function messageFactory(state, text) {
  const line = text.replace(/\s*$/,'');
  return {
    channel: {
      send: state.send,
    },
    author: {
      id: USER_ID
    },
    content: line,
    delete: _null,
  };
}

const PsuedoDiscord = {
  psuedo: true,
  Client: function () {
    // Private variables
    const state = {
      status: STATE_INITIAL,
      send: function (msg) { // Send message, output and trigger handler
        console.log(msg); // Output message
        if (state.handler.hasOwnProperty('message')) {
          state.handler.message(messageFactory(state, msg)); // Handler
        }
      },
      handler: {
        ready: _null, // Default doesn't do nothing
      },
    };

    // Handling the IO from console
    process.stdin.resume(); // Read stdin so the process does not exit.
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', function (text) {
      state.handler.message(messageFactory(state, text));
    });
    
    // Client to return
    const discordclient = {
      // Properties
      user: {
        id: undefined,
      },

      // Methods
      login: function () {
        state.status = STATE_LOGIN;
        discordclient.user.id = USER_ID;
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

    return discordclient;
  }
};

module.exports = PsuedoDiscord;