const HOURS = /(\d+(?:[.,]\d+)?)\s*(?:hours?|hrs?|h)(?![a-z])/gi;
const MINUTES = /(\d+(?:[.,]\d+)?)\s*(?:minutes?|mins?|m)(?![a-z])/gi;

/** "1 hr 15 mins", "45 minutes", "1h30m" -> minutes. Undefined if the whole text is not a duration. */
export function durationToMinutes(s: string): number | undefined {
  const t = s.toLowerCase();
  let total = 0;
  let found = false;
  for (const m of t.matchAll(HOURS)) {
    total += Number(m[1].replace(',', '.')) * 60;
    found = true;
  }
  for (const m of t.matchAll(MINUTES)) {
    total += Number(m[1].replace(',', '.'));
    found = true;
  }
  if (!found) return undefined;
  const rest = t.replace(HOURS, '').replace(MINUTES, '').replace(/\b(?:and|approx\.?|about)\b|[&,~\s]/g, '');
  if (rest !== '') return undefined;
  const mins = Math.round(total);
  return mins > 0 ? mins : undefined;
}

/** ISO-8601 duration such as PT1H15M or P0DT45M -> minutes. */
export function isoDurationToMinutes(s: string): number | undefined {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/i.exec(s.trim());
  if (!m) return undefined;
  const mins = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return mins > 0 ? mins : undefined;
}
