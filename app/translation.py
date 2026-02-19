from deep_translator import GoogleTranslator

def translate_text(text, target_lang):
    if target_lang == "en":
        return text

    try:
        translated = GoogleTranslator(
            source="auto",
            target=target_lang
        ).translate(text)
        return translated
    except Exception as e:
        print("Translation error:", e)
        return text
