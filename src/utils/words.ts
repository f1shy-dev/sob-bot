function isVowel(char: string): boolean {
  return /[aeiou]/.test(char);
}

function isConsonant(char: string): boolean {
  return /^[a-z]$/.test(char) && !isVowel(char);
}

function isShortOneSyllableWord(word: string): boolean {
  if (word.length < 3 || /[aeiou].*[aeiou]/.test(word)) return false;

  const first = word[word.length - 3];
  const middle = word[word.length - 2];
  const last = word[word.length - 1];

  return isConsonant(first) && isVowel(middle) && isConsonant(last) && !/[wxy]/.test(last);
}

export function pluralize(word: string): string {
  if (/(s|sh|ch|x|z)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

export function pastTense(word: string): string {
  if (word.endsWith("e")) return `${word}d`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ied`;
  if (isShortOneSyllableWord(word)) return `${word}${word[word.length - 1]}ed`;
  return `${word}ed`;
}

export function generateAliases(word: string): { leaderboard: string[]; mostReacted: string[] } {
  const normalized = word.trim().toLowerCase();
  if (!/^[a-z]{1,20}$/.test(normalized)) {
    throw new Error("Word must match [a-z]{1,20}.");
  }

  const plural = pluralize(normalized);
  const past = pastTense(normalized);

  return {
    leaderboard: [`${normalized}lb`, `${normalized}leaderboard`, plural],
    mostReacted: [`most${normalized}`, `most${past}`],
  };
}
