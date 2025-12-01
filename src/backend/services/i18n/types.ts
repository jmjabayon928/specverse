export type LangTag = 'fr-CA' | 'fr' | 'en' | 'de' | 'ru' | 'zh' | 'ar';


export interface TranslateRequest {
sourceLang: LangTag;
targets: LangTag[];
items: Array<{
entity: 'sheet' | 'subsheet' | 'infoTemplate';
id: number;
label: string;
value?: string;
}>;
}


export interface TranslationResult {
targetLang: LangTag;
items: Array<{
entity: 'sheet' | 'subsheet' | 'infoTemplate';
id: number;
labelTranslated: string;
valueTranslated?: string;
isMachineTranslated: boolean;
}>;
}


export interface TranslationProvider {
translateBulk(input: { sourceLang: LangTag; targetLang: LangTag; texts: string[] }): Promise<string[]>;
}