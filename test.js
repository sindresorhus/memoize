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

test.failing('memoize with regexp arguments', t => {
	let i = 0;
	const memoized = m(() => i++);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(/Sindre Sorhus/), 1);
	t.is(memoized(/Sindre Sorhus/), 1);
	t.is(memoized(/Elvin Peng/), 2);
	t.is(memoized(/Elvin Peng/), 2);
});

test.failing('memoize with Symbol arguments', t => {
	let i = 0;
	const arg1 = Symbol('fixture1');
	const arg2 = Symbol('fixture2');
	const memoized = m(() => i++);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(arg1), 1);
	t.is(memoized(arg1), 1);
	t.is(memoized(arg2), 2);
	t.is(memoized(arg2), 2);
	t.is(memoized({foo: arg1}), 3);
	t.is(memoized({foo: arg1}), 3);
	t.is(memoized({foo: arg2}), 4);
	t.is(memoized({foo: arg2}), 4);
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
	const remove = cache.delete.bind(cache);
	cache.delete = item => {
		deleted.push(item);
		return remove(item);
	};
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
