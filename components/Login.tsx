import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { getAllUsers } from '../services/dataService';
import { MOCK_USERS } from '../constants';
import { Lock, ArrowLeft, ShieldCheck, Users, UserCog, UserPlus, Code, Key, Search, ChevronRight, Settings } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  onBack: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onBack }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [showDevModal, setShowDevModal] = useState(false);
  const [devPassword, setDevPassword] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      const dbUsers = await getAllUsers();
      // Combine with MOCK_USERS if DB is empty
      if (dbUsers.length === 0) {
        setUsers(MOCK_USERS);
      } else {
        setUsers(dbUsers);
      }
    };
    fetchUsers();
  }, []);

  const handleLogin = (userOverride?: User, passOverride?: string) => {
    const user = userOverride || selectedUser;
    const pass = passOverride !== undefined ? passOverride : password;

    if (!user) return;
    
    // Direct login for Managers if no password is set
    const isManager = user.role === UserRole.MANAGER || user.role === UserRole.QUALITY_MANAGER;
    const hasNoPassword = !user.password || user.password === '' || user.password === '123'; // 123 is default mock, treating as "no password" for managers if requested
    
    // Developer always needs password
    if (user.role === UserRole.DEVELOPER) {
        if (pass === '427726') {
            onLogin(user);
        } else {
            setError('رمز عبور توسعه‌دهنده اشتباه است');
        }
        return;
    }

    if (isManager && hasNoPassword) {
      onLogin(user);
    } else if (user.password === pass) {
      onLogin(user);
    } else {
      setError('رمز عبور اشتباه است');
    }
  };

  useEffect(() => {
    // Auto-login if manager is selected and has no password (or default 123)
    if (selectedUser && (selectedUser.role === UserRole.MANAGER || selectedUser.role === UserRole.QUALITY_MANAGER)) {
        const hasNoPassword = !selectedUser.password || selectedUser.password === '' || selectedUser.password === '123';
        if (hasNoPassword) {
            handleLogin();
        }
    }
  }, [selectedUser]);

  const filteredUsers = users.filter(u => 
    u.role === selectedRole && 
    (u.name.includes(searchTerm) || (u.ward && u.ward.includes(searchTerm)))
  );

  const renderRoleSelection = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in zoom-in-95">
      <button 
        onClick={() => setSelectedRole(UserRole.MANAGER)}
        className="flex flex-col items-center justify-center p-6 border-2 border-blue-100 rounded-2xl hover:bg-blue-50 hover:border-blue-300 transition-all group"
      >
        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
          <ShieldCheck size={24} />
        </div>
        <span className="font-bold text-gray-800">مدیر پرستاری</span>
        <span className="text-xs text-gray-500 mt-1">سرکار خانم باقری</span>
      </button>

      <button 
        onClick={() => setSelectedRole(UserRole.QUALITY_MANAGER)}
        className="flex flex-col items-center justify-center p-6 border-2 border-green-100 rounded-2xl hover:bg-green-50 hover:border-green-300 transition-all group"
      >
        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-green-600 group-hover:text-white transition-colors">
          <UserCog size={24} />
        </div>
        <span className="font-bold text-gray-800">مدیر بهبود کیفیت</span>
        <span className="text-xs text-gray-500 mt-1">سرکار خانم زهرا خسروانی</span>
      </button>

      <button 
        onClick={() => setSelectedRole(UserRole.SUPERVISOR)}
        className="flex flex-col items-center justify-center p-6 border-2 border-purple-100 rounded-2xl hover:bg-purple-50 hover:border-purple-300 transition-all group"
      >
        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-purple-600 group-hover:text-white transition-colors">
          <UserPlus size={24} />
        </div>
        <span className="font-bold text-gray-800">سوپروایزرها</span>
        <span className="text-xs text-gray-500 mt-1">لیست سوپروایزرها</span>
      </button>

      <button 
        onClick={() => setSelectedRole(UserRole.HEAD_NURSE)}
        className="flex flex-col items-center justify-center p-6 border-2 border-orange-100 rounded-2xl hover:bg-orange-50 hover:border-orange-300 transition-all group"
      >
        <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-orange-600 group-hover:text-white transition-colors">
          <Users size={24} />
        </div>
        <span className="font-bold text-gray-800">سرپرستاران</span>
        <span className="text-xs text-gray-500 mt-1">لیست سرپرستاران بخش‌ها</span>
      </button>
    </div>
  );

  const renderUserList = () => (
    <div className="animate-in slide-in-from-left-4 duration-300">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setSelectedRole(null)} className="flex items-center gap-1 text-omid-600 font-bold text-sm hover:underline">
          <ArrowLeft size={16} /> بازگشت به نقش‌ها
        </button>
        <h3 className="font-black text-xl text-gray-800">انتخاب نام کاربری</h3>
      </div>

      <div className="relative mb-6">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input 
          type="text" 
          placeholder="جستجوی نام یا بخش..." 
          className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-omid-500 focus:border-omid-500 outline-none transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {filteredUsers.map(u => (
          <button 
            key={u.id}
            onClick={() => setSelectedUser(u)}
            className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-omid-50 hover:border-omid-200 transition-all text-right group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 group-hover:bg-omid-600 group-hover:text-white transition-colors">
                <Users size={20} />
              </div>
              <div>
                <div className="font-bold text-gray-800">{u.name}</div>
                {u.ward && <div className="text-xs text-gray-500">بخش: {u.ward}</div>}
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-300 group-hover:text-omid-600" />
          </button>
        ))}
      </div>
    </div>
  );

  const renderPasswordInput = () => (
    <div className="max-w-sm mx-auto animate-in zoom-in-95 duration-300">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-omid-100 text-omid-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
          <Lock size={32} />
        </div>
        <h3 className="font-black text-xl text-gray-800">{selectedUser?.name}</h3>
        <p className="text-gray-500 text-sm mt-1">لطفا رمز عبور خود را وارد کنید</p>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Key className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="password" 
            placeholder="رمز عبور" 
            className={`w-full pr-10 pl-4 py-4 border rounded-2xl focus:ring-4 focus:ring-omid-500/10 focus:border-omid-500 outline-none transition-all text-center tracking-[0.5em] font-mono ${error ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            autoFocus
          />
        </div>
        {error && <p className="text-red-500 text-xs text-center font-bold">{error}</p>}
        
        <button 
          onClick={handleLogin}
          className="w-full bg-omid-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-omid-600/20 hover:bg-omid-700 hover:-translate-y-1 transition-all"
        >
          ورود به سیستم
        </button>
        
        <button 
          onClick={() => setSelectedUser(null)}
          className="w-full text-gray-400 py-2 text-sm hover:text-gray-600 transition-colors"
        >
          تغییر کاربر
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans bg-[url('https://www.transparenttextures.com/patterns/subtle-grey.png')] relative">
      {/* Floating Developer Gear */}
      <button 
        onClick={() => setShowDevModal(true)}
        className="fixed bottom-6 right-6 p-4 bg-white/80 backdrop-blur-md border border-gray-200 rounded-full shadow-lg text-gray-400 hover:text-omid-600 hover:bg-white transition-all z-50 group"
      >
        <Settings size={24} className="group-hover:rotate-90 transition-transform duration-500" />
      </button>

      {/* Developer Password Modal */}
      {showDevModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-white/20">
            <div className="bg-gray-900 p-8 text-white text-center">
                <div className="w-16 h-16 bg-omid-500/20 text-omid-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Code size={32} />
                </div>
                <h3 className="text-xl font-black">ورود توسعه‌دهنده</h3>
                <p className="text-xs text-gray-400 mt-2">لطفاً رمز عبور مدیریت سیستم را وارد کنید</p>
            </div>
            <div className="p-8 space-y-4">
                <input 
                    type="password" 
                    autoFocus
                    className="w-full p-4 border-2 border-gray-100 rounded-2xl outline-none focus:border-omid-500 text-center font-mono text-2xl tracking-widest"
                    placeholder="••••••"
                    value={devPassword}
                    onChange={e => setDevPassword(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            const devUser = users.find(u => u.role === UserRole.DEVELOPER);
                            if (devUser) {
                                if (devPassword === '427726') {
                                    onLogin(devUser);
                                } else {
                                    alert('رمز عبور اشتباه است');
                                    setDevPassword('');
                                }
                            }
                        }
                    }}
                />
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowDevModal(false)}
                        className="flex-1 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 transition-all"
                    >
                        انصراف
                    </button>
                    <button 
                        onClick={() => {
                            const devUser = users.find(u => u.role === UserRole.DEVELOPER);
                            if (devUser) {
                                if (devPassword === '427726') {
                                    onLogin(devUser);
                                } else {
                                    alert('رمز عبور اشتباه است');
                                    setDevPassword('');
                                }
                            }
                        }}
                        className="flex-[2] bg-omid-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-omid-600/20 hover:bg-omid-700 transition-all"
                    >
                        تایید و ورود
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/40 backdrop-blur-xl">
        
        <div className="bg-gray-900 p-10 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-omid-600/20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full -ml-10 -mb-10 blur-2xl"></div>
          
          <button onClick={onBack} className="absolute top-6 left-6 p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all border border-white/10">
             <ArrowLeft size={20} />
          </button>
          
          <div className="bg-omid-600/20 p-4 rounded-3xl inline-block mb-4 border border-omid-500/30">
            <ShieldCheck size={48} className="text-omid-500" />
          </div>
          <h2 className="text-3xl font-black tracking-tight">پنل مدیریت بیمارستان امید</h2>
          <p className="text-gray-400 text-sm mt-3 font-medium">سیستم جامع PDP - احراز هویت کاربران</p>
        </div>

        <div className="p-8 md:p-12">
          {selectedUser ? renderPasswordInput() : (selectedRole ? renderUserList() : renderRoleSelection())}
          
          <div className="mt-12 pt-8 border-t border-gray-100 text-center">
            <div className="flex items-center justify-center gap-2 text-gray-400 text-xs font-bold">
              بیمارستان تخصصی و فوق تخصصی امید
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
