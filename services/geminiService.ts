
import { httpsCallable } from "firebase/functions";
import { functions, isFirebaseReady } from "./firebaseConfig";
import { GoogleGenAI, Type, Tool } from "@google/genai";
import { AppState, Customer, AgentProfile, ContractStatus, Contract, Product, Appointment, AppointmentType } from "../types";
// FIX: Use named imports for better compatibility with ESM
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// FIX: Use jsdelivr for a reliable, CORS-friendly ESM worker. 
// Version must match the main library (4.0.379).
GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

// --- CONFIGURATION ---
const getApiKey = (): string => {
    return process.env.API_KEY || localStorage.getItem('gemini_api_key') || '';
};

const apiKey = getApiKey();
const clientAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

// MODEL STRATEGY: 
// Use Flash for high speed & large context (1M tokens) allowing full PDF injection at low cost.
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
                    temperature: 0.1 // Ultra-low temperature for factual consistency
                }
            });
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
                temperature: 0.1, // Strict factual mode
                tools: tools.length > 0 ? tools : undefined
            }
        };

        const response = await clientAI.models.generateContent(req);
        
        if (response.functionCalls && response.functionCalls.length > 0) {
            return JSON.stringify({ functionCall: response.functionCalls[0] });
        }

        return response.text;
    }

    throw new Error("Không thể kết nối AI. Vui lòng kiểm tra API Key hoặc Cloud Functions.");
};

// --- DATA CLEANING (SƠ CHẾ DỮ LIỆU) ---
const cleanText = (text: string): string => {
    if (!text) return "";
    return text
        .replace(/\s+/g, ' ') // Thay thế nhiều khoảng trắng/newline liên tiếp bằng 1 khoảng trắng
        .replace(/Trang \d+\/\d+/gi, '') // Xóa số trang (VD: Trang 1/50)
        .replace(/Page \d+ of \d+/gi, '') // Xóa số trang tiếng Anh
        .trim();
};

// --- NEW: EXTRACT DIRECTLY FROM FILE (IN MEMORY) ---
// This bypasses CORS because it reads the file from local browser memory, not from a URL.
export const extractTextFromFile = async (file: File): Promise<string> => {
    try {
        console.log("Reading PDF from memory...", file.name, file.size);
        const arrayBuffer = await file.arrayBuffer();
        
        // Pass arrayBuffer directly to getDocument
        // Note: We intentionally do NOT set cMapUrl to avoid external fetch issues for fonts, 
        // unless strictly necessary for asian fonts (which might result in garbled text if missing).
        // Let's try adding it back if needed, but for now simple extraction is key.
        const loadingTask = getDocument({ 
            data: arrayBuffer,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/cmaps/',
            cMapPacked: true,
        });
        
        const pdf = await loadingTask.promise;
        console.log(`PDF Loaded. Pages: ${pdf.numPages}`);
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += `[Trang ${i}] ${pageText}\n`;
        }
        
        console.log("PDF Extraction Complete. Length:", fullText.length);
        return cleanText(fullText);
    } catch (e: any) {
        console.error("Client File Extract Error details:", e);
        // Fallback or rethrow to let UI know
        if (e.name === 'MissingPDFException') {
            return "Lỗi: File PDF không hợp lệ hoặc bị hỏng.";
        }
        return `Lỗi đọc file: ${e.message}`;
    }
}

// --- PDF EXTRACTION (HYBRID: CLIENT -> SERVER FALLBACK) ---
// Kept for backward compatibility or when URL is the only source
export const extractPdfText = async (fileUrl: string): Promise<string> => {
    // Cách 1: Thử đọc trực tiếp trên trình duyệt (Nhanh, miễn phí)
    try {
        console.log("Attempting Client-side PDF Extraction...");
        const loadingTask = getDocument({
            url: fileUrl,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/cmaps/',
            cMapPacked: true,
        });
        const pdf = await loadingTask.promise;
        let fullText = '';

        const maxPages = pdf.numPages; 
        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += `[Trang ${i}] ${pageText}\n`;
        }

        return cleanText(fullText);
    } catch (e: any) {
        console.warn("⚠️ Client-side PDF Extract Failed (Likely CORS). Switching to Cloud Function...", e.message);
        
        // Cách 2: Nếu lỗi (thường do CORS), nhờ Cloud Function đọc hộ
        if (isFirebaseReady) {
            try {
                const extractFn = httpsCallable(functions, 'extractPdf');
                const result: any = await extractFn({ url: fileUrl });
                console.log("✅ Server-side PDF Extraction Success");
                return cleanText(result.data.text);
            } catch (serverError: any) {
                console.error("❌ Server-side PDF Extract Failed:", serverError);
                throw new Error("Lỗi đọc file PDF (Cả Client & Server đều thất bại). Vui lòng kiểm tra file hoặc Deploy lại Functions.");
            }
        }
        
        return "Lỗi đọc file PDF. Vui lòng đảm bảo file có thể truy cập công khai hoặc CORS được cấu hình đúng.";
    }
};

// --- FUZZY MATCH ALGORITHM (THUẬT TOÁN TÌM KIẾM MỜ) ---
const calculateMatchScore = (query: string, productName: string, productCode: string): number => {
    const q = query.toLowerCase();
    const n = productName.toLowerCase();
    const c = productCode.toLowerCase();

    // 1. Exact Code Match: Highest Score
    if (q.includes(c)) return 100;

    // 2. Token Overlap Match
    const queryTokens = q.split(/\s+/).filter(t => t.length > 2); // Ignore short words
    const nameTokens = n.split(/\s+/);
    
    let matchedTokens = 0;
    queryTokens.forEach(qt => {
        if (nameTokens.some(nt => nt.includes(qt))) matchedTokens++;
    });

    if (queryTokens.length === 0) return 0;
    
    // Score = Percentage of matched tokens
    return (matchedTokens / queryTokens.length) * 100;
};

// --- SMART RETRIEVAL HELPER ---
const getRelevantProductKnowledge = (query: string, products: Product[]): string => {
    // 1. Filter products with relevant scores
    const relevantProducts = products.map(p => ({
        product: p,
        score: calculateMatchScore(query, p.name, p.code)
    })).filter(item => item.score > 30); // Threshold: Match at least 30% keywords

    // 2. Special Case: Alias mapping (Hardcoded for common terms)
    if (query.toLowerCase().includes('thẻ sức khỏe') || query.toLowerCase().includes('y tế')) {
        const healthCard = products.find(p => p.name.includes('Hành Trang') || p.name.includes('Sức khỏe'));
        if (healthCard && !relevantProducts.some(rp => rp.product.id === healthCard.id)) {
            relevantProducts.push({ product: healthCard, score: 90 });
        }
    }

    if (relevantProducts.length > 0) {
        // Sort by relevance
        relevantProducts.sort((a, b) => b.score - a.score);
        
        console.log("AI Detected Products:", relevantProducts.map(rp => rp.product.name));
        
        let context = "\n*** KHO TÀI LIỆU CHÍNH THỨC (ĐƯỢC ƯU TIÊN SỐ 1) ***\n";
        
        relevantProducts.forEach(({ product }) => {
            if (product.extractedContent) {
                // Optimization: Gemini 2.5 Flash context is huge, we can send almost everything.
                // Limit to 200k chars per product to be safe with multiple products.
                const safeContent = product.extractedContent.length > 200000 
                    ? product.extractedContent.substring(0, 200000) + "\n...(Cắt bớt)..."
                    : product.extractedContent;
                    
                context += `\n>>> QUY TẮC SẢN PHẨM: ${product.name} (Mã: ${product.code}) <<<\n${safeContent}\n--------------------\n`;
            } else {
                context += `\n>>> SẢN PHẨM: ${product.name} <<<\n(Chưa có tài liệu PDF chi tiết. Chỉ có mô tả: ${product.description})\n`;
            }
        });
        return context;
    }

    return "";
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
    
    // 1. Prepare Core Context (Lite Version)
    const customerSummary = state.customers.slice(0, 20).map(c => `- ${c.fullName} (Phone: ${c.phone})`).join('\n');
    const productSummary = state.products.map(p => `- [${p.code}] ${p.name}: ${p.description}`).join('\n');

    // 2. SMART RETRIEVAL (With Fuzzy Match)
    const detailedProductKnowledge = getRelevantProductKnowledge(query, state.products);

    const context = `
    === KHO DỮ LIỆU CƠ BẢN ===
    A. SẢN PHẨM HIỆN CÓ (TÓM TẮT):
    ${productSummary}

    B. DANH SÁCH KHÁCH HÀNG (20 GẦN NHẤT):
    ${customerSummary}

    ${detailedProductKnowledge}
    
    === YÊU CẦU CỦA USER ===
    "${query}"
    `;

    // 3. FIREWALL & SYSTEM INSTRUCTION (UPDATED FOR FORMATTING)
    const systemInstruction = `
    Bạn là **Su Sam Squad** - Trợ lý AI chuyên nghiệp của Prudential.
    
    🔥 QUY TẮC TRÌNH BÀY (BẮT BUỘC):
    1. **NHẤN MẠNH**: Hãy dùng cú pháp Markdown **in đậm** (hai dấu sao) cho các từ khóa quan trọng, con số, quyền lợi chính. Giao diện sẽ tự động tô màu đỏ cho các phần này.
    2. **CHÚ THÍCH**: Dùng *in nghiêng* (một dấu sao) cho các giải thích phụ hoặc lưu ý nhỏ.
    3. **RÕ RÀNG**: Sử dụng gạch đầu dòng (-) để liệt kê ý. Tách đoạn rõ ràng.
    
    🔥 BỨC TƯỜNG LỬA (FIREWALL):
    1. **NGUỒN DỮ LIỆU:** Khi trả lời về điều khoản/quyền lợi sản phẩm, BẮT BUỘC phải dựa trên phần "KHO TÀI LIỆU CHÍNH THỨC" được cung cấp ở trên.
    2. **KHÔNG SUY ĐOÁN:** Nếu tài liệu không đề cập rõ ràng, hãy trả lời: "Trong tài liệu hiện tại chưa có thông tin chi tiết về vấn đề này. Vui lòng kiểm tra lại file quy tắc sản phẩm."
    3. **TRÍCH DẪN:** Khi trả lời, hãy cố gắng ghi rõ "Theo mục..." hoặc "Được quy định tại..." để tăng độ tin cậy.
    4. **THỜI GIAN THỰC:** Hôm nay là ${new Date().toLocaleDateString('vi-VN')}.

    ĐỊNH HÌNH NHÂN CÁCH (TỰ ĐỘNG CHỌN):
    - **SUSAM_EXPERT (Mặc định khi hỏi SP):** Chuyên gia sản phẩm. Trả lời chính xác, trích dẫn luật.
    - **SUSAM_ADMIN:** Khi yêu cầu tạo/sửa dữ liệu (Dùng Tool).
    - **SUSAM_SALES:** Khi nhờ tư vấn khơi gợi nhu cầu (Dùng kiến thức MDRT).

    HÃY TRẢ LỜI NGẮN GỌN, TRỰC DIỆN.
    `;

    // 4. Define Tools
    const tools: Tool[] = [
        {
            functionDeclarations: [
                {
                    name: "create_customer",
                    description: "Tạo hồ sơ khách hàng mới.",
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

    // 5. Construct Request
    const parts: any[] = [{ text: context }];
    if (imageBase64) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
        parts.push({ text: "Hãy đóng vai SUSAM_ADMIN, trích xuất thông tin từ ảnh này." });
    }

    try {
        if (clientAI) {
            const result: any = await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: parts }],
                config: { 
                    systemInstruction: systemInstruction,
                    temperature: 0.1, // Low temp for factual accuracy
                    tools: tools
                }
            });

            const fc = result.functionCalls?.[0];
            if (fc) {
                if (fc.name === 'create_customer') return { text: "Đang tạo hồ sơ...", action: { action: 'CREATE_CUSTOMER', data: fc.args } };
                if (fc.name === 'create_appointment') return { text: "Đang đặt lịch...", action: { action: 'CREATE_APPOINTMENT', data: fc.args } };
            }

            return { text: result.text || "Xin lỗi, tôi chưa hiểu ý bạn.", action: null };
        } 
        
        return { text: "Hệ thống AI chưa được cấu hình đầy đủ.", action: null };

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
        
        QUY TẮC TRÌNH BÀY:
        - Sử dụng **in đậm** cho từ khóa quan trọng (Lợi ích, con số, cảm xúc).
        - Sử dụng *in nghiêng* cho lời giải thích kỹ thuật.
        
        KỸ THUẬT ÁP DỤNG:
        - Đồng cảm -> Cô lập vấn đề -> Giải quyết -> Chốt.
        - Hãy đưa ra câu trả lời mẫu xuất sắc nhất cho tình huống này.
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
    const context = product?.extractedContent ? `CHI TIẾT SẢN PHẨM: ${product.extractedContent.substring(0, 300000)}` : `Mô tả sản phẩm: ${product?.description}`;
    
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
