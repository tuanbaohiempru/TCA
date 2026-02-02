
import { httpsCallable } from "firebase/functions";
import { functions, isFirebaseReady } from "./firebaseConfig";
import { GoogleGenAI } from "@google/genai";
import { AppState, Customer, AgentProfile, ContractStatus, Contract, Product } from "../types";
import * as pdfjsLib from 'pdfjs-dist';

// Configure Worker for PDF.js using CDN to avoid build issues
// Use specific version matching Import Map (4.0.379) to ensure compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js`;

// --- CONFIGURATION ---
const getApiKey = (): string => {
    return localStorage.getItem('gemini_api_key') || '';
};

const apiKey = getApiKey();
// Client-side instance
const clientAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

// OPTIMIZATION: Use Flash model for faster response (1-2s)
const DEFAULT_MODEL = 'gemini-3-flash-preview'; 

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

    // 2. Fallback to Client Side
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

// --- PDF EXTRACTION (CLIENT-SIDE COST SAVING) ---
export const extractPdfText = async (fileUrl: string): Promise<string> => {
    try {
        console.log("Starting Client-side PDF Extraction...");
        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const pdf = await loadingTask.promise;
        let fullText = '';

        // Giới hạn chỉ đọc 10 trang đầu để tiết kiệm và tối ưu tốc độ
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
    const model = 'gemini-3-flash-preview';
    const promptParts = [
        { text: "Trích xuất thông tin từ thẻ CCCD này. Trả về JSON: {idCard, fullName, dob (YYYY-MM-DD), gender, companyAddress}" },
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
    ];

    // 1. Try Cloud Functions (Production Secure Mode)
    if (isFirebaseReady) {
        try {
            const gateway = httpsCallable(functions, 'geminiGateway');
            const result: any = await gateway({
                endpoint: 'generateContent',
                model: model,
                contents: { role: 'user', parts: promptParts },
                config: { temperature: 0.1 }
            });
            
            const text = result.data.text;
            if (!text) return null;
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch (e) {
            console.warn("Cloud Function extract failed, falling back to client if available.", e);
        }
    }

    // 2. Fallback to Client Side (Development Mode)
    if (clientAI) {
        try {
            const response = await clientAI.models.generateContent({
                model: model,
                contents: [{ role: 'user', parts: promptParts }]
            });
            
            const text = response.text;
            if (!text) return null;

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch (e) {
            console.error("Client AI extract failed", e);
            return null;
        }
    }
    
    console.error("No AI service available for Extraction");
    return null;
}

// --- MARKETING FEATURES ---
export const generateCaseStudy = async (
    customer: Customer, 
    contracts: Contract[], 
    framework: 'AIDA' | 'PAS' = 'AIDA'
) => {
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
    BẠN LÀ MỘT CHUYÊN GIA COPYWRITING BẢO HIỂM MDRT.
    Nhiệm vụ: Viết một bài chia sẻ (Case Study) lên Facebook/Zalo.
    Framework: ${framework}.
    ĐỊNH DẠNG JSON OUTPUT: { "title": "...", "content": "...", "imagePrompt": "..." }
    `;

    const prompt = `Viết câu chuyện dựa trên:\n${context}`;
    const json = await callGemini(systemInstruction, prompt, 'gemini-3-flash-preview', 'application/json');
    return JSON.parse(json || '{}');
};

export const generateSocialPost = async (topic: string, tone: string) => {
    const systemInstruction = `Bạn là chuyên gia Content Marketing Bảo hiểm. Viết 3 bài post Facebook ngắn về chủ đề yêu cầu. Giọng: ${tone}. Trả về JSON: [{"title": "...", "content": "..."}]`;
    const json = await callGemini(systemInstruction, topic, 'gemini-3-flash-preview', 'application/json');
    return JSON.parse(json || '[]');
};

export const generateContentSeries = async (topic: string, profile: AgentProfile | null) => {
    const systemInstruction = `Lập kế hoạch 5 bài viết giáo dục khách hàng về "${topic}". Trả về JSON: [{"day": "Ngày 1", "type": "...", "content": "..."}]`;
    const json = await callGemini(systemInstruction, "Lập kế hoạch", 'gemini-3-flash-preview', 'application/json');
    return JSON.parse(json || '[]');
};

export const generateStory = async (facts: string, emotion: string) => {
    const systemInstruction = `Biến dữ kiện sau thành câu chuyện cảm động (Storytelling). Cảm xúc: ${emotion}.`;
    return await callGemini(systemInstruction, facts);
};

// --- CHAT FUNCTIONS ---
export const analyzeSocialInput = async (text: string) => { return {}; };

export const chatWithData = async (query: string, imageBase64: string | null, state: AppState, history: any[], onStream?: (chunk: string) => void) => {
    return { text: "Tính năng Chat đang được nâng cấp.", action: null };
};

export const consultantChat = async (msg: string, customer: any, contracts: any, relationships: any, profile: any, goal: string, history: any[], role: string, plan: any, style: string) => {
    const systemInstruction = `
    Vai trò: ${role === 'customer' ? 'Bạn là khách hàng khó tính.' : 'Bạn là SU SAM - Trợ lý MDRT.'}
    Mục tiêu: ${goal}. Phong cách: ${style}.
    `;
    return await callGemini(systemInstruction, msg);
};

export const getObjectionSuggestions = async (objection: string, customerContext: Customer | string = 'Khách hàng') => {
    const contextStr = typeof customerContext === 'string' ? customerContext : `KH: ${customerContext.fullName}`;
    const systemInstruction = `
    BẠN LÀ MDRT COACH. Phân tích lời từ chối: "${objection}". Ngữ cảnh: ${contextStr}.
    Đưa ra 3 kịch bản đối đáp (Đồng cảm, Logic, Câu hỏi ngược).
    Trả về JSON: [{ "type": "...", "label": "...", "content": "..." }]
    `;
    const json = await callGemini(systemInstruction, "Phân tích", 'gemini-3-flash-preview', 'application/json');
    return JSON.parse(json || '[]');
};

// --- OPERATIONS ---
export const checkPreUnderwriting = async (condition: string) => {
    const systemInstruction = `
    CHUYÊN GIA THẨM ĐỊNH (UNDERWRITER). Phân tích rủi ro y khoa: "${condition}".
    Trả về JSON: { "prediction": "Standard"|"Loading"|"Exclusion"|"Postpone"|"Decline", "predictionLabel": "...", "riskLevel": "...", "loadingEstimate": "...", "requirements": [], "reasoning": "..." }
    `;
    const json = await callGemini(systemInstruction, "Thẩm định", 'gemini-3-flash-preview', 'application/json');
    return JSON.parse(json || '{}');
};

export const analyzeClaimSupport = async (contract: Contract, product: Product | undefined, eventDescription: string) => {
    const systemInstruction = `
    TRỢ LÝ BỒI THƯỜNG. HĐ: ${contract.contractNumber}. SP: ${contract.mainProduct.productName}. Sự kiện: "${eventDescription}".
    Trả về JSON: { "eligible": boolean, "warning": "...", "checklist": [{"item": "...", "note": "..."}], "estimatedAmount": "...", "reasoning": "..." }
    `;
    const json = await callGemini(systemInstruction, "Phân tích Claim", 'gemini-3-flash-preview', 'application/json');
    return JSON.parse(json || '{}');
};

export const generateActionScript = async (task: any, customer: any) => {
    const systemInstruction = `Viết kịch bản tin nhắn Zalo. Mục đích: ${task.title}. JSON: {opening: "...", core_message: "..."}`;
    const json = await callGemini(systemInstruction, "Viết", 'gemini-3-flash-preview', 'application/json');
    return JSON.parse(json || '{}');
};
