
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, auth } from "./firebaseConfig";

/**
 * Helper: Compress Image using Canvas
 * Giảm kích thước ảnh xuống tối đa 1280px chiều rộng/cao, quality 0.7
 */
const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1280;
                const MAX_HEIGHT = 1280;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Compression failed"));
                }, 'image/jpeg', 0.7); // Quality 0.7
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

/**
 * Uploads a file to Firebase Storage.
 * Auto-compresses images before uploading to save cost and bandwidth.
 */
export const uploadFile = async (file: File, folder: string = 'uploads'): Promise<string> => {
    try {
        if (!auth.currentUser) {
            throw new Error("Người dùng chưa đăng nhập.");
        }

        let fileToUpload: Blob | File = file;
        let fileName = file.name;

        // Nếu là ảnh, thực hiện nén
        if (file.type.startsWith('image/')) {
            console.log(`Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
            try {
                const compressedBlob = await compressImage(file);
                fileToUpload = compressedBlob;
                // Đổi đuôi file thành .jpg vì canvas export ra jpeg
                fileName = fileName.replace(/\.[^/.]+$/, "") + ".jpg";
                console.log(`Compressed size: ${(compressedBlob.size / 1024 / 1024).toFixed(2)} MB`);
            } catch (e) {
                console.warn("Image compression failed, uploading original.", e);
            }
        }

        const cleanFileName = fileName.replace(/[^a-zA-Z0-9.]/g, '_');
        const uniqueName = `${Date.now()}_${cleanFileName}`;
        const storageRef = ref(storage, `${folder}/${uniqueName}`);
        
        const metadata = {
            contentType: file.type.startsWith('image/') ? 'image/jpeg' : file.type,
            customMetadata: {
                'uploadedBy': auth.currentUser.uid,
                'uploadedAt': new Date().toISOString()
            }
        };

        const snapshot = await uploadBytes(storageRef, fileToUpload, metadata);
        return await getDownloadURL(snapshot.ref);

    } catch (error: any) {
        console.error("Error uploading file:", error);
        if (error.code === 'storage/unauthorized') {
            throw new Error("Lỗi quyền truy cập Storage.");
        }
        throw new Error(error.message || "Không thể tải file lên.");
    }
};
