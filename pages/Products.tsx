
import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Product, ProductType, Gender, ProductStatus, ProductCalculationType, FormulaType } from '../types';
import { ConfirmModal, CurrencyInput } from '../components/Shared';
import { uploadFile } from '../services/storage'; 
import { calculateProductFee } from '../services/productCalculator';
import { extractPdfText, extractTextFromFile } from '../services/geminiService'; // Import new client-side extractor
import { HTVKPlan, HTVKPackage } from '../data/pruHanhTrangVuiKhoe';

interface ProductsPageProps {
    products: Product[];
    onAdd: (p: Product) => void;
    onUpdate: (p: Product) => void;
    onDelete: (id: string) => void;
}

const getCalculationLabel = (type: string) => {
    switch (type) {
        case ProductCalculationType.RATE_PER_1000_AGE_GENDER: return "Tỷ lệ × (STBH/1000) [Theo Tuổi & Giới tính]";
        case ProductCalculationType.RATE_PER_1000_TERM: return "Tỷ lệ × (STBH/1000) [Theo Thời hạn & Tuổi]";
        case ProductCalculationType.RATE_PER_1000_OCCUPATION: return "Tỷ lệ × (STBH/1000) [Theo Nhóm nghề]";
        case ProductCalculationType.HEALTH_CARE: return "Bảng giá cố định [Theo Tuổi & Gói] (Thẻ SK)";
        case ProductCalculationType.UL_UNIT_LINK: return "Liên kết đơn vị (Unit Link)";
        case ProductCalculationType.WAIVER_CI: return "Tỷ lệ % phí bảo hiểm (Miễn đóng phí)";
        case ProductCalculationType.FIXED: return "Nhập tay thủ công (Không có công thức)";
        default: return type;
    }
};

const ProductsPage: React.FC<ProductsPageProps> = ({ products, onAdd, onUpdate, onDelete }) => {
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'rates'>('info');
    
    const [formData, setFormData] = useState<Product>({
        id: '', name: '', code: '', type: ProductType.MAIN, status: ProductStatus.ACTIVE, 
        calculationType: ProductCalculationType.FIXED, description: '', rulesAndTerms: '', pdfUrl: '',
        extractedContent: '', 
        rateTable: [],
        calculationConfig: { formulaType: FormulaType.RATE_BASED, lookupKeys: {}, resultKey: '' }
    });
    
    const [excelColumns, setExcelColumns] = useState<string[]>([]);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isUploadingPdf, setIsUploadingPdf] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string, name: string}>({ isOpen: false, id: '', name: '' });

    const [testInputs, setTestInputs] = useState({
        age: 30, gender: Gender.MALE, sumAssured: 1000000000, 
        term: 15, occupationGroup: 1,
        htvkPlan: HTVKPlan.NANG_CAO, htvkPackage: HTVKPackage.STANDARD
    });
    const [testResult, setTestResult] = useState<number | null>(null);

    const [showCalc, setShowCalc] = useState(false);
    const [calcType, setCalcType] = useState<ProductCalculationType>(ProductCalculationType.RATE_PER_1000_AGE_GENDER);
    const [inputData, setInputData] = useState({ 
        age: 30, gender: Gender.MALE, sumAssured: 1000000000, 
        term: 15, occupationGroup: 1,
        htvkPlan: HTVKPlan.NANG_CAO, htvkPackage: HTVKPackage.STANDARD,
        productCode: 'P-DTVT' 
    });
    const [calcResult, setCalcResult] = useState<number | null>(null);

    const openAdd = () => {
        setFormData({ 
            id: '', name: '', code: '', type: ProductType.MAIN, status: ProductStatus.ACTIVE, 
            calculationType: ProductCalculationType.FIXED, description: '', rulesAndTerms: '', pdfUrl: '', extractedContent: '',
            rateTable: [],
            calculationConfig: { formulaType: FormulaType.RATE_BASED, lookupKeys: {}, resultKey: '' }
        });
        setExcelColumns([]); setPreviewData([]); setIsEditing(false); setActiveTab('info'); setShowModal(true); setTestResult(null);
    };

    const openEdit = (p: Product) => {
        setFormData({ ...p, status: p.status || ProductStatus.ACTIVE, calculationConfig: p.calculationConfig || { formulaType: FormulaType.RATE_BASED, lookupKeys: {}, resultKey: '' } });
        if (p.rateTable && p.rateTable.length > 0) { setPreviewData(p.rateTable.slice(0, 5)); setExcelColumns(Object.keys(p.rateTable[0])); } else { setPreviewData([]); setExcelColumns([]); }
        setIsEditing(true); setActiveTab('info'); setShowModal(true); setTestResult(null);
    };

    const handleSubmit = () => {
        if (!formData.name) return alert("Vui lòng nhập tên sản phẩm");
        isEditing ? onUpdate(formData) : onAdd(formData);
        setShowModal(false);
    };

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingPdf(true);
        try {
            // 1. Process client-side immediately (No CORS issue)
            let extracted = "";
            if (file.type === 'application/pdf') {
                 extracted = await extractTextFromFile(file);
                 if (!extracted) console.warn("PDF extraction empty or failed");
            }

            // 2. Upload file to Storage
            const url = await uploadFile(file, 'product-docs');
            
            // 3. Update State
            setFormData(prev => ({ 
                ...prev, 
                pdfUrl: url, 
                extractedContent: extracted, 
                rulesAndTerms: prev.rulesAndTerms || `Tài liệu gốc: ${file.name}` 
            }));
            
            alert("Đã tải và xử lý tài liệu thành công!");
        } catch (error) { 
            console.error(error);
            alert("Lỗi upload: " + error); 
        } finally { 
            setIsUploadingPdf(false); 
        }
    };

    const handleRateTableUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result; const wb = XLSX.read(bstr, { type: 'binary' }); const wsname = wb.SheetNames[0]; const ws = wb.Sheets[wsname]; const data = XLSX.utils.sheet_to_json(ws);
            if (data && data.length > 0) { const cols = Object.keys(data[0] as object); setExcelColumns(cols); setPreviewData(data.slice(0, 5)); setFormData(prev => ({ ...prev, rateTable: data as Record<string, any>[] })); }
        };
        reader.readAsBinaryString(file);
    };

    const runTestCalculation = () => {
        const fee = calculateProductFee({ product: formData, calculationType: formData.calculationType || ProductCalculationType.FIXED, sumAssured: testInputs.sumAssured, age: testInputs.age, gender: testInputs.gender, term: testInputs.term, occupationGroup: testInputs.occupationGroup, htvkPlan: testInputs.htvkPlan, htvkPackage: testInputs.htvkPackage });
        setTestResult(fee);
    };

    useEffect(() => {
        if (!showCalc) return;
        const fee = calculateProductFee({ calculationType: calcType, productCode: inputData.productCode, sumAssured: inputData.sumAssured, age: inputData.age, gender: inputData.gender, term: inputData.term, occupationGroup: inputData.occupationGroup, htvkPlan: inputData.htvkPlan, htvkPackage: inputData.htvkPackage });
        setCalcResult(fee);
    }, [calcType, inputData, showCalc]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-black text-gray-800 dark:text-gray-100 flex items-center"><i className="fas fa-box-open text-pru-red mr-3"></i> Sản phẩm & Nghiệp vụ</h1>
                <div className="flex gap-2">
                    <button onClick={() => setShowCalc(true)} className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition font-bold flex items-center shadow-sm"><i className="fas fa-calculator mr-2"></i>Tính phí nhanh</button>
                    <button onClick={openAdd} className="bg-pru-red text-white px-4 py-2.5 rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-500/30 font-bold flex items-center"><i className="fas fa-plus mr-2"></i>Thêm sản phẩm</button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(p => (
                    <div key={p.id} className={`bg-white dark:bg-pru-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden ${p.status === ProductStatus.INACTIVE ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                        
                        {/* Decorative background shape */}
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-full z-0 group-hover:scale-150 transition-transform duration-500"></div>

                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <div className="flex items-start gap-3">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-sm group-hover:animate-bounce ${p.type === ProductType.MAIN ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                    <i className={`fas ${p.type === ProductType.MAIN ? 'fa-star' : 'fa-puzzle-piece'}`}></i>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg leading-tight group-hover:text-pru-red transition-colors line-clamp-1" title={p.name}>{p.name}</h3>
                                    <div className="flex gap-2 mt-1">
                                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded uppercase">{p.code}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition"><i className="fas fa-pen text-xs"></i></button>
                                <button onClick={() => setDeleteConfirm({ isOpen: true, id: p.id, name: p.name })} className="w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition"><i className="fas fa-trash text-xs"></i></button>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mb-4 relative z-10">
                            <span className={`text-[10px] px-2 py-1 rounded-lg font-bold uppercase ${p.type === ProductType.MAIN ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{p.type}</span>
                            {p.extractedContent ? (
                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-lg flex items-center font-bold" title="AI đã học"><i className="fas fa-brain mr-1"></i> AI Ready</span>
                            ) : (
                                p.pdfUrl && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg font-bold"><i className="fas fa-file-pdf mr-1"></i> PDF</span>
                            )}
                            {p.rateTable && p.rateTable.length > 0 && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded-lg font-bold"><i className="fas fa-table mr-1"></i> Data</span>}
                        </div>
                        
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 relative z-10 h-10">{p.description || 'Chưa có mô tả.'}</p>
                        
                        <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center relative z-10">
                            <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${p.status === ProductStatus.ACTIVE ? 'text-green-600' : 'text-gray-400'}`}>
                                <div className={`w-2 h-2 rounded-full ${p.status === ProductStatus.ACTIVE ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                                {p.status}
                            </span>
                            <span className="text-[10px] text-gray-400 italic">Cập nhật mới nhất</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* PRODUCT MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white dark:bg-pru-card rounded-3xl max-w-3xl w-full p-0 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100 dark:border-gray-700 transition-colors">
                         <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-t-3xl">
                             <h3 className="text-xl font-black text-gray-800 dark:text-gray-100">{isEditing ? 'Cập nhật Sản phẩm' : 'Thêm Sản phẩm Mới'}</h3>
                             <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><i className="fas fa-times text-xl"></i></button>
                         </div>

                         <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 pt-2">
                             <button onClick={() => setActiveTab('info')} className={`py-3 px-4 text-sm font-bold border-b-2 transition ${activeTab === 'info' ? 'border-pru-red text-pru-red' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Thông tin chung</button>
                             <button onClick={() => setActiveTab('rates')} className={`py-3 px-4 text-sm font-bold border-b-2 transition ${activeTab === 'rates' ? 'border-pru-red text-pru-red' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Cấu hình Biểu phí</button>
                         </div>
                         
                         <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-pru-card">
                            {activeTab === 'info' && (
                                <div className="space-y-5">
                                    <div><label className="label-text">Tên sản phẩm <span className="text-red-500">*</span></label><input className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="VD: PRU-Cuộc Sống Bình An" /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="label-text">Mã sản phẩm</label><input className="input-field" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} /></div>
                                        <div><label className="label-text">Loại</label><select className="input-field" value={formData.type} onChange={(e: any) => setFormData({...formData, type: e.target.value})}>{Object.values(ProductType).map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                                    </div>
                                    <div>
                                        <label className="label-text">Công thức tính phí</label>
                                        <select className="input-field" value={formData.calculationType} onChange={(e: any) => setFormData({...formData, calculationType: e.target.value})}>
                                            {Object.values(ProductCalculationType).map(t => <option key={t} value={t}>{getCalculationLabel(t)}</option>)}
                                        </select>
                                    </div>
                                    <div><label className="label-text">Trạng thái</label><select className="input-field font-medium" value={formData.status} onChange={(e: any) => setFormData({...formData, status: e.target.value})}>{Object.values(ProductStatus).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                    <div><label className="label-text">Mô tả ngắn</label><textarea className="input-field" rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                                    
                                    <div className={`p-4 rounded-xl border-2 border-dashed transition-colors ${formData.extractedContent ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30' : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className={`label-text mb-0 flex items-center font-bold ${formData.extractedContent ? 'text-green-800 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                                <i className={`fas ${formData.extractedContent ? 'fa-brain' : 'fa-file-pdf'} mr-2 text-lg`}></i> 
                                                {formData.extractedContent ? 'AI đã học nội dung' : 'Tài liệu sản phẩm (PDF)'}
                                            </label>
                                            <label className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-bold flex items-center transition shadow-sm ${formData.extractedContent ? 'bg-white text-green-700 border border-green-200 hover:bg-green-50' : 'bg-gray-900 text-white hover:bg-black'} ${isUploadingPdf ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                {isUploadingPdf ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-cloud-upload-alt mr-2"></i>}
                                                {isUploadingPdf ? 'Đang xử lý...' : 'Upload PDF'}
                                                <input type="file" className="hidden" accept="application/pdf" onChange={handlePdfUpload} disabled={isUploadingPdf} />
                                            </label>
                                        </div>
                                        {formData.extractedContent ? (
                                            <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                                                Hệ thống đã lưu trữ {formData.extractedContent.length.toLocaleString()} ký tự. AI có thể trả lời các câu hỏi về quyền lợi sản phẩm này.
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 italic">Upload file PDF quy tắc sản phẩm để AI có thể hỗ trợ tư vấn.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'rates' && (
                                <div className="space-y-6">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30 text-center border-dashed border-2">
                                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl"><i className="fas fa-file-excel"></i></div>
                                        <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-1">Upload Biểu Phí (Excel)</h4>
                                        <p className="text-xs text-blue-600 dark:text-blue-400 mb-4">File Excel cần có hàng tiêu đề (VD: Age, Gender, Rate...).</p>
                                        <label className="cursor-pointer bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition inline-block shadow-lg shadow-blue-500/30">
                                            Chọn file Excel
                                            <input type="file" accept=".xlsx, .xls" onChange={handleRateTableUpload} className="hidden" />
                                        </label>
                                        {formData.rateTable && formData.rateTable.length > 0 && (
                                            <div className="mt-4 text-xs font-bold text-green-600 dark:text-green-400 bg-white dark:bg-gray-800 py-1 px-3 rounded-full inline-block border border-green-200">
                                                <i className="fas fa-check-circle mr-1"></i> Đã tải {formData.rateTable.length} dòng.
                                            </div>
                                        )}
                                    </div>

                                    {excelColumns.length > 0 && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                                                <label className="label-text text-base mb-2">Cấu hình công thức</label>
                                                <select className="input-field font-bold text-pru-red dark:text-red-400 mb-4" value={formData.calculationConfig?.formulaType} onChange={e => setFormData({...formData, calculationConfig: { ...formData.calculationConfig!, formulaType: e.target.value as FormulaType }})}>
                                                    <option value={FormulaType.RATE_BASED}>Tính theo Tỷ lệ: (STBH / 1000) * Rate</option>
                                                    <option value={FormulaType.FIXED_FEE}>Phí Cố định (Tra bảng lấy giá trị)</option>
                                                </select>

                                                <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                                    <div className="col-span-2 text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-2">Ánh xạ dữ liệu (Mapping)</div>
                                                    <div><label className="label-text text-xs">Cột Tuổi (Age)</label><select className="input-field text-xs py-2" value={formData.calculationConfig?.lookupKeys?.age || ''} onChange={e => setFormData({...formData, calculationConfig: { ...formData.calculationConfig!, lookupKeys: { ...formData.calculationConfig!.lookupKeys, age: e.target.value } }})}><option value="">-- Chọn cột --</option>{excelColumns.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                                    
                                                    {formData.calculationConfig?.formulaType === FormulaType.RATE_BASED ? (
                                                        <>
                                                            <div><label className="label-text text-xs">Cột Giới tính</label><select className="input-field text-xs py-2" value={formData.calculationConfig?.lookupKeys?.gender || ''} onChange={e => setFormData({...formData, calculationConfig: { ...formData.calculationConfig!, lookupKeys: { ...formData.calculationConfig!.lookupKeys, gender: e.target.value } }})}><option value="">-- Chọn cột --</option>{excelColumns.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                                            <div><label className="label-text text-xs">Cột Thời hạn</label><select className="input-field text-xs py-2" value={formData.calculationConfig?.lookupKeys?.term || ''} onChange={e => setFormData({...formData, calculationConfig: { ...formData.calculationConfig!, lookupKeys: { ...formData.calculationConfig!.lookupKeys, term: e.target.value } }})}><option value="">-- Không dùng --</option>{excelColumns.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div><label className="label-text text-xs">Cột Plan</label><select className="input-field text-xs py-2" value={formData.calculationConfig?.lookupKeys?.plan || ''} onChange={e => setFormData({...formData, calculationConfig: { ...formData.calculationConfig!, lookupKeys: { ...formData.calculationConfig!.lookupKeys, plan: e.target.value } }})}><option value="">-- Chọn cột --</option>{excelColumns.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                                        </>
                                                    )}

                                                    <div className="col-span-2 mt-2">
                                                        <label className="label-text text-xs font-bold text-green-600">Cột Kết quả (Rate/Fee)</label>
                                                        <select className="input-field text-xs py-2 border-green-200 bg-green-50" value={formData.calculationConfig?.resultKey || ''} onChange={e => setFormData({...formData, calculationConfig: { ...formData.calculationConfig!, resultKey: e.target.value } })}><option value="">-- Chọn cột kết quả --</option>{excelColumns.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                         </div>

                         <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3 rounded-b-3xl">
                             <button onClick={() => setShowModal(false)} className="px-5 py-3 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition">Hủy</button>
                             <button onClick={handleSubmit} className="px-6 py-3 bg-pru-red text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/30 transition transform active:scale-95">Lưu Sản Phẩm</button>
                         </div>
                    </div>
                </div>
            )}

            <ConfirmModal isOpen={deleteConfirm.isOpen} title="Xóa sản phẩm?" message={`Bạn có chắc muốn xóa sản phẩm ${deleteConfirm.name}?`} onConfirm={() => onDelete(deleteConfirm.id)} onClose={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })} />

            {/* QUICK CALCULATOR */}
            {showCalc && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white dark:bg-pru-card rounded-3xl max-w-sm w-full p-6 shadow-2xl transition-colors border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-xl text-gray-800 dark:text-gray-100">Tính Phí Nhanh</h3>
                            <button onClick={() => setShowCalc(false)}><i className="fas fa-times text-gray-400 text-lg"></i></button>
                        </div>
                        <div className="space-y-4">
                            <select className="input-field" value={inputData.productCode} onChange={e => setInputData({...inputData, productCode: e.target.value})}><option value="P-DTVT">Đầu Tư Vững Tiến</option><option value="P-CSBA">Cuộc Sống Bình An</option><option value="P-TLTS">Tương Lai Tươi Sáng</option></select>
                            <div className="grid grid-cols-2 gap-3"><input type="number" className="input-field" placeholder="Tuổi" value={inputData.age} onChange={e => setInputData({...inputData, age: Number(e.target.value)})} /><select className="input-field" value={inputData.gender} onChange={e => setInputData({...inputData, gender: e.target.value as Gender})}><option value={Gender.MALE}>Nam</option><option value={Gender.FEMALE}>Nữ</option></select></div>
                            <CurrencyInput className="input-field font-bold" placeholder="Số tiền bảo hiểm" value={inputData.sumAssured} onChange={v => setInputData({...inputData, sumAssured: v})} />
                            
                            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl text-center border border-green-100 dark:border-green-800">
                                <p className="text-xs text-green-600 dark:text-green-400 font-bold uppercase mb-1">Phí ước tính</p>
                                <p className="text-3xl font-black text-green-700 dark:text-green-300">{calcResult?.toLocaleString()} đ</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .label-text { display: block; font-size: 0.75rem; font-weight: 700; color: #6b7280; margin-bottom: 0.35rem; text-transform: uppercase; letter-spacing: 0.025em; }
                .dark .label-text { color: #9ca3af; }
                .input-field { width: 100%; border: 1px solid #e5e7eb; padding: 0.7rem; border-radius: 0.75rem; outline: none; font-size: 0.875rem; transition: all; background-color: #f9fafb; color: #111827; }
                .dark .input-field { background-color: #111827; border-color: #374151; color: #f3f4f6; }
                .input-field:focus { border-color: #ed1b2e; background-color: #fff; ring: 2px solid rgba(237, 27, 46, 0.1); }
                .dark .input-field:focus { background-color: #000; }
            `}</style>
        </div>
    );
};

export default ProductsPage;
