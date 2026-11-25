/** Typed failures of the photo pipeline and the upload. Each maps to one message in messages.ts. */

export class UnsupportedImageError extends Error {
  constructor(message = 'unsupported-image-type') {
    super(message);
    this.name = 'UnsupportedImageError';
  }
}

/** A non-HEIC file the browser could not decode. */
export class UnreadableImageError extends Error {
  constructor(message = 'unreadable-image') {
    super(message);
    this.name = 'UnreadableImageError';
  }
}

/** A HEIC/HEIF file that could not be converted (converter failed to load, or failed to convert). */
export class HeicConversionError extends Error {
  constructor(message = 'heic-conversion-failed') {
    super(message);
    this.name = 'HeicConversionError';
  }
}

/** The viewer is not allowed to add photos (no assets capability, or the runtime refused: not_granted). */
export class PhotoPermissionError extends Error {
  constructor(message = 'uploads-unavailable') {
    super(message);
    this.name = 'PhotoPermissionError';
  }
}

/** The upload itself failed (network, rate limit, server). Retrying may work. */
export class PhotoUploadError extends Error {
  /** The runtime's own error, for logs. */
  readonly detail: unknown;
  constructor(message = 'upload-failed', detail?: unknown) {
    super(message);
    this.name = 'PhotoUploadError';
    this.detail = detail;
  }
}
