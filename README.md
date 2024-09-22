<div align="center">

# Fastify Zod Query Coercion

[![NPM version](https://img.shields.io/npm/v/fastify-zod-query-coercion.svg?style=flat)](https://www.npmjs.com/package/fastify-zod-query-coercion)
[![NPM downloads](https://img.shields.io/npm/dm/fastify-zod-query-coercion.svg?style=flat)](https://www.npmjs.com/package/fastify-zod-query-coercion)
[![CI](https://github.com/jsnimda/fastify-zod-query-coercion/actions/workflows/ci.yml/badge.svg)](https://github.com/jsnimda/fastify-zod-query-coercion/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/codecov/c/gh/jsnimda/fastify-zod-query-coercion)](https://codecov.io/gh/jsnimda/fastify-zod-query-coercion)

A Fastify plugin that automatically coerces query string parameters to match Zod schemas.

</div>

## Installation

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
- ZodString
- ZodNull
- ZodNullable
- ZodOptional
- ZodDefault
- ZodArray
- ZodUnion
- ZodTuple
- ZodEffects

Note: ZodObject is supported as the top-level schema for the entire query string, but not for individual query string values.

### Unsupported Zod Types

Due to the limitations of query string representation, the following Zod types are not supported for individual query string values:

- ZodObject (except as the top-level schema)
- ZodSymbol
- ZodMap
- ZodSet
- ZodFunction
- ZodLazy
- ZodPromise

These types are either not possible to represent in a query string or require custom parsing logic. If you need to use these types, consider using alternative representations or handling them differently in your application logic.

## How It Works

The plugin intercepts route definitions and transforms the Zod schemas for query parameters. It applies coercion rules similar to Ajv, ensuring that string inputs from query parameters are correctly converted to their intended types before Zod validation occurs.

## Coercion Rules

This plugin follows [Ajv coercion rules](https://ajv.js.org/coercion.html) for Zod schemas. The coercion is applied before Zod validation occurs, ensuring that string inputs from query parameters are correctly converted to their intended types.

### Currently Supported Coercion Rules

1. **Boolean**:
   - String `"true"` or `"1"` → `true`
   - String `"false"` or `"0"` → `false`

2. **Number**:
   - String representation of a number → Number
   (e.g., `"123"` → `123`, `"3.14"` → `3.14`)

3. **String**:
   - Any value → String representation

4. **Null**:
   - String `"null"` → `null`

5. **Array**:
   - Single non-array value → Array with that single value
   (e.g., `"foo"` → `["foo"]`)

6. **Tuple**:
   - Single non-array value → Tuple with that single value
   (e.g., `"foo"` → `["foo"]`)

These coercion rules are applied recursively to nested schemas, including those within unions, optionals, and other complex types.

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
