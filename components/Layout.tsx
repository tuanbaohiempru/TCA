
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User } from 'firebase/auth';
import { logout } from '../services/auth';

interface LayoutProps {
  children: React.ReactNode;
  onToggleChat: () => void;
  user?: User;
}

const Layout: React.FC<LayoutProps> = ({ children, onToggleChat, user }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Home', icon: 'fa-home' },
    { path: '/customers', label: 'Khách', icon: 'fa-users' },
    { path: '/appointments', label: 'Lịch', icon: 'fa-calendar-alt' },
    { path: '/settings', label: 'Cài đặt', icon: 'fa-cog' }, 
  ];

  const isActive = (path: string) => location.pathname === path;
  const pageTitle = navItems.find(item => item.path === location.pathname)?.label || 'Chi tiết';

  const handleLogout = async () => {
      if(window.confirm('Bạn chắc chắn muốn đăng xuất?')) {
          await logout();
      }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-pru-dark overflow-hidden transition-colors duration-300">
      
      {/* 1. DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-pru-card border-r border-gray-200 dark:border-gray-800 z-30 transition-colors">
        <div className="flex items-center justify-center h-16 border-b border-gray-200 dark:border-gray-800 bg-pru-red text-white">
          <span className="text-xl font-bold tracking-wider">TuanChom</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-red-50 dark:bg-red-900/20 text-pru-red font-semibold border-l-4 border-pru-red'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <i className={`fas ${item.icon} w-6 text-center mr-3`}></i>
                  {item.label}
                </Link>
              </li>
            ))}
             <li>
                <Link to="/contracts" className={`flex items-center px-4 py-3 rounded-lg transition-colors ${isActive('/contracts') ? 'text-pru-red bg-red-50' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <i className="fas fa-file-contract w-6 text-center mr-3"></i> Hợp đồng
                </Link>
             </li>
          </ul>
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
           <div className="flex items-center space-x-3 text-sm text-gray-500 mb-3">
             {user?.photoURL ? (
                 <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-gray-200" />
             ) : (
                <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
                    <i className="fas fa-user text-white dark:text-gray-400"></i>
                </div>
             )}
             <div className="overflow-hidden">
               <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{user?.displayName || 'Tư vấn viên'}</p>
               <Link to="/settings" className="text-xs text-blue-500 hover:underline">Cấu hình</Link>
             </div>
           </div>
           <button onClick={handleLogout} className="w-full py-2 flex items-center justify-center text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-lg transition">
               <i className="fas fa-sign-out-alt mr-2"></i> Đăng xuất
           </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* 2. HEADER */}
        <header className="flex items-center justify-between h-14 md:h-16 bg-white dark:bg-pru-card border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 z-20 transition-colors shadow-sm shrink-0">
          <div className="flex items-center gap-3">
             <div className="md:hidden w-8 h-8 bg-pru-red rounded-full flex items-center justify-center text-white font-bold text-xs">TC</div>
             <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{pageTitle}</h2>
          </div>

          <div className="flex items-center gap-3">
             <button 
                onClick={onToggleChat}
                className="w-10 h-10 md:w-auto md:px-4 md:py-2 rounded-full bg-red-600 text-white flex items-center justify-center gap-2 hover:bg-red-700 transition group shadow-lg shadow-red-500/30 animate-pulse"
             >
                <i className="fas fa-robot text-lg md:text-base"></i>
                <span className="hidden md:inline text-sm font-bold">Trợ lý TuanChom</span>
             </button>
          </div>
        </header>

        {/* 3. CONTENT AREA */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-pru-dark p-4 md:p-6 pb-24 md:pb-6 relative z-0 scroll-smooth">
          {children}
        </main>

        {/* 4. BOTTOM NAVIGATION - Mobile Only */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white dark:bg-pru-card border-t border-gray-200 dark:border-gray-800 flex justify-around items-center min-h-[4.5rem] z-40 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            {navItems.map((item) => (
                <Link 
                    key={item.path}
                    to={item.path} 
                    className={`flex flex-col items-center justify-center w-full py-2 ${isActive(item.path) ? 'text-pru-red' : 'text-gray-400'}`}
                >
                    <i className={`fas ${item.icon} text-lg mb-1 ${isActive(item.path) ? 'animate-bounce-short' : ''}`}></i>
                    <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
                </Link>
            ))}
        </nav>

      </div>
      
      <style>{`
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .animate-bounce-short { animation: bounce-short 0.3s; }
        @keyframes bounce-short {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
};

export default Layout;
