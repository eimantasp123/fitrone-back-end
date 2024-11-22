const { Translate } = require("@google-cloud/translate").v2;

// Translate text using Google Cloud Translation
const translateText = async (text, targetLang) => {
  //  Create Service Account
  const translate = new Translate({
    projectId: "trainer-app-428613",
    key: process.env.GOOGLE_CLOUD_TRANSLATE_API_KEY,
  });

  try {
    console.log("Translating text...", text);
    const [translation] = await translate.translate(
      `${text} ingredient`,
      targetLang,
    );
    console.log(translation);
    return;
    return translation;
  } catch (error) {
    throw new Error("Translation failed");
  }
};

module.exports = translateText;
