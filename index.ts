'use strict';
import mimicFn = require('mimic-fn');
import mapAgeCleaner = require('map-age-cleaner');

type AnyFunction = (...arguments_: any) => any;

const cacheStore = new WeakMap<AnyFunction>();

interface CacheStorageContent<ValueType> {
	data: ValueType;
	maxAge: number;
}

interface CacheStorage<KeyType, ValueType> {
	has: (key: KeyType) => boolean;
	get: (key: KeyType) => CacheStorageContent<ValueType> | undefined;
	set: (key: KeyType, value: CacheStorageContent<ValueType>) => void;
	delete: (key: KeyType) => void;
	clear?: () => void;
}

interface Options<
	FunctionToMemoize extends AnyFunction,
	CacheKeyType
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
	readonly cacheKey?: (arguments_: Parameters<FunctionToMemoize>) => CacheKeyType;

	/**
	Use a different cache storage. Must implement the following methods: `.has(key)`, `.get(key)`, `.set(key, value)`, `.delete(key)`, and optionally `.clear()`. You could for example use a `WeakMap` instead or [`quick-lru`](https://github.com/sindresorhus/quick-lru) for a LRU cache.

	@default new Map()
	@example new WeakMap()
	*/
	readonly cache?: CacheStorage<CacheKeyType, ReturnType<FunctionToMemoize>>;
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
	FunctionToMemoize extends AnyFunction,
	CacheKeyType
>(
	fn: FunctionToMemoize,
	{
		cacheKey,
		cache = new Map(),
		maxAge
	}: Options<FunctionToMemoize, CacheKeyType> = {}
): FunctionToMemoize => {
	if (typeof maxAge === 'number') {
		// TODO: Drop after https://github.com/SamVerschueren/map-age-cleaner/issues/5
		// @ts-expect-error
		mapAgeCleaner(cache);
	}

	const memoized = function (this: any, ...arguments_) {
		const key = cacheKey ? cacheKey(arguments_) : arguments_[0];

		const cacheItem = cache.get(key);
		if (cacheItem) {
			return cacheItem.data;
		}

		const result = fn.apply(this, arguments_);

		cache.set(key, {
			data: result,
			maxAge: maxAge ? Date.now() + maxAge : Infinity
		});

		return result;
	} as FunctionToMemoize;

	mimicFn(memoized, fn, {
		ignoreNonConfigurable: true
	});

	cacheStore.set(memoized, cache);

	return memoized;
};

export = mem;

/**
Returns a decorator which memoizes the function provided.

@example
```
import mem = require('mem');

class Example {
	constructor() {
		this.i = 0;
	}

	@mem.decorator()
	counter() {
		return ++this.i;
	}
}

class ExampleWithOptions {
	constructor() {
		this.i = 0;
	}

	@mem.decorator({maxAge: 1000})
	counter() {
		return ++this.i;
	}
}
```
*/
mem.decorator = <
	FunctionToMemoize extends AnyFunction,
	CacheKeyType
>(
	options: Options<FunctionToMemoize, CacheKeyType> = {}
) => (
	target: FunctionToMemoize,
	propertyKey: string,
	descriptor: PropertyDescriptor
): FunctionToMemoize => {
	if (typeof target !== 'function') {
		throw new TypeError('`target` must be a function');
	}

	descriptor.value = mem(target[propertyKey], options);

	return target;
};

/**
Clear all cached data of a memoized function.

@param fn - Memoized function.
*/
mem.clear = (fn: AnyFunction): void => {
	const cache = cacheStore.get(fn);
	if (!cache) {
		throw new TypeError('Can\'t clear a function that was not memoized!');
	}

	if (typeof cache.clear !== 'function') {
		throw new TypeError('The cache Map can\'t be cleared!');
	}

	cache.clear();
};
