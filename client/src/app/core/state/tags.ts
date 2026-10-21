/** The most tags a saved calculation holds, and the longest one: the API's limits (SaveCalculationRequestValidator). */
export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 24;

/** Tags typed separated by commas: trimmed, without blanks, and without repeats (in any case); the first spelling stays. */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (tag === '' || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Tags as they are typed into a box: separated by a comma and a space. */
export const tagsText = (tags: readonly string[] | null | undefined): string => (tags ?? []).join(', ');
