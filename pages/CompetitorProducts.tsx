
import React, { useState } from 'react';
import { CompetitorProduct, ComparisonFeatures } from '../types';
import { addData, updateData, deleteData, COLLECTIONS } from '../services/db';
import { extractTextFromFile, analyzeCompetitorData } from '../services/geminiService'; // Use extractTextFromFile
import { uploadFile } from '../services/storage';

interface CompetitorProductsPageProps {
    competitorProducts: CompetitorProduct[];
}

const CompetitorProductsPage: React.FC<CompetitorProductsPageProps> = ({ competitorProducts }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    
    // AI Import States
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [importMode, setImportMode] = useState<'none' | 'file'>('none');

    const defaultProduct: CompetitorProduct = {
        id: '',
        company: '',
        productName: '',
        tier: 'Nâng cao',
        features: {
            limit_year: '',
            room_board: '',
            surgery: '',
            cancer: '',
            copayment: '',
            waiting_period: '',
            scope: '',
            organ_transplant: ''
        },
        pros: [],
        cons: [],
        lastUpdated: new Date().toISOString()
    };

    const [formData, setFormData] = useState<CompetitorProduct>(defaultProduct);
    const [activeTab, setActiveTab] = useState<'info' | 'benefits' | 'proscons'>('info');

    const filteredProducts = competitorProducts.filter(p => 
        p.company.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.productName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOpenAdd = () => {
        setFormData(defaultProduct);
        setIsEditing(false);
        setActiveTab('info');
        setShowModal(true);
    };

    const handleOpenEdit = (p: CompetitorProduct) => {
        setFormData(p);
        setIsEditing(true);
        setActiveTab('info');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.company || !formData.productName) return alert("Vui lòng nhập Công ty và Tên sản phẩm");
        
        try {
            const payload = { ...formData, lastUpdated: new Date().toISOString() };
            if (isEditing) {
                await updateData(COLLECTIONS.COMPETITOR_PRODUCTS, formData.id, payload);
            } else {
                await addData(COLLECTIONS.COMPETITOR_PRODUCTS, payload);
            }
            setShowModal(false);
        } catch (e) {
            console.error(e);
            alert("Lỗi khi lưu dữ liệu.");
        }
    };

    const handleDelete = async (id: string) => {
        if(window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này?")) {
            await deleteData(COLLECTIONS.COMPETITOR_PRODUCTS, id);
        }
    };

    // --- AI IMPORT LOGIC (CLIENT SIDE PROCESSING) ---
    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);
        try {
            let extractedData: any;

            if (file.type === 'application/pdf') {
                // 1. Extract Text from PDF immediately (Client-side)
                const text = await extractTextFromFile(file);
                // 2. Send text to Gemini to parse JSON
                extractedData = await analyzeCompetitorData(text, 'text/plain');
                
                // 3. Optional: Upload file for record keeping (if needed later)
                // await uploadFile(file, 'temp_docs'); 
            } else if (file.type.startsWith('image/')) {
                // 1. Convert Image to Base64
                const reader = new FileReader();
                reader.readAsDataURL(file);
                await new Promise((resolve) => {
                    reader.onload = async () => {
                        const base64 = (reader.result as string).split(',')[1];
                        // 2. Send image to Gemini
                        extractedData = await analyzeCompetitorData(base64, file.type);
                        resolve(true);
                    };
                });
            }

            if (extractedData) {
                // Merge extracted data into form
                setFormData(prev => ({
                    ...prev,
                    company: extractedData.company || prev.company,
                    productName: extractedData.productName || prev.productName,
                    tier: extractedData.tier || prev.tier,
                    features: { ...prev.features, ...extractedData.features },
                    pros: extractedData.pros || [],
                    cons: extractedData.cons || []
                }));
                alert("Đã trích xuất thông tin thành công! Vui lòng kiểm tra lại.");
                setActiveTab('benefits'); // Switch tab to show results
            } else {
                alert("Không thể trích xuất thông tin. Vui lòng thử lại.");
            }

        } catch (err: any) {
            console.error(err);
            alert("Lỗi xử lý file: " + err.message);
        } finally {
            setIsAnalyzing(false);
            e.target.value = ''; // Reset input
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <i className="fas fa-swords text-red-600"></i> Đấu Trường Sản Phẩm
                    </h1>
                    <p className="text-sm text-gray-500">Quản lý cơ sở dữ liệu đối thủ để so sánh.</p>
                </div>
                <button onClick={handleOpenAdd} className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-2.5 rounded-xl font-bold hover:opacity-90 transition shadow-lg flex items-center gap-2">
                    <i className="fas fa-plus"></i> Thêm Đối thủ
                </button>
            </header>

            {/* SEARCH & FILTER */}
            <div className="bg-white dark:bg-pru-card p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex gap-4">
                <div className="relative flex-1">
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input 
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:border-red-500 transition"
                        placeholder="Tìm theo tên công ty, tên sản phẩm..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* PRODUCT GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(p => (
                    <div key={p.id} className="bg-white dark:bg-pru-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md transition relative group">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{p.company}</span>
                                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 line-clamp-1">{p.productName}</h3>
                                <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 font-medium">{p.tier}</span>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                <button onClick={() => handleOpenEdit(p)} className="text-blue-500 hover:bg-blue-50 p-2 rounded"><i className="fas fa-pen"></i></button>
                                <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><i className="fas fa-trash"></i></button>
                            </div>
                        </div>
                        
                        <div className="space-y-2 mt-4 text-sm text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-800 pt-3">
                            <div className="flex justify-between"><span>Hạn mức:</span> <span className="font-bold">{p.features.limit_year || '--'}</span></div>
                            <div className="flex justify-between"><span>Tiền giường:</span> <span className="font-bold">{p.features.room_board || '--'}</span></div>
                            <div className="flex justify-between"><span>Phẫu thuật:</span> <span className="font-bold">{p.features.surgery || '--'}</span></div>
                        </div>
                    </div>
                ))}
                
                {filteredProducts.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                        <i className="fas fa-box-open text-4xl mb-3 opacity-30"></i>
                        <p>Chưa có dữ liệu sản phẩm đối thủ.</p>
                    </div>
                )}
            </div>

            {/* MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-pru-card rounded-2xl w-full max-w-2xl h-[90vh] flex flex-col shadow-2xl transition-colors">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-t-2xl">
                            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{isEditing ? 'Cập nhật' : 'Thêm mới'} Sản phẩm Đối thủ</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times text-xl"></i></button>
                        </div>

                        {/* AI IMPORT BAR */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 flex justify-between items-center border-b border-indigo-100 dark:border-indigo-800">
                            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                                <div className="w-8 h-8 rounded-full bg-indigo-200 dark:bg-indigo-800 flex items-center justify-center"><i className="fas fa-robot"></i></div>
                                <div>
                                    <p className="text-xs font-bold uppercase">Nhập liệu tự động bằng AI</p>
                                    <p className="text-[10px]">Tải ảnh chụp hoặc PDF bảng quyền lợi</p>
                                </div>
                            </div>
                            <label className={`cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition flex items-center gap-2 ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                {isAnalyzing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-cloud-upload-alt"></i>}
                                {isAnalyzing ? 'Đang đọc...' : 'Upload Tài liệu'}
                                <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileImport} disabled={isAnalyzing} />
                            </label>
                        </div>

                        <div className="flex border-b border-gray-200 dark:border-gray-700">
                            <button onClick={() => setActiveTab('info')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'info' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'}`}>Thông tin chung</button>
                            <button onClick={() => setActiveTab('benefits')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'benefits' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'}`}>Quyền lợi (Chi tiết)</button>
                            <button onClick={() => setActiveTab('proscons')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'proscons' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'}`}>Điểm Mạnh/Yếu</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {activeTab === 'info' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="label-text">Công ty</label><input className="input-field" placeholder="VD: Manulife" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} /></div>
                                    <div><label className="label-text">Tên sản phẩm</label><input className="input-field" placeholder="VD: Sống Khỏe..." value={formData.productName} onChange={e => setFormData({...formData, productName: e.target.value})} /></div>
                                    <div><label className="label-text">Hạng/Gói (Tier)</label><input className="input-field" placeholder="VD: Titan, Vàng..." value={formData.tier} onChange={e => setFormData({...formData, tier: e.target.value})} /></div>
                                </div>
                            )}

                            {activeTab === 'benefits' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="label-text">Hạn mức / Năm</label><input className="input-field font-bold" value={formData.features.limit_year} onChange={e => setFormData({...formData, features: {...formData.features, limit_year: e.target.value}})} /></div>
                                        <div><label className="label-text">Tiền giường / Ngày</label><input className="input-field" value={formData.features.room_board} onChange={e => setFormData({...formData, features: {...formData.features, room_board: e.target.value}})} /></div>
                                        <div><label className="label-text">Phẫu thuật / Lần</label><input className="input-field" value={formData.features.surgery} onChange={e => setFormData({...formData, features: {...formData.features, surgery: e.target.value}})} /></div>
                                        <div><label className="label-text">Điều trị Ung thư</label><input className="input-field" value={formData.features.cancer} onChange={e => setFormData({...formData, features: {...formData.features, cancer: e.target.value}})} /></div>
                                        <div><label className="label-text">Đồng chi trả</label><input className="input-field" value={formData.features.copayment} onChange={e => setFormData({...formData, features: {...formData.features, copayment: e.target.value}})} /></div>
                                        <div><label className="label-text">Phạm vi lãnh thổ</label><input className="input-field" value={formData.features.scope} onChange={e => setFormData({...formData, features: {...formData.features, scope: e.target.value}})} /></div>
                                    </div>
                                    <div><label className="label-text">Cấy ghép nội tạng</label><input className="input-field" value={formData.features.organ_transplant} onChange={e => setFormData({...formData, features: {...formData.features, organ_transplant: e.target.value}})} /></div>
                                    <div><label className="label-text">Thời gian chờ</label><input className="input-field" value={formData.features.waiting_period} onChange={e => setFormData({...formData, features: {...formData.features, waiting_period: e.target.value}})} /></div>
                                </div>
                            )}

                            {activeTab === 'proscons' && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="label-text text-green-600">Điểm mạnh (So với Pru)</label>
                                        <textarea className="input-field" rows={4} placeholder="Mỗi ý một dòng..." value={formData.pros.join('\n')} onChange={e => setFormData({...formData, pros: e.target.value.split('\n')})} />
                                    </div>
                                    <div>
                                        <label className="label-text text-red-600">Điểm yếu (Cần tấn công)</label>
                                        <textarea className="input-field" rows={4} placeholder="Mỗi ý một dòng..." value={formData.cons.join('\n')} onChange={e => setFormData({...formData, cons: e.target.value.split('\n')})} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
                            <button onClick={() => setShowModal(false)} className="px-5 py-2 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">Hủy</button>
                            <button onClick={handleSave} className="px-5 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-lg">Lưu Sản Phẩm</button>
                        </div>
                    </div>
                </div>
            )}

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

export default CompetitorProductsPage;
