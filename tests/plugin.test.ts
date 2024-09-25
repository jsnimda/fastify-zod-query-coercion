import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import fastifyZodQueryCoercion, { FST_ZOD_QUERY_COERCION_ERROR } from '../src/plugin.js';
import { FASTIFY_ZOD_QUERY_COERCION_PROCESSED } from '../src/symbols.js';
import * as transform from '../src/transform.js';
import { validatorCompiler } from './test-utils.js';

describe('fastifyZodQueryCoercion plugin', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(() => {
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
  });

  afterEach(async () => {
    await app.close();
  });

  it('should register the plugin successfully', async () => {
    await expect(app.register(fastifyZodQueryCoercion)).resolves.not.toThrow();
  });

  it('should transform querystring schema', async () => {
    await app.register(fastifyZodQueryCoercion);

    const schema = z.object({ test: z.string() });
    const transformSpy = vi.spyOn(transform, 'transformSchema');

    app.get('/', { schema: { querystring: schema } }, () => 'ok');

    await app.ready();

    expect(transformSpy).toHaveBeenCalledWith(schema.shape.test);
    expect((schema as any)[FASTIFY_ZOD_QUERY_COERCION_PROCESSED]).toBe(true);
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
    vi.spyOn(transform, 'transformSchema').mockImplementation(() => {
      throw new transform.UnsupportedZodType('Unsupported type');
    });

    expect(() => {
      app.get('/', { schema: { querystring: schema } }, () => 'ok');
    }).toThrow(FST_ZOD_QUERY_COERCION_ERROR);
  });

  it('should rethrow non-UnsupportedZodType errors', async () => {
    await app.register(fastifyZodQueryCoercion);

    const schema = z.object({ test: z.string() });
    vi.spyOn(transform, 'transformSchema').mockImplementation(() => {
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
});