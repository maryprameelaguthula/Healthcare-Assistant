const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const chatHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

// Gemini Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// JWT Auth Middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Healthcare keyword filter
const isHealthcareRelated = (message) => {
  const keywords = [
    'health', 'doctor', 'hospital', 'clinic', 'medicine', 'treatment', 'symptom', 'diagnosis', 'prescription',
    'medication', 'wellness', 'fitness', 'mental health', 'anxiety', 'depression', 'stress', 'sleep',
    'pain', 'fever', 'headache', 'cold', 'flu', 'cough', 'infection', 'virus', 'bacteria', 'vaccine',
    'injury', 'wound', 'fracture', 'sprain', 'bleeding', 'burn', 'swelling', 'nausea', 'vomiting', 'diarrhea',
    'constipation', 'stomach ache', 'indigestion', 'ulcer', 'heart', 'cardiac', 'blood pressure', 'hypertension',
    'cholesterol', 'diabetes', 'insulin', 'glucose', 'liver', 'kidney', 'lung', 'respiratory', 'asthma', 'bronchitis',
    'pneumonia', 'arthritis', 'joint pain', 'muscle pain', 'fatigue', 'cancer', 'tumor', 'therapy', 'chemo',
    'radiation', 'surgery', 'operation', 'fracture', 'x-ray', 'scan', 'MRI', 'CT scan', 'blood test',
    'allergy', 'rash', 'itching', 'skin', 'eczema', 'psoriasis', 'acne', 'hair loss', 'baldness', 'eye',
    'vision', 'glasses', 'contact lenses', 'ear', 'hearing', 'hearing aid', 'toothache', 'dentist', 'dental',
    'period', 'menstruation', 'pregnancy', 'fertility', 'birth control', 'abortion', 'childbirth', 'baby', 'infant'
  ];

  return keywords.some(keyword => message.toLowerCase().includes(keyword));
};

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Chat
app.post('/api/chat', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.userId;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (!isHealthcareRelated(message)) {
      return res.json({
        response: "I'm a healthcare assistant and can only help with health-related questions."
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{
          text: `
You are a helpful and supportive AI healthcare assistant.

The user asked:
"${message}"

Your reply must be in the following format:

**Understanding the issue:**  
- Briefly explain what the issue might be about.

**Suggestions to overcome it:**  
- Provide 5 to 6 clear, actionable tips or lifestyle improvements that might help the user manage or improve their condition (e.g., rest, hydration, diet, relaxation, exercise, hygiene, etc.).

Always end with this disclaimer:
⚠️ Please consult a certified medical professional for personal medical advice.
          `
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });

    const response = result.response?.text?.() || "Sorry, I couldn't generate a response.";

    await ChatHistory.findOneAndUpdate(
      { userId },
      { $push: { messages: [{ role: 'user', content: message }, { role: 'assistant', content: response }] } },
      { upsert: true }
    );

    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message. Please try again.' });
  }
});

// Chat History
app.get('/api/chat/history', authenticateToken, async (req, res) => {
  try {
    const chatHistory = await ChatHistory.findOne({ userId: req.user.userId });
    res.json({ messages: chatHistory?.messages || [] });
  } catch {
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Clear Chat History
app.delete('/api/chat/history', authenticateToken, async (req, res) => {
  try {
    await ChatHistory.findOneAndUpdate(
      { userId: req.user.userId },
      { messages: [] },
      { upsert: true }
    );
    res.json({ message: 'Chat history cleared' });
  } catch {
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`MongoDB URI: ${process.env.MONGODB_URI}`);
  console.log(`Gemini API Key configured: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No'}`);
});
