
import React, { useState, useMemo } from 'react';
import { CompetitorProduct, ComparisonFeatures } from '../types';
import { HTVK_BENEFITS, HTVKPlan } from '../data/pruHanhTrangVuiKhoe';
import { analyzeProductBattle } from '../services/geminiService';

interface ProductBattleProps {
    competitorProducts: CompetitorProduct[];
}

// --- HELPER: NORMALIZATION & COMPARISON LOGIC ---

const parseValue = (text: string | undefined): number => {
    if (!text) return 0;
    const t = text.toLowerCase().trim();
    if (t.includes('không giới hạn') || t.includes('thực tế') || t.includes('toàn bộ')) return 9999999999;
    
    // Extract numbers
    const numMatch = t.match(/(\d+([.,]\d+)?)/);
    if (!numMatch) return 0;
    
    let num = parseFloat(numMatch[0].replace(',', '.'));
    
    if (t.includes('tỷ')) num *= 1000000000;
    else if (t.includes('triệu') || t.includes('tr')) num *= 1000000;
    else if (t.includes('nghìn') || t.includes('k')) num *= 1000;
    // Assume pure numbers < 1000 are millions (common shorthand in insurance) e.g., "500" -> 500k or 500tr? 
    // Safer to assume full numbers usually written out or with unit. 
    // If just "600.000", regex catches it.
    
    return num;
};

const compareScope = (s1: string, s2: string): number => {
    const score = (s: string) => {
        const t = s.toLowerCase();
        if (t.includes('toàn cầu')) return 3;
        if (t.includes('á') || t.includes('asia')) return 2;
        if (t.includes('việt nam') || t.includes('vn')) return 1;
        return 0;
    };
    return score(s1) - score(s2);
};

const compareRow = (key: string, val1: string, val2: string): 'left' | 'right' | 'equal' => {
    if (!val1 && !val2) return 'equal';
    if (!val1) return 'right';
    if (!val2) return 'left';

    // 1. Check Scope separately
    if (key === 'scope') {
        const diff = compareScope(val1, val2);
        if (diff > 0) return 'left';
        if (diff < 0) return 'right';
        return 'equal';
    }

    // 2. Check "Không/Có" for Co-payment or Waiting Period (Lower is usually better for waiting period/copay)
    if (key === 'copayment' || key === 'waiting_period') {
        const n1 = parseValue(val1);
        const n2 = parseValue(val2);
        // Smaller is better for Copay/Waiting
        if (n1 < n2) return 'left';
        if (n1 > n2) return 'right';
        return 'equal';
    }

    // 3. General "Higher is Better" Logic
    const n1 = parseValue(val1);
    const n2 = parseValue(val2);

    if (n1 > n2) return 'left';
    if (n1 < n2) return 'right';
    return 'equal';
};

const mapHTVKToFeatures = (plan: HTVKPlan): ComparisonFeatures => {
    const raw = HTVK_BENEFITS[plan];
    return {
        limit_year: raw.gioi_han_nam,
        room_board: raw.noi_tru.tien_giuong,
        surgery: raw.noi_tru.phau_thuat,
        cancer: raw.noi_tru.dieu_tri_ung_thu,
        copayment: "Không (0%)", // Default for HTVK unless specific conditions
        waiting_period: "30 ngày (Bệnh thường) / 90 ngày (Bệnh đặc biệt)",
        scope: raw.pham_vi,
        organ_transplant: "Có (Theo hạn mức)"
    };
};

const LABELS: Record<string, string> = {
    limit_year: 'Hạn mức / Năm',
    room_board: 'Tiền giường / Ngày',
    surgery: 'Phẫu thuật',
    cancer: 'Điều trị Ung thư',
    scope: 'Phạm vi bảo lãnh',
    copayment: 'Đồng chi trả',
    organ_transplant: 'Cấy ghép nội tạng',
    waiting_period: 'Thời gian chờ'
};

const ProductBattlePage: React.FC<ProductBattleProps> = ({ competitorProducts }) => {
    const [selectedPruPlan, setSelectedPruPlan] = useState<HTVKPlan>(HTVKPlan.TOAN_DIEN);
    const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>('');

    const pruFeatures = useMemo(() => mapHTVKToFeatures(selectedPruPlan), [selectedPruPlan]);
    
    const competitorProduct = useMemo(() => 
        competitorProducts.find(c => c.id === selectedCompetitorId), 
    [selectedCompetitorId, competitorProducts]);

    const compFeatures = competitorProduct?.features || {};

    const [battleResult, setBattleResult] = useState<{winner: 'pru' | 'comp' | 'draw', scorePru: number, scoreComp: number} | null>(null);
    
    // AI Analysis States
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<{
        disadvantages?: { point: string, script: string }[],
        usp?: string,
        closing_script?: string
    } | null>(null);

    // Calculate score on render
    const comparisonRows = Object.keys(LABELS).map(key => {
        const result = compareRow(key, pruFeatures[key] || '', compFeatures[key] || '');
        return { key, label: LABELS[key], result };
    });

    const scores = useMemo(() => {
        if (!competitorProduct) return { pru: 0, comp: 0 };
        let p = 0; 
        let c = 0;
        comparisonRows.forEach(row => {
            if (row.result === 'left') p++;
            if (row.result === 'right') c++;
        });
        return { pru: p, comp: c };
    }, [comparisonRows, competitorProduct]);

    const handleAnalyze = async () => {
        if (!competitorProduct) return;
        setIsAnalyzing(true);
        setAiAnalysis(null);
        try {
            const result = await analyzeProductBattle(
                pruFeatures, 
                compFeatures, 
                competitorProduct.company, 
                competitorProduct.productName
            );
            setAiAnalysis(result);
        } catch (e) {
            alert("Lỗi khi phân tích. Vui lòng thử lại.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-6 pb-20 min-h-screen">
            {/* HEADER */}
            <header className="flex flex-col md:flex-row justify-between items-center bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-2xl shadow-lg border-2 border-red-400">
                        <i className="fas fa-fist-raised"></i>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-wider">Đấu Trường Sản Phẩm</h1>
                        <p className="text-gray-400 text-xs font-bold">So sánh trực diện & Phân tích lợi thế</p>
                    </div>
                </div>
                
                {/* SCORE BOARD */}
                {competitorProduct && (
                    <div className="relative z-10 flex items-center gap-6 mt-4 md:mt-0">
                        <div className="text-center">
                            <p className="text-[10px] font-bold text-red-400 uppercase">Prudential</p>
                            <p className="text-3xl font-black">{scores.pru}</p>
                        </div>
                        <div className="text-2xl font-black text-gray-600 italic">VS</div>
                        <div className="text-center">
                            <p className="text-[10px] font-bold text-blue-400 uppercase">Đối thủ</p>
                            <p className="text-3xl font-black">{scores.comp}</p>
                        </div>
                    </div>
                )}
            </header>

            {/* SELECTION AREA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-12 items-start relative">
                {/* VS Badge Absolute Center */}
                <div className="hidden md:flex absolute left-1/2 top-10 -translate-x-1/2 w-12 h-12 bg-white dark:bg-gray-800 rounded-full items-center justify-center font-black text-gray-300 shadow-sm border border-gray-100 dark:border-gray-700 z-10">
                    VS
                </div>

                {/* PRUDENTIAL SIDE */}
                <div className="bg-white dark:bg-pru-card p-5 rounded-2xl shadow-sm border-t-4 border-red-600 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 bg-red-50 dark:bg-red-900/10 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <img src="https://www.prudential.com.vn/export/sites/prudential-vn/vi/.galleries/images/logo-prudential-red.svg" alt="Pru" className="h-6" />
                            <span className="font-bold text-gray-800 dark:text-gray-100">Prudential Vietnam</span>
                        </div>
                        <h3 className="text-xl font-black text-red-600 mb-2">Hành Trang Vui Khỏe</h3>
                        <select 
                            className="w-full p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 rounded-xl font-bold text-red-700 dark:text-red-300 outline-none focus:ring-2 focus:ring-red-200"
                            value={selectedPruPlan}
                            onChange={(e) => setSelectedPruPlan(e.target.value as HTVKPlan)}
                        >
                            {Object.values(HTVKPlan).map(plan => (
                                <option key={plan} value={plan}>Chương trình: {plan}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* COMPETITOR SIDE */}
                <div className="bg-white dark:bg-pru-card p-5 rounded-2xl shadow-sm border-t-4 border-gray-500 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 bg-gray-100 dark:bg-gray-700 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">?</div>
                            <span className="font-bold text-gray-800 dark:text-gray-100">{competitorProduct?.company || 'Chọn đối thủ'}</span>
                        </div>
                        <h3 className="text-xl font-black text-gray-700 dark:text-gray-300 mb-2">{competitorProduct?.productName || 'Sản phẩm đối thủ'}</h3>
                        <select 
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-gray-200"
                            value={selectedCompetitorId}
                            onChange={(e) => setSelectedCompetitorId(e.target.value)}
                        >
                            <option value="">-- Chọn sản phẩm so sánh --</option>
                            {competitorProducts.map(p => (
                                <option key={p.id} value={p.id}>{p.company} - {p.productName} ({p.tier})</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* COMPARISON TABLE */}
            {competitorProduct && (
                <div className="bg-white dark:bg-pru-card rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden animate-slide-up">
                    {comparisonRows.map((row, idx) => (
                        <div key={row.key} className={`grid grid-cols-12 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition duration-200 min-h-[60px] ${idx % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-gray-50/30 dark:bg-gray-900/30'}`}>
                            
                            {/* PRU COL */}
                            <div className={`col-span-4 p-4 flex items-center justify-end text-right border-r border-gray-100 dark:border-gray-800 relative ${row.result === 'left' ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                                <span className={`text-sm ${row.result === 'left' ? 'font-bold text-red-700 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {pruFeatures[row.key] || '--'}
                                </span>
                                {row.result === 'left' && <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 opacity-20 text-3xl"><i className="fas fa-check"></i></div>}
                            </div>

                            {/* LABEL COL */}
                            <div className="col-span-4 p-2 flex items-center justify-center bg-gray-50 dark:bg-gray-900 z-10">
                                <span className="text-[10px] md:text-xs font-bold text-gray-500 uppercase text-center leading-tight px-2">
                                    {row.label}
                                </span>
                            </div>

                            {/* COMP COL */}
                            <div className={`col-span-4 p-4 flex items-center justify-start text-left border-l border-gray-100 dark:border-gray-800 relative ${row.result === 'right' ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                <span className={`text-sm ${row.result === 'right' ? 'font-bold text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {compFeatures[row.key] || '--'}
                                </span>
                                {row.result === 'right' && <div className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-500 opacity-20 text-3xl"><i className="fas fa-check"></i></div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* AI ADVISOR SECTION */}
            {competitorProduct && (
                <div className="relative">
                    <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden transition-all duration-500 animate-fade-in">
                        <div className="absolute top-0 right-0 p-6 opacity-20"><i className="fas fa-brain text-8xl"></i></div>
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                                        <i className="fas fa-chess-knight text-yellow-400"></i> AI Chiến lược gia
                                    </h3>
                                    <p className="text-indigo-200 text-sm">Phân tích điểm mạnh/yếu & Gợi ý kịch bản "sát thủ".</p>
                                </div>
                                <button 
                                    onClick={handleAnalyze} 
                                    disabled={isAnalyzing}
                                    className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-sm font-bold border border-white/20 backdrop-blur-sm transition shadow-lg flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isAnalyzing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
                                    {isAnalyzing ? 'Đang phân tích...' : 'Phân tích Chiến lược'}
                                </button>
                            </div>

                            {/* ANALYSIS RESULT */}
                            {aiAnalysis && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
                                    {/* Left: Handling Objections */}
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-red-300 uppercase border-b border-white/10 pb-2">
                                            <i className="fas fa-shield-alt mr-2"></i> Xử lý Bất lợi (Reframing)
                                        </h4>
                                        {aiAnalysis.disadvantages && aiAnalysis.disadvantages.length > 0 ? (
                                            aiAnalysis.disadvantages.map((item, idx) => (
                                                <div key={idx} className="bg-white/10 p-4 rounded-xl border border-white/10 backdrop-blur-sm">
                                                    <p className="text-xs font-bold text-red-200 mb-2 uppercase">⚠️ {item.point}</p>
                                                    <p className="text-sm italic text-gray-200">"{item.script}"</p>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-green-300 italic">Tuyệt vời! Không tìm thấy điểm yếu đáng kể nào so với đối thủ.</p>
                                        )}
                                    </div>

                                    {/* Right: Killer USP & Closing */}
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-green-300 uppercase border-b border-white/10 pb-2">
                                            <i className="fas fa-crosshairs mr-2"></i> Đòn Quyết định (USP)
                                        </h4>
                                        
                                        <div className="bg-gradient-to-r from-green-500/20 to-teal-500/20 p-4 rounded-xl border border-green-500/30">
                                            <p className="font-bold text-green-200 mb-1 text-sm">Điểm mạnh nhất:</p>
                                            <p className="text-lg font-black text-white leading-tight">{aiAnalysis.usp}</p>
                                        </div>

                                        <div className="bg-white/10 p-4 rounded-xl border border-white/10 relative mt-4">
                                            <div className="absolute -top-3 left-4 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded">KỊCH BẢN CHỐT</div>
                                            <p className="text-sm text-white italic mt-2 leading-relaxed">
                                                "{aiAnalysis.closing_script}"
                                            </p>
                                            <button 
                                                onClick={() => {navigator.clipboard.writeText(aiAnalysis.closing_script || ''); alert("Đã sao chép kịch bản!");}}
                                                className="absolute bottom-2 right-2 text-white/50 hover:text-white transition"
                                            >
                                                <i className="fas fa-copy"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* EMPTY STATE */}
            {!competitorProduct && (
                <div className="text-center py-20 text-gray-400 opacity-60">
                    <i className="fas fa-balance-scale text-6xl mb-4"></i>
                    <p className="text-lg font-bold">Chọn đối thủ để bắt đầu so sánh</p>
                </div>
            )}
        </div>
    );
};

export default ProductBattlePage;
