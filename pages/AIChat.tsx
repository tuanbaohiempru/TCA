
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AppState, CustomerStatus, Gender, AppointmentType, AppointmentStatus, InteractionType, TimelineItem, Customer, MaritalStatus, FinancialRole } from '../types';
import { chatWithData } from '../services/geminiService';
import { addData, COLLECTIONS } from '../services/db';
import { cleanMarkdownForClipboard } from '../components/Shared';

interface AIChatProps {
  state: AppState;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const AIChat: React.FC<AIChatProps> = ({ state, isOpen, setIsOpen }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Chat State
  const [query, setQuery] = useState('');
  const DEFAULT_WELCOME = { role: 'model' as const, text: 'Xin chào! Em là **TuanChom AI**. \nEm có thể giúp anh:\n- Quét CCCD để tạo khách hàng\n- Đặt lịch hẹn, ghi chú nhanh\n- Tra cứu Hợp đồng & Sản phẩm\n\nHãy nhắn hoặc gửi ảnh cho em nhé!' };
  
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string; isAction?: boolean; actionData?: any }[]>([
    DEFAULT_WELCOME
  ]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Attachment State
  const [attachment, setAttachment] = useState<string | null>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
        setIsExpanded(true);
        scrollToBottom();
        setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, messages]);

  // --- Reset Context Logic (Session Control) ---
  const handleResetChat = () => {
      if (window.confirm("Bắt đầu đoạn chat mới? (Lịch sử cũ sẽ bị xóa)")) {
          setMessages([DEFAULT_WELCOME]);
          setQuery('');
          setAttachment(null);
      }
  };

  // --- Voice Setup ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'vi-VN';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) transcript += event.results[i][0].transcript;
        setQuery(transcript);
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return alert("Trình duyệt không hỗ trợ giọng nói.");
    isListening ? recognitionRef.current.stop() : (setQuery(''), recognitionRef.current.start());
  };

  // --- Image Handling ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => setAttachment(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  const removeAttachment = () => {
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Send Logic ---
  const handleSend = async (manualQuery?: string) => {
    const textToSend = manualQuery || query;
    if ((!textToSend.trim() && !attachment)) return;

    const userImage = attachment;
    
    // UI Update: User Message
    const displayMsg = userImage ? `[Đã gửi 1 ảnh] ${textToSend}` : textToSend;
    
    setMessages(prev => [
        ...prev, 
        { role: 'user', text: displayMsg },
        { role: 'model', text: '' } // Placeholder for streaming
    ]);
    
    if (!manualQuery) setQuery(''); // Only clear if input manually
    setAttachment(null);
    setIsLoading(true);

    try {
        const response = await chatWithData(
            textToSend, 
            userImage ? userImage.split(',')[1] : null, 
            state, 
            messages, 
            (chunk) => {
                setMessages(prev => {
                    const newMsgs = [...prev];
                    const lastIndex = newMsgs.length - 1;
                    if (lastIndex >= 0 && newMsgs[lastIndex].role === 'model') {
                        newMsgs[lastIndex].text += chunk;
                    }
                    return newMsgs;
                });
            }
        );
        
        // Final update
        setMessages(prev => {
            const newMsgs = [...prev];
            const lastIndex = newMsgs.length - 1;
            if (lastIndex >= 0 && newMsgs[lastIndex].role === 'model') {
                newMsgs[lastIndex].text = response.text; 
                // Store action data if present for rendering UI
                if (response.action) {
                    newMsgs[lastIndex].actionData = response.action;
                }
            }
            return newMsgs;
        });

        if (response.action) {
            await executeAction(response.action);
        }

    } catch (e) {
        setMessages(prev => {
            const newMsgs = [...prev];
            const lastIndex = newMsgs.length - 1;
            if (lastIndex >= 0 && newMsgs[lastIndex].role === 'model') {
                newMsgs[lastIndex].text = "Lỗi hệ thống. Vui lòng thử lại.";
            }
            return newMsgs;
        });
    } finally {
        setIsLoading(false);
    }
  };

  // --- Helper: Map Type string from AI to Enum ---
  const mapAppointmentType = (typeKey: string): AppointmentType => {
      switch (typeKey) {
          case 'FEE_REMINDER': return AppointmentType.FEE_REMINDER;
          case 'BIRTHDAY': return AppointmentType.BIRTHDAY;
          case 'CARE_CALL': return AppointmentType.CARE_CALL;
          case 'PAPERWORK': return AppointmentType.PAPERWORK;
          default: return AppointmentType.CONSULTATION;
      }
  };

  // --- Action Execution ---
  const executeAction = async (action: any) => {
      console.log("🔥 EXECUTE ACTION:", action); // DEBUG LOG

      try {
          if (action.action === 'SELECT_CUSTOMER') {
              // Do nothing here, UI will render options based on `actionData` in `messages`
              // Logic is handled in render
          }
          else if (action.action === 'CREATE_CUSTOMER') {
              const { data } = action;
              const newCustomer: Customer = {
                  id: '', 
                  fullName: data.fullName,
                  phone: data.phone,
                  idCard: data.idCard,
                  dob: data.dob,
                  gender: data.gender === 'Nam' ? Gender.MALE : data.gender === 'Nữ' ? Gender.FEMALE : Gender.OTHER,
                  companyAddress: data.address,
                  status: CustomerStatus.POTENTIAL,
                  job: '', occupation: '', maritalStatus: MaritalStatus.UNKNOWN, financialRole: FinancialRole.INDEPENDENT, dependents: 0,
                  health: { medicalHistory: '', height: 0, weight: 0, habits: '' },
                  analysis: { incomeMonthly: 0 } as any, 
                  timeline: [], claims: [], interactionHistory: []
              };
              await addData(COLLECTIONS.CUSTOMERS, newCustomer);
              setMessages(prev => [...prev, { role: 'model', text: `✅ Đã tạo hồ sơ KH: **${data.fullName}** thành công!`, isAction: true }]);
          } 
          else if (action.action === 'CREATE_APPOINTMENT') {
              const { data } = action;
              
              // Validate Data
              if (!data.date || !data.time || !data.customerName) {
                  throw new Error("Dữ liệu lịch hẹn không đầy đủ (Thiếu ngày/giờ/tên).");
              }

              // Find Customer
              const customer = state.customers.find(c => c.fullName.toLowerCase().includes(data.customerName.toLowerCase()));
              
              // Determine Type from AI data or default
              const appType = mapAppointmentType(data.type);

              await addData(COLLECTIONS.APPOINTMENTS, {
                  customerId: customer?.id || 'unknown',
                  customerName: data.customerName,
                  date: data.date, // Format YYYY-MM-DD from Gemini
                  time: data.time, // Format HH:mm from Gemini
                  type: appType,
                  status: AppointmentStatus.UPCOMING,
                  note: data.title || 'Lịch hẹn từ AI'
              });
              setMessages(prev => [...prev, { role: 'model', text: `📅 Đã đặt lịch: **${data.time} - ${data.date}** với ${data.customerName} (Loại: ${appType}).`, isAction: true }]);
          }
      } catch (e: any) {
          console.error("Action Error", e);
          setMessages(prev => [...prev, { role: 'model', text: `❌ Lỗi thực thi: ${e.message}` }]);
      }
  };

  const handleSelection = (candidate: any) => {
      // Send a hidden message to AI indicating selection
      // This helps AI context know who was picked so it can proceed
      const selectionText = `Tôi chọn: ${candidate.name} (ID: ${candidate.id}). Hãy tiếp tục thực hiện yêu cầu cho khách hàng này.`;
      handleSend(selectionText);
  };

  const containerClasses = isExpanded
    ? "fixed inset-0 md:left-auto md:top-0 md:right-0 md:w-[500px] md:h-full w-full h-full bg-white shadow-2xl flex flex-col border-l border-gray-200 z-[200] transition-all duration-300" 
    : "fixed bottom-28 right-8 w-[350px] h-[550px] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 overflow-hidden transform transition-all z-[200]"; // CHANGED: top-20 right-4 -> bottom-28 right-8

  if (!isOpen) return null;

  return createPortal(
    <>
      {isExpanded && <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[190]" onClick={() => setIsOpen(false)} />}

      <div className={`${containerClasses} animate-fade-in`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-red-800 p-4 flex justify-between items-center text-white shadow-md">
            <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-3 backdrop-blur-sm border border-white/30">
                    <i className="fas fa-robot text-lg animate-pulse"></i>
                </div>
                <div>
                    <h3 className="font-bold text-base">TuanChom Super Agent</h3>
                    <p className="text-[10px] opacity-80">Online • MDRT Support Mode</p>
                </div>
            </div>
            <div className="flex gap-1 items-center">
                 {/* RESET BUTTON */}
                 <button onClick={handleResetChat} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded text-white/80 hover:text-white transition" title="Đoạn chat mới">
                    <i className="fas fa-eraser"></i>
                 </button>
                 <button onClick={() => setIsExpanded(!isExpanded)} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded"><i className={`fas ${isExpanded ? 'fa-compress-alt' : 'fa-expand-alt'}`}></i></button>
                 <button onClick={() => setIsOpen(false)} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded"><i className="fas fa-times"></i></button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                    {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xs mr-2 flex-shrink-0 border border-red-200"><i className="fas fa-robot"></i></div>}
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm leading-relaxed ${
                        msg.role === 'user' ? 'bg-red-600 text-white rounded-br-none' : 
                        msg.isAction ? 'bg-green-50 text-green-800 border border-green-200' : 
                        'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                    }`}>
                        {msg.isAction && <div className="mb-1 text-green-600 font-bold text-xs uppercase"><i className="fas fa-check-circle mr-1"></i> Hoàn thành</div>}
                        
                        <div dangerouslySetInnerHTML={{ __html: msg.text ? msg.text.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') : '<span class="text-gray-400 italic">...</span>' }} />
                    </div>
                </div>

                {/* RENDER SELECTION CARDS IF ACTION IS SELECT_CUSTOMER */}
                {msg.actionData && msg.actionData.action === 'SELECT_CUSTOMER' && (
                    <div className="ml-10 mt-2 grid grid-cols-1 gap-2 w-[85%] animate-fade-in">
                        {msg.actionData.data.candidates.map((c: any, cIdx: number) => (
                            <button 
                                key={c.id || cIdx} 
                                onClick={() => handleSelection(c)}
                                className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm hover:border-red-300 hover:bg-red-50 transition text-left flex items-center gap-3 group"
                            >
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 group-hover:text-red-500 group-hover:bg-white transition-colors">
                                    {c.name.charAt(0)}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-bold text-sm text-gray-800 truncate group-hover:text-red-600">{c.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{c.info}</p>
                                </div>
                                <i className="fas fa-chevron-right text-gray-300 group-hover:text-red-500"></i>
                            </button>
                        ))}
                    </div>
                )}
              </div>
            ))}
            
            {isLoading && messages.length > 0 && messages[messages.length-1].text.length > 0 && (
                 <div className="flex items-center gap-2 text-gray-400 text-[10px] ml-10 opacity-70"><i className="fas fa-circle-notch fa-spin"></i> Hoàn tất...</div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-gray-100">
            {attachment && (
                <div className="flex items-center gap-2 mb-2 bg-gray-100 p-2 rounded-lg w-fit">
                    <img src={attachment} alt="Preview" className="h-10 w-10 object-cover rounded" />
                    <span className="text-xs text-gray-500">Đã đính kèm ảnh</span>
                    <button onClick={removeAttachment} className="text-red-500 hover:bg-red-100 rounded-full w-5 h-5 flex items-center justify-center"><i className="fas fa-times text-xs"></i></button>
                </div>
            )}
            <div className="flex items-end gap-2 bg-gray-50 p-2 rounded-3xl border border-gray-200 focus-within:border-red-300 focus-within:ring-1 focus-within:ring-red-200 transition-all">
                <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-50 flex items-center justify-center transition flex-shrink-0">
                    <i className="fas fa-paperclip"></i>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                
                <textarea 
                    ref={inputRef}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2.5 max-h-32 resize-none"
                    placeholder={isListening ? "Đang nghe..." : "Nhập yêu cầu..."}
                    rows={1}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                />

                <button onClick={toggleListening} className={`w-10 h-10 rounded-full flex items-center justify-center transition flex-shrink-0 ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}>
                    <i className={`fas ${isListening ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                </button>
                
                <button onClick={() => handleSend()} disabled={(!query.trim() && !attachment) || isLoading} className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 disabled:opacity-50 disabled:bg-gray-300 shadow-md flex-shrink-0">
                    <i className="fas fa-paper-plane"></i>
                </button>
            </div>
          </div>
      </div>
    </>,
    document.body
  );
};

export default AIChat;
