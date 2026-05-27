export * as ConfigAttachment from "./attachment"

import { Schema } from "effect"
import { PositiveInt } from "@ircoder/core/schema"

export const Image = Schema.Struct({
  auto_resize: Schema.optional(Schema.Boolean).annotate({
    description: "Resize images before sending them to the model when they exceed configured limits (default: true)",
  }),
  max_width: Schema.optional(PositiveInt).annotate({
    description: "Maximum image width before resizing or rejecting the attachment (default: 2000)",
  }),
  max_height: Schema.optional(PositiveInt).annotate({
    description: "Maximum image height before resizing or rejecting the attachment (default: 2000)",
  }),
  max_base64_bytes: Schema.optional(PositiveInt).annotate({
    description: "Maximum base64 payload bytes for an image attachment (default: 5242880)",
  }),
}).annotate({ identifier: "ImageAttachmentConfig" })
export type Image = Schema.Schema.Type<typeof Image>

export const Pdf = Schema.Struct({
  max_bytes: Schema.optional(PositiveInt).annotate({
    description:
      "Maximum raw file size in bytes for a PDF attachment before it is rejected (default: 1048576 = 1 MB). Reduce this when a proxy enforces a request-body size limit.",
  }),
}).annotate({ identifier: "PdfAttachmentConfig" })
export type Pdf = Schema.Schema.Type<typeof Pdf>

export const Info = Schema.Struct({
  image: Schema.optional(Image).annotate({ description: "Image attachment configuration" }),
  pdf: Schema.optional(Pdf).annotate({ description: "PDF attachment configuration" }),
}).annotate({ identifier: "AttachmentConfig" })
export type Info = Schema.Schema.Type<typeof Info>
