import test from 'ava';
import delay from 'delay';
import serializeJavascript = require('serialize-javascript');
import mem = require('.');

test('memoize', t => {
	let i = 0;
	const fixture = () => i++;
	const memoized = mem(fixture);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	// @ts-expect-error
	t.is(memoized(undefined), 0);
	// @ts-expect-error
	t.is(memoized(undefined), 0);
	// @ts-expect-error
	t.is(memoized('foo'), 1);
	// @ts-expect-error
	t.is(memoized('foo'), 1);
	// @ts-expect-error
	t.is(memoized('foo'), 1);
	// @ts-expect-error
	t.is(memoized('foo', 'bar'), 1);
	// @ts-expect-error
	t.is(memoized('foo', 'bar'), 1);
	// @ts-expect-error
	t.is(memoized('foo', 'bar'), 1);
	// @ts-expect-error
	t.is(memoized(1), 2);
	// @ts-expect-error
	t.is(memoized(1), 2);
	// @ts-expect-error
	t.is(memoized(null), 3);
	// @ts-expect-error
	t.is(memoized(null), 3);
	// @ts-expect-error
	t.is(memoized(fixture), 4);
	// @ts-expect-error
	t.is(memoized(fixture), 4);
	// @ts-expect-error
	t.is(memoized(true), 5);
	// @ts-expect-error
	t.is(memoized(true), 5);

	// Ensure that functions are stored by reference and not by "value" (e.g. their `.toString()` representation)
	// @ts-expect-error
	t.is(memoized(() => i++), 6);
	// @ts-expect-error
	t.is(memoized(() => i++), 7);
});

test('cacheKey option', t => {
	let i = 0;
	const fixture = () => i++;
	const memoized = mem(fixture, {cacheKey: ([firstArgument]) => String(firstArgument)});
	// @ts-expect-error
	t.is(memoized(1), 0);
	// @ts-expect-error
	t.is(memoized(1), 0);
	// @ts-expect-error
	t.is(memoized('1'), 0);
	// @ts-expect-error
	t.is(memoized('2'), 1);
	// @ts-expect-error
	t.is(memoized(2), 1);
});

test('memoize with multiple non-primitive arguments', t => {
	let i = 0;
	const memoized = mem(() => i++, {cacheKey: JSON.stringify});
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	// @ts-expect-error
	t.is(memoized({foo: true}, {bar: false}), 1);
	// @ts-expect-error
	t.is(memoized({foo: true}, {bar: false}), 1);
	// @ts-expect-error
	t.is(memoized({foo: true}, {bar: false}, {baz: true}), 2);
	// @ts-expect-error
	t.is(memoized({foo: true}, {bar: false}, {baz: true}), 2);
});

test('memoize with regexp arguments', t => {
	let i = 0;
	const memoized = mem(() => i++, {cacheKey: serializeJavascript});
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	// @ts-expect-error
	t.is(memoized(/Sindre Sorhus/), 1);
	// @ts-expect-error
	t.is(memoized(/Sindre Sorhus/), 1);
	// @ts-expect-error
	t.is(memoized(/Elvin Peng/), 2);
	// @ts-expect-error
	t.is(memoized(/Elvin Peng/), 2);
});

test('memoize with Symbol arguments', t => {
	let i = 0;
	const argument1 = Symbol('fixture1');
	const argument2 = Symbol('fixture2');
	const memoized = mem(() => i++);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	// @ts-expect-error
	t.is(memoized(argument1), 1);
	// @ts-expect-error
	t.is(memoized(argument1), 1);
	// @ts-expect-error
	t.is(memoized(argument2), 2);
	// @ts-expect-error
	t.is(memoized(argument2), 2);
});

test('maxAge option', async t => {
	let i = 0;
	const fixture = () => i++;
	const memoized = mem(fixture, {maxAge: 100});
	// @ts-expect-error
	t.is(memoized(1), 0);
	// @ts-expect-error
	t.is(memoized(1), 0);
	await delay(50);
	// @ts-expect-error
	t.is(memoized(1), 0);
	await delay(200);
	// @ts-expect-error
	t.is(memoized(1), 1);
});

test('maxAge option deletes old items', async t => {
	let i = 0;
	const fixture = () => i++;
	const cache = new Map<number, number>();
	const deleted: number[] = [];
	const _delete = cache.delete.bind(cache);
	cache.delete = item => {
		deleted.push(item);
		return _delete(item);
	};

	// @ts-expect-error
	const memoized = mem(fixture, {maxAge: 100, cache});
	// @ts-expect-error
	t.is(memoized(1), 0);
	// @ts-expect-error
	t.is(memoized(1), 0);
	t.is(cache.has(1), true);
	await delay(50);
	// @ts-expect-error
	t.is(memoized(1), 0);
	t.is(deleted.length, 0);
	await delay(200);
	// @ts-expect-error
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
	// @ts-expect-error
	t.is(memoized(1), 0);
	// @ts-expect-error
	t.is(memoized(1), 0);
	t.is(cache.size, 1);
	await delay(50);
	// @ts-expect-error
	t.is(memoized(1), 0);
	await delay(200);
	// @ts-expect-error
	t.throws(() => {
		memoized(1);
	}, {message: 'failure'});
	t.is(cache.size, 0);
});

test('cache option', t => {
	let i = 0;
	const fixture = () => i++;
	const memoized = mem(fixture, {
		// @ts-expect-error
		cache: new WeakMap(),
		cacheKey: ([firstArgument]) => firstArgument
	});
	const foo = {};
	const bar = {};
	// @ts-expect-error
	t.is(memoized(foo), 0);
	// @ts-expect-error
	t.is(memoized(foo), 0);
	// @ts-expect-error
	t.is(memoized(bar), 1);
	// @ts-expect-error
	t.is(memoized(bar), 1);
});

test('promise support', async t => {
	let i = 0;
	const memoized = mem(async () => i++);
	t.is(await memoized(), 0);
	t.is(await memoized(), 0);
	// @ts-expect-error
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
	class Unicorn {
		i = 0;
		foo() {
			return this.i++;
		}
	}

	Unicorn.prototype.foo = mem(Unicorn.prototype.foo);

	const unicorn = new Unicorn();

	t.is(unicorn.foo(), 0);
	t.is(unicorn.foo(), 0);
	t.is(unicorn.foo(), 0);
});

test('mem.clear() throws when called with a plain function', t => {
	t.throws(() => {
		mem.clear(() => {});
	}, {
		message: 'Can\'t clear a function that was not memoized!',
		instanceOf: TypeError
	});
});

test('mem.clear() throws when called on an unclearable cache', t => {
	const fixture = () => 1;
	const memoized = mem(fixture, {
		// @ts-expect-error
		cache: new WeakMap()
	});

	t.throws(() => {
		mem.clear(memoized);
	}, {
		message: 'The cache Map can\'t be cleared!',
		instanceOf: TypeError
	});
});
