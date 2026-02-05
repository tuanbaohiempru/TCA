
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CurrencyInput } from '../components/Shared';
import { calculateRetirement, calculateEducation, calculateProtection } from '../services/financialCalculator';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell, CartesianGrid } from 'recharts';

const FinancialPlanning: React.FC = () => {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<'retirement' | 'education' | 'protection'>('retirement');

    // --- EFFECT: DEEP LINKING ---
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tabParam = params.get('tab');
        if (tabParam && ['retirement', 'education', 'protection'].includes(tabParam)) {
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
    
    // NEW: Show Detailed Calculation Toggle
    const [showDetails, setShowDetails] = useState(false);

    // Education State
    const [eduInputs, setEduInputs] = useState({
        childAge: 5, uniStartAge: 18, duration: 4, 
        tuition: 50000000, // Học phí
        livingCost: 50000000, // Sinh hoạt phí
        currentSavings: 50000000, 
        inflationRate: 8, investmentRate: 12,
        schoolType: 'public'
    });

    // Protection State (Income Protection)
    const [protectInputs, setProtectInputs] = useState({
        monthlyIncome: 30000000, // Thu nhập người trụ cột
        supportYears: 10, // Số năm cần bảo vệ
        loans: 500000000, // Nợ ngân hàng
        existingInsurance: 0, // Mệnh giá BHNT đã có
        existingSavings: 100000000 // Tiền mặt khẩn cấp
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
        eduInputs.tuition + eduInputs.livingCost, // Total Annual Cost
        eduInputs.inflationRate / 100, 
        eduInputs.investmentRate / 100, 
        eduInputs.currentSavings
    ), [eduInputs]);

    const protectResult = useMemo(() => calculateProtection(
        protectInputs.monthlyIncome,
        protectInputs.supportYears,
        protectInputs.existingInsurance + protectInputs.existingSavings,
        protectInputs.loans
    ), [protectInputs]);

    // --- CHART DATA ---
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

    // Education Chart: Principal vs Interest
    const eduChartData = useMemo(() => {
        if (activeTab === 'education' && eduResult.shortfall > 0) {
            const months = eduResult.details.yearsToUni * 12;
            const totalContribution = (eduResult.monthlySavingNeeded || 0) * months;
            const interestEarned = Math.max(0, eduResult.shortfall - totalContribution);
            
            return [
                {
                    name: 'Cơ cấu Quỹ',
                    "Vốn gốc của anh/chị": totalContribution,
                    "Lãi đầu tư sinh ra": interestEarned
                }
            ];
        }
        return [];
    }, [activeTab, eduResult]);

    // Protection Chart: Coverage vs Gap
    const protectChartData = useMemo(() => {
        if (activeTab === 'protection') {
            return [
                {
                    name: 'Bảo vệ Thu nhập',
                    "Đã chuẩn bị": protectResult.currentAmount,
                    "Thiếu hụt (Gap)": protectResult.shortfall,
                }
            ];
        }
        return [];
    }, [activeTab, protectResult]);

    // --- RENDER HELPERS ---
    const formatMoney = (amount: number) => amount.toLocaleString('vi-VN') + ' đ';
    const moneySaved = Math.max(0, (bankResult.monthlySavingNeeded || 0) - (investResult.monthlySavingNeeded || 0));

    // Helper to render Calculation Steps
    const CalculationSteps = ({ result, inputs, type, title }: { result: any, inputs: any, type: 'bank' | 'invest', title: string }) => {
        const isBank = type === 'bank';
        const rate = isBank ? inputs.savingsRate : inputs.investmentRate;
        const assetRate = isBank ? inputs.savingsRate : (moveAssetsToInvestment ? inputs.investmentRate : inputs.savingsRate);
        
        return (
            <div className={`p-4 rounded-xl border text-xs font-mono space-y-3 ${isBank ? 'bg-gray-50 border-gray-200 text-gray-700' : 'bg-green-50 border-green-200 text-green-800'}`}>
                <h4 className="font-bold border-b pb-2 mb-2 uppercase">{title}</h4>
                
                {/* 1. Inflation Logic */}
                <div>
                    <div className="flex justify-between font-bold">1. Chi tiêu năm {inputs.retireAge} tuổi:</div>
                    <div className="pl-2 opacity-80">
                        {formatMoney(inputs.expense)} × (1 + {inputs.inflationRate}%)^
                        {result.details.yearsToRetire} năm
                    </div>
                    <div className="pl-2 font-bold text-right">= {formatMoney(Math.round(result.details.futureMonthlyExpense))} / tháng</div>
                </div>

                {/* 2. Pension Offset */}
                {result.details.estimatedPension > 0 && (
                    <div>
                        <div className="flex justify-between font-bold text-blue-600">2. Trừ Lương hưu BHXH:</div>
                        <div className="pl-2 text-right text-blue-600 font-bold">- {formatMoney(Math.round(result.details.estimatedPension))} / tháng</div>
                        <div className="pl-2 text-right border-t border-dashed border-gray-300 pt-1">
                            Còn cần: {formatMoney(Math.round(result.details.netMonthlyNeeded))} / tháng
                        </div>
                    </div>
                )}

                {/* 3. Total Fund Logic */}
                <div>
                    <div className="flex justify-between font-bold">3. Tổng Quỹ Hưu cần có:</div>
                    <div className="pl-2 opacity-80">
                        Để rút {formatMoney(Math.round(result.details.netMonthlyNeeded))} trong {result.details.yearsInRetirement} năm 
                        <br/>(Lãi suất thực dương: {result.details.realRate.toFixed(2)}%)
                    </div>
                    <div className="pl-2 font-bold text-right text-lg border-b border-gray-300 pb-1">= {formatMoney(result.requiredAmount)}</div>
                </div>

                {/* 4. Asset Growth Logic */}
                <div>
                    <div className="flex justify-between font-bold">4. Tài sản {formatMoney(inputs.savings)} sinh lời:</div>
                    <div className="pl-2 opacity-80">
                        Lãi suất áp dụng: {assetRate}%/năm
                    </div>
                    <div className="pl-2 font-bold text-right text-lg">= {formatMoney(result.currentAmount)}</div>
                    {!isBank && !moveAssetsToInvestment && inputs.savings > 0 && <div className="text-[9px] text-right italic">(Vẫn tính lãi ngân hàng)</div>}
                </div>

                {/* 5. Shortfall Logic */}
                <div className={`${result.shortfall > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    <div className="flex justify-between font-bold">5. Thiếu hụt (Cần bù đắp):</div>
                    <div className="pl-2 text-right font-black text-xl">= {formatMoney(result.shortfall)}</div>
                </div>

                {/* 6. Monthly Savings Logic */}
                {result.shortfall > 0 && (
                    <div>
                        <div className="flex justify-between font-bold">6. Cần tiết kiệm hàng tháng:</div>
                        <div className="pl-2 opacity-80">
                            Trong {result.details.yearsToRetire} năm với lãi suất {rate}%
                        </div>
                        <div className="pl-2 text-right font-black text-xl border-t-2 border-current pt-1">= {formatMoney(result.monthlySavingNeeded)}</div>
                    </div>
                )}
            </div>
        );
    };

    const handleSchoolTypeChange = (type: string) => {
        setEduInputs(prev => {
            let update = { ...prev, schoolType: type };
            if (type === 'public') {
                update.inflationRate = 8;
                update.tuition = 50000000;
                update.livingCost = 60000000;
            } else if (type === 'international') {
                update.inflationRate = 10;
                update.tuition = 300000000;
                update.livingCost = 100000000;
            } else if (type === 'abroad') {
                update.inflationRate = 6;
                update.tuition = 800000000;
                update.livingCost = 400000000;
            }
            return update;
        });
    };

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
                <button onClick={() => setActiveTab('protection')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition ${activeTab === 'protection' ? 'bg-white dark:bg-pru-card text-pru-red shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><i className="fas fa-shield-alt mr-2"></i>Bảo vệ Thu nhập</button>
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
                                {/* School Type Quick Select */}
                                <div>
                                    <label className="label-text">Loại hình trường (Gợi ý)</label>
                                    <select className="input-field font-bold" value={eduInputs.schoolType} onChange={e => handleSchoolTypeChange(e.target.value)}>
                                        <option value="public">Đại học Công lập (VN)</option>
                                        <option value="international">ĐH Quốc tế (RMIT/VinUni)</option>
                                        <option value="abroad">Du học (Mỹ/Úc)</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="label-text">Tuổi con hiện tại</label><input type="number" className="input-field" value={eduInputs.childAge} onChange={e => setEduInputs({...eduInputs, childAge: Number(e.target.value)})} /></div>
                                    <div><label className="label-text">Tuổi vào ĐH</label><input type="number" className="input-field" value={eduInputs.uniStartAge} onChange={e => setEduInputs({...eduInputs, uniStartAge: Number(e.target.value)})} /></div>
                                </div>
                                
                                <div><label className="label-text">Học phí / năm (Hiện tại)</label><CurrencyInput className="input-field" value={eduInputs.tuition} onChange={v => setEduInputs({...eduInputs, tuition: v})} /></div>
                                <div><label className="label-text">Sinh hoạt phí / năm (Hiện tại)</label><CurrencyInput className="input-field" value={eduInputs.livingCost} onChange={v => setEduInputs({...eduInputs, livingCost: v})} /></div>
                                
                                <div><label className="label-text">Đã tích lũy</label><CurrencyInput className="input-field" value={eduInputs.currentSavings} onChange={v => setEduInputs({...eduInputs, currentSavings: v})} /></div>
                                
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900 space-y-4">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-gray-500">Lạm phát giáo dục:</span>
                                            <span className="font-bold text-xs text-red-500">{eduInputs.inflationRate}%</span>
                                        </div>
                                        <input type="range" min="1" max="15" step="0.5" value={eduInputs.inflationRate} onChange={e => setEduInputs({...eduInputs, inflationRate: Number(e.target.value)})} className="w-full accent-red-500 cursor-pointer h-1 bg-gray-200 rounded-lg appearance-none" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-gray-500">Lãi suất đầu tư:</span>
                                            <span className="font-bold text-xs text-green-600">{eduInputs.investmentRate}%</span>
                                        </div>
                                        <input type="range" min="5" max="15" step="0.5" value={eduInputs.investmentRate} onChange={e => setEduInputs({...eduInputs, investmentRate: Number(e.target.value)})} className="w-full accent-green-600 cursor-pointer h-1 bg-gray-200 rounded-lg appearance-none" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'protection' && (
                            <div className="space-y-4 animate-fade-in">
                                <div>
                                    <label className="label-text text-blue-600">Thu nhập người trụ cột (Tháng)</label>
                                    <CurrencyInput className="input-field font-bold" value={protectInputs.monthlyIncome} onChange={v => setProtectInputs({...protectInputs, monthlyIncome: v})} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="label-text">Số năm cần bảo vệ (Nuôi con)</label>
                                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{protectInputs.supportYears} năm</span>
                                    </div>
                                    <input type="range" min="5" max="25" value={protectInputs.supportYears} onChange={e => setProtectInputs({...protectInputs, supportYears: Number(e.target.value)})} className="w-full accent-blue-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg appearance-none" />
                                </div>
                                <div>
                                    <label className="label-text text-red-600">Dư nợ hiện tại (Vay NH, Vay ngoài)</label>
                                    <CurrencyInput className="input-field font-bold text-red-600" value={protectInputs.loans} onChange={v => setProtectInputs({...protectInputs, loans: v})} />
                                </div>
                                <div className="border-t border-dashed border-gray-200 dark:border-gray-700 pt-4 mt-2">
                                    <label className="label-text">Mệnh giá BHNT đang có</label>
                                    <CurrencyInput className="input-field" value={protectInputs.existingInsurance} onChange={v => setProtectInputs({...protectInputs, existingInsurance: v})} />
                                </div>
                                <div>
                                    <label className="label-text">Tài sản thanh khoản (Tiền mặt/Vàng)</label>
                                    <CurrencyInput className="input-field" value={protectInputs.existingSavings} onChange={v => setProtectInputs({...protectInputs, existingSavings: v})} />
                                </div>
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

                            {/* DETAIL TOGGLE & BREAKDOWN */}
                            <div>
                                <button 
                                    onClick={() => setShowDetails(!showDetails)}
                                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 mb-2"
                                >
                                    <i className={`fas ${showDetails ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                                    {showDetails ? 'Ẩn chi tiết cách tính' : 'Xem chi tiết cách tính (Minh bạch hóa)'}
                                </button>
                                
                                {showDetails && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                                        <CalculationSteps title="A. GỬI NGÂN HÀNG (LÃI ĐƠN)" result={bankResult} inputs={retireInputs} type="bank" />
                                        <CalculationSteps title="B. ĐẦU TƯ (LÃI KÉP)" result={investResult} inputs={retireInputs} type="invest" />
                                    </div>
                                )}
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
                    ) : activeTab === 'education' ? (
                        <div className="space-y-6">
                            {/* EDUCATION HERO */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-800 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10"><i className="fas fa-user-graduate text-8xl"></i></div>
                                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <p className="text-blue-200 font-bold text-sm uppercase tracking-widest mb-1">Cần chuẩn bị (Tuổi 18)</p>
                                        <h2 className="text-4xl font-black mb-2">{formatMoney(eduResult.requiredAmount)}</h2>
                                        <p className="text-sm text-blue-100 opacity-90">Tổng chi phí {eduInputs.duration} năm đại học (đã tính lạm phát {eduInputs.inflationRate}%)</p>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 text-center min-w-[150px]">
                                        <p className="text-xs font-bold text-blue-100 uppercase">Tiết kiệm tháng</p>
                                        <p className="text-xl font-black text-white">{formatMoney(eduResult.monthlySavingNeeded || 0)}</p>
                                        <p className="text-[10px] text-blue-200 mt-1">Lãi đầu tư: {eduInputs.investmentRate}%</p>
                                    </div>
                                </div>
                            </div>

                            {/* EDUCATION BREAKDOWN */}
                            <div className="bg-white dark:bg-pru-card p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 text-sm uppercase flex items-center gap-2">
                                    <i className="fas fa-list-ol text-blue-500"></i> Giải trình tài chính
                                </h3>
                                <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 font-mono">
                                    {/* Step 1 */}
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                        <div className="font-bold text-blue-800 dark:text-blue-300 mb-1">B1. Sức mạnh Lạm phát giáo dục</div>
                                        <div className="flex justify-between">
                                            <span>Chi phí hiện tại: {formatMoney(eduInputs.tuition + eduInputs.livingCost)}</span>
                                            <i className="fas fa-arrow-right text-gray-400 mx-2"></i>
                                            <span className="font-bold">Năm 1 Đại học: {formatMoney(Math.round(eduResult.details.futureTuitionFirstYear))}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-1 italic">Sau {eduResult.details.yearsToUni} năm với lạm phát {eduInputs.inflationRate}%/năm.</p>
                                    </div>

                                    {/* Step 2 */}
                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                                        <div className="font-bold text-indigo-800 dark:text-indigo-300 mb-1">B2. Tổng gánh nặng {eduInputs.duration} năm</div>
                                        <div className="flex justify-between items-center">
                                            <span>Cộng dồn (có trượt giá tiếp):</span>
                                            <span className="font-bold text-lg">{formatMoney(eduResult.requiredAmount)}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-1 italic">Đây là "Kho tiền" cần có sẵn khi con 18 tuổi.</p>
                                    </div>

                                    {/* Step 3 */}
                                    <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/30">
                                        <div className="font-bold text-green-800 dark:text-green-300 mb-1">B3. Đòn bẩy Tài chính (Lãi kép)</div>
                                        <div className="flex justify-between">
                                            <span>Thay vì để dành (Lãi 0%): {formatMoney(Math.round(eduResult.shortfall / (eduResult.details.yearsToUni * 12)))}/tháng</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-green-600 mt-1 pt-1 border-t border-green-200 dark:border-green-800">
                                            <span>Đầu tư ({eduInputs.investmentRate}%): Chỉ cần {formatMoney(eduResult.monthlySavingNeeded || 0)}/tháng</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* EDUCATION CHART */}
                            {eduChartData.length > 0 && (
                                <div className="bg-white dark:bg-pru-card p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 text-sm uppercase">Cơ cấu Quỹ học vấn (Đòn bẩy)</h3>
                                    <div className="h-64 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={eduChartData} layout="vertical" barSize={40}>
                                                <XAxis type="number" hide />
                                                <YAxis type="category" dataKey="name" hide />
                                                <Tooltip formatter={(value: number) => formatMoney(value)} cursor={{fill: 'transparent'}} />
                                                <Legend verticalAlign="top" height={36}/>
                                                <Bar dataKey="Vốn gốc của anh/chị" stackId="a" fill="#9ca3af" radius={[4, 0, 0, 4]} />
                                                <Bar dataKey="Lãi đầu tư sinh ra" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <p className="text-xs text-center text-gray-500 mt-2 italic">Hơn 50% quỹ học vấn có thể đến từ lãi suất nếu chuẩn bị sớm.</p>
                                </div>
                            )}

                            {/* EDUCATION SCRIPT */}
                            <div className="flex justify-end">
                                <button onClick={() => setShowScript(!showScript)} className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-3 py-2 rounded-lg transition">
                                    <i className={`fas ${showScript ? 'fa-eye-slash' : 'fa-comment-dots'}`}></i> 
                                    {showScript ? 'Ẩn kịch bản' : 'Hiện kịch bản tư vấn'}
                                </button>
                            </div>
                            
                            {showScript && (
                                <div className="bg-white dark:bg-pru-card p-6 rounded-2xl border-l-4 border-blue-500 shadow-lg animate-fade-in relative">
                                    <div className="absolute top-0 right-0 p-4 opacity-10"><i className="fas fa-graduation-cap text-6xl text-blue-500"></i></div>
                                    <h3 className="font-bold text-lg mb-4 text-blue-700 dark:text-blue-300 flex items-center gap-2"><i className="fas fa-microphone-alt"></i> Kịch bản: Món quà hay Món nợ?</h3>
                                    <div className="space-y-4 text-base text-gray-800 dark:text-gray-200 leading-loose">
                                        <p className="italic">"Thưa anh/chị, con số <strong>{formatMoney(eduResult.requiredAmount)}</strong> này nghe có vẻ lớn, nhưng đó là thực tế của 15 năm nữa."</p>
                                        <p className="italic">"Ở tuổi 22 khi con tốt nghiệp, anh/chị muốn trao cho con một <strong>tấm bằng Đại học sạch sẽ</strong> hay một <strong>tấm bằng kèm theo khoản nợ sinh viên</strong>?"</p>
                                        <p className="italic">"Nếu chúng ta không chuẩn bị ngay từ bây giờ (khi con {eduInputs.childAge} tuổi), thì đến năm 18 tuổi, áp lực tài chính khổng lồ này sẽ dồn lên vai ai? Lên vai anh chị lúc đó đã lớn tuổi, hay lên vai con phải vừa học vừa làm?"</p>
                                        <p className="italic font-bold text-blue-600">"Chỉ cần để dành {formatMoney(eduResult.monthlySavingNeeded || 0)}/tháng ngay từ hôm nay, anh/chị đã đảm bảo tương lai cho con, bất kể điều gì xảy ra."</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        // PROTECTION VIEW (Replaced Compound)
                        <div className="space-y-6">
                            {/* PROTECTION HERO */}
                            <div className="bg-gradient-to-r from-red-600 to-red-800 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10"><i className="fas fa-umbrella text-8xl"></i></div>
                                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <p className="text-red-200 font-bold text-sm uppercase tracking-widest mb-1">Tổng Quỹ Dự Phòng Cần Có</p>
                                        <h2 className="text-4xl font-black mb-2">{formatMoney(protectResult.requiredAmount)}</h2>
                                        <p className="text-sm text-red-100 opacity-90">Bảo vệ thu nhập {protectInputs.supportYears} năm & Che chắn khoản nợ.</p>
                                    </div>
                                    <div className={`bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 text-center min-w-[150px] ${protectResult.shortfall > 0 ? 'border-l-4 border-l-yellow-400' : 'border-l-4 border-l-green-400'}`}>
                                        <p className="text-xs font-bold text-red-100 uppercase">Thiếu hụt (Gap)</p>
                                        <p className="text-xl font-black text-white">{formatMoney(protectResult.shortfall)}</p>
                                        <p className="text-[10px] text-red-200 mt-1">{protectResult.shortfall > 0 ? 'Cần bổ sung ngay' : 'Đã an toàn'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* PROTECTION BREAKDOWN */}
                            <div className="bg-white dark:bg-pru-card p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 text-sm uppercase flex items-center gap-2">
                                    <i className="fas fa-list-ul text-red-500"></i> Cơ cấu Quỹ Trụ cột
                                </h3>
                                <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 font-mono">
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                        <div className="font-bold text-blue-800 dark:text-blue-300 mb-1">1. Thay thế thu nhập (Income Replacement)</div>
                                        <div className="flex justify-between">
                                            <span>{formatMoney(protectInputs.monthlyIncome)} x 12 tháng x {protectInputs.supportYears} năm</span>
                                            <span className="font-bold text-lg text-right">{formatMoney(protectResult.details.incomeProtectionNeeded)}</span>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
                                        <div className="font-bold text-red-800 dark:text-red-300 mb-1">2. Trả nợ thay (Debt Hedge)</div>
                                        <div className="flex justify-between items-center">
                                            <span>Khoản vay ngân hàng/ngoài:</span>
                                            <span className="font-bold text-lg">{formatMoney(protectResult.details.debtCoverage)}</span>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/30">
                                        <div className="font-bold text-green-800 dark:text-green-300 mb-1">3. Tài sản đảm bảo hiện có</div>
                                        <div className="flex justify-between">
                                            <span>BHNT + Tiền mặt + Vàng:</span>
                                            <span className="font-bold text-lg text-green-600"> - {formatMoney(protectResult.currentAmount)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* PROTECTION CHART */}
                            {protectChartData.length > 0 && (
                                <div className="bg-white dark:bg-pru-card p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 text-sm uppercase">Biểu đồ Trách nhiệm Tài chính</h3>
                                    <div className="h-40 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={protectChartData} layout="vertical" barSize={40}>
                                                <XAxis type="number" hide />
                                                <YAxis type="category" dataKey="name" hide />
                                                <Tooltip formatter={(value: number) => formatMoney(value)} cursor={{fill: 'transparent'}} />
                                                <Legend verticalAlign="top" height={36}/>
                                                <Bar dataKey="Đã chuẩn bị" stackId="a" fill="#10b981" radius={[4, 0, 0, 4]} />
                                                <Bar dataKey="Thiếu hụt (Gap)" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* PROTECTION SCRIPT */}
                            <div className="flex justify-end">
                                <button onClick={() => setShowScript(!showScript)} className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 py-2 rounded-lg transition">
                                    <i className={`fas ${showScript ? 'fa-eye-slash' : 'fa-comment-dots'}`}></i> 
                                    {showScript ? 'Ẩn kịch bản' : 'Hiện kịch bản tư vấn'}
                                </button>
                            </div>
                            
                            {showScript && (
                                <div className="bg-white dark:bg-pru-card p-6 rounded-2xl border-l-4 border-red-500 shadow-lg animate-fade-in relative">
                                    <div className="absolute top-0 right-0 p-4 opacity-10"><i className="fas fa-print text-6xl text-red-500"></i></div>
                                    <h3 className="font-bold text-lg mb-4 text-red-700 dark:text-red-300 flex items-center gap-2"><i className="fas fa-microphone-alt"></i> Kịch bản: Máy in tiền</h3>
                                    <div className="space-y-4 text-base text-gray-800 dark:text-gray-200 leading-loose">
                                        <p className="italic">"Thưa anh/chị, anh/chị chính là 'Máy in tiền' của gia đình, đều đặn mang về <strong>{formatMoney(protectInputs.monthlyIncome)}/tháng</strong> để lo cơm áo gạo tiền và trả khoản nợ {formatMoney(protectInputs.loans)}."</p>
                                        <p className="italic">"Nếu chẳng may cái máy này hỏng vĩnh viễn (rủi ro), thì ai sẽ là người in ra số tiền <strong>{formatMoney(protectResult.requiredAmount)}</strong> này để nuôi con trong {protectInputs.supportYears} năm tới và trả hết nợ nần?"</p>
                                        <p className="italic font-bold text-red-600">"Chỉ với khoảng 2-3 triệu/tháng thôi, em sẽ giúp anh chị xây dựng ngay một 'Máy in tiền dự phòng' trị giá {formatMoney(protectResult.shortfall)}, hoạt động ngay lập tức khi cần thiết."</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 2. CHART - RETIREMENT COMPARISON (Only for Retirement Tab) */}
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
