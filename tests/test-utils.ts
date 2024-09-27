import type { FastifyError, FastifyReply, FastifyRequest, FastifySchemaCompiler, FastifyTypeProvider } from 'fastify';
import Fastify from 'fastify';
import { ZodError, type z } from 'zod';
import { fromZodError } from 'zod-validation-error';

interface ZodTypeProvider extends FastifyTypeProvider {
  validator: this['schema'] extends z.ZodTypeAny ? z.output<this['schema']> : unknown;
  serializer: this['schema'] extends z.ZodTypeAny ? z.input<this['schema']> : unknown;
}

export const getFastify = () => Fastify().withTypeProvider<ZodTypeProvider>();

export const validatorCompiler: FastifySchemaCompiler<z.ZodType> = ({ schema }) => (value) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    return { error: result.error };
  }
  return { value: result.data };
};

export const errorHandler = (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
  if (error instanceof ZodError && error.statusCode) {
    reply.status(error.statusCode).send(fromZodError(error, { prefix: null }).toString());
  } else {
    reply.send(error);
  }
};