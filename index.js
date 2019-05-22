'use strict';
const mimicFn = require('mimic-fn');
const isPromise = require('p-is-promise');
const mapAgeCleaner = require('map-age-cleaner');

const cacheStore = new WeakMap();

const defaultCacheKey = (...arguments_) => {
	if (arguments_.length === 0) {
		return '__defaultKey';
	}

	if (arguments_.length === 1) {
		const [firstArgument] = arguments_;
		const isObject = typeof firstArgument === 'object' && firstArgument !== null;
		const isPrimitive = !isObject;
		if (isPrimitive) {
			return firstArgument;
		}
	}

	return JSON.stringify(arguments_);
};

const mem = (fn, options) => {
	options = {
		cacheKey: defaultCacheKey,
		cache: new Map(),
		cachePromiseRejection: true,
		...options
	};

	if (typeof options.maxAge === 'number') {
		mapAgeCleaner(options.cache);
	}

	const {cache} = options;
	options.maxAge = options.maxAge || 0;

	const setData = (key, data) => {
		cache.set(key, {
			data,
			maxAge: Date.now() + options.maxAge
		});
	};

	const memoized = function (...arguments_) {
		const key = options.cacheKey(...arguments_);

		if (cache.has(key)) {
			return cache.get(key).data;
		}

		const cacheItem = fn.call(this, ...arguments_);

		setData(key, cacheItem);

		if (isPromise(cacheItem) && options.cachePromiseRejection === false) {
			// Remove rejected promises from cache unless `cachePromiseRejection` is set to `true`
			cacheItem.catch(() => cache.delete(key));
		}

		return cacheItem;
	};

	try {
		// The below call will throw in some host environments
		// See https://github.com/sindresorhus/mimic-fn/issues/10
		mimicFn(memoized, fn);
	} catch (_) {}

	cacheStore.set(memoized, options.cache);

	return memoized;
};

module.exports = mem;

module.exports.clear = fn => {
	if (!cacheStore.has(fn)) {
		throw new Error('Can\'t clear a function that was not memoized!');
	}

	const cache = cacheStore.get(fn);
	if (typeof cache.clear === 'function') {
		cache.clear();
	}
};
