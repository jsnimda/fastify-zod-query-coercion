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

- ZodAny
- ZodArray
- ZodBigInt
- ZodBoolean
- ZodCatch
- ZodDate
- ZodDefault
- ZodEffects
- ZodEnum
- ZodIntersection
- ZodLiteral (except symbol)
- ZodNever
- ZodNull
- ZodNullable
- ZodNumber
- ZodOptional
- ZodPipeline
- ZodSet
- ZodString
- ZodTuple
- ZodUndefined
- ZodUnion
- ZodUnknown
- ZodVoid

Note: ZodObject is supported as the top-level schema for the entire query string, but not for individual query string values.

### Unsupported Zod Types

Due to the limitations of query string representation, the following Zod types are not supported for individual query string values:

- ZodBranded
- ZodDiscriminatedUnion
- ZodFunction
- ZodLazy
- ZodMap
- ZodNaN
- ZodNativeEnum
- ZodPromise
- ZodReadonly
- ZodRecord
- ZodSymbol
- ZodObject (except as the top-level schema)

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

The plugin preprocesses (coerces) query string parameters to match the expected Zod schema types. Here are the general principles and specific rules for each supported type.

### Important Note on Schema Validation

This plugin performs schema validation at startup time. If you provide an unsupported schema type, the plugin will throw an error during route registration, not at request time. This helps catch configuration errors early in the development process.

### General Coercion Principles

1. String values are converted to their appropriate types when possible.
2. Non-convertible values are passed through as-is for Zod to handle during validation.
3. Nested schemas within supported types are also processed recursively.

### Supported Types and Their Coercion Rules

| Zod Type | Coercion Rule |
|----------|---------------|
| `z.string()` | Direct passthrough |
| `z.number()` | Converts to number if valid (using `Number(val)`) |
| `z.bigint()` | Converts to BigInt if possible |
| `z.boolean()` | `"true"` → `true`, `"false"` → `false` |
| `z.date()` | Converts number strings or ISO date strings to Date objects |
| `z.null()` | `"null"` → `null` |
| `z.undefined()` | Direct passthrough |
| `z.literal()` | Converts to literal value if string representation matches |
| `z.enum()` | Direct passthrough |
| `z.array()` | Wraps single values in an array |
| `z.tuple()` | Wraps single values in an array |
| `z.union()` | Processes each option in the union |
| `z.intersection()` | Processes each part of the intersection |
| `z.set()` | Converts to Set, wrapping single values if necessary |
| `z.optional()` | Processes inner schema |
| `z.nullable()` | Processes inner schema, `"null"` → `null` |
| `z.default()` | Processes inner schema |
| `z.catch()` | Processes inner schema |
| `z.preprocess()` | Direct passthrough (user-defined preprocessing) |
| `z.refine()` / `z.superRefine()` | Processes inner schema |
| `z.transform()` | Processes inner schema |
| `z.pipe()` | Processes only the first schema in the pipeline |

### Special Cases

- `z.literal(undefined)`: Checks if the key exists in the query string
- `z.never()`: Passes through, but will cause a validation error if provided
- `z.any()` / `z.unknown()`: Direct passthrough
- `z.void()`: Behaves like `z.undefined()`

### Unsupported Types

The following types are not supported due to the limitations of query string representation:

- `z.object()` (except as top-level schema)
- `z.symbol()`
- `z.nan()`
- `z.discriminatedUnion()`
- `z.record()`
- `z.map()`
- `z.lazy()`
- `z.promise()`
- `z.function()`
- `z.instanceof()`
- `z.branded()`
- `z.readonly()`

For these types, consider using alternative representations or handling them differently in your application logic.

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
