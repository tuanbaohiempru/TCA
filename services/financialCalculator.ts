
import { FinancialGoal, PlanResult } from "../types";

// --- CORE FINANCIAL FORMULAS ---

/**
 * Future Value (FV) - Tính giá trị tương lai
 */
const FV = (pv: number, r: number, n: number): number => {
    if (isNaN(pv) || isNaN(r) || isNaN(n)) return 0;
    return pv * Math.pow(1 + r, n);
};

/**
 * Present Value (PV) of an Annuity (Đầu giá - Nhận tiền đầu kỳ)
 */
const PV_Annuity = (pmt: number, r: number, n: number): number => {
    if (isNaN(pmt) || isNaN(r) || isNaN(n)) return 0;
    // Nếu lãi suất thực = 0, chỉ đơn giản là tổng tiền
    if (Math.abs(r) < 0.000001) return pmt * n; 
    
    // Công thức hiện giá dòng tiền đều (đầu kỳ): PV = PMT * [(1 - (1+r)^-n) / r] * (1+r)
    return pmt * ((1 - Math.pow(1 + r, -n)) / r) * (1 + r);
};

// --- GOAL CALCULATORS ---

export const calculateRetirement = (
    currentAge: number,
    retireAge: number,
    lifeExpectancy: number,
    currentMonthlyExpense: number, 
    inflationRate: number, 
    investmentRate: number, 
    currentSavings: number,
    options?: {
        hasSI?: boolean;
        salaryForSI?: number;
        existingAssetRate?: number; // NEW: Rate specific for existing lump sum
    }
): PlanResult => {
    // 0. Validate Inputs
    const yearsToRetire = Math.max(0, retireAge - currentAge);
    const yearsInRetirement = Math.max(0, lifeExpectancy - retireAge);
    const safeInflation = isNaN(inflationRate) ? 0 : inflationRate;
    const safeInvest = isNaN(investmentRate) ? 0 : investmentRate;

    // 1. Tính chi phí tháng tại thời điểm nghỉ hưu (FV)
    const futureMonthlyExpense = FV(currentMonthlyExpense, safeInflation, yearsToRetire);
    
    // --- SOCIAL INSURANCE LOGIC ---
    let futureMonthlyPension = 0;
    if (options?.hasSI && options.salaryForSI && options.salaryForSI > 0) {
        // Giả định: Lương cơ sở tăng theo lạm phát, hưởng 60%
        const futureSalaryBasis = FV(options.salaryForSI, safeInflation, yearsToRetire);
        futureMonthlyPension = futureSalaryBasis * 0.60;
    }

    // Nhu cầu thực tế cần bù đắp (NET)
    const netMonthlyNeeded = Math.max(0, futureMonthlyExpense - futureMonthlyPension);
    const netAnnualNeed = netMonthlyNeeded * 12;

    // 2. Tính Tổng quỹ hưu cần có (PV Annuity)
    // Real Rate: Lãi suất thực khi về hưu (Lãi gửi ngân hàng - Lạm phát)
    const realRate = ((1 + safeInvest) / (1 + safeInflation)) - 1;
    
    const totalFundNeeded = PV_Annuity(netAnnualNeed, realRate, yearsInRetirement);

    // 3. Tài sản đã có (FV)
    // FIX: Use existingAssetRate if provided, otherwise use the general investmentRate
    const assetRate = options?.existingAssetRate !== undefined ? options.existingAssetRate : safeInvest;
    const futureSavings = FV(currentSavings, assetRate, yearsToRetire);

    // 4. Thiếu hụt
    const shortfall = Math.max(0, totalFundNeeded - futureSavings);

    // 5. Monthly Saving Needed (PMT for Future Value Annuity Due)
    let monthlySavingNeeded = 0;
    if (shortfall > 0 && yearsToRetire > 0) {
        const rateMonthly = safeInvest / 12;
        const nMonths = yearsToRetire * 12;
        
        if (rateMonthly === 0) {
            monthlySavingNeeded = shortfall / nMonths;
        } else {
            // FV = PMT * [((1+r)^n - 1)/r] * (1+r)
            const factor = ( (Math.pow(1 + rateMonthly, nMonths) - 1) / rateMonthly ) * (1 + rateMonthly);
            monthlySavingNeeded = shortfall / factor;
        }
    }

    return {
        goal: FinancialGoal.RETIREMENT,
        requiredAmount: Math.round(totalFundNeeded),
        currentAmount: Math.round(futureSavings),
        shortfall: Math.round(shortfall),
        monthlySavingNeeded: Math.round(monthlySavingNeeded),
        details: {
            yearsToRetire,
            yearsInRetirement,
            inflationRate: safeInflation,
            futureMonthlyExpense,
            estimatedPension: futureMonthlyPension, 
            netMonthlyNeeded,
            futureAnnualExpense: netAnnualNeed,
            realRate: realRate * 100,
            futureSavings // Return for debug/display
        }
    };
};

export const calculateProtection = (
    monthlyIncome: number,
    supportYears: number, 
    existingCover: number, 
    loans: number,
    emergencyFund: number = 0 
): PlanResult => {
    // 1. Quỹ thay thế thu nhập (Income Replacement)
    const incomeProtectionNeeded = monthlyIncome * 12 * supportYears;
    
    // 2. Quỹ trả nợ (Debt Coverage)
    const debtCoverage = loans;

    // 3. Quỹ khẩn cấp (Emergency Fund - usually 6 months expense, optional input)
    const emergencyNeeded = emergencyFund;

    // Total
    const totalNeeded = incomeProtectionNeeded + debtCoverage + emergencyNeeded;
    
    // Shortfall
    const shortfall = Math.max(0, totalNeeded - existingCover);

    return {
        goal: FinancialGoal.PROTECTION,
        requiredAmount: totalNeeded,
        currentAmount: existingCover,
        shortfall: shortfall,
        monthlySavingNeeded: 0, 
        details: {
            incomeProtectionNeeded,
            debtCoverage,
            supportYears,
            monthlyIncome
        }
    };
};

export const calculateEducation = (
    childAge: number,
    uniStartAge: number, 
    uniDuration: number, 
    currentAnnualTuition: number, 
    inflationRate: number, 
    investmentRate: number,
    currentSavings: number
): PlanResult => {
    const yearsToUni = Math.max(0, uniStartAge - childAge);
    const safeInflation = isNaN(inflationRate) ? 0 : inflationRate;
    const safeInvest = isNaN(investmentRate) ? 0 : investmentRate;
    
    // 1. Học phí năm đầu tiên (FV)
    const futureTuitionFirstYear = FV(currentAnnualTuition, safeInflation, yearsToUni);

    // 2. Tổng quỹ 4 năm (PV Annuity với Real Rate)
    // Giả định trong 4 năm học, học phí tăng nhưng tiền trong quỹ cũng sinh lời
    const realRate = ((1 + safeInvest) / (1 + safeInflation)) - 1;
    const totalFundNeeded = PV_Annuity(futureTuitionFirstYear, realRate, uniDuration);

    // 3. Tích lũy hiện có (FV)
    const futureSavings = FV(currentSavings, safeInvest, yearsToUni);

    const shortfall = Math.max(0, totalFundNeeded - futureSavings);

    // 4. Monthly Saving
    let monthlySavingNeeded = 0;
    if (shortfall > 0 && yearsToUni > 0) {
        const rateMonthly = safeInvest / 12;
        const nMonths = yearsToUni * 12;
        
        if (rateMonthly === 0) {
            monthlySavingNeeded = shortfall / nMonths;
        } else {
             const factor = ( (Math.pow(1 + rateMonthly, nMonths) - 1) / rateMonthly ) * (1 + rateMonthly);
             monthlySavingNeeded = shortfall / factor;
        }
    } else if (shortfall > 0 && yearsToUni === 0) {
        monthlySavingNeeded = shortfall; // Cần ngay lập tức
    }

    return {
        goal: FinancialGoal.EDUCATION,
        requiredAmount: Math.round(totalFundNeeded),
        currentAmount: Math.round(futureSavings),
        shortfall: Math.round(shortfall),
        monthlySavingNeeded: Math.round(monthlySavingNeeded),
        details: {
            yearsToUni,
            futureTuitionFirstYear,
            uniDuration,
            realRate: realRate * 100, // Export for UI
            totalFundNeeded // Export for UI
        }
    };
};

export const calculateHealthFund = (
    treatmentCost: number, // Chi phí điều trị dự kiến (VNĐ)
    recoveryYears: number, // Số năm cần nghỉ ngơi (mất thu nhập)
    monthlyIncome: number, // Thu nhập tháng bị mất
    existingHealthCover: number // Bảo hiểm bệnh hiểm nghèo đã có
): PlanResult => {
    // 1. Chi phí y tế trực tiếp
    const medicalCost = treatmentCost;

    // 2. Chi phí sinh hoạt (Mất thu nhập)
    const incomeLoss = monthlyIncome * 12 * recoveryYears;

    const totalNeeded = medicalCost + incomeLoss;
    const shortfall = Math.max(0, totalNeeded - existingHealthCover);

    return {
        goal: FinancialGoal.HEALTH,
        requiredAmount: totalNeeded,
        currentAmount: existingHealthCover,
        shortfall: shortfall,
        monthlySavingNeeded: 0,
        details: {
            medicalCost,
            incomeLoss,
            recoveryYears
        }
    };
};

export const calculateLegacyFund = (
    numberOfHeirs: number,
    amountPerHeir: number,
    currentAssets: number
): PlanResult => {
    const totalLegacyNeeded = numberOfHeirs * amountPerHeir;
    const shortfall = Math.max(0, totalLegacyNeeded - currentAssets);

    return {
        goal: FinancialGoal.PROTECTION, // Reusing enum or add LEGACY
        requiredAmount: totalLegacyNeeded,
        currentAmount: currentAssets,
        shortfall: shortfall,
        monthlySavingNeeded: 0,
        details: {
            numberOfHeirs,
            amountPerHeir
        }
    };
};
