# Detailed Coercion Rules and Limitations

## Supported Zod Types

The following Zod types are supported for individual query string values:

| Zod Class       | Zod Type                | Coercion Rule / z.preprocess()                                          |
|-----------------|-------------------------|-------------------------------------------------------------------------|
| ZodAny          | `z.any()`               | N/A (Direct passthrough)                                                |
| ZodArray        | `z.array()`             | String → `[val]`, then process inner schema                             |
| ZodBigInt       | `z.bigint()`            | Valid BigInt string → `BigInt(val)`                                     |
| ZodBoolean      | `z.boolean()`           | `"true"` → `true`, `"false"` → `false`                                  |
| ZodCatch        | `anySchema.catch()`     | Process inner schema                                                    |
| ZodDate         | `z.date()`              | Valid number or ISO date string → `new Date(val)`                       |
| ZodDefault      | `anySchema.default()`   | Process inner schema                                                    |
| ZodEffects      | `anySchema.refine()`    | Process inner schema                                                    |
| ZodEffects      | `anySchema.transform()` | Process inner schema                                                    |
| ZodEffects      | `z.preprocess()`        | N/A (Direct passthrough, user-defined preprocessing)                    |
| ZodEnum         | `z.enum()`              | N/A (Direct passthrough)                                                |
| ZodIntersection | `z.intersection()`      | Process both left and right schemas                                     |
| ZodLiteral      | `z.literal()`           | Convert to literal if string representation matches¹                    |
| ZodNever        | `z.never()`             | N/A (Direct passthrough)                                                |
| ZodNull         | `z.null()`              | `"null"` → `null`                                                       |
| ZodNullable     | `anySchema.nullable()`  | `"null"` → `null`, then process inner schema                            |
| ZodNumber       | `z.number()`            | Valid number string → `Number(val)`                                     |
| ZodOptional     | `anySchema.optional()`  | Process inner schema                                                    |
| ZodPipeline     | `anySchema.pipe()`      | Process only the input schema                                           |
| ZodSet          | `z.set()`               | String → `Set([val])`, String[] → `Set(val)`, then process inner schema |
| ZodString       | `z.string()`            | N/A (Direct passthrough)                                                |
| ZodTuple        | `z.tuple()`             | String → `[val]`, then process inner schema                             |
| ZodUndefined    | `z.undefined()`         | N/A (Direct passthrough)                                                |
| ZodUnion        | `z.union()`             | Process each inner schema in the union                                  |
| ZodUnknown      | `z.unknown()`           | N/A (Direct passthrough)                                                |
| ZodVoid         | `z.void()`              | N/A (Direct passthrough)                                                |

¹ ZodLiteral: `z.literal(undefined)` is treated the same as `z.undefined()`. `z.literal()` with symbol is not supported.

Note: ZodObject is supported as the top-level schema for the entire query string, but not for individual query string values.

## Unsupported Zod Types

Due to the limitations of query string representation, the following Zod types are not supported for individual query string values:

| Zod Class             | Zod Type                                      |
|-----------------------|-----------------------------------------------|
| ZodBranded            | `anySchema.brand()`                           |
| ZodDiscriminatedUnion | `z.discriminatedUnion()`                      |
| ZodFunction           | `z.function()`                                |
| ZodLazy               | `z.lazy()`                                    |
| ZodMap                | `z.map()`                                     |
| ZodNaN                | `z.nan()`                                     |
| ZodNativeEnum         | `z.nativeEnum()`                              |
| ZodPromise            | `z.promise()`                                 |
| ZodReadonly           | `anySchema.readonly()`                        |
| ZodRecord             | `z.record()`                                  |
| ZodSymbol             | `z.symbol()`                                  |
| ZodObject             | `z.object()` (except as the top-level schema) |

These types are either not possible to represent in a query string or require custom parsing logic. If you need to use these types, consider using alternative representations or handling them differently in your application logic.
