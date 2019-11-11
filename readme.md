# mem [![Build Status](https://travis-ci.org/sindresorhus/mem.svg?branch=master)](https://travis-ci.org/sindresorhus/mem)

> [Memoize](https://en.wikipedia.org/wiki/Memoization) functions - An optimization used to speed up consecutive function calls by caching the result of calls with identical input

Memory is automatically released when an item expires or the cache is cleared.

By default, **only the first argument is considered** and it only works with [primitives](https://developer.mozilla.org/en-US/docs/Glossary/Primitive). If you need to cache multiple arguments or cache `object`s *by value*, use the `cacheKey` option.


## Install

```
$ npm install mem
```


## Usage

```js
const mem = require('mem');

let i = 0;
const counter = () => ++i;
const memoized = mem(counter);

memoized('foo');
//=> 1

// Cached as it's the same argument
memoized('foo');
//=> 1

// Not cached anymore as the argument changed
memoized('bar');
//=> 2

memoized('bar');
//=> 2

// Only the first argument is considered by default
memoized('bar', 'foo');
//=> 2
```

##### Works fine with promise returning functions

```js
const mem = require('mem');

let i = 0;
const counter = async () => ++i;
const memoized = mem(counter);

(async () => {
	console.log(await memoized());
	//=> 1

	// The return value didn't increase as it's cached
	console.log(await memoized());
	//=> 1
})();
```

```js
const mem = require('mem');
const got = require('got');
const delay = require('delay');

const memGot = mem(got, {maxAge: 1000});

(async () => {
	await memGot('sindresorhus.com');

	// This call is cached
	await memGot('sindresorhus.com');

	await delay(2000);

	// This call is not cached as the cache has expired
	await memGot('sindresorhus.com');
})();
```


## API

### mem(fn, options?)

#### fn

Type: `Function`

Function to be memoized.

#### options

Type: `object`

##### maxAge

Type: `number`\
Default: `Infinity`

Milliseconds until the cache expires.

##### cacheKey

Type: `Function`\
Default: `arguments_ => arguments_[0]`\
Example: `arguments_ => JSON.stringify(arguments_)`

Determines the cache key for storing the result based on the function arguments. By default, **only the first argument is considered**.

A `cacheKey` function can return any type supported by `Map` (or whatever structure you use in the `cache` option).

You can have it cache **all** the arguments by value with `JSON.stringify`, if they are compatible:

```js
const mem = require('mem');

mem(function_, {cacheKey: JSON.stringify});
```

Or you can use a more full-featured serializer like [serialize-javascript](https://github.com/yahoo/serialize-javascript) to add support for `RegExp`, `Date` and so on.

```js
const mem = require('mem');
const serializeJavascript = require('serialize-javascript');

mem(function_, {cacheKey: serializeJavascript});
```

##### cache

Type: `object`\
Default: `new Map()`

Use a different cache storage. Must implement the following methods: `.has(key)`, `.get(key)`, `.set(key, value)`, `.delete(key)`, and optionally `.clear()`. You could for example use a `WeakMap` instead or [`quick-lru`](https://github.com/sindresorhus/quick-lru) for a LRU cache.

### mem.clear(fn)

Clear all cached data of a memoized function.

#### fn

Type: `Function`

Memoized function.


## Tips

### Cache statistics

If you want to know how many times your cache had a hit or a miss, you can make use of [stats-map](https://github.com/SamVerschueren/stats-map) as a replacement for the default cache.

#### Example

```js
const mem = require('mem');
const StatsMap = require('stats-map');
const got = require('got');

const cache = new StatsMap();
const memGot = mem(got, {cache});

(async () => {
	await memGot('sindresorhus.com');
	await memGot('sindresorhus.com');
	await memGot('sindresorhus.com');

	console.log(cache.stats);
	//=> {hits: 2, misses: 1}
})();
```


## Related

- [p-memoize](https://github.com/sindresorhus/p-memoize) - Memoize promise-returning & async functions


---

<div align="center">
	<b>
		<a href="https://tidelift.com/subscription/pkg/npm-mem?utm_source=npm-mem&utm_medium=referral&utm_campaign=readme">Get professional support for this package with a Tidelift subscription</a>
	</b>
	<br>
	<sub>
		Tidelift helps make open source sustainable for maintainers while giving companies<br>assurances about security, maintenance, and licensing for their dependencies.
	</sub>
</div>
