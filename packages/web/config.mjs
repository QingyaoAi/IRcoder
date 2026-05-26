const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://ircoder.ai" : `https://${stage}.ircoder.ai`,
  console: stage === "production" ? "https://ircoder.ai/auth" : `https://${stage}.ircoder.ai/auth`,
  email: "contact@anoma.ly",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/anomalyco/ircoder",
  discord: "https://ircoder.ai/discord",
  headerLinks: [
    { name: "app.header.home", url: "/" },
    { name: "app.header.docs", url: "/docs/" },
  ],
}
