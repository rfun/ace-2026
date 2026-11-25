import { useState } from 'react';
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from 'react';
import { addTags, TAG_HINT } from './tagInput';

/**
 * Free-form keywords as removable chips. Enter or a comma adds what is typed, Backspace in an empty box
 * removes the last chip, pasting "noodles, soup" adds both. Whatever is still typed when the box loses focus is added too.
 */
export default function TagsField(props: { tags: string[]; onChange: (tags: string[]) => void }): JSX.Element {
  const { tags, onChange } = props;
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();

  const commit = (raw: string) => {
    const r = addTags(tags, raw);
    if (r.tags.length !== tags.length) onChange(r.tags);
    setText(r.leftover);
    setError(r.error);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault(); // Enter must not submit the whole recipe form
      commit(text);
    } else if (e.key === 'Backspace' && text === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
      setError(undefined);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!/[,\n\r]/.test(pasted)) return; // a single word pastes like normal text
    e.preventDefault();
    commit(`${text},${pasted}`);
  };

  // A comma typed on a phone keyboard may not send a "," key event, so it is also caught here.
  const onChangeText = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v.includes(',')) {
      commit(v);
    } else {
      setText(v);
      setError(undefined);
    }
  };

  return (
    <div className="cp-field cp-tags">
      <label className="label" htmlFor="f-tags">Keywords</label>
      {tags.length > 0 && (
        <ul className="cp-tagchips" aria-label="Keywords added">
          {tags.map((t) => (
            <li key={t} className="cp-tagchip">
              <span>{t}</span>
              <button
                type="button"
                className="cp-tagx"
                aria-label={`Remove keyword ${t}`}
                onClick={() => {
                  onChange(tags.filter((x) => x !== t));
                  setError(undefined);
                }}
              >
                <span aria-hidden="true">{'×'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id="f-tags"
        className="cp-input"
        type="text"
        value={text}
        autoComplete="off"
        enterKeyHint="done"
        aria-describedby={error ? 'f-tags-hint f-tags-err' : 'f-tags-hint'}
        aria-invalid={error ? true : undefined}
        onChange={onChangeText}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => {
          if (text.trim() !== '') commit(text);
        }}
      />
      <p className="cp-hint" id="f-tags-hint">{TAG_HINT}</p>
      {error && <p className="cp-err" id="f-tags-err" role="alert">{error}</p>}
    </div>
  );
}
