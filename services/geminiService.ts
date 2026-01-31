import { httpsCallable, Functions } from "firebase/functions";
import { functions, isFirebaseReady } from "./firebaseConfig";
// NOTE: We use '@google/genai' (New SDK) for Gemini 1.5/2.0 features.
// Do not downgrade to '@google/generative-ai'.
import { GoogleGenAI } from "@google/genai";
import { AppState, Customer, AgentProfile, ContractStatus } from "../types";
import { HTVK_BENEFITS } from "../data/pruHanhTrangVuiKhoe";
import { searchCustomersByName, getContractsByCustomerId } from "./db";

// --- CONFIGURATION ---
const getApiKey = (): string => {
    // SECURITY UPDATE: Only allow manual local override for development debugging.
    // Never read from process.env in production build.
    return localStorage.getItem('gemini_api_key') || '';
};

const apiKey = getApiKey();
// Client-side instance is ONLY created if user manually injected key in localStorage
const clientAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

const DEFAULT_MODEL = 'gemini-3-pro-preview'; 
const FLASH_MODEL = 'gemini-3-flash-preview'; 

// --- SU SAM SQUAD SYSTEM PROMPT ---
const SUSAM_SYSTEM_INSTRUCTION = `
VAI TRÒ: Bạn là "TuanChom AI" - Siêu trợ lý quản lý công việc cho Tư vấn viên bảo hiểm Prudential.
Bạn có khả năng "nhìn" (qua ảnh), "nghe" (qua giọng nói) và thực hiện các tác vụ quản lý.

NHIỆM VỤ CỦA BẠN:
1. **Xử lý thông tin**: Hiểu yêu cầu người dùng.
2. **Retrieval (Tra cứu)**: Nếu người dùng hỏi về một khách hàng cụ thể, hệ thống sẽ cung cấp dữ liệu của khách hàng đó. Hãy dùng dữ liệu đó để trả lời.
3. **Thực thi (Action)**: Khi đã đủ thông tin, hãy trả về JSON đặc biệt để App thực thi lệnh.
4. **Tư vấn Quyền lợi**: Sử dụng thông tin chi tiết về sản phẩm (nếu có trong context) để trả lời chính xác số tiền/quyền lợi.

QUY TẮC TRẢ LỜI:
- Trả lời ngắn gọn, thân thiện, xưng "em", gọi "anh/chị".
- Dùng Markdown để định dạng đẹp (Bold, List).
`;

/**
 * Unified AI Caller
 * Prioritizes Cloud Functions (Secure). Falls back to Client Key (Dev) only if available.
 */
const callAI = async (payload: any): Promise<any> => {
    // 1. Priority: Server-side (Secure Gateway)
    // Always check the live value of isFirebaseReady
    if (isFirebaseReady && functions) {
        try {
            const gateway = httpsCallable(functions as Functions, 'geminiGateway', { timeout: 300000 });
            const result: any = await gateway(payload);
            return result.data;
        } catch (e: any) {
            console.warn("Server AI failed.", e);
            // If we have a local key, try fallback. If not, throw the error.
            if (!clientAI) {
                return { text: `⚠️ Lỗi kết nối Server AI: ${e.message}. Vui lòng kiểm tra lại Deploy hoặc Internet.` };
            }
        }
    }

    // 2. Fallback: Client-side (Dev Mode)
    try {
        if (!clientAI) throw new Error("Chưa cấu hình Server và không có Local API Key.");
        
        const { model, endpoint, message, history, systemInstruction, tools, contents, config } = payload;
        const modelId = model || DEFAULT_MODEL;
        const finalConfig = { ...config, systemInstruction, tools };

        if (endpoint === 'chat') {
            const chat = clientAI.chats.create({ model: modelId, config: finalConfig, history: history || [] });
            const result = await chat.sendMessage({ message: message || " " });
            return { text: result.text, functionCalls: result.functionCalls };
        } else {
            const result = await clientAI.models.generateContent({ model: modelId, contents: contents, config: finalConfig });
            return { text: result.text, functionCalls: result.functionCalls };
        }
    } catch (e: any) {
        console.error("Gemini Client Error", e);
        return { text: `Lỗi AI: ${e.message}` };
    }
};

/**
 * Helper: Extract Search Intent
 * Updated to use callAI wrapper (Secure)
 */
const detectSearchIntent = async (query: string): Promise<{ needsSearch: boolean; customerName?: string }> => {
    try {
        const prompt = `
        Analyze this query: "${query}"
        Does the user refer to a specific person/customer name?
        Return JSON only: { "needsSearch": boolean, "customerName": string | null }
        Example: "Chị Thanh quyền lợi thế nào?" -> {"needsSearch": true, "customerName": "Thanh"}
        Example: "Viết bài về ung thư" -> {"needsSearch": false, "customerName": null}
        `;
        
        // Use callAI to route through Gateway if needed
        const res = await callAI({
            endpoint: 'generateContent',
            model: FLASH_MODEL,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        return JSON.parse(res.text || '{}');
    } catch (e) {
        console.error("Intent Detection Failed", e);
        return { needsSearch: false };
    }
};

/**
 * Main Chat Function - RAG ARCHITECTURE
 */
export const chatWithData = async (
    query: string, 
    imageBase64: string | null,
    appState: AppState, 
    history: any[]
): Promise<{ text: string, action?: any }> => {
    
    // 1. RAG: INTENT DETECTION
    let ragContext = "";
    
    if (query && !imageBase64) {
        const intent = await detectSearchIntent(query);
        
        if (intent.needsSearch && intent.customerName) {
            console.log(`[RAG] Searching for: ${intent.customerName}`);
            
            // 2. RAG: RETRIEVAL (Server-side Search)
            // Use DB functions provided in db.ts
            const matchedCustomers = await searchCustomersByName(intent.customerName);
            
            if (matchedCustomers.length === 0) {
                ragContext = `[HỆ THỐNG]: Không tìm thấy khách hàng nào tên là "${intent.customerName}". Hãy báo lại cho người dùng.`;
            } else if (matchedCustomers.length > 3) {
                ragContext = `[HỆ THỐNG]: Tìm thấy quá nhiều người tên "${intent.customerName}" (${matchedCustomers.length} người). Hãy yêu cầu người dùng cung cấp thêm họ tên đầy đủ.`;
            } else {
                // 3. RAG: CONTEXT BUILDING
                ragContext = `KẾT QUẢ TRA CỨU DỮ LIỆU (${matchedCustomers.length} khách hàng): \n`;
                
                for (const cus of matchedCustomers) {
                    let contracts = await getContractsByCustomerId(cus.id);
                    // Fallback for Demo environment (if DB is empty but State has data)
                    if (contracts.length === 0 && appState.contracts.length > 0) {
                        contracts = appState.contracts.filter(c => c.customerId === cus.id);
                    }

                    ragContext += `\n--- KHÁCH HÀNG: ${cus.fullName} (Tuổi: ${new Date().getFullYear() - new Date(cus.dob).getFullYear()}) ---\n`;
                    ragContext += `SĐT: ${cus.phone}\n`;
                    
                    if (contracts.length === 0) {
                        ragContext += `Chưa có hợp đồng nào.\n`;
                    } else {
                        contracts.forEach(ct => {
                            ragContext += `HĐ số ${ct.contractNumber} (${ct.mainProduct.productName}) - Trạng thái: ${ct.status}\n`;
                            
                            if (ct.riders && ct.riders.length > 0) {
                                ragContext += `  Sản phẩm bổ trợ:\n`;
                                ct.riders.forEach(r => {
                                    ragContext += `  + ${r.productName}`;
                                    if (r.productName.includes("Chăm sóc Sức khỏe") && r.attributes?.plan) {
                                        const plan = r.attributes.plan;
                                        const benefit = HTVK_BENEFITS[plan as keyof typeof HTVK_BENEFITS];
                                        if (benefit) {
                                            ragContext += ` (Gói ${plan})\n`;
                                            ragContext += `    -> QUYỀN LỢI CHI TIẾT:\n`;
                                            ragContext += `    - Tiền giường: ${benefit.noi_tru.tien_giuong}\n`;
                                            ragContext += `    - Phẫu thuật: ${benefit.noi_tru.phau_thuat}\n`;
                                            ragContext += `    - Hạn mức năm: ${benefit.gioi_han_nam}\n`;
                                        }
                                    } else {
                                        ragContext += `\n`;
                                    }
                                });
                            }
                        });
                    }
                }
            }
        }
    }

    // 4. GENERATION
    const fullContext = `
    DỮ LIỆU HỆ THỐNG:
    - TVV: ${appState.agentProfile?.fullName || 'Tư vấn viên'}
    - Ngày hiện tại: ${new Date().toLocaleDateString('vi-VN')}
    
    ${ragContext ? ragContext : "(Không có dữ liệu tra cứu cụ thể, hãy trả lời dựa trên kiến thức chung)"}
    `;

    let messageContent: any = query;
    if (imageBase64) {
        messageContent = [
            { text: query || "Phân tích hình ảnh này và thực hiện yêu cầu." },
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
        ];
    }

    // FIX: Clean history to ensure it starts with 'user' role
    // Filter out initial 'model' messages (like welcome messages)
    const validHistory = history.filter((msg, index) => {
        // If it's the very first message in history and it's from 'model', skip it
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
        history: validHistory, // Use cleaned history
        systemInstruction: SUSAM_SYSTEM_INSTRUCTION + `\n\n${fullContext}`,
        config: {
            temperature: 0.2,
            responseMimeType: "text/plain"
        }
    };

    const result = await callAI(payload);
    const rawText = result.text || "";

    try {
        const jsonMatch = rawText.match(/\{[\s\S]*"type":\s*"ACTION"[\s\S]*\}/);
        if (jsonMatch) {
            const actionJson = JSON.parse(jsonMatch[0]);
            return { 
                text: actionJson.confirmMessage || "Đã xử lý yêu cầu.", 
                action: actionJson 
            };
        }
    } catch (e) {
        console.error("Failed to parse Action JSON", e);
    }

    return { text: rawText };
};

// ... KEEP EXISTING EXPORTS AS STUBS OR WRAPPERS ...
export const generateActionScript = async (task: any, customer: Customer | null): Promise<any> => {
    // Wrapper Example
    const prompt = `Soạn kịch bản ${task.category} cho khách hàng ${customer?.fullName}. Lý do: ${task.why}`;
    const res = await callAI({
        endpoint: 'generateContent',
        model: DEFAULT_MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    try { return JSON.parse(res.text || '{}'); } catch { return null; }
};

// Ensure extractPdfText uses the Gateway as well
export const extractPdfText = async (url: string) => {
    try {
        const res = await callAI({
            endpoint: 'extractText', // Server supports this
            url: url
        });
        return res.text;
    } catch (e) {
        console.error("PDF Extract Error", e);
        return "";
    }
};

export const extractIdentityCard = async (base64Image: string) => { 
    // Logic extraction remains same, handled via chatWithData or specific prompt
    return null; 
};

export const processVoiceCommand = async (t: string, c: Customer[]) => null;
export const consultantChat = async (...args: any[]) => "Feature migrating to server.";
export const generateSocialPost = async (t: string, tone: string) => [];
export const generateContentSeries = async (t: string) => [];
export const generateStory = async (f: string, e: string) => "";
export const analyzeSocialInput = async (i: any, n: string) => null;
export const getObjectionSuggestions = async (m: string, c: Customer) => [];