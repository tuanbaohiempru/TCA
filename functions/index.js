
// Load biến môi trường từ file .env
require('dotenv').config();

// Sử dụng Cloud Functions V2
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { GoogleGenAI } = require("@google/genai");

// Cấu hình Global cho V2: Timeout 300s, RAM 256MB (Giảm RAM vì không còn xử lý PDF nặng)
setGlobalOptions({ maxInstances: 10, timeoutSeconds: 60, memory: '256MiB' });

const API_KEY = process.env.API_KEY;

exports.geminiGateway = onCall(async (request) => {
    const data = request.data; 

    if (!API_KEY) {
        throw new HttpsError('failed-precondition', 'Server chưa cấu hình API Key.');
    }

    if (!data) {
        throw new HttpsError('invalid-argument', 'Request body is missing.');
    }

    const { endpoint, model, contents, message, history, systemInstruction, config, tools } = data;
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    // Default model fallback if not provided
    const targetModel = model || 'gemini-3-flash-preview';

    try {
        const cleanConfig = { ...(config || {}) };
        
        // Handle System Instruction
        if (systemInstruction) {
            if (typeof systemInstruction === 'string') {
                cleanConfig.systemInstruction = { parts: [{ text: systemInstruction }] };
            } else {
                cleanConfig.systemInstruction = systemInstruction;
            }
        }

        // Handle Tools
        if (tools) {
            cleanConfig.tools = tools;
        }

        let initParams = { model: targetModel, config: cleanConfig };
        let responsePayload = {};

        if (endpoint === 'chat') {
            const validHistory = Array.isArray(history) ? history : [];
            const chat = ai.chats.create({ ...initParams, history: validHistory });
            
            let msgContent = message;
            if (!message && contents) msgContent = contents; 
            
            const result = await chat.sendMessage({ message: msgContent || " " });
            
            responsePayload = {
                text: result.text,
                functionCalls: result.functionCalls, 
                candidates: result.candidates
            };
        } else {
            // Default: Generate Content
            let formattedContents = contents;
            if (typeof contents === 'string') formattedContents = { parts: [{ text: contents }] };
            
            const result = await ai.models.generateContent({ ...initParams, contents: formattedContents });
            responsePayload = {
                text: result.text,
                functionCalls: result.functionCalls
            };
        }

        return responsePayload;

    } catch (error) {
        console.error("[Gemini API Error]", error.message);
        let code = 'internal';
        if (error.message.includes('API key')) code = 'permission-denied';
        else if (error.status === 404) code = 'not-found';
        else if (error.status === 429) code = 'resource-exhausted';
        throw new HttpsError(code, error.message);
    }
});
