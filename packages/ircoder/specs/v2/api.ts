// @ts-nocheck

import { IRcoder } from "@ircoder/core"
import { ReadTool } from "@ircoder/core/tools"

const ircoder = IRcoder.make({})

ircoder.tool.add(ReadTool)

ircoder.tool.add({
  name: "bash",
  schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The command to run.",
      },
    },
    required: ["command"],
  },
  execute(input, ctx) {},
})

ircoder.auth.add({
  provider: "openai",
  type: "api",
  value: process.env.OPENAI_API_KEY,
})

ircoder.agent.add({
  name: "build",
  permissions: [],
  model: {
    id: "gpt-5-5",
    provider: "openai",
    variant: "xhigh",
  },
})

const sessionID = await ircoder.session.create({
  agent: "build",
})

ircoder.subscribe((event) => {
  console.log(event)
})

await ircoder.session.prompt({
  sessionID,
  text: "hey what is up",
})

await ircoder.session.prompt({
  sessionID,
  text: "what is up with this",
  files: [
    {
      mime: "image/png",
      uri: "data:image/png;base64,xxxx",
    },
  ],
})

await ircoder.session.wait()

console.log(await ircoder.session.messages(sessionID))
