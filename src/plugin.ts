import createError from '@fastify/error';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { FASTIFY_ZOD_QUERY_COERCION_PROCESSED } from './symbols.js';
import { transformSchema, UnsupportedZodType } from './transform.js';
import { isZodType } from './zod-types.js';

export const FST_ZOD_QUERY_COERCION_ERROR = createError('FST_ZOD_QUERY_COERCION_ERROR', '%s at "%s"');

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRoute', (route) => {
    if (
      isZodType(route.schema?.querystring, 'ZodObject') &&
      !(route.schema.querystring as any)[FASTIFY_ZOD_QUERY_COERCION_PROCESSED]
    ) {
      route.schema.querystring = transformObject(route.schema.querystring);
      (route.schema.querystring as any)[FASTIFY_ZOD_QUERY_COERCION_PROCESSED] = true;
    }
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