
import React from 'react';
import { useNavigate } from 'react-router-dom';

const ToolsPage: React.FC = () => {
    const navigate = useNavigate();

    const toolGroups = [
        {
            title: "Hoạch định Tài chính MDRT (5 Trụ cột)",
            items: [
                { id: 'protection', label: 'Bảo vệ Thu nhập', icon: 'fa-shield-alt', color: 'red', path: '/tools/finance?tab=protection' },
                { id: 'retirement', label: 'Hưu trí An nhàn', icon: 'fa-umbrella-beach', color: 'blue', path: '/tools/finance?tab=retirement' },
                { id: 'education', label: 'Quỹ Học vấn', icon: 'fa-graduation-cap', color: 'indigo', path: '/tools/finance?tab=education' },
                { id: 'health', label: 'Y tế & Hiểm nghèo', icon: 'fa-heartbeat', color: 'teal', path: '/tools/finance?tab=health' },
                { id: 'legacy', label: 'Di sản & Thừa kế', icon: 'fa-crown', color: 'yellow', path: '/tools/finance?tab=legacy' },
            ]
        },
        {
            title: "Nghiệp vụ & Hậu cần (Smart Ops)",
            items: [
                { id: 'contracts', label: 'Quản lý Hợp đồng', icon: 'fa-file-signature', color: 'cyan', path: '/contracts' },
                { id: 'ops', label: 'Smart Claim & Thẩm định', icon: 'fa-file-medical-alt', color: 'orange', path: '/tools/ops' },
                { id: 'objections', label: 'Xử lý Từ chối (SOS)', icon: 'fa-fire-extinguisher', color: 'pink', path: '/tools/ops?tab=objections' },
            ]
        },
        {
            title: "Tiếp thị & Thương hiệu",
            items: [
                { id: 'marketing', label: 'Content Factory (AI)', icon: 'fa-pen-nib', color: 'purple', path: '/tools/marketing' },
                { id: 'card', label: 'Danh thiếp QR', icon: 'fa-id-card', color: 'green', path: '/tools/card' },
                { id: 'templates', label: 'Kho Mẫu tin nhắn', icon: 'fa-comment-dots', color: 'gray', path: '/tools/templates' },
            ]
        }
    ];

    return (
        <div className="space-y-8 pb-20">
            <header>
                <h1 className="text-2xl font-black text-gray-800 dark:text-gray-100">Trung tâm Công cụ</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Trang bị vũ khí sắc bén để chinh phục MDRT.</p>
            </header>

            {toolGroups.map((group, gIdx) => (
                <section key={gIdx} className="space-y-4">
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 border-l-4 border-pru-red pl-2">{group.title}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {group.items.map(tool => (
                            <button 
                                key={tool.id}
                                onClick={() => navigate(tool.path)}
                                className="bg-white dark:bg-pru-card p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group flex flex-col items-center text-center space-y-3"
                            >
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner transition-transform group-hover:scale-110 bg-${tool.color}-50 dark:bg-${tool.color}-900/20 text-${tool.color}-600 dark:text-${tool.color}-400`}>
                                    <i className={`fas ${tool.icon}`}></i>
                                </div>
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight">{tool.label}</span>
                            </button>
                        ))}
                    </div>
                </section>
            ))}
            
            <style>{`
                /* Custom Color Classes for Dynamic Usage */
                .bg-indigo-50 { background-color: #eef2ff; }
                .text-indigo-600 { color: #4f46e5; }
                
                .bg-cyan-50 { background-color: #ecfeff; }
                .text-cyan-600 { color: #0891b2; }
                
                .bg-orange-50 { background-color: #fff7ed; }
                .text-orange-600 { color: #ea580c; }
                
                .bg-teal-50 { background-color: #f0fdfa; }
                .text-teal-600 { color: #0d9488; }
                
                .bg-purple-50 { background-color: #f3e8ff; }
                .text-purple-600 { color: #9333ea; }
                
                .bg-pink-50 { background-color: #fdf2f8; }
                .text-pink-600 { color: #db2777; }
                
                .bg-gray-50 { background-color: #f9fafb; }
                .text-gray-600 { color: #4b5563; }
            `}</style>
        </div>
    );
};

export default ToolsPage;
