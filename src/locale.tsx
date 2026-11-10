import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { english, simplifiedChinese } from './translations';

type Language = 'en' | 'zh-CN';
type MessageValues = Record<string, string | number>;
const storageKey = 'star-sms-language';

function translate(language: Language, message: string, values?: MessageValues): string {
  const dictionary = language === 'zh-CN' ? simplifiedChinese : english;
  const key = message.toLowerCase();
  let text = Object.hasOwn(dictionary, key) ? dictionary[key] : message;
  if (language === 'zh-CN' && text === message) {
    if (message.startsWith('Invalid ') && !message.endsWith('.')) return translate(language, message.slice(8)) + '无效。';
    if (message.endsWith(' is required.')) return translate(language, message.slice(0, -13)) + '为必填项。';
  }
  if (values) text = text.replace(/\{(\w+)\}/g, (token, name) => Object.hasOwn(values, name) ? String(values[name]) : token);
  return text;
}

const LocaleContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: (message: string, values?: MessageValues) => string;
} | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try { return localStorage.getItem(storageKey) === 'zh-CN' ? 'zh-CN' : 'en'; }
    catch { return 'en'; }
  });

  useEffect(() => {
    document.documentElement.lang = language;
    const role = document.getElementById('app')?.dataset.role;
    document.title = translate(language, role === 'admin' ? 'Star SMS · Admin' : 'Star SMS · Client');
    try { localStorage.setItem(storageKey, language); } catch { /* The current page can still switch. */ }
  }, [language]);

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key === storageKey) setLanguage(event.newValue === 'zh-CN' ? 'zh-CN' : 'en');
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  return <LocaleContext.Provider value={{ language, setLanguage, t: (message, values) => translate(language, message, values) }}>
    {children}
  </LocaleContext.Provider>;
}

export function useLocale() {
  const locale = useContext(LocaleContext);
  if (!locale) throw new Error('LocaleProvider is required.');
  return locale;
}

export function LanguageSwitch() {
  const { language, setLanguage, t } = useLocale();
  return <div className="language-switch" role="group" aria-label={t('Language')}>
    <button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
    <button type="button" lang="zh-CN" aria-pressed={language === 'zh-CN'} onClick={() => setLanguage('zh-CN')}>简体中文</button>
  </div>;
}
