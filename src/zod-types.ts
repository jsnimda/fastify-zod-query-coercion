import type { z } from 'zod';

// Reference: https://github.com/asteasolutions/zod-to-openapi/blob/master/src/lib/zod-is-type.ts

type ZodTypeMap = {
  ZodArray: z.ZodArray<z.ZodTypeAny>;
  ZodBoolean: z.ZodBoolean;
  ZodDefault: z.ZodDefault<z.ZodTypeAny>;
  ZodEffects: z.ZodEffects<z.ZodTypeAny>;
  ZodNull: z.ZodNull;
  ZodNullable: z.ZodNullable<z.ZodTypeAny>;
  ZodNumber: z.ZodNumber;
  ZodObject: z.ZodObject<z.ZodRawShape>;
  ZodOptional: z.ZodOptional<z.ZodTypeAny>;
  ZodString: z.ZodString;
  ZodTuple: z.AnyZodTuple;
  ZodUnion: z.ZodUnion<z.ZodUnionOptions>;
};

export function isZodType<K extends keyof ZodTypeMap>(
  schema: unknown,
  typeName: K
): schema is ZodTypeMap[K] {
  return (schema as any)?._def?.typeName === typeName;
}
