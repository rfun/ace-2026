import { useEffect, useRef, useState } from 'react';
import { photoErrorMessage } from '../../lib/image/messages';
import { preparePhoto } from '../../lib/image/prepare';

/**
 * The optional-photo half of a composer: pick, check/convert/resize, preview, alt text, errors.
 * Shared by the tip and "I made this" composers so both show identical messages.
 */
export function usePhotoPicker() {
  /** The photo after checking, HEIC conversion and resizing: what gets uploaded. */
  const [file, setFile] = useState<Blob | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [alt, setAlt] = useState('');
  const [photoError, setPhotoError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => () => {
    if (preview && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(preview);
  }, [preview]);

  async function pickFile(f: File | null) {
    setPhotoError('');
    if (!f) return;
    setFile(null);
    setPreview(null);
    setPreparing(true);
    try {
      const ready = await preparePhoto(f);
      if (!alive.current) return;
      setFile(ready);
      let url: string | null = null;
      try {
        if (typeof URL.createObjectURL === 'function') url = URL.createObjectURL(ready);
      } catch {
        url = null; // the preview is a nicety; never let it block attaching the photo
      }
      setPreview(url);
    } catch (err) {
      if (alive.current) setPhotoError(photoErrorMessage(err));
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      if (alive.current) setPreparing(false);
    }
  }

  function removePhoto() {
    setFile(null);
    setPreview(null);
    setAlt('');
    setPhotoError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  return { file, preparing, preview, alt, setAlt, photoError, setPhotoError, fileRef, pickFile, removePhoto };
}
