
import { httpsCallable } from "firebase/functions";
import { functions, isFirebaseReady } from "./firebaseConfig";
import { GoogleGenAI, Type, Tool } from "@google/genai";
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
const callGemini = async (systemInstruction: string, prompt: string | any, model: string = DEFAULT_MODEL, responseMimeType: string = 'text/plain', tools: Tool[] = []) => {
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

        const maxPages = Math.min(pdf.numPages, 15); // Increased limit slightly

        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += `[Trang ${i}] ${pageText}\n`;
        }

        if (pdf.numPages > 15) {
            fullText += `\n... (Đã cắt bớt ${pdf.numPages - 15} trang còn lại)`;
        }

        return fullText;
    } catch (e) {
        console.error("Client-side PDF Extract Error:", e);
        return "Lỗi đọc file PDF. Vui lòng đảm bảo file có thể truy cập công khai hoặc CORS được cấu hình đúng.";
    }
};

// --- SMART RETRIEVAL HELPER ---
/**
 * Finds relevant product details based on user query.
 * Only injects full PDF content if the product name is mentioned or context implies it.
 */
const getRelevantProductKnowledge = (query: string, products: Product[]): string => {
    const queryLower = query.toLowerCase();
    let knowledge = "";

    // 1. Identify mentioned products
    const mentionedProducts = products.filter(p => 
        queryLower.includes(p.name.toLowerCase()) || 
        queryLower.includes(p.code.toLowerCase())
    );

    if (mentionedProducts.length > 0) {
        knowledge += "\n*** CHI TIẾT SẢN PHẨM LIÊN QUAN (ĐƯỢC TRÍCH XUẤT TỪ TÀI LIỆU): ***\n";
        mentionedProducts.forEach(p => {
            if (p.extractedContent) {
                // Limit content length to avoid token overflow if many products match
                const safeContent = p.extractedContent.substring(0, 15000); 
                knowledge += `\n--- SẢN PHẨM: ${p.name} (${p.code}) ---\n${safeContent}\n`;
            } else {
                knowledge += `\n--- SẢN PHẨM: ${p.name} ---\n(Chưa có nội dung chi tiết PDF, chỉ có mô tả: ${p.description})\n`;
            }
        });
    }

    return knowledge;
};

// --- COMPETITOR ANALYSIS (IMPORT) ---
export const analyzeCompetitorData = async (textData: string, mimeType: string = 'text/plain') => {
    const prompt = `
    Bạn là một chuyên gia phân tích sản phẩm bảo hiểm.
    Nhiệm vụ: Trích xuất thông tin từ tài liệu sản phẩm bảo hiểm của đối thủ cạnh tranh (hoặc bảng quyền lợi).
    
    Hãy trả về JSON format chuẩn xác với các trường sau:
    {
        "company": "Tên công ty bảo hiểm (VD: Manulife, Dai-ichi, AIA...)",
        "productName": "Tên sản phẩm (VD: Sống Khỏe Mỗi Ngày)",
        "tier": "Hạng thẻ/Gói (VD: Titan, Vàng, Kim Cương, Cao Cấp...)",
        "features": {
            "limit_year": "Hạn mức/Năm (Ghi rõ số tiền)",
            "room_board": "Tiền giường/Ngày",
            "surgery": "Phẫu thuật/Lần",
            "cancer": "Điều trị ung thư (Chi trả ntn?)",
            "copayment": "Đồng chi trả (Có/Không, Tỷ lệ)",
            "waiting_period": "Thời gian chờ bệnh đặc biệt",
            "scope": "Phạm vi bảo lãnh (VN/Châu Á/Toàn cầu)",
            "organ_transplant": "Cấy ghép nội tạng"
        },
        "pros": ["Điểm mạnh 1", "Điểm mạnh 2"],
        "cons": ["Điểm yếu 1", "Điểm yếu 2"]
    }

    Nếu thông tin nào không tìm thấy trong văn bản, hãy để trống hoặc ghi "Không đề cập".
    Chỉ trả về JSON, không thêm markdown.
    `;

    // Construct content parts based on input type (text or image base64)
    let contents: any[] = [];
    if (mimeType.startsWith('image/')) {
        contents = [
            { text: prompt },
            { inlineData: { mimeType: mimeType, data: textData } } // textData here is base64 string
        ];
    } else {
        contents = [
            { role: 'user', parts: [{ text: prompt + "\n\nNỘI DUNG TÀI LIỆU:\n" + textData }] }
        ];
    }

    try {
        if (clientAI) {
            const req: any = {
                model: 'gemini-2.5-flash',
                contents: mimeType.startsWith('image/') ? [{ role: 'user', parts: contents }] : contents,
                config: { responseMimeType: 'application/json' }
            };
            const response = await clientAI.models.generateContent(req);
            return JSON.parse(response.text || '{}');
        } else if (isFirebaseReady) {
             const gateway = httpsCallable(functions, 'geminiGateway');
             const result: any = await gateway({
                endpoint: 'generateContent',
                model: 'gemini-2.5-flash',
                contents: mimeType.startsWith('image/') ? { parts: contents } : { parts: [{ text: prompt + "\n\nNỘI DUNG:\n" + textData }] },
                config: { responseMimeType: 'application/json' }
            });
            return JSON.parse(result.data.text || '{}');
        }
    } catch (e) {
        console.error("Analyze Competitor Error", e);
        return null;
    }
};

// --- BATTLE ADVISOR ---
export const analyzeProductBattle = async (pruFeatures: any, compFeatures: any, compName: string, compProduct: string) => {
    const prompt = `
    Bạn là "SUSAM_COACH" - Chuyên gia huấn luyện bán hàng bảo hiểm Prudential (MDRT).
    
    NHIỆM VỤ:
    So sánh thẻ sức khỏe Prudential (Hành Trang Vui Khỏe) với đối thủ: ${compName} - ${compProduct}.
    Dựa trên dữ liệu so sánh dưới đây, hãy đưa ra chiến lược tư vấn để CHỐT SALE cho Prudential.

    DỮ LIỆU PRUDENTIAL:
    ${JSON.stringify(pruFeatures)}

    DỮ LIỆU ĐỐI THỦ (${compName}):
    ${JSON.stringify(compFeatures)}

    YÊU CẦU ĐẦU RA (JSON FORMAT):
    {
        "disadvantages": [
            { 
                "point": "Điểm yếu/thua thiệt của Pru (VD: Phí cao hơn, Hạn mức thấp hơn...)", 
                "script": "Lời thoại xử lý từ chối mẫu để biến điểm yếu thành điểm chấp nhận được (Reframing). Giọng văn chuyên nghiệp, đồng cảm." 
            }
        ],
        "usp": "Điểm mạnh nhất (Unique Selling Point) của Pru trong kèo đấu này (VD: Bảo lãnh rộng, Cam kết tái tục, Thương hiệu uy tín...)",
        "closing_script": "Một đoạn thoại ngắn (2-3 câu) chốt sale dựa trên USP đó, tạo sự khan hiếm hoặc thôi thúc hành động."
    }
    `;

    try {
        const jsonStr = await callGemini("Bạn là Chiến lược gia Bảo hiểm.", prompt, 'gemini-2.5-flash', 'application/json');
        return JSON.parse(jsonStr || '{}');
    } catch (e) {
        console.error("Battle Analysis Error", e);
        return null;
    }
};

// --- ID CARD EXTRACTION ---
export const extractIdentityCard = async (base64Image: string) => {
    const model = 'gemini-2.5-flash'; 
    const promptParts = [
        { text: "Bạn là SUSAM_ADMIN. Trích xuất thông tin từ thẻ CCCD này. Trả về JSON: {idCard, fullName, dob (YYYY-MM-DD), gender, companyAddress}" },
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

// --- INTELLIGENT CHAT (RAG + TOOLS + SQUAD) ---
export const chatWithData = async (
    query: string, 
    imageBase64: string | null, 
    state: AppState, 
    history: any[], 
    onStream?: (chunk: string) => void
): Promise<{ text: string; action?: any }> => {
    
    // 1. Prepare Core Context
    const customerSummary = state.customers.map(c => `- ${c.fullName} (ID:${c.id}, Phone:${c.phone}) [Trạng thái: ${c.status}]`).join('\n');
    const contractSummary = state.contracts.map(c => `- HĐ ${c.contractNumber} (${c.mainProduct.productName}) của KH ${c.customerId}. Phí: ${c.totalFee.toLocaleString()}đ. Trạng thái: ${c.status}`).join('\n');
    
    // 2. Prepare Product Context (Summary List)
    const productSummary = state.products.map(p => `- [${p.code}] ${p.name}: ${p.description}`).join('\n');

    // 3. Smart Retrieval (Inject Detail Content if Relevant)
    const detailedProductKnowledge = getRelevantProductKnowledge(query, state.products);

    const context = `
    === KHO DỮ LIỆU ===
    A. DANH SÁCH KHÁCH HÀNG:
    ${customerSummary}

    B. DANH SÁCH HỢP ĐỒNG:
    ${contractSummary}

    C. DANH SÁCH SẢN PHẨM HIỆN CÓ:
    ${productSummary}

    ${detailedProductKnowledge}
    
    === YÊU CẦU NGƯỜI DÙNG ===
    "${query}"
    `;

    // 4. Define SU SAM SQUAD System Instruction
    const systemInstruction = `
    Bạn là **Su Sam Squad** - Đội ngũ trợ lý AI chuyên nghiệp cho Tư vấn viên Prudential.
    Bạn có 5 nhân cách chuyên môn. Hãy tự động nhận diện ý định người dùng để chọn nhân cách trả lời phù hợp nhất:

    1. **SUSAM_SALES (Chuyên gia Bán hàng):** 
       - Dùng khi: Hỏi về tư vấn, khơi gợi nhu cầu, chốt sale, so sánh sản phẩm.
       - Phong cách: Máu lửa, tập trung vào lợi ích, dùng kỹ thuật storytelling.
       - Nhiệm vụ: Gợi ý sản phẩm phù hợp dựa trên data khách hàng.

    2. **SUSAM_EXPERT (Luật sư/Chuyên gia SP):**
       - Dùng khi: Hỏi chi tiết về điều khoản, quyền lợi, loại trừ, định nghĩa bệnh.
       - Phong cách: Chính xác, trích dẫn rõ ràng (Dựa trên dữ liệu sản phẩm chi tiết được cung cấp).
       - *Lưu ý:* Nếu không có dữ liệu chi tiết trong context, hãy báo người dùng upload PDF sản phẩm.

    3. **SUSAM_CRM (Quản gia):**
       - Dùng khi: Hỏi về thông tin khách hàng, nhắc lịch, sinh nhật, đóng phí.
       - Phong cách: Chu đáo, tận tâm, rà soát kỹ dữ liệu ngày tháng.

    4. **SUSAM_ADMIN (Thư ký):**
       - Dùng khi: Yêu cầu tạo hồ sơ, đặt lịch hẹn, nhập liệu.
       - Hành động: Luôn ưu tiên dùng Tool (create_customer, create_appointment).

    5. **SUSAM_COACH (Huấn luyện viên):**
       - Dùng khi: Người dùng than vãn bị từ chối, xin lời khuyên xử lý tình huống.
       - Phong cách: Đồng cảm, đưa ra lời thoại mẫu (Script) để TVV áp dụng ngay.

    QUY TẮC CHUNG:
    - Luôn trả lời ngắn gọn, đi thẳng vào vấn đề.
    - Định dạng văn bản đẹp (Markdown: Bold, Bullet points).
    - Nếu cần tạo dữ liệu, HÃY GỌI TOOL.
    `;

    // 5. Define Tools
    const tools: Tool[] = [
        {
            functionDeclarations: [
                {
                    name: "create_customer",
                    description: "Tạo hồ sơ khách hàng mới. Nếu thông tin bị trùng, hệ thống sẽ tự xử lý.",
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
                    description: "Tạo lịch hẹn mới.",
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

    // 6. Construct Request
    const parts: any[] = [{ text: context }];
    if (imageBase64) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
        parts.push({ text: "Hãy đóng vai SUSAM_ADMIN, trích xuất thông tin từ ảnh này để thực hiện yêu cầu." });
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

// --- CONSULTANT ROLEPLAY (UPDATED FOR SUSAM_COACH) ---
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
        BẠN LÀ 'SUSAM_COACH' - SIÊU TRỢ LÝ MDRT.
        Nhiệm vụ: Đóng vai Tư vấn viên mẫu để hướng dẫn người dùng (Role Model).
        Hãy đưa ra câu trả lời mẫu xuất sắc nhất cho tình huống này.
        Sử dụng kỹ thuật: Đồng cảm -> Cô lập vấn đề -> Giải quyết -> Chốt.
        `;
    }

    const prompt = `
    ${context}
    
    LỊCH SỬ CHAT:
    ${history.map((h: any) => `${h.role === 'user' ? 'TVV' : 'KH'}: ${h.text}`).join('\n')}
    
    TVV (User) vừa nói: "${msg}"
    
    HÃY TRẢ LỜI (Là ${role === 'customer' ? 'Khách hàng' : 'SUSAM_COACH'}):
    `;

    return await callGemini(systemInstruction, prompt);
};

// --- MARKETING & CONTENT ---
export const generateCaseStudy = async (customer: Customer, contracts: Contract[], framework: 'AIDA' | 'PAS' = 'AIDA') => {
    const prompt = `Bạn là SUSAM_SALES (Marketing Mode). Viết Case Study về KH ${customer.fullName} (${customer.occupation}) đã tham gia bảo hiểm. Framework: ${framework}. Output JSON: {title, content, imagePrompt}`;
    const json = await callGemini("Bạn là Content Writer MDRT.", prompt, 'gemini-2.5-flash', 'application/json');
    return JSON.parse(json || '{}');
};

export const generateSocialPost = async (topic: string, tone: string) => {
    const prompt = `Bạn là SUSAM_SALES (Marketing Mode). Viết 3 status Facebook về: ${topic}. Tone: ${tone}. Output JSON: [{title, content}]`;
    const json = await callGemini("Bạn là Content Writer MDRT.", prompt, 'gemini-2.5-flash', 'application/json');
    return JSON.parse(json || '[]');
};

export const generateContentSeries = async (topic: string, profile: AgentProfile | null) => {
    const prompt = `Bạn là SUSAM_SALES (Marketing Mode). Lập plan 5 bài viết 5 ngày về: ${topic}. Output JSON: [{day, type, content}]`;
    const json = await callGemini("Bạn là Content Writer MDRT.", prompt, 'gemini-2.5-flash', 'application/json');
    return JSON.parse(json || '[]');
};

export const generateStory = async (facts: string, emotion: string) => {
    return await callGemini(`Bạn là SUSAM_SALES. Viết câu chuyện cảm động. Cảm xúc: ${emotion}`, facts);
};

// --- OPERATIONS ---
export const getObjectionSuggestions = async (objection: string, customerContext: Customer | string = 'Khách hàng') => {
    const prompt = `Bạn là SUSAM_COACH. Xử lý từ chối: "${objection}". Output JSON: [{label, content, type: 'empathy'|'logic'|'question'}]`;
    const json = await callGemini("Bạn là MDRT Coach.", prompt, 'gemini-2.5-flash', 'application/json');
    return JSON.parse(json || '[]');
};

export const checkPreUnderwriting = async (condition: string) => {
    const prompt = `Bạn là SUSAM_EXPERT (Underwriting Mode). Thẩm định sơ bộ bệnh: "${condition}". Output JSON: {prediction: 'Standard'|'Loading'|'Exclusion'|'Decline', predictionLabel, riskLevel, loadingEstimate, reasoning}`;
    const json = await callGemini("Bạn là Underwriter.", prompt, 'gemini-2.5-flash', 'application/json');
    return JSON.parse(json || '{}');
};

export const analyzeClaimSupport = async (contract: Contract, product: Product | undefined, eventDescription: string) => {
    const context = product?.extractedContent ? `CHI TIẾT SẢN PHẨM: ${product.extractedContent.substring(0, 10000)}` : `Mô tả sản phẩm: ${product?.description}`;
    
    const prompt = `
    Bạn là SUSAM_EXPERT (Claim Mode).
    
    Hợp đồng: ${contract.contractNumber}
    Sản phẩm: ${product?.name}
    ${context}
    
    Sự kiện bảo hiểm: ${eventDescription}
    
    Hãy phân tích quyền lợi. Output JSON: {eligible: bool, warning, checklist: [{item, note}], estimatedAmount, reasoning}
    `;
    const json = await callGemini("Bạn là Claim Specialist.", prompt, 'gemini-2.5-flash', 'application/json');
    return JSON.parse(json || '{}');
};

export const generateActionScript = async (task: any, customer: any) => {
    return await callGemini("Bạn là SUSAM_COACH. Viết kịch bản ngắn.", `Mục đích: ${task.title}. Cho KH: ${customer.fullName}`);
};
