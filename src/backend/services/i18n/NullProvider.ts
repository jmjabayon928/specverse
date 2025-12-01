import { TranslationProvider, LangTag } from './types';


export class NullProvider implements TranslationProvider {
async translateBulk(input: { sourceLang: LangTag; targetLang: LangTag; texts: string[] }): Promise<string[]> {
// Day-1: return input as-is. Swap with DeepL/Google later.
return input.texts;
}
}