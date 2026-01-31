
import React, { useState, useMemo, useEffect } from 'react';
import { Appointment, Customer, AppointmentStatus, AppointmentType, Contract, AppointmentResult, ContractStatus, InteractionType, TimelineItem } from '../types';
import { ConfirmModal, SearchableCustomerSelect, formatDateVN } from '../components/Shared';
import { useLocation } from 'react-router-dom';

interface AppointmentsPageProps {
    appointments: Appointment[];
    customers: Customer[];
    contracts: Contract[];
    onAdd: (a: Appointment) => void;
    onUpdate: (a: Appointment) => void;
    onDelete: (id: string) => void;
    onUpdateCustomer: (c: Customer) => Promise<void>;
}

const AppointmentsPage: React.FC<AppointmentsPageProps> = ({ appointments, customers, contracts, onAdd, onUpdate, onDelete, onUpdateCustomer }) => {
    const location = useLocation();
    
    // --- STATE ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isMonthExpanded, setIsMonthExpanded] = useState(false);
    
    useEffect(() => {
        if (location.state && location.state.focusDate) {
            setSelectedDate(location.state.focusDate);
            setCurrentDate(new Date(location.state.focusDate));
            setIsMonthExpanded(false);
        }
    }, [location.state]);

    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string}>({ isOpen: false, id: '' });
    
    const [outcomeModal, setOutcomeModal] = useState<{isOpen: boolean, appointment: Appointment | null}>({isOpen: false, appointment: null});
    const [outcomeData, setOutcomeData] = useState<{result: AppointmentResult, note: string, followUpDate?: string}>({result: AppointmentResult.DONE, note: ''});

    const defaultForm: Appointment = {
        id: '', customerId: '', customerName: '', date: new Date().toISOString().split('T')[0], 
        time: '09:00', type: AppointmentType.CONSULTATION, status: AppointmentStatus.UPCOMING, note: ''
    };
    const [formData, setFormData] = useState<Appointment>(defaultForm);

    const dailyAppointments = useMemo(() => {
        return appointments.filter(a => a.date === selectedDate).sort((a,b) => a.time.localeCompare(b.time));
    }, [appointments, selectedDate]);

    const handleSave = () => {
        if(!formData.customerId) return alert("Vui lòng chọn khách hàng");
        isEditing ? onUpdate(formData) : onAdd(formData);
        setShowModal(false);
    };

    const handleEdit = (a: Appointment) => {
        setFormData(a);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDelete = (id: string) => {
        setDeleteConfirm({ isOpen: true, id });
    };

    const submitOutcome = async () => {
        const a = outcomeModal.appointment;
        if (a) {
            // 1. Update Appointment
            const updatedApp = {
                ...a,
                status: AppointmentStatus.COMPLETED,
                outcome: outcomeData.result,
                outcomeNote: outcomeData.note
            };
            onUpdate(updatedApp);

            // 2. Add to Customer Timeline
            const customer = customers.find(c => c.id === a.customerId);
            if (customer) {
                const newTimelineItem: TimelineItem = {
                    id: Date.now().toString(),
                    date: new Date().toISOString(),
                    type: InteractionType.MEETING,
                    title: `Cuộc hẹn hoàn thành: ${a.type}`,
                    content: `Kết quả: ${outcomeData.result}\nGhi chú: ${outcomeData.note}`,
                    result: outcomeData.result
                };
                await onUpdateCustomer({
                    ...customer,
                    timeline: [newTimelineItem, ...(customer.timeline || [])]
                });
            }

            // 3. Optional: Create follow-up appointment
            if (outcomeData.followUpDate) {
                onAdd({
                    ...defaultForm,
                    id: '',
                    customerId: a.customerId,
                    customerName: a.customerName,
                    date: outcomeData.followUpDate,
                    time: '09:00',
                    type: a.type,
                    note: `Theo dõi sau cuộc hẹn ngày ${formatDateVN(a.date)}. Ghi chú cũ: ${outcomeData.note}`
                });
            }

            setOutcomeModal({isOpen: false, appointment: null});
        }
    };

    const getTypeColor = (type: AppointmentType) => {
        switch(type) {
            case AppointmentType.CONSULTATION: return 'border-purple-500 text-purple-700 bg-purple-50';
            case AppointmentType.FEE_REMINDER: return 'border-orange-500 text-orange-700 bg-orange-50';
            case AppointmentType.BIRTHDAY: return 'border-pink-500 text-pink-700 bg-pink-50';
            default: return 'border-gray-300 text-gray-700 bg-gray-50';
        }
    };

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const startDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: startDayIndex }, (_, i) => i);

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-black relative">
            <div className="bg-white dark:bg-pru-card px-4 py-3 flex justify-between items-center shadow-sm border-b border-gray-100 dark:border-gray-800 flex-shrink-0 z-20">
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 text-gray-400 hover:text-gray-600"><i className="fas fa-chevron-left"></i></button>
                    <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 uppercase">Tháng {currentDate.getMonth() + 1}/{currentDate.getFullYear()}</h2>
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 text-gray-400 hover:text-gray-600"><i className="fas fa-chevron-right"></i></button>
                </div>
                <button onClick={() => { setFormData(defaultForm); setIsEditing(false); setShowModal(true); }} className="bg-pru-red text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 transition"><i className="fas fa-plus"></i></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* CALENDAR MINI GRID */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400 uppercase mb-2">
                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1 mb-8">
                    {blanks.map(x => <div key={`b-${x}`}></div>)}
                    {days.map(d => {
                        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const isSelected = selectedDate === dateStr;
                        const hasTasks = appointments.some(a => a.date === dateStr && a.status === AppointmentStatus.UPCOMING);
                        return (
                            <button key={d} onClick={() => setSelectedDate(dateStr)} className={`h-10 rounded-lg flex flex-col items-center justify-center relative transition ${isSelected ? 'bg-pru-red text-white shadow-md' : 'bg-white dark:bg-pru-card text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                <span className="text-xs font-bold">{d}</span>
                                {hasTasks && <div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-red-500'}`}></div>}
                            </button>
                        );
                    })}
                </div>

                {/* AGENDA LIST */}
                <div className="space-y-4">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest px-1">Lịch trình ngày {formatDateVN(selectedDate)}</h3>
                    {dailyAppointments.length > 0 ? (
                        dailyAppointments.map(a => (
                            <div key={a.id} className={`bg-white dark:bg-pru-card rounded-2xl p-4 shadow-sm border-l-4 ${getTypeColor(a.type)} ${a.status === AppointmentStatus.COMPLETED ? 'opacity-60 grayscale-[0.5]' : ''} group relative transition hover:shadow-md`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">{a.time} • {a.type}</p>
                                        <h4 className="font-black text-gray-800 dark:text-gray-100">{a.customerName}</h4>
                                    </div>
                                    {a.status === AppointmentStatus.COMPLETED ? (
                                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✅ {a.outcome}</span>
                                    ) : (
                                        <div className="flex gap-1">
                                            <button onClick={() => handleEdit(a)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-blue-500 flex items-center justify-center"><i className="fas fa-pen text-xs"></i></button>
                                            <button onClick={() => handleDelete(a.id)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-red-500 flex items-center justify-center"><i className="fas fa-trash text-xs"></i></button>
                                            <button onClick={() => setOutcomeModal({isOpen: true, appointment: a})} className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100"><i className="fas fa-check-double text-xs"></i></button>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 italic">"{a.note}"</p>
                                {a.outcomeNote && <p className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-[10px] text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-700">KQ: {a.outcomeNote}</p>}
                            </div>
                        ))
                    ) : (
                        <div className="py-10 text-center text-gray-400 text-sm italic">Không có công việc nào</div>
                    )}
                </div>
            </div>

            {/* OUTCOME MODAL */}
            {outcomeModal.isOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-[110] p-0 md:p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-pru-card rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 shadow-2xl overflow-hidden transition-colors">
                        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6 md:hidden"></div>
                        <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                            <i className="fas fa-clipboard-check text-green-500"></i> Ghi nhận kết quả cuộc hẹn
                        </h3>

                        <div className="space-y-6">
                            {/* Quick Tags */}
                            <div className="grid grid-cols-2 gap-2">
                                {Object.values(AppointmentResult).map(res => (
                                    <button 
                                        key={res}
                                        onClick={() => setOutcomeData({...outcomeData, result: res})}
                                        className={`py-2.5 px-3 rounded-xl text-[10px] font-bold border transition ${
                                            outcomeData.result === res 
                                            ? 'bg-pru-red text-white border-pru-red shadow-md' 
                                            : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-700'
                                        }`}
                                    >
                                        {res}
                                    </button>
                                ))}
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Ghi chú quan trọng</label>
                                <textarea 
                                    className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pru-red/20 text-gray-800 dark:text-gray-100"
                                    rows={3}
                                    placeholder="Ví dụ: Khách băn khoăn về phí, cần gửi thêm bảng minh họa gói cho con..."
                                    value={outcomeData.note}
                                    onChange={e => setOutcomeData({...outcomeData, note: e.target.value})}
                                />
                            </div>

                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-blue-800 dark:text-blue-300">Lên lịch chăm sóc tiếp theo?</p>
                                        <p className="text-[10px] text-blue-600 dark:text-blue-400">Tự động tạo lịch hẹn mới cho khách hàng này.</p>
                                    </div>
                                    <input 
                                        type="date" 
                                        className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-lg p-1.5 text-xs text-blue-700 dark:text-blue-300 outline-none"
                                        value={outcomeData.followUpDate || ''}
                                        onChange={e => setOutcomeData({...outcomeData, followUpDate: e.target.value})}
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 mt-8">
                            <button onClick={submitOutcome} className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition">Xác nhận & Lưu</button>
                            <button onClick={() => setOutcomeModal({isOpen: false, appointment: null})} className="w-full py-2 text-gray-400 dark:text-gray-500 font-bold text-xs">Quay lại</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD/EDIT MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-pru-card rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-gray-100 dark:border-gray-700 transition-colors">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{isEditing ? 'Cập nhật' : 'Thêm'} lịch hẹn</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times"></i></button>
                        </div>
                        
                        <div className="space-y-4">
                            <SearchableCustomerSelect 
                                customers={customers} 
                                value={formData.customerName} 
                                onChange={c => setFormData({...formData, customerId: c.id, customerName: c.fullName})}
                                label="Khách hàng"
                            />
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label-text">Ngày</label>
                                    <input 
                                        type="date" 
                                        className="input-field py-2" 
                                        value={formData.date} 
                                        onChange={e => setFormData({...formData, date: e.target.value})} 
                                    />
                                </div>
                                <div>
                                    <label className="label-text">Giờ</label>
                                    <input 
                                        type="time" 
                                        className="input-field py-2" 
                                        value={formData.time} 
                                        onChange={e => setFormData({...formData, time: e.target.value})} 
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label-text">Mục đích</label>
                                <select 
                                    className="input-field py-2" 
                                    value={formData.type} 
                                    onChange={e => setFormData({...formData, type: e.target.value as AppointmentType})}
                                >
                                    {Object.values(AppointmentType).map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label-text">Ghi chú</label>
                                <textarea 
                                    className="input-field min-h-[80px]" 
                                    rows={3} 
                                    placeholder="Nội dung chi tiết..."
                                    value={formData.note}
                                    onChange={e => setFormData({...formData, note: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-sm">Hủy</button>
                            <button onClick={handleSave} className="flex-1 py-3 bg-pru-red text-white rounded-xl font-bold text-sm hover:bg-red-700 transition shadow-md">Lưu</button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal 
                isOpen={deleteConfirm.isOpen} 
                title="Xóa lịch hẹn?" 
                message="Bạn có chắc chắn muốn xóa lịch hẹn này không?" 
                onConfirm={() => onDelete(deleteConfirm.id)} 
                onClose={() => setDeleteConfirm({ isOpen: false, id: '' })} 
            />

            <style>{`
                .label-text { display: block; font-size: 0.7rem; font-weight: 700; color: #6b7280; margin-bottom: 0.25rem; text-transform: uppercase; }
                .dark .label-text { color: #9ca3af; }
                .input-field { width: 100%; border: 1px solid #e5e7eb; padding: 0.5rem; border-radius: 0.5rem; outline: none; font-size: 0.875rem; transition: all; background-color: #fff; color: #111827; }
                .dark .input-field { background-color: #111827; border-color: #374151; color: #f3f4f6; }
                .input-field:focus { border-color: #ed1b2e; ring: 1px solid #ed1b2e; }
            `}</style>
        </div>
    );
};

export default AppointmentsPage;
