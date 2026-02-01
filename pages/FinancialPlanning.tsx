
import React, { useState, useMemo } from 'react';
import { CurrencyInput } from '../components/Shared';
import { calculateRetirement, calculateEducation } from '../services/financialCalculator';
import { FinancialGoal } from '../types';

const FinancialPlanning: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'retirement' | 'education' | 'compound'>('retirement');

    // Retirement State
    const [retireInputs, setRetireInputs] = useState({
        currentAge: 30, retireAge: 60, lifeExpectancy: 85, expense: 15000000, savings: 100000000
    });

    // Education State
    const [eduInputs, setEduInputs] = useState({
        childAge: 5, uniStartAge: 18, duration: 4, annualTuition: 100000000, currentSavings: 50000000
    });

    // Compound State
    const [compoundInputs, setCompoundInputs] = useState({
        principal: 100000000, monthlyAdd: 5000000, rate: 8, years: 15
    });

    const retireResult = useMemo(() => calculateRetirement(
        retireInputs.currentAge, retireInputs.retireAge, retireInputs.lifeExpectancy, retireInputs.expense, 0.04, 0.07, retireInputs.savings
    ), [retireInputs]);

    const eduResult = useMemo(() => calculateEducation(
        eduInputs.childAge, eduInputs.uniStartAge, eduInputs.duration, eduInputs.annualTuition, 0.05, 0.07, eduInputs.currentSavings
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

    return (
        <div className="space-y-6 pb-20 max-w-4xl mx-auto">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 dark:text-gray-100">Máy tính Tài chính</h1>
                    <p className="text-sm text-gray-500">Giúp khách hàng nhìn thấy tương lai bằng con số.</p>
                </div>
            </header>

            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl">
                <button onClick={() => setActiveTab('retirement')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${activeTab === 'retirement' ? 'bg-white dark:bg-pru-card text-pru-red shadow-sm' : 'text-gray-500'}`}>Hưu trí</button>
                <button onClick={() => setActiveTab('education')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${activeTab === 'education' ? 'bg-white dark:bg-pru-card text-pru-red shadow-sm' : 'text-gray-500'}`}>Học vấn</button>
                <button onClick={() => setActiveTab('compound')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${activeTab === 'compound' ? 'bg-white dark:bg-pru-card text-pru-red shadow-sm' : 'text-gray-500'}`}>Lãi kép</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Input Panel */}
                <div className="bg-white dark:bg-pru-card p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
                    <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest">Thông số giả định</h3>
                    
                    {activeTab === 'retirement' && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label-text">Tuổi hiện tại</label><input type="number" className="input-field" value={retireInputs.currentAge} onChange={e => setRetireInputs({...retireInputs, currentAge: Number(e.target.value)})} /></div>
                                <div><label className="label-text">Tuổi về hưu</label><input type="number" className="input-field" value={retireInputs.retireAge} onChange={e => setRetireInputs({...retireInputs, retireAge: Number(e.target.value)})} /></div>
                            </div>
                            <div><label className="label-text">Chi tiêu tháng hiện tại</label><CurrencyInput className="input-field font-bold" value={retireInputs.expense} onChange={v => setRetireInputs({...retireInputs, expense: v})} /></div>
                            <div><label className="label-text">Tích lũy đã có</label><CurrencyInput className="input-field" value={retireInputs.savings} onChange={v => setRetireInputs({...retireInputs, savings: v})} /></div>
                        </>
                    )}

                    {activeTab === 'education' && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label-text">Tuổi của con</label><input type="number" className="input-field" value={eduInputs.childAge} onChange={e => setEduInputs({...eduInputs, childAge: Number(e.target.value)})} /></div>
                                <div><label className="label-text">Năm học ĐH</label><input type="number" className="input-field" value={eduInputs.duration} onChange={e => setEduInputs({...eduInputs, duration: Number(e.target.value)})} /></div>
                            </div>
                            <div><label className="label-text">Học phí/năm hiện tại</label><CurrencyInput className="input-field font-bold" value={eduInputs.annualTuition} onChange={v => setEduInputs({...eduInputs, annualTuition: v})} /></div>
                            <div><label className="label-text">Quỹ hiện có</label><CurrencyInput className="input-field" value={eduInputs.currentSavings} onChange={v => setEduInputs({...eduInputs, currentSavings: v})} /></div>
                        </>
                    )}

                    {activeTab === 'compound' && (
                        <>
                            <div><label className="label-text">Số vốn ban đầu</label><CurrencyInput className="input-field font-bold" value={compoundInputs.principal} onChange={v => setCompoundInputs({...compoundInputs, principal: v})} /></div>
                            <div><label className="label-text">Tiết kiệm thêm mỗi tháng</label><CurrencyInput className="input-field" value={compoundInputs.monthlyAdd} onChange={v => setCompoundInputs({...compoundInputs, monthlyAdd: v})} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label-text">Lãi suất kỳ vọng (%/năm)</label><input type="number" className="input-field" value={compoundInputs.rate} onChange={e => setCompoundInputs({...compoundInputs, rate: Number(e.target.value)})} /></div>
                                <div><label className="label-text">Thời gian (Năm)</label><input type="number" className="input-field" value={compoundInputs.years} onChange={e => setCompoundInputs({...compoundInputs, years: Number(e.target.value)})} /></div>
                            </div>
                        </>
                    )}
                </div>

                {/* Result Panel */}
                <div className="bg-gray-900 text-white p-8 rounded-3xl shadow-xl flex flex-col justify-center items-center text-center space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-pru-red/20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Kết quả ước tính</h3>
                    
                    {activeTab === 'retirement' && (
                        <div className="space-y-4">
                            <p className="text-gray-400 text-sm">Quỹ hưu cần có năm {retireInputs.retireAge} tuổi:</p>
                            <p className="text-4xl font-black text-pru-red">{(retireResult.requiredAmount / 1000000000).toFixed(2)} <span className="text-lg">Tỷ</span></p>
                            <div className="pt-4 border-t border-white/10 space-y-2">
                                <p className="text-xs text-gray-400 italic">Thiếu hụt so với hiện tại: {(retireResult.shortfall / 1000000).toLocaleString()} Tr</p>
                                <div className="bg-white/5 p-3 rounded-2xl">
                                    <p className="text-[10px] uppercase font-bold text-gray-500">Cần tiết kiệm thêm mỗi tháng</p>
                                    <p className="text-xl font-bold">{(retireResult.monthlySavingNeeded || 0).toLocaleString()} đ</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'education' && (
                        <div className="space-y-4">
                            <p className="text-gray-400 text-sm">Tổng quỹ học vấn cho con:</p>
                            <p className="text-4xl font-black text-blue-400">{(eduResult.requiredAmount / 1000000).toLocaleString()} <span className="text-lg">Tr</span></p>
                            <div className="pt-4 border-t border-white/10 space-y-2">
                                <p className="text-xs text-gray-400 italic">Còn thiếu: {(eduResult.shortfall / 1000000).toLocaleString()} Tr</p>
                                <div className="bg-white/5 p-3 rounded-2xl">
                                    <p className="text-[10px] uppercase font-bold text-gray-500">Tiết kiệm định kỳ hàng tháng</p>
                                    <p className="text-xl font-bold">{(eduResult.monthlySavingNeeded || 0).toLocaleString()} đ</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'compound' && (
                        <div className="space-y-4">
                            <p className="text-gray-400 text-sm">Giá trị tài sản sau {compoundInputs.years} năm:</p>
                            <p className="text-4xl font-black text-green-400">{(compoundResult / 1000000).toLocaleString()} <span className="text-lg">Tr</span></p>
                            <div className="pt-4 border-t border-white/10 text-xs text-gray-400 leading-relaxed">
                                <i className="fas fa-info-circle mr-1"></i> Lãi suất kép là kỳ quan thứ 8 của thế giới. Bắt đầu càng sớm, thành quả càng lớn.
                            </div>
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
            `}</style>
        </div>
    );
};

export default FinancialPlanning;
