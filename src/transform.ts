import { z } from 'zod';
import { isZodType } from './zod-types.js';

// use ajv coercion rules for zod
// https://ajv.js.org/coercion.html

const isValidNumber = (str: string): boolean => {
  return !isNaN(Number(str)) && isFinite(Number(str));
};

export class UnsupportedZodType extends Error {
  constructor(typeName: string) {
    super(`Unsupported schema type for query coercion: ${typeName}`);
    this.name = 'UnsupportedZodType';
  }
}

export function transformSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (isZodType(schema, 'ZodEffects')) {
    schema._def.schema = transformSchema(schema._def.schema);
    return schema;
  }

  if (isZodType(schema, 'ZodBoolean')) {
    return z.preprocess((val) => {
      if (val === 'true' || val === '1') return true;
      if (val === 'false' || val === '0') return false;
      return val;
    }, schema);
  }

  if (isZodType(schema, 'ZodNumber')) {
    return z.preprocess((val) => {
      if (typeof val === 'string' && isValidNumber(val)) return Number(val);
      return val;
    }, schema);
  }

  if (isZodType(schema, 'ZodString')) {
    return z.preprocess((val) => {
      if (typeof val === 'string') return val;
      return val;
    }, schema);
  }

  if (isZodType(schema, 'ZodNull')) {
    return z.preprocess((val) => {
      if (val === 'null') return null;
      return val;
    }, schema);
  }

  if (isZodType(schema, 'ZodNullable')) {
    schema._def.innerType = transformSchema(schema._def.innerType);
    return z.preprocess((val) => {
      if (val === 'null') return null;
      return val;
    }, schema);
  }

  if (isZodType(schema, 'ZodOptional')) {
    schema._def.innerType = transformSchema(schema._def.innerType);
    return schema;
  }

  if (isZodType(schema, 'ZodDefault')) {
    schema._def.innerType = transformSchema(schema._def.innerType);
    return schema;
  }

  if (isZodType(schema, 'ZodArray')) {
    schema._def.type = transformSchema(schema._def.type);
    return z.preprocess((val) => {
      if (Array.isArray(val)) return val;
      return [val];
    }, schema);
  }

  if (isZodType(schema, 'ZodUnion')) {
    schema._def.options = schema._def.options.map(transformSchema) as any;
    return schema;
  }

  if (isZodType(schema, 'ZodTuple')) {
    schema._def.items = schema._def.items.map(transformSchema) as any;
    if (schema._def.rest) {
      schema._def.rest = transformSchema(schema._def.rest);
    }
    return z.preprocess((val) => {
      if (Array.isArray(val)) return val;
      return [val];
    }, schema);
  }

  // If it's not a handled type, throw error
  throw new UnsupportedZodType(schema.constructor.name);
}
