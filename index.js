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

const mem = (fn, options = {}) => {
	const {
		cacheKey = defaultCacheKey,
		cache = new Map(),
		cachePromiseRejection = true,
		maxAge
	} = options;

	if (typeof maxAge === 'number') {
		mapAgeCleaner(cache);
	}

	const memoized = function (...arguments_) {
		const key = cacheKey(...arguments_);

		if (cache.has(key)) {
			return maxAge ? cache.get(key).data : cache.get(key);
		}

		const cacheItem = fn.call(this, ...arguments_);

		cache.set(key, maxAge ? {
			data: cacheItem,
			maxAge: Date.now() + maxAge
		} : cacheItem);

		if (isPromise(cacheItem) && cachePromiseRejection === false) {
			// Remove rejected promises from cache if `cachePromiseRejection` is set to `false`
			cacheItem.catch(() => cache.delete(key));
		}

		return cacheItem;
	};

	try {
		// The below call will throw in some host environments
		// See https://github.com/sindresorhus/mimic-fn/issues/10
		mimicFn(memoized, fn);
	} catch (_) {}

	cacheStore.set(memoized, cache);

	return memoized;
};

module.exports = mem;

module.exports.clear = fn => {
	const cache = cacheStore.get(fn);

	if (cache && typeof cache.clear === 'function') {
		cache.clear();
	}
};
