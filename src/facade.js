var DISCORD_MESSAGE_LIMIT = 2000;

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
    }
  );
}

module.exports = {
  DISCORD_MESSAGE_LIMIT: DISCORD_MESSAGE_LIMIT,
  massMessage: massMessage,
};