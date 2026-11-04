/**
 * Type of the I-th argument of a use-case's execute().
 *
 * Controllers type ts-rest handler inputs with this instead of
 * ServerInferRequest: on @ts-rest/core 3.52 + zod 4 those inferred types
 * collapse to `never` (see auth.controller.ts). Runtime validation still
 * runs against the contract's Zod schemas; this only feeds the compiler.
 */
export type UseCaseArg<
  U extends { execute: (...args: never[]) => unknown },
  I extends number,
> = Parameters<U["execute"]>[I];
