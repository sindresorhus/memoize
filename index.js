'use strict';

var debug = require('debug')('mem');

function getPercent(partial, total) {
	return (partial * 100 / total).toFixed(2);
}

module.exports = function mem(fn, opts) {
	opts = opts || {};

	var cacheKey = opts.cacheKey || function cacheKey(x) {
		if (arguments.length === 1 && (x === null || x === undefined || (typeof x !== 'function' && typeof x !== 'object'))) {
			return x;
		}

		return JSON.stringify(arguments);
	};

	var stats = {
		hits: 0,
		miss: 0,
		total: 0
	};

	var statsCalls = 0;

	var memoized = function memoized() {
		++stats.total;

		var cache = memoized.__cache__;
		var key = cacheKey.apply(null, arguments);

		if (cache.has(key)) {
			var c = cache.get(key);

			if (typeof opts.maxAge !== 'number' || Date.now() < c.maxAge) {
				++stats.hits;
				memoized.stats();
				return c.data;
			}
		}

		++stats.miss;

		var ret = fn.apply(null, arguments);

		cache.set(key, {
			data: ret,
			maxAge: Date.now() + (opts.maxAge || 0)
		});

		memoized.stats();

		return ret;
	};

	memoized.displayName = fn.displayName || fn.name;
	memoized.__cache__ = opts.cache || new Map();

	memoized.stats = function stats() {
		if (++statsCalls < opts.maxStatsCalls || 0) {
			return;
		}

		var hits = getPercent(stats.hits, stats.total);
		var miss = getPercent(stats.miss, stats.total);
		debug('hits=%s, miss=%s', hits, miss);
		statsCalls = 0;
	};

	return memoized;
};
