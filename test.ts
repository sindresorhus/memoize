import test from 'ava';
import delay from 'delay';
import serializeJavascript from 'serialize-javascript';
import mem, {memDecorator, memClear} from './index.js';

test('memoize', t => {
	let i = 0;
	const fixture = (a?: unknown, b?: unknown) => i++;
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
	const fixture = (..._arguments: any) => i++;
	const memoized = mem(fixture, {cacheKey: ([firstArgument]) => String(firstArgument)});
	t.is(memoized(1), 0);
	t.is(memoized(1), 0);
	t.is(memoized('1'), 0);
	t.is(memoized('2'), 1);
	t.is(memoized(2), 1);
});

test('memoize with multiple non-primitive arguments', t => {
	let i = 0;
	const memoized = mem((a?: unknown, b?: unknown, c?: unknown) => i++, {cacheKey: JSON.stringify});
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized({foo: true}, {bar: false}), 1);
	t.is(memoized({foo: true}, {bar: false}), 1);
	t.is(memoized({foo: true}, {bar: false}, {baz: true}), 2);
	t.is(memoized({foo: true}, {bar: false}, {baz: true}), 2);
});

test('memoize with regexp arguments', t => {
	let i = 0;
	const memoized = mem((a?: unknown) => i++, {cacheKey: serializeJavascript});
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
	const memoized = mem((a?: unknown) => i++);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(argument1), 1);
	t.is(memoized(argument1), 1);
	t.is(memoized(argument2), 2);
	t.is(memoized(argument2), 2);
});

test('maxAge option', async t => {
	let i = 0;
	const fixture = (a?: unknown) => i++;
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
	const fixture = (a?: unknown) => i++;
	const cache = new Map<number, number>();
	const deleted: number[] = [];
	const _delete = cache.delete.bind(cache);
	cache.delete = item => {
		deleted.push(item);
		return _delete(item);
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
	const fixture = (a?: unknown) => {
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
	t.throws(() => {
		memoized(1);
	}, {message: 'failure'});
	t.is(cache.size, 0);
});

test('cache option', t => {
	let i = 0;
	const fixture = (..._arguments: any) => i++;
	const memoized = mem(fixture, {
		cache: new WeakMap(),
		cacheKey: <ReturnValue>([firstArgument]: [ReturnValue]): ReturnValue => firstArgument,
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
	const memoized = mem(async (a?: unknown) => i++);
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
	memClear(memoized);
	t.is(memoized(), 1);
	t.is(memoized(), 1);
});

test('prototype support', t => {
	class Unicorn {
		index = 0;
		foo() {
			return this.index++;
		}
	}

	Unicorn.prototype.foo = mem(Unicorn.prototype.foo);

	const unicorn = new Unicorn();

	t.is(unicorn.foo(), 0);
	t.is(unicorn.foo(), 0);
	t.is(unicorn.foo(), 0);
});

test('.decorator()', t => {
	let returnValue = 1;
	const returnValue2 = 101;

	class TestClass {
		@memDecorator()
		counter() {
			return returnValue++;
		}

		@memDecorator()
		counter2() {
			return returnValue2;
		}
	}

	const alpha = new TestClass();
	t.is(alpha.counter(), 1);
	t.is(alpha.counter(), 1, 'The method should be memoized');
	t.is(alpha.counter2(), 101, 'The method should be memoized separately from the other one');

	const beta = new TestClass();
	t.is(beta.counter(), 2, 'The method should not be memoized across instances');
});

test('memClear() throws when called with a plain function', t => {
	t.throws(() => {
		memClear(() => {});
	}, {
		message: 'Can\'t clear a function that was not memoized!',
		instanceOf: TypeError,
	});
});

test('memClear() throws when called on an unclearable cache', t => {
	const fixture = () => 1;
	const memoized = mem(fixture, {
		cache: new WeakMap(),
	});

	t.throws(() => {
		memClear(memoized);
	}, {
		message: 'The cache Map can\'t be cleared!',
		instanceOf: TypeError,
	});
});
