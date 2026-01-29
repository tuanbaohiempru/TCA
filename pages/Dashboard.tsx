
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppState, ContractStatus, CustomerStatus, Contract, Customer, InteractionType, Appointment, AppointmentStatus, AppointmentType, AppointmentResult, TimelineItem } from '../types';
import { generateActionScript } from '../services/geminiService';
import { formatDateVN } from '../components/Shared';

interface DashboardProps {
  state: AppState;
  onUpdateContract: (c: Contract) => void;
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
  
  const [isBriefingOpen, setIsBriefingOpen] = useState(true);
  const [activeSignalIndex, setActiveSignalIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);

  const [scriptModal, setScriptModal] = useState<{ isOpen: boolean; isLoading: boolean; task: ScheduledTask | null; script: any | null; }>({ 
      isOpen: false, isLoading: false, task: null, script: null 
  });

  const { fixedTasks, opportunitySignals, weeklyPreps } = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const next10Days = new Date();
    next10Days.setDate(today.getDate() + 10);
    
    const fixed: ScheduledTask[] = [];
    const signals: ScheduledTask[] = [];
    const preps: ScheduledTask[] = [];

    // 1. FIXED APPOINTMENTS (Today)
    appointments.filter(a => a.date === todayStr).forEach(app => {
        const cus = customers.find(c => c.id === app.customerId);
        fixed.push({
            id: app.id, time: app.time, type: 'appointment', category: 'Lịch hẹn', priority: 'high', score: 100,
            title: `Gặp mặt: ${app.customerName}`, why: app.note || 'Lịch hẹn trong ngày',
            actionLabel: 'Ghi kết quả', actionIcon: 'fa-clipboard-check', 
            customer: cus || null, status: app.status
        });
    });

    // 2. SCAN FOR WEEKLY PREPARATION (Birthdays, Anniversaries, Payments)
    customers.forEach(cus => {
        // Birthday Scan
        if (cus.dob) {
            const dob = new Date(cus.dob);
            const nextBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
            if (nextBday < today) nextBday.setFullYear(today.getFullYear() + 1);
            
            const diffTime = nextBday.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 10) {
                preps.push({
                    id: `prep-bday-${cus.id}`, time: '08:00', type: 'prep', category: 'BIRTHDAY', priority: diffDays <= 3 ? 'high' : 'medium',
                    score: 0, title: `Sinh nhật: ${cus.fullName}`, why: diffDays === 0 ? 'HÔM NAY!' : `Cần chuẩn bị quà (Còn ${diffDays} ngày)`,
                    actionLabel: '🛒 Đặt quà ngay', actionIcon: 'fa-gift', customer: cus, status: AppointmentStatus.UPCOMING, daysLeft: diffDays
                });
            }
        }

        // Contract Anniversaries & Next Payment
        const cusContracts = contracts.filter(c => c.customerId === cus.id && c.status === ContractStatus.ACTIVE);
        cusContracts.forEach(ct => {
            // Anniversary
            const eff = new Date(ct.effectiveDate);
            const nextAnniv = new Date(today.getFullYear(), eff.getMonth(), eff.getDate());
            if (nextAnniv < today) nextAnniv.setFullYear(today.getFullYear() + 1);
            
            const annivDiff = Math.ceil((nextAnniv.getTime() - today.getTime()) / (1000 * 3600 * 24));
            if (annivDiff <= 10 && annivDiff >= 0) {
                preps.push({
                    id: `prep-anniv-${ct.id}`, time: '08:30', type: 'prep', category: 'ANNIVERSARY', priority: 'medium',
                    score: 0, title: `Kỷ niệm HĐ: ${ct.contractNumber}`, why: `${cus.fullName} đã đồng hành ${today.getFullYear() - eff.getFullYear()} năm.`,
                    actionLabel: '📜 Tri ân KH', actionIcon: 'fa-award', customer: cus, status: AppointmentStatus.UPCOMING, daysLeft: annivDiff
                });
            }

            // Next Payment Date
            const nextPay = new Date(ct.nextPaymentDate);
            const payDiff = Math.ceil((nextPay.getTime() - today.getTime()) / (1000 * 3600 * 24));
            if (payDiff <= 10 && payDiff >= 0) {
                preps.push({
                    id: `prep-pay-${ct.id}`, time: '09:00', type: 'prep', category: 'PAYMENT', priority: payDiff <= 3 ? 'urgent' : 'high',
                    score: 0, title: `Đóng phí: ${cus.fullName}`, why: `Hạn ${formatDateVN(ct.nextPaymentDate)} (${ct.totalFee.toLocaleString()} đ)`,
                    actionLabel: '📲 Nhắc phí tinh tế', actionIcon: 'fa-paper-plane', customer: cus, status: AppointmentStatus.UPCOMING, daysLeft: payDiff
                });
            }
        });
    });

    // 3. SCAN FOR OPPORTUNITIES
    customers.forEach(cus => {
        const cusContracts = contracts.filter(c => c.customerId === cus.id && c.status === ContractStatus.ACTIVE);
        const annualIncome = (cus.analysis?.incomeMonthly || 0) * 12;
        const totalSA = cusContracts.reduce((sum, c) => sum + (c.mainProduct?.sumAssured || 0), 0);
        
        const lastTimelineDate = cus.timeline?.[0] ? new Date(cus.timeline[0].date) : new Date(0);
        const daysSinceLastContact = Math.ceil((today.getTime() - lastTimelineDate.getTime()) / (1000 * 3600 * 24));
        
        if (annualIncome > 0 && totalSA < annualIncome * 10) {
            const gap = (annualIncome * 10) - totalSA;
            const gapScore = Math.min(50, Math.floor(gap / 100000000));
            const warmthScore = daysSinceLastContact <= 30 ? 20 : daysSinceLastContact <= 90 ? 10 : 0;
            
            signals.push({
                id: `upsell-${cus.id}`, time: '09:00', type: 'signal', category: 'UPSIZE', priority: 'medium',
                score: 30 + gapScore + warmthScore,
                title: `Tư vấn gia tăng cho ${cus.fullName.split(' ').pop()}`, 
                why: `Thiếu ${(gap/1e9).toFixed(1)} Tỷ dự phòng. Khách đang ấm!`,
                actionLabel: '🪄 Soạn kịch bản AI', actionIcon: 'fa-magic', customer: cus,
                status: AppointmentStatus.UPCOMING
            });
        }
    });

    return { 
        fixedTasks: fixed.sort((a, b) => a.time.localeCompare(b.time)),
        opportunitySignals: signals.sort((a, b) => b.score - a.score),
        weeklyPreps: preps.sort((a, b) => (a.daysLeft || 0) - (b.daysLeft || 0))
    };
  }, [customers, contracts, appointments]);

  const handleNextSignal = () => {
      setIsFlipping(true);
      setTimeout(() => {
          setActiveSignalIndex((prev) => (prev + 1) % opportunitySignals.length);
          setIsFlipping(false);
      }, 200);
  };

  const executeAction = async (task: ScheduledTask) => {
      if (task.actionIcon === 'fa-gift') {
          window.open(`https://shopee.vn/search?keyword=quà tặng ${task.category === 'BIRTHDAY' ? 'sinh nhật' : 'tri ân'} cao cấp`, '_blank');
          return;
      }
      if (task.actionIcon === 'fa-magic') {
          setScriptModal({ isOpen: true, isLoading: true, task, script: null });
          try {
              const script = await generateActionScript({
                  title: task.title,
                  why: task.why,
                  category: task.category
              }, task.customer);
              setScriptModal(prev => ({ ...prev, isLoading: false, script }));
          } catch (e) {
              setScriptModal(prev => ({ ...prev, isLoading: false }));
          }
          return;
      }
      if (task.type === 'appointment') navigate(`/appointments`, { state: { focusDate: todayStr } });
      if (task.type === 'prep' && task.customer) navigate(`/customers/${task.customer.id}`);
  };

  const currentSignal = opportunitySignals[activeSignalIndex];
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 pb-32 animate-fade-in max-w-4xl mx-auto">
      
      {/* 1. MORNING BRIEFING */}
      {isBriefingOpen && (
          <div className="bg-gradient-to-br from-pru-red to-red-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
              <div className="relative z-10 flex justify-between items-start">
                  <div>
                      <h2 className="text-2xl font-black italic">Chào sáng nay, {agentProfile?.fullName.split(' ').pop()}! 🎯</h2>
                      <p className="text-white/80 text-sm mt-1">Hôm nay có {fixedTasks.length} lịch hẹn và {weeklyPreps.length} sự kiện cần chuẩn bị sớm.</p>
                  </div>
                  <button onClick={() => setIsBriefingOpen(false)} className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/30 transition"><i className="fas fa-times"></i></button>
              </div>
          </div>
      )}

      {/* 2. WEEKLY PREPARATION (New Section) */}
      {weeklyPreps.length > 0 && (
          <div className="space-y-4 px-2">
               <h3 className="text-[11px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-bolt"></i> TRẠM CHUẨN BỊ TUẦN TỚI
               </h3>
               <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                    {weeklyPreps.map((prep) => (
                        <div key={prep.id} className="min-w-[280px] bg-white dark:bg-pru-card p-5 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                                        prep.category === 'BIRTHDAY' ? 'bg-pink-100 text-pink-600' : 
                                        prep.category === 'PAYMENT' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                                    }`}>
                                        {prep.category}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400">
                                        {prep.daysLeft === 0 ? 'Hôm nay' : `Còn ${prep.daysLeft} ngày`}
                                    </span>
                                </div>
                                <h4 className="font-black text-gray-800 dark:text-gray-100 text-sm mb-1">{prep.title}</h4>
                                <p className="text-[11px] text-gray-500 line-clamp-2 italic">"{prep.why}"</p>
                            </div>
                            <button 
                                onClick={() => executeAction(prep)}
                                className="mt-4 w-full py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-[10px] font-black transition flex items-center justify-center gap-2"
                            >
                                <i className={`fas ${prep.actionIcon}`}></i> {prep.actionLabel}
                            </button>
                        </div>
                    ))}
               </div>
          </div>
      )}

      {/* 3. OPPORTUNITY STATION (Carousel) */}
      {opportunitySignals.length > 0 && (
          <div className="space-y-4 px-2">
               <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span> CƠ HỘI KHAI PHÁ
                    </h3>
                    <button onClick={handleNextSignal} className="text-[10px] font-bold text-gray-400 hover:text-indigo-500">Tiếp theo <i className="fas fa-chevron-right ml-1"></i></button>
               </div>
               <div className={`transition-all duration-300 transform ${isFlipping ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                    <div className="bg-white dark:bg-pru-card p-6 rounded-3xl shadow-xl border-t-8 border-indigo-500 relative">
                        <h4 className="text-xl font-black text-gray-800 dark:text-gray-100 mb-2">{currentSignal.title}</h4>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 italic mb-6 border-l-2 border-indigo-100 pl-4">"{currentSignal.why}"</p>
                        <button onClick={() => executeAction(currentSignal)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 transition active:scale-95"><i className="fas fa-wand-magic-sparkles"></i> {currentSignal.actionLabel}</button>
                    </div>
               </div>
          </div>
      )}

      {/* 4. FIXED SCHEDULE */}
      <div className="space-y-4 px-2">
          <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <i className="fas fa-calendar-alt text-pru-red"></i> LỊCH TRÌNH CỐ ĐỊNH (HÔM NAY)
          </h3>
          <div className="space-y-3">
              {fixedTasks.length > 0 ? (
                  fixedTasks.map((task) => (
                      <div key={task.id} className="flex gap-4 group">
                          <div className="w-16 pt-2 shrink-0 text-center">
                               <span className="text-[10px] font-black text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm border border-gray-100 dark:border-gray-700">{task.time}</span>
                          </div>
                          <div className="flex-1 bg-white dark:bg-pru-card p-4 rounded-2xl shadow-sm border-l-4 border-pru-red hover:shadow-md transition">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <h4 className="font-black text-gray-800 dark:text-gray-100 text-sm">{task.title}</h4>
                                      <p className="text-[10px] text-gray-400 mt-0.5">{task.why}</p>
                                  </div>
                                  <button onClick={() => executeAction(task)} className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center transition hover:bg-pru-red hover:text-white">
                                      <i className={`fas ${task.actionIcon} text-xs`}></i>
                                  </button>
                              </div>
                          </div>
                      </div>
                  ))
              ) : (
                  <div className="py-10 text-center bg-white/30 dark:bg-pru-card/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                      <p className="text-xs text-gray-400">Hôm nay không có lịch hẹn nào.</p>
                  </div>
              )}
          </div>
      </div>

      {/* AI SCRIPT MODAL */}
      {scriptModal.isOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center z-[150] p-0 md:p-4 backdrop-blur-md animate-fade-in">
              <div className="bg-white dark:bg-pru-card rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 shadow-2xl overflow-hidden">
                  <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2"><i className="fas fa-wand-magic-sparkles text-purple-500"></i> Kịch bản MDRT cá nhân hóa</h3>
                  {scriptModal.isLoading ? (
                      <div className="py-10 flex flex-col items-center gap-4"><div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div><p className="text-sm font-bold text-gray-500">AI đang phân tích Timeline...</p></div>
                  ) : scriptModal.script ? (
                      <div className="space-y-4 animate-slide-up">
                          <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-800"><label className="text-[10px] font-black uppercase text-purple-600 mb-1 block">Mở lời (Hook)</label><p className="text-sm text-gray-800 dark:text-gray-200 italic">"{scriptModal.script.opening}"</p></div>
                          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl"><label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Nội dung</label><p className="text-sm text-gray-700 dark:text-gray-300">{scriptModal.script.core_message}</p></div>
                          <div className="flex gap-2 pt-4">
                              <button onClick={() => { navigator.clipboard.writeText(`${scriptModal.script.opening}\n\n${scriptModal.script.core_message}`); if (scriptModal.task?.customer) window.open(`https://zalo.me/${scriptModal.task.customer.phone.replace(/\D/g, '')}`, '_blank'); }} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm transition">Gửi qua Zalo</button>
                              <button onClick={() => setScriptModal({ isOpen: false, isLoading: false, task: null, script: null })} className="px-6 py-4 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-2xl font-bold text-sm">Đóng</button>
                          </div>
                      </div>
                  ) : <p className="text-center text-red-500 py-4">Lỗi tải kịch bản.</p>}
              </div>
          </div>
      )}

      <style>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          .animate-fade-in { animation: fadeIn 0.4s ease-out both; }
          .animate-slide-up { animation: slideUp 0.3s ease-out both; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default Dashboard;
