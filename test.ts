import test from 'ava';
import delay from 'delay';
import serializeJavascript from 'serialize-javascript';
import memoize, {memoizeDecorator, memoizeClear, memoizeIsCached} from './index.js';

test('memoize', t => {
	let index = 0;
	const fixture = (a?: unknown, b?: unknown) => index++;
	const memoized = memoize(fixture);
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
	t.is(memoized(() => index++), 6);
	t.is(memoized(() => index++), 7);
});

test('cacheKey option', t => {
	let index = 0;
	const fixture = (..._arguments: any) => index++;
	const memoized = memoize(fixture, {cacheKey: ([firstArgument]) => String(firstArgument)});
	t.is(memoized(1), 0);
	t.is(memoized(1), 0);
	t.is(memoized('1'), 0);
	t.is(memoized('2'), 1);
	t.is(memoized(2), 1);
});

test('memoize with multiple non-primitive arguments', t => {
	let index = 0;
	const memoized = memoize((a?: unknown, b?: unknown, c?: unknown) => index++, {cacheKey: JSON.stringify});
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized({foo: true}, {bar: false}), 1);
	t.is(memoized({foo: true}, {bar: false}), 1);
	t.is(memoized({foo: true}, {bar: false}, {baz: true}), 2);
	t.is(memoized({foo: true}, {bar: false}, {baz: true}), 2);
});

test('memoize with regexp arguments', t => {
	let index = 0;
	const memoized = memoize((a?: unknown) => index++, {cacheKey: serializeJavascript});
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(/Sindre Sorhus/), 1);
	t.is(memoized(/Sindre Sorhus/), 1);
	t.is(memoized(/Elvin Peng/), 2);
	t.is(memoized(/Elvin Peng/), 2);
});

test('memoize with Symbol arguments', t => {
	let index = 0;
	const argument1 = Symbol('fixture1');
	const argument2 = Symbol('fixture2');
	const memoized = memoize((a?: unknown) => index++);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(argument1), 1);
	t.is(memoized(argument1), 1);
	t.is(memoized(argument2), 2);
	t.is(memoized(argument2), 2);
});

test('maxAge option', async t => {
	let index = 0;
	const fixture = (a?: unknown) => index++;
	const memoized = memoize(fixture, {maxAge: 100});
	t.is(memoized(1), 0);
	t.is(memoized(1), 0);
	await delay(50);
	t.is(memoized(1), 0);
	await delay(200);
	t.is(memoized(1), 1);
});

test('maxAge option deletes old items', async t => {
	let index = 0;
	const fixture = (a?: unknown) => index++;
	const cache = new Map<number, number>();
	const deleted: number[] = [];
	const _delete = cache.delete.bind(cache);
	cache.delete = item => {
		deleted.push(item);
		return _delete(item);
	};

	const memoized = memoize(fixture, {maxAge: 100, cache});
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
	let index = 0;
	const fixture = (a?: unknown) => {
		if (index === 1) {
			throw new Error('failure');
		}

		return index++;
	};

	const cache = new Map();
	const memoized = memoize(fixture, {maxAge: 100, cache});
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
	let index = 0;
	const fixture = (..._arguments: any) => index++;
	const memoized = memoize(fixture, {
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
	let index = 0;
	const memoized = memoize(async (a?: unknown) => index++);
	t.is(await memoized(), 0);
	t.is(await memoized(), 0);
	t.is(await memoized(10), 1);
});

test('preserves the original function name', t => {
	t.is(memoize(function foo() {}).name, 'foo'); // eslint-disable-line func-names, @typescript-eslint/no-empty-function
});

test('.clear()', t => {
	let index = 0;
	const fixture = () => index++;
	const memoized = memoize(fixture);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	memoizeClear(memoized);
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

	Unicorn.prototype.foo = memoize(Unicorn.prototype.foo);

	const unicorn = new Unicorn();

	t.is(unicorn.foo(), 0);
	t.is(unicorn.foo(), 0);
	t.is(unicorn.foo(), 0);
});

test('memoizeDecorator()', t => {
	let returnValue = 1;
	const returnValue2 = 101;

	class TestClass {
		@memoizeDecorator()
		counter() {
			return returnValue++;
		}

		@memoizeDecorator()
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

test('memoizeDecorator() does not call getters during decoration', t => {
	class TestClass {
		isInitialized = false;

		constructor() {
			this.isInitialized = true;
		}

		@memoizeDecorator()
		get value() {
			if (!this.isInitialized) {
				throw new Error('constructor has not been called');
			}

			return Math.random();
		}
	}

	const instance = new TestClass();
	t.notThrows(() => {
		const {value} = instance;
		t.is(instance.value, value);
	});
});

test('memoizeDecorator() applies options to getters', async t => {
	class TestClass {
		value = 0;

		@memoizeDecorator({maxAge: 50})
		get nextValue() {
			this.value++;
			return this.value;
		}
	}

	const instance = new TestClass();
	t.is(instance.nextValue, 1);
	t.is(instance.nextValue, 1);
	await delay(70);
	t.is(instance.nextValue, 2);
});

test('memoizeDecorator() memoizes getters per instance', t => {
	class TestClass {
		value = 0;

		@memoizeDecorator()
		get nextValue() {
			this.value++;
			return this.value;
		}
	}

	const firstInstance = new TestClass();
	const secondInstance = new TestClass();

	t.is(firstInstance.nextValue, 1);
	t.is(firstInstance.nextValue, 1);
	t.is(secondInstance.nextValue, 1);
	t.is(secondInstance.nextValue, 1);
});

test('memoizeDecorator() works with static methods', t => {
	let value = 0;

	class BaseClass {
		value = 0;

		@memoizeDecorator()
		static nextValue(key: string) {
			value++;
			return `${this.name}-${key}-${value}`;
		}
	}

	class ChildClass extends BaseClass {}

	t.false(Object.hasOwn(ChildClass, 'nextValue'));

	t.is(BaseClass.nextValue('a'), 'BaseClass-a-1');
	t.is(BaseClass.nextValue('a'), 'BaseClass-a-1');
	t.true(memoizeIsCached(BaseClass.nextValue, 'a'));

	t.is(ChildClass.nextValue('a'), 'ChildClass-a-2');
	t.is(ChildClass.nextValue('a'), 'ChildClass-a-2');
	t.true(memoizeIsCached(ChildClass.nextValue, 'a'));
	t.true(Object.hasOwn(ChildClass, 'nextValue'));
	t.false(Object.prototype.propertyIsEnumerable.call(ChildClass, 'nextValue'));

	memoizeClear(BaseClass.nextValue);
	t.is(BaseClass.nextValue('a'), 'BaseClass-a-3');
	t.is(ChildClass.nextValue('a'), 'ChildClass-a-2');
});

test('memoizeDecorator() keeps static method caches isolated per receiver', t => {
	let value = 0;

	class BaseClass {
		value = 0;

		@memoizeDecorator()
		static nextValue(key: string) {
			value++;
			return `${this.name}-${key}-${value}`;
		}
	}

	class ChildClass extends BaseClass {}

	t.not(BaseClass.nextValue, ChildClass.nextValue);
	t.is(BaseClass.nextValue('a'), 'BaseClass-a-1');
	t.is(ChildClass.nextValue('a'), 'ChildClass-a-2');
	t.true(memoizeIsCached(BaseClass.nextValue, 'a'));
	t.true(memoizeIsCached(ChildClass.nextValue, 'a'));

	memoizeClear(ChildClass.nextValue);
	t.true(memoizeIsCached(BaseClass.nextValue, 'a'));
	t.false(memoizeIsCached(ChildClass.nextValue, 'a'));
	t.is(BaseClass.nextValue('a'), 'BaseClass-a-1');
	t.is(ChildClass.nextValue('a'), 'ChildClass-a-3');
});

test('memoizeDecorator() preserves late binding for deep static inheritance', t => {
	let value = 0;

	class BaseClass {
		value = 0;

		@memoizeDecorator()
		static nextValue(key: string) {
			value++;
			return `${this.name}-${key}-${value}`;
		}
	}

	class ChildClass extends BaseClass {}
	class GrandChildClass extends ChildClass {}

	t.is(ChildClass.nextValue('a'), 'ChildClass-a-1');
	t.is(ChildClass.nextValue('a'), 'ChildClass-a-1');
	t.is(GrandChildClass.nextValue('a'), 'GrandChildClass-a-2');
	t.is(GrandChildClass.nextValue('a'), 'GrandChildClass-a-2');
	t.true(memoizeIsCached(ChildClass.nextValue, 'a'));
	t.true(memoizeIsCached(GrandChildClass.nextValue, 'a'));
});

test('memoizeDecorator() preserves static overrides that call super', t => {
	class BaseClass {
		static count = 0;
		value = 0;

		@memoizeDecorator()
		static nextValue() {
			this.count ??= 0;
			this.count++;
			return `${this.name}-${this.count}`;
		}
	}

	class ChildClass extends BaseClass {
		static count = 0;

		static override nextValue() {
			return `child:${super.nextValue()}`;
		}
	}

	class GrandChildClass extends ChildClass {
		static count = 0;
	}

	t.is(ChildClass.nextValue(), 'child:ChildClass-1');
	t.is(ChildClass.nextValue(), 'child:ChildClass-1');
	t.is(GrandChildClass.nextValue(), 'child:GrandChildClass-1');
	t.is(GrandChildClass.nextValue(), 'child:GrandChildClass-1');
	t.is(ChildClass.count, 1);
	t.is(GrandChildClass.count, 1);
});

test('memoizeDecorator() installs instance methods as non-enumerable own properties', t => {
	let value = 0;

	class TestClass {
		@memoizeDecorator()
		nextValue() {
			value++;
			return value;
		}
	}

	const instance = new TestClass();
	t.true(Object.hasOwn(instance, 'nextValue'));

	const methodBeforeCall = instance.nextValue;
	t.is(instance.nextValue(), 1);
	t.is(instance.nextValue(), 1);
	t.true(Object.hasOwn(instance, 'nextValue'));
	t.is(instance.nextValue, methodBeforeCall);

	const descriptor = Object.getOwnPropertyDescriptor(instance, 'nextValue');
	t.truthy(descriptor);
	t.is(descriptor?.enumerable, false);
	t.is(descriptor?.configurable, true);
	t.is(descriptor?.writable, true);
});

test('memoizeDecorator() keeps instance method caches isolated per instance', t => {
	let value = 0;

	class TestClass {
		@memoizeDecorator()
		nextValue(key: string) {
			value++;
			return `${key}-${value}`;
		}
	}

	const firstInstance = new TestClass();
	const secondInstance = new TestClass();

	t.not(firstInstance.nextValue, secondInstance.nextValue);
	t.is(firstInstance.nextValue('a'), 'a-1');
	t.is(secondInstance.nextValue('a'), 'a-2');
	t.true(memoizeIsCached(firstInstance.nextValue, 'a'));
	t.true(memoizeIsCached(secondInstance.nextValue, 'a'));

	memoizeClear(firstInstance.nextValue);
	t.false(memoizeIsCached(firstInstance.nextValue, 'a'));
	t.true(memoizeIsCached(secondInstance.nextValue, 'a'));
	t.is(firstInstance.nextValue('a'), 'a-3');
	t.is(secondInstance.nextValue('a'), 'a-2');
});

test('memoizeDecorator() memoizes inherited methods per instance', t => {
	let value = 0;

	class BaseClass {
		@memoizeDecorator()
		nextValue() {
			value++;
			return `${this.constructor.name}-${value}`;
		}
	}

	class ChildClass extends BaseClass {}

	const baseInstance = new BaseClass();
	const childInstance = new ChildClass();

	t.true(Object.hasOwn(baseInstance, 'nextValue'));
	t.true(Object.hasOwn(childInstance, 'nextValue'));
	t.is(baseInstance.nextValue(), 'BaseClass-1');
	t.is(baseInstance.nextValue(), 'BaseClass-1');
	t.is(childInstance.nextValue(), 'ChildClass-2');
	t.is(childInstance.nextValue(), 'ChildClass-2');
	t.true(Object.hasOwn(childInstance, 'nextValue'));
});

test('memoizeDecorator() preserves subclass overrides', t => {
	let baseValue = 0;
	let childValue = 0;

	class BaseClass {
		@memoizeDecorator()
		value() {
			baseValue++;
			return `base-${baseValue}`;
		}
	}

	class ChildClass extends BaseClass {
		override value() {
			childValue++;
			return `child-${childValue}`;
		}
	}

	const baseInstance = new BaseClass();
	t.is(baseInstance.value(), 'base-1');
	t.is(baseInstance.value(), 'base-1');

	const childInstance = new ChildClass();
	t.is(childInstance.value(), 'child-1');
	t.is(childInstance.value(), 'child-2');
});

test('memoizeDecorator() does not touch overridden accessors during super()', t => {
	class BaseClass {
		@memoizeDecorator()
		value() {
			return 'base';
		}
	}

	class ChildClass extends BaseClass {
		isInitialized = false;

		constructor() {
			super();
			this.isInitialized = true;
		}

		override get value() {
			if (!this.isInitialized) {
				throw new Error('constructor has not finished');
			}

			return () => 'child';
		}
	}

	const instance = new ChildClass();
	t.is(instance.value(), 'child');
});

test('memoizeDecorator() keeps extracted methods bound to their instance', t => {
	class TestClass {
		count = 0;

		@memoizeDecorator()
		nextValue(key: string) {
			this.count++;
			return `${this.count}-${key}`;
		}
	}

	const firstInstance = new TestClass();
	const secondInstance = new TestClass();
	const {nextValue} = firstInstance;

	t.is(nextValue('a'), '1-a');
	t.is(nextValue('a'), '1-a');
	t.is(firstInstance.count, 1);
	t.is(secondInstance.count, 0);
});

test('memoizeDecorator() keeps extracted static methods bound to their class', t => {
	class BaseClass {
		static count = 0;

		value = 0;

		@memoizeDecorator()
		static nextValue(key: string) {
			this.count ??= 0;
			this.count++;
			return `${this.name}-${this.count}-${key}`;
		}
	}

	class ChildClass extends BaseClass {
		static count = 0;
	}

	const {nextValue} = BaseClass;

	t.is(nextValue('a'), 'BaseClass-1-a');
	t.is(nextValue('a'), 'BaseClass-1-a');
	t.is(BaseClass.count, 1);
	t.is(ChildClass.count, 0);
});

test('memoizeDecorator() utilities work with extracted instance methods', t => {
	class TestClass {
		count = 0;

		@memoizeDecorator()
		nextValue(key: string) {
			this.count++;
			return `${this.count}-${key}`;
		}
	}

	const firstInstance = new TestClass();
	const secondInstance = new TestClass();
	const {nextValue} = firstInstance;

	t.is(nextValue('a'), '1-a');
	t.is(secondInstance.nextValue('a'), '1-a');
	t.true(memoizeIsCached(nextValue, 'a'));
	t.true(memoizeIsCached(secondInstance.nextValue, 'a'));

	memoizeClear(nextValue);
	t.false(memoizeIsCached(nextValue, 'a'));
	t.true(memoizeIsCached(secondInstance.nextValue, 'a'));
	t.is(nextValue('a'), '2-a');
	t.is(secondInstance.nextValue('a'), '1-a');
});

test('memoizeDecorator() utilities work with extracted static methods', t => {
	class BaseClass {
		static count = 0;
		value = 0;

		@memoizeDecorator()
		static nextValue(key: string) {
			this.count ??= 0;
			this.count++;
			return `${this.name}-${this.count}-${key}`;
		}
	}

	class ChildClass extends BaseClass {}

	const {nextValue} = ChildClass;

	t.is(nextValue('a'), 'ChildClass-1-a');
	t.is(BaseClass.nextValue('a'), 'BaseClass-1-a');
	t.true(memoizeIsCached(nextValue, 'a'));
	t.true(memoizeIsCached(BaseClass.nextValue, 'a'));

	memoizeClear(nextValue);
	t.false(memoizeIsCached(nextValue, 'a'));
	t.true(memoizeIsCached(BaseClass.nextValue, 'a'));
	t.is(nextValue('a'), 'ChildClass-2-a');
	t.is(BaseClass.nextValue('a'), 'BaseClass-1-a');
});

test('memoizeDecorator() rejects private methods', t => {
	t.throws(() => {
		class TestClass {
			value() {
				return this.#nextValue();
			}

			@memoizeDecorator()
			#nextValue() {
				return Math.random();
			}
		}

		return new TestClass().value();
	}, {
		message: 'The `memoizeDecorator` method decorator does not support private methods.',
		instanceOf: TypeError,
	});
});

test('memoizeDecorator() keeps methods off enumerable instance keys', t => {
	class TestClass {
		value = 1;

		@memoizeDecorator()
		nextValue() {
			return this.value;
		}
	}

	const instance = new TestClass();
	t.is(instance.nextValue(), 1);
	t.deepEqual(Object.keys(instance), ['value']);
	t.deepEqual({...instance}, {value: 1});
	t.false(Object.prototype.propertyIsEnumerable.call(instance, 'nextValue'));
});

test('memoizeDecorator() applies cacheKey to methods', t => {
	let value = 0;

	class TestClass {
		@memoizeDecorator({cacheKey: arguments_ => arguments_.join(':')})
		nextValue(first: string, second: string) {
			value++;
			return `${first}-${second}-${value}`;
		}
	}

	const instance = new TestClass();
	t.is(instance.nextValue('a', 'b'), 'a-b-1');
	t.is(instance.nextValue('a', 'b'), 'a-b-1');
	t.true(memoizeIsCached(instance.nextValue, 'a', 'b'));
	t.false(memoizeIsCached(instance.nextValue, 'b', 'a'));
	t.is(instance.nextValue('b', 'a'), 'b-a-2');
});

test('memoizeDecorator() applies maxAge to methods per instance', async t => {
	let value = 0;

	class TestClass {
		@memoizeDecorator({maxAge: 50})
		nextValue(key: string) {
			value++;
			return `${key}-${value}`;
		}
	}

	const firstInstance = new TestClass();
	const secondInstance = new TestClass();

	t.is(firstInstance.nextValue('a'), 'a-1');
	t.is(firstInstance.nextValue('a'), 'a-1');
	t.is(secondInstance.nextValue('a'), 'a-2');
	t.is(secondInstance.nextValue('a'), 'a-2');

	await delay(70);

	t.is(firstInstance.nextValue('a'), 'a-3');
	t.is(secondInstance.nextValue('a'), 'a-4');
});

test('memoizeDecorator() supports non-cached getters with maxAge 0', t => {
	class TestClass {
		value = 0;

		@memoizeDecorator({maxAge: 0})
		get nextValue() {
			this.value++;
			return this.value;
		}
	}

	const instance = new TestClass();
	t.is(instance.nextValue, 1);
	t.is(instance.nextValue, 2);
});

test('memoizeClear() works with memoizeDecorator()', t => {
	let value = 0;

	class TestClass {
		@memoizeDecorator()
		nextValue() {
			value++;
			return value;
		}
	}

	const instance = new TestClass();
	t.is(instance.nextValue(), 1);
	t.is(instance.nextValue(), 1);
	memoizeClear(instance.nextValue);
	t.is(instance.nextValue(), 2);
});

test('memoizeIsCached() works with memoizeDecorator()', t => {
	let value = 0;

	class TestClass {
		@memoizeDecorator()
		nextValue(key: string) {
			value++;
			return `${key}-${value}`;
		}
	}

	const instance = new TestClass();
	t.false(memoizeIsCached(instance.nextValue, 'a'));
	t.is(instance.nextValue('a'), 'a-1');
	t.true(memoizeIsCached(instance.nextValue, 'a'));
	t.false(memoizeIsCached(instance.nextValue, 'b'));
});

test('memoizeClear() throws when called with a plain function', t => {
	t.throws(() => {
		memoizeClear(() => {}); // eslint-disable-line @typescript-eslint/no-empty-function
	}, {
		message: 'Can\'t clear a function that was not memoized!',
		instanceOf: TypeError,
	});
});

test('memoizeClear() throws when called on an unclearable cache', t => {
	const fixture = () => 1;
	const memoized = memoize(fixture, {
		cache: new WeakMap(),
	});

	t.throws(() => {
		memoizeClear(memoized);
	}, {
		message: 'The cache Map can\'t be cleared!',
		instanceOf: TypeError,
	});
});

test('maxAge - cache item expires after specified duration', async t => {
	let index = 0;
	const fixture = () => index++;
	const memoized = memoize(fixture, {maxAge: 100});

	t.is(memoized(), 0); // Initial call, cached
	t.is(memoized(), 0); // Subsequent call, still cached
	await delay(150); // Wait for longer than maxAge
	t.is(memoized(), 1); // Cache expired, should compute again
});

test('maxAge - cache expiration timing is accurate', async t => {
	let index = 0;
	const fixture = () => index++;
	const memoized = memoize(fixture, {maxAge: 100});

	t.is(memoized(), 0);
	await delay(90); // Wait for slightly less than maxAge
	t.is(memoized(), 0); // Should still be cached
	await delay(20); // Total delay now exceeds maxAge
	t.is(memoized(), 1); // Should recompute as cache has expired
});

test('maxAge - expired items are not present in cache', async t => {
	let index = 0;
	const fixture = () => index++;
	const cache = new Map();
	const memoized = memoize(fixture, {maxAge: 100, cache});

	memoized(); // Call to cache the result
	await delay(150); // Wait for cache to expire
	memoized(); // Recompute and recache
	t.is(cache.size, 1); // Only one item should be in the cache
});

test('maxAge - complex arguments and cache expiration', async t => {
	let index = 0;
	const fixture = object => index++;
	const memoized = memoize(fixture, {maxAge: 100, cacheKey: JSON.stringify});

	const argument = {key: 'value'};
	t.is(memoized(argument), 0);
	await delay(150);
	t.is(memoized(argument), 1); // Argument is the same, but should recompute due to expiration
});

test('maxAge - concurrent calls return cached value', async t => {
	let index = 0;
	const fixture = () => index++;
	const memoized = memoize(fixture, {maxAge: 100});

	t.is(memoized(), 0);
	await delay(50); // Delay less than maxAge
	t.is(memoized(), 0); // Should return cached value
});

test('maxAge - different arguments have separate expirations', async t => {
	let index = 0;
	const fixture = x => index++;
	const memoized = memoize(fixture, {maxAge: 100});

	t.is(memoized('a'), 0);
	await delay(150); // Expire the cache for 'a'
	t.is(memoized('b'), 1); // 'b' should be a separate cache entry
	t.is(memoized('a'), 2); // 'a' should be recomputed
});

test('memoizeIsCached() checks if arguments are cached', t => {
	let index = 0;
	const fixture = (a?: unknown) => index++;
	const memoized = memoize(fixture);

	t.is(memoizeIsCached(memoized, 1), false);
	memoized(1);
	t.is(memoizeIsCached(memoized, 1), true);
	t.is(memoizeIsCached(memoized, 2), false);
	memoized(2);
	t.is(memoizeIsCached(memoized, 2), true);
	t.is(memoizeIsCached(memoized, 1), true);
});

test('memoizeIsCached() works with custom cacheKey', t => {
	let index = 0;
	const fixture = (a?: unknown, b?: unknown) => index++;
	const memoized = memoize(fixture, {cacheKey: JSON.stringify});

	t.is(memoizeIsCached(memoized, 1, 2), false);
	memoized(1, 2);
	t.is(memoizeIsCached(memoized, 1, 2), true);
	t.is(memoizeIsCached(memoized, 1, 3), false);
	t.is(memoizeIsCached(memoized, 2, 1), false);
});

test('memoizeIsCached() with maxAge', async t => {
	let index = 0;
	const fixture = (a?: unknown) => index++;
	const memoized = memoize(fixture, {maxAge: 100});

	t.is(memoizeIsCached(memoized, 1), false);
	memoized(1);
	t.is(memoizeIsCached(memoized, 1), true);
	await delay(150);
	t.is(memoizeIsCached(memoized, 1), false);
});

test('memoizeIsCached() when maxAge is 0', t => {
	let index = 0;
	const fixture = (a?: unknown) => index++;
	const memoized = memoize(fixture, {maxAge: 0});

	memoized(1);
	t.is(memoizeIsCached(memoized, 1), false);
	memoized(2);
	t.is(memoizeIsCached(memoized, 2), false);
});

test('memoizeIsCached() returns false for non-memoized functions', t => {
	const fixture = (a?: unknown) => a;
	t.is(memoizeIsCached(fixture, 1), false);
});

test('memoizeIsCached() handles same function memoized with different options', t => {
	let index = 0;
	const fixture = (a?: unknown, b?: unknown) => index++;

	// Memoize the same function twice with different cache keys
	const memoized1 = memoize(fixture);
	const memoized2 = memoize(fixture, {cacheKey: JSON.stringify});

	memoized1(1, 2);
	memoized2(1, 2);

	// Default cacheKey only considers first argument
	t.is(memoizeIsCached(memoized1, 1, 2), true);
	t.is(memoizeIsCached(memoized1, 1, 3), true); // Still cached (same first argument)

	// JSON.stringify considers all arguments
	t.is(memoizeIsCached(memoized2, 1, 2), true);
	t.is(memoizeIsCached(memoized2, 1, 3), false); // Not cached (different arguments)
});

test('maxAge - zero maxAge means no caching', t => {
	let index = 0;
	const fixture = () => index++;
	const memoized = memoize(fixture, {maxAge: 0});

	t.is(memoized(), 0);
	t.is(memoized(), 1); // No caching, should increment
});

test('maxAge - negative number disables caching', t => {
	let index = 0;
	const fixture = () => index++;
	const memoized = memoize(fixture, {maxAge: -1});

	t.is(memoized(), 0);
	t.is(memoized(), 1);
	t.false(memoizeIsCached(memoized));
});

test('maxAge - immediate expiration', async t => {
	let index = 0;
	const fixture = () => index++;
	const memoized = memoize(fixture, {maxAge: 1});
	t.is(memoized(), 0);
	await delay(10);
	t.is(memoized(), 1); // Cache should expire immediately
});

test('maxAge - high concurrency', async t => {
	let index = 0;
	const fixture = () => index++;
	const memoized = memoize(fixture, {maxAge: 50});

	// Simulate concurrent calls
	for (let job = 0; job < 10_000; job++) {
		memoized();
	}

	await delay(100);
	t.is(memoized(), 1);
});

test('maxAge dependent on function parameters', async t => {
	let index = 0;
	const fixture = (x: number) => index++;
	const memoized = memoize(fixture, {
		maxAge: x => x * 100,
	});

	t.is(memoized(1), 0); // Initial call, cached
	await delay(50);
	t.is(memoized(1), 0); // Still cached
	await delay(60);
	t.is(memoized(1), 1); // Cache expired, should compute again

	t.is(memoized(2), 2); // Initial call with different parameter, cached
	await delay(210);
	t.is(memoized(2), 3); // Cache expired, should compute again
});

test('maxAge function returning 0 disables caching', t => {
	let index = 0;
	const fixture = (value?: unknown) => index++;
	const memoized = memoize(fixture, {
		maxAge() {
			return 0;
		},
	});
	t.is(memoized('a'), 0);
	t.is(memoized('a'), 1);
	t.false(memoizeIsCached(memoized, 'a'));
});

test('memoizeIsCached respects expiration and cleans stale entries', async t => {
	let index = 0;
	const fixture = (value?: unknown) => index++;
	const memoized = memoize(fixture, {maxAge: 50});
	t.is(memoized('x'), 0);
	t.true(memoizeIsCached(memoized, 'x'));
	await delay(70);
	t.false(memoizeIsCached(memoized, 'x'));
});

test('memoizeClear clears timers', async t => {
	let index = 0;
	const fixture = (value?: unknown) => index++;
	const memoized = memoize(fixture, {maxAge: 5000});
	t.is(memoized('y'), 0);
	memoizeClear(memoized);
	await delay(10);
	t.is(memoized('y'), 1);
});

test('allows Infinity as a maxAge number', t => {
	let index = 0;
	const fixture = (value?: unknown) => index++;
	const memoized = memoize(fixture, {maxAge: Number.POSITIVE_INFINITY});
	t.is(memoized('z'), 0);
	t.true(memoizeIsCached(memoized, 'z'));
});

test('maxAge function returning Infinity caches indefinitely', t => {
	let index = 0;
	const fixture = (value?: unknown) => index++;
	const memoized = memoize(fixture, {
		maxAge() {
			return Number.POSITIVE_INFINITY;
		},
	});
	t.is(memoized('a'), 0);
	t.is(memoized('a'), 0);
	t.true(memoizeIsCached(memoized, 'a'));
});

test('maxAge function returning negative number disables caching', t => {
	let index = 0;
	const fixture = (value?: unknown) => index++;
	const memoized = memoize(fixture, {
		maxAge() {
			return -100;
		},
	});
	t.is(memoized('a'), 0);
	t.is(memoized('a'), 1);
	t.false(memoizeIsCached(memoized, 'a'));
});

test('maxAge function validation - throws on non-finite non-Infinity', t => {
	const fixture = () => 42;
	const memoized = memoize(fixture, {
		maxAge() {
			return Number.NaN;
		},
	});
	t.throws(() => memoized(), {
		instanceOf: TypeError,
		message: 'The `maxAge` function must return a finite number, `0`, or `Infinity`.',
	});
});

test('maxAge option validation - throws on non-finite non-Infinity', t => {
	t.throws(() => {
		memoize(() => 42, {maxAge: Number.NaN});
	}, {
		instanceOf: TypeError,
		message: 'The `maxAge` option must be a finite number, `0`, or `Infinity`.',
	});
});

test('maxAge function validation - throws on excessive timeout', t => {
	const fixture = () => 42;
	const memoized = memoize(fixture, {
		maxAge() {
			return 2_147_483_648; // One more than max
		},
	});
	t.throws(() => memoized(), {
		instanceOf: TypeError,
		message: 'The `maxAge` function result cannot exceed 2147483647.',
	});
});

test('expired cache entries are recomputed on read', async t => {
	let index = 0;
	const fixture = (value?: unknown) => index++;
	const memoized = memoize(fixture, {maxAge: 50});

	// Cache an entry
	t.is(memoized('test'), 0);
	t.true(memoizeIsCached(memoized, 'test'));

	// Wait for expiration
	await delay(70);

	// Reading expired entry should compute fresh value
	t.is(memoized('test'), 1);
	t.true(memoizeIsCached(memoized, 'test'));
});

test('very short maxAge expiration', async t => {
	let index = 0;
	const fixture = (value?: unknown) => index++;

	const memoized = memoize(fixture, {maxAge: 10});
	t.is(memoized('a'), 0);

	// Should still be cached immediately
	t.is(memoized('a'), 0);

	// After expiration
	await delay(15);
	t.is(memoized('a'), 1);
});
