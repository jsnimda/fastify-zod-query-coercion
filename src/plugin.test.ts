import Fastify from 'fastify';
import { fastifyZodOpenApiPlugin, serializerCompiler, ValidationError, validatorCompiler } from 'fastify-zod-openapi';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import fastifyZodQueryCoercion, { FST_ZOD_QUERY_COERCION_ERROR } from './plugin.js';

async function buildServer(schema: z.ZodObject<any, any>) {
  const app = Fastify();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ValidationError) {
      reply.status(error.statusCode ?? 500).send(fromZodError(error.zodError).toString());
    } else {
      reply.send(error);
    }
  });

  await app.register(fastifyZodOpenApiPlugin, { openapi: '3.1.0' });
  await app.register(fastifyZodQueryCoercion);

  app.get('/test', {
    schema: {
      querystring: schema,
    },
    handler: (request) => request.query,
  });

  await app.ready();
  return app;
}

describe('fastifyZodQueryCoercion', () => {
  it('should coerce boolean values correctly and handle optional fields', async () => {
    const schema = z.object({
      boolTrue: z.boolean(),
      boolFalse: z.boolean(),
      boolOptional: z.boolean().optional(),
      boolDefaultTrue: z.boolean().default(true),
      boolDefaultFalse: z.boolean().default(false),
    });
    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?boolTrue=true&boolFalse=false&boolOptional=1&boolDefaultFalse=true',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      boolTrue: true,
      boolFalse: false,
      boolOptional: true,
      boolDefaultTrue: true,
      boolDefaultFalse: true,
    });

    const responseWithMissing = await fastify.inject({
      method: 'GET',
      url: '/test?boolTrue=1&boolFalse=0',
    });

    expect(responseWithMissing.statusCode).toBe(200);
    expect(JSON.parse(responseWithMissing.payload)).toEqual({
      boolTrue: true,
      boolFalse: false,
      boolDefaultTrue: true,
      boolDefaultFalse: false,
    });
  });

  it('should coerce number values correctly and handle optional fields', async () => {
    const schema = z.object({
      intPositive: z.number(),
      intNegative: z.number(),
      float: z.number(),
      numberOptional: z.number().optional(),
      numberDefault: z.number().default(42),
    });
    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?intPositive=123&intNegative=-456&float=3.14&numberOptional=0&numberDefault=10',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      intPositive: 123,
      intNegative: -456,
      float: 3.14,
      numberOptional: 0,
      numberDefault: 10,
    });

    const responseWithMissing = await fastify.inject({
      method: 'GET',
      url: '/test?intPositive=123&intNegative=-456&float=3.14',
    });

    expect(responseWithMissing.statusCode).toBe(200);
    expect(JSON.parse(responseWithMissing.payload)).toEqual({
      intPositive: 123,
      intNegative: -456,
      float: 3.14,
      numberDefault: 42,
    });
  });

  it('should handle string values correctly and handle optional fields', async () => {
    const schema = z.object({
      normalString: z.string(),
      emptyString: z.string(),
      stringOptional: z.string().optional(),
      stringDefault: z.string().default('default'),
    });
    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?normalString=hello&emptyString=&stringOptional=world&stringDefault=custom',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      normalString: 'hello',
      emptyString: '',
      stringOptional: 'world',
      stringDefault: 'custom',
    });

    const responseWithMissing = await fastify.inject({
      method: 'GET',
      url: '/test?normalString=hello&emptyString=',
    });

    expect(responseWithMissing.statusCode).toBe(200);
    expect(JSON.parse(responseWithMissing.payload)).toEqual({
      normalString: 'hello',
      emptyString: '',
      stringDefault: 'default',
    });
  });

  it('should handle string values correctly and handle non-string inputs', async () => {
    const schema = z.object({
      normalString: z.string(),
      arrayString: z.string(),
    });
    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?normalString=hello&arrayString=value1&arrayString=value2',
    });

    expect(response.statusCode).toBe(400);
    expect(response.payload).toBe('Validation error: Expected string, received array at "arrayString"');
  });

  it('should handle nullable values correctly', async () => {
    const schema = z.object({
      nullableString: z.string().nullable(),
      nullableNumber: z.number().nullable(),
      nullableOptional: z.number().nullable().optional(),
    });
    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?nullableString=null&nullableNumber=null&nullableOptional=null',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      nullableString: null,
      nullableNumber: null,
      nullableOptional: null,
    });

    const responseWithNonNullValues = await fastify.inject({
      method: 'GET',
      url: '/test?nullableString=hello&nullableNumber=123&nullableOptional=456',
    });

    expect(responseWithNonNullValues.statusCode).toBe(200);
    expect(JSON.parse(responseWithNonNullValues.payload)).toEqual({
      nullableString: 'hello',
      nullableNumber: 123,
      nullableOptional: 456,
    });
  });

  it('should handle null values correctly and reject non-null values', async () => {
    const schema = z.object({
      nullField: z.null(),
      anotherNullField: z.null(),
    });
    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?nullField=null&anotherNullField=null',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      nullField: null,
      anotherNullField: null,
    });

    const responseWithNonNullValue = await fastify.inject({
      method: 'GET',
      url: '/test?nullField=null&anotherNullField=notNull',
    });

    expect(responseWithNonNullValue.statusCode).toBe(400);
    expect(responseWithNonNullValue.payload).toBe('Validation error: Expected null, received string at "anotherNullField"');
  });

  it('should handle array values correctly', async () => {
    const schema = z.object({
      stringArray: z.array(z.string()),
      numberArray: z.array(z.number()),
      mixedArray: z.array(z.union([z.number(), z.string()])),
      singleValueArray: z.array(z.boolean()),
    });
    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?stringArray=a&stringArray=b&numberArray=1&numberArray=2&mixedArray=foo&mixedArray=3&singleValueArray=true',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      stringArray: ['a', 'b'],
      numberArray: [1, 2],
      mixedArray: ['foo', 3],
      singleValueArray: [true],
    });
  });

  it('should handle tuple values correctly', async () => {
    const schema = z.object({
      singleValueTuple: z.tuple([z.string()]),
      multiValueTuple: z.tuple([z.string(), z.number(), z.boolean()]),
      tupleWithRest: z.tuple([z.string(), z.number()]).rest(z.boolean()),
    });
    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?singleValueTuple=foo&multiValueTuple=bar&multiValueTuple=123&multiValueTuple=true&tupleWithRest=baz&tupleWithRest=456&tupleWithRest=true&tupleWithRest=false',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      singleValueTuple: ['foo'],
      multiValueTuple: ['bar', 123, true],
      tupleWithRest: ['baz', 456, true, false],
    });
  });

  it('should handle ZodEffects correctly', async () => {
    const schema = z.object({
      stringLength: z.string().transform(s => s.length),
      positiveNumber: z.number().refine(n => n > 0, { message: "Must be positive" }),
      booleanFromString: z.preprocess(val => val === 'true', z.boolean()),
    });
    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?stringLength=hello&positiveNumber=5&booleanFromString=true'
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      stringLength: 5,
      positiveNumber: 5,
      booleanFromString: true
    });

    const responseWithInvalidInput = await fastify.inject({
      method: 'GET',
      url: '/test?stringLength=hello&positiveNumber=-5&booleanFromString=true'
    });

    expect(responseWithInvalidInput.statusCode).toBe(400);
    expect(responseWithInvalidInput.payload).toBe('Validation error: Must be positive at "positiveNumber"');
  });

  it('should throw an error for unsupported schema types during route registration', async () => {
    const schema = z.object({
      unsupported: z.set(z.string()),
    });

    await expect(buildServer(schema)).rejects.toThrow(FST_ZOD_QUERY_COERCION_ERROR);
  });
});