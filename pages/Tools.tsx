
import React from 'react';
import { useNavigate } from 'react-router-dom';

const ToolsPage: React.FC = () => {
    const navigate = useNavigate();

    const toolGroups = [
        {
            title: "Hoạch định Tài chính",
            items: [
                { id: 'finance-calc', label: 'Máy tính Tài chính', icon: 'fa-calculator', color: 'blue', path: '/tools/finance' },
                { id: 'compound', label: 'Lãi suất kép', icon: 'fa-chart-line', color: 'indigo', path: '/tools/finance?tab=compound' },
                { id: 'gap', label: 'Lỗ hổng bảo vệ', icon: 'fa-shield-virus', color: 'red', path: '/customers' },
            ]
        },
        {
            title: "Công cụ Nghiệp vụ",
            items: [
                { id: 'contracts', label: 'Quản lý Hợp đồng', icon: 'fa-file-signature', color: 'teal', path: '/contracts' }, // New Item
                { id: 'claims', label: 'Checklist Bồi thường', icon: 'fa-file-medical', color: 'orange', path: '/tools/ops' },
                { id: 'objections', label: 'Xử lý từ chối', icon: 'fa-brain', color: 'purple', path: '/tools/ops?tab=objections' },
                { id: 'business-card', label: 'Danh thiếp QR', icon: 'fa-id-card', color: 'green', path: '/tools/card' },
            ]
        },
        {
            title: "Tiện ích khác",
            items: [
                { id: 'calendar', label: 'Lịch làm việc', icon: 'fa-calendar-alt', color: 'pink', path: '/appointments' },
                { id: 'marketing', label: 'Marketing Center', icon: 'fa-bullhorn', color: 'yellow', path: '/tools/marketing' },
                { id: 'templates', label: 'Mẫu tin nhắn', icon: 'fa-comment-alt', color: 'cyan', path: '/tools/templates' },
            ]
        }
    ];

    return (
        <div className="space-y-8 pb-20">
            <header>
                <h1 className="text-2xl font-black text-gray-800 dark:text-gray-100">Trung tâm Công cụ</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Trang bị vũ khí để trở thành MDRT chuyên nghiệp.</p>
            </header>

            {toolGroups.map((group, gIdx) => (
                <section key={gIdx} className="space-y-4">
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">{group.title}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {group.items.map(tool => (
                            <button 
                                key={tool.id}
                                onClick={() => navigate(tool.path)}
                                className="bg-white dark:bg-pru-card p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all group flex flex-col items-center text-center space-y-3"
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm transition-transform group-hover:scale-110 bg-${tool.color}-50 dark:bg-${tool.color}-900/20 text-${tool.color}-600 dark:text-${tool.color}-400`}>
                                    <i className={`fas ${tool.icon}`}></i>
                                </div>
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{tool.label}</span>
                            </button>
                        ))}
                    </div>
                </section>
            ))}
            
            <style>{`
                .bg-indigo-50 { background-color: #eef2ff; }
                .text-indigo-600 { color: #4f46e5; }
                .bg-cyan-50 { background-color: #ecfeff; }
                .text-cyan-600 { color: #0891b2; }
                .bg-orange-50 { background-color: #fff7ed; }
                .text-orange-600 { color: #ea580c; }
                .bg-teal-50 { background-color: #f0fdfa; }
                .text-teal-600 { color: #0d9488; }
            `}</style>
        </div>
    );
};

export default ToolsPage;
