import { MAX_SERVINGS, MIN_SERVINGS } from '../../lib/scale';

/** "Serves N" with fewer / more buttons and a Reset. Shared by the recipe card and kitchen mode. */
export default function ServingsControl(props: {
  servings: number;
  changed: boolean;
  onChange: (n: number) => void;
  onReset: () => void;
}): JSX.Element {
  const { servings } = props;
  const atMin = servings <= MIN_SERVINGS;
  const atMax = servings >= MAX_SERVINGS;
  return (
    <div className="sv-ctl" role="group" aria-label="Servings">
      <span className="sv-now" aria-live="polite" aria-atomic="true">
        <span className="label sv-label">Serves</span> <span className="sv-n">{servings}</span>
      </span>
      <button
        type="button"
        className="btn sv-btn"
        aria-label="Fewer servings"
        aria-disabled={atMin ? true : undefined}
        onClick={() => !atMin && props.onChange(servings - 1)}
      >
        <span aria-hidden="true">{'−'}</span>
      </button>
      <button
        type="button"
        className="btn sv-btn"
        aria-label="More servings"
        aria-disabled={atMax ? true : undefined}
        onClick={() => !atMax && props.onChange(servings + 1)}
      >
        <span aria-hidden="true">+</span>
      </button>
      {props.changed && (
        <button type="button" className="quiet sv-reset" onClick={props.onReset}>
          Reset
        </button>
      )}
    </div>
  );
}
