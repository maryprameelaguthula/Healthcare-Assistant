import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import ChatbotPage from './components/ChatbotPage';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('login');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setCurrentPage('chatbot');
    }
  }, []);

  const handleLogin = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('token', userToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setCurrentPage('chatbot');
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentPage('login');
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'login':
        return (
          <LoginPage
            onLogin={handleLogin}
            onSwitchToRegister={() => setCurrentPage('register')}
          />
        );
      case 'register':
        return (
          <RegisterPage
            onSwitchToLogin={() => setCurrentPage('login')}
          />
        );
      case 'chatbot':
        return (
          <ChatbotPage
            user={user}
            token={token}
            onLogout={handleLogout}
            onLoginClick={() => setCurrentPage('login')} // NEW: for login button in Chatbot
          />
        );
      default:
        return (
          <LoginPage
            onLogin={handleLogin}
            onSwitchToRegister={() => setCurrentPage('register')}
          />
        );
    }
  };

  return (
    <div className="App">
      {renderCurrentPage()}
    </div>
  );
}

export default App;
