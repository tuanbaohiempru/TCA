
import React, { useState } from 'react';

const OperationsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'claims' | 'objections'>('claims');

    const claimChecklists = [
        {
            title: "Quyền lợi Nằm viện / Phẫu thuật",
            items: [
                "Giấy ra viện (Bản gốc hoặc sao y)",
                "Tóm tắt bệnh án",
                "Hóa đơn giá trị gia tăng / Biên lai thu tiền",
                "Bảng kê chi tiết viện phí"
            ]
        },
        {
            title: "Quyền lợi Bệnh lý nghiêm trọng",
            items: [
                "Kết quả xét nghiệm / Chẩn đoán hình ảnh",
                "Giấy chứng nhận phẫu thuật (nếu có)",
                "Giải phẫu bệnh (đối với Ung thư)",
                "Sổ khám bệnh / Toa thuốc liên quan"
            ]
        },
        {
            title: "Quyền lợi Tai nạn",
            items: [
                "Biên bản tai nạn (Công an hoặc cơ quan y tế)",
                "Kết quả chụp X-quang / MRI vùng bị thương",
                "Phân loại thương tật của cơ quan giám định"
            ]
        }
    ];

    const objections = [
        { q: "Bảo hiểm lừa đảo, mua dễ lấy khó.", a: "Thực tế Pru đã chi trả hàng nghìn tỷ mỗi năm. 'Khó' thường do hồ sơ không đúng quy trình. Em ở đây để đồng hành giúp anh/chị làm đúng ngay từ đầu." },
        { q: "Tôi không có tiền tham gia lúc này.", a: "Chính vì chưa có dư nhiều nên ta mới cần BH để bảo vệ số tiền ít ỏi đó trước rủi ro bệnh tật. Chúng ta có thể bắt đầu với gói phí chỉ bằng ly cafe mỗi ngày." },
        { q: "Để tôi hỏi lại vợ/chồng đã.", a: "Rất tuyệt vời, anh là người chồng trách nhiệm. Nhưng nếu rủi ro xảy ra, người gánh vác là anh hay chị? Hãy để em giúp anh chuẩn bị món quà 'bình an' này cho chị bất ngờ." }
    ];

    return (
        <div className="space-y-6 pb-20 max-w-4xl mx-auto">
            <header>
                <h1 className="text-2xl font-black text-gray-800 dark:text-gray-100">Công cụ Nghiệp vụ</h1>
                <p className="text-sm text-gray-500">Nâng cao hiệu suất và niềm tin từ khách hàng.</p>
            </header>

            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl">
                <button onClick={() => setActiveTab('claims')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${activeTab === 'claims' ? 'bg-white dark:bg-pru-card text-pru-red shadow-sm' : 'text-gray-500'}`}>Hồ sơ Claim</button>
                <button onClick={() => setActiveTab('objections')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${activeTab === 'objections' ? 'bg-white dark:bg-pru-card text-pru-red shadow-sm' : 'text-gray-500'}`}>Xử lý từ chối</button>
            </div>

            {activeTab === 'claims' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {claimChecklists.map((group, idx) => (
                        <div key={idx} className="bg-white dark:bg-pru-card p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                                <i className="fas fa-check-circle text-green-500 mr-2"></i> {group.title}
                            </h3>
                            <ul className="space-y-3">
                                {group.items.map((item, iIdx) => (
                                    <li key={iIdx} className="flex items-start text-sm text-gray-600 dark:text-gray-400">
                                        <i className="fas fa-file-alt mt-1 mr-3 opacity-30"></i>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-800 flex flex-col justify-center items-center text-center">
                        <i className="fas fa-info-circle text-3xl text-blue-500 mb-3"></i>
                        <p className="text-sm font-bold text-blue-800 dark:text-blue-300">Lưu ý quan trọng</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 italic">Mọi hồ sơ cần được chụp rõ nét qua App Pulse để đẩy nhanh tiến độ thẩm định.</p>
                    </div>
                </div>
            )}

            {activeTab === 'objections' && (
                <div className="space-y-4">
                    {objections.map((item, idx) => (
                        <div key={idx} className="bg-white dark:bg-pru-card p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 group">
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-red-50 text-pru-red flex items-center justify-center shrink-0 font-bold text-xs">Q</div>
                                <p className="font-bold text-gray-800 dark:text-gray-100">{item.q}</p>
                            </div>
                            <div className="mt-4 pl-12 relative">
                                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100 dark:bg-gray-800"></div>
                                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl text-sm text-gray-600 dark:text-gray-300 leading-relaxed italic border border-transparent group-hover:border-red-100 transition-colors">
                                    "{item.a}"
                                </div>
                            </div>
                        </div>
                    ))}
                    <div className="p-6 text-center">
                        <p className="text-xs text-gray-400 italic">Mẹo: Sử dụng AI Assistant để tạo câu trả lời cá nhân hóa theo tính cách khách hàng.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OperationsPage;
