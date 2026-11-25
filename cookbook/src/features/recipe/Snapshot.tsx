import type { Photo } from '../../domain/types';

/** A taped snapshot. Size and tilt come from the class the screen passes in. */
export function Snapshot(props: { photo: Photo; className: string }): JSX.Element {
  return (
    <figure className={`snap ${props.className}`}>
      <img src={props.photo.url} alt={props.photo.alt} loading="lazy" />
    </figure>
  );
}
