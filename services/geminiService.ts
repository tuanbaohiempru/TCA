
import { httpsCallable } from "firebase/functions";
import { functions, isFirebaseReady } from "./firebaseConfig";
import { GoogleGenAI, Type } from "@google/genai";
import { AppState, Customer, AgentProfile, ContractStatus, Contract, Product, Appointment, AppointmentType } from "../types";
import * as pdfjsLib from 'pdfjs-dist';

// Configure Worker for PDF.js using CDN to avoid build issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js`;

// --- CONFIGURATION ---
const getApiKey = (): string => {
    return process.env.API_KEY || localStorage.getItem('gemini_api_key') || '';
};

const apiKey = getApiKey();
// Client-side instance (Use with caution, prefer Cloud Functions for production)
const clientAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

// OPTIMIZATION: Use Flash model for faster response (1-2s)
const DEFAULT_MODEL = 'gemini-2.5-flash'; 

// --- GENERIC HELPERS ---
const callGemini = async (systemInstruction: string, prompt: string | any, model: string = DEFAULT_MODEL, responseMimeType: string = 'text/plain', tools: any[] = []) => {
    // 1. Try Cloud Functions (Secure Production Way)
    if (isFirebaseReady) {
        try {
            const gateway = httpsCallable(functions, 'geminiGateway');
            const result: any = await gateway({
                endpoint: 'generateContent',
                model: model,
                systemInstruction: systemInstruction,
                contents: prompt,
                tools: tools,
                config: {
                    responseMimeType: responseMimeType,
                    temperature: 0.7
                }
            });
            // Handle Function Call response from Cloud Function if needed
            return result.data.text; 
        } catch (e) {
            console.warn("Cloud Function failed, falling back to client-side if key exists.", e);
        }
    }

    // 2. Fallback to Client Side
    if (clientAI) {
        const req: any = {
            model: model,
            contents: typeof prompt === 'string' ? [{ role: 'user', parts: [{ text: prompt }] }] : prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: responseMimeType,
                temperature: 0.7,
                tools: tools.length > 0 ? tools : undefined
            }
        };

        const response = await clientAI.models.generateContent(req);
        
        // Handle Function Calls (Client Side)
        if (response.functionCalls && response.functionCalls.length > 0) {
            // For simplicity in this demo, we return the function call data directly
            // In a full loop, we would execute the function and call Gemini again
            return JSON.stringify({ functionCall: response.functionCalls[0] });
        }

        return response.text;
    }

    throw new Error("Không thể kết nối AI. Vui lòng kiểm tra API Key hoặc Cloud Functions.");
};

// --- PDF EXTRACTION (CLIENT-SIDE COST SAVING) ---
export const extractPdfText = async (fileUrl: string): Promise<string> => {
    try {
        console.log("Starting Client-side PDF Extraction...");
        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const pdf = await loadingTask.promise;
        let fullText = '';

        const maxPages = Math.min(pdf.numPages, 10);

        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += `--- Page ${i} ---\n${pageText}\n`;
        }

        if (pdf.numPages > 10) {
            fullText += `\n... (Đã cắt bớt ${pdf.numPages - 10} trang còn lại để tối ưu)`;
        }

        return fullText;
    } catch (e) {
        console.error("Client-side PDF Extract Error:", e);
        return "Lỗi đọc file PDF. Vui lòng đảm bảo file có thể truy cập công khai hoặc CORS được cấu hình đúng.";
    }
};

// --- ID CARD EXTRACTION ---
export const extractIdentityCard = async (base64Image: string) => {
    const model = 'gemini-2.5-flash'; // Optimized for vision
    const promptParts = [
        { text: "Trích xuất thông tin từ thẻ CCCD này. Trả về JSON: {idCard, fullName, dob (YYYY-MM-DD), gender, companyAddress}" },
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
    ];

    try {
        if (clientAI) {
            const response = await clientAI.models.generateContent({
                model: model,
                contents: [{ role: 'user', parts: promptParts }],
                config: { responseMimeType: 'application/json' }
            });
            const text = response.text;
            return text ? JSON.parse(text) : null;
        } else if (isFirebaseReady) {
             const gateway = httpsCallable(functions, 'geminiGateway');
             const result: any = await gateway({
                endpoint: 'generateContent',
                model: model,
                contents: { role: 'user', parts: promptParts },
                config: { temperature: 0.1, responseMimeType: 'application/json' }
            });
            const text = result.data.text;
            return text ? JSON.parse(text) : null;
        }
    } catch (e) {
        console.error("Extract ID Error", e);
        return null;
    }
    return null;
}

// --- INTELLIGENT CHAT (RAG + TOOLS) ---
export const chatWithData = async (
    query: string, 
    imageBase64: string | null, 
    state: AppState, 
    history: any[], 
    onStream?: (chunk: string) => void
): Promise<{ text: string; action?: any }> => {
    
    // 1. Prepare Context (RAG)
    const customerSummary = state.customers.map(c => `${c.fullName} (ID:${c.id}, Phone:${c.phone})`).join('\n');
    const contractSummary = state.contracts.map(c => `HĐ ${c.contractNumber} của KH ${c.customerId}`).join('\n');
    
    const context = `
    DỮ LIỆU HIỆN CÓ:
    - Danh sách khách hàng:
    ${customerSummary}
    - Danh sách hợp đồng:
    ${contractSummary}
    
    NGƯỜI DÙNG ĐANG HỎI: "${query}"
    `;

    const systemInstruction = `
    Bạn là TuanChom AI - Trợ lý siêu việt cho tư vấn viên bảo hiểm Prudential.
    
    KHẢ NĂNG CỦA BẠN:
    1. Trả lời câu hỏi dựa trên dữ liệu cung cấp.
    2. Nếu người dùng muốn tạo khách hàng, hãy trích xuất thông tin và gọi tool 'create_customer'.
    3. Nếu người dùng muốn đặt lịch hẹn, hãy gọi tool 'create_appointment'.
    4. Nếu người dùng muốn chọn một khách hàng cụ thể từ danh sách, hãy trả về action SELECT_CUSTOMER.
    
    LUÔN TRẢ LỜI NGẮN GỌN, THÂN THIỆN.
    `;

    // 2. Define Tools
    const tools = [
        {
            functionDeclarations: [
                {
                    name: "create_customer",
                    description: "Tạo hồ sơ khách hàng mới từ thông tin trong chat hoặc ảnh CCCD.",
                    parameters: {
                        type: Type.OBJECT,
                        properties: {
                            fullName: { type: Type.STRING, description: "Họ và tên" },
                            phone: { type: Type.STRING, description: "Số điện thoại" },
                            idCard: { type: Type.STRING, description: "Số CCCD" },
                            dob: { type: Type.STRING, description: "Ngày sinh YYYY-MM-DD" },
                            address: { type: Type.STRING, description: "Địa chỉ" },
                            gender: { type: Type.STRING, description: "Nam hoặc Nữ" }
                        },
                        required: ["fullName"]
                    }
                },
                {
                    name: "create_appointment",
                    description: "Tạo lịch hẹn mới với khách hàng.",
                    parameters: {
                        type: Type.OBJECT,
                        properties: {
                            customerName: { type: Type.STRING, description: "Tên khách hàng" },
                            date: { type: Type.STRING, description: "Ngày hẹn YYYY-MM-DD" },
                            time: { type: Type.STRING, description: "Giờ hẹn HH:mm" },
                            title: { type: Type.STRING, description: "Tiêu đề/Nội dung cuộc hẹn" },
                            type: { type: Type.STRING, description: "Loại: CONSULTATION, CARE_CALL, FEE_REMINDER, BIRTHDAY" }
                        },
                        required: ["customerName", "date", "time"]
                    }
                }
            ]
        }
    ];

    // 3. Construct Request
    const parts: any[] = [{ text: context }];
    if (imageBase64) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
        parts.push({ text: "Hãy trích xuất thông tin từ ảnh này để thực hiện yêu cầu." });
    }

    try {
        // Use clientAI for Tool calling demonstration (Simpler than mocking Cloud Function tool handling)
        if (clientAI) {
            const result: any = await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: parts }],
                config: { 
                    systemInstruction: systemInstruction,
                    temperature: 0.5,
                    tools: tools // Attach tools
                }
            });

            // Check for Function Call
            const fc = result.functionCalls?.[0];
            if (fc) {
                console.log("AI Function Call:", fc);
                if (fc.name === 'create_customer') {
                    return { text: "Đang tạo hồ sơ khách hàng...", action: { action: 'CREATE_CUSTOMER', data: fc.args } };
                }
                if (fc.name === 'create_appointment') {
                    return { text: "Đang đặt lịch hẹn...", action: { action: 'CREATE_APPOINTMENT', data: fc.args } };
                }
            }

            return { text: result.text || "Xin lỗi, tôi chưa hiểu ý bạn.", action: null };
        } 
        
        // Simple text fallback if no clientAI
        return { text: "Hệ thống AI chưa được cấu hình đầy đủ (Client Mode).", action: null };

    } catch (e: any) {
        console.error("Chat Error", e);
        return { text: `Lỗi: ${e.message}`, action: null };
    }
};

// --- CONSULTANT ROLEPLAY ---
export const consultantChat = async (msg: string, customer: any, contracts: any, relationships: any, profile: any, goal: string, history: any[], role: string, plan: any, style: string) => {
    const context = `
    KHÁCH HÀNG: ${customer.fullName}, ${new Date().getFullYear() - new Date(customer.dob).getFullYear()} tuổi.
    Nghề nghiệp: ${customer.occupation}.
    Tính cách: ${customer.analysis?.personality || 'Không rõ'}.
    Mối quan tâm: ${customer.analysis?.biggestWorry || 'Không rõ'}.
    Lịch sử: ${JSON.stringify(customer.timeline?.slice(0,3) || [])}.
    
    MỤC TIÊU CỦA TVV: ${goal}.
    `;

    let systemInstruction = "";
    if (role === 'customer') {
        systemInstruction = `
        BẠN LÀ KHÁCH HÀNG KHÓ TÍNH (${customer.fullName}).
        Nhiệm vụ: Trả lời tin nhắn của tư vấn viên.
        Thái độ: ${customer.analysis?.readiness === 'COLD' ? 'Lạnh lùng, nghi ngờ, ngắn gọn' : 'Cởi mở nhưng vẫn soi kỹ quyền lợi'}.
        Đừng đồng ý ngay. Hãy đưa ra các lời từ chối (Objection) dựa trên mối lo: "${customer.analysis?.biggestWorry}".
        Phong cách chat: ${style === 'zalo' ? 'Ngắn, dùng teencode nhẹ, thân mật' : 'Trang trọng'}.
        `;
    } else {
        systemInstruction = `
        BẠN LÀ 'SU SAM' - SIÊU TRỢ LÝ MDRT.
        Nhiệm vụ: Đóng vai Tư vấn viên mẫu để hướng dẫn người dùng.
        Hãy đưa ra câu trả lời mẫu xuất sắc nhất cho tình huống này.
        Sử dụng kỹ thuật: Đồng cảm -> Cô lập vấn đề -> Giải quyết -> Chốt.
        `;
    }

    const prompt = `
    ${context}
    
    LỊCH SỬ CHAT:
    ${history.map((h: any) => `${h.role === 'user' ? 'TVV' : 'KH'}: ${h.text}`).join('\n')}
    
    TVV (User) vừa nói: "${msg}"
    
    HÃY TRẢ LỜI (Là ${role === 'customer' ? 'Khách hàng' : 'Su Sam'}):
    `;

    return await callGemini(systemInstruction, prompt);
};

// --- MARKETING & CONTENT ---
export const generateCaseStudy = async (customer: Customer, contracts: Contract[], framework: 'AIDA' | 'PAS' = 'AIDA') => {
    const prompt = `Viết Case Study về KH ${customer.fullName} (${customer.occupation}) đã tham gia bảo hiểm. Framework: ${framework}. Output JSON: {title, content, imagePrompt}`;
    const json = await callGemini("Bạn là Content Writer MDRT.", prompt, 'gemini-2.5-flash', 'application/json');
    return JSON.parse(json || '{}');
};

export const generateSocialPost = async (topic: string, tone: string) => {
    const prompt = `Viết 3 status Facebook về: ${topic}. Tone: ${tone}. Output JSON: [{title, content}]`;
    const json = await callGemini("Bạn là Content Writer MDRT.", prompt, 'gemini-2.5-flash', 'application/json');
    return JSON.parse(json || '[]');
};

export const generateContentSeries = async (topic: string, profile: AgentProfile | null) => {
    const prompt = `Lập plan 5 bài viết 5 ngày về: ${topic}. Output JSON: [{day, type, content}]`;
    const json = await callGemini("Bạn là Content Writer MDRT.", prompt, 'gemini-2.5-flash', 'application/json');
    return JSON.parse(json || '[]');
};

export const generateStory = async (facts: string, emotion: string) => {
    return await callGemini(`Viết câu chuyện cảm động. Cảm xúc: ${emotion}`, facts);
};

// --- OPERATIONS ---
export const getObjectionSuggestions = async (objection: string, customerContext: Customer | string = 'Khách hàng') => {
    const prompt = `Xử lý từ chối: "${objection}". Output JSON: [{label, content, type: 'empathy'|'logic'|'question'}]`;
    const json = await callGemini("Bạn là MDRT Coach.", prompt, 'gemini-2.5-flash', 'application/json');
    return JSON.parse(json || '[]');
};

export const checkPreUnderwriting = async (condition: string) => {
    const prompt = `Thẩm định sơ bộ bệnh: "${condition}". Output JSON: {prediction: 'Standard'|'Loading'|'Exclusion'|'Decline', predictionLabel, riskLevel, loadingEstimate, reasoning}`;
    const json = await callGemini("Bạn là Underwriter.", prompt, 'gemini-2.5-flash', 'application/json');
    return JSON.parse(json || '{}');
};

export const analyzeClaimSupport = async (contract: Contract, product: Product | undefined, eventDescription: string) => {
    const prompt = `Phân tích Claim. HĐ: ${contract.contractNumber}, SP: ${product?.name}. Sự kiện: ${eventDescription}. Output JSON: {eligible: bool, warning, checklist: [{item, note}], estimatedAmount, reasoning}`;
    const json = await callGemini("Bạn là Claim Specialist.", prompt, 'gemini-2.5-flash', 'application/json');
    return JSON.parse(json || '{}');
};

export const generateActionScript = async (task: any, customer: any) => {
    return await callGemini("Viết kịch bản ngắn.", `Mục đích: ${task.title}. Cho KH: ${customer.fullName}`);
};
