
import { Customer, Appointment, AppointmentType, AppointmentStatus, InteractionType, TimelineItem } from "../types";

/**
 * AutomationEngine: Xử lý các quy tắc nghiệp vụ tự động khi dữ liệu thay đổi
 */
export const runCustomerAutomations = (
    oldCustomer: Customer | undefined, 
    newCustomer: Customer, 
    existingAppointments: Appointment[]
): {
    appointmentsToUpdate: Appointment[];
    appointmentsToAdd: Appointment[];
    newTimelineItems: TimelineItem[];
} => {
    const appointmentsToUpdate: Appointment[] = [];
    const appointmentsToAdd: Appointment[] = [];
    const newTimelineItems: TimelineItem[] = [];

    if (!oldCustomer) return { appointmentsToUpdate, appointmentsToAdd, newTimelineItems };

    // --- 1. TỰ ĐỘNG CẬP NHẬT LỊCH SINH NHẬT ---
    if (oldCustomer.dob !== newCustomer.dob && newCustomer.dob) {
        // Tìm các lịch hẹn sinh nhật cũ của khách này
        const birthdayApps = existingAppointments.filter(
            a => a.customerId === newCustomer.id && a.type === AppointmentType.BIRTHDAY
        );

        const newBirthDate = new Date(newCustomer.dob);
        const currentYear = new Date().getFullYear();
        // Tính ngày sinh nhật trong năm nay (hoặc năm sau nếu đã qua)
        let targetDate = new Date(currentYear, newBirthDate.getMonth(), newBirthDate.getDate());
        if (targetDate < new Date()) {
            targetDate.setFullYear(currentYear + 1);
        }
        const dateStr = targetDate.toISOString().split('T')[0];

        if (birthdayApps.length > 0) {
            // Cập nhật ngày cho các lịch hiện có
            birthdayApps.forEach(app => {
                appointmentsToUpdate.push({ ...app, date: dateStr, note: `Tự động cập nhật theo ngày sinh mới: ${newCustomer.dob}` });
            });
        } else {
            // Tạo mới nếu chưa có
            appointmentsToAdd.push({
                id: `auto-bday-${newCustomer.id}-${Date.now()}`,
                customerId: newCustomer.id,
                customerName: newCustomer.fullName,
                date: dateStr,
                time: '09:00',
                type: AppointmentType.BIRTHDAY,
                status: AppointmentStatus.UPCOMING,
                note: `Sinh nhật khách hàng (Tự động tạo)`
            });
        }

        newTimelineItems.push({
            id: `log-dob-${Date.now()}`,
            date: new Date().toISOString(),
            type: InteractionType.SYSTEM,
            title: "Cập nhật ngày sinh",
            content: `Ngày sinh thay đổi từ ${oldCustomer.dob} sang ${newCustomer.dob}. Lịch chăm sóc đã được đồng bộ.`,
            result: "Auto-Synced"
        });
    }

    // --- 2. TỰ ĐỘNG TẠO LỊCH CHĂM SÓC KHI CHỐT HỢP ĐỒNG ---
    if (oldCustomer.status !== 'Đã tham gia' && newCustomer.status === 'Đã tham gia') {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        appointmentsToAdd.push({
            id: `auto-followup-${newCustomer.id}-${Date.now()}`,
            customerId: newCustomer.id,
            customerName: newCustomer.fullName,
            date: nextWeek.toISOString().split('T')[0],
            time: '10:00',
            type: AppointmentType.PAPERWORK,
            status: AppointmentStatus.UPCOMING,
            note: `Bàn giao bộ hợp đồng và hướng dẫn sử dụng App/Portal (Tự động)`
        });
    }

    // --- 3. RÀ SOÁT THAY ĐỔI THU NHẬP ---
    if (oldCustomer.analysis?.incomeMonthly !== newCustomer.analysis?.incomeMonthly) {
        newTimelineItems.push({
            id: `log-income-${Date.now()}`,
            date: new Date().toISOString(),
            type: InteractionType.SYSTEM,
            title: "Thay đổi tài chính",
            content: `Thu nhập thay đổi. Dashboard sẽ tự động tính toán lại lỗ hổng bảo vệ (Gap Analysis).`,
            result: "Insight Updated"
        });
    }

    return { appointmentsToUpdate, appointmentsToAdd, newTimelineItems };
};
