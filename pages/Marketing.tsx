
import React, { useState } from 'react';
import { AgentProfile, Customer, Contract, ContractStatus } from '../types';
import { generateSocialPost, generateContentSeries, generateStory, generateCaseStudy } from '../services/geminiService';
import { SearchableCustomerSelect } from '../components/Shared';

interface MarketingPageProps {
    profile: AgentProfile | null;
    customers?: Customer[]; // Added props
    contracts?: Contract[]; // Added props
}

const MarketingPage: React.FC<MarketingPageProps> = ({ profile, customers = [], contracts = [] }) => {
    // --- Writer Sub-Modes ---
    const [writerMode, setWriterMode] = useState<'case_study' | 'single' | 'series' | 'story'>('case_study');

    // --- State: Case Study (NEW) ---
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [caseFramework, setCaseFramework] = useState<'AIDA' | 'PAS'>('AIDA');
    const [caseResult, setCaseResult] = useState<{title: string, content: string, imagePrompt: string} | null>(null);

    // --- State: Single Post ---
    const [topic, setTopic] = useState('');
    const [tone, setTone] = useState('Chuyên gia, Tin cậy');
    const [posts, setPosts] = useState<{title: string, content: string}[]>([]);

    // --- State: Series ---
    const [seriesTopic, setSeriesTopic] = useState('');
    const [seriesData, setSeriesData] = useState<{ day: string; type: string; content: string }[]>([]);

    // --- State: Storytelling ---
    const [storyFacts, setStoryFacts] = useState('');
    const [storyEmotion, setStoryEmotion] = useState('Cảm động, sâu sắc');
    const [storyResult, setStoryResult] = useState('');

    const [isGenerating, setIsGenerating] = useState(false);

    // --- Handlers ---
    const handleGenerateCaseStudy = async () => {
        if (!selectedCustomer) return alert("Vui lòng chọn khách hàng!");
        setIsGenerating(true);
        try {
            const result = await generateCaseStudy(selectedCustomer, contracts, caseFramework);
            setCaseResult(result);
        } catch (e) {
            console.error(e);
            alert("Lỗi khi tạo Case Study. Thử lại sau.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGeneratePost = async () => {
        if (!topic.trim()) return alert("Vui lòng nhập chủ đề!");
        setIsGenerating(true);
        const results = await generateSocialPost(topic, tone);
        setPosts(results);
        setIsGenerating(false);
    };

    const handleGenerateSeries = async () => {
        if (!seriesTopic.trim()) return alert("Vui lòng nhập tên chiến dịch!");
        setIsGenerating(true);
        const results = await generateContentSeries(seriesTopic, profile);
        setSeriesData(results);
        setIsGenerating(false);
    };

    const handleGenerateStory = async () => {
        if (!storyFacts.trim()) return alert("Vui lòng nhập dữ kiện!");
        setIsGenerating(true);
        const result = await generateStory(storyFacts, storyEmotion);
        setStoryResult(result);
        setIsGenerating(false);
    };

    return (
        <div className="space-y-6 pb-20">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                <i className="fas fa-bullhorn text-pru-red mr-3"></i> Content Factory (MDRT)
            </h1>

            <div className="bg-white dark:bg-pru-card rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 min-h-[600px] flex flex-col transition-colors">
                
                {/* Writer Mode Selector */}
                <div className="flex justify-center mb-8 overflow-x-auto">
                    <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex shadow-inner whitespace-nowrap">
                        <button onClick={() => setWriterMode('case_study')} className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${writerMode === 'case_study' ? 'bg-white dark:bg-gray-600 text-pru-red dark:text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                            <i className="fas fa-user-check"></i> Case Study (Real)
                        </button>
                        <button onClick={() => setWriterMode('story')} className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${writerMode === 'story' ? 'bg-white dark:bg-gray-600 text-pru-red dark:text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                            <i className="fas fa-book-open"></i> Kể chuyện
                        </button>
                        <button onClick={() => setWriterMode('single')} className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${writerMode === 'single' ? 'bg-white dark:bg-gray-600 text-pru-red dark:text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                            <i className="fas fa-edit"></i> Bài lẻ
                        </button>
                        <button onClick={() => setWriterMode('series')} className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${writerMode === 'series' ? 'bg-white dark:bg-gray-600 text-pru-red dark:text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                            <i className="fas fa-layer-group"></i> Chuỗi 5 Ngày
                        </button>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* LEFT: INPUT (Col 4) */}
                    <div className="lg:col-span-4 space-y-5 border-r border-gray-100 dark:border-gray-800 pr-0 lg:pr-8">
                        
                        {/* CASE STUDY MODE */}
                        {writerMode === 'case_study' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 text-xs rounded-xl border border-green-100 dark:border-green-900/30 shadow-sm">
                                    <h4 className="font-bold mb-1 flex items-center"><i className="fas fa-magic mr-1.5"></i> Câu chuyện từ Hồ sơ thật</h4>
                                    <p>AI sẽ đọc lịch sử Claim, Hợp đồng để viết câu chuyện truyền cảm hứng. Tên khách hàng sẽ được ẩn danh.</p>
                                </div>
                                
                                <div>
                                    <label className="label-text">Chọn Khách hàng nguồn</label>
                                    <SearchableCustomerSelect 
                                        customers={customers} 
                                        value={selectedCustomer?.fullName || ''} 
                                        onChange={setSelectedCustomer} 
                                        placeholder="Tìm khách hàng..."
                                    />
                                    {selectedCustomer && (
                                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs space-y-1 border border-gray-200 dark:border-gray-700">
                                            <p className="flex justify-between"><span>Nghề nghiệp:</span> <strong>{selectedCustomer.occupation}</strong></p>
                                            <p className="flex justify-between"><span>Hợp đồng:</span> <strong>{contracts.filter(c => c.customerId === selectedCustomer.id && c.status === ContractStatus.ACTIVE).length} HĐ</strong></p>
                                            <p className="flex justify-between"><span>Bồi thường:</span> <strong className={selectedCustomer.claims?.length ? 'text-red-500' : ''}>{selectedCustomer.claims?.length || 0} lần</strong></p>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="label-text">Công thức viết (Framework)</label>
                                    <div className="grid grid-cols-2 gap-3 mt-1">
                                        <button onClick={() => setCaseFramework('AIDA')} className={`p-3 rounded-xl border text-center transition ${caseFramework === 'AIDA' ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-500'}`}>
                                            AIDA<br/><span className="text-[10px] font-normal">Chú ý - Thích thú</span>
                                        </button>
                                        <button onClick={() => setCaseFramework('PAS')} className={`p-3 rounded-xl border text-center transition ${caseFramework === 'PAS' ? 'bg-orange-50 border-orange-200 text-orange-700 font-bold' : 'bg-white border-gray-200 text-gray-500'}`}>
                                            PAS<br/><span className="text-[10px] font-normal">Nỗi đau - Giải pháp</span>
                                        </button>
                                    </div>
                                </div>

                                <button onClick={handleGenerateCaseStudy} disabled={isGenerating} className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 shadow-lg shadow-green-500/30 flex items-center justify-center gap-2">
                                    {isGenerating ? <><i className="fas fa-spinner fa-spin"></i> AI đang phân tích...</> : <><i className="fas fa-pen-nib"></i> Viết Câu chuyện</>}
                                </button>
                            </div>
                        )}

                        {/* SINGLE MODE */}
                        {writerMode === 'single' && (
                            <div className="space-y-4 animate-fade-in">
                                <div>
                                    <label className="label-text">Chủ đề bài viết</label>
                                    <textarea className="input-area h-32" placeholder="VD: Ý nghĩa bảo hiểm nhân thọ..." value={topic} onChange={e => setTopic(e.target.value)} />
                                </div>
                                <div>
                                    <label className="label-text">Giọng điệu</label>
                                    <select className="input-select" value={tone} onChange={e => setTone(e.target.value)}>
                                        <option>Chuyên gia, Tin cậy</option>
                                        <option>Hài hước, Vui vẻ</option>
                                        <option>Cảm xúc, Sâu sắc</option>
                                    </select>
                                </div>
                                <button onClick={handleGeneratePost} disabled={isGenerating} className="btn-primary">
                                    {isGenerating ? 'Đang viết...' : 'Tạo 3 mẫu Content'}
                                </button>
                            </div>
                        )}

                        {/* SERIES MODE */}
                        {writerMode === 'series' && (
                            <div className="space-y-4 animate-fade-in">
                                <div>
                                    <label className="label-text">Tên chiến dịch / Chủ đề lớn</label>
                                    <textarea className="input-area h-32" placeholder="VD: Tuần lễ Bảo vệ Trụ cột gia đình..." value={seriesTopic} onChange={e => setSeriesTopic(e.target.value)} />
                                </div>
                                <button onClick={handleGenerateSeries} disabled={isGenerating} className="btn-primary bg-purple-600 hover:bg-purple-700 shadow-purple-500/30">
                                    {isGenerating ? 'Đang lập kế hoạch...' : 'Lập kế hoạch 5 ngày'}
                                </button>
                            </div>
                        )}

                        {/* STORY MODE */}
                        {writerMode === 'story' && (
                            <div className="space-y-4 animate-fade-in">
                                <div>
                                    <label className="label-text">Dữ kiện thô (Facts)</label>
                                    <textarea className="input-area h-40" placeholder="VD: Khách hàng A, 35 tuổi, vừa nhận quyền lợi 500tr..." value={storyFacts} onChange={e => setStoryFacts(e.target.value)} />
                                </div>
                                <div>
                                    <label className="label-text">Cảm xúc chủ đạo</label>
                                    <select className="input-select" value={storyEmotion} onChange={e => setStoryEmotion(e.target.value)}>
                                        <option>Cảm động, Sâu sắc</option>
                                        <option>Cảnh tỉnh, Mạnh mẽ</option>
                                        <option>Truyền cảm hứng, Tươi sáng</option>
                                    </select>
                                </div>
                                <button onClick={handleGenerateStory} disabled={isGenerating} className="btn-primary bg-orange-500 hover:bg-orange-600 shadow-orange-500/30">
                                    {isGenerating ? 'Đang sáng tác...' : 'Kể chuyện'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: OUTPUT (Col 8) */}
                    <div className="lg:col-span-8 h-full overflow-y-auto max-h-[600px] scrollbar-hide pl-2">
                        
                        {/* Output Case Study */}
                        {writerMode === 'case_study' && caseResult && (
                            <div className="space-y-6 animate-slide-up">
                                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                    <div className="bg-green-50 dark:bg-green-900/20 p-4 border-b border-green-100 dark:border-green-800 flex justify-between items-center">
                                        <h3 className="font-bold text-green-800 dark:text-green-300 text-lg">{caseResult.title}</h3>
                                        <button onClick={() => {navigator.clipboard.writeText(`${caseResult.title}\n\n${caseResult.content}`); alert("Đã sao chép!")}} className="text-green-600 hover:bg-green-100 p-2 rounded transition"><i className="fas fa-copy"></i></button>
                                    </div>
                                    <div className="p-6 text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed font-serif text-lg">
                                        {caseResult.content}
                                    </div>
                                </div>

                                {/* Image Prompt Card */}
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-800 relative group">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center"><i className="fas fa-image"></i></div>
                                        <h4 className="font-bold text-indigo-900 dark:text-indigo-300 text-sm uppercase">Gợi ý tạo ảnh AI (Image Prompt)</h4>
                                    </div>
                                    <p className="text-sm text-indigo-800 dark:text-indigo-200 italic bg-white dark:bg-gray-900 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                                        {caseResult.imagePrompt}
                                    </p>
                                    <button onClick={() => {navigator.clipboard.writeText(caseResult.imagePrompt); alert("Đã sao chép Prompt!")}} className="absolute top-5 right-5 text-indigo-500 hover:text-indigo-700 text-xs font-bold bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg shadow-sm">Copy Prompt</button>
                                </div>
                            </div>
                        )}

                        {/* Output Single */}
                        {writerMode === 'single' && posts.map((post, idx) => (
                            <div key={idx} className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700 mb-4 hover:shadow-md transition">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">{post.title}</span>
                                    <button onClick={() => {navigator.clipboard.writeText(post.content); alert("Copied!")}} className="text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"><i className="fas fa-copy"></i></button>
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{post.content}</p>
                            </div>
                        ))}

                        {/* Output Series */}
                        {writerMode === 'series' && (
                            <div className="space-y-0 relative">
                                {seriesData.length > 0 && <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-200 dark:bg-gray-700"></div>}
                                {seriesData.map((day, idx) => (
                                    <div key={idx} className="relative pl-10 pb-8 last:pb-0">
                                        <div className="absolute left-0 w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full border-4 border-white dark:border-pru-card shadow-sm flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-400 z-10">
                                            {idx + 1}
                                        </div>
                                        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-lg transition group">
                                            <div className="flex justify-between items-center mb-3">
                                                <div>
                                                    <span className="font-bold text-purple-700 dark:text-purple-400 block">{day.day}</span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">{day.type}</span>
                                                </div>
                                                <button onClick={() => {navigator.clipboard.writeText(day.content); alert("Copied!")}} className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-400 flex items-center justify-center transition"><i className="fas fa-copy"></i></button>
                                            </div>
                                            <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                                {day.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Output Story */}
                        {writerMode === 'story' && storyResult && (
                            <div className="bg-orange-50/30 dark:bg-orange-900/10 p-8 rounded-xl border border-orange-100 dark:border-orange-900/30">
                                <div className="flex justify-end mb-4">
                                    <button onClick={() => {navigator.clipboard.writeText(storyResult); alert("Copied!")}} className="text-orange-400 dark:text-orange-300 hover:text-orange-600 dark:hover:text-orange-200 flex items-center gap-2 text-sm font-bold"><i className="fas fa-copy"></i> Sao chép</button>
                                </div>
                                <div className="prose prose-orange dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-serif text-lg leading-relaxed">
                                    {storyResult}
                                </div>
                                <div className="mt-8 pt-4 border-t border-orange-100 dark:border-orange-900/30 text-center">
                                    <i className="fas fa-feather-alt text-orange-300 dark:text-orange-600 text-2xl"></i>
                                </div>
                            </div>
                        )}

                        {/* Empty State */}
                        {((writerMode === 'single' && posts.length === 0) || 
                          (writerMode === 'series' && seriesData.length === 0) || 
                          (writerMode === 'story' && !storyResult) ||
                          (writerMode === 'case_study' && !caseResult)) && !isGenerating && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 opacity-50">
                                <i className="fas fa-magic text-6xl mb-4 text-gray-200 dark:text-gray-700"></i>
                                <p className="font-bold">Sẵn sàng sáng tạo nội dung...</p>
                                <p className="text-xs mt-1">Chọn chế độ và nhập thông tin để bắt đầu</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .label-text { display: block; font-size: 0.75rem; font-weight: 700; color: #6b7280; margin-bottom: 0.5rem; }
                .dark .label-text { color: #9ca3af; }
                .input-area { width: 100%; border: 1px solid #e5e7eb; padding: 0.75rem; border-radius: 0.75rem; outline: none; font-size: 0.875rem; transition: all; background-color: #fff; color: #111827; resize: none; }
                .dark .input-area { background-color: #111827; border-color: #374151; color: #f3f4f6; }
                .input-area:focus { border-color: #ed1b2e; ring: 2px solid #ed1b2e20; }
                .input-select { width: 100%; border: 1px solid #e5e7eb; padding: 0.75rem; border-radius: 0.75rem; outline: none; font-size: 0.875rem; background-color: #fff; color: #111827; }
                .dark .input-select { background-color: #111827; border-color: #374151; color: #f3f4f6; }
                .btn-primary { width: 100%; background-color: #ed1b2e; color: white; padding: 0.75rem; border-radius: 0.75rem; font-weight: 700; box-shadow: 0 4px 6px -1px rgba(237, 27, 46, 0.3); transition: all; }
                .btn-primary:hover { background-color: #c91022; }
                .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
            `}</style>
        </div>
    );
};

export default MarketingPage;
