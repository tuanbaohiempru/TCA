
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppState, ContractStatus, Customer, Appointment, AppointmentStatus, AppointmentResult } from '../types';
import { generateActionScript } from '../services/geminiService';
import { formatDateVN } from '../components/Shared';

interface DashboardProps {
  state: AppState;
  onUpdateContract: (c: any) => void;
  onAddAppointment: (a: Appointment) => Promise<void>;
  onUpdateCustomer: (c: Customer) => Promise<void>;
  onUpdateAppointment: (a: Appointment) => Promise<void>;
}

interface ScheduledTask {
  id: string;
  time: string;
  type: 'appointment' | 'insight' | 'signal' | 'prep';
  category: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  score: number;
  title: string;
  why: string;
  actionLabel: string;
  actionIcon: string;
  customer: Customer | null;
  status: AppointmentStatus;
  outcome?: AppointmentResult;
  meta?: any;
  date?: string;
  daysLeft?: number;
}

const Dashboard: React.FC<DashboardProps> = ({ state, onAddAppointment, onUpdateCustomer, onUpdateAppointment }) => {
  const { customers, contracts, appointments, agentProfile } = state;
  const navigate = useNavigate();
  
  const [activeSignalIndex, setActiveSignalIndex] = useState(0);
  const [scriptModal, setScriptModal] = useState<{ isOpen: boolean; isLoading: boolean; task: ScheduledTask | null; script: any | null; }>({ 
      isOpen: false, isLoading: false, task: null, script: null 
  });

  const { fixedTasks, opportunitySignals, weeklyPreps, kpiStats } = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const fixed: ScheduledTask[] = [];
    const signals: ScheduledTask[] = [];
    const preps: ScheduledTask[] = [];

    // KPI Calc
    let monthlyPremium = 0;
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    contracts.forEach(c => {
        const effDate = new Date(c.effectiveDate);
        if (effDate.getMonth() === currentMonth && effDate.getFullYear() === currentYear && c.status === ContractStatus.ACTIVE) {
            monthlyPremium += c.totalFee;
        }
    });

    // 1. FIXED APPOINTMENTS (Today)
    appointments.filter(a => a.date === todayStr).forEach(app => {
        const cus = customers.find(c => c.id === app.customerId);
        fixed.push({
            id: app.id, time: app.time, type: 'appointment', category: 'Lịch hẹn', priority: 'high', score: 100,
            title: app.customerName, why: app.note || 'Lịch hẹn trong ngày',
            actionLabel: 'Check-in', actionIcon: 'fa-check', 
            customer: cus || null, status: app.status
        });
    });

    // 2. SCAN FOR WEEKLY PREPARATION
    customers.forEach(cus => {
        if (cus.dob) {
            const dob = new Date(cus.dob);
            const nextBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
            if (nextBday < today) nextBday.setFullYear(today.getFullYear() + 1);
            const diffDays = Math.ceil((nextBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays <= 7) {
                preps.push({
                    id: `prep-bday-${cus.id}`, time: 'All Day', type: 'prep', category: 'Sinh nhật', priority: 'high',
                    score: 0, title: cus.fullName, why: diffDays === 0 ? 'Hôm nay!' : `Còn ${diffDays} ngày`,
                    actionLabel: 'Gửi quà', actionIcon: 'fa-gift', customer: cus, status: AppointmentStatus.UPCOMING, daysLeft: diffDays
                });
            }
        }
    });

    // 3. OPPORTUNITY SIGNALS
    customers.forEach(cus => {
        const cusContracts = contracts.filter(c => c.customerId === cus.id && c.status === ContractStatus.ACTIVE);
        const totalSA = cusContracts.reduce((sum, c) => sum + (c.mainProduct?.sumAssured || 0), 0);
        
        // Simple logic: Income * 10 > SA
        if (cus.analysis?.incomeMonthly && totalSA < (cus.analysis.incomeMonthly * 12 * 10)) {
             signals.push({
                id: `upsell-${cus.id}`, time: '', type: 'signal', category: 'Gia tăng', priority: 'medium',
                score: 80, title: cus.fullName, why: 'Chưa đủ quỹ bảo vệ (10x Thu nhập)',
                actionLabel: 'Tư vấn', actionIcon: 'fa-comment-dollar', customer: cus, status: AppointmentStatus.UPCOMING
            });
        }
    });

    return { 
        fixedTasks: fixed.sort((a, b) => a.time.localeCompare(b.time)),
        opportunitySignals: signals,
        weeklyPreps: preps.sort((a, b) => (a.daysLeft || 0) - (b.daysLeft || 0)),
        kpiStats: { monthlyPremium }
    };
  }, [customers, contracts, appointments]);

  const executeAction = async (task: ScheduledTask) => {
      if (task.actionIcon === 'fa-gift') {
          window.open(`https://shopee.vn/search?keyword=quà tặng`, '_blank');
          return;
      }
      if (task.type === 'appointment') navigate(`/appointments`);
      if (task.type === 'signal' && task.customer) navigate(`/advisory/${task.customer.id}`);
      if (task.type === 'prep' && task.customer) navigate(`/customers/${task.customer.id}`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
        
        {/* BENTO GRID LAYOUT */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
            
            {/* 1. GREETING & HERO (Span 8) */}
            <div className="col-span-12 md:col-span-8 bg-gradient-to-br from-pru-red to-red-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden animate-fade-in group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/10 rounded-full -ml-10 -mb-10 blur-2xl"></div>
                
                <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                        <p className="text-red-100 font-bold uppercase tracking-widest text-xs mb-1">MDRT Journey 2024</p>
                        <h2 className="text-3xl md:text-4xl font-black mb-2 leading-tight">
                            Chào ngày mới, {agentProfile?.fullName.split(' ').pop()}! <span className="inline-block animate-float">🚀</span>
                        </h2>
                        <p className="text-red-50 opacity-90 max-w-lg">
                            Bạn đã đạt <strong>{(kpiStats.monthlyPremium / 1000000).toLocaleString()}tr</strong> doanh số tháng này. 
                            Hãy giữ vững phong độ để chinh phục mục tiêu MDRT!
                        </p>
                    </div>
                    
                    <div className="mt-8 flex gap-3">
                        <button onClick={() => navigate('/customers')} className="bg-white text-pru-red px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:bg-gray-50 transition active:scale-95 flex items-center gap-2">
                            <i className="fas fa-plus"></i> Khách hàng mới
                        </button>
                        <button onClick={() => navigate('/tools/finance')} className="bg-red-900/40 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-900/60 transition backdrop-blur-md border border-white/10 flex items-center gap-2">
                            <i className="fas fa-calculator"></i> Minh họa nhanh
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. STATS & KPI (Span 4) */}
            <div className="col-span-12 md:col-span-4 grid grid-rows-2 gap-6">
                {/* Active Contracts */}
                <div className="bg-white dark:bg-pru-card rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between hover:shadow-md transition animate-slide-up" style={{animationDelay: '0.1s'}}>
                    <div>
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center text-xl mb-2">
                            <i className="fas fa-file-contract"></i>
                        </div>
                        <p className="text-gray-400 text-xs font-bold uppercase">Hợp đồng Active</p>
                        <p className="text-2xl font-black text-gray-800 dark:text-white">{contracts.filter(c => c.status === ContractStatus.ACTIVE).length}</p>
                    </div>
                    <div className="h-16 w-16">
                        {/* Mini Sparkline Placeholder */}
                        <svg viewBox="0 0 100 100" className="w-full h-full text-blue-500 overflow-visible">
                            <path d="M0 80 Q 25 80 50 50 T 100 20" fill="none" stroke="currentColor" strokeWidth="4" className="drop-shadow-sm" />
                            <circle cx="100" cy="20" r="6" fill="currentColor" className="animate-pulse" />
                        </svg>
                    </div>
                </div>

                {/* Upcoming Tasks */}
                <div className="bg-white dark:bg-pru-card rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between hover:shadow-md transition animate-slide-up" style={{animationDelay: '0.2s'}}>
                    <div>
                        <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 flex items-center justify-center text-xl mb-2">
                            <i className="fas fa-calendar-check"></i>
                        </div>
                        <p className="text-gray-400 text-xs font-bold uppercase">Lịch hẹn hôm nay</p>
                        <p className="text-2xl font-black text-gray-800 dark:text-white">{fixedTasks.length}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-bold text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg">
                            +2 Mới
                        </span>
                    </div>
                </div>
            </div>

            {/* 3. TASK LIST (Span 4) */}
            <div className="col-span-12 md:col-span-4 bg-white dark:bg-pru-card rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col h-full animate-slide-up" style={{animationDelay: '0.3s'}}>
                <h3 className="font-bold text-gray-800 dark:text-white text-lg mb-4 flex items-center gap-2">
                    <i className="fas fa-tasks text-gray-400"></i> Việc cần làm
                </h3>
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {fixedTasks.length > 0 ? fixedTasks.map(task => (
                        <div key={task.id} className="group flex items-start gap-3 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
                            <div className="mt-1 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                            <div className="flex-1">
                                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{task.time} - {task.title}</p>
                                <p className="text-xs text-gray-500 line-clamp-1">{task.why}</p>
                            </div>
                            <button onClick={() => executeAction(task)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition">
                                <i className="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    )) : (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <i className="fas fa-mug-hot text-2xl mb-2 opacity-50"></i>
                            <p className="text-xs">Thảnh thơi! Chưa có lịch.</p>
                        </div>
                    )}
                </div>
                
                {/* Weekly Prep Footer */}
                {weeklyPreps.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Sắp tới</p>
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {weeklyPreps.map(p => (
                                <div key={p.id} onClick={() => executeAction(p)} className="flex-shrink-0 w-10 h-10 rounded-full bg-pink-50 dark:bg-pink-900/20 text-pink-500 flex items-center justify-center cursor-pointer hover:scale-110 transition border border-pink-100 dark:border-pink-800" title={p.title}>
                                    <i className={`fas ${p.actionIcon}`}></i>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 4. OPPORTUNITIES (Span 8) */}
            <div className="col-span-12 md:col-span-8 bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-center animate-slide-up" style={{animationDelay: '0.4s'}}>
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
                
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-xl flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></span>
                            Tín hiệu Khai thác
                        </h3>
                        <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm border border-white/10">
                            {opportunitySignals.length} cơ hội
                        </span>
                    </div>

                    {opportunitySignals.length > 0 ? (
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row gap-6 items-center">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 to-orange-500 flex items-center justify-center text-2xl shadow-lg text-white font-bold shrink-0">
                                {opportunitySignals[activeSignalIndex].score}
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h4 className="text-lg font-bold mb-1">{opportunitySignals[activeSignalIndex].title}</h4>
                                <p className="text-indigo-200 text-sm italic">"{opportunitySignals[activeSignalIndex].why}"</p>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <button onClick={() => setActiveSignalIndex((prev) => (prev + 1) % opportunitySignals.length)} className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition">
                                    <i className="fas fa-step-forward"></i>
                                </button>
                                <button onClick={() => executeAction(opportunitySignals[activeSignalIndex])} className="flex-1 md:flex-none px-6 py-3 bg-white text-indigo-900 rounded-xl font-bold shadow-lg hover:bg-indigo-50 transition flex items-center justify-center gap-2">
                                    Hành động ngay <i className="fas fa-arrow-right"></i>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-indigo-200">
                            <i className="fas fa-check-circle text-4xl mb-3 opacity-50"></i>
                            <p>Tuyệt vời! Bạn đã xử lý hết các tín hiệu nóng.</p>
                        </div>
                    )}
                </div>
            </div>

        </div>

        {/* AI Script Modal (Kept simple for now) */}
        {scriptModal.isOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-pru-card p-6 rounded-3xl max-w-md w-full">
                    <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">AI Script Generator</h3>
                    {scriptModal.isLoading ? <p>Đang viết...</p> : <p>Nội dung kịch bản...</p>}
                    <button onClick={() => setScriptModal({ ...scriptModal, isOpen: false })} className="mt-4 w-full bg-gray-200 py-2 rounded-xl font-bold text-gray-700">Đóng</button>
                </div>
            </div>
        )}
    </div>
  );
};

export default Dashboard;
