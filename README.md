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

## How It Works

The plugin intercepts route definitions and transforms the Zod schemas for query parameters. It uses Zod's [`z.preprocess()`](https://zod.dev/?id=preprocess) to apply coercion rules similar to Ajv, ensuring that string inputs from query parameters are correctly converted to their intended types before Zod validation occurs.

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
   - Any string value → Remains unchanged

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

For a comprehensive list of supported Zod types, detailed coercion rules, and information about unsupported types, please refer to [COERCION_RULES.md](./COERCION_RULES.md).

## Route Parameters Support

By default, only query string parameters are processed. This plugin supports coercing both query string and route parameters. To enable route parameter coercion, include "params" in the `coerceTypes` option when registering the plugin.

```typescript
// Register the plugin with route parameter coercion
await fastify.register(fastifyZodQueryCoercion, {
  coerceTypes: ['querystring', 'params']
});

// Define a route with a Zod schema for route parameters
fastify.get('/users/:userId', {
  schema: {
    params: z.object({
      userId: z.number(),
    }),
    querystring: z.object({
      isActive: z.boolean(),
    }),
  },
  handler: (request, reply) => {
    const { userId } = request.params;
    const { isActive } = request.query;
    console.log({
      userId: typeof userId, // 'number'
      isActive: typeof isActive, // 'boolean'
    });
    reply.send({ userId, isActive });
  },
});

fastify.listen({ port: 3000 }, (err) => {
  if (err) throw err;
  console.log('Server is running on http://localhost:3000');
  console.log('Try: http://localhost:3000/users/123?isActive=true');
});
```

## API Reference

### `fastifyZodQueryCoercion`

The main plugin function. Register it with your Fastify instance:

```typescript
fastify.register(fastifyZodQueryCoercion);
```

### Options

#### `coerceTypes` (optional, default: `['querystring']`)

Accepts an array of strings specifying which parts of the request should have coercion applied. Valid values are "querystring", "params", "headers", and "body".

## Compatibility

This plugin is compatible with Fastify v4.x and v5.x.

## Contributing

Contributions, issues, and feature requests are welcome!

## License

This project is licensed under the MIT License.
