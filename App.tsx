import React, { useState, useEffect } from 'react';
import { User } from './types';
import Login from './components/Login';
import NurseForm from './components/NurseForm';
import Dashboard from './components/Dashboard';
import { getAllUsers } from './services/dataService';
import { MOCK_USERS } from './constants';

const App: React.FC = () => {
  // If currentUser is null, we show the NurseForm (Public View).
  // If currentUser is set, we show the Dashboard (Private View).
  // If isLoginPage is true, we show the Admin Login form.
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoginPage, setIsLoginPage] = useState(false);

  // Persistence & Auto-Login Logic
  useEffect(() => {
    const checkAutoLogin = async () => {
        const params = new URLSearchParams(window.location.search);
        const autoLoginUser = params.get('autoLogin');
        
        if (autoLoginUser) {
            const allUsers = await getAllUsers();
            const usersToSearch = allUsers.length > 0 ? allUsers : MOCK_USERS;
            const foundUser = usersToSearch.find(u => u.username === autoLoginUser);
            
            if (foundUser) {
                setCurrentUser(foundUser);
                localStorage.setItem('currentUser', JSON.stringify(foundUser));
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
            }
        }

        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                setCurrentUser(JSON.parse(savedUser));
            } catch (e) {
                console.error('Failed to parse saved user', e);
            }
        }
    };

    checkAutoLogin();
  }, []);

  const handleAdminLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    setIsLoginPage(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('impersonating');
    setIsLoginPage(true); // Redirect to Login page instead of NurseForm
  };

  // 1. Admin Dashboard (Logged in)
  if (currentUser) {
    return (
      <Dashboard 
        user={currentUser} 
        onLogout={handleLogout} 
      />
    );
  }

  // 2. Admin Login Page
  if (isLoginPage) {
    return (
      <Login 
        onLogin={handleAdminLogin} 
        onBack={() => setIsLoginPage(false)}
      />
    );
  }

  // 3. Default: Public PDP Form (No login required)
  return (
    <NurseForm 
      onAdminLoginClick={() => setIsLoginPage(true)}
    />
  );
};

export default App;