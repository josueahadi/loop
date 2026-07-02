// Tiny classname joiner — avoids pulling in a dependency for one helper.
export function clsx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(' ');
}
