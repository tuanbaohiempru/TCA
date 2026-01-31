
import { db } from "./firebaseConfig";
import { Customer, Contract, ContractStatus } from "../types";

// Tên các Collection trong Firestore
const COLLECTIONS = {
    CUSTOMERS: 'customers',
    CONTRACTS: 'contracts',
    PRODUCTS: 'products',
    APPOINTMENTS: 'appointments',
    SETTINGS: 'settings', 
    MESSAGE_TEMPLATES: 'message_templates',
    ILLUSTRATIONS: 'illustrations'
};

// --- HELPER: SANITIZE DATA ---
/**
 * Loại bỏ các trường undefined để tránh lỗi Firestore "Unsupported field value: undefined"
 * Chuyển đổi ID thành chuỗi nếu cần thiết
 */
const sanitizePayload = (data: any) => {
    // Sử dụng JSON trick để loại bỏ nhanh các key có value là undefined
    // JSON.stringify sẽ bỏ qua các field undefined
    const clean = JSON.parse(JSON.stringify(data));
    return clean;
};

// --- GENERIC FUNCTIONS ---

/**
 * Lắng nghe dữ liệu realtime từ một collection
 */
export const subscribeToCollection = (collectionName: string, callback: (data: any[]) => void) => {
    if (!db) return () => {};
    return db.collection(collectionName).onSnapshot((snapshot: any) => {
        const data = snapshot.docs.map((doc: any) => ({
            ...doc.data(),
            id: doc.id 
        }));
        callback(data);
    }, (error: any) => {
        console.error(`Error fetching ${collectionName}:`, error);
    });
};

/**
 * Thêm mới dữ liệu
 */
export const addData = async (collectionName: string, data: any) => {
    try {
        if (!db) throw new Error("Firebase DB not initialized");
        // Tách ID ra (để Firestore tự sinh ID), và làm sạch dữ liệu
        const { id, ...rest } = data; 
        const cleanData = sanitizePayload(rest);
        
        await db.collection(collectionName).add(cleanData);
    } catch (e: any) {
        console.error("Error adding document: ", e);
        throw new Error(e.message || "Lỗi khi thêm dữ liệu");
    }
};

/**
 * Cập nhật dữ liệu
 */
export const updateData = async (collectionName: string, id: string, data: any) => {
    try {
        if (!db) throw new Error("Firebase DB not initialized");
        // Tách ID cũ ra để không ghi đè vào field 'id' trong doc (nếu có)
        const { id: dataId, ...rest } = data;
        const cleanData = sanitizePayload(rest);

        await db.collection(collectionName).doc(id).update(cleanData);
    } catch (e: any) {
        console.error("Error updating document: ", e);
        throw new Error(e.message || "Lỗi khi cập nhật dữ liệu");
    }
};

/**
 * Xóa dữ liệu
 */
export const deleteData = async (collectionName: string, id: string) => {
    try {
        if (!db) throw new Error("Firebase DB not initialized");
        await db.collection(collectionName).doc(id).delete();
    } catch (e: any) {
        console.error("Error deleting document: ", e);
        throw new Error(e.message || "Lỗi khi xóa dữ liệu");
    }
};

// --- RAG SPECIFIC FUNCTIONS (Server-side Retrieval) ---

/**
 * Tìm kiếm khách hàng theo tên (Search Index logic giả lập)
 * Trong thực tế nên dùng Algolia/ElasticSearch, ở đây dùng Firestore query cơ bản
 */
export const searchCustomersByName = async (keyword: string): Promise<Customer[]> => {
    if (!keyword || !db) return [];
    
    try {
        const snapshot = await db.collection(COLLECTIONS.CUSTOMERS).get();
        const all = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })) as Customer[];
        
        const lowerKey = keyword.toLowerCase();
        return all.filter(c => c.fullName.toLowerCase().includes(lowerKey));
    } catch (e) {
        console.error("Search Error", e);
        return [];
    }
};

/**
 * Lấy hợp đồng của 1 khách hàng cụ thể
 */
export const getContractsByCustomerId = async (customerId: string): Promise<Contract[]> => {
    if (!db) return [];
    try {
        const snapshot = await db.collection(COLLECTIONS.CONTRACTS)
            .where('customerId', '==', customerId)
            .get();
        
        return snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })) as Contract[];
    } catch (e) {
        console.error("Get Contracts Error", e);
        return [];
    }
};

export { COLLECTIONS };
