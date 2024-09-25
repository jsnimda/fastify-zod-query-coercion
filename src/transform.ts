import { z } from 'zod';
import { isZodType } from './zod-types.js';

// use ajv coercion rules for zod
// https://ajv.js.org/coercion.html

const isValidNumber = (str: string): boolean => {
  return !isNaN(Number(str)) && isFinite(Number(str));
};

const isValidDate = (str: string): boolean => {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{0,3})?Z$/;
  return isoDateRegex.test(str);
};

export class UnsupportedZodType extends Error {
  constructor(typeName: string) {
    super(`Unsupported schema type for query coercion: ${typeName}`);
    this.name = 'UnsupportedZodType';
  }
}

export function transformSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (isZodType(schema, 'ZodEffects')) {
    if (schema._def.effect.type === 'preprocess') {
      return schema;
    }
    return new z.ZodEffects({
      ...schema._def,
      schema: transformSchema(schema._def.schema),
    });
  }

  if (isZodType(schema, 'ZodLiteral')) {
    if (typeof schema._def.value === 'symbol') throw new UnsupportedZodType('ZodLiteral with symbol');
    return z.preprocess((val) => {
      if (typeof schema._def.value === 'symbol') /* v8 ignore next */ return val;
      if (typeof schema._def.value === 'undefined') return val;
      if (('' + schema._def.value) === val) return schema._def.value;
      return val;
    }, schema);
  }

  if (isZodType(schema, 'ZodString')) {
    return schema;
  }

  if (isZodType(schema, 'ZodNumber')) {
    return z.preprocess((val) => {
      if (typeof val === 'string' && isValidNumber(val)) return Number(val);
      return val;
    }, schema);
  }

  if (isZodType(schema, 'ZodBigInt')) {
    return z.preprocess((val) => {
      try {
        if (typeof val === 'string') return BigInt(val);
        return val;
      } catch {
        return val;
      }
    }, schema);
  }

  if (isZodType(schema, 'ZodBoolean')) {
    return z.preprocess((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    }, schema);
  }

  if (isZodType(schema, 'ZodDate')) {
    return z.preprocess((val) => {
      if (typeof val === 'string') {
        if (isValidNumber(val)) return new Date(Number(val));
        if (isValidDate(val)) return new Date(val);
      }
      return val;
    }, schema);
  }

  if (isZodType(schema, 'ZodEnum')) {
    return schema;
  }

  if (isZodType(schema, 'ZodNull')) {
    return z.preprocess((val) => {
      if (val === 'null') return null;
      return val;
    }, schema);
  }

  if (isZodType(schema, 'ZodNullable')) {
    return z.preprocess((val) => {
      if (val === 'null') return null;
      return val;
    }, new z.ZodNullable({
      ...schema._def,
      innerType: transformSchema(schema._def.innerType),
    }));
  }

  if (isZodType(schema, 'ZodOptional')) {
    return new z.ZodOptional({
      ...schema._def,
      innerType: transformSchema(schema._def.innerType),
    });
  }

  if (isZodType(schema, 'ZodArray')) {
    return z.preprocess((val) => {
      if (Array.isArray(val)) return val;
      return [val];
    }, new z.ZodArray({
      ...schema._def,
      type: transformSchema(schema._def.type),
    }));
  }

  if (isZodType(schema, 'ZodTuple')) {
    return z.preprocess((val) => {
      if (Array.isArray(val)) return val;
      return [val];
    }, new z.ZodTuple({
      ...schema._def,
      items: schema._def.items.map(transformSchema) as any,
      rest: schema._def.rest ? transformSchema(schema._def.rest) : null,
    }));
  }

  if (isZodType(schema, 'ZodSet')) {
    return z.preprocess((val) => {
      if (Array.isArray(val)) return new Set(val);
      return new Set([val]);
    }, new z.ZodSet({
      ...schema._def,
      valueType: transformSchema(schema._def.valueType),
    }));
  }

  if (isZodType(schema, 'ZodUnion')) {
    return new z.ZodUnion({
      ...schema._def,
      options: schema._def.options.map(transformSchema) as any,
    });
  }

  if (isZodType(schema, 'ZodIntersection')) {
    return new z.ZodIntersection({
      ...schema._def,
      left: transformSchema(schema._def.left),
      right: transformSchema(schema._def.right),
    });
  }

  if (isZodType(schema, 'ZodCatch')) {
    return new z.ZodCatch({
      ...schema._def,
      innerType: transformSchema(schema._def.innerType),
    });
  }

  if (isZodType(schema, 'ZodDefault')) {
    return new z.ZodDefault({
      ...schema._def,
      innerType: transformSchema(schema._def.innerType),
    });
  }

  if (isZodType(schema, 'ZodPipeline')) {
    return new z.ZodPipeline({
      ...schema._def,
      in: transformSchema(schema._def.in),
    });
  }

  if (isZodType(schema, 'ZodUndefined')) {
    return schema;
  }

  if (isZodType(schema, 'ZodVoid')) {
    return schema;
  }

  if (isZodType(schema, 'ZodAny')) {
    return schema;
  }

  if (isZodType(schema, 'ZodUnknown')) {
    return schema;
  }

  if (isZodType(schema, 'ZodNever')) {
    return schema;
  }

  // If it's not a handled type, throw error
  throw new UnsupportedZodType(schema.constructor.name);
}
