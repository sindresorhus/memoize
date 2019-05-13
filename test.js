import test from 'ava';
import delay from 'delay';
import mem from '.';

test('memoize', t => {
	let i = 0;
	const fixture = () => i++;
	const memoized = mem(fixture);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized('foo'), 1);
	t.is(memoized('foo'), 1);
	t.is(memoized('foo'), 1);
	t.is(memoized('foo', 'bar'), 2);
	t.is(memoized('foo', 'bar'), 2);
	t.is(memoized('foo', 'bar'), 2);
	t.is(memoized(1), 3);
	t.is(memoized(1), 3);
	t.is(memoized(null), 4);
	t.is(memoized(null), 4);
	t.is(memoized(undefined), 5);
	t.is(memoized(undefined), 5);
	t.is(memoized(fixture), 6);
	t.is(memoized(fixture), 6);
	t.is(memoized(true), 7);
	t.is(memoized(true), 7);

	t.is(memoized(() => i++), 8);
	t.is(memoized(() => i++), 9);
});

test('memoize with multiple non-primitive arguments', t => {
	let i = 0;
	const memoized = mem(() => i++);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized({foo: true}, {bar: false}), 1);
	t.is(memoized({foo: true}, {bar: false}), 1);
	t.is(memoized({foo: true}, {bar: false}, {baz: true}), 2);
	t.is(memoized({foo: true}, {bar: false}, {baz: true}), 2);
});

test.failing('memoize with regexp arguments', t => {
	let i = 0;
	const memoized = mem(() => i++);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(/Sindre Sorhus/), 1);
	t.is(memoized(/Sindre Sorhus/), 1);
	t.is(memoized(/Elvin Peng/), 2);
	t.is(memoized(/Elvin Peng/), 2);
});

test.failing('memoize with Symbol arguments', t => {
	let i = 0;
	const argument1 = Symbol('fixture1');
	const argument2 = Symbol('fixture2');
	const memoized = mem(() => i++);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(argument1), 1);
	t.is(memoized(argument1), 1);
	t.is(memoized(argument2), 2);
	t.is(memoized(argument2), 2);
	t.is(memoized({foo: argument1}), 3);
	t.is(memoized({foo: argument1}), 3);
	t.is(memoized({foo: argument2}), 4);
	t.is(memoized({foo: argument2}), 4);
});

test('maxAge option', async t => {
	let i = 0;
	const fixture = () => i++;
	const memoized = mem(fixture, {maxAge: 100});
	t.is(memoized(1), 0);
	t.is(memoized(1), 0);
	await delay(50);
	t.is(memoized(1), 0);
	await delay(200);
	t.is(memoized(1), 1);
});

test('maxAge option deletes old items', async t => {
	let i = 0;
	const fixture = () => i++;
	const cache = new Map();
	const deleted = [];
	const remove = cache.delete.bind(cache);
	cache.delete = item => {
		deleted.push(item);
		return remove(item);
	};

	const memoized = mem(fixture, {maxAge: 100, cache});
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
	const fixture = () => {
		if (i === 1) {
			throw new Error('failure');
		}

		return i++;
	};

	const cache = new Map();
	const memoized = mem(fixture, {maxAge: 100, cache});
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
	const fixture = () => i++;
	const memoized = mem(fixture, {cacheKey: x => x});
	t.is(memoized(1), 0);
	t.is(memoized(1), 0);
	t.is(memoized(1, 2), 0);
	t.is(memoized(2), 1);
	t.is(memoized(2, 1), 1);
});

test('cache option', t => {
	let i = 0;
	const fixture = () => i++;
	const memoized = mem(fixture, {
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
	const memoized = mem(async () => i++);
	t.is(await memoized(), 0);
	t.is(await memoized(), 0);
	t.is(await memoized(10), 1);
});

test('do not cache rejected promises', async t => {
	let i = 0;
	const memoized = mem(async () => {
		i++;

		if (i === 1) {
			throw new Error('foo bar');
		}

		return i;
	});

	await t.throwsAsync(memoized(), 'foo bar');

	const first = memoized();
	const second = memoized();
	const third = memoized();

	t.is(await first, 2);
	t.is(await second, 2);
	t.is(await third, 2);
});

test('cache rejected promises if enabled', async t => {
	let i = 0;
	const memoized = mem(async () => {
		i++;

		if (i === 1) {
			throw new Error('foo bar');
		}

		return i;
	}, {
		cachePromiseRejection: true
	});

	await t.throwsAsync(memoized(), 'foo bar');
	await t.throwsAsync(memoized(), 'foo bar');
	await t.throwsAsync(memoized(), 'foo bar');
});

test('preserves the original function name', t => {
	t.is(mem(function foo() {}).name, 'foo'); // eslint-disable-line func-names
});

test('.clear()', t => {
	let i = 0;
	const fixture = () => i++;
	const memoized = mem(fixture);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	mem.clear(memoized);
	t.is(memoized(), 1);
	t.is(memoized(), 1);
});

test('prototype support', t => {
	const fixture = function () {
		return this.i++;
	};

	const Unicorn = function () {
		this.i = 0;
	};

	Unicorn.prototype.foo = mem(fixture);

	const unicorn = new Unicorn();

	t.is(unicorn.foo(), 0);
	t.is(unicorn.foo(), 0);
	t.is(unicorn.foo(), 0);
});
