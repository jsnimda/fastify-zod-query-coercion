import createError from '@fastify/error';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { FASTIFY_ZOD_QUERY_COERCION_PROCESSED } from './symbols.js';
import { transformSchema, UnsupportedZodType } from './transform.js';
import { isZodType } from './zod-types.js';

export const FST_ZOD_QUERY_COERCION_ERROR = createError('FST_ZOD_QUERY_COERCION_ERROR', '%s at "%s"');

type CoercibleSchemaType = 'querystring' | 'params' | 'headers' | 'body';

interface FastifyZodQueryCoercionOptions {
  coerceTypes?: CoercibleSchemaType[];
}

const plugin: FastifyPluginAsync<FastifyZodQueryCoercionOptions> = async (fastify, opts) => {
  const coerceTypes = opts.coerceTypes ?? ['querystring'];

  fastify.addHook('onRoute', (route) => {
    coerceTypes.forEach((coerceType) => {
      if (
        isZodType(route.schema?.[coerceType], 'ZodObject') &&
        !(route.schema[coerceType] as any)[FASTIFY_ZOD_QUERY_COERCION_PROCESSED]
      ) {
        route.schema[coerceType] = transformObject(route.schema[coerceType]);
        (route.schema[coerceType] as any)[FASTIFY_ZOD_QUERY_COERCION_PROCESSED] = true;
      }
    });
  });
};

function transformObject(schema: z.ZodObject<z.ZodRawShape>) {
  const newShape = Object.entries(schema.shape).reduce((acc, [key, value]) => {
    try {
      acc[key] = transformSchema(value);
    } catch (error) {
      if (error instanceof UnsupportedZodType) {
        throw FST_ZOD_QUERY_COERCION_ERROR(error.message, key);
      }
      throw error;
    }
    return acc;
  }, {} as z.ZodRawShape);
  return new z.ZodObject({
    ...schema._def,
    shape: () => newShape,
  });
}

const fastifyZodQueryCoercion = fp(plugin, {
  fastify: '>=4',
  name: 'fastify-zod-query-coercion',
});

export default fastifyZodQueryCoercion;