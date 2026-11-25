/** One message set for every place a photo can be picked (recipe photo, step photos, tip photo, import photo). */

/** Shown under every photo control, before anything goes wrong. */
export const PHOTO_HINT = 'JPG, PNG, WebP or HEIC · up to 20 MB';
/** Shown while the photo is being converted or resized. */
export const PHOTO_PREPARING = 'Preparing photo…';
/** The picker filter: every image, plus the HEIC extensions some systems do not map to an image type. */
export const PHOTO_ACCEPT = 'image/*,.heic,.heif';

export const PHOTO_MESSAGES = {
  tooLarge: 'That photo is over 20 MB. Choose a smaller one.',
  unsupported: "That file type isn't supported. Use a JPG, PNG, WebP or HEIC photo.",
  heic: "We couldn't convert that iPhone photo. Share it as a JPG (or set iPhone Camera > Formats > Most Compatible) and try again.",
  unreadable: "We couldn't read that photo. Try another one, or save it as a JPG first.",
  permission: "You don't have permission to add photos here. Ask an organiser for access.",
  upload: "The photo didn't upload. Check your connection and try again.",
} as const;

/**
 * The single place an error from picking, preparing or uploading a photo becomes words.
 * Matches on the error name so it also works when an error crossed a module boundary.
 */
export function photoErrorMessage(err: unknown): string {
  switch (err instanceof Error ? err.name : '') {
    case 'ImageTooLargeError': return PHOTO_MESSAGES.tooLarge;
    case 'UnsupportedImageError': return PHOTO_MESSAGES.unsupported;
    case 'HeicConversionError': return PHOTO_MESSAGES.heic;
    case 'UnreadableImageError': return PHOTO_MESSAGES.unreadable;
    case 'PhotoPermissionError': return PHOTO_MESSAGES.permission;
    default: return PHOTO_MESSAGES.upload;
  }
}
