var
siscom = require('..'),
P = siscom.Parsers,
C = siscom.Combinators;

function parse(parser, source) {
  var
  result;

  try {
    result = siscom.parseString(parser, source);
    console.log('parse success\n%j', result);
  } catch (e) {
    console.log('parse failed\n%s', e.toString());
  }
}

var
x = C.some(P.string('x')),
y = P.string('y'),
z = C.some(P.string('z'));

var
parser = C.times(2, C.sequence(C.choice(x, z), y));

parse(parser, 'xyzzy'); // success
parse(parser, 'xxzzy'); // failure
