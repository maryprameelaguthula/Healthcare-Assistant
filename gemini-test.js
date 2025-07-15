const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

async function runGeminiPrompt() {
  try {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
      {
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Explain how AI works in a few words' }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY
        }
      }
    );

    const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('\n✅ Gemini Flash Response:\n', reply);
  } catch (error) {
    console.error('\n❌ Error calling Gemini Flash:');
    console.error(error.response?.data || error.message);
  }
}

runGeminiPrompt();
