import { describe, expect, it } from 'vitest';
import {
  HeicConversionError,
  PhotoPermissionError,
  PhotoUploadError,
  UnreadableImageError,
  UnsupportedImageError,
} from './errors';
import { PHOTO_ACCEPT, PHOTO_HINT, PHOTO_PREPARING, photoErrorMessage } from './messages';
import { ImageTooLargeError } from './resize';

describe('photoErrorMessage', () => {
  it.each([
    [new ImageTooLargeError(), 'That photo is over 20 MB. Choose a smaller one.'],
    [new UnsupportedImageError(), "That file type isn't supported. Use a JPG, PNG, WebP or HEIC photo."],
    [
      new HeicConversionError(),
      "We couldn't convert that iPhone photo. Share it as a JPG (or set iPhone Camera > Formats > Most Compatible) and try again.",
    ],
    [new PhotoPermissionError(), "You don't have permission to add photos here. Ask an organiser for access."],
    [new PhotoUploadError(), "The photo didn't upload. Check your connection and try again."],
    [new UnreadableImageError(), "We couldn't read that photo. Try another one, or save it as a JPG first."],
  ])('maps %o to its own sentence (catches two causes sharing one vague message)', (err, text) => {
    expect(photoErrorMessage(err)).toBe(text);
  });

  it('treats an unknown error as an upload failure, never showing its text (catches leaking codes like not_granted)', () => {
    expect(photoErrorMessage(new Error('not_granted'))).toBe("The photo didn't upload. Check your connection and try again.");
    expect(photoErrorMessage('boom')).toBe("The photo didn't upload. Check your connection and try again.");
  });

  it('the hint, busy text and picker filter are the specified ones', () => {
    expect(PHOTO_HINT).toBe('JPG, PNG, WebP or HEIC · up to 20\u00a0MB');
    expect(PHOTO_PREPARING).toBe('Preparing photo…');
    expect(PHOTO_ACCEPT).toContain('.heic');
    expect(PHOTO_ACCEPT).toContain('.heif');
  });
});
