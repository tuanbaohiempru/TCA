
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
 * Tự động thêm trường searchKey cho Customer để tối ưu tìm kiếm
 */
const sanitizePayload = (data: any, collectionName: string) => {
    // Sử dụng JSON trick để loại bỏ nhanh các key có value là undefined
    const clean = JSON.parse(JSON.stringify(data));

    // OPTIMIZATION: Tạo searchKey cho Customer để query chi phí thấp
    if (collectionName === COLLECTIONS.CUSTOMERS && clean.fullName) {
        clean.searchKey = clean.fullName.toLowerCase().trim();
    }

    return clean;
};

// --- GENERIC FUNCTIONS ---

/**
 * Lắng nghe dữ liệu realtime từ một collection
 */
export const subscribeToCollection = (collectionName: string, callback: (data: any[]) => void) => {
    if (!db) return () => {};
    // Giới hạn 100 records mặc định để tránh load quá nhiều bill
    const query = db.collection(collectionName).limit(100);
    
    return query.onSnapshot((snapshot: any) => {
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
        const cleanData = sanitizePayload(rest, collectionName);
        
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
        const cleanData = sanitizePayload(rest, collectionName);

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

// --- OPTIMIZED SEARCH FUNCTIONS (COST SAVING) ---

/**
 * Tìm kiếm khách hàng theo tên (Sử dụng index searchKey)
 * Thay vì lấy toàn bộ database về lọc (tốn kém), ta dùng query Firestore.
 */
export const searchCustomersByName = async (keyword: string): Promise<Customer[]> => {
    if (!keyword || !db) return [];
    
    try {
        const searchKey = keyword.toLowerCase().trim();
        
        // Sử dụng kỹ thuật Range Query cho chuỗi để tìm kiếm "Starts With"
        // searchKey <= name <= searchKey + \uf8ff
        const snapshot = await db.collection(COLLECTIONS.CUSTOMERS)
            .where('searchKey', '>=', searchKey)
            .where('searchKey', '<=', searchKey + '\uf8ff')
            .limit(20) // Chỉ lấy tối đa 20 kết quả để tiết kiệm
            .get();

        return snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })) as Customer[];
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
