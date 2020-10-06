import test from 'ava';
import delay from 'delay';
const serializeJavascript = require('serialize-javascript');
const mem = require('.');

test('memoize', t => {
	let i = 0;
	const fixture = () => i++;
	const memoized = mem(fixture);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(undefined), 0);
	t.is(memoized(undefined), 0);
	t.is(memoized('foo'), 1);
	t.is(memoized('foo'), 1);
	t.is(memoized('foo'), 1);
	t.is(memoized('foo', 'bar'), 1);
	t.is(memoized('foo', 'bar'), 1);
	t.is(memoized('foo', 'bar'), 1);
	t.is(memoized(1), 2);
	t.is(memoized(1), 2);
	t.is(memoized(null), 3);
	t.is(memoized(null), 3);
	t.is(memoized(fixture), 4);
	t.is(memoized(fixture), 4);
	t.is(memoized(true), 5);
	t.is(memoized(true), 5);

	// Ensure that functions are stored by reference and not by "value" (e.g. their `.toString()` representation)
	t.is(memoized(() => i++), 6);
	t.is(memoized(() => i++), 7);
});

test('cacheKey option', t => {
	let i = 0;
	const fixture = () => i++;
	const memoized = mem(fixture, {cacheKey: ([firstArgument]) => String(firstArgument)});
	t.is(memoized(1), 0);
	t.is(memoized(1), 0);
	t.is(memoized('1'), 0);
	t.is(memoized('2'), 1);
	t.is(memoized(2), 1);
});

test('memoize with multiple non-primitive arguments', t => {
	let i = 0;
	const memoized = mem(() => i++, {cacheKey: JSON.stringify});
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized({foo: true}, {bar: false}), 1);
	t.is(memoized({foo: true}, {bar: false}), 1);
	t.is(memoized({foo: true}, {bar: false}, {baz: true}), 2);
	t.is(memoized({foo: true}, {bar: false}, {baz: true}), 2);
});

test('memoize with regexp arguments', t => {
	let i = 0;
	const memoized = mem(() => i++, {cacheKey: serializeJavascript});
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(/Sindre Sorhus/), 1);
	t.is(memoized(/Sindre Sorhus/), 1);
	t.is(memoized(/Elvin Peng/), 2);
	t.is(memoized(/Elvin Peng/), 2);
});

test('memoize with Symbol arguments', t => {
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

test('cache option', t => {
	let i = 0;
	const fixture = () => i++;
	const memoized = mem(fixture, {
		cache: new WeakMap(),
		cacheKey: ([firstArgument]) => firstArgument
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

test('mem.clear() throws when called with a plain function', t => {
	t.throws(() => {
		mem.clear(() => {});
	}, 'Can\'t clear a function that was not memoized!');
});
