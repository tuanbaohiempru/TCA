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
Bạn có khả năng "nhìn" (qua ảnh), "nghe" (qua giọng nói) và thực hiện các tác vụ quản lý.

NHIỆM VỤ CỦA BẠN:
1. **Xử lý thông tin**: Hiểu yêu cầu người dùng.
2. **Retrieval (Tra cứu)**: 
   - Nếu hỏi về KHÁCH HÀNG: Tra cứu thông tin cá nhân, hợp đồng.
   - Nếu hỏi về SẢN PHẨM/ĐIỀU KHOẢN: Tra cứu trong tài liệu quy tắc sản phẩm (nếu có).
3. **Thực thi (Action)**: Khi đã đủ thông tin, hãy trả về JSON đặc biệt để App thực thi lệnh (Ví dụ: tạo khách hàng, đặt lịch).
4. **Tư vấn Quyền lợi**: Sử dụng thông tin chi tiết về sản phẩm (nếu có trong context) để trả lời chính xác số tiền/quyền lợi.

QUY TẮC ĐẶT LỊCH HẸN (QUAN TRỌNG):
1. **Kiểm tra trùng tên**: Nếu người dùng nói tên (VD: "Hẹn Lan"), hãy kiểm tra danh sách.
   - Nếu tìm thấy > 1 người tên Lan: HÃY HỎI LẠI (VD: "Em thấy có chị Lan A và Lan B, anh muốn hẹn ai?"). Đừng tự ý chọn.
   - Nếu không thấy ai: Hỏi người dùng có muốn tạo khách hàng mới không.
2. **Kiểm tra trùng lịch**: Dựa vào danh sách "LỊCH TRÌNH HIỆN CÓ" được cung cấp bên dưới.
   - Nếu giờ đó đã có việc: HÃY CẢNH BÁO (VD: "Giờ đó anh có lịch hẹn với X rồi, dời sang 15h được không?").
   - Trừ khi người dùng nói "Cứ đặt đi" hoặc "Ghi đè", còn lại hãy ưu tiên cảnh báo.
3. **Chốt lệnh (Action)**:
   - Chỉ khi nào mọi thông tin (Ai, Giờ, Ngày) đã rõ ràng và không xung đột (hoặc đã được user confirm), bạn mới được trả về JSON "CREATE_APPOINTMENT".
   - **TUYỆT ĐỐI KHÔNG** nói "Đã đặt lịch" bằng lời nếu bạn chưa gửi kèm JSON action. Nếu chưa gửi JSON, nghĩa là chưa đặt.

QUY TẮC XỬ LÝ ẢNH CCCD/CMND:
- Khi người dùng gửi ảnh giấy tờ tùy thân, hãy trích xuất toàn bộ thông tin (Họ tên, Ngày sinh, Số giấy tờ, Địa chỉ...).
- **Số điện thoại KHÔNG BẮT BUỘC**: Trên CCCD không có số điện thoại. Hãy cứ tạo lệnh 'CREATE_CUSTOMER' với trường "phone": "" (chuỗi rỗng). Đừng dừng lại để hỏi số điện thoại trừ khi người dùng yêu cầu cụ thể.
- Nếu là trẻ em (Dưới 18 tuổi tính theo năm sinh), mặc định gán nghề nghiệp là "Học sinh/Trẻ em".

QUY TẮC TRẢ LỜI CÂU HỎI SẢN PHẨM:
- Nếu hệ thống cung cấp nội dung "extractedContent" từ PDF: Hãy trả lời dựa trên nội dung đó và trích dẫn (Ví dụ: Theo trang 5...).
- Nếu hệ thống báo "Chưa có dữ liệu văn bản": Hãy trả lời thật thà là "Sản phẩm này chưa được tải tài liệu quy tắc lên hệ thống. Anh/chị vui lòng vào mục Sản phẩm để upload file PDF nhé.". Đừng tự bịa ra điều khoản chi tiết.

QUY TẮC TRẢ LỜI CHUNG:
- Trả lời ngắn gọn, thân thiện, xưng "em", gọi "anh/chị".
- Dùng Markdown để định dạng đẹp (Bold, List).
- Nếu cần thực hiện hành động, hãy trả về JSON action ở cuối câu trả lời (hoặc chỉ trả JSON nếu không cần nói thêm).
`;

/**
 * Unified AI Caller with Streaming Support
 */
const callAI = async (payload: any, onStream?: (text: string) => void): Promise<any> => {
    // 1. Priority: Server-side (Secure Gateway)
    // NOTE: Cloud Functions via Callable do not easily support streaming yet. 
    // If onStream is provided and we are using Server, we might fallback or just await.
    if (isFirebaseReady && functions) {
        try {
            const gateway = httpsCallable(functions as Functions, 'geminiGateway', { timeout: 300000 });
            const result: any = await gateway(payload);
            // Server returned full text, simulate stream for compatibility
            if (onStream && result.data?.text) {
                onStream(result.data.text); 
            }
            return result.data;
        } catch (e: any) {
            console.warn("Server AI failed.", e);
            if (!clientAI) {
                return { text: `⚠️ Lỗi kết nối Server AI: ${e.message}. Vui lòng kiểm tra lại Deploy hoặc Internet.` };
            }
        }
    }

    // 2. Fallback: Client-side (Dev Mode - Supports Streaming)
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

            // STREAMING LOGIC
            if (onStream) {
                const streamResult = await chat.sendMessageStream({ message: message || " " });
                let fullText = '';
                for await (const chunk of streamResult) {
                    const chunkText = chunk.text || ''; // Access .text property
                    fullText += chunkText;
                    onStream(chunkText);
                }
                // Function calls are usually in the final response object, 
                // but for simplicity in streaming we return the aggregated text.
                // To get function calls in stream, we'd need to inspect chunks or get the final response.
                // The SDK accumulates this in the stream object usually.
                const finalResponse = await streamResult.response;
                return { text: fullText, functionCalls: finalResponse.functionCalls };
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
 * Helper: Extract Search Intent (Upgraded for Product support)
 */
const detectSearchIntent = async (query: string): Promise<{ type: 'CUSTOMER' | 'PRODUCT' | 'GENERAL'; entityName?: string }> => {
    try {
        const prompt = `
        Analyze this query: "${query}"
        Classify the intent into one of these types:
        1. CUSTOMER: Asking about a person (e.g., "Chị Thanh", "Hợp đồng của Hùng", "Tìm khách hàng tên A", "Đặt lịch với Lan").
        2. PRODUCT: Asking about insurance product terms, benefits, or exclusions (e.g., "Điều khoản Đầu tư linh hoạt", "Quyền lợi thẻ sức khỏe", "Loại trừ của CSBA").
        3. GENERAL: General chat, greeting, or unclear.

        Return JSON only: { "type": "CUSTOMER" | "PRODUCT" | "GENERAL", "entityName": string | null }
        Example 1: "Chị Thanh quyền lợi thế nào?" -> {"type": "CUSTOMER", "entityName": "Thanh"}
        Example 2: "Điều khoản loại trừ của Đầu Tư Linh Hoạt" -> {"type": "PRODUCT", "entityName": "Đầu Tư Linh Hoạt"}
        Example 3: "Viết bài về ung thư" -> {"type": "GENERAL", "entityName": null}
        `;
        
        // Use callAI wrapper (No streaming for intent detection)
        const res = await callAI({
            endpoint: 'generateContent',
            model: DEFAULT_MODEL, // Use Flash for speed
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        return JSON.parse(res.text || '{}');
    } catch (e) {
        console.error("Intent Detection Failed", e);
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
    
    // Build Schedule Context (For Conflict Checking)
    const upcomingApps = appState.appointments
        .filter(a => new Date(a.date) >= new Date())
        .map(a => `- ${a.date} ${a.time}: ${a.type} (với ${a.customerName})`)
        .join('\n');
    
    const scheduleContext = upcomingApps 
        ? `LỊCH TRÌNH HIỆN CÓ (Để kiểm tra trùng lịch):\n${upcomingApps}` 
        : `LỊCH TRÌNH HIỆN CÓ: Trống.`;

    if (query && !imageBase64) {
        const intent = await detectSearchIntent(query);
        console.log(`[RAG] Intent: ${intent.type} - Entity: ${intent.entityName}`);

        // --- CASE A: CUSTOMER SEARCH (OR APPOINTMENT WITH PERSON) ---
        if (intent.type === 'CUSTOMER' && intent.entityName) {
            // 2A. RAG: RETRIEVAL (Server-side Search)
            const matchedCustomers = await searchCustomersByName(intent.entityName);
            
            if (matchedCustomers.length === 0) {
                ragContext = `[HỆ THỐNG]: Không tìm thấy khách hàng nào tên là "${intent.entityName}". Nếu người dùng muốn tạo lịch, hãy hỏi họ có muốn tạo khách hàng mới không.`;
            } else if (matchedCustomers.length > 3) {
                ragContext = `[HỆ THỐNG]: Tìm thấy quá nhiều người tên "${intent.entityName}" (${matchedCustomers.length} người). Hãy yêu cầu người dùng cung cấp thêm họ tên đầy đủ hoặc đặc điểm nhận dạng.`;
            } else {
                // 3A. RAG: CONTEXT BUILDING
                ragContext = `KẾT QUẢ TRA CỨU KHÁCH HÀNG (${matchedCustomers.length} người - Dùng để xác định danh tính khi đặt lịch):\n`;
                
                for (const cus of matchedCustomers) {
                    let contracts = await getContractsByCustomerId(cus.id);
                    if (contracts.length === 0 && appState.contracts.length > 0) {
                        contracts = appState.contracts.filter(c => c.customerId === cus.id);
                    }

                    ragContext += `\n--- KHÁCH HÀNG: ${cus.fullName} (ID: ${cus.id}) ---\n`;
                    ragContext += `SĐT: ${cus.phone} | Năm sinh: ${new Date(cus.dob).getFullYear()}\n`;
                    ragContext += `Địa chỉ: ${cus.companyAddress}\n`;
                }
            }
        }
        // --- CASE B: PRODUCT SEARCH (KNOWLEDGE BASE) ---
        else if (intent.type === 'PRODUCT' && intent.entityName) {
            const searchKey = intent.entityName.toLowerCase();
            const products = appState.products || [];
            
            // Simple fuzzy match
            const matchedProduct = products.find(p => 
                p.name.toLowerCase().includes(searchKey) || 
                p.code.toLowerCase().includes(searchKey)
            );

            if (matchedProduct) {
                if (matchedProduct.extractedContent && matchedProduct.extractedContent.length > 50) {
                    const contentSnippet = matchedProduct.extractedContent.substring(0, 30000); 
                    ragContext = `
                    [TÀI LIỆU SẢN PHẨM: ${matchedProduct.name}]
                    Dưới đây là nội dung trích xuất từ file PDF quy tắc sản phẩm. Hãy dùng thông tin này để trả lời câu hỏi về điều khoản/loại trừ/quyền lợi.
                    
                    --- BẮT ĐẦU TÀI LIỆU ---
                    ${contentSnippet}
                    --- KẾT THÚC TÀI LIỆU ---
                    `;
                } else {
                    ragContext = `
                    [HỆ THỐNG CẢNH BÁO QUAN TRỌNG]:
                    Người dùng đang hỏi về sản phẩm "${matchedProduct.name}".
                    Tuy nhiên, hệ thống kiểm tra thấy trường "extractedContent" của sản phẩm này ĐANG RỖNG hoặc KHÔNG TỒN TẠI.
                    `;
                }
            }
        }
    }

    // 4. GENERATION
    const fullContext = `
    DỮ LIỆU HỆ THỐNG:
    - TVV: ${appState.agentProfile?.fullName || 'Tư vấn viên'}
    - Ngày hiện tại: ${new Date().toLocaleDateString('vi-VN')}
    
    ${scheduleContext}

    CONTEXT BỔ SUNG TỪ DATABASE:
    ${ragContext ? ragContext : "(Không có dữ liệu tra cứu cụ thể)"}
    `;

    let messageContent: any = query;
    if (imageBase64) {
        messageContent = [
            { text: query || "Phân tích hình ảnh này và thực hiện yêu cầu." },
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
        ];
    }

    // FIX: Clean history to ensure it starts with 'user' role
    const validHistory = history.filter((msg, index) => {
        if (index === 0 && msg.role === 'model') return false;
        return true;
    }).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
    }));

    const payload = {
        endpoint: 'chat',
        model: DEFAULT_MODEL, // Using Flash for faster chat
        message: messageContent,
        history: validHistory,
        systemInstruction: SUSAM_SYSTEM_INSTRUCTION + `\n\n${fullContext}`,
        config: {
            temperature: 0.2,
            responseMimeType: "text/plain"
        }
    };

    // Pass onStream callback
    const result = await callAI(payload, onStream);
    let rawText = result.text || "";
    let extractedAction = null;

    // --- JSON BLOCK EXTRACTION & CLEANUP ---
    // Sometimes model outputs ```json ... ```, sometimes just json, sometimes text then json.
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```|(\{(?:[^{}]|\{(?:[^{}]|1)*\})*\})\s*$/;
    const match = rawText.match(jsonBlockRegex);
    if (match) {
        const jsonString = match[1] || match[2]; 
        try {
            const parsed = JSON.parse(jsonString);
            if (parsed.action || parsed.type) {
                extractedAction = parsed;
                // Remove the JSON block from text to show a clean message
                // Note: In streaming mode, the JSON might have already been streamed to UI.
                // The UI might need to handle hiding it, or we accept it shows up briefly.
                rawText = rawText.replace(match[0], '').trim();
            }
        } catch (e) {
            console.warn("Failed to parse JSON in response", e);
        }
    }

    return { 
        text: rawText, 
        action: extractedAction 
    };
};

// ... KEEP EXISTING EXPORTS ...
export const generateActionScript = async (task: any, customer: Customer | null): Promise<any> => {
    const prompt = `Soạn kịch bản ${task.category} cho khách hàng ${customer?.fullName}. Lý do: ${task.why}`;
    const res = await callAI({
        endpoint: 'generateContent',
        model: DEFAULT_MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    try { return JSON.parse(res.text || '{}'); } catch { return null; }
};

export const extractPdfText = async (url: string) => {
    try {
        const res = await callAI({
            endpoint: 'extractText',
            url: url
        });
        return res.text;
    } catch (e) {
        console.error("PDF Extract Error", e);
        return "";
    }
};

export const extractIdentityCard = async (base64Image: string) => { 
    try {
        const prompt = `Trích xuất thông tin từ ảnh CMND/CCCD này. Trả về JSON: { "fullName": "", "idCard": "", "dob": "YYYY-MM-DD", "gender": "Nam/Nữ", "companyAddress": "" }`;
        const res = await callAI({
            endpoint: 'generateContent',
            model: DEFAULT_MODEL, // Flash is great for OCR
            contents: [
                { text: prompt },
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
            ],
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(res.text || '{}');
    } catch (e) {
        return null; 
    }
};

export const processVoiceCommand = async (t: string, c: Customer[]) => null;
export const consultantChat = async (...args: any[]) => "Feature migrating to server.";
export const generateSocialPost = async (t: string, tone: string) => [];
export const generateContentSeries = async (t: string) => [];
export const generateStory = async (f: string, e: string) => "";
export const analyzeSocialInput = async (i: any, n: string) => null;
export const getObjectionSuggestions = async (m: string, c: Customer) => [];