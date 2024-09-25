import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { z, ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import fastifyZodQueryCoercion from '../src/index.js';
import { FST_ZOD_QUERY_COERCION_ERROR } from '../src/plugin.js';
import { validatorCompiler } from './test-utils.js';

async function buildServer(schema: z.ZodObject<any, any>, queryInterceptor?: (query: any) => void) {
  const app = Fastify();

  app.setValidatorCompiler(validatorCompiler);
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError && error.statusCode) {
      reply.status(error.statusCode).send(fromZodError(error, { prefix: null }).toString());
    } else {
      reply.send(error);
    }
  });

  await app.register(fastifyZodQueryCoercion);

  app.get('/test', {
    schema: {
      querystring: schema,
    },
    handler: (request, reply) => {
      if (queryInterceptor) {
        queryInterceptor(request.query);
        return reply.send(200);
      }
      return request.query;
    },
  });

  await app.ready();
  return app;
}

describe('fastifyZodQueryCoercion', () => {
  it('should coerce literal values correctly', async () => {
    const schema = z.object({
      stringLiteral: z.literal('hello'),
      numberLiteral: z.literal(42),
      bigintLiteral: z.literal(BigInt(9007199254740991), { message: 'BigInt literal error' }),
      booleanLiteral: z.literal(true),
      nullLiteral: z.literal(null),
      undefinedLiteral: z.literal(undefined),
    });
    const queryInterceptor = vi.fn();
    const fastify = await buildServer(schema, queryInterceptor);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?stringLiteral=hello&numberLiteral=42&bigintLiteral=9007199254740991&booleanLiteral=true&nullLiteral=null',
    });

    expect(response.statusCode).toBe(200);
    expect(queryInterceptor).toHaveBeenCalledWith({
      stringLiteral: 'hello',
      numberLiteral: 42,
      bigintLiteral: BigInt(9007199254740991),
      booleanLiteral: true,
      nullLiteral: null,
      undefinedLiteral: undefined,
    });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?stringLiteral=world&numberLiteral=43&bigintLiteral=9007199254740992&booleanLiteral=false&nullLiteral=undefined&undefinedLiteral=hello',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe(
      'Invalid literal value, expected "hello" at "stringLiteral"; ' +
      'Invalid literal value, expected 42 at "numberLiteral"; ' +
      'Invalid literal value, expected "9007199254740991" at "bigintLiteral"; ' +
      'Invalid literal value, expected true at "booleanLiteral"; ' +
      'Invalid literal value, expected null at "nullLiteral"; ' +
      'Invalid literal value, expected undefined at "undefinedLiteral"'
    );
  });

  it('should coerce string values correctly and handle optional fields', async () => {
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

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?normalString=value1&normalString=value2',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe(
      'Expected string, received array at "normalString"; ' +
      'Required at "emptyString"'
    );
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

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?intPositive=notanumber&intNegative=-456&float=3.14',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe('Expected number, received string at "intPositive"');
  });

  it('should coerce bigint values correctly and handle optional fields', async () => {
    const schema = z.object({
      bigIntPositive: z.bigint(),
      bigIntNegative: z.bigint(),
      bigIntOptional: z.bigint().optional(),
      bigIntDefault: z.bigint().default(BigInt(42)),
    });
    const queryInterceptor = vi.fn();
    const fastify = await buildServer(schema, queryInterceptor);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?bigIntPositive=1234567890123456789&bigIntNegative=-9876543210987654321&bigIntOptional=0&bigIntDefault=10',
    });

    expect(response.statusCode).toBe(200);
    expect(queryInterceptor).toHaveBeenCalledWith({
      bigIntPositive: BigInt('1234567890123456789'),
      bigIntNegative: BigInt('-9876543210987654321'),
      bigIntOptional: BigInt(0),
      bigIntDefault: BigInt(10),
    });

    const responseWithMissing = await fastify.inject({
      method: 'GET',
      url: '/test?bigIntPositive=1234567890123456789&bigIntNegative=-9876543210987654321',
    });

    expect(responseWithMissing.statusCode).toBe(200);
    expect(queryInterceptor).toHaveBeenCalledWith({
      bigIntPositive: BigInt('1234567890123456789'),
      bigIntNegative: BigInt('-9876543210987654321'),
      bigIntDefault: BigInt(42),
    });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?bigIntPositive=notanumber&bigIntNegative=-9876543210987654321',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe('Expected bigint, received string at "bigIntPositive"');
  });

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
      url: '/test?boolTrue=true&boolFalse=false&boolOptional=true&boolDefaultFalse=true',
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
      url: '/test?boolTrue=true&boolFalse=false',
    });

    expect(responseWithMissing.statusCode).toBe(200);
    expect(JSON.parse(responseWithMissing.payload)).toEqual({
      boolTrue: true,
      boolFalse: false,
      boolDefaultTrue: true,
      boolDefaultFalse: false,
    });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?boolTrue=notaboolean&boolFalse=false',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe('Expected boolean, received string at "boolTrue"');
  });

  it('should coerce date values correctly and handle optional fields', async () => {
    const schema = z.object({
      isoDate: z.date(),
      timestampDate: z.date(),
      dateOptional: z.date().optional(),
      dateDefault: z.date().default(() => new Date('2023-01-01T00:00:00Z')),
    });
    const queryInterceptor = vi.fn();
    const fastify = await buildServer(schema, queryInterceptor);

    const validISODate = '2023-05-15T12:00:00Z';
    const validTimestamp = '1684152000000'; // Equivalent to 2023-05-15T12:00:00Z
    const response = await fastify.inject({
      method: 'GET',
      url: `/test?isoDate=${validISODate}&timestampDate=${validTimestamp}&dateOptional=${validISODate}&dateDefault=${validTimestamp}`,
    });

    expect(response.statusCode).toBe(200);
    expect(queryInterceptor).toHaveBeenCalledWith({
      isoDate: new Date('2023-05-15T12:00:00Z'),
      timestampDate: new Date('2023-05-15T12:00:00Z'),
      dateOptional: new Date('2023-05-15T12:00:00Z'),
      dateDefault: new Date('2023-05-15T12:00:00Z'),
    });

    const responseWithMissing = await fastify.inject({
      method: 'GET',
      url: `/test?isoDate=${validISODate}&timestampDate=${validTimestamp}`,
    });

    expect(responseWithMissing.statusCode).toBe(200);
    expect(queryInterceptor).toHaveBeenCalledWith({
      isoDate: new Date('2023-05-15T12:00:00Z'),
      timestampDate: new Date('2023-05-15T12:00:00Z'),
      dateDefault: new Date('2023-01-01T00:00:00Z'),
    });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?isoDate=2023-05-15&timestampDate=notanumber',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe(
      'Expected date, received string at "isoDate"; ' +
      'Expected date, received string at "timestampDate"'
    );
  });

  it('should coerce enum values correctly and handle optional fields', async () => {
    const ColorEnum = z.enum(['RED', 'GREEN', 'BLUE']);
    const schema = z.object({
      color: ColorEnum,
      optionalColor: ColorEnum.optional(),
      defaultColor: ColorEnum.default('GREEN'),
    });
    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?color=RED&optionalColor=BLUE&defaultColor=RED',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      color: 'RED',
      optionalColor: 'BLUE',
      defaultColor: 'RED',
    });

    const responseWithMissing = await fastify.inject({
      method: 'GET',
      url: '/test?color=BLUE',
    });

    expect(responseWithMissing.statusCode).toBe(200);
    expect(JSON.parse(responseWithMissing.payload)).toEqual({
      color: 'BLUE',
      defaultColor: 'GREEN',
    });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?color=YELLOW&optionalColor=PURPLE',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe(
      'Invalid enum value. Expected \'RED\' | \'GREEN\' | \'BLUE\', received \'YELLOW\' at "color"; ' +
      'Invalid enum value. Expected \'RED\' | \'GREEN\' | \'BLUE\', received \'PURPLE\' at "optionalColor"'
    );
  });

  it('should coerce null values correctly and handle optional fields', async () => {
    const schema = z.object({
      nullField: z.null(),
      anotherNullField: z.null(),
      optionalNull: z.null().optional(),
    });
    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?nullField=null&anotherNullField=null&optionalNull=null',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      nullField: null,
      anotherNullField: null,
      optionalNull: null,
    });

    const responseWithMissing = await fastify.inject({
      method: 'GET',
      url: '/test?nullField=null&anotherNullField=null',
    });

    expect(responseWithMissing.statusCode).toBe(200);
    expect(JSON.parse(responseWithMissing.payload)).toEqual({
      nullField: null,
      anotherNullField: null,
    });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?nullField=null&anotherNullField=notNull&optionalNull=null',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe('Expected null, received string at "anotherNullField"');
  });

  it('should coerce nullable values correctly and handle optional fields', async () => {
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

    const responseWithMissing = await fastify.inject({
      method: 'GET',
      url: '/test?nullableString=world&nullableNumber=789',
    });

    expect(responseWithMissing.statusCode).toBe(200);
    expect(JSON.parse(responseWithMissing.payload)).toEqual({
      nullableString: 'world',
      nullableNumber: 789,
    });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?nullableString=null&nullableNumber=notANumber&nullableOptional=alsoNotANumber',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe(
      'Expected number, received string at "nullableNumber"; ' +
      'Expected number, received string at "nullableOptional"'
    );
  });

  it('should coerce array values correctly and handle optional fields', async () => {
    const schema = z.object({
      stringArray: z.array(z.string()),
      numberArray: z.array(z.number()),
      mixedArray: z.array(z.union([z.number(), z.boolean()])),
      singleValueArray: z.array(z.boolean()),
      optionalArray: z.array(z.string()).optional(),
    });
    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?stringArray=a&stringArray=b&numberArray=1&numberArray=2&mixedArray=42&mixedArray=true&singleValueArray=true&optionalArray=foo&optionalArray=bar',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      stringArray: ['a', 'b'],
      numberArray: [1, 2],
      mixedArray: [42, true],
      singleValueArray: [true],
      optionalArray: ['foo', 'bar'],
    });

    const responseWithMissing = await fastify.inject({
      method: 'GET',
      url: '/test?stringArray=hello&numberArray=123&mixedArray=false&singleValueArray=true',
    });

    expect(responseWithMissing.statusCode).toBe(200);
    expect(JSON.parse(responseWithMissing.payload)).toEqual({
      stringArray: ['hello'],
      numberArray: [123],
      mixedArray: [false],
      singleValueArray: [true],
    });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?stringArray=valid&numberArray=notANumber&mixedArray=invalid&singleValueArray=notABoolean',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe(
      'Expected number, received string at "numberArray[0]"; ' +
      'Expected number, received string at "mixedArray[0]", or Expected boolean, received string at "mixedArray[0]"; ' +
      'Expected boolean, received string at "singleValueArray[0]"'
    );
  });

  it('should coerce tuple values correctly and handle optional fields', async () => {
    const schema = z.object({
      fixedTuple: z.tuple([z.string(), z.number(), z.boolean()]),
      restTuple: z.tuple([z.string(), z.number()]).rest(z.boolean()),
      singleValueTuple: z.tuple([z.number()]),
      optionalTuple: z.tuple([z.string(), z.number()]).optional(),
    });
    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?fixedTuple=hello&fixedTuple=42&fixedTuple=true&restTuple=world&restTuple=123&restTuple=true&restTuple=false&singleValueTuple=999&optionalTuple=foo&optionalTuple=456',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      fixedTuple: ['hello', 42, true],
      restTuple: ['world', 123, true, false],
      singleValueTuple: [999],
      optionalTuple: ['foo', 456],
    });

    const responseWithMissing = await fastify.inject({
      method: 'GET',
      url: '/test?fixedTuple=hello&fixedTuple=42&fixedTuple=true&restTuple=world&restTuple=123&singleValueTuple=777',
    });

    expect(responseWithMissing.statusCode).toBe(200);
    expect(JSON.parse(responseWithMissing.payload)).toEqual({
      fixedTuple: ['hello', 42, true],
      restTuple: ['world', 123],
      singleValueTuple: [777],
    });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?fixedTuple=hello&fixedTuple=notANumber&fixedTuple=notABoolean&restTuple=world&restTuple=123&restTuple=notABoolean&singleValueTuple=notANumber&optionalTuple=bar&optionalTuple=notANumber',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe(
      'Expected number, received string at "fixedTuple[1]"; ' +
      'Expected boolean, received string at "fixedTuple[2]"; ' +
      'Expected boolean, received string at "restTuple[2]"; ' +
      'Expected number, received string at "singleValueTuple[0]"; ' +
      'Expected number, received string at "optionalTuple[1]"'
    );
  });

  it('should coerce set values correctly and handle optional fields', async () => {
    const schema = z.object({
      numberSet: z.set(z.number()),
      stringSet: z.set(z.string()),
      mixedSet: z.set(z.union([z.number(), z.boolean()])),
      optionalSet: z.set(z.boolean()).optional(),
    });
    const queryInterceptor = vi.fn();
    const fastify = await buildServer(schema, queryInterceptor);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?numberSet=1&numberSet=2&numberSet=3&stringSet=a&stringSet=b&stringSet=a&mixedSet=42&mixedSet=true&mixedSet=123&optionalSet=true&optionalSet=false',
    });

    expect(response.statusCode).toBe(200);
    expect(queryInterceptor).toHaveBeenCalledWith({
      numberSet: new Set([1, 2, 3]),
      stringSet: new Set(['a', 'b']),
      mixedSet: new Set([42, true, 123]),
      optionalSet: new Set([true, false]),
    });

    const responseWithMissing = await fastify.inject({
      method: 'GET',
      url: '/test?numberSet=1&numberSet=2&mixedSet=789',
    });

    expect(responseWithMissing.statusCode).toBe(400);
    expect(responseWithMissing.payload).toBe(
      'Required at "stringSet[0]"'
    );

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?numberSet=notANumber&stringSet=valid&mixedSet=invalidValue&optionalSet=notABoolean',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe(
      'Expected number, received string at "numberSet[0]"; ' +
      'Expected number, received string at "mixedSet[0]", or Expected boolean, received string at "mixedSet[0]"; ' +
      'Expected boolean, received string at "optionalSet[0]"'
    );
  });

  it('should handle union types and coerce nested schemas correctly', async () => {
    const schema = z.object({
      numberOrBoolean: z.union([z.number(), z.boolean()]),
      numberOrString: z.union([z.number(), z.string()]),
      multiUnion: z.union([z.number(), z.boolean(), z.string().regex(/^[a-z]+$/)]),
      optionalUnion: z.union([z.number(), z.boolean()]).optional(),
    });
    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?numberOrBoolean=42&numberOrString=123&multiUnion=true&optionalUnion=789',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      numberOrBoolean: 42,
      numberOrString: 123,
      multiUnion: true,
      optionalUnion: 789,
    });

    const responseWithMissing = await fastify.inject({
      method: 'GET',
      url: '/test?numberOrBoolean=false&numberOrString=hello&multiUnion=abc',
    });

    expect(responseWithMissing.statusCode).toBe(200);
    expect(JSON.parse(responseWithMissing.payload)).toEqual({
      numberOrBoolean: false,
      numberOrString: 'hello',
      multiUnion: 'abc',
    });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?numberOrBoolean=notANumberOrBoolean&numberOrString=hello&multiUnion=123ABC&optionalUnion=notANumberOrBoolean',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe(
      'Expected number, received string at "numberOrBoolean", or Expected boolean, received string at "numberOrBoolean"; ' +
      'Invalid at "multiUnion"; ' +
      'Expected number, received string at "optionalUnion", or Expected boolean, received string at "optionalUnion"'
    );
  });

  it('should handle intersection of union types and coerce nested schemas correctly', async () => {
    const schema = z.object({
      numberOrBoolean: z.intersection(
        z.union([z.number(), z.string()]),
        z.union([z.boolean(), z.number()])
      ),
      optionalIntersection: z.intersection(
        z.union([z.number(), z.boolean()]),
        z.union([z.number().min(0), z.boolean()])
      ).optional(),
    });

    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?numberOrBoolean=42&optionalIntersection=10',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      numberOrBoolean: 42,
      optionalIntersection: 10,
    });

    const responseWithMissing = await fastify.inject({
      method: 'GET',
      url: '/test?numberOrBoolean=123',
    });

    expect(responseWithMissing.statusCode).toBe(200);
    expect(JSON.parse(responseWithMissing.payload)).toEqual({
      numberOrBoolean: 123,
    });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?numberOrBoolean=hello&optionalIntersection=-5',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe(
      'Expected boolean, received string at "numberOrBoolean", or Expected number, received string at "numberOrBoolean"; ' +
      'Number must be greater than or equal to 0 at "optionalIntersection"'
    );
  });

  it('should handle catch values and coerce nested schemas correctly', async () => {
    const schema = z.object({
      number: z.number().catch(999),
      string: z.string().min(6).catch('default'),
      boolean: z.boolean().catch(true),
    });

    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?number=123&string=validstring&boolean=false',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      number: 123,
      string: 'validstring',
      boolean: false,
    });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?number=notANumber&string=short&boolean=notABoolean',
    });

    expect(responseWithInvalid.statusCode).toBe(200);
    expect(JSON.parse(responseWithInvalid.payload)).toEqual({
      number: 999,
      string: 'default',
      boolean: true,
    });
  });

  it('should handle default values and coerce nested schemas correctly', async () => {
    const schema = z.object({
      number: z.number().default(42),
      string: z.string().default('defaultString'),
      boolean: z.boolean().default(false),
      optionalWithDefault: z.number().optional().default(100),
    });

    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?number=123&string=customString&boolean=true',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      number: 123,
      string: 'customString',
      boolean: true,
      optionalWithDefault: 100,
    });

    const responseWithMissing = await fastify.inject({
      method: 'GET',
      url: '/test',
    });

    expect(responseWithMissing.statusCode).toBe(200);
    expect(JSON.parse(responseWithMissing.payload)).toEqual({
      number: 42,
      string: 'defaultString',
      boolean: false,
      optionalWithDefault: 100,
    });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?number=notANumber&boolean=notABoolean',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe(
      'Expected number, received string at "number"; ' +
      'Expected boolean, received string at "boolean"'
    );
  });

  it('should handle pipe transformations and coerce input schemas correctly', async () => {
    const schema = z.object({
      number: z.string()
        .transform((str) => parseInt(str, 10))
        .pipe(z.number().min(0).max(100)),
      date: z.string()
        .pipe(z.coerce.date())
        .transform((date) => date.toISOString().split('T')[0]),
      arrayOfNumbers: z.string()
        .transform((str) => str.split(','))
        .pipe(z.array(z.coerce.number().positive())),
    });

    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?number=42&date=2023-05-15&arrayOfNumbers=1,2,3',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      number: 42,
      date: '2023-05-15',
      arrayOfNumbers: [1, 2, 3],
    });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?number=150&date=invalid&arrayOfNumbers=1,-2,3',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe(
      'Number must be less than or equal to 100 at "number"; ' +
      'Invalid date at "date"; ' +
      'Number must be greater than 0 at "arrayOfNumbers[1]"'
    );
  });

  it('should not coerce types in subsequent pipe steps', async () => {
    const schema = z.object({
      nonCoercedNumber: z.string().pipe(z.number()),
    });

    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?nonCoercedNumber=42',
    });

    expect(response.statusCode).toBe(400);
    expect(response.payload).toBe('Expected number, received string at "nonCoercedNumber"');
  });

  it('should handle refine validations and coerce nested schemas correctly', async () => {
    const schema = z.object({
      evenNumber: z.number().refine((n) => n % 2 === 0, { message: 'Must be an even number' }),
    });

    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?evenNumber=4',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ evenNumber: 4 });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?evenNumber=3',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe('Must be an even number at "evenNumber"');
  });

  it('should handle transform validations and coerce nested schemas correctly', async () => {
    const schema = z.object({
      coordinates: z.array(z.number()).transform((arr, ctx) => {
        if (arr.length !== 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Coordinates must be an array of 2 numbers',
          });
          return z.NEVER;
        }
        return { x: arr[0], y: arr[1] };
      }),
      date: z.number().transform((timestamp, ctx) => {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid timestamp',
          });
          return z.NEVER;
        }
        return date.toISOString().split('T')[0];
      }),
    });

    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?coordinates=10&coordinates=20&date=1684147200000',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      coordinates: { x: 10, y: 20 },
      date: '2023-05-15',
    });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?coordinates=10&date=invalid',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe(
      'Coordinates must be an array of 2 numbers at "coordinates"; ' +
      'Expected number, received string at "date"'
    );
  });

  it('should not preprocess when user-defined preprocess is present', async () => {
    const schema = z.object({
      number: z.preprocess((val) => val, z.number().catch(999)),
    });

    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?number=42',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ number: 999 });
  });

  it('should handle undefined, void, any, unknown, and never values correctly', async () => {
    const schema = z.object({
      undefined: z.undefined(),
      void: z.void(),
      any: z.any(),
      unknown: z.unknown(),
      never: z.never().optional(),
    });

    const fastify = await buildServer(schema);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test?any=value1&unknown=value2',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      any: 'value1',
      unknown: 'value2',
    });

    const responseWithInvalid = await fastify.inject({
      method: 'GET',
      url: '/test?undefined=invalid&void=invalid&never=invalid',
    });

    expect(responseWithInvalid.statusCode).toBe(400);
    expect(responseWithInvalid.payload).toBe(
      'Expected undefined, received string at "undefined"; ' +
      'Expected void, received string at "void"; ' +
      'Expected never, received string at "never"'
    );
  });

  it('should throw an error for unsupported schema types during route registration', async () => {
    const unsupportedSchemas = [
      {
        schema: z.object({ unsupported: z.string().brand('Brand') }),
        errorMessage: 'Unsupported schema type for query coercion: ZodBranded at "unsupported"'
      },
      {
        schema: z.object({ unsupported: z.discriminatedUnion('type', [z.object({ type: z.literal('a') }), z.object({ type: z.literal('b') })]) }),
        errorMessage: 'Unsupported schema type for query coercion: ZodDiscriminatedUnion at "unsupported"'
      },
      {
        schema: z.object({ unsupported: z.function() }),
        errorMessage: 'Unsupported schema type for query coercion: ZodFunction at "unsupported"'
      },
      {
        schema: z.object({ unsupported: z.lazy(() => z.string()) }),
        errorMessage: 'Unsupported schema type for query coercion: ZodLazy at "unsupported"'
      },
      {
        schema: z.object({ unsupported: z.map(z.string(), z.string()) }),
        errorMessage: 'Unsupported schema type for query coercion: ZodMap at "unsupported"'
      },
      {
        schema: z.object({ unsupported: z.nan() }),
        errorMessage: 'Unsupported schema type for query coercion: ZodNaN at "unsupported"'
      },
      {
        schema: z.object({ unsupported: z.nativeEnum({ A: 'A', B: 'B' }) }),
        errorMessage: 'Unsupported schema type for query coercion: ZodNativeEnum at "unsupported"'
      },
      {
        schema: z.object({ unsupported: z.promise(z.string()) }),
        errorMessage: 'Unsupported schema type for query coercion: ZodPromise at "unsupported"'
      },
      {
        schema: z.object({ unsupported: z.string().readonly() }),
        errorMessage: 'Unsupported schema type for query coercion: ZodReadonly at "unsupported"'
      },
      {
        schema: z.object({ unsupported: z.record(z.string(), z.string()) }),
        errorMessage: 'Unsupported schema type for query coercion: ZodRecord at "unsupported"'
      },
      {
        schema: z.object({ unsupported: z.symbol() }),
        errorMessage: 'Unsupported schema type for query coercion: ZodSymbol at "unsupported"'
      },
      {
        schema: z.object({ unsupported: z.literal(Symbol('test')) }),
        errorMessage: 'Unsupported schema type for query coercion: ZodLiteral with symbol at "unsupported"'
      }
    ];

    for (const { schema, errorMessage } of unsupportedSchemas) {
      try {
        await buildServer(schema);
        expect.unreachable();
      } catch (error: any) {
        expect(error).toBeInstanceOf(FST_ZOD_QUERY_COERCION_ERROR);
        expect(error.message).toBe(errorMessage);
      }
    }
  });

  it('should coerce query parameters but not affect body schema', async () => {
    const numberSchema = z.number().optional();
    const stringSchema = z.string().optional();
    const booleanSchema = z.boolean().optional();

    const sharedSchema = z.object({
      number: numberSchema,
      string: stringSchema,
      boolean: booleanSchema,
    });

    const app = Fastify();

    app.setValidatorCompiler(validatorCompiler);
    app.setErrorHandler((error, request, reply) => {
      if (error instanceof ZodError && error.statusCode) {
        reply.status(error.statusCode).send(fromZodError(error, { prefix: null }).toString());
      } else {
        reply.send(error);
      }
    });

    await app.register(fastifyZodQueryCoercion);

    app.post('/test', {
      schema: {
        querystring: sharedSchema,
        body: sharedSchema,
      },
      handler: (request, reply) => {
        return { query: request.query, body: request.body };
      },
    });

    await app.ready();

    // Test query parameter coercion
    const queryResponse = await app.inject({
      method: 'POST',
      url: '/test?number=42&string=hello&boolean=true',
      payload: {
        number: 42,
        string: "world",
        boolean: false
      },
    });

    expect(queryResponse.statusCode).toBe(200);
    const queryResult = JSON.parse(queryResponse.payload);

    // Query parameters should be coerced
    expect(queryResult.query).toEqual({
      number: 42,
      string: "hello",
      boolean: true
    });

    // Test body schema remains unaffected
    const bodyResponse = await app.inject({
      method: 'POST',
      url: '/test?number=42&string=hello&boolean=true',
      payload: {
        number: "42",
        string: "world",
        boolean: "false"
      },
    });

    // Body should fail validation
    expect(bodyResponse.statusCode).toBe(400);
    expect(bodyResponse.payload).toContain('Expected number, received string at "number"');
    expect(bodyResponse.payload).toContain('Expected boolean, received string at "boolean"');

    // Verify that the original schemas are unchanged
    expect(numberSchema).toBe(sharedSchema.shape.number);
    expect(stringSchema).toBe(sharedSchema.shape.string);
    expect(booleanSchema).toBe(sharedSchema.shape.boolean);
  });
});