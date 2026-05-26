import { SECRET } from "./secret"
import { shortDomain } from "./stage"

const storage = new sst.cloudflare.Bucket("EnterpriseStorage")

new sst.cloudflare.x.SolidStart("Teams", {
  domain: shortDomain,
  path: "packages/enterprise",
  buildCommand: "bun run build:cloudflare",
  environment: {
    IRCODER_STORAGE_ADAPTER: "r2",
    IRCODER_STORAGE_ACCOUNT_ID: sst.cloudflare.DEFAULT_ACCOUNT_ID,
    IRCODER_STORAGE_ACCESS_KEY_ID: SECRET.R2AccessKey.value,
    IRCODER_STORAGE_SECRET_ACCESS_KEY: SECRET.R2SecretKey.value,
    IRCODER_STORAGE_BUCKET: storage.name,
  },
})
