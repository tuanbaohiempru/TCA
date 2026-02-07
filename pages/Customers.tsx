
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Customer, Contract, Appointment, CustomerStatus, Gender, MaritalStatus, FinancialRole, IncomeTrend, RiskTolerance, FinancialPriority, RelationshipType, Illustration, FinancialStatus, PersonalityType, ReadinessLevel, AssetType, LiabilityType, FinancialAsset, FinancialLiability } from '../types';
import { ConfirmModal, formatDateVN } from '../components/Shared';
import ExcelImportModal from '../components/ExcelImportModal';
import { downloadTemplate, processCustomerImport } from '../utils/excelHelpers';
import { extractIdentityCard } from '../services/geminiService';

interface CustomersPageProps {
    customers: Customer[];
    contracts: Contract[];
    appointments?: Appointment[]; 
    illustrations?: Illustration[]; 
    onAdd: (c: Customer) => Promise<void>;
    onUpdate: (c: Customer) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onConvertIllustration?: (ill: Illustration, customerId: string) => Promise<void>; 
    onDeleteIllustration?: (id: string) => Promise<void>;
}

const CustomersPage: React.FC<CustomersPageProps> = ({ customers, contracts, appointments = [], illustrations = [], onAdd, onUpdate, onDelete, onConvertIllustration, onDeleteIllustration }) => {
    const navigate = useNavigate();
    const location = useLocation(); 
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    
    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false); 
    const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string, name: string}>({ isOpen: false, id: '', name: '' });
    const [isSaving, setIsSaving] = useState(false); 
    
    // Scan ID State
    const [isScanning, setIsScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Empty Customer Template
    const defaultCustomer: Customer = {
        id: '',
        fullName: '',
        gender: Gender.MALE,
        dob: '',
        phone: '',
        idCard: '',
        job: '',
        occupation: '', 
        companyAddress: '',
        maritalStatus: MaritalStatus.MARRIED,
        financialRole: FinancialRole.MAIN_BREADWINNER,
        dependents: 0,
        status: CustomerStatus.POTENTIAL,
        interactionHistory: [],
        timeline: [],
        claims: [],
        relationships: [],
        documents: [], 
        health: { medicalHistory: '', height: 165, weight: 60, habits: '' },
        analysis: {
            incomeMonthly: 0,
            incomeTrend: IncomeTrend.STABLE,
            projectedIncome3Years: 0,
            monthlyExpenses: 0,
            existingInsurance: {
                hasLife: false, lifeSumAssured: 0, lifeFee: 0, lifeTermRemaining: 0,
                hasAccident: false, accidentSumAssured: 0,
                hasCI: false, ciSumAssured: 0,
                hasHealthCare: false, healthCareFee: 0,
                dissatisfaction: ''
            },
            currentPriority: FinancialPriority.PROTECTION,
            futurePlans: '',
            biggestWorry: '',
            pastExperience: '',
            influencer: '',
            buyCondition: '',
            preference: 'Balanced',
            riskTolerance: RiskTolerance.MEDIUM,
            childrenCount: 0,
            financialStatus: FinancialStatus.STABLE,
            personality: PersonalityType.ANALYTICAL,
            readiness: ReadinessLevel.COLD
        }
    };
    const [formData, setFormData] = useState<Customer>(defaultCustomer);

    useEffect(() => {
        if (location.state && location.state.triggerScan) {
            window.history.replaceState({}, document.title);
            fileInputRef.current?.click();
        }
    }, [location]);

    const filteredCustomers = customers.filter(c => {
        const matchesSearch = c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              c.phone.includes(searchTerm) || 
                              (c.idCard && c.idCard.includes(searchTerm));
        const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const checkDuplicate = (customer: Customer): string | null => {
        const normalize = (str: any) => String(str || '').replace(/[\s\.\-]/g, '').toLowerCase();
        const newPhone = normalize(customer.phone);
        const newIdCard = normalize(customer.idCard);

        const duplicate = customers.find(c => {
            if (customer.id && c.id === customer.id) return false;
            const existPhone = normalize(c.phone);
            const existIdCard = normalize(c.idCard);
            if (newPhone && newPhone.length > 5 && existPhone === newPhone) return true;
            if (newIdCard && newIdCard.length > 6 && existIdCard === newIdCard) return true;
            return false;
        });

        if (duplicate) {
            return `Trùng lặp dữ liệu! Khách hàng "${duplicate.fullName}" đã tồn tại với SĐT hoặc CCCD này.`;
        }
        return null;
    };

    const handleOpenAdd = () => {
        setFormData(defaultCustomer);
        setShowModal(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (!formData.fullName) throw new Error("Vui lòng nhập Họ tên khách hàng");
            const duplicateError = checkDuplicate(formData);
            if (duplicateError) {
                throw new Error(duplicateError);
            }
            const customerToSave = {
                ...formData,
                id: formData.id || Date.now().toString()
            };
            await onAdd(customerToSave);
            setShowModal(false);
        } catch (e: any) {
            console.error(e);
            alert(`LỖI: ${e.message || "Không thể lưu khách hàng."}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = (c: Customer) => {
        const relatedContracts = contracts.filter(ct => ct.customerId === c.id);
        const relatedApps = appointments.filter(a => a.customerId === c.id);

        if (relatedContracts.length > 0) {
            alert(`KHÔNG THỂ XÓA!\nKhách hàng ${c.fullName} đang đứng tên ${relatedContracts.length} Hợp đồng.\nVui lòng xóa hoặc chuyển đổi hợp đồng trước.`);
            return;
        }

        if (relatedApps.length > 0) {
            const confirmApp = window.confirm(`CẢNH BÁO: Khách hàng này có ${relatedApps.length} lịch hẹn/công việc liên quan. Nếu xóa khách hàng, các lịch hẹn này có thể bị lỗi hiển thị. Bạn có chắc chắn muốn tiếp tục?`);
            if (!confirmApp) return;
        }

        setDeleteConfirm({isOpen: true, id: c.id, name: c.fullName});
    };

    const getActiveContractCount = (customerId: string) => {
        return contracts.filter(c => c.customerId === customerId && c.status === 'Đang hiệu lực').length;
    };

    const handleBatchSave = async (validCustomers: Customer[]) => { 
        const uniqueOnes = [];
        for (const c of validCustomers) {
            if (!checkDuplicate(c)) {
                uniqueOnes.push({ ...c, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) });
            }
        }
        if (uniqueOnes.length < validCustomers.length) {
            alert(`Đã bỏ qua ${validCustomers.length - uniqueOnes.length} khách hàng do trùng lặp dữ liệu.`);
        }
        await Promise.all(uniqueOnes.map(c => onAdd(c))); 
    };

    const handleScanIdCard = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = reader.result as string;
                const base64Content = base64String.split(',')[1];
                const extractedData = await extractIdentityCard(base64Content);
                if (extractedData) {
                    setFormData({
                        ...defaultCustomer,
                        fullName: extractedData.fullName || '',
                        idCard: extractedData.idCard || '',
                        dob: extractedData.dob || '',
                        gender: (extractedData.gender as Gender) || Gender.OTHER,
                        companyAddress: extractedData.companyAddress || '',
                        interactionHistory: [`Quét CCCD: ${new Date().toLocaleDateString('vi-VN')}`]
                    });
                    setShowModal(true); 
                } else {
                    alert("Không thể đọc thông tin từ ảnh này. Vui lòng thử lại hoặc nhập tay.");
                }
                setIsScanning(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Scan Error", error);
            alert("Lỗi xử lý ảnh: " + error);
            setIsScanning(false);
        } finally {
            e.target.value = ''; 
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-black text-gray-800 dark:text-gray-100 tracking-tight">Quản lý Khách hàng</h1>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <button onClick={() => setShowImportModal(true)} className="hidden md:flex bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition font-bold items-center whitespace-nowrap text-sm shadow-sm"><i className="fas fa-file-excel mr-2 text-green-600"></i>Nhập Excel</button>
                    
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isScanning}
                        className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition font-bold flex items-center whitespace-nowrap text-sm disabled:opacity-70 shadow-sm"
                    >
                        {isScanning ? <i className="fas fa-spinner fa-spin mr-2 text-blue-500"></i> : <i className="fas fa-camera mr-2 text-blue-500"></i>}
                        {isScanning ? 'Đang đọc...' : 'Quét CCCD'}
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleScanIdCard} />

                    <button onClick={handleOpenAdd} className="bg-gradient-to-r from-pru-red to-red-600 text-white px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-red-500/30 transition font-bold flex items-center whitespace-nowrap text-sm"><i className="fas fa-user-plus mr-2"></i>Thêm mới</button>
                </div>
            </div>
            
            <div className="bg-white dark:bg-pru-card p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row gap-4 items-center transition-colors">
                <div className="relative w-full md:w-1/3 group">
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-pru-red transition-colors"></i>
                    <input className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-pru-red/20 focus:border-pru-red outline-none bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-all" placeholder="Tìm tên, SĐT, CCCD..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto scrollbar-hide">
                    <button onClick={() => setFilterStatus('all')} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${filterStatus === 'all' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'}`}>Tất cả</button>
                    {Object.values(CustomerStatus).map(s => (
                        <button key={s} onClick={() => setFilterStatus(s)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${filterStatus === s ? 'bg-red-50 text-pru-red border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'}`}>{s}</button>
                    ))}
                </div>
            </div>

            {/* Grid List - CARD REDESIGN */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredCustomers.map(c => {
                    const contractCount = getActiveContractCount(c.id);
                    // FIX: Accessed financialStatus correctly via c.analysis.financialStatus
                    const isVIP = c.analysis?.financialStatus === FinancialStatus.WEALTHY || contractCount >= 3;
                    
                    return (
                        <div 
                            key={c.id} 
                            onClick={() => navigate(`/customers/${c.id}`)} 
                            className="bg-white dark:bg-pru-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-black/50 transition-all duration-300 transform hover:-translate-y-1 group relative overflow-hidden flex flex-col h-full cursor-pointer"
                        >
                            {/* Card Status Strip */}
                            <div className={`h-1.5 w-full ${c.status === CustomerStatus.SIGNED ? 'bg-green-500' : 'bg-yellow-400'}`}></div>
                            
                            {/* VIP Badge */}
                            {isVIP && (
                                <div className="absolute top-3 right-3">
                                    <span className="relative flex h-3 w-3">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                                    </span>
                                </div>
                            )}

                            <div className="p-5 flex-1">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className={`w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center text-xl font-black text-white shadow-md ${c.gender === Gender.FEMALE ? 'bg-gradient-to-br from-pink-400 to-pink-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'}`}>
                                        {c.fullName.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg truncate group-hover:text-pru-red transition-colors">{c.fullName}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.job || c.occupation || 'Nghề nghiệp: --'}</p>
                                        <div className="flex items-center gap-1 mt-1">
                                            {contractCount > 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">{contractCount} HĐ</span>}
                                            <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">{c.status}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2.5">
                                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg">
                                        <div className="w-6 flex justify-center text-gray-400"><i className="fas fa-phone-alt text-xs"></i></div>
                                        <span className="font-medium">{c.phone || '---'}</span>
                                    </div>
                                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg">
                                        <div className="w-6 flex justify-center text-gray-400"><i className="fas fa-coins text-xs"></i></div>
                                        <span className="font-medium">{c.analysis.incomeMonthly > 0 ? `${(c.analysis.incomeMonthly/1000000).toLocaleString()} Tr/tháng` : 'Chưa có TN'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions (Glassmorphism) */}
                            <div className="grid grid-cols-4 border-t border-gray-100 dark:border-gray-800 divide-x divide-gray-100 dark:divide-gray-800 bg-gray-50/50 dark:bg-gray-800/30 backdrop-blur-sm">
                                <button onClick={(e) => { e.stopPropagation(); window.open(`tel:${c.phone}`) }} className="py-3 hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-400 hover:text-green-600 transition flex justify-center items-center" title="Gọi điện">
                                    <i className="fas fa-phone-alt"></i>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); window.open(`https://zalo.me/${c.phone.replace(/\D/g,'')}`) }} className="py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600 transition flex justify-center items-center" title="Chat Zalo">
                                    <span className="font-black font-sans text-sm">Z</span>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); navigate(`/advisory/${c.id}`); }} className="py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-400 hover:text-purple-600 transition flex justify-center items-center" title="AI Roleplay">
                                    <i className="fas fa-robot"></i>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(c); }} className="py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition flex justify-center items-center" title="Xóa">
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Quick Add Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white dark:bg-pru-card rounded-3xl max-w-lg w-full p-6 shadow-2xl flex flex-col transition-colors border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                            <h3 className="text-xl font-black text-gray-800 dark:text-gray-100">Thêm Khách Hàng Nhanh</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><i className="fas fa-times text-xl"></i></button>
                        </div>
                        
                        {formData.interactionHistory[0]?.includes("Quét CCCD") && (
                            <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-4 rounded-xl text-sm mb-6 flex items-start border border-green-200 dark:border-green-800">
                                <i className="fas fa-check-circle mr-3 text-lg mt-0.5"></i>
                                <span>Đã trích xuất thông tin từ CCCD. Vui lòng kiểm tra lại độ chính xác trước khi lưu.</span>
                            </div>
                        )}

                        <div className="space-y-4 mb-8">
                            <div><label className="label-text">Họ và tên <span className="text-red-500">*</span></label><input className="input-field" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} placeholder="Nguyễn Văn A" /></div>
                            <div>
                                <label className="label-text">Số điện thoại</label>
                                <input className="input-field" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="09xxxxxxx" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label-text">Giới tính</label><select className="input-field" value={formData.gender} onChange={(e: any) => setFormData({...formData, gender: e.target.value})}>{Object.values(Gender).map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                                <div><label className="label-text">Ngày sinh</label><input type="date" className="input-field" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} /></div>
                            </div>
                            <div><label className="label-text">Số CCCD</label><input className="input-field" value={formData.idCard} onChange={e => setFormData({...formData, idCard: e.target.value})} /></div>
                            <div><label className="label-text">Địa chỉ</label><input className="input-field" value={formData.companyAddress} onChange={e => setFormData({...formData, companyAddress: e.target.value})} /></div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-5 py-3 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition">Hủy</button>
                            <button onClick={handleSave} disabled={isSaving} className="px-6 py-3 bg-pru-red text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/30 flex items-center disabled:opacity-50 transition transform active:scale-95">
                                {isSaving ? <><i className="fas fa-spinner fa-spin mr-2"></i> Đang lưu...</> : 'Lưu Hồ Sơ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <ConfirmModal isOpen={deleteConfirm.isOpen} title="Xóa khách hàng?" message={`Bạn có chắc muốn xóa khách hàng ${deleteConfirm.name}? Hành động này không thể hoàn tác.`} onConfirm={() => onDelete(deleteConfirm.id)} onClose={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })} />
            <ExcelImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title="Nhập Khách Hàng từ Excel" onDownloadTemplate={() => downloadTemplate('customer')} onProcessFile={(file) => processCustomerImport(file, customers)} onSave={handleBatchSave} />

            <style>{`
                .input-field { width: 100%; border: 1px solid #e5e7eb; padding: 0.75rem; border-radius: 0.75rem; outline: none; font-size: 0.875rem; transition: all; background-color: #f9fafb; color: #111827; }
                .dark .input-field { background-color: #111827; border-color: #374151; color: #f3f4f6; }
                .input-field:focus { border-color: #ed1b2e; background-color: #fff; ring: 2px solid rgba(237, 27, 46, 0.1); }
                .dark .input-field:focus { background-color: #000; }
                .label-text { display: block; font-size: 0.75rem; font-weight: 700; color: #6b7280; margin-bottom: 0.35rem; text-transform: uppercase; letter-spacing: 0.025em; }
                .dark .label-text { color: #9ca3af; }
            `}</style>
        </div>
    );
};

export default CustomersPage;
