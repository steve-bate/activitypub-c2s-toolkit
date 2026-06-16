import type { ErrorObject, ValidateFunction } from "ajv"
import { ajv } from "@/lib/validation/ajv"

export interface ValidationResult<T = unknown> {
  valid: boolean
  data: T
  errors: ErrorObject[] | null | undefined
}

export function validateBySchemaId<T = unknown>(
  schemaId: string,
  data: unknown
): ValidationResult<T> {
  const validate = ajv.getSchema(schemaId) as ValidateFunction<T> | undefined

  if (!validate) {
    throw new Error(`No compiled schema found for ${schemaId}`)
  }

  const valid = validate(data)

  return {
    valid: !!valid,
    data: data as T,
    errors: validate.errors
  }
}