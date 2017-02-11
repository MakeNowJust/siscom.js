siscom.js
===

[![Greenkeeper badge](https://badges.greenkeeper.io/MakeNowJust/siscom.js.svg)](https://greenkeeper.io/)

it's a parser library for JS.

install
---

```console
$ npm install --save siscom
```

example
---

```javascript
var
siscom = require('siscom'),
P = siscom.Parsers,
C = siscom.Combinators;

var
x = C.some(P.string('x')),
y = P.string('y'),
z = C.some(P.string('z'));

var
parser = C.times(2, C.sequence(C.choice(x, z), y));

console.log(siscom.parseString(parser, "xxyzzy"));
// => [[['x', 'x'], 'y'], [['z', 'z'], 'y']]
```


feature
---

- A parser object is usual JavaScript function.
- A parsing error is usual JavaScript error, and it is very useful, for it has many informations for debugging.  
  for example:

  ```console
  <string>:1: expected "y"
  xxyzz
       ^
  ```
- API looks like [parsers](https://hackage.haskell.org/package/parsers) library of Haskell.


license
---

See <http://makenowjust.github.io/license/mit?2015>.


contribute
---

If you find a bug or make it better, please send a issue or pull request :smile:
