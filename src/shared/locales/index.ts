import { en } from './en.js';
import { id } from './id.js';

const dictionaries = { id, en };
export type Language = keyof typeof dictionaries;

function isValidLanguage(lang: string | undefined | null): lang is Language {
  return typeof lang === 'string' && lang in dictionaries;
}
/**
 * Function to retrieve text based on language and key path.
 * Supports variable injection (e.g. replacing {time} with a number).
 */
export function t<Category extends keyof typeof id, Key extends keyof (typeof id)[Category]>(
  lang: Language | string,
  category: Category,
  key: Key,
  args?: Record<string, string | number>,
): string {
  // Get the dictionary according to the language, fallback to 'id' if not found
  const dict = isValidLanguage(lang) ? dictionaries[lang] : dictionaries.id;
  let text = dict[category][key] as string;

  // Automatically replace variables like {time}
  if (args) {
    for (const [k, v] of Object.entries(args)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return text;
}
