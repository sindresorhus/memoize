import test from 'ava';
import delay from 'delay';
import m from '.';

test('memoize', t => {
	let i = 0;
	const f = () => i++;
	const memoized = m(f);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized('foo'), 1);
	t.is(memoized('foo'), 1);
	t.is(memoized('foo'), 1);
	t.is(memoized('foo', 'bar'), 2);
	t.is(memoized('foo', 'bar'), 2);
	t.is(memoized('foo', 'bar'), 2);
});

test('memoize itself is memoized', t => {
	let i = 0;
	const f = () => i++;
	let memoized = m(f);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	memoized = m(f);
	t.is(memoized(), 0);
	t.is(memoized('foo'), 1);
	t.is(memoized('foo'), 1);
	memoized = m(f);
	t.is(memoized('foo'), 1);
	t.is(memoized('foo', 'bar'), 2);
	t.is(memoized('foo', 'bar'), 2);
	memoized = m(f);
	t.is(memoized('foo', 'bar'), 2);

	// Resolves to same options bag, use memoized version
	memoized = m(f, {cachePromiseRejection: false});
	t.is(memoized(), 1);
	t.is(memoized('foo'), 1);
	t.is(memoized('foo', 'bar'), 2);

	// Resolves to different options bag, create new memoized version
	memoized = m(f, {cachePromiseRejection: true});
	t.is(memoized(), 3);
	t.is(memoized('foo'), 4);
	t.is(memoized('foo', 'bar'), 5);
	memoized = m(f, {cachePromiseRejection: true});
	t.is(memoized(), 3);
	t.is(memoized('foo'), 4);
	t.is(memoized('foo', 'bar'), 5);

	const cache = new Map();
	// Resolves to different options bag, create new memoized version
	memoized = m(f, {cache});
	t.is(memoized(), 6);
	t.is(memoized('foo'), 7);
	t.is(memoized('foo', 'bar'), 8);
	memoized = m(f, {cache});
	t.is(memoized(), 6);
	t.is(memoized('foo'), 7);
	t.is(memoized('foo', 'bar'), 8);

	const cacheKey = (...args) => JSON.stringify(...args);
	// Resolves to different options bag, create new memoized version
	memoized = m(f, {cacheKey});
	t.is(memoized(), 9);
	t.is(memoized('foo'), 10);
	t.is(memoized('foo', 'bar'), 11);
	memoized = m(f, {cacheKey});
	t.is(memoized(), 9);
	t.is(memoized('foo'), 10);
	t.is(memoized('foo', 'bar'), 11);
});

test('memoize with multiple non-primitive arguments', t => {
	let i = 0;
	const memoized = m(() => i++);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized({foo: true}, {bar: false}), 1);
	t.is(memoized({foo: true}, {bar: false}), 1);
	t.is(memoized({foo: true}, {bar: false}, {baz: true}), 2);
	t.is(memoized({foo: true}, {bar: false}, {baz: true}), 2);
});

test('maxAge option', async t => {
	let i = 0;
	const f = () => i++;
	const memoized = m(f, {maxAge: 100});
	t.is(memoized(1), 0);
	t.is(memoized(1), 0);
	await delay(50);
	t.is(memoized(1), 0);
	await delay(200);
	t.is(memoized(1), 1);
});

test('maxAge option deletes old items', async t => {
	let i = 0;
	const f = () => i++;
	const cache = new Map();
	const deleted = [];
	cache.delete = item => deleted.push(item);
	const memoized = m(f, {maxAge: 100, cache});
	t.is(memoized(1), 0);
	t.is(memoized(1), 0);
	t.is(cache.has(1), true);
	await delay(50);
	t.is(memoized(1), 0);
	t.is(deleted.length, 0);
	await delay(200);
	t.is(memoized(1), 1);
	t.is(deleted.length, 1);
	t.is(deleted[0], 1);
});

test('maxAge items are deleted even if function throws', async t => {
	let i = 0;
	const f = () => {
		if (i === 1) {
			throw new Error('failure');
		}
		return i++;
	};
	const cache = new Map();
	const memoized = m(f, {maxAge: 100, cache});
	t.is(memoized(1), 0);
	t.is(memoized(1), 0);
	t.is(cache.size, 1);
	await delay(50);
	t.is(memoized(1), 0);
	await delay(200);
	t.throws(() => memoized(1), 'failure');
	t.is(cache.size, 0);
});

test('cacheKey option', t => {
	let i = 0;
	const f = () => i++;
	const memoized = m(f, {cacheKey: x => x});
	t.is(memoized(1), 0);
	t.is(memoized(1), 0);
	t.is(memoized(1, 2), 0);
	t.is(memoized(2), 1);
	t.is(memoized(2, 1), 1);
});

test('cache option', t => {
	let i = 0;
	const f = () => i++;
	const memoized = m(f, {
		cache: new WeakMap(),
		cacheKey: x => x
	});
	const foo = {};
	const bar = {};
	t.is(memoized(foo), 0);
	t.is(memoized(foo), 0);
	t.is(memoized(bar), 1);
	t.is(memoized(bar), 1);
});

test('promise support', async t => {
	let i = 0;
	const memoized = m(async () => i++);
	t.is(await memoized(), 0);
	t.is(await memoized(), 0);
	t.is(await memoized(10), 1);
});

test('do not cache rejected promises', async t => {
	let i = 0;
	const memoized = m(async () => {
		i++;

		if (i === 1) {
			throw new Error('foo bar');
		}

		return i;
	});

	await t.throws(memoized(), 'foo bar');

	const first = memoized();
	const second = memoized();
	const third = memoized();

	t.is(await first, 2);
	t.is(await second, 2);
	t.is(await third, 2);
});

test('cache rejected promises if enabled', async t => {
	let i = 0;
	const memoized = m(async () => {
		i++;

		if (i === 1) {
			throw new Error('foo bar');
		}

		return i;
	}, {
		cachePromiseRejection: true
	});

	await t.throws(memoized(), 'foo bar');
	await t.throws(memoized(), 'foo bar');
	await t.throws(memoized(), 'foo bar');
});

test('preserves the original function name', t => {
	t.is(m(function foo() {}).name, 'foo'); // eslint-disable-line func-names, prefer-arrow-callback
});

test('.clear()', t => {
	let i = 0;
	const f = () => i++;
	const memoized = m(f);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	m.clear(memoized);
	t.is(memoized(), 1);
	t.is(memoized(), 1);
});

test('prototype support', t => {
	const f = function () {
		return this.i++;
	};

	const Unicorn = function () {
		this.i = 0;
	};
	Unicorn.prototype.foo = m(f);

	const unicorn = new Unicorn();

	t.is(unicorn.foo(), 0);
	t.is(unicorn.foo(), 0);
	t.is(unicorn.foo(), 0);
});
