'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Language, translations, TranslationDict } from '@/lib/i18n/translations';

interface LanguageContextValue {
    lang: Language;
    setLang: (l: Language) => void;
    t: TranslationDict;
}

const LanguageContext = createContext<LanguageContextValue>({
    lang: 'en',
    setLang: () => {},
    t: translations.en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [lang, setLangState] = useState<Language>('en');

    useEffect(() => {
        const stored = localStorage.getItem('lang') as Language | null;
        if (stored === 'en' || stored === 'fr') {
            setLangState(stored);
        }
    }, []);

    useEffect(() => {
        document.documentElement.lang = lang;
    }, [lang]);

    function setLang(l: Language) {
        setLangState(l);
        localStorage.setItem('lang', l);
    }

    return (
        <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => useContext(LanguageContext);
