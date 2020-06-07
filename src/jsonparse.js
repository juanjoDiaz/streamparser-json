const Tokenizer = require('./tokenizer');
const Parser = require('./parser');

class JSONParser {
  constructor (opts = {}) {
    this.tokenizer = new Tokenizer(opts);
    this.parser = new Parser();
    this.tokenizer.onToken = this.parser.write.bind(this.parser);
  }
  write(buffer) {
    this.tokenizer.write(buffer);
  }
  set onToken(cb) {
    this.tokenizer.onToken = cb;
  }
  set onValue(cb) {
    this.parser.onValue = cb;
  }
}

module.exports = JSONParser;
