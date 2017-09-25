import test from 'ava';
import delay from 'delay';
import m from './';

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
	const memoized = m(() => Promise.resolve(i++));
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
	t.is(await memoized(), 2);
	t.is(await memoized(), 2);
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
