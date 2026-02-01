
import { httpsCallable, Functions } from "firebase/functions";
import { functions, isFirebaseReady } from "./firebaseConfig";
// IMPORTANT: Use '@google/genai' (New SDK) for Gemini 1.5/2.0 models.
// Do NOT use '@google/generative-ai' (Old SDK).
import { GoogleGenAI } from "@google/genai";
import { AppState, Customer, AgentProfile, ContractStatus, Appointment, Contract, Product } from "../types";
import { searchCustomersByName } from "./db";

// --- CONFIGURATION ---
const getApiKey = (): string => {
    return localStorage.getItem('gemini_api_key') || '';
};

const apiKey = getApiKey();
// Client-side instance is ONLY created if user manually injected key in localStorage
// NEW SDK SYNTAX: new GoogleGenAI({ apiKey: ... })
const clientAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

// OPTIMIZATION: Use Flash model for faster response (1-2s) instead of Pro (10s+)
const DEFAULT_MODEL = 'gemini-3-flash-preview'; 
const REASONING_MODEL = 'gemini-3-pro-preview'; 

// --- GENERIC HELPERS ---
const callGemini = async (systemInstruction: string, prompt: string, model: string = DEFAULT_MODEL, responseMimeType: string = 'text/plain') => {
    // 1. Try Cloud Functions (Secure Production Way)
    if (isFirebaseReady) {
        try {
            const gateway = httpsCallable(functions, 'geminiGateway');
            const result: any = await gateway({
                endpoint: 'generateContent',
                model: model,
                systemInstruction: systemInstruction,
                contents: prompt,
                config: {
                    responseMimeType: responseMimeType,
                    temperature: 0.7
                }
            });
            return result.data.text;
        } catch (e) {
            console.warn("Cloud Function failed, falling back to client-side if key exists.", e);
        }
    }

    // 2. Fallback to Client Side (Demo/Dev Way)
    if (clientAI) {
        const response = await clientAI.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: responseMimeType,
                temperature: 0.7
            }
        });
        return response.text;
    }

    throw new Error("Không thể kết nối AI. Vui lòng kiểm tra API Key hoặc Cloud Functions.");
};

// --- MARKETING FEATURES ---

/**
 * Generate a Case Study based on Real Customer Data
 */
export const generateCaseStudy = async (
    customer: Customer, 
    contracts: Contract[], 
    framework: 'AIDA' | 'PAS' = 'AIDA'
) => {
    // 1. Prepare Data Context
    const activeContracts = contracts.filter(c => c.status === ContractStatus.ACTIVE);
    const totalProtection = activeContracts.reduce((sum, c) => sum + c.mainProduct.sumAssured, 0);
    const claims = customer.claims || [];
    const hasClaim = claims.length > 0;
    const yearsActive = activeContracts.length > 0 
        ? new Date().getFullYear() - new Date(activeContracts[0].effectiveDate).getFullYear() 
        : 0;

    const context = `
    DỮ LIỆU KHÁCH HÀNG (Ẩn danh):
    - Tên viết tắt: ${customer.fullName.split(' ').pop()}
    - Nghề nghiệp: ${customer.occupation || 'N/A'}
    - Tình trạng: ${hasClaim ? 'Đã từng được chi trả quyền lợi' : 'Đang được bảo vệ an toàn'}
    - Tổng bảo vệ: ${(totalProtection/1000000).toLocaleString()} Triệu VNĐ
    - Thời gian đồng hành: ${yearsActive} năm
    - Sự kiện bồi thường (nếu có): ${hasClaim ? JSON.stringify(claims.map(c => c.benefitType)) : 'Chưa có rủi ro'}
    `;

    const systemInstruction = `
    BẠN LÀ MỘT CHUYÊN GIA COPYWRITING BẢO HIỂM MDRT (Million Dollar Round Table).
    Nhiệm vụ: Viết một bài chia sẻ (Case Study) lên Facebook/Zalo dựa trên câu chuyện thật của khách hàng.

    YÊU CẦU QUAN TRỌNG:
    1. **Ẩn danh tuyệt đối**: Không dùng tên thật, chỉ dùng tên viết tắt hoặc danh xưng (Chị A, Anh B).
    2. **Cảm xúc & Chân thực**: Viết như một lời tâm sự của tư vấn viên, không quảng cáo sáo rỗng.
    3. **Framework**: Sử dụng cấu trúc ${framework}.
       - ${framework === 'AIDA' ? 'Attention (Gây chú ý) -> Interest (Hoàn cảnh) -> Desire (Giải pháp/Giá trị) -> Action (Kêu gọi nhẹ nhàng)' : 'Problem (Nỗi đau/Rủi ro) -> Agitate (Hệ quả nếu không có BH) -> Solution (Sự an tâm khi có BH)'}
    4. **Image Prompt**: Ở cuối, hãy cung cấp một đoạn mô tả (prompt) tiếng Anh để tạo ảnh minh họa bằng AI (Midjourney/DALL-E) phù hợp với nội dung bài viết.

    ĐỊNH DẠNG JSON OUTPUT:
    {
      "title": "Tiêu đề thu hút (Giật tít)",
      "content": "Nội dung bài viết (có icon, chia đoạn dễ đọc)",
      "imagePrompt": "Mô tả ảnh chi tiết (Photorealistic, cinematic lighting, emotional...)"
    }
    `;

    const prompt = `Hãy viết câu chuyện dựa trên dữ liệu sau:\n${context}`;

    const json = await callGemini(systemInstruction, prompt, 'gemini-3-flash-preview', 'application/json');
    return JSON.parse(json || '{}');
};

export const generateSocialPost = async (topic: string, tone: string) => {
    const systemInstruction = `Bạn là chuyên gia Content Marketing Bảo hiểm. Hãy viết 3 bài đăng Facebook ngắn gọn, hấp dẫn về chủ đề được yêu cầu. Giọng văn: ${tone}. Trả về JSON: [{"title": "...", "content": "..."}]`;
    const json = await callGemini(systemInstruction, topic, 'gemini-3-flash-preview', 'application/json');
    return JSON.parse(json || '[]');
};

export const generateContentSeries = async (topic: string, profile: AgentProfile | null) => {
    const systemInstruction = `
    Bạn là chiến lược gia nội dung. Hãy lập kế hoạch 5 bài viết (5 ngày) để giáo dục khách hàng về chủ đề: "${topic}".
    Mục tiêu: Từ tò mò -> Quan tâm -> Mong muốn -> Hành động.
    Người viết: ${profile?.fullName || 'Tư vấn viên tận tâm'}, phong cách chuyên nghiệp.
    Trả về JSON: [{"day": "Ngày 1", "type": "Giáo dục/Kể chuyện/...", "content": "Nội dung chi tiết..."}]
    `;
    const json = await callGemini(systemInstruction, "Lập kế hoạch", 'gemini-3-flash-preview', 'application/json');
    return JSON.parse(json || '[]');
};

export const generateStory = async (facts: string, emotion: string) => {
    const systemInstruction = `
    Bạn là người kể chuyện tài ba. Hãy biến những dữ kiện khô khan sau thành một câu chuyện ngắn cảm động, sâu sắc (Storytelling).
    Cảm xúc chủ đạo: ${emotion}.
    Tuyệt đối không dùng giọng văn bán hàng. Hãy viết như một người bạn đang kể lại trải nghiệm.
    `;
    return await callGemini(systemInstruction, facts);
};

export const extractPdfText = async (fileUrl: string) => {
    if (!isFirebaseReady) return "Chế độ Demo không hỗ trợ đọc PDF server-side.";
    try {
        const gateway = httpsCallable(functions, 'geminiGateway');
        const result: any = await gateway({ endpoint: 'extractText', url: fileUrl });
        return result.data.text;
    } catch (e) {
        console.error("PDF Extract Error", e);
        return "";
    }
};

export const extractIdentityCard = async (base64Image: string) => {
    if (!clientAI) return null; // Vision require client key or complex server setup
    try {
        const model = clientAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
        const result = await model.generateContent({
            contents: [
                { role: 'user', parts: [
                    { text: "Trích xuất thông tin từ thẻ CCCD này. Trả về JSON: {idCard, fullName, dob (YYYY-MM-DD), gender, companyAddress}" },
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
                ]}
            ]
        });
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
        console.error(e);
        return null;
    }
}

// --- EXISTING CHAT FUNCTIONS ---
export const analyzeSocialInput = async (text: string) => { return {}; /* Stub */ };

export const chatWithData = async (query: string, imageBase64: string | null, state: AppState, history: any[], onStream?: (chunk: string) => void) => {
    // Re-implement or adapt existing logic here using callGemini pattern or direct clientAI
    // For brevity, using simplified version aligned with Marketing needs
    return { text: "Tính năng Chat đang được nâng cấp.", action: null };
};

export const consultantChat = async (msg: string, customer: any, contracts: any, relationships: any, profile: any, goal: string, history: any[], role: string, plan: any, style: string) => {
    const systemInstruction = `
    Vai trò: ${role === 'customer' ? 'Bạn là khách hàng khó tính, đang do dự.' : 'Bạn là SU SAM - Trợ lý MDRT xuất sắc.'}
    Mục tiêu hội thoại: ${goal}.
    Phong cách: ${style}.
    Thông tin khách hàng: ${JSON.stringify(customer)}.
    `;
    return await callGemini(systemInstruction, msg);
};

// UPDATED: Support generic context (string) or specific customer object
export const getObjectionSuggestions = async (objection: string, customerContext: Customer | string = 'Khách hàng chung chung') => {
    
    // Format context for AI
    const contextStr = typeof customerContext === 'string' 
        ? customerContext 
        : `Khách hàng: ${customerContext.fullName}, ${new Date().getFullYear() - new Date(customerContext.dob).getFullYear()} tuổi, nghề nghiệp: ${customerContext.occupation}`;

    const systemInstruction = `
    BẠN LÀ TOP MDRT COACH (Huấn luyện viên bảo hiểm xuất sắc).
    
    Nhiệm vụ: Phân tích lời từ chối của khách hàng: "${objection}"
    Ngữ cảnh: ${contextStr}
    
    Hãy đưa ra 3 kịch bản đối đáp sắc sảo (Script) để TVV xử lý, theo 3 phong cách khác nhau.
    Ngôn ngữ: Tiếng Việt, tự nhiên, sắc bén, chuyên nghiệp nhưng gần gũi.

    ĐỊNH DẠNG JSON OUTPUT (Bắt buộc trả về mảng JSON thuần túy):
    [
      {
        "type": "empathy",
        "label": "Đồng cảm & Xoa dịu",
        "content": "Câu trả lời mẫu tập trung vào cảm xúc..."
      },
      {
        "type": "logic",
        "label": "Logic & Số liệu",
        "content": "Câu trả lời mẫu dùng con số, sự kiện thực tế để chứng minh..."
      },
      {
        "type": "question",
        "label": "Đặt câu hỏi ngược",
        "content": "Câu hỏi gậy ông đập lưng ông để khách tự nhận ra vấn đề..."
      }
    ]
    `;
    
    const prompt = "Hãy phân tích ngay.";
    const json = await callGemini(systemInstruction, prompt, 'gemini-3-flash-preview', 'application/json');
    return JSON.parse(json || '[]');
};

// --- NEW FEATURE: PRE-UNDERWRITING ---
export const checkPreUnderwriting = async (condition: string, customer?: Customer) => {
    const contextStr = customer
        ? `Khách hàng: ${customer.fullName}, ${new Date().getFullYear() - new Date(customer.dob).getFullYear()} tuổi, Giới tính: ${customer.gender}, Nghề nghiệp: ${customer.occupation}`
        : 'Khách hàng giả định: 35 tuổi, Nam, Nhân viên văn phòng';

    const systemInstruction = `
    BẠN LÀ CHUYÊN GIA THẨM ĐỊNH BẢO HIỂM (UNDERWRITER) CAO CẤP CỦA PRUDENTIAL VIỆT NAM.
    Nhiệm vụ: Phân tích rủi ro y khoa dựa trên thông tin bệnh sử và dự báo kết quả thẩm định.

    DỮ LIỆU ĐẦU VÀO:
    - Bệnh sử/Tình trạng y tế: "${condition}"
    - Hồ sơ nhân thân: ${contextStr}

    YÊU CẦU ĐẦU RA (JSON FORMAT ONLY):
    Trả về một đối tượng JSON với cấu trúc sau:
    {
        "prediction": "Standard" | "Loading" | "Exclusion" | "Postpone" | "Decline", 
        "predictionLabel": "Nhãn hiển thị tiếng Việt (VD: Phí Chuẩn, Tăng Phí, Loại Trừ, Tạm Hoãn, Từ Chối)",
        "riskLevel": "Low" | "Medium" | "High",
        "loadingEstimate": "Ước lượng % tăng phí (VD: +50% - +75%) hoặc 'Không áp dụng'",
        "requirements": ["Danh sách các chứng từ y tế/xét nghiệm cụ thể cần bổ sung", "VD: Sao y bệnh án, Kết quả sinh thiết..."],
        "reasoning": "Giải thích ngắn gọn (2-3 câu) về lý do đưa ra dự đoán này (dựa trên y khoa và quy tắc bảo hiểm).",
        "questions": ["1-2 câu hỏi TVV cần hỏi thêm khách hàng để làm rõ tình trạng này (VD: Đã điều trị bao lâu? Đang dùng thuốc gì?)"]
    }

    LƯU Ý: Nếu thông tin quá sơ sài (VD: chỉ ghi 'đau bụng'), hãy đưa ra dự đoán dựa trên giả định phổ biến nhất và yêu cầu làm rõ trong phần 'questions'.
    `;

    const prompt = "Hãy tiến hành thẩm định sơ bộ hồ sơ này.";
    const json = await callGemini(systemInstruction, prompt, 'gemini-3-flash-preview', 'application/json');
    return JSON.parse(json || '{}');
};

// --- NEW FEATURE: SMART CLAIM ASSISTANT ---
export const analyzeClaimSupport = async (contract: Contract, product: Product | undefined, eventDescription: string) => {
    // Context Construction
    const productInfo = product 
        ? `Sản phẩm chính: ${product.name}\nQuy tắc (Tóm tắt): ${product.extractedContent || product.description}` 
        : `Sản phẩm chính: ${contract.mainProduct.productName}`;
    
    const ridersInfo = contract.riders.map(r => `- ${r.productName}: STBH ${r.sumAssured.toLocaleString()} VND (Gói: ${JSON.stringify(r.attributes)})`).join('\n');

    const systemInstruction = `
    BẠN LÀ TRỢ LÝ GIẢI QUYẾT QUYỀN LỢI BẢO HIỂM (CLAIMS ASSISTANT).
    Nhiệm vụ: Dựa trên hợp đồng và sự kiện bảo hiểm, hãy hướng dẫn khách hàng thủ tục bồi thường chính xác nhất.

    DỮ LIỆU HỢP ĐỒNG:
    - Số HĐ: ${contract.contractNumber}
    - Ngày hiệu lực: ${contract.effectiveDate}
    - Tình trạng: ${contract.status} (Nếu 'Mất hiệu lực', hãy cảnh báo ngay)
    - Sản phẩm chính: ${contract.mainProduct.productName} (STBH: ${contract.mainProduct.sumAssured.toLocaleString()})
    - Sản phẩm bổ trợ (Riders): 
    ${ridersInfo}
    - Loại trừ/Tăng phí (nếu có): ${contract.exclusionNote || 'Không có'}

    THÔNG TIN SẢN PHẨM (NẾU CÓ):
    ${productInfo}

    SỰ KIỆN BẢO HIỂM: "${eventDescription}"

    YÊU CẦU ĐẦU RA (JSON ONLY):
    Trả về JSON với cấu trúc:
    {
        "eligible": boolean, // Có khả năng được chi trả không? (Dựa trên status HĐ và quyền lợi có trong HĐ)
        "warning": "Cảnh báo quan trọng (VD: HĐ đang mất hiệu lực, hoặc sự kiện nằm trong thời gian chờ...)",
        "checklist": [
            {"item": "Tên giấy tờ", "note": "Ghi chú (VD: Bản gốc/Sao y, Cần hóa đơn đỏ...)"}
        ],
        "estimatedAmount": "Ước tính số tiền (VD: ~3.000.000đ hoặc 'Theo chi phí thực tế tối đa 200tr')",
        "reasoning": "Giải thích ngắn gọn tại sao được/không được chi trả, dựa trên quyền lợi nào."
    }
    `;

    const prompt = "Hãy phân tích yêu cầu bồi thường này.";
    const json = await callGemini(systemInstruction, prompt, 'gemini-3-flash-preview', 'application/json');
    return JSON.parse(json || '{}');
};

export const generateActionScript = async (task: any, customer: any) => {
    const systemInstruction = `
    Viết kịch bản ngắn (tin nhắn Zalo) để tư vấn viên gửi cho khách hàng.
    Mục đích: ${task.title}. Lý do: ${task.why}.
    Khách hàng: ${customer?.fullName}.
    Trả về JSON: {opening: "...", core_message: "..."}
    `;
    const json = await callGemini(systemInstruction, "Viết kịch bản", 'gemini-3-flash-preview', 'application/json');
    return JSON.parse(json || '{}');
};
