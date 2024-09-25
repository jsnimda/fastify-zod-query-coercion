import type { FastifySchemaCompiler } from 'fastify';
import type { z } from 'zod';

export const validatorCompiler: FastifySchemaCompiler<z.ZodType> = ({ schema }) => (value) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    return { error: result.error };
  }
  return { value: result.data };
};