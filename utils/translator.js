/**
 * Astra A0 — Lightweight Translation Layer
 * Template-based translation for medical responses across Indian languages.
 * Expandable via JSON — no external API dependency.
 */

const TRANSLATIONS = {
    // --- Section Headers ---
    'diagnosis_header': {
        english: '🩺 Diagnosis Results',
        hindi: '🩺 निदान परिणाम', hinglish: '🩺 Diagnosis Results',
        gujarati: '🩺 નિદાન પરિણામો', marathi: '🩺 निदान निकाल',
        tamil: '🩺 நோய் கணிப்பு முடிவுகள்', telugu: '🩺 రోగనిర్ధారణ ఫలితాలు',
        bengali: '🩺 রোগ নির্ণয় ফলাফল', kannada: '🩺 ರೋಗನಿರ್ಣಯ ಫಲಿತಾಂಶಗಳು',
        malayalam: '🩺 രോഗനിർണ്ണയ ഫലങ്ങൾ', punjabi: '🩺 ਨਿਦਾਨ ਨਤੀਜੇ'
    },
    'remedies_header': {
        english: '💊 Recommended Remedies',
        hindi: '💊 सुझाए गए उपचार', hinglish: '💊 Suggested Remedies',
        gujarati: '💊 ભલામણ કરેલ ઉપચાર', marathi: '💊 शिफारस केलेले उपचार',
        tamil: '💊 பரிந்துரைக்கப்பட்ட தீர்வுகள்', telugu: '💊 సిఫార్సు చేసిన చికిత్సలు',
        bengali: '💊 প্রস্তাবিত প্রতিকার', kannada: '💊 ಶಿಫಾರಸು ಮಾಡಿದ ಚಿಕಿತ್ಸೆಗಳು',
        malayalam: '💊 ശുപാർശ ചെയ്ത ചികിത്സകൾ', punjabi: '💊 ਸਿਫਾਰਸ਼ ਕੀਤੇ ਇਲਾਜ'
    },
    'herbs_label': {
        english: '🌿 Herbs', hindi: '🌿 जड़ी-बूटियां', hinglish: '🌿 Herbs',
        gujarati: '🌿 જડીબુટ્ટી', marathi: '🌿 औषधी वनस्पती',
        tamil: '🌿 மூலிகைகள்', telugu: '🌿 మూలికలు',
        bengali: '🌿 ভেষজ', kannada: '🌿 ಗಿಡಮೂಲಿಕೆಗಳು',
        malayalam: '🌿 ഔഷധ സസ്യങ്ങൾ', punjabi: '🌿 ਜੜੀ-ਬੂਟੀਆਂ'
    },
    'home_remedies_label': {
        english: '🏠 Home Remedies', hindi: '🏠 घरेलू उपचार', hinglish: '🏠 Gharelu Upay',
        gujarati: '🏠 ઘરેલુ ઉપાય', marathi: '🏠 घरगुती उपाय',
        tamil: '🏠 வீட்டு வைத்தியம்', telugu: '🏠 ఇంటి చిట్కాలు',
        bengali: '🏠 ঘরোয়া প্রতিকার', kannada: '🏠 ಮನೆ ಮದ್ದು',
        malayalam: '🏠 വീട്ടു ചികിത്സ', punjabi: '🏠 ਘਰੇਲੂ ਨੁਸਖ਼ੇ'
    },
    'yoga_label': {
        english: '🧘 Yoga', hindi: '🧘 योग', hinglish: '🧘 Yoga',
        gujarati: '🧘 યોગ', marathi: '🧘 योग',
        tamil: '🧘 யோகா', telugu: '🧘 యోగా',
        bengali: '🧘 যোগ', kannada: '🧘 ಯೋಗ',
        malayalam: '🧘 യോഗ', punjabi: '🧘 ਯੋਗ'
    },
    'lifestyle_label': {
        english: '✨ Lifestyle Tips', hindi: '✨ जीवनशैली सुझाव', hinglish: '✨ Lifestyle Tips',
        gujarati: '✨ જીવનશૈલી ટિપ્સ', marathi: '✨ जीवनशैली सल्ला',
        tamil: '✨ வாழ்க்கை முறை குறிப்புகள்', telugu: '✨ జీవన శైలి చిట్కాలు',
        bengali: '✨ জীবনধারা পরামর্শ', kannada: '✨ ಜೀವನಶೈಲಿ ಸಲಹೆಗಳು',
        malayalam: '✨ ജീവിതശൈലി നിർദ്ദേശങ്ങൾ', punjabi: '✨ ਜੀਵਨ ਸ਼ੈਲੀ ਸੁਝਾਅ'
    },

    // --- Common Phrases ---
    'greeting_response': {
        english: 'Hello! I am Astra A0, your Ayurvedic health assistant. Tell me your symptoms and I will help you.',
        hindi: 'नमस्ते! मैं अस्त्र A0 हूं, आपका आयुर्वेदिक स्वास्थ्य सहायक। अपने लक्षण बताइए, मैं आपकी मदद करूंगा।',
        hinglish: 'Namaste! Main Astra A0 hoon, aapka Ayurvedic health assistant. Apne symptoms batao, main help karunga.',
        gujarati: 'નમસ્તે! હું અસ્ત્ર A0 છું, તમારો આયુર્વેદિક સ્વાસ્થ્ય સહાયક. તમારા લક્ષણો જણાવો.',
        marathi: 'नमस्कार! मी अस्त्र A0, तुमचा आयुर्वेदिक आरोग्य सहाय्यक. तुमची लक्षणे सांगा.',
        tamil: 'வணக்கம்! நான் அஸ்ட்ரா A0, உங்கள் ஆயுர்வேத சுகாதார உதவியாளர். உங்கள் அறிகுறிகளைச் சொல்லுங்கள்.',
        telugu: 'నమస్కారం! నేను అస్ట్రా A0, మీ ఆయుర్వేద ఆరోగ్య సహాయకుడు. మీ లక్షణాలు చెప్పండి.',
        bengali: 'নমস্কার! আমি অস্ত্র A0, আপনার আয়ুর্বেদিক স্বাস্থ্য সহায়ক। আপনার উপসর্গ বলুন।',
        kannada: 'ನಮಸ್ಕಾರ! ನಾನು ಅಸ್ತ್ರ A0, ನಿಮ್ಮ ಆಯುರ್ವೇದ ಆರೋಗ್ಯ ಸಹಾಯಕ. ನಿಮ್ಮ ಲಕ್ಷಣಗಳನ್ನು ಹೇಳಿ.',
        malayalam: 'നമസ്കാരം! ഞാൻ അസ്ട്ര A0, നിങ്ങളുടെ ആയുർവേദ ആരോഗ്യ സഹായി. നിങ്ങളുടെ ലക്ഷണങ്ങൾ പറയൂ.',
        punjabi: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਅਸਤ੍ਰ A0 ਹਾਂ, ਤੁਹਾਡਾ ਆਯੁਰਵੈਦਿਕ ਸਿਹਤ ਸਹਾਇਕ। ਆਪਣੇ ਲੱਛਣ ਦੱਸੋ।'
    },
    'emergency_warning': {
        english: '🚨 EMERGENCY: These symptoms may indicate a life-threatening condition. Please seek immediate medical help or call emergency services NOW!',
        hindi: '🚨 आपातकाल: ये लक्षण जानलेवा हो सकते हैं। कृपया तुरंत चिकित्सा सहायता लें या आपातकालीन सेवाओं को कॉल करें!',
        hinglish: '🚨 EMERGENCY: Ye symptoms bahut serious ho sakte hain. Turant doctor ke paas jaao ya ambulance bulo!',
        gujarati: '🚨 કટોકટી: આ લક્ષણો ગંભીર હોઈ શકે છે. કૃપા કરીને તાત્કાલિક તબીબી મદદ લો!',
        marathi: '🚨 आणीबाणी: ही लक्षणे गंभीर असू शकतात. कृपया तात्काळ वैद्यकीय मदत घ्या!',
        tamil: '🚨 அவசரநிலை: இந்த அறிகுறிகள் உயிருக்கு ஆபத்தானவை. உடனடியாக மருத்துவ உதவியை பெறுங்கள்!',
        telugu: '🚨 అత్యవసరం: ఈ లక్షణాలు ప్రాణాంతకం కావచ్చు. దయచేసి వెంటనే వైద్య సహాయం పొందండి!',
        bengali: '🚨 জরুরি: এই উপসর্গগুলি প্রাণঘাতী হতে পারে। অনুগ্রহ করে এখনই চিকিৎসা সহায়তা নিন!',
        kannada: '🚨 ತುರ್ತು: ಈ ಲಕ್ಷಣಗಳು ಜೀವಕ್ಕೆ ಅಪಾಯಕಾರಿ. ದಯವಿಟ್ಟು ತಕ್ಷಣ ವೈದ್ಯಕೀಯ ಸಹಾಯ ಪಡೆಯಿರಿ!',
        malayalam: '🚨 അടിയന്തരം: ഈ ലക്ഷണങ്ങൾ ജീവന് ഭീഷണിയാകാം. ദയവായി ഉടൻ വൈദ്യസഹായം തേടുക!',
        punjabi: '🚨 ਐਮਰਜੈਂਸੀ: ਇਹ ਲੱਛਣ ਜਾਨਲੇਵਾ ਹੋ ਸਕਦੇ ਹਨ। ਕਿਰਪਾ ਕਰਕੇ ਤੁਰੰਤ ਡਾਕਟਰੀ ਮਦਦ ਲਓ!'
    },
    'more_symptoms_prompt': {
        english: 'Could you describe more symptoms? The more details you share, the more accurate the diagnosis will be.',
        hindi: 'क्या आप और लक्षण बता सकते हैं? जितनी ज़्यादा जानकारी, उतना सही निदान।',
        hinglish: 'Aur symptoms bata sakte ho? Jitni zyada detail, utna sahi diagnosis hoga.',
        gujarati: 'શું તમે વધુ લક્ષણો જણાવી શકો? જેટલી વધુ માહિતી, તેટલું સચોટ નિદાન.',
        marathi: 'अजून लक्षणे सांगू शकता का? जितकी जास्त माहिती, तितके अचूक निदान.',
        tamil: 'மேலும் அறிகுறிகளைச் சொல்ல முடியுமா? அதிக விவரம், துல்லியமான கணிப்பு.',
        telugu: 'మరిన్ని లక్షణాలు చెప్పగలరా? ఎంత ఎక్కువ వివరాలు, అంత ఖచ్చితమైన నిర్ధారణ.',
        bengali: 'আরও উপসর্গ বলতে পারবেন? বেশি তথ্য দিলে সঠিক নির্ণয় হবে।',
        kannada: 'ಹೆಚ್ಚಿನ ಲಕ್ಷಣಗಳನ್ನು ಹೇಳಬಹುದೇ? ಹೆಚ್ಚು ವಿವರ, ನಿಖರ ರೋಗನಿರ್ಣಯ.',
        malayalam: 'കൂടുതൽ ലക്ഷണങ്ങൾ പറയാമോ? കൂടുതൽ വിവരങ്ങൾ, കൃത്യമായ രോഗനിർണ്ണയം.',
        punjabi: 'ਹੋਰ ਲੱਛਣ ਦੱਸ ਸਕਦੇ ਹੋ? ਜਿੰਨੀ ਜ਼ਿਆਦਾ ਜਾਣਕਾਰੀ, ਓਨਾ ਸਹੀ ਨਿਦਾਨ।'
    },
    'symptoms_noted': {
        english: '✅ Symptoms noted: ',
        hindi: '✅ लक्षण दर्ज: ', hinglish: '✅ Symptoms note ho gaye: ',
        gujarati: '✅ લક્ષણો નોંધાયા: ', marathi: '✅ लक्षणे नोंदवली: ',
        tamil: '✅ அறிகுறிகள் பதிவு: ', telugu: '✅ లక్షణాలు నమోదు: ',
        bengali: '✅ উপসর্গ নথিভুক্ত: ', kannada: '✅ ಲಕ್ಷಣಗಳು ದಾಖಲು: ',
        malayalam: '✅ ലക്ഷണങ്ങൾ രേഖപ്പെടുത്തി: ', punjabi: '✅ ਲੱਛਣ ਦਰਜ: '
    },
    'confidence_label': {
        english: 'Confidence',
        hindi: 'विश्वास', hinglish: 'Confidence',
        gujarati: 'વિશ્વાસ', marathi: 'विश्वास',
        tamil: 'நம்பகத்தன்மை', telugu: 'నమ్మకం',
        bengali: 'নিশ্চয়তা', kannada: 'ವಿಶ್ವಾಸ',
        malayalam: 'വിശ്വാസ്യത', punjabi: 'ਭਰੋਸਾ'
    },
    'disclaimer': {
        english: '⚕️ Disclaimer: This is AI-assisted guidance based on Ayurvedic principles. Always consult a qualified healthcare professional for medical decisions.',
        hindi: '⚕️ अस्वीकरण: यह AI द्वारा आयुर्वेदिक सिद्धांतों पर आधारित मार्गदर्शन है। चिकित्सा निर्णयों के लिए हमेशा योग्य डॉक्टर से परामर्श करें।',
        hinglish: '⚕️ Disclaimer: Ye AI-based Ayurvedic guidance hai. Medical decisions ke liye hamesha doctor se mile.',
        gujarati: '⚕️ અસ્વીકરણ: આ AI-આધારિત આયુર્વેદિક માર્ગદર્શન છે. હંમેશા ડૉક્ટરની સલાહ લો.',
        marathi: '⚕️ अस्वीकरण: हे AI-आधारित आयुर्वेदिक मार्गदर्शन आहे. नेहमी डॉक्टरांचा सल्ला घ्या.',
        tamil: '⚕️ மறுப்பு: இது AI அடிப்படையிலான ஆயுர்வேத வழிகாட்டுதல். எப்போதும் மருத்துவரை ஆலோசிக்கவும்.',
        telugu: '⚕️ నిరాకరణ: ఇది AI ఆధారిత ఆయుర్వేద మార్గదర్శకత్వం. ఎల్లప్పుడూ వైద్యుడిని సంప్రదించండి.',
        bengali: '⚕️ দাবিত্যাগ: এটি AI-ভিত্তিক আয়ুর্বেদিক রোগনির্ণয়। সবসময় চিকিৎসকের পরামর্শ নিন।',
        kannada: '⚕️ ಹಕ್ಕುತ್ಯಾಗ: ಇದು AI ಆಧಾರಿತ ಆಯುರ್ವೇದ ಮಾರ್ಗದರ್ಶನ. ಯಾವಾಗಲೂ ವೈದ್ಯರ ಸಲಹೆ ಪಡೆಯಿರಿ.',
        malayalam: '⚕️ നിരാകരണം: ഇത് AI അടിസ്ഥാനമാക്കിയ ആയുർവേദ മാർഗ്ഗനിർദ്ദേശമാണ്. എല്ലായ്പ്പോഴും ഡോക്ടറെ കാണുക.',
        punjabi: '⚕️ ਬੇਦਾਅਵਾ: ਇਹ AI-ਅਧਾਰਤ ਆਯੁਰਵੈਦਿਕ ਮਾਰਗਦਰਸ਼ਨ ਹੈ। ਹਮੇਸ਼ਾ ਡਾਕਟਰ ਦੀ ਸਲਾਹ ਲਓ।'
    },
    'session_reset': {
        english: '🔄 Session reset. You can start describing your symptoms again.',
        hindi: '🔄 सत्र रीसेट। आप फिर से अपने लक्षण बता सकते हैं।',
        hinglish: '🔄 Session reset ho gaya. Ab apne symptoms dobara batao.',
        gujarati: '🔄 સત્ર રીસેટ. ફરીથી તમારા લક્ષણો જણાવો.',
        marathi: '🔄 सत्र रीसेट. पुन्हा लक्षणे सांगा.',
        tamil: '🔄 அமர்வு மீட்டமைக்கப்பட்டது. மீண்டும் அறிகுறிகள் சொல்லுங்கள்.',
        telugu: '🔄 సెషన్ రీసెట్. మళ్ళీ లక్షణాలు చెప్పండి.',
        bengali: '🔄 সেশন রিসেট। আবার উপসর্গ বলুন।',
        kannada: '🔄 ಸೆಶನ್ ರೀಸೆಟ್. ಮತ್ತೆ ಲಕ್ಷಣಗಳನ್ನು ಹೇಳಿ.',
        malayalam: '🔄 സെഷൻ റീസെറ്റ്. വീണ്ടും ലക്ഷണങ്ങൾ പറയൂ.',
        punjabi: '🔄 ਸੈਸ਼ਨ ਰੀਸੈਟ। ਦੁਬਾਰਾ ਲੱਛਣ ਦੱਸੋ।'
    },
    'no_symptoms_found': {
        english: "I couldn't identify specific symptoms from your message. Could you describe what you're feeling? For example: fever, headache, cough, body pain...",
        hindi: 'मैं आपके संदेश से विशिष्ट लक्षण नहीं पहचान पाया। कृपया बताइए क्या तकलीफ़ है? जैसे: बुखार, सिर दर्द, खांसी...',
        hinglish: 'Main aapke message se symptoms samajh nahi paya. Batao kya problem hai? Jaise: bukhar, sar dard, khansi...',
        gujarati: 'તમારા સંદેશમાંથી ચોક્કસ લક્ષણો ઓળખી શક્યો નહીં. કૃપા કરીને જણાવો શું તકલીફ છે?',
        marathi: 'तुमच्या संदेशातून लक्षणे ओळखता आली नाहीत. कृपया सांगा काय त्रास आहे?',
        tamil: 'உங்கள் செய்தியிலிருந்து அறிகுறிகளை கண்டறிய முடியவில்லை. என்ன பிரச்சினை என்று சொல்லுங்கள்.',
        telugu: 'మీ సందేశం నుండి లక్షణాలు గుర్తించలేకపోయాను. ఏమి సమస్య ఉందో చెప్పండి.',
        bengali: 'আপনার বার্তা থেকে নির্দিষ্ট উপসর্গ চিহ্নিত করতে পারিনি। কী সমস্যা বলুন।',
        kannada: 'ನಿಮ್ಮ ಸಂದೇಶದಿಂದ ಲಕ್ಷಣಗಳನ್ನು ಗುರುತಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಏನು ಸಮಸ್ಯೆ ಹೇಳಿ.',
        malayalam: 'നിങ്ങളുടെ സന്ദേശത്തിൽ നിന്ന് ലക്ഷണങ്ങൾ തിരിച്ചറിയാൻ കഴിഞ്ഞില്ല. എന്താണ് പ്രശ്നം?',
        punjabi: 'ਤੁਹਾਡੇ ਸੰਦੇਸ਼ ਤੋਂ ਲੱਛਣ ਪਛਾਣ ਨਹੀਂ ਸਕਿਆ। ਕੀ ਤਕਲੀਫ਼ ਹੈ ਦੱਸੋ।'
    },
    'api_error': {
        english: '⚠️ Our diagnostic engine is temporarily unavailable. Please try again in a moment.',
        hindi: '⚠️ हमारा नैदानिक इंजन अभी उपलब्ध नहीं है। कृपया कुछ देर बाद प्रयास करें।',
        hinglish: '⚠️ Diagnosis engine abhi available nahi hai. Thodi der baad try karo.',
        gujarati: '⚠️ અમારું નિદાન એન્જિન હાલમાં ઉપલબ્ધ નથી. થોડી વાર પછી ફરી પ્રયત્ન કરો.',
        marathi: '⚠️ आमचे निदान इंजिन सध्या उपलब्ध नाही. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.',
        tamil: '⚠️ எங்கள் நோயறிதல் அமைப்பு தற்போது கிடைக்கவில்லை. சிறிது நேரம் கழித்து முயற்சிக்கவும்.',
        telugu: '⚠️ మా రోగనిర్ధారణ యంత్రం ప్రస్తుతం అందుబాటులో లేదు. కొంచెం తర్వాత మళ్ళీ ప్రయత్నించండి.',
        bengali: '⚠️ আমাদের রোগ নির্ণয় ইঞ্জিন এই মুহূর্তে উপলব্ধ নয়। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
        kannada: '⚠️ ನಮ್ಮ ರೋಗನಿರ್ಣಯ ಎಂಜಿನ್ ಪ್ರಸ್ತುತ ಲಭ್ಯವಿಲ್ಲ. ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
        malayalam: '⚠️ ഞങ്ങളുടെ രോഗനിർണ്ണയ എഞ്ചിൻ ഇപ്പോൾ ലഭ്യമല്ല. അൽപ്പ സമയത്തിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.',
        punjabi: '⚠️ ਸਾਡਾ ਨਿਦਾਨ ਇੰਜਣ ਇਸ ਸਮੇਂ ਉਪਲਬਧ ਨਹੀਂ ਹੈ। ਥੋੜੀ ਦੇਰ ਬਾਅਦ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।'
    }
};

/**
 * Get a translated phrase.
 * @param {string} key - Translation key
 * @param {string} language - Target language
 * @returns {string}
 */
function t(key, language) {
    const entry = TRANSLATIONS[key];
    if (!entry) return key;
    return entry[language] || entry['english'] || key;
}

module.exports = { t, TRANSLATIONS };
