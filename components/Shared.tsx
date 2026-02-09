
import React, { useState, useEffect, useRef } from 'react';
import { Customer } from '../types';

// --- HELPER FUNCTIONS ---

export const formatDateVN = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
};

export const formatAdvisoryContent = (text: string) => {
    let html = text;
    // Sanitize basic chars
    html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // 1. HEADERS: Make them stand out
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-pru-red font-bold text-base mt-3 mb-2 border-b border-red-100 dark:border-red-900/30 pb-1 uppercase tracking-wide">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-gray-800 dark:text-gray-100 font-black text-lg mt-4 mb-2">$1</h2>');

    // 2. BOLD & RED EMPHASIS (**text**)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-pru-red dark:text-red-400 bg-red-50 dark:bg-red-900/10 px-1 rounded mx-0.5">$1</strong>');
    
    // 3. ITALIC & NOTE (*text*)
    html = html.replace(/\*(.*?)\*/g, '<em class="italic text-gray-600 dark:text-gray-400 font-medium">$1</em>');
    
    // 4. LISTS (- item)
    html = html.replace(/^\- (.*$)/gim, '<div class="flex items-start ml-1 mb-1.5"><span class="text-pru-red mr-2 font-bold">•</span><span class="text-gray-700 dark:text-gray-300">$1</span></div>');
    
    // 5. LINE BREAKS
    html = html.replace(/\n/g, '<br />');
    
    return html;
};

// --- ZALO OPTIMIZED COPY FUNCTION ---
const toMathBold = (str: string) => {
    return str.replace(/[0-9]/g, (char) => {
        // Convert ASCII digit to Mathematical Bold Digit (Unicode)
        // 0x1D7CE is the code point for Mathematical Bold Digit Zero
        return String.fromCodePoint(char.charCodeAt(0) + 120782);
    });
};

export const cleanMarkdownForClipboard = (text: string) => {
    let clean = text;
    
    // 0. Clean Table Syntax
    clean = clean.replace(/^\|?[\s\-\|:]+\|?$/gm, '');
    clean = clean.replace(/^\|/gm, '').replace(/\|$/gm, '');
    clean = clean.replace(/\|/g, ' - ');

    // 1. Headers -> Uppercase with Emojis
    // H3 -> 🔶 HEADER
    clean = clean.replace(/^###\s+(.*$)/gim, (match, p1) => `\n🔶 ${p1.toUpperCase()}\n`);
    // H2 -> ⭐️ HEADER ⭐️
    clean = clean.replace(/^##\s+(.*$)/gim, (match, p1) => `\n⭐️ ${p1.toUpperCase()} ⭐️\n`);
    
    // 2. Bold (**text**) -> 👉 TEXT 👈
    // Making it uppercase helps it stand out in plain text
    clean = clean.replace(/\*\*(.*?)\*\*/g, (match, p1) => `👉 ${p1} 👈`);
    
    // 3. Italic (*text*) -> "text"
    clean = clean.replace(/\*(.*?)\*/g, '"$1"');
    
    // 4. List Items (- item) -> ✅ item
    clean = clean.replace(/^\-\s+/gim, '✅ ');

    // 5. YAYTEXT: Convert all numbers to Bold Unicode
    // This makes prices/years/percentages pop!
    clean = toMathBold(clean);
    
    // 6. Clean extra newlines
    clean = clean.replace(/\n\n\n+/g, '\n\n');
    
    return clean.trim();
};

// --- SHARED COMPONENTS ---

export const CurrencyInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}> = ({ value, onChange, placeholder, className, disabled }) => {
    const formatNumber = (num: number) => {
        return num === 0 ? '' : num.toLocaleString('vi-VN');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\./g, '').replace(/\D/g, '');
        const numericValue = Number(rawValue);
        onChange(numericValue);
    };

    return (
        <div className="relative w-full">
            <input
                type="text"
                value={formatNumber(value)}
                onChange={handleChange}
                placeholder={placeholder}
                className={className}
                disabled={disabled}
            />
            {value > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">
                    VND
                </span>
            )}
        </div>
    );
};

export const SearchableCustomerSelect: React.FC<{
    customers: Customer[];
    value: string;
    onChange: (customer: Customer) => void; 
    label?: string;
    placeholder?: string;
    className?: string;
}> = ({ customers, value, onChange, label, placeholder, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const filtered = customers.filter(c => 
        c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        (c.idCard && c.idCard.includes(searchTerm))
    );

    const handleSelect = (customer: Customer) => {
        onChange(customer);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className={`relative ${className || ''}`} ref={wrapperRef}>
            {label && <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{label}</label>}
            <div 
                className="w-full border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg focus-within:ring-2 focus-within:ring-red-200 dark:focus-within:ring-red-900 bg-white dark:bg-gray-900 flex justify-between items-center cursor-pointer transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={`text-sm ${value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'} truncate`}>
                    {value || placeholder || "Chọn khách hàng"}
                </span>
                <i className="fas fa-chevron-down text-gray-400 text-xs ml-2"></i>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-pru-card border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-hidden flex flex-col min-w-[250px]">
                    <div className="p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        <input
                            type="text"
                            autoFocus
                            className="w-full text-sm p-1.5 border border-gray-300 dark:border-gray-600 rounded outline-none focus:border-red-400 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 placeholder-gray-400"
                            placeholder="Tìm tên, SĐT, CCCD..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {filtered.length > 0 ? (
                            filtered.map(c => (
                                <div 
                                    key={c.id}
                                    onClick={() => handleSelect(c)}
                                    className="px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer border-b border-gray-50 dark:border-gray-700 last:border-0"
                                >
                                    <div className="font-medium text-sm text-gray-800 dark:text-gray-200">{c.fullName}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        <i className="fas fa-phone-alt mr-1"></i>{c.phone} 
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-3 text-center text-xs text-gray-400">Không tìm thấy kết quả</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export const ConfirmModal: React.FC<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onClose: () => void;
}> = ({ isOpen, title, message, confirmLabel = "Xóa", cancelLabel = "Hủy", onConfirm, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-pru-card rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden transform transition-all scale-100 border border-gray-100 dark:border-gray-700">
                <div className="p-6 text-center">
                    <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100 dark:border-red-900/30">
                        <i className="fas fa-trash-alt text-xl text-red-500 dark:text-red-400"></i>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">{title}</h3>
                    <div className="text-gray-500 dark:text-gray-400 text-sm mb-6 leading-relaxed">{message}</div>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition"
                        >
                            {cancelLabel}
                        </button>
                        <button 
                            onClick={() => { onConfirm(); onClose(); }}
                            className="px-4 py-2.5 bg-pru-red hover:bg-red-700 text-white rounded-xl font-medium shadow-lg shadow-red-500/30 transition"
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
