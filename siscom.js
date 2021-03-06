// utility

function unique(ary) {
  return Object.keys(ary.reduce(function (o, a) {
    o[a] = true;
    return o;
  }, {}));
}

function checkParseError(e) {
  if (!(e instanceof ParseError)) {
    throw e;
  }
}


// class Status

// constructor

function Status(source, index, filename, line, column) {
  if (!(this instanceof Status)) {
    return new Status(source, index, filename, line, column);
  }

  this.source = source;
  this.index = index;
  this.filename = filename;
  this.line = line;
  this.column = column;

  return this;
}

// methods

Status.prototype.get = function get(index) {
  return this.source.charAt(this.index + (index || 0));
};

Status.prototype.update = function update(str) {
  var
  i, len = str.length;
  this.index += len;

  for (i = 0; i < len; i++) {
    switch (str.charAt(i)) {
    case '\n':
      this.line += 1;
      this.column = 1;
      break;
    default:
      this.column += 1;
      break;
    }
  }
};

Status.prototype.save = function save() {
  return new Status(this.source, this.index, this.filename, this.line, this.column);
};

Status.prototype.reset = function reset(save) {
  this.source = save.source;
  this.index = save.index;
  this.filename = save.filename;
  this.line = save.line;
  this.column = save.column;
};


// class ParseError

// constructor

function ParseError(source, index, filename, line, column, message, expecteds, unexpected) {
  if (!(this instanceof ParseError)) {
    return new ParseError(source, index, filename, line, column, message, expecteds, unexpected);
  }

  Error.call(this);

  this.source = source;
  this.index = index;
  this.filename = filename;
  this.line = line;
  this.column = column;
  this._message = message;
  this.expecteds = expecteds || [];
  this.unexpected = unexpected;
}

// methods

ParseError.prototype = Object.create(Error.prototype);
ParseError.prototype.name = 'ParseError';
ParseError.prototype.constructor = ParseError;

ParseError.prototype.merge = function merge(other) {
  if (this.filename !== other.filename) {
    throw new Error('cannot merge parse errors created by different files.');
  }

  if (this.index > other.index) return this;
  if (this.index < other.index) return other;

  return new ParseError(
    this.source, this.index, this.filename, this.line, this.column,
    this._message || other._message,
    (this.expecteds).concat(other.expecteds),
    this.unexpected || other.unexpected);
}

Object.defineProperty(ParseError.prototype, 'message', {
  get: function message() {
    if (this._message) {
      return this._message;
    }

    var
    message = this.filename + ':' + this.line + ': ';
    this.expecteds = unique(this.expecteds).sort();
    switch (this.expecteds.length) {
    case 0:
      message += 'unexpected ' + this.unexpected;
      break;
    case 1:
      message += 'expected ' + this.expecteds;
      if (this.unexpected) {
        message += ', but found ' + this.unexpected;
      }
      break;
    default:
      message += 'expected ' + this.expecteds.slice(0, -1).join(', ') + ' and ' + this.expecteds[this.expecteds.length - 1];
      if (this.unexpected) {
        message += ', but found ' + this.unexpected;
      }
      break;
    }

    return message;
  },
});

ParseError.prototype.showLine = function showLine() {
  var
  buf = [],
  line = this.source && this.source.split('\n', this.line)[this.line - 1];

  if (!line || line.length+1 < this.column) {
    return '<source not found>';
  }

  if (this.column <= 79) {
    buf.push(line.slice(0, 79));
    buf.push(Array(this.column).join(' ') + '^');
  } else {
    buf.push(line.slice(this.column - 21, this.column + 58));
    buf.push(Array(21).join(' ') + '^');
  }

  return buf.join('\n');
};

ParseError.prototype.toString = function toString() {
  return [this.message,
          this.showLine()].join('\n');
};

// Parsers and Combinators

var
Parsers = {},
Combinators = {};

Combinators.named = function named(name, parser) {
  return function namedParser(status) {
    try {
      return parser(status);
    } catch (e) {
      checkParseError(e);
      Parsers.error(e._message, [name], e.unexpected)(status);
    }
  };
};

Combinators.lazy = function lazy(wrap) {
  var
  cache = false,
  parser = null;
  return function lazyParser(status) {
    if (!cache) {
      parser = wrap();
      cache = true
    }
    return parser(status);
  };
};

Combinators.wrap = function wrap(wrap) {
  return function wrapParser(status) {
    return wrap()(status);
  };
};


Parsers.error = function error(message, expecteds, unexpected) {
  return function errorParser(status) {
    throw new ParseError(status.source, status.index, status.filename, status.line, status.column, message, expecteds, unexpected);
  };
};

Parsers.expected = function expected(expecteds, unexpected) {
  return Parsers.error('', expecteds, unexpected);
};

Parsers.empty = function empty(status) {
  throw new ParseError(status.source, -1, status.filename, -1, -1, 'it is an empty error.', [], null);
};

Parsers.string = function string(str) {
  var
  expected = Parsers.expected([JSON.stringify(str)]);

  return function stringParser(status) {
    var
    i, len = str.length;

    for (i = 0; i < len; i++) {
      if (str.charAt(i) !== status.get(i)) {
        expected(status);
      }
    }
    status.update(str);

    return str;
  };
};

Parsers.satisfy = function satisfy(cond) {
  var
  expected = Parsers.expected(['<' + cond.name + '>']);

  return function satisfyParser(status) {
    var
    c = status.get();

    if (cond(c)) {
      status.update(c);
      return c;
    } else {
      expected(status);
    }
  };
};

Parsers.regexp = function regexp(re) {
  var
  expected = Parsers.expected([re.toString()]);
  re = new RegExp('^(' + re.source + ')', re.ignoreCase ? 'i' : '');

  return function regexpParser(status) {
    var
    m,
    source = status.source.slice(status.index);
    if (m = source.match(re)) {
      status.update(m[1]);
      return m[1];
    } else {
      expected(status);
    }
  };
};

Parsers.any = (function any() {
  var
  expected = Parsers.expected(['any character'], 'end of file');

  return function anyParser(status) {
    var
    c = status.get();
    if (c) {
      status.update(c);
      return c;
    } else {
      expected(status);
    }
  }
}());

Parsers.notChar = function notChar(chr) {
  if (chr.length !== 1) {
    throw Error('Parsers.notChar requires a character (not a string)');
  }

  var
  expected1 = Parsers.expected([], JSON.stringify(chr)),
  expected2 = Parsers.expected(['not ' + JSON.stringify(chr)], 'end of file');

  return function notStringParser(status) {
    var
    c = status.get();
    if (c === chr) {
      expected1(status);
    } else if (!c) {
      expected2(status);
    }
    status.update(c);
    return c;
  };
};

Parsers.space  = Combinators.named('space' , Parsers.regexp(/\s/ ));
Parsers.spaces = Combinators.named('spaces', Parsers.regexp(/\s+/));

Parsers.newline = Parsers.string('\n');
Parsers.tab     = Parsers.string('\t');

Parsers.digit = Parsers.satisfy(function digit(chr) {
  return '0' <= chr && chr <= '9';
});
Parsers.hexDigit = Parsers.satisfy(function hexDigit(chr) {
  return '0' <= chr && chr <= '9' ||
         'a' <= chr && chr <= 'f' ||
         'A' <= chr && chr <= 'F';
});
Parsers.octDigit = Parsers.satisfy(function octDigit(chr) {
  return '0' <= chr && chr <= '7';
});

Parsers.lower = Parsers.satisfy(function lower(chr) {
  return 'a' <= chr && chr <= 'z';
});
Parsers.upper = Parsers.satisfy(function upper(chr) {
  return 'A' <= chr && chr <= 'Z';
});
Parsers.letter = Parsers.satisfy(function letter(chr) {
  return 'a' <= chr && chr <= 'z' ||
         'A' <= chr && chr <= 'Z';
});

Parsers.alphaNum = Parsers.satisfy(function alphaNum(chr) {
  return 'a' <= chr && chr <= 'z' ||
         'A' <= chr && chr <= 'Z' ||
         '0' <= chr && chr <= '9';
});

Combinators.count = function count(min, max, parser) {
  return function countParser(status) {
    var
    i, result = [],
    save = status.save();

    for (i = 0; i < max; i++) {
      try {
        result.push(parser(status));
      } catch (e) {
        checkParseError(e);
        if (i < min) {
          throw e;
        } else {
          status.reset(save);
          break;
        }
      }

      save = status.save();
    }

    return result;
  };
};

Combinators.many = function many(parser) {
  return Combinators.count(0, Infinity, parser);
};

Combinators.some = function some(parser) {
  return Combinators.count(1, Infinity, parser);
};

Combinators.min = function min(min, parser) {
  return Combinators.count(min, Infinity, parser);
};

Combinators.max = function max(max, parser) {
  return Combinators.count(0, max, parser);
};

Combinators.times = function times(n, parser) {
  return Combinators.count(n, n, parser);
};

Combinators.skip = function skip(parser) {
  return function skipParser(status) {
    parser(status);
  }
};

Combinators.skipCount = function skipCount(min, max, parser) {
  return function countParser(status) {
    var
    i,
    save = status.save();

    for (i = 0; i < max; i++) {
      try {
        parser(status);
      } catch (e) {
        checkParseError(e);
        if (i < min) {
          throw e;
        } else {
          status.reset(save);
          break;
        }
      }

      save = status.save();
    }
  };
};

Combinators.skipMany = function skipMany(parser) {
  return Combinators.skipCount(0, Infinity, parser);
};

Combinators.skipSome = function skipSome(parser) {
  return Combinators.skipCount(1, Infinity, parser);
};

Combinators.skipMin = function skipMin(min, parser) {
  return Combinators.skipCount(min, Infinity, parser);
};

Combinators.skipMax = function skipMax(max, parser) {
  return Combinators.skipCount(0, max, parser);
};

Combinators.skipTimes = function skipTimes(n, parser) {
  return Combinators.skipCount(n, n, parser);
};

Combinators.option = function option(def, parser) {
  return function optionParser(status) {
    var
    save = status.save();

    try {
      return parser(status);
    } catch (e) {
      checkParseError(e);
      status.reset(save);
      return def;
    }
  };
};

Combinators.optional = function optional(parser) {
  return Combinators.option(null, parser);
};

Combinators.choice = function choice(parsers /*...*/) {
  parsers = [].slice.call(arguments);

  return function choiceParser(status) {
    var
    i, len = parsers.length,
    err = null;

    for (i = 0; i < len; i++) {
      try {
        return parsers[i](status);
      } catch (e) {
        checkParseError(e);
        if (err) {
          err = err.merge(e);
        } else {
          err = e;
        }
      }
    }

    throw err;
  };
};

Combinators.sequence = function sequence(parsers /*...*/) {
  parsers = [].slice.call(arguments);

  return function sequenceParser(status) {
    var
    i, len = parsers.length,
    results = [];

    for (i = 0; i < len; i++) {
      results.push(parsers[i](status));
    }

    return results;
  };
};

Combinators.seq = function seq(parsers /*...*/, callback) {
  parsers = [].slice.call(arguments);
  callback = parsers.pop();

  var
  sequenceParser = Combinators.sequence.apply(null, parsers);

  return function seqParser(status) {
    var
    save = status.save(),
    results = sequenceParser(status);

    return callback.apply(save, results);
  };
};

Combinators.get = function get(n, parsers /*...*/) {
  parsers = [].slice.call(arguments);
  n = parsers.shift();
  parsers.push(function callback() {
    return arguments[n];
  });

  return Combinators.seq.apply(null, parsers);
};

Combinators.left = function left(parsers /*...*/) {
  parsers = [].slice.call(arguments);
  parsers.push(function () {
    return arguments[0];
  });

  return Combinators.seq.apply(null, parsers);
};

Combinators.right = function right(parsers /*...*/) {
  parsers = [].slice.call(arguments);
  parsers.push(function () {
    return arguments[parsers.length - 2];
  });

  return Combinators.seq.apply(null, parsers);
};

Combinators.sepBy1 = function sepBy1(parser, sep) {
  return function sepBy1Parser(status) {
    var
    results = [],
    save;

    results.push(parser(status));
    for (;;) {
      save = status.save();
      try {
        sep(status);
        results.push(parser(status));
      } catch (e) {
        checkParseError(e);
        status.reset(save);
        return results;
      }
    }
  };
};

Combinators.sepBy = function sepBy(parser, sep) {
  return Combinators.option([], Combunators.sepBy1(parser, sep));
};

Combinators.endBy1 = function endBy1(parser, end) {
  return Combinators.some(Combinators.left(parser, end));
};

Combinators.endBy = function endBy(parser, end) {
  return Combinators.many(Combinators.left(parser, end));
};

Combinators.sepEndBy1 = function sepEndBy1(parser, sepEnd) {
  return Combinators.left(Combinators.sepBy1(parser, sepEnd), Combinators.optional(sepEnd));
};

Combinators.sepEndBy = function sepEndBy(parser, sepEnd) {
  return Combinators.left(Combinators.sepEndBy(parser, sepEnd), Combinators.optional(sepEnd));
};

Combinators.notFollowedBy = function notFollowedBy(parser) {
  return function notFollowedByParser(status) {
    var
    save = status.save();
    result;
    try {
      result = parser(status);
    } catch (e) {
      checkParseError(e);
      status.reset(save);
      return;
    }

    Parsers.expected([], JSON.stringify(result))(status);
  };
};

Combinators.manyTill = function manyTill(parser, end) {
  return function manyTillParser(status) {
    var
    results = [],
    save = status.save();

    for (;;) {
      try {
        end(status);
        break;
      } catch (e) {
        checkParseError(e);
        status.reset(save);
      }
      results.push(parser(status));
      save = status.save();
    }

    return results;
  };
};

Combinators.between = function between(bra, parser, ket) {
  return Combinators.get(1, bra, parser, ket);
};


// Styles

function CommentStyle(start, end, line, isNest) {
  if (!(this instanceof CommentStyle)) return new CommentStyle(start, end, line, isNest);

  this.start = start || '';
  this.end = end || '';
  this.line = line || '';
  this.isNest = isNest;
}

CommentStyle.prototype.buildSomeSpace = function buildSomeSpace(space) {
  var
  line = this.line.length !== 0 &&
    Combinators.sequence(Parsers.string(this.line), Combinators.skipMany(Parsers.notChar('\n'))),
  hasMulti = this.start.length !== 0, multi, multiStart;

  if (hasMulti) {
    multi = Combinators.lazy(function () {
      return Combinators.sequence(Parsers.string(this.start), multiEnd);
    }.bind(this));
    multiEnd = Combinators.manyTill(
      this.isNest ? Combinators.choice(multi, Parsers.any) : Parsers.any,
      Parsers.string(this.end));
  }

  return Combinators.skipSome(
    line && multi ? Combinators.choice(space, line, multi) :
            line  ? Combinators.choice(space, line) :
            multi ? Combinators.choice(space, multi) : space
  );
};


// parsing

function parseString(parser, source, filename) {
  return parser(new Status(
    source,
    0,
    filename || "<string>",
    1, 1
  ));
}

// exports

exports.Status = Status;
exports.ParseError = ParseError;
exports.Parsers = Parsers;
exports.Combinators = Combinators;
exports.CommentStyle = CommentStyle;
exports.parseString = parseString;
