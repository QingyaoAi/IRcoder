declare global {
  const IRCODER_VERSION: string
  const IRCODER_CHANNEL: string
}

export const InstallationVersion = typeof IRCODER_VERSION === "string" ? IRCODER_VERSION : "local"
export const InstallationChannel = typeof IRCODER_CHANNEL === "string" ? IRCODER_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
