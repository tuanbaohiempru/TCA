
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CurrencyInput } from '../components/Shared';
import { calculateRetirement, calculateEducation } from '../services/financialCalculator';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

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
        savingsRate: 6, // NEW: Bank Interest Rate
        investmentRate: 12, // Dynamic Investment Rate
        hasSI: false, // Social Insurance
        salaryForSI: 10000000
    });

    // NEW: Option to control where the existing savings are kept
    const [moveAssetsToInvestment, setMoveAssetsToInvestment] = useState(false);

    // Education State
    const [eduInputs, setEduInputs] = useState({
        childAge: 5, uniStartAge: 18, duration: 4, annualTuition: 100000000, currentSavings: 50000000, 
        inflationRate: 5, investmentRate: 7
    });

    // Compound State
    const [compoundInputs, setCompoundInputs] = useState({
        principal: 100000000, monthlyAdd: 5000000, rate: 8, years: 15
    });

    const [showScript, setShowScript] = useState(false);

    // --- CALCULATIONS ---

    // 1. SCENARIO A: INVESTMENT (The Solution)
    const investResult = useMemo(() => calculateRetirement(
        retireInputs.currentAge, 
        retireInputs.retireAge, 
        retireInputs.lifeExpectancy, 
        retireInputs.expense, 
        retireInputs.inflationRate / 100, 
        retireInputs.investmentRate / 100, 
        retireInputs.savings,
        { 
            hasSI: retireInputs.hasSI, 
            salaryForSI: retireInputs.salaryForSI,
            // Logic: If user agrees to move assets, grow at Investment Rate. Else, grow at Savings Rate.
            existingAssetRate: moveAssetsToInvestment ? (retireInputs.investmentRate / 100) : (retireInputs.savingsRate / 100)
        }
    ), [retireInputs, moveAssetsToInvestment]);

    // 2. SCENARIO B: BANK SAVINGS (The Problem/Benchmark)
    const bankResult = useMemo(() => calculateRetirement(
        retireInputs.currentAge, 
        retireInputs.retireAge, 
        retireInputs.lifeExpectancy, 
        retireInputs.expense, 
        retireInputs.inflationRate / 100, 
        retireInputs.savingsRate / 100, 
        retireInputs.savings,
        { 
            hasSI: retireInputs.hasSI, 
            salaryForSI: retireInputs.salaryForSI,
            // In Bank scenario, existing assets are definitely in Bank rate
            existingAssetRate: retireInputs.savingsRate / 100
        }
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

    // --- CHART DATA FOR COMPARISON ---
    const comparisonData = useMemo(() => {
        if (activeTab === 'retirement') {
            return [
                {
                    name: 'Gửi Ngân hàng',
                    rate: retireInputs.savingsRate,
                    "Tiết kiệm hàng tháng": bankResult.monthlySavingNeeded || 0,
                    fill: '#9ca3af' // Gray
                },
                {
                    name: 'Đầu tư Bảo hiểm',
                    rate: retireInputs.investmentRate,
                    "Tiết kiệm hàng tháng": investResult.monthlySavingNeeded || 0,
                    fill: '#10b981' // Green
                }
            ];
        }
        return [];
    }, [activeTab, bankResult, investResult, retireInputs]);

    // --- RENDER HELPERS ---
    const formatMoney = (amount: number) => amount.toLocaleString('vi-VN') + ' đ';
    const moneySaved = Math.max(0, (bankResult.monthlySavingNeeded || 0) - (investResult.monthlySavingNeeded || 0));

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
                                <div>
                                    <label className="label-text">Tài sản tích lũy hiện có</label>
                                    <CurrencyInput className="input-field" value={retireInputs.savings} onChange={v => setRetireInputs({...retireInputs, savings: v})} />
                                    {/* Asset Allocation Toggle */}
                                    {retireInputs.savings > 0 && (
                                        <div className="mt-2 flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                            <input 
                                                type="checkbox" 
                                                id="moveAssets" 
                                                className="w-4 h-4 accent-green-600" 
                                                checked={moveAssetsToInvestment} 
                                                onChange={e => setMoveAssetsToInvestment(e.target.checked)} 
                                            />
                                            <label htmlFor="moveAssets" className="text-[10px] font-bold text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                                                Chuyển tài sản này sang đầu tư?
                                                <span className="block font-normal text-gray-400">Nếu không, sẽ tính theo lãi Ngân hàng.</span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                                
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

                                {/* Macro Economics - UPDATED FOR COMPARISON */}
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900 space-y-4">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-gray-500">Lạm phát dự kiến:</span>
                                            <span className="font-bold text-xs text-red-500">{retireInputs.inflationRate}%</span>
                                        </div>
                                        <input type="range" min="1" max="10" step="0.5" value={retireInputs.inflationRate} onChange={e => setRetireInputs({...retireInputs, inflationRate: Number(e.target.value)})} className="w-full accent-red-500 cursor-pointer h-1 bg-gray-200 rounded-lg appearance-none" />
                                    </div>
                                    
                                    <div className="pt-2 border-t border-indigo-100 dark:border-indigo-800">
                                        <label className="label-text text-indigo-700 dark:text-indigo-300 mb-2 block uppercase text-[10px]">So sánh lãi suất</label>
                                        
                                        <div className="mb-3">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs text-gray-500"><i className="fas fa-university mr-1"></i> Gửi Ngân hàng:</span>
                                                <span className="font-bold text-xs text-gray-700 dark:text-gray-300">{retireInputs.savingsRate}%</span>
                                            </div>
                                            <input type="range" min="3" max="10" step="0.5" value={retireInputs.savingsRate} onChange={e => setRetireInputs({...retireInputs, savingsRate: Number(e.target.value)})} className="w-full accent-gray-500 cursor-pointer h-1 bg-gray-200 rounded-lg appearance-none" />
                                        </div>

                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs text-green-600 font-bold"><i className="fas fa-chart-line mr-1"></i> Đầu tư (ILP):</span>
                                                <span className="font-bold text-xs text-green-600">{retireInputs.investmentRate}%</span>
                                            </div>
                                            <input type="range" min="6" max="15" step="0.5" value={retireInputs.investmentRate} onChange={e => setRetireInputs({...retireInputs, investmentRate: Number(e.target.value)})} className="w-full accent-green-600 cursor-pointer h-1 bg-gray-200 rounded-lg appearance-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'education' && (
                            <div className="space-y-4 animate-fade-in">
                                {/* Education Inputs */}
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
                    
                    {/* 1. HERO RESULT: SPLIT VIEW COMPARISON (Retirement) */}
                    {activeTab === 'retirement' ? (
                        <div className="space-y-4">
                            {/* Comparison Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* BANK OPTION */}
                                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-3 opacity-10"><i className="fas fa-university text-6xl"></i></div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold px-2 py-1 rounded">PHƯƠNG ÁN A</span>
                                            <span className="text-xs font-medium text-gray-500">Gửi Ngân hàng ({retireInputs.savingsRate}%)</span>
                                        </div>
                                        <div className="mb-4">
                                            <p className="text-xs text-gray-500 uppercase font-bold">Cần tiết kiệm mỗi tháng</p>
                                            <p className="text-2xl font-black text-gray-700 dark:text-gray-300">{formatMoney(bankResult.monthlySavingNeeded || 0)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">Quỹ cần có (tuổi {retireInputs.retireAge})</p>
                                            <p className="text-lg font-bold text-gray-600 dark:text-gray-400">{formatMoney(bankResult.requiredAmount)}</p>
                                            <p className="text-[10px] text-red-500 italic mt-1">*Cần quỹ lớn hơn vì tiền sinh lời chậm.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* INVESTMENT OPTION */}
                                <div className="bg-gradient-to-br from-green-600 to-green-800 text-white rounded-2xl p-5 shadow-xl relative overflow-hidden transform md:scale-105 transition-transform z-10 border border-green-500">
                                    <div className="absolute top-0 right-0 p-3 opacity-20"><i className="fas fa-chart-line text-6xl"></i></div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="bg-white text-green-700 text-[10px] font-bold px-2 py-1 rounded">PHƯƠNG ÁN B</span>
                                            <span className="text-xs font-medium text-green-100">Đầu tư ILP ({retireInputs.investmentRate}%)</span>
                                        </div>
                                        <div className="mb-4">
                                            <p className="text-xs text-green-200 uppercase font-bold">Cần tiết kiệm mỗi tháng</p>
                                            <p className="text-3xl font-black text-white">{formatMoney(investResult.monthlySavingNeeded || 0)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-green-200 uppercase font-bold">Quỹ cần có (tuổi {retireInputs.retireAge})</p>
                                            <p className="text-lg font-bold text-white">{formatMoney(investResult.requiredAmount)}</p>
                                            
                                            {/* Disclaimer about asset movement */}
                                            {retireInputs.savings > 0 && !moveAssetsToInvestment && (
                                                <p className="text-[10px] text-green-200 italic mt-1 border-t border-green-500/50 pt-1">
                                                    *Lưu ý: Tài sản {formatMoney(retireInputs.savings)} hiện tại vẫn tính lãi ngân hàng ({retireInputs.savingsRate}%).
                                                </p>
                                            )}
                                            {retireInputs.savings > 0 && moveAssetsToInvestment && (
                                                <p className="text-[10px] text-green-200 italic mt-1 border-t border-green-500/50 pt-1">
                                                    *Đã tính: Chuyển {formatMoney(retireInputs.savings)} sang đầu tư ({retireInputs.investmentRate}%).
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Contrast Effect Banner */}
                            {moneySaved > 0 && (
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-4 rounded-xl flex items-center justify-between animate-pulse">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl">
                                            <i className="fas fa-hand-holding-usd"></i>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase">Lợi ích từ việc đầu tư</p>
                                            <p className="text-sm text-indigo-700 dark:text-indigo-200">
                                                Giúp anh/chị giảm gánh nặng <strong>{formatMoney(moneySaved)}/tháng</strong> so với gửi ngân hàng.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="hidden md:block text-right">
                                        <p className="text-[10px] text-gray-500 uppercase">Tiền dư ra dùng để:</p>
                                        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-300">Du lịch / Mua sắm</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        // Default Single View for Education/Compound (Keep as is)
                        <div className="bg-gray-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                             {activeTab === 'education' ? (
                                <div className="relative z-10">
                                    <p className="text-gray-400 font-bold text-sm uppercase tracking-widest mb-1">Quỹ học vấn cần có</p>
                                    <h2 className="text-3xl md:text-4xl font-black mb-2 text-white">{formatMoney(eduResult.requiredAmount)}</h2>
                                    <p className="text-sm text-gray-400">Đã tính lạm phát {eduInputs.inflationRate}%/năm</p>
                                </div>
                             ) : (
                                <div className="flex justify-between items-center z-10 relative">
                                    <div>
                                        <p className="text-indigo-200 font-bold text-sm uppercase tracking-widest mb-1">Tổng tài sản</p>
                                        <h2 className="text-4xl font-black text-white">{formatMoney(compoundResult.total)}</h2>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-indigo-200 text-xs">Tổng gốc: {formatMoney(compoundResult.totalPrincipal)}</p>
                                        <p className="text-green-300 font-bold text-lg">+ {formatMoney(compoundResult.interest)} (Lãi)</p>
                                    </div>
                                </div>
                             )}
                        </div>
                    )}

                    {/* 2. CHART - COMPARISON */}
                    {activeTab === 'retirement' && (
                        <div className="bg-white dark:bg-pru-card p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 text-sm uppercase">So sánh gánh nặng tiết kiệm hàng tháng</h3>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={comparisonData} layout="horizontal" barSize={40}>
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} />
                                        <YAxis hide />
                                        <Tooltip 
                                            formatter={(value: number) => formatMoney(value)} 
                                            cursor={{fill: 'transparent'}}
                                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                                        />
                                        <Bar dataKey="Tiết kiệm hàng tháng" radius={[8, 8, 0, 0]}>
                                            {comparisonData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* 3. CONSULTATION SCRIPT CARD (Retirement Specific - Updated Logic) */}
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
                                        <i className="fas fa-microphone-alt"></i> Kịch bản: Hiệu ứng Tương phản
                                    </h3>
                                    
                                    <div className="space-y-6 text-base text-gray-800 dark:text-gray-200 leading-loose">
                                        {/* Part 1: The Goal */}
                                        <div>
                                            <strong className="block text-gray-500 dark:text-gray-400 mb-1 uppercase text-xs tracking-wider">1. Xác nhận mục tiêu</strong>
                                            <p className="italic">
                                                "Thưa anh/chị, để duy trì mức sống <strong>{formatMoney(retireInputs.expense)}/tháng</strong> khi về hưu và chống lại lạm phát {retireInputs.inflationRate}%, chúng ta cần xây dựng một "cỗ máy in tiền" (Quỹ hưu) tại tuổi {retireInputs.retireAge}."
                                            </p>
                                        </div>

                                        {/* Part 2: The Contrast */}
                                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800">
                                            <strong className="block text-indigo-800 dark:text-indigo-300 mb-2 uppercase text-xs tracking-wider">2. Đưa ra lựa chọn (Contrast)</strong>
                                            <p className="italic">
                                                "Em đã tính toán 2 phương án cho anh/chị:
                                                <br/><br/>
                                                <span className="text-gray-500">🔸 Phương án A (Ngân hàng - {retireInputs.savingsRate}%):</span> Vì tiền sinh lời chậm, anh/chị phải tự "cày cuốc" vất vả hơn. Cần để dành tới <strong>{formatMoney(bankResult.monthlySavingNeeded || 0)}/tháng</strong>. Con số này có ảnh hưởng đến chi tiêu gia đình hiện tại không ạ?
                                                <br/><br/>
                                                <span className="text-green-600 font-bold">🔹 Phương án B (Đầu tư - {retireInputs.investmentRate}%):</span> Nhờ lãi suất kép làm việc thay anh/chị, gánh nặng giảm đi một nửa. Anh/chị chỉ cần tiết kiệm <strong>{formatMoney(investResult.monthlySavingNeeded || 0)}/tháng</strong> thôi."
                                                {retireInputs.savings > 0 && !moveAssetsToInvestment && (
                                                    <span className="block mt-2 text-xs text-gray-500">*Lưu ý: Em vẫn đang tính khoản {formatMoney(retireInputs.savings)} hiện tại của anh chị tiếp tục gửi ngân hàng cho an toàn, chỉ khoản tiết kiệm mới hàng tháng mới mang đi đầu tư.</span>
                                                )}
                                            </p>
                                        </div>

                                        {/* Part 3: The Closing */}
                                        <div>
                                            <strong className="block text-green-600 dark:text-green-400 mb-1 uppercase text-xs tracking-wider">3. Chốt vấn đề</strong>
                                            <p>
                                                "Anh/chị thấy đấy, <strong>{formatMoney(moneySaved)} chênh lệch mỗi tháng</strong> chính là phần thưởng cho việc biết quản lý tài chính thông minh.
                                                <br/>
                                                Anh/chị muốn chọn cách 'Làm việc chăm chỉ' (gửi {formatMoney(bankResult.monthlySavingNeeded || 0)}) hay cách 'Làm việc thông minh' (gửi {formatMoney(investResult.monthlySavingNeeded || 0)}) ạ?"
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
