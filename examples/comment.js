var
siscom = require('..'),
P = siscom.Parsers,
C = siscom.Combinators,
CS = siscom.CommentStyle;

var
javaCS = CS('/*', '*/', '//', false);

var
someSpace = javaCS.buildSomeSpace(P.spaces);

var
status = siscom.Status('//hello\n/*\n*\n/**/*/', 0, '<string>', 1, 1);
console.log(someSpace(status));
console.log(status);
