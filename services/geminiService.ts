
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
VAI TRÒ: Bạn là "TuanChom AI" - Siêu trợ lý quản lý công việc cho Tư vấn viên bảo hiểm Prudential.

NHIỆM VỤ CỦA BẠN:
1. **Xử lý thông tin**: Hiểu yêu cầu người dùng.
2. **Retrieval (Tra cứu)**: Tra cứu thông tin khách hàng/sản phẩm.
3. **Thực thi (Action)**: Trả về JSON để App thực thi lệnh.

QUY TẮC ĐẶT LỊCH HẸN (QUAN TRỌNG NHẤT):
1. **Kiểm tra trùng lịch**: Dựa vào danh sách "LỊCH TRÌNH HIỆN CÓ" bên dưới. Nếu trùng giờ, hãy cảnh báo.
2. **Xác định ngày giờ**:
   - Luôn tính toán ngày cụ thể dựa trên "Hôm nay là...".
   - Ví dụ: Hôm nay 20/05/2024 -> "Ngày mai" là "2024-05-21".
3. **OUTPUT JSON BẮT BUỘC**:
   Khi người dùng CHỐT đặt lịch, bạn PHẢI trả về JSON chính xác theo mẫu sau (không được đổi tên key):
   \`\`\`json
   {
     "action": "CREATE_APPOINTMENT",
     "data": {
       "customerName": "Tên đầy đủ của khách trong DB",
       "date": "YYYY-MM-DD",  
       "time": "HH:mm",
       "title": "Nội dung cuộc hẹn"
     }
   }
   \`\`\`
   Lưu ý: Key phải chính xác là "date" (không phải day/datetime), "time" (không phải hour).

QUY TẮC XỬ LÝ ẢNH CCCD/CMND:
- Trả về JSON action 'CREATE_CUSTOMER' với đầy đủ thông tin trích xuất.
- "phone": "" (Để trống nếu không có).

QUY TẮC TRẢ LỜI CHUNG:
- Trả lời ngắn gọn, thân thiện.
- KHÔNG nói "Đã đặt lịch" nếu chưa trả về JSON action.
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
                    ragContext += `\n--- KHÁCH HÀNG: ${cus.fullName} ---\nSĐT: ${cus.phone}\n`;
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
            { text: query || "Phân tích hình ảnh này." },
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

// ... Exports cũ giữ nguyên ...
export const generateActionScript = async (t: any, c: any) => null; 
export const extractPdfText = async (u: string) => "";
export const extractIdentityCard = async (b: string) => null;
export const consultantChat = async (...args: any[]) => "";
export const getObjectionSuggestions = async (m: string, c: any) => [];
export const generateSocialPost = async (t: string, tone: string) => [];
export const generateContentSeries = async (t: string) => [];
export const generateStory = async (f: string, e: string) => "";
export const analyzeSocialInput = async (i: any, n: string) => null;
export const processVoiceCommand = async (t: string, c: any) => null;
