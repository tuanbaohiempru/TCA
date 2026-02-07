
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
    <div className="flex h-screen bg-slate-100 dark:bg-[#0f0f0f] overflow-hidden font-sans selection:bg-red-500 selection:text-white">
      
      {/* 1. DESKTOP SIDEBAR (Floating Style) */}
      <aside className="hidden md:flex flex-col w-72 m-4 mr-0 rounded-3xl bg-white dark:bg-[#1a1a1a] shadow-2xl border border-slate-200 dark:border-gray-800 z-30 transition-all duration-300 relative overflow-hidden">
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
                    ? 'bg-gradient-to-r from-red-50 to-white dark:from-red-900/20 dark:to-transparent text-pru-red shadow-sm border border-red-100 dark:border-transparent'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 transition-colors ${
                    isActive(item.path) ? 'bg-white dark:bg-red-900/20 text-pru-red shadow-sm' : 'bg-transparent group-hover:bg-white dark:group-hover:bg-gray-700'
                }`}>
                    <i className={`fas ${item.icon} text-lg`}></i>
                </div>
                <span className="font-bold text-sm">{item.label}</span>
                {isActive(item.path) && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-pru-red"></div>}
              </Link>
            ))}
        </nav>

        <div className="p-4 mt-auto relative z-10">
           <div className="bg-slate-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-slate-100 dark:border-gray-800 flex items-center gap-3">
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
        
        {/* 2. HEADER - Removed AI Button from here */}
        <header className="absolute top-0 left-0 w-full h-20 z-40 px-4 md:px-8 flex items-center justify-end pointer-events-none">
            {/* Header content empty now for desktop, reserved for future tools/notifs */}
        </header>

        {/* 3. CONTENT AREA */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 pt-4 md:pt-8 pb-24 md:pb-8 relative z-0 scroll-smooth">
          {children}
        </main>

        {/* 4. DESKTOP FLOATING AI BUTTON (Bottom Right) */}
        <div className="hidden md:block fixed bottom-10 right-10 z-[60]">
            <button 
                onClick={onToggleChat}
                className="group relative w-16 h-16 bg-gradient-to-tr from-pru-red to-pink-500 rounded-full shadow-[0_8px_30px_rgb(237,27,46,0.4)] flex items-center justify-center text-white transition-all duration-300 hover:scale-110 hover:shadow-[0_20px_40px_rgb(237,27,46,0.6)] active:scale-95"
            >
                {/* Pulse Ring */}
                <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-pulse"></div>
                
                {/* Icon */}
                <i className="fas fa-sparkles text-2xl"></i>
                
                {/* Notification Badge (Optional logic can be added later) */}
                <span className="absolute top-0 right-0 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-500"></span>
                </span>

                {/* Hover Label */}
                <div className="absolute bottom-full mb-3 right-1/2 translate-x-1/2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg pointer-events-none">
                    Trợ lý AI
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-white"></div>
                </div>
            </button>
        </div>

        {/* 5. BOTTOM NAVIGATION - Mobile Only (Central FAB) */}
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

            {/* Central AI Button (Mobile FAB) */}
            <div className="relative -top-6 w-1/5 flex justify-center pointer-events-none">
                <div className="pointer-events-auto">
                    <button 
                        onClick={onToggleChat}
                        className="w-14 h-14 rounded-full bg-gradient-to-br from-pru-red to-pink-600 text-white shadow-lg shadow-red-500/40 flex flex-col items-center justify-center transform transition-transform active:scale-95 border-4 border-slate-100 dark:border-gray-900 hover:scale-105"
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