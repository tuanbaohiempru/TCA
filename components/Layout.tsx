
import React from 'react';
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

  const navItems = [
    { path: '/', label: 'Tổng quan', icon: 'fa-layer-group' },
    { path: '/customers', label: 'Khách hàng', icon: 'fa-users' },
    { path: '/tools', label: 'Công cụ', icon: 'fa-th-large' }, 
    { path: '/settings', label: 'Cài đặt', icon: 'fa-cog' }, 
  ];

  const isActive = (path: string) => {
      if (path === '/' && location.pathname !== '/') return false;
      return location.pathname.startsWith(path);
  };
  
  const handleLogout = async () => {
      if(window.confirm('Bạn chắc chắn muốn đăng xuất?')) {
          await logout();
      }
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] dark:bg-[#0f0f0f] overflow-hidden font-sans selection:bg-red-500 selection:text-white">
      
      {/* 1. DESKTOP SIDEBAR (Floating Style) */}
      <aside className="hidden md:flex flex-col w-72 m-4 mr-0 rounded-3xl bg-white dark:bg-[#1a1a1a] shadow-xl border border-gray-100 dark:border-gray-800 z-30 transition-all duration-300 relative overflow-hidden">
        {/* Decorative Blur */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-red-50 to-transparent dark:from-red-900/10 pointer-events-none"></div>

        <div className="flex items-center gap-3 px-6 py-8 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pru-red to-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/30">
             <i className="fas fa-shield-alt text-lg"></i>
          </div>
          <div>
             <h1 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">TuanChom</h1>
             <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">MDRT Assistant</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-4 space-y-2 relative z-10">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                  isActive(item.path)
                    ? 'bg-gradient-to-r from-red-50 to-white dark:from-red-900/20 dark:to-transparent text-pru-red shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 transition-colors ${
                    isActive(item.path) ? 'bg-white dark:bg-red-900/20 text-pru-red shadow-sm' : 'bg-transparent group-hover:bg-gray-100 dark:group-hover:bg-gray-700'
                }`}>
                    <i className={`fas ${item.icon} text-lg`}></i>
                </div>
                <span className="font-bold text-sm">{item.label}</span>
                {isActive(item.path) && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-pru-red"></div>}
              </Link>
            ))}
        </nav>

        <div className="p-4 mt-auto relative z-10">
           <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-3">
             {user?.photoURL ? (
                 <img src={user.photoURL} alt="Avatar" className="w-10 h-10 rounded-xl border-2 border-white dark:border-gray-700 shadow-sm" />
             ) : (
                <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                    <i className="fas fa-user"></i>
                </div>
             )}
             <div className="flex-1 overflow-hidden">
               <p className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">{user?.displayName?.split(' ').pop() || 'Tư vấn viên'}</p>
               <button onClick={handleLogout} className="text-xs text-red-500 hover:underline font-medium">Đăng xuất</button>
             </div>
           </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* 2. HEADER (Glassmorphism) - Desktop Only AI Button */}
        <header className="absolute top-0 left-0 w-full h-20 z-40 px-4 md:px-8 flex items-center justify-end pointer-events-none">
            {/* AI Assistant Button (Floating) - Hidden on Mobile */}
            <div className="pointer-events-auto pt-4 hidden md:block">
                 <button 
                    onClick={onToggleChat}
                    className="group relative flex items-center gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-white/20 dark:border-gray-700 pl-1 pr-4 py-1 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                 >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white shadow-md group-hover:animate-pulse-slow">
                        <i className="fas fa-sparkles"></i>
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Trợ lý AI</span>
                 </button>
            </div>
        </header>

        {/* 3. CONTENT AREA */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 pt-4 md:pt-8 pb-24 md:pb-8 relative z-0 scroll-smooth">
          {children}
        </main>

        {/* 4. BOTTOM NAVIGATION - Mobile Only (Central FAB) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 flex justify-between items-end px-2 pb-safe pt-2 z-50 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
            {/* First 2 Items */}
            {navItems.slice(0, 2).map((item) => (
                <Link 
                    key={item.path}
                    to={item.path} 
                    className={`flex flex-col items-center justify-center w-1/5 pb-2 relative group transition-colors ${isActive(item.path) ? 'text-pru-red' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}
                >
                    <div className={`text-xl mb-1 transition-transform duration-200 ${isActive(item.path) ? '-translate-y-1' : ''}`}>
                        <i className={`fas ${item.icon}`}></i>
                    </div>
                    <span className="text-[9px] font-bold">{item.label}</span>
                    {isActive(item.path) && (
                        <div className="absolute bottom-0 w-1 h-1 bg-pru-red rounded-full"></div>
                    )}
                </Link>
            ))}

            {/* Central AI Button (FAB) */}
            <div className="relative -top-6 w-1/5 flex justify-center pointer-events-none">
                <div className="pointer-events-auto">
                    <button 
                        onClick={onToggleChat}
                        className="w-14 h-14 rounded-full bg-gradient-to-br from-pru-red to-pink-600 text-white shadow-lg shadow-red-500/40 flex flex-col items-center justify-center transform transition-transform active:scale-95 border-4 border-gray-50 dark:border-gray-900 hover:scale-105"
                    >
                        <i className="fas fa-robot text-lg mb-0.5 animate-pulse-slow"></i>
                        <span className="text-[9px] font-black leading-none">AI</span>
                    </button>
                </div>
            </div>

            {/* Last 2 Items */}
            {navItems.slice(2).map((item) => (
                <Link 
                    key={item.path}
                    to={item.path} 
                    className={`flex flex-col items-center justify-center w-1/5 pb-2 relative group transition-colors ${isActive(item.path) ? 'text-pru-red' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}
                >
                    <div className={`text-xl mb-1 transition-transform duration-200 ${isActive(item.path) ? '-translate-y-1' : ''}`}>
                        <i className={`fas ${item.icon}`}></i>
                    </div>
                    <span className="text-[9px] font-bold">{item.label}</span>
                    {isActive(item.path) && (
                        <div className="absolute bottom-0 w-1 h-1 bg-pru-red rounded-full"></div>
                    )}
                </Link>
            ))}
        </nav>

      </div>
    </div>
  );
};

export default Layout;
