
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CurrencyInput } from '../components/Shared';
import { calculateRetirement, calculateEducation } from '../services/financialCalculator';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const FinancialPlanning: React.FC = () => {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<'retirement' | 'education' | 'compound'>('retirement');

    // --- EFFECT: DEEP LINKING ---
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tabParam = params.get('tab');
        if (tabParam && ['retirement', 'education', 'compound'].includes(tabParam)) {
            setActiveTab(tabParam as any);
        }
    }, [location.search]);

    // Retirement State
    const [retireInputs, setRetireInputs] = useState({
        currentAge: 30, 
        retireAge: 60, 
        lifeExpectancy: 85, 
        expense: 15000000, 
        savings: 500000000, 
        inflationRate: 4,
        investmentRate: 7, // Dynamic Investment Rate
        hasSI: false, // Social Insurance
        salaryForSI: 10000000
    });

    // Education State
    const [eduInputs, setEduInputs] = useState({
        childAge: 5, uniStartAge: 18, duration: 4, annualTuition: 100000000, currentSavings: 50000000, 
        inflationRate: 5, investmentRate: 7
    });

    // Compound State
    const [compoundInputs, setCompoundInputs] = useState({
        principal: 100000000, monthlyAdd: 5000000, rate: 8, years: 15
    });

    const [showScript, setShowScript] = useState(false); // Toggle for Consultant Script

    // --- CALCULATIONS ---

    const retireResult = useMemo(() => calculateRetirement(
        retireInputs.currentAge, 
        retireInputs.retireAge, 
        retireInputs.lifeExpectancy, 
        retireInputs.expense, 
        retireInputs.inflationRate / 100, 
        retireInputs.investmentRate / 100, // Pass dynamic investment rate
        retireInputs.savings,
        { hasSI: retireInputs.hasSI, salaryForSI: retireInputs.salaryForSI }
    ), [retireInputs]);

    const eduResult = useMemo(() => calculateEducation(
        eduInputs.childAge, 
        eduInputs.uniStartAge, 
        eduInputs.duration, 
        eduInputs.annualTuition, 
        eduInputs.inflationRate / 100, 
        eduInputs.investmentRate / 100, 
        eduInputs.currentSavings
    ), [eduInputs]);

    const compoundResult = useMemo(() => {
        let total = compoundInputs.principal;
        const r = compoundInputs.rate / 100 / 12;
        const n = compoundInputs.years * 12;
        let totalPrincipal = compoundInputs.principal + (compoundInputs.monthlyAdd * n);
        
        for (let i = 0; i < n; i++) {
            total = (total + compoundInputs.monthlyAdd) * (1 + r);
        }
        return {
            total: Math.round(total),
            totalPrincipal,
            interest: Math.round(total - totalPrincipal)
        };
    }, [compoundInputs]);

    // --- SMART METAPHOR LOGIC ---
    const getDailyMetaphor = (amount: number) => {
        if (amount < 30000) return "tương đương một ly cà phê vỉa hè";
        if (amount < 70000) return "tương đương một bát phở sáng";
        if (amount < 150000) return "tương đương một ly Starbucks hoặc vé xem phim";
        if (amount < 500000) return "tương đương một bữa tối tụ tập bạn bè";
        return null; // Too high for consumer metaphors
    };

    // --- CHART DATA (STACKED BAR FOR RETIREMENT) ---
    const chartData = useMemo(() => {
        if (activeTab === 'retirement') {
            return [
                {
                    name: 'Nguồn vốn',
                    "Tài sản có sẵn (FV)": retireResult.currentAmount,
                    "Thiếu hụt (Gap)": retireResult.shortfall,
                }
            ];
        }
        if (activeTab === 'education') {
            return [
                {
                    name: 'Quỹ học vấn',
                    "Đã có (FV)": eduResult.currentAmount,
                    "Thiếu hụt": eduResult.shortfall
                }
            ];
        }
        return [];
    }, [activeTab, retireResult, eduResult]);

    // --- RENDER HELPERS ---
    const formatMoney = (amount: number) => amount.toLocaleString('vi-VN') + ' đ';
    const dailySavingRetire = Math.round((retireResult.monthlySavingNeeded || 0) / 30);
    const metaphorRetire = getDailyMetaphor(dailySavingRetire);

    return (
        <div className="space-y-6 pb-20 max-w-6xl mx-auto">
            <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 dark:text-gray-100">Hoạch định Tài chính <span className="text-pru-red">MDRT</span></h1>
                    <p className="text-sm text-gray-500">Giúp khách hàng "nhìn thấy" tương lai và hành động ngay.</p>
                </div>
            </header>

            {/* TAB SELECTOR */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl overflow-x-auto">
                <button onClick={() => setActiveTab('retirement')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition ${activeTab === 'retirement' ? 'bg-white dark:bg-pru-card text-pru-red shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><i className="fas fa-umbrella-beach mr-2"></i>Hưu trí an nhàn</button>
                <button onClick={() => setActiveTab('education')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition ${activeTab === 'education' ? 'bg-white dark:bg-pru-card text-pru-red shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><i className="fas fa-graduation-cap mr-2"></i>Quỹ học vấn</button>
                <button onClick={() => setActiveTab('compound')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition ${activeTab === 'compound' ? 'bg-white dark:bg-pru-card text-pru-red shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><i className="fas fa-chart-line mr-2"></i>Lãi kép (Đầu tư)</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* LEFT: INPUT PANEL (Col 4) */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white dark:bg-pru-card p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-5">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500"><i className="fas fa-sliders-h"></i></div>
                            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm uppercase tracking-wide">Thiết lập thông số</h3>
                        </div>
                        
                        {activeTab === 'retirement' && (
                            <div className="space-y-4 animate-fade-in">
                                {/* Age Inputs */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="label-text">Tuổi hiện tại</label><input type="number" className="input-field font-bold text-blue-600" value={retireInputs.currentAge} onChange={e => setRetireInputs({...retireInputs, currentAge: Number(e.target.value)})} /></div>
                                    <div><label className="label-text">Tuổi nghỉ hưu</label><input type="number" className="input-field font-bold text-green-600" value={retireInputs.retireAge} onChange={e => setRetireInputs({...retireInputs, retireAge: Number(e.target.value)})} /></div>
                                </div>
                                <input type="range" min="30" max="70" value={retireInputs.retireAge} onChange={e => setRetireInputs({...retireInputs, retireAge: Number(e.target.value)})} className="w-full accent-green-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg appearance-none" />
                                
                                {/* Financial Inputs */}
                                <div><label className="label-text">Chi tiêu mong muốn / tháng (Hiện tại)</label><CurrencyInput className="input-field" value={retireInputs.expense} onChange={v => setRetireInputs({...retireInputs, expense: v})} /></div>
                                <div><label className="label-text">Tài sản tích lũy hiện có</label><CurrencyInput className="input-field" value={retireInputs.savings} onChange={v => setRetireInputs({...retireInputs, savings: v})} /></div>
                                
                                {/* Social Insurance Toggle */}
                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Có BHXH (Lương hưu)?</label>
                                        <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={retireInputs.hasSI} onChange={e => setRetireInputs({...retireInputs, hasSI: e.target.checked})} />
                                    </div>
                                    {retireInputs.hasSI && (
                                        <div className="animate-fade-in">
                                            <label className="label-text">Mức lương đóng BHXH hiện tại</label>
                                            <CurrencyInput className="input-field text-xs" value={retireInputs.salaryForSI} onChange={v => setRetireInputs({...retireInputs, salaryForSI: v})} />
                                        </div>
                                    )}
                                </div>

                                {/* Macro Economics */}
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl text-xs text-blue-800 dark:text-blue-200 border border-blue-100 dark:border-blue-900 space-y-3">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span>Lạm phát dự kiến:</span>
                                            <span className="font-bold">{retireInputs.inflationRate}%</span>
                                        </div>
                                        <input type="range" min="1" max="10" step="0.5" value={retireInputs.inflationRate} onChange={e => setRetireInputs({...retireInputs, inflationRate: Number(e.target.value)})} className="w-full accent-red-500 cursor-pointer h-1 bg-gray-200 rounded-lg appearance-none" />
                                    </div>
                                    
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span>Lãi suất đầu tư:</span>
                                            <span className="font-bold text-green-600">{retireInputs.investmentRate}%</span>
                                        </div>
                                        <input type="range" min="4" max="15" step="0.5" value={retireInputs.investmentRate} onChange={e => setRetireInputs({...retireInputs, investmentRate: Number(e.target.value)})} className="w-full accent-green-600 cursor-pointer h-1 bg-gray-200 rounded-lg appearance-none" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'education' && (
                            <div className="space-y-4 animate-fade-in">
                                {/* Education Inputs (Similar update needed for Investment Rate if desired, keeping simple for now) */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="label-text">Tuổi con hiện tại</label><input type="number" className="input-field" value={eduInputs.childAge} onChange={e => setEduInputs({...eduInputs, childAge: Number(e.target.value)})} /></div>
                                    <div><label className="label-text">Tuổi vào ĐH</label><input type="number" className="input-field" value={eduInputs.uniStartAge} onChange={e => setEduInputs({...eduInputs, uniStartAge: Number(e.target.value)})} /></div>
                                </div>
                                <div><label className="label-text">Số năm học</label><input type="number" className="input-field" value={eduInputs.duration} onChange={e => setEduInputs({...eduInputs, duration: Number(e.target.value)})} /></div>
                                <div><label className="label-text">Học phí / năm (Hiện tại)</label><CurrencyInput className="input-field" value={eduInputs.annualTuition} onChange={v => setEduInputs({...eduInputs, annualTuition: v})} /></div>
                                <div><label className="label-text">Đã tích lũy</label><CurrencyInput className="input-field" value={eduInputs.currentSavings} onChange={v => setEduInputs({...eduInputs, currentSavings: v})} /></div>
                                
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl text-xs space-y-2 border border-blue-100 dark:border-blue-900">
                                    <div className="flex justify-between"><span>Lạm phát giáo dục:</span> <strong>{eduInputs.inflationRate}%</strong></div>
                                    <div className="flex justify-between"><span>Lãi suất đầu tư:</span> <strong>{eduInputs.investmentRate}%</strong></div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'compound' && (
                            <div className="space-y-4 animate-fade-in">
                                <div><label className="label-text">Số vốn ban đầu</label><CurrencyInput className="input-field font-bold" value={compoundInputs.principal} onChange={v => setCompoundInputs({...compoundInputs, principal: v})} /></div>
                                <div><label className="label-text">Tiết kiệm thêm mỗi tháng</label><CurrencyInput className="input-field" value={compoundInputs.monthlyAdd} onChange={v => setCompoundInputs({...compoundInputs, monthlyAdd: v})} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="label-text">Lãi suất (%/năm)</label><input type="number" className="input-field" value={compoundInputs.rate} onChange={e => setCompoundInputs({...compoundInputs, rate: Number(e.target.value)})} /></div>
                                    <div><label className="label-text">Thời gian (Năm)</label><input type="number" className="input-field" value={compoundInputs.years} onChange={e => setCompoundInputs({...compoundInputs, years: Number(e.target.value)})} /></div>
                                </div>
                                <input type="range" min="1" max="30" value={compoundInputs.years} onChange={e => setCompoundInputs({...compoundInputs, years: Number(e.target.value)})} className="w-full accent-green-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg appearance-none" />
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: RESULT & INSIGHTS (Col 8) */}
                <div className="lg:col-span-8 space-y-6">
                    
                    {/* 1. HERO RESULT CARD */}
                    {activeTab !== 'compound' ? (
                        <div className="bg-gray-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-pru-red/20 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
                            
                            <div className="flex-1 text-center md:text-left z-10">
                                <p className="text-gray-400 font-bold text-sm uppercase tracking-widest mb-1">
                                    {activeTab === 'retirement' ? 'Quỹ hưu cần có (Sau BHXH)' : 'Quỹ học vấn cần có'}
                                </p>
                                <h2 className="text-3xl md:text-4xl font-black mb-2 text-white">
                                    {formatMoney(activeTab === 'retirement' ? retireResult.requiredAmount : eduResult.requiredAmount)}
                                </h2>
                                <p className="text-sm text-gray-400">
                                    Đã tính lạm phát {activeTab === 'retirement' ? retireInputs.inflationRate : eduInputs.inflationRate}%/năm
                                    {activeTab === 'retirement' && <span className="text-green-400 font-bold ml-1">(Trọn đời)</span>}
                                </p>
                            </div>

                            <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10 w-full md:w-auto min-w-[200px] z-10">
                                <p className="text-xs font-bold text-red-300 uppercase mb-1">Thiếu hụt (Gap)</p>
                                <p className="text-xl font-bold text-white mb-2">
                                    {formatMoney(activeTab === 'retirement' ? retireResult.shortfall : eduResult.shortfall)}
                                </p>
                                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-red-500 rounded-full" 
                                        style={{width: `${Math.min(100, ((activeTab === 'retirement' ? retireResult.shortfall : eduResult.shortfall) / (activeTab === 'retirement' ? retireResult.requiredAmount : eduResult.requiredAmount)) * 100)}%`}}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                            <div className="flex justify-between items-center z-10 relative">
                                <div>
                                    <p className="text-indigo-200 font-bold text-sm uppercase tracking-widest mb-1">Tổng tài sản sau {compoundInputs.years} năm</p>
                                    <h2 className="text-4xl font-black text-white">{formatMoney(compoundResult.total)}</h2>
                                </div>
                                <div className="text-right">
                                    <p className="text-indigo-200 text-xs">Tổng gốc: {formatMoney(compoundResult.totalPrincipal)}</p>
                                    <p className="text-green-300 font-bold text-lg">+ {formatMoney(compoundResult.interest)} (Lãi)</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. CHART & DETAILS */}
                    {activeTab !== 'compound' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-pru-card p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">Cơ cấu quỹ hưu trí</h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} layout="vertical" barSize={30}>
                                            <XAxis type="number" hide />
                                            <YAxis type="category" dataKey="name" hide />
                                            <Tooltip formatter={(value: number) => formatMoney(value)} cursor={{fill: 'transparent'}} />
                                            <Legend verticalAlign="bottom" />
                                            {/* Stacked Bars */}
                                            <Bar dataKey="Tài sản có sẵn (FV)" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="Thiếu hụt (Gap)" stackId="a" fill="#ef4444" radius={[0, 10, 10, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                
                                {/* Info Box about FV */}
                                {activeTab === 'retirement' && retireResult.currentAmount > 0 && (
                                    <div className="mt-2 text-xs bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-green-800 dark:text-green-300 border border-green-100 dark:border-green-800">
                                        <i className="fas fa-chart-line mr-1"></i>
                                        Tài sản <strong>{formatMoney(retireInputs.savings)}</strong> hiện tại sẽ tăng trưởng thành <strong>{formatMoney(retireResult.currentAmount)}</strong> sau {retireResult.details.yearsToRetire} năm (với lãi suất {retireInputs.investmentRate}%).
                                    </div>
                                )}
                            </div>

                            <div className="bg-white dark:bg-pru-card p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-center space-y-4">
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Cần tiết kiệm thêm mỗi tháng</p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xl shadow-sm">
                                            <i className="fas fa-piggy-bank"></i>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-black text-green-600 dark:text-green-400">
                                                {formatMoney(activeTab === 'retirement' ? (retireResult.monthlySavingNeeded || 0) : (eduResult.monthlySavingNeeded || 0))}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Đầu tư đều đặn với lãi {activeTab === 'retirement' ? retireInputs.investmentRate : eduInputs.investmentRate}%/năm</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs text-gray-600 dark:text-gray-300 italic border border-gray-100 dark:border-gray-700">
                                    "Chỉ cần bớt đi {formatMoney(Math.round((activeTab === 'retirement' ? (retireResult.monthlySavingNeeded || 0) : (eduResult.monthlySavingNeeded || 0)) / 30))} mỗi ngày."
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. CONSULTATION SCRIPT CARD (Retirement Specific) */}
                    {activeTab === 'retirement' && (
                        <>
                            <div className="flex justify-end">
                                <button 
                                    onClick={() => setShowScript(!showScript)}
                                    className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-3 py-2 rounded-lg transition"
                                >
                                    <i className={`fas ${showScript ? 'fa-eye-slash' : 'fa-file-alt'}`}></i> 
                                    {showScript ? 'Ẩn kịch bản' : 'Hiện kịch bản tư vấn mẫu'}
                                </button>
                            </div>

                            {showScript && (
                                <div className="bg-white dark:bg-pru-card p-6 rounded-2xl border-l-4 border-indigo-500 shadow-lg animate-fade-in relative">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <i className="fas fa-quote-right text-6xl text-indigo-500"></i>
                                    </div>
                                    <h3 className="font-bold text-lg mb-4 text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                                        <i className="fas fa-microphone-alt"></i> Kịch bản tư vấn: Bức tranh Hưu trí
                                    </h3>
                                    
                                    {/* Updated: Font readable sans-serif, larger text, looser leading */}
                                    <div className="space-y-6 text-base text-gray-800 dark:text-gray-200 leading-loose">
                                        {/* Part 1 */}
                                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800">
                                            <strong className="block text-indigo-800 dark:text-indigo-300 mb-2 uppercase text-xs tracking-wider">1. Ba Chặng đường & Quỹ thời gian</strong>
                                            <p className="italic">
                                                "Thưa anh/chị, từ nay đến lúc nghỉ hưu ({retireInputs.retireAge} tuổi), chúng ta còn <strong>{retireResult.details.yearsToRetire} năm</strong> để tích lũy. 
                                                Tuy nhiên, chặng đường hưởng thụ sau đó kéo dài tới tận <strong>{retireResult.details.yearsInRetirement} năm</strong> (đến {retireInputs.lifeExpectancy} tuổi). 
                                                <br/><br/>
                                                Câu hỏi quan trọng là: <strong>Ai sẽ nuôi 'người bạn già' đó trong suốt {retireResult.details.yearsInRetirement} năm ròng rã khi sức lao động không còn?</strong>"
                                            </p>
                                        </div>

                                        {/* Part 2: Updated with Inflation Explanation */}
                                        <div>
                                            <strong className="block text-red-600 dark:text-red-400 mb-1 uppercase text-xs tracking-wider">2. Lạm phát & Sức mua trọn đời</strong>
                                            <p>
                                                "Anh/chị thấy con số <strong>{retireInputs.inflationRate}% lạm phát</strong> chứ ạ? 
                                                Để duy trì mức sống <strong>{formatMoney(retireInputs.expense)}/tháng</strong> như hiện tại, 
                                                thì {retireResult.details.yearsToRetire} năm nữa, anh/chị sẽ cần khoảng <strong>{formatMoney(Math.round(retireResult.details.futureMonthlyExpense))}</strong> mỗi tháng.
                                                <br/><br/>
                                                <span className="block bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border-l-4 border-yellow-400 text-yellow-800 dark:text-yellow-200 italic text-sm">
                                                    "Đặc biệt, con số Quỹ cần có này <strong>đã tính trượt giá cho cả {retireResult.details.yearsInRetirement} năm hưu trí</strong>. 
                                                    Tức là ngay cả khi anh/chị đã nghỉ hưu, số tiền rút ra tiêu dùng hàng tháng vẫn <strong>tự động tăng {retireInputs.inflationRate}%/năm</strong>. 
                                                    Điều này đảm bảo bát phở năm 80 tuổi của anh/chị vẫn 'đầy đặn' y như năm 60 tuổi."
                                                </span>
                                            </p>
                                        </div>

                                        {/* Part 3: Investment Impact */}
                                        {retireResult.currentAmount > 0 && (
                                            <div>
                                                <strong className="block text-green-600 dark:text-green-400 mb-1 uppercase text-xs tracking-wider">3. Sức mạnh Lãi kép</strong>
                                                <p>
                                                    "Anh/chị hiện có <strong>{formatMoney(retireInputs.savings)}</strong>. Tin vui là nếu để số tiền này sinh lời {retireInputs.investmentRate}%/năm, 
                                                    nó sẽ tự lớn lên thành <strong>{formatMoney(retireResult.currentAmount)}</strong>, gánh vác một phần lớn áp lực hưu trí cho anh/chị."
                                                </p>
                                            </div>
                                        )}

                                        {/* Part 4 */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                                                <strong className="block text-gray-900 dark:text-gray-100 mb-1">Tổng quỹ cần có</strong>
                                                <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{formatMoney(retireResult.requiredAmount)}</p>
                                                <p className="text-xs text-gray-500 mt-1">Con số bắt buộc để an tâm suốt {retireResult.details.yearsInRetirement} năm hưu trí.</p>
                                            </div>
                                            <div className="p-3 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 rounded-lg">
                                                <strong className="block text-red-700 dark:text-red-300 mb-1">Thiếu hụt (Gap)</strong>
                                                <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatMoney(retireResult.shortfall)}</p>
                                                <p className="text-xs text-red-500 mt-1">Lỗ hổng này nếu không lấp đầy ngay, tuổi già sẽ phải phụ thuộc con cái.</p>
                                            </div>
                                        </div>

                                        {/* Part 5: Dynamic Metaphor */}
                                        <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-800">
                                            <strong className="block text-green-800 dark:text-green-300 mb-2 uppercase text-xs tracking-wider">4. Giải pháp & Hành động</strong>
                                            <p className="italic">
                                                "Tin vui là nếu bắt đầu ngay hôm nay, anh/chị cần để dành khoảng <strong>{formatMoney(retireResult.monthlySavingNeeded || 0)}/tháng</strong>.
                                                <br/><br/>
                                                {metaphorRetire ? (
                                                    <span>
                                                        Chia nhỏ ra chỉ bằng <strong>{formatMoney(dailySavingRetire)} mỗi ngày</strong> - {metaphorRetire} thôi ạ.
                                                    </span>
                                                ) : (
                                                    <span>
                                                        Đây là một con số không nhỏ, nhưng nó phản ánh đúng kỳ vọng về mức sống hưu trí chất lượng cao mà anh/chị mong muốn. 
                                                        Chúng ta có thể cân nhắc bắt đầu với mức thấp hơn và tăng dần theo thu nhập (Top-up sau).
                                                    </span>
                                                )}
                                                <br/><br/>
                                                Nhưng nếu trì hoãn 5 năm nữa, con số này sẽ tăng gấp đôi. <strong>Thời gian chính là tài sản quý giá nhất lúc này.</strong>"
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <style>{`
                .label-text { display: block; font-size: 0.7rem; font-weight: 700; color: #6b7280; margin-bottom: 0.25rem; }
                .dark .label-text { color: #9ca3af; }
                .input-field { width: 100%; border: 1px solid #e5e7eb; padding: 0.5rem; border-radius: 0.5rem; outline: none; font-size: 0.875rem; transition: all; background-color: #fff; color: #111827; }
                .dark .input-field { background-color: #111827; border-color: #374151; color: #f3f4f6; }
                .input-field:focus { border-color: #ed1b2e; ring: 1px solid #ed1b2e; }
                .animate-fade-in { animation: fadeIn 0.4s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default FinancialPlanning;
