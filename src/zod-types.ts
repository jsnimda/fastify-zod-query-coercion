import type { z } from 'zod';

// Reference: https://github.com/samchungy/zod-openapi/blob/master/src/zodType.ts

type ZodTypeMap = {
  /* unsupported */ ZodBranded: z.ZodBranded<z.ZodTypeAny, string | number | symbol>;
  /* unsupported */ ZodDiscriminatedUnion: z.ZodDiscriminatedUnion<string, any>;
  /* unsupported */ ZodFunction: z.ZodFunction<z.ZodTuple<any, any>, z.ZodTypeAny>;
  /* unsupported */ ZodLazy: z.ZodLazy<z.ZodTypeAny>;
  /* unsupported */ ZodMap: z.ZodMap;
  /* unsupported */ ZodNaN: z.ZodNaN;
  /* unsupported */ ZodNativeEnum: z.ZodNativeEnum<z.EnumLike>;
  /* unsupported */ ZodPromise: z.ZodPromise<z.ZodTypeAny>;
  /* unsupported */ ZodReadonly: z.ZodReadonly<z.ZodTypeAny>;
  /* unsupported */ ZodRecord: z.ZodRecord;
  /* unsupported */ ZodSymbol: z.ZodSymbol;
  /* unsupported, except as the top-level schema */ ZodObject: z.ZodObject<z.ZodRawShape>;
  ZodAny: z.ZodAny;
  ZodArray: z.ZodArray<z.ZodTypeAny>;
  ZodBigInt: z.ZodBigInt;
  ZodBoolean: z.ZodBoolean;
  ZodCatch: z.ZodCatch<z.ZodTypeAny>;
  ZodDate: z.ZodDate;
  ZodDefault: z.ZodDefault<z.ZodTypeAny>;
  ZodEffects: z.ZodEffects<z.ZodTypeAny>;
  ZodEnum: z.ZodEnum<[string, ...string[]]>;
  ZodIntersection: z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>;
  ZodLiteral: z.ZodLiteral<z.Primitive>;
  ZodNever: z.ZodNever;
  ZodNull: z.ZodNull;
  ZodNullable: z.ZodNullable<z.ZodTypeAny>;
  ZodNumber: z.ZodNumber;
  ZodOptional: z.ZodOptional<z.ZodTypeAny>;
  ZodPipeline: z.ZodPipeline<z.ZodTypeAny, z.ZodTypeAny>;
  ZodSet: z.ZodSet;
  ZodString: z.ZodString;
  ZodTuple: z.AnyZodTuple;
  ZodUndefined: z.ZodUndefined;
  ZodUnion: z.ZodUnion<z.ZodUnionOptions>;
  ZodUnknown: z.ZodUnknown;
  ZodVoid: z.ZodVoid;
};

export function isZodType<K extends keyof ZodTypeMap>(
  schema: unknown,
  typeName: K
): schema is ZodTypeMap[K] {
  return (schema as any)?._def?.typeName === typeName;
}
