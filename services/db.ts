
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

// --- GENERIC FUNCTIONS ---

/**
 * Lắng nghe dữ liệu realtime từ một collection
 */
export const subscribeToCollection = (collectionName: string, callback: (data: any[]) => void) => {
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
        const { id, ...cleanData } = data; 
        await db.collection(collectionName).add(cleanData);
    } catch (e) {
        console.error("Error adding document: ", e);
        throw e;
    }
};

/**
 * Cập nhật dữ liệu
 */
export const updateData = async (collectionName: string, id: string, data: any) => {
    try {
        const { id: dataId, ...cleanData } = data; 
        await db.collection(collectionName).doc(id).update(cleanData);
    } catch (e) {
        console.error("Error updating document: ", e);
        throw e;
    }
};

/**
 * Xóa dữ liệu
 */
export const deleteData = async (collectionName: string, id: string) => {
    try {
        await db.collection(collectionName).doc(id).delete();
    } catch (e) {
        console.error("Error deleting document: ", e);
        throw e;
    }
};

// --- RAG SPECIFIC FUNCTIONS (Server-side Retrieval) ---

/**
 * Tìm kiếm khách hàng theo tên (Search Index logic giả lập)
 * Trong thực tế nên dùng Algolia/ElasticSearch, ở đây dùng Firestore query cơ bản
 */
export const searchCustomersByName = async (keyword: string): Promise<Customer[]> => {
    if (!keyword) return [];
    
    // Lưu ý: Firestore không hỗ trợ full-text search native tốt.
    // Đây là cách đi đường vòng: Lấy danh sách (giới hạn) rồi lọc JS, hoặc tìm chính xác.
    // Để tối ưu cho 1000+ khách, nên lưu field `keywords` mảng trong document.
    // Ở đây ta dùng giải pháp đơn giản: Lấy về client lọc (nhưng chỉ lấy fields cần thiết nếu dùng Admin SDK, 
    // nhưng với Web SDK ta phải lấy document).
    
    try {
        // Cách tối ưu hơn: Query range
        // Tìm tên bắt đầu bằng Keyword (Case sensitive simulation)
        // const snapshot = await db.collection(COLLECTIONS.CUSTOMERS)
        //    .where('fullName', '>=', keyword)
        //    .where('fullName', '<=', keyword + '\uf8ff')
        //    .get();
        
        // Cách đơn giản cho Demo RAG: 
        // Lấy hết (nếu ít) hoặc dùng logic Search phía trên.
        // Vì "Thanh" có thể là "Nguyễn Thị Thanh", query 'startAt' khó chính xác nếu không chuẩn hóa.
        
        // Giải pháp "Production-lite":
        // 1. Chỉ lấy những người có vẻ khớp (nếu database lớn, cần Cloud Function search)
        // 2. Với < 2000 khách, fetch all basic info (cache) search vẫn nhanh hơn gọi Server.
        // Nhưng yêu cầu là RAG server-side logic:
        
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
