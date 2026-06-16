export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonArray
export type JsonObject = { [key: string]: JsonValue }
export type JsonArray = JsonValue[]

export type SplitDelimiter = 'comma' | 'newline' | 'comma-or-newline'

export type SplitSingleMode = 'scalar' | 'array'
export type SplitEmptyMode = 'scalar' | 'array'

export interface SplitTransformer {
  type: 'split'
  delimiter?: SplitDelimiter | RegExp | string
  trim?: boolean
  removeEmpty?: boolean
  dedupe?: boolean
  single?: SplitSingleMode
  empty?: SplitEmptyMode
}

export interface TemplateTransformer {
  type: 'template'
  template: string
}

export interface UtcDateTimeTransformer {
  type: 'datetime-utc'
}

export type ValueTransformer = SplitTransformer | UtcDateTimeTransformer | TemplateTransformer

export interface BaseEditorSchemaNode {
  postprocess?: ValueTransformer[]
  [key: string]: unknown
}

export interface EditorGroupNode extends BaseEditorSchemaNode {
  $formkit: 'group'
  name: string
}

export interface EditorInputNode extends BaseEditorSchemaNode {
  $formkit: string
  name: string
}

export interface EditorElementNode extends BaseEditorSchemaNode {
  $el: string
  name?: string
}

export type EditorSchemaNode = EditorGroupNode | EditorInputNode | EditorElementNode

export type EditorSchema = {
  name: string
  nodes: EditorSchemaNode[]
  extra?: boolean
  //postprocess?: ValueTransformer[]
}

export interface ResourceTemplate {
  id?: string
  name: string
  description?: string
  editorType: "form" | "json"
  template: string
  document?: JsonObject,
  [key: string]: unknown
}

export type ValidationResult = {
  valid: boolean
  errors: any
}
