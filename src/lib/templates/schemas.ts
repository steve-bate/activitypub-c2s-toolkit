
//const ACTOR = "https://server.example/actor"
import { EditorSchema, EditorSchemaNode } from './types'

const asObjectCommon: EditorSchemaNode[] = [
  // {
  //   $formkit: "text",
  //   name: "id",
  //   label: "ID",
  //   help: "Absolute IRI for this object.",
  // },
  {
    $formkit: "select",
    name: "type",
    label: "Type",
    placeholder: "Choose a type",
    validation: "required",
    options: [],
  },
  {
    $formkit: "text",
    name: "name",
    label: "Name",
  },
  {
    $formkit: "textarea",
    name: "summary",
    label: "Summary",
    rows: 3,
  },
  {
    $formkit: "textarea",
    name: "content",
    label: "Content",
    rows: 5,
    //validation: "required",
    help: "AS2 content may be plain text or HTML depending on mediaType.",
  },
  {
    $formkit: "textarea",
    name: "tag",
    label: "Tags",
    rows: 3,
    help: "One tag/link/object per line or map in your serializer.",
    postprocess: [
      {
        type: 'split',
        delimiter: 'newline',
        trim: true,
        removeEmpty: true,
        single: 'array',
      },
      {
        type: 'template',
        template: `[
          {{#each value}}
            {
              "type": "HashTag",
              "href": "{{../serverPrefix}}/tags/{{this}}",
              "name": "#{{this}}"
            }{{#unless @last}},{{/unless}}
          {{/each}}
        ]`,
      }
    ],
  },
  {
    $formkit: "text",
    name: "mediaType",
    label: "Media type",
    help: "Examples: text/html, image/png, video/mp4",
  },
  {
    $formkit: "text",
    name: "url",
    label: "URL",
    help: "Canonical or public URL for this resource.",
  },
  {
    $formkit: "datetime-local",
    key: "published",
    name: "published",
    label: "Published",
    if: "$get(type).value != 'Update'",
    postprocess: [
      {
        type: 'datetime-utc',
      },
    ]
  },
  {
    $formkit: "datetime-local",
    key: "updated",
    name: "updated",
    label: "Updated",
    postprocess: [
      {
        type: 'datetime-utc',
      },
    ]
  },
];

// const audienceNodes: EditorSchemaNode[] = [
//   {
//     $formkit: "textarea",
//     name: "to",
//     label: "To",
//     rows: 2,
//     help: "One IRI per line or JSON array, depending on your app binding.",
//     postprocess: [
//       {
//         type: 'split',
//         delimiter: 'newline',
//         trim: true,
//         removeEmpty: true,
//         single: 'scalar',
//         empty: 'array',
//       },
//     ],
//   },
//   {
//     $formkit: "textarea",
//     name: "cc",
//     label: "CC",
//     rows: 2,
//     postprocess: [
//       {
//         type: 'split',
//         delimiter: 'newline',
//         trim: true,
//         removeEmpty: true,
//         single: 'scalar',
//         empty: 'array',
//       },
//     ],
//   },
//   // {
//   //   $formkit: "textarea",
//   //   name: "bto",
//   //   label: "BTO",
//   //   rows: 2,
//   // },
//   // {
//   //   $formkit: "textarea",
//   //   name: "bcc",
//   //   label: "BCC",
//   //   rows: 2,
//   // },
// ];

const audienceNodes: EditorSchemaNode[] = [
    {
      $formkit: "textarea",
      name: "to",
      label: "To",
      rows: 2,
      help: "One IRI per line",
      postprocess: [
        {
          type: 'split',
          delimiter: 'newline',
          trim: true,
          removeEmpty: true,
          single: 'scalar',
          empty: 'array',
        },
      ],
    },
    {
      $formkit: "textarea",
      name: "cc",
      label: "CC",
      rows: 2,
      help: "One IRI per line",
      postprocess: [
        {
          type: 'split',
          delimiter: 'newline',
          trim: true,
          removeEmpty: true,
          single: 'scalar',
          empty: 'array',
        },
      ],
    },
]


const conditionalObjectAudience: EditorSchemaNode[] = [{
  $el: 'fieldset',
  attrs: { 'class': 'border-2 border-gray-500 rounded-md px-2 mb-4', },
  if: "$objectOnly",
  children: [
    {
      $el: 'legend', children: 'Audience', attrs: {
        'class': 'text-lg font-semibold mb-2 dark:text-gray-200 px-2',
      }
    },
    ...audienceNodes,
    // {
    //   $formkit: "textarea",
    //   name: "to",
    //   label: "To",
    //   rows: 2,
    //   help: "One IRI per line",
    //   postprocess: [
    //     {
    //       type: 'split',
    //       delimiter: 'newline',
    //       trim: true,
    //       removeEmpty: true,
    //       single: 'scalar',
    //       empty: 'array',
    //     },
    //   ],
    // },
    // {
    //   $formkit: "textarea",
    //   name: "cc",
    //   label: "CC",
    //   rows: 2,
    //   help: "One IRI per line",
    //   postprocess: [
    //     {
    //       type: 'split',
    //       delimiter: 'newline',
    //       trim: true,
    //       removeEmpty: true,
    //       single: 'scalar',
    //       empty: 'array',
    //     },
    //   ],
    // },
  ],
}]

const textDocumentNodes: EditorSchemaNode[] = [
  {
    $formkit: "select",
    name: "type",
    label: "Document type",
    validation: "required",
    options: [
      { label: "Note", value: "Note" },
      { label: "Article", value: "Article" },
      { label: "Page", value: "Page" },
    ],
  },
  // {
  //   $formkit: "textarea",
  //   name: "content",
  //   label: "Content",
  //   rows: 10,
  //   validation: "required",
  //   help: "AS2 content may be plain text or HTML depending on mediaType.",
  // },
  // {
  //   $formkit: "text",
  //   name: "inReplyTo",
  //   label: "In reply to",
  //   help: "IRI of parent object.",
  // },
];

const mediaNodes: EditorSchemaNode[] = [
  // {
  //   $formkit: "select",
  //   name: "type",
  //   label: "Media type",
  //   validation: "required",
  //   options: [
  //     { label: "Image", value: "Image" },
  //     { label: "Video", value: "Video" },
  //     { label: "Audio", value: "Audio" },
  //   ],
  // },
  // {
  //   $formkit: "file",
  //   name: "file",
  //   label: "Upload file",
  //   validation: "required",
  //   help: "Binary upload handled by your app; map stored URL back into url.",
  // },
  {
    $formkit: "text",
    name: "mediaType",
    label: "Media Type",
    help: "Mime type of the media object, e.g. image/png, video/mp4, audio/mpeg.",
  },
  {
    $formkit: "text",
    name: "url",
    label: "Resource URL",
    help: "Public or internal URL of uploaded media object.",
  },
  {
    $formkit: "number",
    name: "width",
    label: "Width",
    //if: "$get(type).value === 'Image' || $get(type).value === 'Video'",
  },
  {
    $formkit: "number",
    name: "height",
    label: "Height",
    //if: "$get(type).value === 'Image' || $get(type).value === 'Video'",
  },
  {
    $formkit: "text",
    name: "duration",
    label: "Duration",
    help: "AS2 duration value, for example PT3M12S.",
    //if: "$get(type).value === 'Video' || $get(type).value === 'Audio'",
  },
];

const eventNodes: EditorSchemaNode[] = [
  ...conditionalObjectAudience,
  {
    $formkit: "hidden",
    name: "type",
    value: "Event",
  },
  {
    $formkit: "text",
    name: "name",
    label: "Name",
    validation: "required",
  },
  {
    $formkit: "textarea",
    name: "content",
    label: "Description",
    rows: 6,
  },
  {
    $formkit: "datetime-local",
    name: "startTime",
    label: "Start time",
  },
  {
    $formkit: "datetime-local",
    name: "endTime",
    label: "End time",
  },
  {
    $formkit: "number",
    name: "latitude",
    label: "Latitude",
    number: "float",
    validate: "number|between:-90,90",
  },
  {
    $formkit: "number",
    name: "longitude",
    label: "Longitude",
    number: "float",
    validate: "number|between:-180,180",
  },
];

const placeNodes: EditorSchemaNode[] = [
  {
    $formkit: "hidden",
    name: "type",
    value: "Place",
  },
  {
    $formkit: "text",
    name: "latitude",
    label: "Latitude",
    number: "float",
    min: -90,
    max: 90,
    step: "any",
    validation: "min:-90|max:90",
    help: "Decimal degrees, between -90 and 90.",
  },
  {
    $formkit: "text",
    name: "longitude",
    label: "Longitude",
    number: "float",
    min: -180,
    max: 180,
    step: "any",
    validation: "min:-180|max:180",
    help: "Decimal degrees, between -180 and 180.",
  },
  {
    $formkit: "number",
    name: "altitude",
    label: "Altitude",
    min: 0
  },
  {
    $formkit: "number",
    name: "radius",
    label: "Radius",
    min: 0
  },
  {
    $formkit: "text",
    name: "units",
    label: "Units",
    help: "cm, feet, inches, km, m, miles.",
  },
];

const relationshipNodes: EditorSchemaNode[] = [
  ...conditionalObjectAudience,
  {
    $formkit: "hidden",
    name: "type",
    value: "Relationship",
  },
  {
    $formkit: "text",
    name: "subject",
    label: "Subject",
    validation: "required",
    help: "IRI or embedded object reference.",
  },
  {
    $formkit: "text",
    name: "relationship",
    label: "Relationship",
    validation: "required",
    help: "Typically an AS2 relationship type or IRI such as IsFollowing.",
  },
  {
    $formkit: "text",
    name: "object",
    label: "Object",
    validation: "required",
    help: "IRI or embedded object reference.",
  },
  // {
  //   $formkit: "textarea",
  //   name: "summary",
  //   label: "Summary",
  //   rows: 3,
  // },
];

const linkNodes: EditorSchemaNode[] = [
  {
    $formkit: "hidden",
    name: "type",
    value: "Link",
  },
  {
    $formkit: "text",
    name: "href",
    label: "Href",
    validation: "required",
    help: "Target IRI of the AS2 Link.",
  },
  {
    $formkit: "text",
    name: "name",
    label: "Name",
  },
  {
    $formkit: "text",
    name: "mediaType",
    label: "Media type",
  },
  {
    $formkit: "text",
    name: "hreflang",
    label: "Href language",
  },
  {
    $formkit: "text",
    name: "rel",
    label: "Rel",
    help: "Single relation or app-specific multi-value mapping.",
  },
  {
    $formkit: "number",
    name: "height",
    label: "Height",
  },
  {
    $formkit: "number",
    name: "width",
    label: "Width",
  },
  {
    $formkit: "text",
    name: "preview",
    label: "Preview",
    help: "IRI or embedded preview object per your serializer.",
  },
];

export const ATTACHMENT_SCHEMAS: EditorSchema[] = [
  {
    name: "Image",
    nodes: [
      //...asObjectCommon.filter(f => !["type", "url", "mediaType"].includes(f.name)),
      {
        $formkit: "hidden",
        name: "type",
        value: "Image",
      },
      ...mediaNodes.filter(f => f.name && ["type", "mediaType", "url", "width", "height"].includes(f.name)),
      ...asObjectCommon.filter(f => f.name && ["name", "summary"].includes(f.name)),
    ],
  },
  {
    name: "Video",
    nodes: [
      {
        $formkit: "hidden",
        name: "type",
        value: "Video",
      },
      //...asObjectCommon.filter(f => !["type", "url", "mediaType"].includes(f.name)),
      ...mediaNodes.filter(f => f.name && ["type", "file", "url", "width", "height", "duration"].includes(f.name)),
    ],
  },
  {
    name: "Audio",
    nodes: [
      ...asObjectCommon.filter(f => f.name && !["type", "url", "mediaType"].includes(f.name)),
      ...mediaNodes.filter(f => f.name && ["type", "file", "url", "duration"].includes(f.name)),
    ],
  },
  {
    name: "Document",
    nodes: [
      ...mediaNodes,
    ],
  },
  {
    name: "Link",
    nodes: linkNodes,
  },
  {
    name: "Place",
    nodes: placeNodes,
  },
  {
    name: "Relationship",
    nodes: relationshipNodes,
  }
]

export const OBJECT_SCHEMAS: EditorSchema[] = [
  {
    name: "Text Document",
    nodes: [
      ...conditionalObjectAudience,
      ...textDocumentNodes,
      ...asObjectCommon.filter(f => f.name && ["name", "summary", "content", "tag", "published", "updated"].includes(f.name)),
    ],
  },
  {
    name: "Calendar Event",
    nodes: [
      //...asObjectCommon.filter(f => !["type", "name"].includes(f.name)),
      ...eventNodes,
      //...audienceNodes,
    ],
  },
  {
    name: "Place",
    nodes: [
      ...conditionalObjectAudience,
      ...asObjectCommon.filter(f => f.name && ["name", "summary", "url"].includes(f.name)),
      ...placeNodes,
    ],
  },
  {
    name: "Relationship",
    nodes: [
      ...conditionalObjectAudience,
      ...asObjectCommon.filter(f => f.name && ["summary"].includes(f.name)),
      ...relationshipNodes,
    ],
  },
  {
    name: "Link",
    nodes: linkNodes,
  },
];

// const activityTypeOptions = [
//   { label: "Create", value: "Create" },
//   { label: "Update", value: "Update" },
//   { label: "Delete", value: "Delete" },
//   { label: "Follow", value: "Follow" },
//   { label: "Like", value: "Like" },
//   { label: "Announce", value: "Announce" },
//   { label: "Accept", value: "Accept" },
//   { label: "Reject", value: "Reject" },
//   { label: "Add", value: "Add" },
//   { label: "Remove", value: "Remove" },
//   { label: "Undo", value: "Undo" },
//   { label: "Block", value: "Block" },
//   { label: "Flag", value: "Flag" },
//   { label: "Move", value: "Move" },
//   { label: "Offer", value: "Offer" },
//   { label: "Invite", value: "Invite" },
//   { label: "Join", value: "Join" },
//   { label: "Leave", value: "Leave" },
//   { label: "Read", value: "Read" },
//   { label: "View", value: "View" },
//   { label: "Listen", value: "Listen" },
//   { label: "Travel", value: "Travel" },
//   { label: "Arrive", value: "Arrive" },
// ]

const activityNodes: EditorSchemaNode[] = [
  {
    $formkit: "text",
    name: "type",
    label: "Type",
    value: "Create",
    validation: "required",
    help: "You may enter multiple/custom types as a comma-separated string",
    postprocess: [
      {
        type: 'split',
        delimiter: 'comma',
        trim: true,
        removeEmpty: true,
        single: 'scalar',
        empty: 'array',
      },
    ],
  },
  //  {
  //     $formkit: 'combobox',
  //     id: 'type',
  //     name: 'type',
  //     label: 'Type',
  //     validation: 'required',
  //     placeholder: 'Select or enter a type',
  //     clearable: true,
  //     options: activityTypeOptions,
  //     help: 'Choose a predefined type or enter comma-separated custom types.',
  //     'inner-class': 'transparent',
  //   },
  // {
  //   $formkit: "datalist",
  //   name: "typeHint",
  //   label: "Common activity types",
  //   help: "Optional picker for common values. Copy the chosen value into Activity type if useful.",
  //   options: activityTypeOptions,
  // },
  {
    $formkit: "text",
    name: "actor",
    label: "Actor",
    validation: "required",
    help: "IRI or embedded actor reference performing the activity.",
  },
  {
    $formkit: "text",
    name: "object",
    label: "Object",
    help: "Primary object of the activity; IRI or embedded object.",
  },
  {
    $formkit: "text",
    name: "target",
    label: "Target",
    help: "Indirect object or destination context, such as a collection or recipient context.",
  },
  {
    $formkit: "text",
    name: "result",
    label: "Result",
    help: "Resulting object, if your activity model uses one.",
  },
  {
    $formkit: "text",
    name: "origin",
    label: "Origin",
    help: "Source context, often useful for Add, Move, Remove, or Travel-like activities.",
  },
  {
    $formkit: "text",
    name: "instrument",
    label: "Instrument",
    help: "Tool or means used to complete the activity.",
  },
  {
    $formkit: "textarea",
    name: "content",
    label: "Content",
    rows: 4
  },
  {
    $formkit: "textarea",
    name: "tag",
    label: "Tags",
    rows: 3,
    help: "One tag/link/object per line or map in your serializer.",
    postprocess: [
      {
        type: 'split',
        delimiter: 'newline',
        trim: true,
        removeEmpty: true,
        single: 'scalar',
        empty: 'array',
      },
      {
        type: 'template',
        template: `[
          {{#each value}}
            {
              "type": "HashTag",
              "value": "{{this}}"
            }{{#unless @last}},{{/unless}}
          {{/each}}
        ]`,
      }
    ],
  },
]

export const ACTIVITY_SCHEMAS: EditorSchema[] = [
  {
    name: "Create",
    nodes: [
      ...audienceNodes,
      //...activityNodes.filter(f => ["summary", "content"].includes(f.name)),
      {
        "$formkit": "hidden",
        "name": "type",
        "value": "Create",
      }
    ],
  },
  {
    name: "Generic Activity",
    nodes: [
      ...audienceNodes,
      ...activityNodes,
      ...asObjectCommon.filter(f => f.name && !["type"].includes(f.name)),
      // {
      //   $el: 'fieldset',
      //   attrs: { 'class': 'border-2 border-gray-500 rounded-md px-4',  },
      //   children: [
      //     {
      //       $el: 'legend', children: 'Object', attrs: {
      //         'class': 'text-lg font-semibold mb-2 dark:text-gray-200 px-2',
      //       }
      //     },
      //     {
      //       $formkit: 'group',
      //       name: 'address',
      //       children: [

      //         { $formkit: 'text', name: 'street', label: 'Street' },
      //         { $formkit: 'text', name: 'city', label: 'City' },
      //       ],
      //     },
      //   ],
      // },
    ],
  },
]
