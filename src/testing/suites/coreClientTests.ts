import type {
  TestAssertion,
  TestCaseDefinition,
  TestSuiteDefinition,
} from "@/testing/core/types"
import { resolveHandle } from "@/services/webfingerService"
import {
  collectionIsEmpty,
  getCollectionItemUris,
} from "@/testing/core/assertions"


const ACTOR_ASSERTIONS: TestAssertion[] = [
  {
    kind: "status",
    label: "HTTP status is 200",
    expectedStatus: 200,
  },
  {
    kind: "activityPubObjectShape",
    label: "Response looks like ActivityPub actor",
  },
  {
    kind: "jsonPathExists",
    label: "Actor has inbox",
    jsonPath: "inbox",
  },
  {
    kind: "jsonPathExists",
    label: "Actor has outbox",
    jsonPath: "outbox",
  },
]

const COLLECTION_ASSERTIONS: TestAssertion[] = [
  {
    kind: "status",
    label: "HTTP status is 200",
    expectedStatus: 200,
  },
  {
    kind: "jsonPathExists",
    label: "Collection type is present",
    jsonPath: "type",
  },
]

const DEREFERENCE_ASSERTIONS: TestAssertion[] = [
  {
    kind: "status",
    label: "HTTP status is 200",
    expectedStatus: 200,
  },
  {
    kind: "activityPubObjectShape",
    label: "Payload looks like ActivityPub object",
  },
]

function createTestObject(actorUri: string): Record<string, unknown> {
  const now = new Date().toISOString()
  return {
    type: "Note",
    attributedTo: actorUri,
    to: ["https://www.w3.org/ns/activitystreams#Public"],
    //cc: ["https://example.com/users/alice/followers"],
    published: now,
    content: `<p>Test object: ${now}</p>`,
  };
}

function createTestActivity(actorUri: string/*, serverOrigin: string*/): Record<string, unknown> {
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    //id: `${serverOrigin}/activities/create-note-1`,
    type: "Create",
    actor: actorUri,
    to: ["https://www.w3.org/ns/activitystreams#Public"],
    //cc: ["https://example.com/users/alice/followers"],
    object: createTestObject(actorUri),
  };
}



type NodeInfoIndex = {
  links: {
    rel: string
    href: string
  }[]
}

const tests: TestCaseDefinition[] = [
  {
    id: "webfinger",
    name: "Verify WebFinger handle resolution",
    description:
      "Verify that the actor handle resolves to the authenticated actor URI.",
    run: async (context, tools) => {
      const handle = context.parameters.handle?.trim()
      if (!handle) {
        return tools.fail("Handle is required for WebFinger verification")
      }

      const authenticatedActorUri = context.parameters.authenticatedActorUri
      if (!authenticatedActorUri) {
        return tools.fail(
          "Authenticated actor URI is required for WebFinger verification",
        )
      }

      const resolvedActorUri = await resolveHandle(handle)
      if (!resolvedActorUri) {
        return tools.fail(`WebFinger could not resolve actor URI for ${handle}`)
      }

      if (resolvedActorUri !== authenticatedActorUri) {
        return tools.fail(
          `WebFinger resolved ${resolvedActorUri}, expected ${authenticatedActorUri}`,
        )
      }

      return {
        status: "pass",
        reason: `WebFinger resolved actor URI correctly for ${handle}`,
        assertions: [],
        contextUpdates: { resolvedActorUri },
      }
    },
  },
  {
    id: "nodeinfo",
    name: "Verify NodeInfo endpoint",
    description:
      "Verify that the NodeInfo endpoint is accessible and returns valid data.",
    run: async (context, tools) => {
      const indexUrl = context.parameters.serverOrigin + '/.well-known/nodeinfo'

      console.debug(`Fetching NodeInfo from ${indexUrl}`)

      const indexOutcome = await tools.executeRequest(
        { url: indexUrl },
        [
          {
            kind: "status",
            label: "HTTP status is 200",
            expectedStatus: 200,
          }
        ],
      )

      if (indexOutcome.status !== "pass") {
        return indexOutcome;
      }

      // TODO check JRD against JSON Schema

      const indexDoc = await indexOutcome.exchange?.response?.payload as NodeInfoIndex
      console.log(`NodeInfo index response`, indexDoc)

      const metadataUrl = indexDoc.links?.find((link: { rel: string; href: string }) => link.rel.startsWith('http://nodeinfo.diaspora.software/ns/schema/'))?.href

      if (!metadataUrl) {
        return tools.fail("NodeInfo index does not contain a valid metadata link")
      }

      // TODO check metadata against JSON Schema
      const requiredPropertyAssertions: TestAssertion[] = [
        "version",
        "software",
        "protocols",
        "services",
        "openRegistrations",
        "usage",
        "metadata",
      ].map(
        (path) =>
          ({
            kind: "jsonPathExists",
            label: `NodeInfo path '${path}' exists`,
            jsonPath: path,
          }),
      );

      const outcome = await tools.executeRequest(
        { url: metadataUrl },
        [
          {
            kind: "status",
            label: "HTTP status is 200",
            expectedStatus: 200,
          },
          ...requiredPropertyAssertions
        ],
      )

      console.log(`NodeInfo request outcome`, outcome)

      if (!outcome.exchange?.response?.payload || outcome.status !== "pass") {
        return outcome
      }

      return {
        ...outcome,
        contextUpdates: { nodeInfoData: outcome.exchange?.response?.payload },
      }
    },
  },
  {
    id: "actor-document",
    name: "Retrieve actor document",
    description: "Fetch actor JSON and extract inbox/outbox links.",
    run: async (context, tools) => {
      const actorUri = context.parameters.authenticatedActorUri
      if (!actorUri) {
        return tools.fail("authenticatedActorUri parameter is required")
      }

      const outcome = await tools.executeRequest(
        {
          url: actorUri,
        },
        ACTOR_ASSERTIONS,
      )

      if (!outcome.exchange?.response?.payload || outcome.status !== "pass") {
        return outcome
      }

      const payload = outcome.exchange?.response?.payload as Record<string, unknown>
      const inboxUri =
        typeof payload.inbox === "string" ? payload.inbox : undefined
      const outboxUri =
        typeof payload.outbox === "string" ? payload.outbox : undefined

      return {
        ...outcome,
        contextUpdates: {
          actorDocument: payload,
          inboxUri,
          outboxUri,
        },
      }
    },
  },
  {
    id: "inbox-collection",
    name: "Retrieve inbox collection",
    description: "Fetch inbox collection payload and keep it in context.",
    dependsOn: ["actor-document"],
    run: async (context, tools) => {
      const inboxUri = context.getShared<string>("inboxUri")
      if (!inboxUri) {
        return tools.inconclusive("Actor did not expose inbox URI")
      }

      const outcome = await tools.executeRequest(
        { url: inboxUri },
        COLLECTION_ASSERTIONS,
      )
      if (!outcome.exchange?.response?.payload || outcome.status !== "pass") {
        return outcome
      }

      return {
        ...outcome,
        contextUpdates: {
          inboxCollection: outcome.exchange?.response?.payload,
        },
      }
    },
  },
  {
    id: "inbox-item-deref",
    name: "Dereference inbox item URI",
    description: "Fetch one inbox item from collection items or first page.",
    dependsOn: ["inbox-collection"],
    run: async (context, tools) => {
      const inboxCollection = context.getShared<unknown>("inboxCollection")
      if (!inboxCollection) {
        return tools.inconclusive("Inbox collection payload is unavailable")
      }

      const fetcher = async (url: string): Promise<unknown> => {
        const outcome = await tools.executeRequest(
          { url },
          COLLECTION_ASSERTIONS,
        )
        return outcome.exchange?.response?.payload
      }

      const [inboxItemUri] = await getCollectionItemUris(
        inboxCollection,
        fetcher,
      )
      if (!inboxItemUri) {
        return tools.inconclusive(
          collectionIsEmpty(inboxCollection)
            ? "Inbox collection is empty"
            : "Could not find a dereferenceable inbox item URI",
        )
      }

      const derefOutcome = await tools.executeRequest(
        { url: inboxItemUri },
        DEREFERENCE_ASSERTIONS,
      )
      return {
        ...derefOutcome,
        contextUpdates: { inboxItemUri },
      }
    },
  },
  {
    id: "outbox-collection",
    name: "Retrieve outbox collection",
    description: "Fetch outbox collection payload and keep it in context.",
    dependsOn: ["actor-document"],
    run: async (context, tools) => {
      const outboxUri = context.getShared<string>("outboxUri")
      if (!outboxUri) {
        return tools.inconclusive("Actor did not expose outbox URI")
      }

      const outcome = await tools.executeRequest(
        { url: outboxUri },
        COLLECTION_ASSERTIONS,
      )
      if (!outcome.exchange?.response?.payload || outcome.status !== "pass") {
        return outcome
      }

      return {
        ...outcome,
        contextUpdates: {
          outboxCollection: outcome.exchange?.response?.payload,
        },
      }
    },
  },
  {
    id: "outbox-item-deref",
    name: "Dereference outbox item URI",
    description: "Fetch one outbox item from collection items or first page.",
    dependsOn: ["outbox-collection"],
    run: async (context, tools) => {
      const outboxCollection = context.getShared<unknown>("outboxCollection")
      if (!outboxCollection) {
        return tools.inconclusive("Outbox collection payload is unavailable")
      }

      const fetcher = async (url: string): Promise<unknown> => {
        const outcome = await tools.executeRequest(
          { url },
          COLLECTION_ASSERTIONS,
        )
        return outcome.exchange?.response?.payload
      }

      const [outboxItemUri] = await getCollectionItemUris(
        outboxCollection,
        fetcher,
      )
      if (!outboxItemUri) {
        return tools.inconclusive(
          collectionIsEmpty(outboxCollection)
            ? "Outbox collection is empty"
            : "Could not find a dereferenceable outbox item URI",
        )
      }

      const derefOutcome = await tools.executeRequest(
        { url: outboxItemUri },
        DEREFERENCE_ASSERTIONS,
      )
      return {
        ...derefOutcome,
        contextUpdates: { outboxItemUri },
      }
    },
  },
  {
    id: "outbox-post-activity",
    name: "Post activity to outbox",
    description: "Post an activity to the outbox.",
    dependsOn: ["outbox-collection"],
    run: async (context, tools) => {
      const outboxUri = context.getShared<string>("outboxUri")
      if (!outboxUri) {
        return Promise.resolve(tools.inconclusive("Actor did not expose outbox URI"))
      }

      const bearerToken = context.parameters.bearerToken
      if (!bearerToken) {
        return Promise.resolve(tools.inconclusive("Bearer token is required for posting to outbox"))
      }

      const actorUri = context.parameters.authenticatedActorUri
      if (!actorUri) {
        return tools.inconclusive(
          "Authenticated actor URI is required for creating activity",
        )
      }

      const activity = createTestActivity(actorUri)

      const outcome = await tools.executeRequest(
        {
          url: outboxUri,
          method: "POST",
          headers: {
            "Content-Type": "application/activity+json",
          },
          body: JSON.stringify(activity),
        },
        [
          {
            kind: "status",
            label: "HTTP status is 201 Created",
            expectedStatus: 201,
          },
        ],
      )

      const postedActivityUri = outcome.exchange?.response?.headers?.location
      if (!postedActivityUri) {
        outcome.status = "fail"
        outcome.reason = "Outbox response did not include Location header for posted activity"
        outcome.assertions.push({
          assertion: {
          kind: "headerMatch",
          label: "Response includes Location header with posted activity URI",
          headerName: "Location",
          },
          passed: false,
          message: "Response did not include 'Location' header"
        })
        return outcome
      }

      if (!outcome.exchange?.response?.payload || outcome.status !== "pass") {
        return outcome
      }

      return {
        ...outcome,
        contextUpdates: {
          postedActivityUri: postedActivityUri,
        },
      }

      // TODO Verify that the posted activity can be dereferenced
    },
  },
  {
    id: "outbox-post-object",
    name: "Post object to outbox",
    description: "Post an object to the outbox.",
    dependsOn: ["outbox-collection"],
    run: async (context, tools) => {
      const outboxUri = context.getShared<string>("outboxUri")
      if (!outboxUri) {
        return Promise.resolve(tools.inconclusive("Actor did not expose outbox URI"))
      }

      const bearerToken = context.parameters.bearerToken
      if (!bearerToken) {
        return Promise.resolve(tools.inconclusive("Bearer token is required for posting to outbox"))
      }

      const actorUri = context.parameters.authenticatedActorUri
      if (!actorUri) {
        return tools.inconclusive(
          "Authenticated actor URI is required for creating object",
        )
      }

      const as2Object = createTestObject(actorUri)

      const outcome = await tools.executeRequest(
        {
          url: outboxUri,
          method: "POST",
          headers: {
            "Content-Type": "application/activity+json",
          },
          body: JSON.stringify(as2Object),
        },
        [
          {
            kind: "status",
            label: "HTTP status is 201 Created",
            expectedStatus: 201,
          },
        ],
      )

      const postedObjectUri = outcome.exchange?.response?.headers?.location
      if (!postedObjectUri) {
        outcome.status = "fail"
        outcome.reason = "Outbox response did not include Location header for posted object"
        outcome.assertions.push({
          assertion: {
          kind: "headerMatch",
          label: "Response includes Location header with posted object URI",
          headerName: "Location",
          },
          passed: false,
          message: "Response did not include 'Location' header"
        })
        return outcome
      }

      if (!outcome.exchange?.response?.payload || outcome.status !== "pass") {
        return outcome
      }

      return {
        ...outcome,
        contextUpdates: {
          postedObjectUri: postedObjectUri,
        },
      }

      // TODO Verify that the created activity and posted object can be dereferenced
    },
  },
]

export const coreClientTests: TestSuiteDefinition = {
  id: "core-client-tests",
  name: "Core Server Tests",
  description:
    "Core/basic C2S test cases and related functionality like WebFinger and NodeInfo",
  tests,
}
