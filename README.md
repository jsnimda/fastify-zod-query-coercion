<div align="center">

# fastify-zod-query-coercion

[![NPM version](https://img.shields.io/npm/v/fastify-zod-query-coercion.svg?style=flat)](https://www.npmjs.com/package/fastify-zod-query-coercion)
[![NPM downloads](https://img.shields.io/npm/dm/fastify-zod-query-coercion.svg?style=flat)](https://www.npmjs.com/package/fastify-zod-query-coercion)
[![CI](https://github.com/jsnimda/fastify-zod-query-coercion/actions/workflows/ci.yml/badge.svg)](https://github.com/jsnimda/fastify-zod-query-coercion/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/codecov/c/gh/jsnimda/fastify-zod-query-coercion)](https://codecov.io/gh/jsnimda/fastify-zod-query-coercion)

A Fastify plugin that automatically coerces query string parameters to match Zod schemas.

</div>

## Install

```bash
npm install fastify-zod-query-coercion
```

## Usage

```typescript
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, type FastifyZodOpenApiTypeProvider } from 'fastify-zod-openapi';
import fastifyZodQueryCoercion from 'fastify-zod-query-coercion';
import { z } from 'zod';

const fastify = Fastify().withTypeProvider<FastifyZodOpenApiTypeProvider>();

// Set up Zod validation
fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

// Register the plugin
await fastify.register(fastifyZodQueryCoercion);

// Define a route with a Zod schema for query parameters
fastify.get('/example', {
  schema: {
    querystring: z.object({
      id: z.number(),
      name: z.string(),
      isActive: z.boolean(),
      tags: z.array(z.string()),
    }),
  },
  handler: (request, reply) => {
    const { id, name, isActive, tags } = request.query;
    console.log({
      id: typeof id, // 'number'
      name: typeof name, // 'string'
      isActive: typeof isActive, // 'boolean'
      tags: Array.isArray(tags), // true
    });
    reply.send({ id, name, isActive, tags });
  },
});

fastify.listen({ port: 3000 }, (err) => {
  if (err) throw err;
  console.log('Server is running on http://localhost:3000');
  console.log('Try: http://localhost:3000/example?id=123&name=John&isActive=true&tags=a&tags=b');
});
```

## Features

- Automatically coerces query string parameters to match Zod schemas
- Supports various Zod types including numbers, booleans, strings, arrays, and more
- Preserves Zod's validation and type inference capabilities
- Seamless integration with Fastify's plugin system

## Supported Zod Types

The following Zod types are supported for individual query string values:

- ZodBoolean
- ZodNumber
- ZodBigInt
- ZodString
- ZodDate
- ZodNull
- ZodNullable
- ZodOptional
- ZodDefault
- ZodArray
- ZodUnion
- ZodTuple
- ZodEffects
- ZodSet
- ZodLiteral (except symbol)
- ZodEnum
- ZodIntersection
- ZodCatch
- ZodPipeline

Note: ZodObject is supported as the top-level schema for the entire query string, but not for individual query string values.

### Unsupported Zod Types

Due to the limitations of query string representation, the following Zod types are not supported for individual query string values:

- ZodObject (except as the top-level schema)
- ZodSymbol
- ZodMap
- ZodFunction
- ZodLazy
- ZodPromise
- ZodNativeEnum
- ZodRecord
- ZodDiscriminatedUnion
- ZodInstanceof
- ZodBranded
- ZodReadonly

These types are either not possible to represent in a query string or require custom parsing logic. If you need to use these types, consider using alternative representations or handling them differently in your application logic.

## How It Works

The plugin intercepts route definitions and transforms the Zod schemas for query parameters. It applies coercion rules similar to Ajv, ensuring that string inputs from query parameters are correctly converted to their intended types before Zod validation occurs.

## Coercion Rules

This plugin follows [Ajv coercion rules](https://ajv.js.org/coercion.html) for Zod schemas. The coercion is applied before Zod validation occurs, ensuring that string inputs from query parameters are correctly converted to their intended types.

### Currently Supported Coercion Rules

1. **Boolean**:
   - String `"true"` → `true`
   - String `"false"` → `false`

2. **Number**:
   - String representation of a number → Number
   (e.g., `"123"` → `123`, `"3.14"` → `3.14`)

3. **BigInt**:
   - String representation of a bigint → BigInt
   (e.g., `"123"` → `123n`)

4. **String**:
   - Any value → String representation

5. **Date**:
   - String representation of a number or ISO date → Date
   (e.g., `"2023-10-01T00:00:00.000Z"` → `new Date("2023-10-01T00:00:00.000Z")`)

6. **Null**:
   - String `"null"` → `null`

7. **Array**:
   - Single non-array value → Array with that single value
   (e.g., `"foo"` → `["foo"]`)

8. **Tuple**:
   - Single non-array value → Tuple with that single value
   (e.g., `"foo"` → `["foo"]`)

9. **Set**:
   - Single non-array value → Set with that single value
   (e.g., `"foo"` → `new Set(["foo"])`)
   - Array → Set with array values
   (e.g., `["foo", "bar"]` → `new Set(["foo", "bar"])`)

These coercion rules are applied recursively to nested schemas, including those within unions, optionals, and other complex types.

## Detailed Coercion Rules and Limitations

The plugin preprocesses (coerces) query string parameters to match the expected Zod schema types. Here are the detailed rules and reasons for support or lack thereof:

### Primitives

- **z.string()**
  - Supported
  - Direct passthrough

- **z.number()**
  - Supported
  - Converts to number if it is a valid number (i.e., !isNaN, isFinite)
  - Uses `Number(val)`

- **z.bigint()**
  - Supported
  - Converts to bigint if `BigInt(val)` doesn't throw an error

- **z.boolean()**
  - Supported
  - `"true"` → `true`
  - `"false"` → `false`

- **z.date()**
  - Supported
  - Converts only if it is a number (string that is a number) or an ISO date (other date formats will not convert)
  - Uses the same regex as `z.string().datetime()` to check ISO date
  - Uses `new Date(val)` to construct, `val` cast to number first if it is a string that is a number

- **z.symbol()**
  - Unsupported
  - (No meaningful way to convert string to symbol)

- **z.undefined()**
  - Supported
  - Direct passthrough, will not convert, key can be undefined if not provided in the query

- **z.null()**
  - Supported
  - `"null"` → `null`

- **z.void()**
  - Supported
  - Direct passthrough, same reason as undefined

- **z.any()**
  - Supported
  - Direct passthrough

- **z.unknown()**
  - Supported
  - Direct passthrough

- **z.never()**
  - Supported
  - Direct passthrough
  - User will get an error if they provide this key

### Other Types

- **z.literal()**
  - Supported (except symbol)
  - Zod supports args: string | number | symbol | bigint | boolean | null | undefined
  - Converts to the literal value if the ('' + literal value) is equal to the query val
  - For `z.literal(undefined)`, checks if the key exists in the query string
  - Otherwise passthrough

- **z.nan()**
  - Unsupported
  - (Not meaningful)

- **z.enum()**
  - Supported
  - Like string, direct passthrough

- **z.nativeEnum()**
  - Unsupported
  - (No meaningful way to convert string to Enums; should use the enum key or value)

- **z.optional() / .optional()**
  - Supported
  - Nested schema is also processed

- **z.nullable() / .nullable()**
  - Supported
  - `"null"` → `null`
  - Nested schema is also processed

- **z.object()**
  - Unsupported
  - (No meaningful way to convert string to object)

- **z.array() / .array()**
  - Supported
  - Wraps the non-array value with an array of length 1
  - Nested schema is also processed

- **z.tuple() / .tuple()**
  - Supported
  - Wraps the non-array value with an array of length 1
  - Nested schema is also processed

- **z.union() / .or()**
  - Supported
  - Nested schema is also processed

- **z.discriminatedUnion()**
  - Unsupported
  - (Requires objects, and there is no meaningful way to express object in strings)

- **z.record()**
  - Unsupported
  - (Same reason as object)

- **z.map()**
  - Unsupported
  - (Map is like record, and same reason as record)

- **z.set()**
  - Supported
  - Like array, and array is converted to `Set()` before passthrough

- **z.intersection() / .and()**
  - Supported
  - Intersection not only used with objects, but may also be used on union, so it is supported

- **z.lazy()**
  - Unsupported
  - (Not supported for now, avoid infinite recursion)

### ZodEffects

- **ZodEffects / .refine() / .superRefine()**
  - Supported
  - Nested schema is also processed

- **ZodEffects / .transform()**
  - Supported
  - Nested schema is also processed

- **ZodEffects / .preprocess()**
  - Supported
  - Will not process, just passthrough, as user preprocess is intended (or already) to do our jobs

### Other Schema Methods

- **z.promise()**
  - Unsupported
  - (No way to express promise in string)

- **z.instanceof()**
  - Unsupported
  - (Instanceof is for objects, and string is not an object)

- **z.function()**
  - Unsupported
  - (String is not a function)

- **z.custom()**
  - Supported
  - Direct passthrough, you know your job

- **ZodDefault / .default()**
  - Supported
  - Direct passthrough
  - Nested schema is processed as well

- **ZodCatch / .catch()**
  - Supported
  - Assuming you want to provide value if parsing fails, direct passthrough
  - Nested schema is processed as well

- **.nullish()**
  - Supported
  - It is just optional + nullable

- **ZodBranded / .brand()**
  - Unsupported
  - (Not sure of its usefulness)

- **ZodReadonly / .readonly()**
  - Unsupported
  - (Not sure of its usefulness)

### ZodPipeline

- **ZodPipeline / .pipe()**
  - Supported
  - Only the first schema is processed
  - Nested schema of the first schema is processed as well

## API Reference

### `fastifyZodQueryCoercion`

The main plugin function. Register it with your Fastify instance:

```typescript
fastify.register(fastifyZodQueryCoercion);
```

## Compatibility

This plugin is compatible with Fastify v4.x and v5.x.

## Contributing

Contributions, issues, and feature requests are welcome!

## License

This project is licensed under the MIT License.
