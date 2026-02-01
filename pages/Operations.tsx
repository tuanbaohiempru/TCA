
import React, { useState, useMemo } from 'react';
import { getObjectionSuggestions, checkPreUnderwriting, analyzeClaimSupport } from '../services/geminiService';
import { Customer, Contract, Product, ContractStatus } from '../types';
import { SearchableCustomerSelect, formatDateVN } from '../components/Shared';

interface OperationsPageProps {
    customers?: Customer[];
    contracts?: Contract[];
    products?: Product[];
}

const OperationsPage: React.FC<OperationsPageProps> = ({ customers = [], contracts = [], products = [] }) => {
    const [activeTab, setActiveTab] = useState<'claims' | 'smart_claim' | 'objections' | 'underwriting'>('smart_claim');

    // --- OBJECTION HANDLING STATES ---
    const [objectionMode, setObjectionMode] = useState<'solve' | 'practice'>('solve');
    const [userObjection, setUserObjection] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
    const [currentCard, setCurrentCard] = useState('');
    const [showAnswer, setShowAnswer] = useState(false);
    const [practiceAnswer, setPracticeAnswer] = useState('');

    // --- PRE-UNDERWRITING STATES ---
    const [medicalCondition, setMedicalCondition] = useState('');
    const [uwResult, setUwResult] = useState<any>(null);
    const [isCheckingUw, setIsCheckingUw] = useState(false);

    // --- SMART CLAIM STATES (NEW) ---
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [selectedContractId, setSelectedContractId] = useState<string>('');
    const [claimEvent, setClaimEvent] = useState('');
    const [claimResult, setClaimResult] = useState<any>(null);
    const [isAnalyzingClaim, setIsAnalyzingClaim] = useState(false);
    const [showClaimForm, setShowClaimForm] = useState(false); // Modal preview form

    // Filter contracts based on selected customer
    const availableContracts = useMemo(() => {
        if (!selectedCustomer) return [];
        return contracts.filter(c => c.customerId === selectedCustomer.id);
    }, [selectedCustomer, contracts]);

    const practiceQuestions = [
        "Bảo hiểm lừa đảo lắm, anh không tin đâu.",
        "Tiền mất giá, 20 năm nữa nhận về chẳng mua được bát phở.",
        "Để anh về hỏi vợ đã, vợ giữ hết tiền.",
        "Anh đang khỏe mạnh, cần gì bảo hiểm.",
        "Lãi suất bảo hiểm thấp hơn ngân hàng nhiều.",
        "Anh có BHXH và BHYT rồi, mua thêm làm gì phí tiền.",
        "Công ty bảo hiểm nước ngoài rút vốn thì sao?",
        "Thủ tục bồi thường rắc rối lắm, anh ngại."
    ];

    const handleAnalyzeObjection = async () => {
        if (!userObjection.trim()) return alert("Vui lòng nhập câu từ chối của khách hàng.");
        setIsAnalyzing(true);
        setAiSuggestions([]);
        try {
            const results = await getObjectionSuggestions(userObjection);
            setAiSuggestions(results);
        } catch (error) {
            alert("Lỗi khi kết nối với AI Coach. Vui lòng thử lại.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleCheckUnderwriting = async () => {
        if (!medicalCondition.trim()) return alert("Vui lòng nhập tình trạng sức khỏe.");
        setIsCheckingUw(true);
        setUwResult(null);
        try {
            const result = await checkPreUnderwriting(medicalCondition);
            setUwResult(result);
        } catch (error) {
            alert("Lỗi khi thẩm định. Vui lòng thử lại.");
        } finally {
            setIsCheckingUw(false);
        }
    };

    // --- SMART CLAIM HANDLER ---
    const handleAnalyzeClaim = async () => {
        if (!selectedContractId || !claimEvent.trim()) return alert("Vui lòng chọn HĐ và nhập sự kiện.");
        
        setIsAnalyzingClaim(true);
        setClaimResult(null);
        
        try {
            const contract = contracts.find(c => c.id === selectedContractId);
            if (!contract) throw new Error("Hợp đồng không tồn tại");
            
            // Try to find full product details to give AI more context
            const product = products.find(p => p.id === contract.mainProduct.productId);
            
            const result = await analyzeClaimSupport(contract, product, claimEvent);
            setClaimResult(result);
        } catch (e) {
            console.error(e);
            alert("Lỗi phân tích Claim. Vui lòng thử lại.");
        } finally {
            setIsAnalyzingClaim(false);
        }
    };

    const handleRandomCard = () => {
        const randomQ = practiceQuestions[Math.floor(Math.random() * practiceQuestions.length)];
        setCurrentCard(randomQ);
        setShowAnswer(false);
        setPracticeAnswer('');
    };

    const handleShowPracticeAnswer = async () => {
        if (!currentCard) return;
        setShowAnswer(true);
        if (!practiceAnswer) {
            setIsAnalyzing(true);
            try {
                const results = await getObjectionSuggestions(currentCard);
                const combined = results.slice(0, 2).map((r: any) => `👉 ${r.label}:\n"${r.content}"`).join('\n\n');
                setPracticeAnswer(combined);
            } catch (e) {
                setPracticeAnswer("Lỗi tải gợi ý.");
            } finally {
                setIsAnalyzing(false);
            }
        }
    };

    const getUwColor = (prediction: string) => {
        switch (prediction) {
            case 'Standard': return 'bg-green-100 text-green-700 border-green-200';
            case 'Loading': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'Exclusion': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'Postpone': return 'bg-gray-100 text-gray-700 border-gray-200';
            case 'Decline': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-blue-100 text-blue-700 border-blue-200';
        }
    };

    return (
        <div className="space-y-6 pb-20 max-w-4xl mx-auto">
            <header>
                <h1 className="text-2xl font-black text-gray-800 dark:text-gray-100">Công cụ Nghiệp vụ</h1>
                <p className="text-sm text-gray-500">Nâng cao hiệu suất và niềm tin từ khách hàng.</p>
            </header>

            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl overflow-x-auto">
                <button onClick={() => setActiveTab('smart_claim')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition ${activeTab === 'smart_claim' ? 'bg-white dark:bg-pru-card text-pru-red shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                    <i className="fas fa-magic mr-2"></i>Smart Claim
                </button>
                <button onClick={() => setActiveTab('underwriting')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition ${activeTab === 'underwriting' ? 'bg-white dark:bg-pru-card text-pru-red shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                    <i className="fas fa-stethoscope mr-2"></i>Thẩm định sơ bộ
                </button>
                <button onClick={() => setActiveTab('objections')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition ${activeTab === 'objections' ? 'bg-white dark:bg-pru-card text-pru-red shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                    <i className="fas fa-brain mr-2"></i>Xử lý từ chối
                </button>
                <button onClick={() => setActiveTab('claims')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition ${activeTab === 'claims' ? 'bg-white dark:bg-pru-card text-pru-red shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                    <i className="fas fa-list-check mr-2"></i>Checklist (Tĩnh)
                </button>
            </div>

            {/* TAB: SMART CLAIM (NEW) */}
            {activeTab === 'smart_claim' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-white dark:bg-pru-card p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">1. Chọn Khách hàng</label>
                                <SearchableCustomerSelect 
                                    customers={customers} 
                                    value={selectedCustomer?.fullName || ''} 
                                    onChange={(c) => { setSelectedCustomer(c); setSelectedContractId(''); setClaimResult(null); }}
                                    placeholder="Tìm khách hàng..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">2. Chọn Hợp đồng</label>
                                <select 
                                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none"
                                    value={selectedContractId}
                                    onChange={(e) => setSelectedContractId(e.target.value)}
                                    disabled={!selectedCustomer}
                                >
                                    <option value="">-- Chọn Hợp đồng --</option>
                                    {availableContracts.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.contractNumber} - {c.mainProduct.productName} ({c.status})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">3. Mô tả sự kiện bảo hiểm</label>
                            <textarea 
                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-pru-red/30 focus:border-pru-red outline-none resize-none"
                                rows={3}
                                placeholder="Ví dụ: Khách hàng mổ ruột thừa tại BV Tâm Anh, nằm viện 5 ngày, tổng chi phí 25 triệu..."
                                value={claimEvent}
                                onChange={e => setClaimEvent(e.target.value)}
                            />
                        </div>

                        <button 
                            onClick={handleAnalyzeClaim}
                            disabled={isAnalyzingClaim}
                            className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/30 flex items-center justify-center disabled:opacity-50"
                        >
                            {isAnalyzingClaim ? <><i className="fas fa-spinner fa-spin mr-2"></i> Đang phân tích...</> : <><i className="fas fa-search-dollar mr-2"></i> Phân tích Quyền lợi</>}
                        </button>
                    </div>

                    {/* Result */}
                    {claimResult && (
                        <div className="space-y-4 animate-slide-up">
                            {/* Verdict Banner */}
                            <div className={`p-5 rounded-2xl border-l-8 shadow-sm flex items-center justify-between ${claimResult.eligible ? 'bg-green-100 border-green-500 text-green-800' : 'bg-red-100 border-red-500 text-red-800'}`}>
                                <div>
                                    <p className="text-xs font-bold uppercase opacity-70 mb-1">Kết quả dự kiến</p>
                                    <h3 className="text-2xl font-black">{claimResult.eligible ? 'ĐƯỢC CHI TRẢ' : 'CÓ THỂ BỊ TỪ CHỐI'}</h3>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold uppercase opacity-70 mb-1">Ước tính</p>
                                    <p className="text-lg font-black">{claimResult.estimatedAmount}</p>
                                </div>
                            </div>

                            {/* Warning if any */}
                            {claimResult.warning && (
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-xl flex items-start gap-3">
                                    <i className="fas fa-exclamation-triangle text-yellow-600 text-xl mt-0.5"></i>
                                    <div>
                                        <p className="font-bold text-yellow-800 dark:text-yellow-300 text-sm">Cảnh báo quan trọng</p>
                                        <p className="text-sm text-yellow-700 dark:text-yellow-400">{claimResult.warning}</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Reasoning */}
                                <div className="bg-white dark:bg-pru-card p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                                    <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center"><i className="fas fa-info-circle text-blue-500 mr-2"></i> Cơ sở quyền lợi</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">{claimResult.reasoning}</p>
                                </div>

                                {/* Checklist */}
                                <div className="bg-white dark:bg-pru-card p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                                    <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center"><i className="fas fa-tasks text-green-500 mr-2"></i> Hồ sơ cần chuẩn bị</h4>
                                    <ul className="space-y-2">
                                        {claimResult.checklist?.map((item: any, idx: number) => (
                                            <li key={idx} className="flex items-start text-sm text-gray-600 dark:text-gray-300">
                                                <input type="checkbox" className="mt-1 mr-2 accent-green-600" />
                                                <div>
                                                    <span className="font-bold">{item.item}</span>
                                                    {item.note && <span className="block text-xs text-gray-400 italic">{item.note}</span>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setShowClaimForm(true)}
                                    className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center hover:opacity-90 transition"
                                >
                                    <i className="fas fa-print mr-2"></i> Tạo đơn yêu cầu (Pre-fill)
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* CLAIM FORM MODAL */}
            {showClaimForm && selectedCustomer && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-xl w-full max-w-2xl h-[90vh] flex flex-col shadow-2xl">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-bold text-lg text-gray-800"><i className="fas fa-file-contract mr-2"></i> Đơn yêu cầu bồi thường (Preview)</h3>
                            <button onClick={() => setShowClaimForm(false)} className="text-gray-500 hover:text-gray-700"><i className="fas fa-times text-xl"></i></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 font-serif text-gray-800">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h2>
                                <p className="text-sm font-bold underline">Độc lập - Tự do - Hạnh phúc</p>
                                <br/>
                                <h1 className="text-2xl font-bold mt-4">GIẤY YÊU CẦU GIẢI QUYẾT QUYỀN LỢI BẢO HIỂM</h1>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="border-b border-gray-300 pb-2 mb-4 font-bold uppercase text-sm">I. THÔNG TIN KHÁCH HÀNG</div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <p>Họ tên bên mua BH: <span className="font-bold">{selectedCustomer.fullName}</span></p>
                                    <p>Số Hợp đồng: <span className="font-bold">{contracts.find(c => c.id === selectedContractId)?.contractNumber}</span></p>
                                    <p>Ngày sinh: {formatDateVN(selectedCustomer.dob)}</p>
                                    <p>Số CCCD: {selectedCustomer.idCard}</p>
                                    <p>Điện thoại: {selectedCustomer.phone}</p>
                                </div>

                                <div className="border-b border-gray-300 pb-2 mb-4 font-bold uppercase text-sm mt-6">II. THÔNG TIN SỰ KIỆN BẢO HIỂM</div>
                                <p className="text-sm">Mô tả sự kiện: <span className="italic">{claimEvent}</span></p>
                                
                                <div className="border-b border-gray-300 pb-2 mb-4 font-bold uppercase text-sm mt-6">III. HỒ SƠ ĐÍNH KÈM</div>
                                <ul className="list-disc ml-5 text-sm space-y-1">
                                    {claimResult?.checklist?.map((i: any, idx: number) => (
                                        <li key={idx}>{i.item} <span className="italic text-gray-500">({i.note})</span></li>
                                    ))}
                                </ul>

                                <div className="mt-10 flex justify-between text-sm">
                                    <div className="text-center">
                                        <p className="italic">Ngày ..... tháng ..... năm 20...</p>
                                        <p className="font-bold mt-1">Tư vấn viên hỗ trợ</p>
                                        <br/><br/><br/>
                                        <p>...................................</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="italic">Ngày ..... tháng ..... năm 20...</p>
                                        <p className="font-bold mt-1">Người yêu cầu bồi thường</p>
                                        <p className="italic text-xs">(Ký và ghi rõ họ tên)</p>
                                        <br/><br/><br/>
                                        <p className="font-bold uppercase">{selectedCustomer.fullName}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
                            <button onClick={() => window.print()} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold shadow hover:bg-blue-700"><i className="fas fa-print mr-2"></i> In đơn</button>
                            <button onClick={() => setShowClaimForm(false)} className="bg-gray-200 text-gray-700 px-5 py-2 rounded-lg font-bold hover:bg-gray-300">Đóng</button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: PRE-UNDERWRITING */}
            {activeTab === 'underwriting' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-white dark:bg-pru-card p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Mô tả tình trạng sức khỏe / Bệnh sử
                        </label>
                        <textarea 
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-pru-red/30 focus:border-pru-red outline-none resize-none mb-4"
                            rows={4}
                            placeholder="Ví dụ: Khách hàng nam, 40 tuổi, bị men gan cao gấp đôi bình thường, phát hiện cách đây 6 tháng, đang uống thuốc bổ gan..."
                            value={medicalCondition}
                            onChange={e => setMedicalCondition(e.target.value)}
                        />
                        <button 
                            onClick={handleCheckUnderwriting}
                            disabled={isCheckingUw}
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/30 flex items-center justify-center disabled:opacity-50"
                        >
                            {isCheckingUw ? <><i className="fas fa-spinner fa-spin mr-2"></i> Đang thẩm định...</> : <><i className="fas fa-search-plus mr-2"></i> Dự báo kết quả</>}
                        </button>
                    </div>

                    {/* Result Area */}
                    {uwResult && (
                        <div className="animate-slide-up space-y-4">
                            <div className={`p-5 rounded-2xl border-l-8 shadow-sm flex items-center justify-between ${getUwColor(uwResult.prediction)}`}>
                                <div>
                                    <p className="text-xs font-bold uppercase opacity-70 mb-1">Dự đoán kết quả</p>
                                    <h3 className="text-2xl font-black">{uwResult.predictionLabel}</h3>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold uppercase opacity-70 mb-1">Rủi ro</p>
                                    <span className={`px-3 py-1 rounded-full text-xs font-black bg-white/50 border border-white/20`}>
                                        {uwResult.riskLevel}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-pru-card p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                                <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center"><i className="fas fa-microscope text-indigo-500 mr-2"></i> Phân tích</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{uwResult.reasoning}</p>
                                {uwResult.loadingEstimate && uwResult.loadingEstimate !== 'Không áp dụng' && (
                                    <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl border border-orange-100 dark:border-orange-800">
                                        <p className="text-xs font-bold text-orange-800 dark:text-orange-300 uppercase">Dự kiến tăng phí</p>
                                        <p className="text-lg font-black text-orange-600">{uwResult.loadingEstimate}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: OBJECTIONS */}
            {activeTab === 'objections' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex justify-center gap-4">
                        <button onClick={() => setObjectionMode('solve')} className={`px-4 py-2 rounded-full text-xs font-bold border transition ${objectionMode === 'solve' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 text-red-600 dark:text-red-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'}`}><i className="fas fa-fire-extinguisher mr-2"></i> Gỡ rối ngay (SOS)</button>
                        <button onClick={() => { setObjectionMode('practice'); if(!currentCard) handleRandomCard(); }} className={`px-4 py-2 rounded-full text-xs font-bold border transition ${objectionMode === 'practice' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 text-purple-600 dark:text-purple-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'}`}><i className="fas fa-dumbbell mr-2"></i> Luyện tập (Flashcard)</button>
                    </div>

                    {objectionMode === 'solve' && (
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-pru-card p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 relative overflow-hidden">
                                <div className="relative z-10">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Khách hàng đang nói gì?</label>
                                    <div className="flex gap-2">
                                        <textarea className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-pru-red/30 focus:border-pru-red outline-none resize-none" rows={3} placeholder="Ví dụ: Anh thấy bảo hiểm lãi thấp quá..." value={userObjection} onChange={e => setUserObjection(e.target.value)} />
                                        <button onClick={handleAnalyzeObjection} disabled={isAnalyzing} className="w-16 bg-pru-red text-white rounded-xl hover:bg-red-700 transition shadow-lg flex flex-col items-center justify-center disabled:opacity-50">{isAnalyzing ? <i className="fas fa-spinner fa-spin text-xl"></i> : <><i className="fas fa-search text-xl mb-1"></i><span className="text-[10px] font-bold">SOS</span></>}</button>
                                    </div>
                                </div>
                            </div>
                            {aiSuggestions.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up">
                                    {aiSuggestions.map((s, idx) => (
                                        <div key={idx} className={`p-5 rounded-2xl border-l-4 shadow-sm hover:shadow-md transition relative group bg-white dark:bg-gray-800 ${s.type === 'empathy' ? 'border-pink-500' : s.type === 'logic' ? 'border-blue-500' : 'border-green-500'}`}>
                                            <div className="flex justify-between items-center mb-3"><span className={`text-[10px] px-2 py-1 rounded font-black uppercase text-white ${s.type === 'empathy' ? 'bg-pink-500' : s.type === 'logic' ? 'bg-blue-500' : 'bg-green-500'}`}>{s.label}</span><button onClick={() => {navigator.clipboard.writeText(s.content); alert("Đã sao chép!")}} className="text-gray-300 hover:text-gray-500"><i className="fas fa-copy"></i></button></div>
                                            <p className="text-sm text-gray-700 dark:text-gray-200 italic leading-relaxed">"{s.content}"</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {objectionMode === 'practice' && (
                        <div className="flex flex-col items-center justify-center space-y-8 py-10">
                            <div className="perspective-1000 w-full max-w-md h-64 relative cursor-pointer group" onClick={() => setShowAnswer(!showAnswer)}>
                                <div className={`w-full h-full absolute transition-all duration-500 transform-style-3d ${showAnswer ? 'rotate-y-180' : ''}`}>
                                    <div className="absolute w-full h-full backface-hidden bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 text-center border-4 border-gray-700">
                                        <span className="text-6xl text-gray-600 mb-4 opacity-30"><i className="fas fa-quote-left"></i></span>
                                        <h3 className="text-xl font-bold text-white leading-relaxed">{currentCard}</h3>
                                        <p className="absolute bottom-6 text-xs text-gray-400 font-bold uppercase tracking-widest animate-pulse">Chạm để xem đáp án</p>
                                    </div>
                                    <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-white dark:bg-pru-card rounded-3xl shadow-2xl border-4 border-green-500 overflow-y-auto p-6 flex flex-col">
                                        {isAnalyzing ? <div className="flex-1 flex flex-col items-center justify-center text-green-600"><i className="fas fa-circle-notch fa-spin text-3xl mb-2"></i><span className="text-xs font-bold">Coach đang suy nghĩ...</span></div> : practiceAnswer ? <div className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{practiceAnswer}</div> : <div className="flex-1 flex flex-col items-center justify-center"><button onClick={(e) => { e.stopPropagation(); handleShowPracticeAnswer(); }} className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-green-700 transition">Hiện gợi ý từ AI</button></div>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4"><button onClick={handleRandomCard} className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition flex items-center justify-center shadow-sm"><i className="fas fa-random text-xl"></i></button></div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'claims' && (
                <div className="py-10 text-center text-gray-400">
                    <i className="fas fa-info-circle text-2xl mb-2"></i>
                    <p>Tab Checklist tĩnh đã được thay thế bằng Smart Claim.</p>
                </div>
            )}

            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
            `}</style>
        </div>
    );
};

export default OperationsPage;
