# PsuedoDiscord.js
A small library for simulating the Discord.js npm module for creating bots for Discord. Imitates a server via the command line (via stdin and console.log). Intended to be a drop-in replacement for Discord.js though it has very limited functionality at the moment.

# botwrapper.js
Some useful utility functions for bot development with Discord.js:
* Regular expression for a standard command format
* A message sender that accepts an array of strings and tries to send as few messages as possible to fit within the character limit (2000) while still breaking across boundaries nicely (message and newline boundaries)
```Javascript
// The following are intended behaviour and not tested

// Input of two strings (demonstrating breaking across input array boundaries)
'Donna toki demo ... Shinjiteiru no\n' // Assume this is exceeds limit of 2000 right at the end of ...
'Kono sekai wo, jibun no yume wo' // Length as is
// Outputs three messages, note that these are implicitly with a newline at the end (since messages appear on different lines)
`Donna toki demo ...`
` Shijiteiru no\n`
`Kono sekai wo, jibune no yume wo`


// Input of three strings (demonstrating combining)
'mukaekirenai koudou ha'
'hazimari no aizu datte sa'
'mada nemutta mama de iru omoi wo okosou'
// Output one message
`mukaekirenai koudou ha\nhazimari no aizu datte sa\nmada nemutta mama de iru omoi wo okosou`

// Input of one strings (demonstrating breaking across new lines)
'osorezu ni ite ...\nkono sekai wo susumu...\njikan wo' // Assume this exceeds limit of 2000 at the end of second ...
// Output two strings
`osorezu ni ite ...`
`kono sekai wo susumu...\njikan wo`
```
* So the primary function included in this library is allow a node bot to include libraries that are being developed on without having to shut down the bot and reinterpret. The bot.js main file itself will have to be recompiled if any changes are made to it, however any libraries loaded via this method are read using the native module 'fs' (filesystem) and then evaluated at runtime. A bit of additional working (shown below) has to be down to make work around require's caching and eval() changing how pathnames are resolved, but other than that it should work as intended. This allows for fast iteration in the development process.
```Javascript
// In your main 'bot.js' file
//var IS_DEVELOPMENT = process.argv[2] && process.argv[2].trim().toLowerCase() === 'development';
var IS_DEVELOPMENT = true;

// If development, allow dynamically load commands at runtime for rapid testing
var path = require('path');
var wrapper = require('./botwrapper.js')
var dynamicImports = wrapper.conditionalLoader(IS_DEVELOPMENT, {
  commands: path.resolve('./src/commands.js'),
  utils: path.resolve('./src/utils.js'),
});
// If {IS_DEVELOPMENT} then read code from file on every command execution
// else if production then just load the code once
dynamicImports.staticLoadIfNotDev();

client = new Discord.Client();
client.login(/* token */);
client.on('message', function () {
  // Dynamic load returns a promise that will evaluate whether it is dynamically loaded from filesystem or statically via require normally (as per normal)
  Promise.all(extraModules.dynamicLoadIfDev()).then(function () {
    // Perform all your normal code in here
    dynamicImports.commands['ping'](); // Yay, using
    dynamicImports.utils.example();    // commands imported
  });
});
```
````Javascript
// In the files loaded via the filesystem you need the following before each require
// Need to delete entry from cache for non-native modules as it caching can cause a require() to load the wrong module 
if (IS_DEVELOPMENT) { // Don't need this if statement if you always intend to load via the filesystem
  delete require.cache['./src/examplelibrary.js']; // Likely will have to do path.resolve() or require.resolve();
  delete require.cache['./src/examplelibrary2.js'];
}
var example = require('./src/examplelibrary.js');
var example2 = require('./src/examplelibrary2.js');
```
