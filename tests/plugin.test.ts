import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import fastifyZodQueryCoercion, { FST_ZOD_QUERY_COERCION_ERROR } from '../src/plugin.js';
import { FASTIFY_ZOD_QUERY_COERCION_PROCESSED } from '../src/symbols.js';
import * as transform from '../src/transform.js';
import { errorHandler, getFastify, validatorCompiler } from './test-utils.js';

describe('fastifyZodQueryCoercion plugin', () => {
  let app: ReturnType<typeof getFastify>;

  beforeEach(() => {
    app = getFastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setErrorHandler(errorHandler);
  });

  afterEach(async () => {
    await app.close();
  });

  it('should register the plugin successfully', async () => {
    await expect(app.register(fastifyZodQueryCoercion)).resolves.not.toThrow();
  });

  it('should transform querystring schema', async () => {
    await app.register(fastifyZodQueryCoercion);

    const originalSchema = z.object({ test: z.string() });
    const transformSpy = vi.spyOn(transform, 'transformSchema');

    let transformedSchema: z.ZodObject<any> | undefined;
    app.addHook('onRoute', (routeOptions) => {
      transformedSchema = routeOptions.schema?.querystring as z.ZodObject<any>;
    });

    app.get('/', { schema: { querystring: originalSchema } }, () => 'ok');

    await app.ready();

    expect(transformSpy).toHaveBeenCalledWith(originalSchema.shape.test);
    expect(transformedSchema).toBeDefined();
    expect(transformedSchema).not.toBe(originalSchema);
    expect((transformedSchema as any)[FASTIFY_ZOD_QUERY_COERCION_PROCESSED]).toBe(true);
    expect((originalSchema as any)[FASTIFY_ZOD_QUERY_COERCION_PROCESSED]).toBeUndefined();
  });

  it('should not transform schema if already processed', async () => {
    await app.register(fastifyZodQueryCoercion);

    const schema = z.object({ test: z.string() });
    (schema as any)[FASTIFY_ZOD_QUERY_COERCION_PROCESSED] = true;
    const transformSpy = vi.spyOn(transform, 'transformSchema');

    app.get('/', { schema: { querystring: schema } }, () => 'ok');

    await app.ready();

    expect(transformSpy).not.toHaveBeenCalled();
  });

  it('should throw FST_ZOD_QUERY_COERCION_ERROR for unsupported types', async () => {
    await app.register(fastifyZodQueryCoercion);

    const schema = z.object({ test: z.string().brand('Brand') });
    vi.spyOn(transform, 'transformSchema').mockImplementationOnce(() => {
      throw new transform.UnsupportedZodType('Unsupported type');
    });

    expect(() => {
      app.get('/', { schema: { querystring: schema } }, () => 'ok');
    }).toThrow(FST_ZOD_QUERY_COERCION_ERROR);
  });

  it('should rethrow non-UnsupportedZodType errors', async () => {
    await app.register(fastifyZodQueryCoercion);

    const schema = z.object({ test: z.string() });
    vi.spyOn(transform, 'transformSchema').mockImplementationOnce(() => {
      throw new Error('Unexpected error');
    });

    expect(() => {
      app.get('/', { schema: { querystring: schema } }, () => 'ok');
    }).toThrow('Unexpected error');
  });

  it('should not transform non-ZodObject querystring schemas', async () => {
    await app.register(fastifyZodQueryCoercion);

    const schema = z.string();
    const transformSpy = vi.spyOn(transform, 'transformSchema');

    app.get('/', { schema: { querystring: schema } }, () => 'ok');

    await app.ready();

    expect(transformSpy).not.toHaveBeenCalled();
  });

  it('should not modify the original schema object', async () => {
    let routeConfig: any;
    app.addHook('onRoute', (route) => {
      if (route.method === 'GET' && route.url === '/') {
        routeConfig = route;
      }
    });

    await app.register(fastifyZodQueryCoercion);

    const originalSchema = z.object({
      number: z.number(),
      string: z.string(),
      boolean: z.boolean(),
    });

    const originalSchemaCopy = { ...originalSchema };

    app.get('/', {
      schema: { querystring: originalSchema },
      handler: () => 'ok',
    });

    await app.ready();

    // Check that the original schema object hasn't been modified
    expect(originalSchema).toEqual(originalSchemaCopy);

    // Ensure that routeConfig was set
    expect(routeConfig).toBeDefined();

    // Check that the schema used by the route is different from the original
    expect(routeConfig.schema.querystring).not.toBe(originalSchema);
    expect(routeConfig.schema.querystring._def.shape()).not.toBe(originalSchema.shape);

    // Verify that the transformed schema has the processed flag
    expect((routeConfig.schema.querystring as any)[FASTIFY_ZOD_QUERY_COERCION_PROCESSED]).toBe(true);

    // The original schema should not have the processed flag
    expect((originalSchema as any)[FASTIFY_ZOD_QUERY_COERCION_PROCESSED]).toBeUndefined();
  });

  it('should not transform params schema by default', async () => {
    await app.register(fastifyZodQueryCoercion);

    app.get('/:id', {
      schema: {
        params: z.object({
          id: z.number()
        })
      }
    }, (request) => {
      return { id: request.params.id };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/123',
    });

    expect(response.statusCode).toBe(400);
    expect(response.payload).toBe('Expected number, received string at "id"');
  });

  it('should transform params schema when specified in options', async () => {
    await app.register(fastifyZodQueryCoercion, { coerceTypes: ['querystring', 'params'] });

    app.get('/:id', {
      schema: {
        params: z.object({
          id: z.number()
        })
      }
    }, (request) => {
      return { id: request.params.id };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/123',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ id: 123 });
  });
});