'use strict';
import mimicFn = require('mimic-fn');
import mapAgeCleaner = require('map-age-cleaner');

const cacheStore = new WeakMap();
interface CacheStorage<KeyType, ValueType> {
	has(key: KeyType): boolean;
	get(key: KeyType): ValueType | undefined;
	set(key: KeyType, value: ValueType): void;
	delete(key: KeyType): void;
	clear?: () => void;
}

interface Options<
	ArgumentsType extends unknown[],
	CacheKeyType,
	ReturnType
> {
	/**
	Milliseconds until the cache expires.

	@default Infinity
	*/
	readonly maxAge?: number;

	/**
	Determines the cache key for storing the result based on the function arguments. By default, __only the first argument is considered__ and it only works with [primitives](https://developer.mozilla.org/en-US/docs/Glossary/Primitive).

	A `cacheKey` function can return any type supported by `Map` (or whatever structure you use in the `cache` option).

	You can have it cache **all** the arguments by value with `JSON.stringify`, if they are compatible:

	```
	import mem = require('mem');

	mem(function_, {cacheKey: JSON.stringify});
	```

	Or you can use a more full-featured serializer like [serialize-javascript](https://github.com/yahoo/serialize-javascript) to add support for `RegExp`, `Date` and so on.

	```
	import mem = require('mem');
	import serializeJavascript = require('serialize-javascript');

	mem(function_, {cacheKey: serializeJavascript});
	```

	@default arguments_ => arguments_[0]
	@example arguments_ => JSON.stringify(arguments_)
	*/
	readonly cacheKey?: (arguments_: ArgumentsType) => CacheKeyType;

	/**
	Use a different cache storage. Must implement the following methods: `.has(key)`, `.get(key)`, `.set(key, value)`, `.delete(key)`, and optionally `.clear()`. You could for example use a `WeakMap` instead or [`quick-lru`](https://github.com/sindresorhus/quick-lru) for a LRU cache.

	@default new Map()
	@example new WeakMap()
	*/
	readonly cache?: CacheStorage<CacheKeyType, {data: ReturnType; maxAge: number}>;
}

/**
[Memoize](https://en.wikipedia.org/wiki/Memoization) functions - An optimization used to speed up consecutive function calls by caching the result of calls with identical input.

@param fn - Function to be memoized.

@example
```
import mem = require('mem');

let i = 0;
const counter = () => ++i;
const memoized = mem(counter);

memoized('foo');
//=> 1

// Cached as it's the same arguments
memoized('foo');
//=> 1

// Not cached anymore as the arguments changed
memoized('bar');
//=> 2

memoized('bar');
//=> 2
```
*/
const mem = <
	ArgumentsType extends CacheKeyType[],
	ReturnType,
	CacheKeyType,
	FunctionToMemoize extends (...arguments_: ArgumentsType) => ReturnType
>(
	fn: FunctionToMemoize, {
	cacheKey,
	cache = new Map(),
	maxAge
}: Options<ArgumentsType, CacheKeyType, ReturnType> = {}): FunctionToMemoize => {
	if (typeof maxAge === 'number') {
		// @ts-expect-error
		// TODO: remove after https://github.com/SamVerschueren/map-age-cleaner/issues/5
		mapAgeCleaner(cache);
	}

	const memoized = ((...arguments_: ArgumentsType): ReturnType => {
		const key = cacheKey ? cacheKey(arguments_) : arguments_[0];

		const cacheItem = cache.get(key);
		if (cacheItem) {
			return cacheItem.data;
		}

		const result = fn.apply(memoized, arguments_);

		cache.set(key, {
			data: result,
			maxAge: maxAge ? Date.now() + maxAge : Infinity
		});

		return result;
	}) as FunctionToMemoize;

	try {
		// The below call will throw in some host environments
		// See https://github.com/sindresorhus/mimic-fn/issues/10
		mimicFn(memoized, fn);
	} catch (_) {}

	cacheStore.set(memoized, cache);

	return memoized;
};

export = mem;

/**
Clear all cached data of a memoized function.

@param fn - Memoized function.
*/
mem.clear = (fn: Function): void => {
	if (!cacheStore.has(fn)) {
		throw new Error('Can\'t clear a function that was not memoized!');
	}

	const cache = cacheStore.get(fn);
	if (typeof cache.clear === 'function') {
		cache.clear();
	}
};
