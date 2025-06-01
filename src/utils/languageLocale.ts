export function languageToLocale(localeString: string): string {
    switch (localeString) {
        case "Afrikaans":
        case "Afrikaans (South Africa)":
            return "af-ZA";
        case "Amharic":
        case "Amharic (Ethiopia)":
            return "am-ET";
        case "Arabic":
        case "Standard Arabic":
        case "Arabic (United Arab Emirates)":
            return "ar-AE";
        case "Arabic (Bahrain)":
            return "ar-BH";
        case "Arabic (Algeria)":
            return "ar-DZ";
        case "Arabic (Egypt)":
            return "ar-EG";
        case "Arabic (Israel)":
            return "ar-IL";
        case "Arabic (Iraq)":
            return "ar-IQ";
        case "Arabic (Jordan)":
            return "ar-JO";
        case "Arabic (Kuwait)":
            return "ar-KW";
        case "Arabic (Lebanon)":
            return "ar-LB";
        case "Arabic (Libya)":
            return "ar-LY";
        case "Arabic (Morocco)":
            return "ar-MA";
        case "Arabic (Oman)":
            return "ar-OM";
        case "Arabic (Palestinian Authority)":
            return "ar-PS";
        case "Arabic (Qatar)":
            return "ar-QA";
        case "Arabic (Saudi Arabia)":
            return "ar-SA";
        case "Arabic (Syria)":
            return "ar-SY";
        case "Arabic (Tunisia)":
            return "ar-TN";
        case "Arabic (Yemen)":
            return "ar-YE";
        case "Azerbaijani":
        case "Azerbaijani (Latin, Azerbaijan)":
            return "az-AZ";
        case "Bulgarian":
        case "Bulgarian (Bulgaria)":
            return "bg-BG";
        case "Bengali":
        case "Bengali (India)":
            return "bn-IN";
        case "Bosnian":
        case "Bosnian (Bosnia and Herzegovina)":
            return "bs-BA";
        case "Catalan":
            return "ca-ES";
        case "Cantonese":
            return "yue";
        case "Czech":
        case "Czech (Czechia)":
            return "cs-CZ";
        case "Welsh":
            return "cy-GB";
        case "Danish":
        case "Danish (Denmark)":
            return "da-DK";
        case "German (Austria)":
            return "de-AT";
        case "German (Switzerland)":
            return "de-CH";
        case "German":
        case "German (Germany)":
            return "de-DE";
        case "Greek":
        case "Greek (Greece)":
            return "el-GR";
        case "English (Australia)":
            return "en-AU";
        case "English (Canada)":
            return "en-CA";
        case "English (United Kingdom)":
            return "en-GB";
        case "English (Ghana)":
            return "en-GH";
        case "English (Hong Kong SAR)":
            return "en-HK";
        case "English (Ireland)":
            return "en-IE";
        case "English (India)":
            return "en-IN";
        case "English (Kenya)":
            return "en-KE";
        case "English (Nigeria)":
            return "en-NG";
        case "English (New Zealand)":
            return "en-NZ";
        case "English (Philippines)":
            return "en-PH";
        case "English (Singapore)":
            return "en-SG";
        case "English (Tanzania)":
            return "en-TZ";
        case "English":
        case "English (United States)":
            return "en-US";
        case "English (South Africa)":
            return "en-ZA";
        // Add additional language mappings as needed...
        case "Chinese":
        case "Chinese (Pinyin)":
        case "Chinese (Hanzi)":
        case "Chinese (Mandarin)":
            return "zh-CN";
        case "Chinese (Cantonese, Simplified)":
            return "yue-CN";
        case "Chinese (Cantonese, Traditional)":
            return "zh-HK";
        case "Chinese (Taiwanese Mandarin, Traditional)":
            return "zh-TW";
        default:
            return "en-US";
    }
}
