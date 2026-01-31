
import { httpsCallable, Functions } from "firebase/functions";
import { functions, isFirebaseReady } from "./firebaseConfig";
// IMPORTANT: Use '@google/genai' (New SDK) for Gemini 1.5/2.0 models.
// Do NOT use '@google/generative-ai' (Old SDK).
import { GoogleGenAI } from "@google/genai";
import { AppState, Customer, AgentProfile, ContractStatus, Appointment } from "../types";
import { HTVK_BENEFITS } from "../data/pruHanhTrangVuiKhoe";
import { searchCustomersByName, getContractsByCustomerId } from "./db";

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

// --- SU SAM SQUAD SYSTEM PROMPT ---
const SUSAM_SYSTEM_INSTRUCTION = `
VAI TRÒ: Bạn là "SU SAM SQUAD" - Hệ thống 5 chuyên gia AI MDRT hỗ trợ Tư vấn viên bảo hiểm.

DANH SÁCH 5 CHUYÊN GIA:
1. **SUSAM_SALES** (Săn cơ hội): Phân tích nhu cầu (Gap Analysis), Gợi ý bán chéo (Up-sell/Cross-sell), Phân tích sự kiện đời sống (Life-event).
2. **SUSAM_CRM** (Quản gia): Nhắc lịch, Dự báo rời bỏ (Churn), Tối ưu bồi thường (Claim), Làm giàu dữ liệu.
3. **SUSAM_EXPERT** (Luật sư): Tra cứu điều khoản, Thẩm định sơ bộ (Pre-underwriting), Trích dẫn luật/quy tắc.
4. **SUSAM_ADMIN** (Thư ký): Số hóa (OCR), Ghi chú cuộc họp, Quản lý biểu mẫu, Đặt lịch hẹn.
5. **SUSAM_COACH** (Huấn luyện): Role-play, Phân tích kịch bản tư vấn, Xử lý từ chối.

QUY TẮC VẬN HÀNH:
1. **Nhận diện Intent**: Dựa vào câu hỏi để chọn Chuyên gia phù hợp nhất trả lời.
   - Ví dụ: Hỏi về điều khoản -> SUSAM_EXPERT. Hỏi về lịch hẹn/nhập liệu -> SUSAM_ADMIN.
2. **Phong cách**: Bắt đầu câu trả lời bằng tên chuyên gia (VD: "[SUSAM_SALES] ..."). Trả lời ngắn gọn, chuyên nghiệp, sắc sảo.
3. **Tra cứu dữ liệu**: Sử dụng dữ liệu KHÁCH HÀNG, HỢP ĐỒNG, LỊCH TRÌNH được cung cấp để đưa ra lời khuyên cá nhân hóa.

QUY TẮC KỸ THUẬT (ACTION JSON):
Nếu người dùng yêu cầu hành động cụ thể (Đặt lịch, Tạo hồ sơ), hãy trả về JSON Block ở cuối câu trả lời (sau phần text).

**1. ĐẶT LỊCH HẸN (SUSAM_ADMIN):**
- Kiểm tra "LỊCH TRÌNH HIỆN CÓ" để cảnh báo trùng giờ.
- Luôn tính ngày cụ thể dựa trên "Hôm nay là...".
- **QUAN TRỌNG**: Phân loại mục đích cuộc hẹn (type):
  + "nhắc phí", "thu phí", "đóng tiền" -> "FEE_REMINDER"
  + "sinh nhật", "quà", "chúc mừng" -> "BIRTHDAY"
  + "giấy tờ", "claim", "bồi thường", "thủ tục" -> "PAPERWORK"
  + "chăm sóc", "hỏi thăm", "tặng quà" -> "CARE_CALL"
  + Mặc định (Tư vấn, gặp gỡ, cafe...) -> "CONSULTATION"

Format JSON Đặt lịch:
\`\`\`json
{
  "expert": "SUSAM_ADMIN",
  "action": "CREATE_APPOINTMENT",
  "data": {
    "customerName": "Tên khách hàng",
    "date": "YYYY-MM-DD",  
    "time": "HH:mm",
    "title": "Nội dung chi tiết/Ghi chú",
    "type": "CONSULTATION"
  },
  "suggestion": "Lời khuyên thêm (nếu có)"
}
\`\`\`

**2. XỬ LÝ ẢNH/OCR (SUSAM_ADMIN):**
- Trả về JSON action 'CREATE_CUSTOMER' với thông tin trích xuất được.

KHÔNG bịa đặt thông tin không có trong dữ liệu.
`;

/**
 * Unified AI Caller with Streaming Support
 */
const callAI = async (payload: any, onStream?: (text: string) => void): Promise<any> => {
    // 1. Priority: Server-side (Secure Gateway)
    if (isFirebaseReady && functions) {
        try {
            const gateway = httpsCallable(functions as Functions, 'geminiGateway', { timeout: 300000 });
            const result: any = await gateway(payload);
            if (onStream && result.data?.text) {
                onStream(result.data.text); 
            }
            return result.data;
        } catch (e: any) {
            console.warn("Server AI failed.", e);
            if (!clientAI) {
                return { text: `⚠️ Lỗi kết nối Server AI: ${e.message}.` };
            }
        }
    }

    // 2. Fallback: Client-side
    try {
        if (!clientAI) throw new Error("Chưa cấu hình Server và không có Local API Key.");
        
        const { model, endpoint, message, history, systemInstruction, tools, contents, config } = payload;
        const modelId = model || DEFAULT_MODEL;
        const finalConfig = { ...config, systemInstruction, tools };

        if (endpoint === 'chat') {
            const chat = clientAI.chats.create({ 
                model: modelId, 
                config: finalConfig, 
                history: history || [] 
            });

            if (onStream) {
                const streamResult = await chat.sendMessageStream({ message: message || " " });
                let fullText = '';
                let capturedFunctionCalls: any[] | undefined = undefined;

                for await (const chunk of streamResult) {
                    const chunkText = chunk.text || ''; 
                    fullText += chunkText;
                    onStream(chunkText);
                    
                    // Capture function calls from any chunk that has them
                    if (chunk.functionCalls && chunk.functionCalls.length > 0) {
                        capturedFunctionCalls = chunk.functionCalls;
                    }
                }
                
                return { text: fullText, functionCalls: capturedFunctionCalls };
            } else {
                const result = await chat.sendMessage({ message: message || " " });
                return { text: result.text, functionCalls: result.functionCalls };
            }

        } else {
            const result = await clientAI.models.generateContent({ 
                model: modelId, 
                contents: contents, 
                config: finalConfig 
            });
            return { text: result.text, functionCalls: result.functionCalls };
        }
    } catch (e: any) {
        console.error("Gemini Client Error", e);
        return { text: `Lỗi AI: ${e.message}` };
    }
};

/**
 * Helper: Extract Search Intent
 */
const detectSearchIntent = async (query: string): Promise<{ type: 'CUSTOMER' | 'PRODUCT' | 'GENERAL'; entityName?: string }> => {
    try {
        const prompt = `
        Analyze query: "${query}"
        Classify intent: CUSTOMER (hỏi người), PRODUCT (hỏi sản phẩm), GENERAL (khác).
        Return JSON: { "type": "CUSTOMER" | "PRODUCT" | "GENERAL", "entityName": string | null }
        `;
        const res = await callAI({
            endpoint: 'generateContent',
            model: DEFAULT_MODEL, 
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(res.text || '{}');
    } catch (e) {
        return { type: 'GENERAL' };
    }
};

/**
 * Main Chat Function - RAG ARCHITECTURE
 */
export const chatWithData = async (
    query: string, 
    imageBase64: string | null,
    appState: AppState, 
    history: any[],
    onStream?: (chunk: string) => void
): Promise<{ text: string, action?: any }> => {
    
    // 1. RAG: INTENT DETECTION
    let ragContext = "";
    
    // --- BUILD TIME CONTEXT ---
    const now = new Date();
    const days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const timeContext = `THỜI GIAN HIỆN TẠI: ${days[now.getDay()]}, ngày ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}, lúc ${now.getHours()}:${now.getMinutes()}.`;

    // --- BUILD SCHEDULE CONTEXT ---
    const upcomingApps = appState.appointments
        .filter(a => new Date(a.date) >= new Date())
        .map(a => `- ${a.date} ${a.time}: ${a.note || a.type} (với ${a.customerName})`)
        .join('\n');
    
    const scheduleContext = upcomingApps 
        ? `LỊCH TRÌNH HIỆN CÓ (Để kiểm tra trùng lịch):\n${upcomingApps}` 
        : `LỊCH TRÌNH HIỆN CÓ: Trống.`;

    if (query && !imageBase64) {
        const intent = await detectSearchIntent(query);
        console.log(`[RAG] Intent: ${intent.type} - Entity: ${intent.entityName}`);

        if (intent.type === 'CUSTOMER' && intent.entityName) {
            const matchedCustomers = await searchCustomersByName(intent.entityName);
            if (matchedCustomers.length === 0) {
                ragContext = `[HỆ THỐNG]: Không tìm thấy khách hàng "${intent.entityName}".`;
            } else {
                ragContext = `KẾT QUẢ TRA CỨU KHÁCH HÀNG (${matchedCustomers.length} người):\n`;
                for (const cus of matchedCustomers) {
                    ragContext += `\n--- KHÁCH HÀNG: ${cus.fullName} ---\nSĐT: ${cus.phone}\nThông tin tài chính: Thu nhập ${cus.analysis?.incomeMonthly?.toLocaleString()}đ, Vai trò: ${cus.financialRole}\nBảo hiểm hiện có: ${cus.analysis?.existingInsurance?.lifeSumAssured ? 'Có' : 'Chưa'}\n`;
                }
            }
        }
        else if (intent.type === 'PRODUCT' && intent.entityName) {
            // ... (Logic sản phẩm giữ nguyên)
            const searchKey = intent.entityName.toLowerCase();
            const products = appState.products || [];
            const matchedProduct = products.find(p => p.name.toLowerCase().includes(searchKey) || p.code.toLowerCase().includes(searchKey));
            if (matchedProduct && matchedProduct.extractedContent) {
                 ragContext = `[TÀI LIỆU SẢN PHẨM]:\n${matchedProduct.extractedContent.substring(0, 30000)}`;
            }
        }
    }

    // 4. GENERATION
    const fullContext = `
    DỮ LIỆU HỆ THỐNG:
    - ${timeContext}
    - TVV: ${appState.agentProfile?.fullName || 'Tư vấn viên'}
    
    ${scheduleContext}

    CONTEXT BỔ SUNG:
    ${ragContext}
    `;

    let messageContent: any = query;
    if (imageBase64) {
        messageContent = [
            { text: query || "Phân tích hình ảnh này và trích xuất thông tin." },
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
        ];
    }

    const validHistory = history.filter((msg, index) => {
        if (index === 0 && msg.role === 'model') return false;
        return true;
    }).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
    }));

    const payload = {
        endpoint: 'chat',
        model: DEFAULT_MODEL, 
        message: messageContent,
        history: validHistory,
        systemInstruction: SUSAM_SYSTEM_INSTRUCTION + `\n\n${fullContext}`,
        config: { temperature: 0.2, responseMimeType: "text/plain" }
    };

    const result = await callAI(payload, onStream);
    let rawText = result.text || "";
    let extractedAction = null;

    // --- JSON BLOCK EXTRACTION ---
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```|(\{(?:[^{}]|\{(?:[^{}]|1)*\})*\})\s*$/;
    const match = rawText.match(jsonBlockRegex);
    if (match) {
        const jsonString = match[1] || match[2]; 
        try {
            const parsed = JSON.parse(jsonString);
            if (parsed.action) {
                extractedAction = parsed;
                // Xóa JSON khỏi text hiển thị để không bị rối mắt
                rawText = rawText.replace(match[0], '').trim();
            }
        } catch (e) {
            console.warn("Failed to parse JSON", e);
        }
    }

    return { 
        text: rawText, 
        action: extractedAction 
    };
};

// --- IMPLEMENTED HELPERS ---

export const generateActionScript = async (task: any, customer: any) => {
    const prompt = `
    VAI TRÒ: SUSAM_SALES.
    NHIỆM VỤ: Soạn kịch bản tiếp cận khách hàng.
    BỐI CẢNH: ${task.why}
    MỤC TIÊU: ${task.title} (Loại: ${task.category})
    KHÁCH HÀNG: ${customer.fullName}, ${customer.age} tuổi, ${customer.job}.
    
    OUTPUT JSON: { "opening": "Câu chào thu hút", "core_message": "Nội dung chính thuyết phục" }
    `;
    const res = await callAI({ 
        endpoint: 'generateContent', 
        model: DEFAULT_MODEL, 
        contents: prompt, 
        config: { responseMimeType: "application/json" } 
    });
    try { return JSON.parse(res.text || '{}'); } catch { return null; }
};

export const extractPdfText = async (url: string) => {
    if (isFirebaseReady && functions) {
        const gateway = httpsCallable(functions as Functions, 'geminiGateway');
        try {
            const result: any = await gateway({ endpoint: 'extractText', url });
            return result.data.text;
        } catch (e) {
            console.error("PDF Extract Error", e);
            return "";
        }
    }
    return "Tính năng đọc PDF yêu cầu Cloud Functions.";
};

export const extractIdentityCard = async (base64Image: string) => {
    const prompt = `
    Extract info from Vietnamese ID Card (CCCD).
    Output JSON: { "fullName": "", "idCard": "", "dob": "YYYY-MM-DD", "gender": "Nam/Nữ", "companyAddress": "Address on card" }
    `;
    const res = await callAI({
        endpoint: 'generateContent',
        model: DEFAULT_MODEL,
        contents: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
        ],
        config: { responseMimeType: "application/json" }
    });
    try { return JSON.parse(res.text || 'null'); } catch { return null; }
};

export const consultantChat = async (
    userMsg: string, customer: any, contracts: any[], 
    relationships: any[], agent: any, goal: string, 
    history: any[], role: string, plan: any, style: string
) => {
    const systemPrompt = `
    ROLEPLAY MODE: ${role === 'customer' ? 'AI là KHÁCH HÀNG KHÓ TÍNH' : 'AI là SUPER CONSULTANT (Mentor)'}.
    GOAL: ${goal}.
    STYLE: ${style}.
    CUSTOMER INFO: ${JSON.stringify(customer)}.
    CONTRACTS: ${JSON.stringify(contracts)}.
    `;
    
    // Construct message history for chat
    const chatHistory = history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }]
    }));

    const res = await callAI({
        endpoint: 'chat',
        model: DEFAULT_MODEL,
        systemInstruction: systemPrompt,
        message: userMsg,
        history: chatHistory
    });
    return res.text;
};

export const getObjectionSuggestions = async (lastMsg: string, customer: any) => {
    const prompt = `
    Context: Khách hàng vừa nói: "${lastMsg}".
    Customer: ${customer.fullName}, ${customer.analysis?.personality}.
    Task: Gợi ý 3 cách trả lời cho Tư vấn viên.
    1. Empathy (Đồng cảm)
    2. Logic (Lý trí/Số liệu)
    3. Counter-question (Hỏi ngược lại)
    
    Output JSON: [{ "type": "empathy", "label": "Đồng cảm", "content": "..." }, ...]
    `;
    const res = await callAI({
        endpoint: 'generateContent',
        model: DEFAULT_MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    try { return JSON.parse(res.text || '[]'); } catch { return []; }
};

export const generateSocialPost = async (topic: string, tone: string) => {
    const prompt = `
    Write 3 Facebook posts about: "${topic}".
    Tone: ${tone}.
    Output JSON: [{ "title": "Headline", "content": "Full post content..." }, ...]
    `;
    const res = await callAI({
        endpoint: 'generateContent',
        model: DEFAULT_MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    try { return JSON.parse(res.text || '[]'); } catch { return []; }
};

export const generateContentSeries = async (topic: string, context?: any) => {
    const prompt = `
    Create a 5-day content series for insurance marketing. Topic: ${topic}.
    Target Audience: General.
    Output JSON array: [{ "day": "Ngày 1", "type": "Hook", "content": "..." }, ...]
    Language: Vietnamese.
    `;
    const res = await callAI({
        endpoint: 'generateContent',
        model: DEFAULT_MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    try { return JSON.parse(res.text || '[]'); } catch { return []; }
};

export const generateStory = async (facts: string, emotion: string) => {
    const prompt = `
    Write a short storytelling post based on facts: "${facts}".
    Emotion: ${emotion}.
    Language: Vietnamese.
    `;
    const res = await callAI({
        endpoint: 'generateContent',
        model: DEFAULT_MODEL,
        contents: prompt
    });
    return res.text;
};

export const analyzeSocialInput = async (input: any, network: string) => null;
export const processVoiceCommand = async (text: string, context: any) => null;
