import Ajv2020 from "ajv/dist/2020"
import addFormats from "ajv-formats"

type JsonSchema = Record<string, unknown>

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  allowUnionTypes: true
})

addFormats(ajv)

const AS2_DATE_TIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

ajv.addFormat("as2-date-time", {
  type: "string",
  validate: (value: string) => AS2_DATE_TIME_RE.test(value)
})

const schemaModules: Record<string, JsonSchema> = import.meta.glob(
  "@/lib/validation/schemas/activitypub/as2/**/*.json",
  {
    eager: true,
    import: "default",
  },
)

for (const [path, schema] of Object.entries(schemaModules)) {
  if (!schema.$id || typeof schema.$id !== "string") {
    throw new Error(`Schema at ${path} is missing a string $id`)
  }
  ajv.addSchema(schema)
}

export { ajv }