
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CurrencyInput } from '../components/Shared';
import { calculateRetirement, calculateEducation } from '../services/financialCalculator';
import { FinancialGoal } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

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
    // Added: inflationRate explicitly in state to allow adjustment
    const [retireInputs, setRetireInputs] = useState({
        currentAge: 30, retireAge: 60, lifeExpectancy: 85, expense: 15000000, savings: 100000000, inflationRate: 4
    });

    // Education State
    const [eduInputs, setEduInputs] = useState({
        childAge: 5, uniStartAge: 18, duration: 4, annualTuition: 100000000, currentSavings: 50000000, inflationRate: 5
    });

    // Compound State
    const [compoundInputs, setCompoundInputs] = useState({
        principal: 100000000, monthlyAdd: 5000000, rate: 8, years: 15
    });

    const [showExplanation, setShowExplanation] = useState(false);

    // --- CALCULATIONS ---

    const retireResult = useMemo(() => calculateRetirement(
        retireInputs.currentAge, 
        retireInputs.retireAge, 
        retireInputs.lifeExpectancy, 
        retireInputs.expense, 
        retireInputs.inflationRate / 100, // Convert to decimal
        0.07, // Default Investment Rate
        retireInputs.savings
    ), [retireInputs]);

    const eduResult = useMemo(() => calculateEducation(
        eduInputs.childAge, 
        eduInputs.uniStartAge, 
        eduInputs.duration, 
        eduInputs.annualTuition, 
        eduInputs.inflationRate / 100, 
        0.07, 
        eduInputs.currentSavings
    ), [eduInputs]);

    const compoundResult = useMemo(() => {
        let total = compoundInputs.principal;
        const r = compoundInputs.rate / 100 / 12;
        const n = compoundInputs.years * 12;
        for (let i = 0; i < n; i++) {
            total = (total + compoundInputs.monthlyAdd) * (1 + r);
        }
        return Math.round(total);
    }, [compoundInputs]);

    // --- ADVANCED ANALYSIS: "THE WHY" ---

    // 1. Cost of Delay Calculation
    const costOfDelay = useMemo(() => {
        if (activeTab === 'retirement') {
            const newAge = retireInputs.currentAge + 5;
            if (newAge >= retireInputs.retireAge) return null;
            
            const delayedResult = calculateRetirement(
                newAge, retireInputs.retireAge, retireInputs.lifeExpectancy, retireInputs.expense, retireInputs.inflationRate / 100, 0.07, retireInputs.savings
            );
            return {
                waitYears: 5,
                currentMonthly: retireResult.monthlySavingNeeded || 0,
                delayedMonthly: delayedResult.monthlySavingNeeded || 0,
                increasePercent: ((delayedResult.monthlySavingNeeded || 0) / (retireResult.monthlySavingNeeded || 1) * 100) - 100
            };
        }
        return null;
    }, [activeTab, retireInputs, retireResult]);

    // 2. Inflation Reality (Quy đổi giá trị tương lai về hiện tại)
    const presentValueReality = useMemo(() => {
        if (activeTab === 'retirement') {
            const years = retireInputs.retireAge - retireInputs.currentAge;
            const inflation = retireInputs.inflationRate / 100;
            // PV = FV / (1+r)^n
            const pvOfGoal = retireResult.requiredAmount / Math.pow(1 + inflation, years);
            
            // Example Goods Price: A bowl of Pho (50k)
            const phoPriceNow = 50000;
            const phoPriceFuture = 50000 * Math.pow(1 + inflation, years);

            return {
                years,
                futureAmount: retireResult.requiredAmount,
                presentValue: pvOfGoal,
                ratio: retireResult.requiredAmount / pvOfGoal,
                phoNow: phoPriceNow,
                phoFuture: phoPriceFuture
            };
        }
        return null;
    }, [activeTab, retireInputs, retireResult]);

    // 3. Chart Data
    const chartData = useMemo(() => {
        if (activeTab === 'retirement') {
            return [
                { name: 'Đã có', value: retireResult.currentAmount, color: '#10b981' }, 
                { name: 'Thiếu hụt', value: retireResult.shortfall, color: '#ef4444' }
            ];
        }
        if (activeTab === 'education') {
            return [
                { name: 'Đã có', value: eduResult.currentAmount, color: '#3b82f6' },
                { name: 'Thiếu hụt', value: eduResult.shortfall, color: '#f97316' }
            ];
        }
        return [];
    }, [activeTab, retireResult, eduResult]);

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
                <button onClick={() => setActiveTab('retirement')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition ${activeTab === 'retirement' ? 'bg-white dark:bg-pru-card text-pru-red shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><i className="fas fa-umbrella-beach mr-2"></i>Hưu trí an nhàn</button>
                <button onClick={() => setActiveTab('education')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition ${activeTab === 'education' ? 'bg-white dark:bg-pru-card text-pru-red shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><i className="fas fa-graduation-cap mr-2"></i>Quỹ học vấn</button>
                <button onClick={() => setActiveTab('compound')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition ${activeTab === 'compound' ? 'bg-white dark:bg-pru-card text-pru-red shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><i className="fas fa-chart-line mr-2"></i>Lãi kép (Đầu tư)</button>
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="label-text">Tuổi hiện tại</label><input type="number" className="input-field font-bold text-blue-600" value={retireInputs.currentAge} onChange={e => setRetireInputs({...retireInputs, currentAge: Number(e.target.value)})} /></div>
                                    <div><label className="label-text">Tuổi nghỉ hưu</label><input type="number" className="input-field font-bold text-green-600" value={retireInputs.retireAge} onChange={e => setRetireInputs({...retireInputs, retireAge: Number(e.target.value)})} /></div>
                                </div>
                                <input type="range" min="30" max="70" value={retireInputs.retireAge} onChange={e => setRetireInputs({...retireInputs, retireAge: Number(e.target.value)})} className="w-full accent-green-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg appearance-none" />
                                
                                <div><label className="label-text">Chi tiêu mong muốn / tháng (Hiện tại)</label><CurrencyInput className="input-field" value={retireInputs.expense} onChange={v => setRetireInputs({...retireInputs, expense: v})} /></div>
                                <div><label className="label-text">Tài sản tích lũy hiện có</label><CurrencyInput className="input-field" value={retireInputs.savings} onChange={v => setRetireInputs({...retireInputs, savings: v})} /></div>
                                
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl text-xs text-blue-800 dark:text-blue-200 border border-blue-100 dark:border-blue-900">
                                    <div className="flex justify-between items-center mb-1">
                                        <span>Lạm phát dự kiến:</span>
                                        <input type="number" className="w-12 text-right bg-transparent font-bold border-b border-blue-300 outline-none" value={retireInputs.inflationRate} onChange={e => setRetireInputs({...retireInputs, inflationRate: Number(e.target.value)})} /> %
                                    </div>
                                    <input type="range" min="1" max="10" value={retireInputs.inflationRate} onChange={e => setRetireInputs({...retireInputs, inflationRate: Number(e.target.value)})} className="w-full accent-blue-600 cursor-pointer h-1 bg-blue-200 rounded-lg appearance-none mt-1" />
                                    
                                    <p className="flex justify-between mt-2"><span>Lãi suất đầu tư:</span> <strong>7%</strong></p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'education' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="label-text">Tuổi con hiện tại</label><input type="number" className="input-field" value={eduInputs.childAge} onChange={e => setEduInputs({...eduInputs, childAge: Number(e.target.value)})} /></div>
                                    <div><label className="label-text">Tuổi vào ĐH</label><input type="number" className="input-field" value={eduInputs.uniStartAge} onChange={e => setEduInputs({...eduInputs, uniStartAge: Number(e.target.value)})} /></div>
                                </div>
                                <div><label className="label-text">Số năm học đại học</label><input type="number" className="input-field" value={eduInputs.duration} onChange={e => setEduInputs({...eduInputs, duration: Number(e.target.value)})} /></div>
                                <div><label className="label-text">Học phí / năm (Hiện tại)</label><CurrencyInput className="input-field" value={eduInputs.annualTuition} onChange={v => setEduInputs({...eduInputs, annualTuition: v})} /></div>
                                <div><label className="label-text">Đã tích lũy được</label><CurrencyInput className="input-field" value={eduInputs.currentSavings} onChange={v => setEduInputs({...eduInputs, currentSavings: v})} /></div>
                                <div className="text-xs text-gray-500">Lạm phát giáo dục: {eduInputs.inflationRate}%/năm</div>
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
                    <div className="bg-gray-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-pru-red/20 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
                        
                        <div className="flex-1 text-center md:text-left z-10">
                            {activeTab === 'retirement' && (
                                <>
                                    <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Mục tiêu hưu trí ({retireInputs.retireAge} tuổi)</p>
                                    <div className="flex items-baseline gap-2 justify-center md:justify-start">
                                        <span className="text-4xl md:text-5xl font-black text-white">{(retireResult.requiredAmount / 1e9).toFixed(1)}</span>
                                        <span className="text-xl text-gray-400 font-bold">Tỷ VNĐ</span>
                                    </div>
                                    <div className="mt-4 flex gap-4 justify-center md:justify-start">
                                        <div className="text-left">
                                            <p className="text-[10px] text-gray-400 uppercase">Thiếu hụt</p>
                                            <p className="text-lg font-bold text-red-400">{(retireResult.shortfall / 1e9).toFixed(1)} Tỷ</p>
                                        </div>
                                        <div className="w-px bg-white/20"></div>
                                        <div className="text-left">
                                            <p className="text-[10px] text-gray-400 uppercase">Tiết kiệm/tháng</p>
                                            <p className="text-lg font-bold text-green-400">{(retireResult.monthlySavingNeeded || 0).toLocaleString()} đ</p>
                                        </div>
                                    </div>
                                </>
                            )}
                            {activeTab === 'education' && (
                                <>
                                    <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Quỹ học vấn mục tiêu</p>
                                    <div className="flex items-baseline gap-2 justify-center md:justify-start">
                                        <span className="text-4xl md:text-5xl font-black text-white">{(eduResult.requiredAmount / 1e6).toFixed(0)}</span>
                                        <span className="text-xl text-gray-400 font-bold">Triệu</span>
                                    </div>
                                    <div className="mt-4 flex gap-4 justify-center md:justify-start">
                                        <div className="text-left"><p className="text-[10px] text-gray-400 uppercase">Thiếu hụt</p><p className="text-lg font-bold text-orange-400">{(eduResult.shortfall / 1e6).toFixed(0)} Tr</p></div>
                                        <div className="w-px bg-white/20"></div>
                                        <div className="text-left"><p className="text-[10px] text-gray-400 uppercase">Cần để dành/tháng</p><p className="text-lg font-bold text-green-400">{(eduResult.monthlySavingNeeded || 0).toLocaleString()} đ</p></div>
                                    </div>
                                </>
                            )}
                            {activeTab === 'compound' && (
                                <>
                                    <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Giá trị tương lai (Sau {compoundInputs.years} năm)</p>
                                    <div className="flex items-baseline gap-2 justify-center md:justify-start">
                                        <span className="text-4xl md:text-5xl font-black text-white">{(compoundResult / 1e6).toFixed(0)}</span>
                                        <span className="text-xl text-gray-400 font-bold">Triệu</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2 italic"><i className="fas fa-info-circle mr-1"></i> Sức mạnh của lãi suất kép {compoundInputs.rate}%/năm</p>
                                </>
                            )}
                        </div>

                        {/* VISUAL CHART (GAP ANALYSIS) */}
                        {(activeTab === 'retirement' || activeTab === 'education') && (
                            <div className="w-full md:w-48 h-40 bg-white/5 rounded-2xl p-2 relative">
                                <p className="text-[10px] text-center text-gray-400 mb-1">Mức độ hoàn thành</p>
                                <ResponsiveContainer width="100%" height="80%">
                                    <BarChart data={chartData}>
                                        <XAxis dataKey="name" hide />
                                        <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', fontSize: '12px'}} itemStyle={{color: '#fff'}} />
                                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                <div className="absolute bottom-2 left-0 w-full text-center">
                                    <span className="text-xs font-bold text-white">
                                        {Math.round((chartData[0].value / (chartData[0].value + chartData[1].value)) * 100)}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. THE STORY SECTION (INSIGHTS) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* A. Inflation Reality Check */}
                        {presentValueReality && (
                            <div className="bg-white dark:bg-pru-card p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                                <div className="flex justify-between items-start mb-3">
                                    <h4 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 text-sm uppercase">
                                        <i className="fas fa-hamburger text-orange-500"></i> Tại sao số tiền lớn thế?
                                    </h4>
                                    <button onClick={() => setShowExplanation(!showExplanation)} className="text-xs text-blue-500 underline">Giải thích</button>
                                </div>
                                
                                {showExplanation && (
                                    <div className="mb-3 p-2 bg-gray-100 dark:bg-gray-800 rounded text-[10px] text-gray-600 dark:text-gray-400">
                                        <p>Công thức: <strong>FV = PV * (1 + Lạm phát)^Năm</strong></p>
                                        <p>Để duy trì mức sống hiện tại, số tiền cần thiết sẽ tăng lên theo lạm phát {retireInputs.inflationRate}%/năm.</p>
                                    </div>
                                )}

                                <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-xl text-sm text-gray-700 dark:text-gray-300 space-y-3">
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Ví dụ: Một bát phở ngon</p>
                                        <div className="flex justify-between items-center">
                                            <div className="text-center">
                                                <p className="text-xs font-bold text-gray-400">Hiện tại</p>
                                                <p className="font-bold text-lg text-gray-800 dark:text-gray-100">{presentValueReality.phoNow.toLocaleString()} đ</p>
                                            </div>
                                            <i className="fas fa-arrow-right text-orange-400"></i>
                                            <div className="text-center">
                                                <p className="text-xs font-bold text-gray-400">{presentValueReality.years} năm nữa</p>
                                                <p className="font-bold text-lg text-orange-600">{presentValueReality.phoFuture.toLocaleString()} đ</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border-t border-orange-200 dark:border-orange-800 pt-2">
                                        <p className="italic text-xs">
                                            "Để mua được những thứ trị giá <strong>10 triệu</strong> bây giờ, 
                                            sau {presentValueReality.years} năm nữa anh/chị cần <strong>{(10000000 * presentValueReality.ratio).toLocaleString()} đ</strong>."
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* B. Daily Breakdown (Psychology) */}
                        {(retireResult.monthlySavingNeeded || eduResult.monthlySavingNeeded) && (
                            <div className="bg-white dark:bg-pru-card p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                                <h4 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-3 text-sm uppercase">
                                    <i className="fas fa-coffee text-brown-500"></i> Chia nhỏ mục tiêu
                                </h4>
                                <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Thay vì nghĩ đến tiền triệu, hãy nghĩ là:</p>
                                        <p className="text-2xl font-black text-green-600 dark:text-green-400 mt-1">
                                            {Math.round(((retireResult.monthlySavingNeeded || eduResult.monthlySavingNeeded || 0) / 30)).toLocaleString()} đ
                                            <span className="text-sm font-bold text-gray-500 ml-1">/ ngày</span>
                                        </p>
                                    </div>
                                    <div className="text-3xl opacity-20">☕️</div>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center italic">
                                    "Chỉ bằng 2 cốc cà phê mỗi ngày để đổi lấy sự an tâm trọn đời."
                                </p>
                            </div>
                        )}
                    </div>

                    {/* 3. COST OF DELAY (FOMO GENERATOR) */}
                    {costOfDelay && costOfDelay.increasePercent > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-6 rounded-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <i className="fas fa-hourglass-half text-6xl text-red-600"></i>
                            </div>
                            <h4 className="font-black text-red-700 dark:text-red-400 text-lg mb-2 uppercase flex items-center gap-2">
                                <i className="fas fa-exclamation-triangle"></i> Cái giá của sự trì hoãn
                            </h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                                Nếu anh/chị quyết định đợi <span className="font-bold">5 năm nữa</span> mới bắt đầu tích lũy, áp lực tài chính sẽ tăng lên đáng kể:
                            </p>
                            
                            <div className="flex items-end gap-4 mb-2">
                                <div className="flex-1">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Hôm nay</p>
                                    <div className="h-10 bg-white dark:bg-gray-800 rounded-lg flex items-center px-3 font-bold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                                        {costOfDelay.currentMonthly.toLocaleString()} đ/tháng
                                    </div>
                                </div>
                                <div className="pb-3 text-gray-400"><i className="fas fa-arrow-right"></i></div>
                                <div className="flex-1">
                                    <p className="text-xs text-red-600 dark:text-red-400 uppercase font-bold">5 năm nữa</p>
                                    <div className="h-10 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-center px-3 font-black text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                                        {costOfDelay.delayedMonthly.toLocaleString()} đ/tháng
                                    </div>
                                </div>
                            </div>
                            
                            <p className="text-xs font-bold text-red-600 dark:text-red-400 mt-2 text-center bg-white/50 dark:bg-black/20 py-2 rounded-lg">
                                Số tiền phải đóng tăng thêm {costOfDelay.increasePercent.toFixed(0)}% mỗi tháng!
                            </p>
                        </div>
                    )}

                </div>
            </div>
            
            <style>{`
                .label-text { display: block; font-size: 0.75rem; font-weight: 700; color: #6b7280; margin-bottom: 0.25rem; text-transform: uppercase; }
                .dark .label-text { color: #9ca3af; }
                .input-field { width: 100%; border: 1px solid #e5e7eb; padding: 0.75rem; border-radius: 1rem; outline: none; font-size: 0.875rem; transition: all; background-color: #fff; color: #111827; }
                .dark .input-field { background-color: #111827; border-color: #374151; color: #f3f4f6; }
                .input-field:focus { border-color: #ed1b2e; ring: 2px solid #ed1b2e20; }
                .animate-fade-in { animation: fadeIn 0.5s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default FinancialPlanning;
