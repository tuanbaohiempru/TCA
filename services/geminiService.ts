
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
Nếu người dùng yêu cầu hành động cụ thể, hãy trả về JSON Block ở cuối câu trả lời.

**TRƯỜNG HỢP 1: MƠ HỒ / TRÙNG TÊN (QUAN TRỌNG)**
Nếu Context cung cấp danh sách "DANH SÁCH ỨNG VIÊN" (nhiều khách hàng trùng tên), bạn TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ CHỌN.
Hãy trả về action "SELECT_CUSTOMER" chứa danh sách này để người dùng chọn.
\`\`\`json
{
  "expert": "SUSAM_ADMIN",
  "action": "SELECT_CUSTOMER",
  "data": {
    "candidates": [
       { "id": "c1", "name": "Nguyễn Văn Phi", "info": "Kỹ sư - 090...123" },
       { "id": "c2", "name": "Trần Đức Phi", "info": "Giáo viên - 091...456" }
    ]
  },
  "suggestion": "Tìm thấy nhiều người tên Phi. Anh chọn ai ạ?"
}
\`\`\`

**TRƯỜNG HỢP 2: ĐẶT LỊCH HẸN (SUSAM_ADMIN)**
Chỉ thực hiện khi đã xác định rõ 1 khách hàng cụ thể (Context có thông tin chi tiết 1 người).
- Phân loại mục đích (type): "nhắc phí"->FEE_REMINDER, "sinh nhật"->BIRTHDAY, "giấy tờ"->PAPERWORK, "chăm sóc"->CARE_CALL, còn lại->CONSULTATION.
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

**TRƯỜNG HỢP 3: XỬ LÝ ẢNH/OCR (SUSAM_ADMIN)**
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
 * Uses a small prompt to see if user is looking for a person or product
 */
const detectSearchIntent = async (query: string): Promise<{ type: 'CUSTOMER' | 'PRODUCT' | 'GENERAL'; entityName?: string }> => {
    try {
        const prompt = `
        Analyze query: "${query}"
        Classify intent: CUSTOMER (searching for a person/client), PRODUCT (searching for insurance product), GENERAL (chat).
        If CUSTOMER, extract the person's name as 'entityName'.
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
    
    // 1. RAG: INTENT DETECTION & SEARCH
    let ragContext = "";
    
    // --- BUILD TIME CONTEXT ---
    const now = new Date();
    const days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const timeContext = `THỜI GIAN HIỆN TẠI: ${days[now.getDay()]}, ngày ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}, lúc ${now.getHours()}:${now.getMinutes()}.`;

    // --- SEARCH-FIRST LOGIC (Prevent Hallucination) ---
    if (query && !imageBase64) {
        const intent = await detectSearchIntent(query);
        console.log(`[RAG] Intent: ${intent.type} - Entity: ${intent.entityName}`);

        if (intent.type === 'CUSTOMER' && intent.entityName) {
            // REAL DB SEARCH
            const matchedCustomers = await searchCustomersByName(intent.entityName);
            
            if (matchedCustomers.length === 0) {
                ragContext = `[HỆ THỐNG]: Không tìm thấy khách hàng nào có tên "${intent.entityName}" trong cơ sở dữ liệu. Hãy báo cho người dùng biết.`;
            } else if (matchedCustomers.length > 1) {
                // AMBIGUITY HANDLING
                ragContext = `[CẢNH BÁO HỆ THỐNG - QUAN TRỌNG]: Tìm thấy ${matchedCustomers.length} khách hàng trùng tên "${intent.entityName}".
                
                DANH SÁCH ỨNG VIÊN (CANDIDATES):
                ${matchedCustomers.map(c => JSON.stringify({
                    id: c.id, 
                    name: c.fullName, 
                    info: `${c.phone || 'Không SĐT'} - ${c.job || c.occupation || 'Không nghề'}`
                })).join('\n')}
                
                YÊU CẦU BẮT BUỘC: Bạn KHÔNG ĐƯỢC tự ý chọn một người. Bạn PHẢI trả về Action "SELECT_CUSTOMER" chứa danh sách candidates này để người dùng chọn.`;
            } else {
                // EXACT MATCH (1 person)
                const cus = matchedCustomers[0];
                ragContext = `KẾT QUẢ TRA CỨU KHÁCH HÀNG (Dùng thông tin này để xử lý):
                --- HỒ SƠ KHÁCH HÀNG ---
                ID: ${cus.id}
                Họ tên: ${cus.fullName}
                SĐT: ${cus.phone}
                Nghề nghiệp: ${cus.job || cus.occupation}
                Địa chỉ: ${cus.companyAddress}
                Ngày sinh: ${cus.dob}
                Tài chính: Thu nhập ${cus.analysis?.incomeMonthly?.toLocaleString()}đ, Vai trò: ${cus.financialRole}
                Bảo hiểm hiện có: ${cus.analysis?.existingInsurance?.lifeSumAssured ? 'Có' : 'Chưa'}
                Ghi chú gần nhất: ${cus.interactionHistory?.[0] || 'Chưa có'}
                ------------------------`;
            }
        }
        else if (intent.type === 'PRODUCT' && intent.entityName) {
            const searchKey = intent.entityName.toLowerCase();
            const products = appState.products || [];
            const matchedProduct = products.find(p => p.name.toLowerCase().includes(searchKey) || p.code.toLowerCase().includes(searchKey));
            if (matchedProduct && matchedProduct.extractedContent) {
                 ragContext = `[TÀI LIỆU SẢN PHẨM: ${matchedProduct.name}]:\n${matchedProduct.extractedContent.substring(0, 30000)}`;
            }
        }
    }

    // --- BUILD SCHEDULE CONTEXT ---
    const upcomingApps = appState.appointments
        .filter(a => new Date(a.date) >= new Date())
        .map(a => `- ${a.date} ${a.time}: ${a.note || a.type} (với ${a.customerName})`)
        .join('\n');
    
    const scheduleContext = upcomingApps 
        ? `LỊCH TRÌNH HIỆN CÓ (Để kiểm tra trùng lịch):\n${upcomingApps}` 
        : `LỊCH TRÌNH HIỆN CÓ: Trống.`;

    // 4. GENERATION
    const fullContext = `
    DỮ LIỆU HỆ THỐNG:
    - ${timeContext}
    - TVV: ${appState.agentProfile?.fullName || 'Tư vấn viên'}
    
    ${scheduleContext}

    CONTEXT TRA CỨU (QUAN TRỌNG):
    ${ragContext}
    `;

    let messageContent: any = query;
    if (imageBase64) {
        messageContent = [
            { text: query || "Phân tích hình ảnh này và trích xuất thông tin." },
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
        ];
    }

    // Filter valid history (remove empty initial model messages if any)
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
                // Clean JSON from display text
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

export const generateActionScript = async (task: any, customer: any) => {
    const prompt = `
    Viết kịch bản tiếp cận khách hàng (Script) cho Tư vấn viên.
    Bối cảnh: ${task.title} - ${task.why}.
    Khách hàng: ${customer ? customer.fullName : 'Chưa rõ'}.
    Yêu cầu: Ngắn gọn, chuyên nghiệp, gây ấn tượng.
    Output JSON: { "opening": "Câu mở đầu", "core_message": "Nội dung chính" }
    `;
    const res = await callAI({
        endpoint: 'generateContent',
        model: DEFAULT_MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(res.text || '{}');
};

export const extractPdfText = async (url: string) => {
    if (isFirebaseReady && functions) {
        const gateway = httpsCallable(functions, 'geminiGateway');
        const result: any = await gateway({ endpoint: 'extractText', url });
        return result.data?.text || "";
    }
    return "Tính năng đọc PDF yêu cầu kết nối Server Cloud Function.";
};

export const extractIdentityCard = async (base64Image: string) => {
    const prompt = `
    Trích xuất thông tin từ ảnh CCCD/CMND Việt Nam.
    Trả về JSON:
    {
        "fullName": "Họ tên in hoa",
        "idCard": "Số CCCD",
        "dob": "YYYY-MM-DD",
        "gender": "Nam/Nữ",
        "address": "Địa chỉ thường trú"
    }
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
    return JSON.parse(res.text || 'null');
};

export const consultantChat = async (
    message: string, 
    customer: any, 
    contracts: any[], 
    relationships: any[], 
    agent: any, 
    goal: string,
    history: any[],
    role: string,
    planResult: any,
    style: string
) => {
    const context = `
    THÔNG TIN KHÁCH HÀNG:
    - Tên: ${customer.fullName} (${customer.status})
    - Nghề nghiệp: ${customer.occupation}
    - Hợp đồng đã có: ${contracts.length}
    
    MỤC TIÊU CUỘC HỘI THOẠI: ${goal}
    
    VAI TRÒ CỦA AI: ${role === 'customer' ? 'Đóng vai Khách hàng (Bạn hãy đưa ra các lời từ chối khéo léo, đặt câu hỏi khó)' : 'Đóng vai SUSAM Mentor (Hướng dẫn TVV cách trả lời)'}.
    
    PHONG CÁCH TRẢ LỜI: ${style}.
    `;
    
    const payload = {
        endpoint: 'chat',
        model: DEFAULT_MODEL,
        message: message,
        history: history,
        systemInstruction: `Bạn đang trong chế độ Roleplay bảo hiểm. ${context}`
    };
    
    const res = await callAI(payload);
    return res.text;
};

export const getObjectionSuggestions = async (lastMessage: string, customer: any) => {
    const prompt = `
    Khách hàng vừa nói: "${lastMessage}".
    Hãy gợi ý 3 cách xử lý từ chối cho TVV.
    Output JSON: [ { "label": "Đồng cảm", "type": "empathy", "content": "..." }, { "label": "Logic", "type": "logic", "content": "..." }, { "label": "Câu chuyện", "type": "story", "content": "..." } ]
    `;
    const res = await callAI({
        endpoint: 'generateContent',
        model: DEFAULT_MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(res.text || '[]');
};

export const generateSocialPost = async (topic: string, tone: string) => {
    const prompt = `
    Viết 3 bài đăng Facebook về chủ đề: "${topic}".
    Giọng điệu: ${tone}.
    Mỗi bài gồm tiêu đề bắt mắt và nội dung ngắn gọn kèm icon.
    Định dạng JSON: [{ "title": "Tiêu đề", "content": "Nội dung" }]
    `;
    const res = await callAI({
        endpoint: 'generateContent',
        model: DEFAULT_MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(res.text || '[]');
};

export const generateContentSeries = async (topic: string, context: any) => {
    const contextInfo = context ? `Người viết: ${context.fullName} (${context.title})` : '';
    const prompt = `
    Lập kế hoạch chuỗi 5 bài viết Facebook (5 ngày) về chủ đề: "${topic}".
    ${contextInfo}
    Mục tiêu: Giáo dục và Thu hút khách hàng.
    Định dạng JSON: [{ "day": "Ngày 1", "type": "Giáo dục/Tương tác/Bán hàng", "content": "Nội dung chi tiết" }]
    `;
    const res = await callAI({
        endpoint: 'generateContent',
        model: DEFAULT_MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(res.text || '[]');
};

export const generateStory = async (facts: string, emotion: string) => {
    const prompt = `
    Dựa trên dữ kiện: "${facts}"
    Hãy viết một câu chuyện ngắn (Storytelling) cảm động, sâu sắc.
    Cảm xúc chủ đạo: ${emotion}.
    `;
    const res = await callAI({
        endpoint: 'generateContent',
        model: DEFAULT_MODEL,
        contents: prompt
    });
    return res.text || "";
};

export const analyzeSocialInput = async (input: any, network: string) => null;
export const processVoiceCommand = async (text: string, context: any) => null;
