
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Customer, Contract, InteractionType, TimelineItem, ClaimRecord, ClaimStatus, CustomerDocument, Gender, MaritalStatus, FinancialRole, IncomeTrend, RiskTolerance, PersonalityType, RelationshipType, ContractStatus, IssuanceType, FinancialStatus, ReadinessLevel, FinancialPriority, CustomerStatus, AssetType, LiabilityType, FinancialAsset, FinancialLiability } from '../types';
import { formatDateVN, CurrencyInput, SearchableCustomerSelect } from '../components/Shared';
import { uploadFile } from '../services/storage';
import { analyzeSocialInput, chatWithData } from '../services/geminiService';
import FamilyTree from '../components/FamilyTree';

interface CustomerDetailProps {
    customers: Customer[];
    contracts: Contract[];
    onUpdateCustomer: (c: Customer) => Promise<void>;
    onAddCustomer: (c: Customer) => Promise<void>;
}

const CustomerDetail: React.FC<CustomerDetailProps> = ({ customers, contracts, onUpdateCustomer, onAddCustomer }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    const customer = customers.find(c => c.id === id);
    const customerContracts = contracts.filter(c => c.customerId === id);

    const [activeTab, setActiveTab] = useState<'analysis' | 'timeline' | 'contracts' | 'claims' | 'docs' | 'info' | 'finance' | 'family'>('analysis');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isRelationModalOpen, setIsRelationModalOpen] = useState(false);
    const [isMagicScanning, setIsMagicScanning] = useState(false);

    // New Timeline State
    const [newInteraction, setNewInteraction] = useState<{type: InteractionType, content: string, title: string, date: string}>({
        type: InteractionType.NOTE, content: '', title: '', date: new Date().toISOString().split('T')[0]
    });

    // New Claim State
    const [isAddingClaim, setIsAddingClaim] = useState(false);
    const [newClaim, setNewClaim] = useState<Partial<ClaimRecord>>({
        benefitType: 'Nằm viện', amountRequest: 0, status: ClaimStatus.PENDING, dateSubmitted: new Date().toISOString().split('T')[0]
    });

    // Financial Assets/Liabilities
    const [newAsset, setNewAsset] = useState<Partial<FinancialAsset>>({ type: AssetType.CASH, name: '', value: 0 });
    const [newLiability, setNewLiability] = useState<Partial<FinancialLiability>>({ type: LiabilityType.MORTGAGE, name: '', amount: 0 });

    const gapAnalysis = useMemo(() => {
        if (!customer) return null;
        const incomeMonthly = customer.analysis?.incomeMonthly || 0;
        const annualIncome = incomeMonthly * 12;
        const targetProtection = Math.max(annualIncome * 10, 1000000000);
        const currentProtection = customerContracts.filter(c => c.status === ContractStatus.ACTIVE).reduce((sum, c) => sum + c.mainProduct.sumAssured, 0);
        const gapProtection = Math.max(0, targetProtection - currentProtection);
        const protectionProgress = Math.min(100, (currentProtection / targetProtection) * 100);
        const totalAssets = customer.assets?.reduce((sum, a) => sum + a.value, 0) || 0;
        const totalLiabilities = customer.liabilities?.reduce((sum, l) => sum + l.amount, 0) || 0;
        return { targetProtection, currentProtection, gapProtection, protectionProgress, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
    }, [customer, customerContracts]);

    const virtualTimeline = useMemo(() => {
        if (!customer) return [];
        let events: TimelineItem[] = [...(customer.timeline || [])];
        customerContracts.forEach(c => {
            events.push({
                id: `contract-${c.id}`, date: c.effectiveDate, type: InteractionType.CONTRACT,
                title: 'Tham gia Hợp đồng', content: `HĐ: ${c.contractNumber}\nSản phẩm: ${c.mainProduct.productName}`, result: 'Active'
            });
        });
        if (customer.claims) {
            customer.claims.forEach(cl => {
                events.push({
                    id: `claim-${cl.id}`, date: cl.dateSubmitted, type: InteractionType.CLAIM,
                    title: `Nộp yêu cầu Bồi thường`, content: `Quyền lợi: ${cl.benefitType}\nSố tiền: ${cl.amountRequest.toLocaleString()} đ`, result: cl.status
                });
            });
        }
        return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [customer, customerContracts]);

    if (!customer) return <div className="p-10 text-center">Không tìm thấy khách hàng</div>;

    const handleAddTimeline = async () => {
        if (!newInteraction.content) return alert("Vui lòng nhập nội dung");
        const newItem: TimelineItem = { id: Date.now().toString(), date: new Date(newInteraction.date).toISOString(), type: newInteraction.type, title: newInteraction.title || newInteraction.type, content: newInteraction.content };
        await onUpdateCustomer({ ...customer, timeline: [newItem, ...(customer.timeline || [])] });
        setNewInteraction({type: InteractionType.NOTE, content: '', title: '', date: new Date().toISOString().split('T')[0]});
    };

    const handleAddClaim = async () => {
        if (!newClaim.amountRequest) return alert("Vui lòng nhập số tiền");
        const item: ClaimRecord = { id: `cl_${Date.now()}`, dateSubmitted: newClaim.dateSubmitted || new Date().toISOString(), contractId: newClaim.contractId || '', benefitType: newClaim.benefitType || '', amountRequest: newClaim.amountRequest || 0, amountPaid: 0, status: ClaimStatus.PENDING, notes: newClaim.notes || '', documents: [] };
        await onUpdateCustomer({ ...customer, claims: [item, ...(customer.claims || [])] });
        setIsAddingClaim(false);
    };

    // --- FINANCE HANDLERS ---
    const handleAddAsset = async () => {
        if (!newAsset.name || !newAsset.value) return alert("Nhập tên và giá trị tài sản");
        const item: FinancialAsset = { id: Date.now().toString(), type: newAsset.type || AssetType.OTHER, name: newAsset.name, value: newAsset.value };
        await onUpdateCustomer({ ...customer, assets: [...(customer.assets || []), item] });
        setNewAsset({ type: AssetType.CASH, name: '', value: 0 });
    };

    const handleDeleteAsset = async (assetId: string) => {
        const updated = customer.assets?.filter(a => a.id !== assetId) || [];
        await onUpdateCustomer({ ...customer, assets: updated });
    };

    const handleAddLiability = async () => {
        if (!newLiability.name || !newLiability.amount) return alert("Nhập tên và số tiền nợ");
        const item: FinancialLiability = { id: Date.now().toString(), type: newLiability.type || LiabilityType.PERSONAL_LOAN, name: newLiability.name, amount: newLiability.amount };
        await onUpdateCustomer({ ...customer, liabilities: [...(customer.liabilities || []), item] });
        setNewLiability({ type: LiabilityType.MORTGAGE, name: '', amount: 0 });
    };

    const handleDeleteLiability = async (liabId: string) => {
        const updated = customer.liabilities?.filter(l => l.id !== liabId) || [];
        await onUpdateCustomer({ ...customer, liabilities: updated });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const url = await uploadFile(file, 'customer_docs');
            const newDoc: CustomerDocument = { id: Date.now().toString(), name: file.name, url, type: file.type.includes('image') ? 'image' : 'pdf', category, uploadDate: new Date().toISOString() };
            await onUpdateCustomer({ ...customer, documents: [...(customer.documents || []), newDoc] });
        } catch (err) { alert("Lỗi tải file"); }
    };

    const handleMagicScan = async () => {
        setIsMagicScanning(true);
        try {
            const aiResponse = await chatWithData(
                `Magic Scan hồ sơ: ${customer.fullName}. Lịch sử: ${JSON.stringify(virtualTimeline.slice(0,5))}. Phân tích tâm lý và trả về JSON {personality, riskTolerance, biggestWorry, suggestedAction}`,
                null,
                { customers: [customer], contracts: customerContracts, products: [], appointments: [], agentProfile: null, messageTemplates: [], illustrations: [] },
                []
            );
            const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const res = JSON.parse(jsonMatch[0]);
                const updated = { ...customer, analysis: { ...customer.analysis, personality: res.personality, riskTolerance: res.riskTolerance, biggestWorry: res.biggestWorry } };
                await onUpdateCustomer(updated);
                alert("Magic Scan hoàn tất!");
            }
        } catch (e) { 
            console.error(e);
            alert("Lỗi phân tích AI"); 
        }
        finally { setIsMagicScanning(false); }
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            {/* HEADER */}
            <div className="bg-white dark:bg-pru-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/customers')} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 transition"><i className="fas fa-arrow-left"></i></button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">{customer.fullName}</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{customer.status} • {formatDateVN(customer.dob)}</p>
                    </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={handleMagicScan} disabled={isMagicScanning} className="flex-1 md:flex-none bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30">
                        {isMagicScanning ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>} Magic Scan
                    </button>
                    <button onClick={() => setIsEditModalOpen(true)} className="flex-1 md:flex-none bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl font-bold text-sm border border-gray-200 dark:border-gray-700">Sửa hồ sơ</button>
                </div>
            </div>

            {/* TABS */}
            <div className="flex overflow-x-auto gap-2 border-b border-gray-200 dark:border-gray-800 pb-1 scrollbar-hide">
                {[
                    {id: 'analysis', label: 'Tài chính', icon: 'fa-chart-pie'},
                    {id: 'finance', label: 'Tài sản & Nợ', icon: 'fa-coins'},
                    {id: 'family', label: 'Gia phả', icon: 'fa-sitemap'},
                    {id: 'timeline', label: 'Dòng thời gian', icon: 'fa-history'},
                    {id: 'contracts', label: 'Hợp đồng', icon: 'fa-file-contract'},
                    {id: 'claims', label: 'Bồi thường', icon: 'fa-heartbeat'},
                    {id: 'docs', label: 'Hồ sơ', icon: 'fa-folder-open'},
                    {id: 'info', label: '360° Info', icon: 'fa-user'}
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-3 rounded-t-xl text-sm font-bold flex items-center gap-2 transition whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-pru-card text-pru-red border-b-2 border-pru-red shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                        <i className={`fas ${tab.icon}`}></i> {tab.label}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {activeTab === 'analysis' && gapAnalysis && (
                        <div className="bg-white dark:bg-pru-card rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><i className="fas fa-shield-alt text-blue-500"></i> Phân tích bảo vệ thu nhập</h3>
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-1"><span className="text-gray-500">Đã có: {gapAnalysis.currentProtection.toLocaleString()} đ</span><span className="text-gray-800 dark:text-gray-200">Mục tiêu: {gapAnalysis.targetProtection.toLocaleString()} đ</span></div>
                                    <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${gapAnalysis.protectionProgress < 80 ? 'bg-orange-500' : 'bg-green-500'}`} style={{width: `${gapAnalysis.protectionProgress}%`}}></div></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                        <p className="text-[10px] text-gray-400 uppercase font-bold">Tổng tài sản</p>
                                        <p className="text-lg font-black text-green-600">{gapAnalysis.totalAssets.toLocaleString()} đ</p>
                                    </div>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                        <p className="text-[10px] text-gray-400 uppercase font-bold">Tổng nợ</p>
                                        <p className="text-lg font-black text-red-600">{gapAnalysis.totalLiabilities.toLocaleString()} đ</p>
                                    </div>
                                </div>
                                {gapAnalysis.gapProtection > 0 && (
                                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30 flex justify-between items-center">
                                        <div><p className="text-[10px] font-bold text-red-600 uppercase">Thiếu hụt (Gap)</p><p className="text-xl font-black text-red-700 dark:text-red-400">{gapAnalysis.gapProtection.toLocaleString()} đ</p></div>
                                        <button onClick={() => navigate('/product-advisory', { state: { customerId: customer.id, suggestedSA: gapAnalysis.gapProtection } })} className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md">Thiết kế ngay</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'family' && (
                        <div className="bg-white dark:bg-pru-card rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg flex items-center gap-2"><i className="fas fa-sitemap text-pru-red"></i> Sơ đồ Gia phả</h3>
                                <button onClick={() => setIsRelationModalOpen(true)} className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 px-3 py-2 rounded-lg font-bold transition"><i className="fas fa-plus mr-1"></i> Thêm người thân</button>
                            </div>
                            <FamilyTree centerCustomer={customer} allCustomers={customers} contracts={contracts} />
                            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-2">Gợi ý Cross-sell từ Gia phả:</h4>
                                <ul className="text-xs text-blue-700 dark:text-blue-200 space-y-1 list-disc ml-4">
                                    <li>Kiểm tra xem <strong>Vợ/Chồng</strong> đã có thẻ sức khỏe chưa?</li>
                                    <li>Các <strong>Con</strong> đã có quỹ học vấn chưa?</li>
                                    <li><strong>Bố mẹ</strong> có cần bảo hiểm hưu trí hoặc bệnh hiểm nghèo không?</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {activeTab === 'finance' && (
                        <div className="space-y-6">
                            {/* ASSETS */}
                            <div className="bg-white dark:bg-pru-card rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                                <h3 className="font-bold text-green-600 text-sm uppercase mb-4 flex items-center"><i className="fas fa-wallet mr-2"></i> Tài sản</h3>
                                <div className="space-y-2 mb-4">
                                    {customer.assets?.map(a => (
                                        <div key={a.id} className="flex justify-between items-center p-3 bg-green-50/50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/20 group">
                                            <div>
                                                <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">{a.name}</p>
                                                <p className="text-[10px] text-gray-500">{a.type}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-black text-green-700 dark:text-green-400">{a.value.toLocaleString()} đ</span>
                                                <button onClick={() => handleDeleteAsset(a.id)} className="text-red-400 opacity-0 group-hover:opacity-100 transition"><i className="fas fa-trash"></i></button>
                                            </div>
                                        </div>
                                    ))}
                                    {(!customer.assets || customer.assets.length === 0) && <p className="text-sm text-gray-400 italic text-center py-2">Chưa có tài sản</p>}
                                </div>
                                <div className="grid grid-cols-12 gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <div className="col-span-3"><select className="input-field text-xs py-2" value={newAsset.type} onChange={(e: any) => setNewAsset({...newAsset, type: e.target.value})}>{Object.values(AssetType).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                    <div className="col-span-4"><input className="input-field text-xs py-2" placeholder="Tên tài sản" value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} /></div>
                                    <div className="col-span-3"><CurrencyInput className="input-field text-xs py-2" placeholder="Giá trị" value={newAsset.value || 0} onChange={v => setNewAsset({...newAsset, value: v})} /></div>
                                    <div className="col-span-2"><button onClick={handleAddAsset} className="w-full h-full bg-green-600 text-white rounded-lg font-bold text-xs">Thêm</button></div>
                                </div>
                            </div>

                            {/* LIABILITIES */}
                            <div className="bg-white dark:bg-pru-card rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                                <h3 className="font-bold text-red-600 text-sm uppercase mb-4 flex items-center"><i className="fas fa-hand-holding-usd mr-2"></i> Khoản nợ</h3>
                                <div className="space-y-2 mb-4">
                                    {customer.liabilities?.map(l => (
                                        <div key={l.id} className="flex justify-between items-center p-3 bg-red-50/50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20 group">
                                            <div>
                                                <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">{l.name}</p>
                                                <p className="text-[10px] text-gray-500">{l.type}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-black text-red-700 dark:text-red-400">{l.amount.toLocaleString()} đ</span>
                                                <button onClick={() => handleDeleteLiability(l.id)} className="text-red-400 opacity-0 group-hover:opacity-100 transition"><i className="fas fa-trash"></i></button>
                                            </div>
                                        </div>
                                    ))}
                                    {(!customer.liabilities || customer.liabilities.length === 0) && <p className="text-sm text-gray-400 italic text-center py-2">Chưa có khoản nợ</p>}
                                </div>
                                <div className="grid grid-cols-12 gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <div className="col-span-3"><select className="input-field text-xs py-2" value={newLiability.type} onChange={(e: any) => setNewLiability({...newLiability, type: e.target.value})}>{Object.values(LiabilityType).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                    <div className="col-span-4"><input className="input-field text-xs py-2" placeholder="Tên khoản nợ" value={newLiability.name} onChange={e => setNewLiability({...newLiability, name: e.target.value})} /></div>
                                    <div className="col-span-3"><CurrencyInput className="input-field text-xs py-2" placeholder="Số tiền" value={newLiability.amount || 0} onChange={v => setNewLiability({...newLiability, amount: v})} /></div>
                                    <div className="col-span-2"><button onClick={handleAddLiability} className="w-full h-full bg-red-600 text-white rounded-lg font-bold text-xs">Thêm</button></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'timeline' && (
                        <div className="bg-white dark:bg-pru-card rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                             <div className="mb-6 flex gap-2">
                                <input className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm" placeholder="Ghi chú tương tác..." value={newInteraction.content} onChange={e => setNewInteraction({...newInteraction, content: e.target.value})} />
                                <button onClick={handleAddTimeline} className="bg-pru-red text-white px-4 py-2 rounded-xl"><i className="fas fa-paper-plane"></i></button>
                             </div>
                             <div className="space-y-6 relative border-l-2 border-gray-100 dark:border-gray-800 ml-4 pl-8">
                                {virtualTimeline.map((item, idx) => (
                                    <div key={idx} className="relative">
                                        <div className={`absolute -left-11 w-6 h-6 rounded-full border-4 border-white dark:border-pru-card flex items-center justify-center text-[10px] ${item.type === InteractionType.CONTRACT ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}><i className="fas fa-circle"></i></div>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase">{formatDateVN(item.date)} • {item.type}</div>
                                        <div className="font-bold text-sm text-gray-800 dark:text-gray-200">{item.title}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{item.content}</div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

                    {activeTab === 'contracts' && (
                        <div className="space-y-4">
                            {customerContracts.length > 0 ? customerContracts.map(c => (
                                <div key={c.id} className="bg-white dark:bg-pru-card p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex justify-between items-center group hover:border-pru-red transition-colors">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1"><span className="font-black text-gray-900 dark:text-white">{c.contractNumber}</span><span className={`text-[10px] px-2 py-0.5 rounded font-bold ${c.status === ContractStatus.ACTIVE ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.status}</span></div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 font-bold">{c.mainProduct.productName}</p>
                                        <p className="text-xs text-gray-400">STBH: {c.mainProduct.sumAssured.toLocaleString()} đ • Phí: {c.totalFee.toLocaleString()} đ</p>
                                    </div>
                                    <button onClick={() => navigate('/contracts')} className="text-gray-300 group-hover:text-pru-red"><i className="fas fa-chevron-right"></i></button>
                                </div>
                            )) : (
                                <div className="p-10 text-center text-gray-400 border border-dashed rounded-xl">Chưa có hợp đồng bảo hiểm</div>
                            )}
                        </div>
                    )}

                    {activeTab === 'claims' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center"><h3 className="font-bold text-gray-800 dark:text-gray-100 uppercase text-xs tracking-widest">Lịch sử bồi thường</h3><button onClick={() => setIsAddingClaim(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">+ Thêm Claim</button></div>
                            {customer.claims?.map(cl => (
                                <div key={cl.id} className="bg-white dark:bg-pru-card p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold text-gray-800 dark:text-gray-200">{cl.benefitType}</div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${cl.status === ClaimStatus.APPROVED ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{cl.status}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div><span className="text-gray-400">Ngày nộp:</span> <span className="font-medium">{formatDateVN(cl.dateSubmitted)}</span></div>
                                        <div className="text-right"><span className="text-gray-400">Số tiền:</span> <span className="font-bold text-pru-red">{cl.amountRequest.toLocaleString()} đ</span></div>
                                    </div>
                                </div>
                            ))}
                            {isAddingClaim && (
                                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                                    <input className="input-field" placeholder="Loại quyền lợi (Nằm viện, CI...)" value={newClaim.benefitType} onChange={e => setNewClaim({...newClaim, benefitType: e.target.value})} />
                                    <CurrencyInput className="input-field" placeholder="Số tiền yêu cầu" value={newClaim.amountRequest || 0} onChange={v => setNewClaim({...newClaim, amountRequest: v})} />
                                    <div className="flex gap-2"><button onClick={handleAddClaim} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold">Lưu Claim</button><button onClick={() => setIsAddingClaim(false)} className="px-4 py-2 text-gray-500">Hủy</button></div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'docs' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-pru-card p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                                <div className="flex justify-between items-center mb-4"><h4 className="font-bold text-sm">Hồ sơ sức khỏe</h4><label className="cursor-pointer text-pru-red text-xs font-bold"><i className="fas fa-upload"></i> Tải lên<input type="file" className="hidden" onChange={e => handleFileUpload(e, 'medical')} /></label></div>
                                <div className="space-y-2">{customer.documents?.filter(d => d.category === 'medical').map(d => (
                                    <a key={d.id} href={d.url} target="_blank" className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-red-50 transition"><i className={`fas ${d.type === 'pdf' ? 'fa-file-pdf text-red-500' : 'fa-file-image text-blue-500'}`}></i><span className="text-xs truncate flex-1">{d.name}</span><i className="fas fa-external-link-alt text-[10px] text-gray-300"></i></a>
                                ))}</div>
                            </div>
                            <div className="bg-white dark:bg-pru-card p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                                <div className="flex justify-between items-center mb-4"><h4 className="font-bold text-sm">Hồ sơ cá nhân / Khác</h4><label className="cursor-pointer text-pru-red text-xs font-bold"><i className="fas fa-upload"></i> Tải lên<input type="file" className="hidden" onChange={e => handleFileUpload(e, 'personal')} /></label></div>
                                <div className="space-y-2">{customer.documents?.filter(d => d.category === 'personal').map(d => (
                                    <a key={d.id} href={d.url} target="_blank" className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-red-50 transition"><i className={`fas ${d.type === 'pdf' ? 'fa-file-pdf text-red-500' : 'fa-file-image text-blue-500'}`}></i><span className="text-xs truncate flex-1">{d.name}</span><i className="fas fa-external-link-alt text-[10px] text-gray-300"></i></a>
                                ))}</div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'info' && (
                        <div className="bg-white dark:bg-pru-card rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                             <h3 className="font-bold text-lg mb-6 border-b pb-2">Thông tin định danh 360°</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Họ và tên</label><p className="font-bold">{customer.fullName}</p></div>
                                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Số CCCD</label><p className="font-bold">{customer.idCard || '---'}</p></div>
                                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Ngày sinh</label><p className="font-bold">{formatDateVN(customer.dob)}</p></div>
                                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Giới tính</label><p className="font-bold">{customer.gender}</p></div>
                                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Nghề nghiệp</label><p className="font-bold">{customer.occupation || '---'}</p></div>
                                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Tình trạng hôn nhân</label><p className="font-bold">{customer.maritalStatus}</p></div>
                                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Vai trò tài chính</label><p className="font-bold">{customer.financialRole}</p></div>
                                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Số người phụ thuộc</label><p className="font-bold">{customer.dependents} người</p></div>
                                <div className="md:col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Địa chỉ thường trú / Công ty</label><p className="font-bold">{customer.companyAddress || '---'}</p></div>
                             </div>
                             <h3 className="font-bold text-lg mb-6 border-b pb-2 mt-10">Tình trạng sức khỏe</h3>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Chiều cao / Cân nặng</label><p className="font-bold">{customer.health.height}cm / {customer.health.weight}kg</p></div>
                                <div className="md:col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Tiền sử bệnh tật</label><p className="font-bold text-red-600 italic">{customer.health.medicalHistory || 'Khỏe mạnh, không có tiền sử'}</p></div>
                             </div>
                        </div>
                    )}
                </div>

                {/* SIDEBAR RIGHT */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-pru-card rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                        <h3 className="font-bold text-sm text-gray-500 uppercase mb-3">Thao tác nhanh</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => window.open(`tel:${customer.phone}`)} className="flex flex-col items-center justify-center p-3 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition"><i className="fas fa-phone-alt text-xl mb-1"></i> <span className="text-xs font-bold">Gọi điện</span></button>
                            <button onClick={() => window.open(`https://zalo.me/${customer.phone.replace(/\D/g,'')}`)} className="flex flex-col items-center justify-center p-3 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition"><i className="fab fa-whatsapp text-xl mb-1"></i> <span className="text-xs font-bold">Zalo</span></button>
                            <button onClick={() => navigate(`/advisory/${customer.id}`)} className="flex flex-col items-center justify-center p-3 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 transition col-span-2"><i className="fas fa-robot text-xl mb-1"></i> <span className="text-xs font-bold">AI Roleplay luyện tập</span></button>
                        </div>
                    </div>
                    {customer.relationships && customer.relationships.length > 0 && (
                        <div className="bg-white dark:bg-pru-card rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-xs text-gray-400 uppercase">Gia đình & Người thân</h3><button onClick={() => setIsRelationModalOpen(true)} className="text-blue-500 text-[10px] font-bold">Quản lý</button></div>
                            <div className="space-y-3">{customer.relationships.map((r, i) => {
                                const related = customers.find(cus => cus.id === r.relatedCustomerId);
                                return related ? (<div key={i} onClick={() => navigate(`/customers/${related.id}`)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition border border-transparent hover:border-gray-100"><div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">{related.fullName.charAt(0)}</div><div><p className="text-xs font-bold text-gray-900 dark:text-gray-100">{related.fullName}</p><p className="text-[10px] text-gray-400 uppercase font-medium">{r.relationship}</p></div></div>) : null;
                            })}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* MODALS (Included for consistency) */}
            {isEditModalOpen && (
                <EditCustomerModal customer={customer} allCustomers={customers} onSave={async (updated) => { await onUpdateCustomer(updated); setIsEditModalOpen(false); }} onClose={() => setIsEditModalOpen(false)} />
            )}
            {isRelationModalOpen && (
                <RelationshipModal customer={customer} allCustomers={customers} onClose={() => setIsRelationModalOpen(false)} onUpdate={onUpdateCustomer} onAddCustomer={onAddCustomer} />
            )}

            <style>{`
                .label-text { display: block; font-size: 0.75rem; font-weight: 700; color: #6b7280; margin-bottom: 0.25rem; }
                .dark .label-text { color: #9ca3af; }
                .input-field { width: 100%; border: 1px solid #e5e7eb; padding: 0.5rem; border-radius: 0.5rem; outline: none; font-size: 0.875rem; transition: all; background-color: #fff; color: #111827; }
                .dark .input-field { background-color: #111827; border-color: #374151; color: #f3f4f6; }
                .input-field:focus { border-color: #ed1b2e; ring: 1px solid #ed1b2e; }
                .animate-fade-in { animation: fadeIn 0.3s ease-in; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

// Sub-components (unchanged, but required for context)
const EditCustomerModal: React.FC<{customer: Customer; allCustomers: Customer[]; onSave: (updated: Customer) => Promise<void>; onClose: () => void;}> = ({ customer, onSave, onClose }) => {
    const [formData, setFormData] = useState<Customer>({ ...customer });
    const [tab, setTab] = useState<'general' | 'health' | 'analysis'>('general');

    const handleHealthChange = (key: string, value: any) => {
        setFormData({ ...formData, health: { ...formData.health, [key]: value } });
    };

    const handleAnalysisChange = (key: string, value: any) => {
        setFormData({ ...formData, analysis: { ...formData.analysis, [key]: value } });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-pru-card rounded-xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl transition-colors">
                <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-t-xl">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Sửa hồ sơ: {formData.fullName}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><i className="fas fa-times text-xl"></i></button>
                </div>
                
                {/* TABS IN MODAL */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 px-4">
                    <button onClick={() => setTab('general')} className={`py-3 px-4 text-sm font-bold border-b-2 transition ${tab === 'general' ? 'border-pru-red text-pru-red' : 'border-transparent text-gray-500'}`}>Thông tin chung</button>
                    <button onClick={() => setTab('health')} className={`py-3 px-4 text-sm font-bold border-b-2 transition ${tab === 'health' ? 'border-pru-red text-pru-red' : 'border-transparent text-gray-500'}`}>Sức khỏe</button>
                    <button onClick={() => setTab('analysis')} className={`py-3 px-4 text-sm font-bold border-b-2 transition ${tab === 'analysis' ? 'border-pru-red text-pru-red' : 'border-transparent text-gray-500'}`}>Phân tích</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {tab === 'general' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="label-text">Họ và tên</label><input className="input-field" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} /></div>
                            <div><label className="label-text">Số điện thoại</label><input className="input-field" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                            <div><label className="label-text">Ngày sinh</label><input type="date" className="input-field" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} /></div>
                            <div><label className="label-text">Giới tính</label><select className="input-field" value={formData.gender} onChange={(e: any) => setFormData({ ...formData, gender: e.target.value })}>{Object.values(Gender).map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                            <div><label className="label-text">Nghề nghiệp</label><input className="input-field" value={formData.occupation} onChange={e => setFormData({ ...formData, occupation: e.target.value })} /></div>
                            <div><label className="label-text">CCCD</label><input className="input-field" value={formData.idCard} onChange={e => setFormData({ ...formData, idCard: e.target.value })} /></div>
                            <div>
                                <label className="label-text">Tình trạng hôn nhân</label>
                                <select className="input-field" value={formData.maritalStatus} onChange={(e: any) => setFormData({ ...formData, maritalStatus: e.target.value })}>{Object.values(MaritalStatus).map(v => <option key={v} value={v}>{v}</option>)}</select>
                            </div>
                            <div>
                                <label className="label-text">Vai trò tài chính</label>
                                <select className="input-field" value={formData.financialRole} onChange={(e: any) => setFormData({ ...formData, financialRole: e.target.value })}>{Object.values(FinancialRole).map(v => <option key={v} value={v}>{v}</option>)}</select>
                            </div>
                            <div>
                                <label className="label-text">Số người phụ thuộc</label>
                                <input type="number" className="input-field" value={formData.dependents} onChange={e => setFormData({ ...formData, dependents: Number(e.target.value) })} />
                            </div>
                            <div className="md:col-span-2"><label className="label-text">Địa chỉ</label><input className="input-field" value={formData.companyAddress} onChange={e => setFormData({ ...formData, companyAddress: e.target.value })} /></div>
                        </div>
                    )}

                    {tab === 'health' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label-text">Chiều cao (cm)</label><input type="number" className="input-field" value={formData.health.height} onChange={e => handleHealthChange('height', Number(e.target.value))} /></div>
                                <div><label className="label-text">Cân nặng (kg)</label><input type="number" className="input-field" value={formData.health.weight} onChange={e => handleHealthChange('weight', Number(e.target.value))} /></div>
                            </div>
                            <div><label className="label-text">Thói quen (Hút thuốc/Rượu bia)</label><input className="input-field" value={formData.health.habits} onChange={e => handleHealthChange('habits', e.target.value)} /></div>
                            <div>
                                <label className="label-text">Tiền sử bệnh án</label>
                                <textarea className="input-field" rows={4} value={formData.health.medicalHistory} onChange={e => handleHealthChange('medicalHistory', e.target.value)} placeholder="Chi tiết bệnh, năm mắc, điều trị..." />
                            </div>
                        </div>
                    )}

                    {tab === 'analysis' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="label-text">Thu nhập hàng tháng (VNĐ)</label><CurrencyInput className="input-field" value={formData.analysis.incomeMonthly} onChange={v => handleAnalysisChange('incomeMonthly', v)} /></div>
                                <div><label className="label-text">Xu hướng thu nhập</label><select className="input-field" value={formData.analysis.incomeTrend} onChange={(e: any) => handleAnalysisChange('incomeTrend', e.target.value)}>{Object.values(IncomeTrend).map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                                <div><label className="label-text">Chi tiêu hàng tháng (VNĐ)</label><CurrencyInput className="input-field" value={formData.analysis.monthlyExpenses} onChange={v => handleAnalysisChange('monthlyExpenses', v)} /></div>
                                <div><label className="label-text">Mức độ chấp nhận rủi ro</label><select className="input-field" value={formData.analysis.riskTolerance} onChange={(e: any) => handleAnalysisChange('riskTolerance', e.target.value)}>{Object.values(RiskTolerance).map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                                <div><label className="label-text">Kiểu tính cách (DISC/MBTI)</label><select className="input-field" value={formData.analysis.personality} onChange={(e: any) => handleAnalysisChange('personality', e.target.value)}>{Object.values(PersonalityType).map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                                <div><label className="label-text">Mức độ sẵn sàng</label><select className="input-field" value={formData.analysis.readiness} onChange={(e: any) => handleAnalysisChange('readiness', e.target.value)}>{Object.values(ReadinessLevel).map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                            </div>
                            <div><label className="label-text">Mối lo lớn nhất</label><input className="input-field" value={formData.analysis.biggestWorry} onChange={e => handleAnalysisChange('biggestWorry', e.target.value)} /></div>
                            <div><label className="label-text">Kế hoạch tương lai</label><input className="input-field" value={formData.analysis.futurePlans} onChange={e => handleAnalysisChange('futurePlans', e.target.value)} /></div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3 rounded-b-xl">
                    <button onClick={onClose} className="px-5 py-2 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Hủy</button>
                    <button onClick={() => onSave(formData)} className="px-5 py-2 bg-pru-red text-white font-bold rounded-lg hover:bg-red-700 shadow-md">Lưu thay đổi</button>
                </div>
            </div>
        </div>
    );
};

const RelationshipModal: React.FC<{customer: Customer; allCustomers: Customer[]; onClose: () => void; onUpdate: (c: Customer) => Promise<void>; onAddCustomer: (c: Customer) => Promise<void>;}> = ({ customer, allCustomers, onClose, onUpdate }) => {
    const [selectedRelated, setSelectedRelated] = useState<Customer | null>(null);
    const [relType, setRelType] = useState<RelationshipType>(RelationshipType.OTHER);
    const handleAdd = async () => { if (!selectedRelated) return; const newRel = { relatedCustomerId: selectedRelated.id, relationship: relType }; await onUpdate({ ...customer, relationships: [...(customer.relationships || []), newRel] }); setSelectedRelated(null); };
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-pru-card rounded-xl max-w-lg w-full p-6 shadow-2xl transition-colors"><div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2"><h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Quản lý Mối quan hệ</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><i className="fas fa-times text-xl"></i></button></div><div className="space-y-4 mb-6"><SearchableCustomerSelect customers={allCustomers.filter(c => c.id !== customer.id)} value={selectedRelated?.fullName || ''} onChange={setSelectedRelated} label="Chọn người thân" /><div><label className="label-text">Mối quan hệ</label><select className="input-field" value={relType} onChange={(e: any) => setRelType(e.target.value)}>{Object.values(RelationshipType).map(v => <option key={v} value={v}>{v}</option>)}</select></div><button onClick={handleAdd} className="w-full py-2 bg-pru-red text-white rounded-lg font-bold shadow-md hover:bg-red-700 transition">Thêm quan hệ</button></div><div className="max-h-40 overflow-y-auto space-y-2">{customer.relationships?.map((r, i) => { const relatedC = allCustomers.find(c => c.id === r.relatedCustomerId); return (<div key={i} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded"><span className="text-sm font-medium">{relatedC?.fullName}</span><span className="text-xs text-gray-500">{r.relationship}</span></div>); })}</div></div>
        </div>
    );
};

export default CustomerDetail;
