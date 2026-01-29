
import { Customer, CustomerStatus, Product, ProductType, ProductStatus, Contract, ContractStatus, Appointment, AppointmentType, AppointmentStatus, PaymentFrequency, Gender, FinancialStatus, PersonalityType, ReadinessLevel, ProductCalculationType, IncomeTrend, RiskTolerance, FinancialPriority, MaritalStatus, FinancialRole, InteractionType, ClaimStatus } from './types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'PRU-Cuộc Sống Bình An',
    code: 'P-CSBA',
    type: ProductType.MAIN,
    status: ProductStatus.ACTIVE,
    calculationType: ProductCalculationType.RATE_PER_1000_AGE_GENDER,
    description: 'Bảo vệ tài chính trọn đời trước rủi ro tử vong và thương tật.',
    rulesAndTerms: 'Độ tuổi tham gia từ 15 đến 60 tuổi. Tỷ lệ phí phụ thuộc vào tuổi và giới tính.',
    pdfUrl: ''
  },
  {
    id: 'p2',
    name: 'PRU-Tương Lai Tươi Sáng',
    code: 'P-TLTS',
    type: ProductType.MAIN,
    status: ProductStatus.ACTIVE,
    calculationType: ProductCalculationType.RATE_PER_1000_TERM,
    description: 'Giải pháp tích lũy giáo dục đảm bảo cho tương lai con trẻ.',
    rulesAndTerms: 'Thời hạn đóng phí linh hoạt từ 8 đến 18 năm. Tỷ lệ phí thay đổi theo thời hạn đóng phí.',
    pdfUrl: ''
  },
  {
    id: 'p3',
    name: 'PRU-Đầu Tư Vững Tiến',
    code: 'P-DTVT',
    type: ProductType.MAIN,
    status: ProductStatus.ACTIVE,
    calculationType: ProductCalculationType.RATE_PER_1000_AGE_GENDER,
    description: 'Kết hợp bảo vệ và đầu tư an toàn với lãi suất cam kết.',
    rulesAndTerms: 'Phí bảo hiểm tính theo tỷ lệ phần nghìn dựa trên tuổi và giới tính.',
    pdfUrl: ''
  },
  {
    id: 'p4',
    name: 'PRU-Bảo Vệ Tối Đa',
    code: 'P-BVTD',
    type: ProductType.MAIN,
    status: ProductStatus.ACTIVE,
    calculationType: ProductCalculationType.RATE_PER_1000_AGE_GENDER,
    description: 'Giải pháp bảo vệ toàn diện với quyền lợi bảo vệ cao trước rủi ro.',
    rulesAndTerms: 'Phí bảo hiểm tính theo tỷ lệ phần nghìn dựa trên tuổi và giới tính.',
    pdfUrl: ''
  },
  {
    id: 'p5',
    name: 'PRU-Đầu Tư Linh Hoạt',
    code: 'P-DTLH',
    type: ProductType.MAIN,
    status: ProductStatus.ACTIVE,
    calculationType: ProductCalculationType.RATE_PER_1000_AGE_GENDER,
    description: 'Giải pháp đầu tư linh hoạt, nắm bắt cơ hội tăng trưởng tài sản.',
    rulesAndTerms: 'Phí bảo hiểm tính theo tỷ lệ phần nghìn dựa trên tuổi và giới tính.',
    pdfUrl: ''
  },
  {
    id: 'r1',
    name: 'Bảo hiểm Chăm sóc Sức khỏe Toàn diện',
    code: 'R-HC-01',
    type: ProductType.RIDER,
    status: ProductStatus.ACTIVE,
    calculationType: ProductCalculationType.HEALTH_CARE,
    description: 'Chi trả chi phí y tế nội trú và ngoại trú.',
    rulesAndTerms: 'Thẻ sức khỏe có 4 chương trình: Cơ bản, Nâng cao, Toàn diện, Hoàn hảo.',
    pdfUrl: ''
  },
  {
    id: 'r2',
    name: 'BH Bệnh lý Nghiêm trọng',
    code: 'R-CI-01',
    type: ProductType.RIDER,
    status: ProductStatus.ACTIVE,
    calculationType: ProductCalculationType.RATE_PER_1000_TERM,
    description: 'Bảo vệ trước 77 bệnh lý nghiêm trọng.',
    rulesAndTerms: 'Phí bảo hiểm tính theo tỷ lệ phần nghìn dựa trên tuổi và thời hạn đóng phí (5-30 năm).',
    pdfUrl: ''
  },
  {
    id: 'r3',
    name: 'Bảo hiểm Tai nạn',
    code: 'R-ACC',
    type: ProductType.RIDER,
    status: ProductStatus.ACTIVE,
    calculationType: ProductCalculationType.RATE_PER_1000_OCCUPATION,
    description: 'Bảo vệ trước rủi ro tai nạn 24/7.',
    rulesAndTerms: 'Tỷ lệ phí phụ thuộc vào nhóm nghề nghiệp (1-4). Nhóm 1: Văn phòng, Nhóm 4: Lao động nặng/nguy hiểm.',
    pdfUrl: ''
  },
  {
    id: 'op1',
    name: 'Quy trình Giải quyết Quyền lợi Bảo hiểm (Claim)',
    code: 'OP-CLAIM',
    type: ProductType.OPERATION,
    status: ProductStatus.ACTIVE,
    description: 'Hướng dẫn nộp hồ sơ và thời gian xử lý bồi thường.',
    rulesAndTerms: '1. Thời hạn nộp hồ sơ: Trong vòng 12 tháng...',
    pdfUrl: ''
  },
  {
    id: 'op2',
    name: 'Thời gian cân nhắc 21 ngày',
    code: 'OP-FREELOOK',
    type: ProductType.OPERATION,
    status: ProductStatus.ACTIVE,
    description: 'Quyền lợi dùng thử sản phẩm của khách hàng.',
    rulesAndTerms: 'Khách hàng có 21 ngày cân nhắc kể từ ngày nhận bộ hợp đồng.',
    pdfUrl: ''
  }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    fullName: 'Nguyễn Thị Thanh',
    gender: Gender.FEMALE,
    dob: '1985-05-20',
    phone: '0909123456',
    idCard: '079185000123',
    job: 'Kế toán trưởng',
    occupation: 'Kế toán trưởng',
    companyAddress: 'Vincom Center, Q1, TP.HCM',
    maritalStatus: MaritalStatus.MARRIED,
    financialRole: FinancialRole.SHARED_BREADWINNER,
    dependents: 2,
    health: {
      medicalHistory: 'Đã mổ ruột thừa năm 2010',
      height: 160,
      weight: 55,
      habits: 'Không hút thuốc, uống rượu xã giao'
    },
    analysis: {
      childrenCount: 2,
      incomeEstimate: '30-40 triệu/tháng',
      financialStatus: FinancialStatus.STABLE,
      insuranceKnowledge: 'Hiểu biết cơ bản',
      previousExperience: 'Tích cực',
      keyConcerns: 'Sức khỏe, Tích lũy cho con',
      personality: PersonalityType.ANALYTICAL,
      readiness: ReadinessLevel.HOT,
      // Defaults for new fields
      incomeMonthly: 35000000,
      incomeTrend: IncomeTrend.STABLE,
      projectedIncome3Years: 40000000,
      monthlyExpenses: 20000000,
      existingInsurance: {
        hasLife: false, lifeSumAssured: 0, lifeFee: 0, lifeTermRemaining: 0,
        hasAccident: false, accidentSumAssured: 0,
        hasCI: false, ciSumAssured: 0,
        hasHealthCare: false, healthCareFee: 0,
        dissatisfaction: ''
      },
      currentPriority: FinancialPriority.PROTECTION,
      futurePlans: 'Tích lũy cho con du học',
      biggestWorry: 'Rủi ro bệnh hiểm nghèo',
      pastExperience: 'Đã tham gia BHXH',
      influencer: 'Chồng',
      buyCondition: 'Phí hợp lý, quyền lợi rõ ràng',
      preference: 'Balanced',
      riskTolerance: RiskTolerance.MEDIUM
    },
    interactionHistory: ['2023-01-10: Tư vấn lần đầu', '2023-01-15: Ký hợp đồng'],
    timeline: [
        { id: 't1', date: '2023-01-15T10:00:00', type: InteractionType.CONTRACT, title: 'Ký hợp đồng', content: 'Khách hàng đã ký HĐ 78900123', result: 'Thành công' },
        { id: 't2', date: '2023-01-10T09:00:00', type: InteractionType.MEETING, title: 'Tư vấn lần đầu', content: 'Gặp tại cafe Highland, tư vấn giải pháp hưu trí', result: 'Khách quan tâm' }
    ],
    claims: [],
    assets: [],
    liabilities: [],
    status: CustomerStatus.SIGNED
  },
  {
    id: 'c2',
    fullName: 'Trần Văn Ba',
    gender: Gender.MALE,
    dob: '1990-11-12',
    phone: '0912345678',
    idCard: '079190000456',
    job: 'Kỹ sư phần mềm',
    occupation: 'Kỹ sư phần mềm',
    companyAddress: 'Etown, Tân Bình',
    maritalStatus: MaritalStatus.SINGLE,
    financialRole: FinancialRole.INDEPENDENT,
    dependents: 0,
    health: {
      medicalHistory: 'Khỏe mạnh',
      height: 175,
      weight: 70,
      habits: 'Hay thức khuya'
    },
    analysis: {
      childrenCount: 0,
      incomeEstimate: '25 triệu/tháng',
      financialStatus: FinancialStatus.JUST_ENOUGH,
      insuranceKnowledge: 'Chưa biết nhiều',
      previousExperience: 'Chưa từng tham gia',
      keyConcerns: 'Bệnh hiểm nghèo, Tai nạn',
      personality: PersonalityType.ANALYTICAL,
      readiness: ReadinessLevel.WARM,
      // Defaults for new fields
      incomeMonthly: 25000000,
      incomeTrend: IncomeTrend.INCREASING,
      projectedIncome3Years: 35000000,
      monthlyExpenses: 15000000,
      existingInsurance: {
        hasLife: false, lifeSumAssured: 0, lifeFee: 0, lifeTermRemaining: 0,
        hasAccident: false, accidentSumAssured: 0,
        hasCI: false, ciSumAssured: 0,
        hasHealthCare: false, healthCareFee: 0,
        dissatisfaction: ''
      },
      currentPriority: FinancialPriority.ACCUMULATION,
      futurePlans: 'Mua nhà, Lập gia đình',
      biggestWorry: 'Tai nạn xe máy',
      pastExperience: 'Chưa có',
      influencer: 'Bản thân',
      buyCondition: 'Sản phẩm đầu tư sinh lời',
      preference: 'Cashflow',
      riskTolerance: RiskTolerance.HIGH
    },
    interactionHistory: ['2023-05-20: Gặp cafe giới thiệu sản phẩm'],
    timeline: [
        { id: 't3', date: '2023-05-20T14:30:00', type: InteractionType.MEETING, title: 'Giới thiệu sản phẩm', content: 'Giới thiệu dòng Đầu tư linh hoạt', result: 'Cần suy nghĩ thêm' }
    ],
    claims: [],
    assets: [],
    liabilities: [],
    status: CustomerStatus.ADVISING
  },
  {
    id: 'c3',
    fullName: 'Lê Thu Hà',
    gender: Gender.FEMALE,
    dob: '2000-08-15',
    phone: '0933456789',
    idCard: '079200000789',
    job: 'Marketing Executive',
    occupation: 'Marketing Executive',
    companyAddress: 'Quận 3, TP.HCM',
    maritalStatus: MaritalStatus.SINGLE,
    financialRole: FinancialRole.INDEPENDENT,
    dependents: 0,
    health: { medicalHistory: 'Khỏe mạnh', height: 158, weight: 48, habits: 'Thích du lịch' },
    analysis: {
      childrenCount: 0, incomeMonthly: 15000000, incomeTrend: IncomeTrend.STABLE, projectedIncome3Years: 20000000, monthlyExpenses: 10000000,
      existingInsurance: { hasLife: false, lifeSumAssured: 0, lifeFee: 0, lifeTermRemaining: 0, hasAccident: false, accidentSumAssured: 0, hasCI: false, ciSumAssured: 0, hasHealthCare: true, healthCareFee: 2000000, dissatisfaction: '' },
      currentPriority: FinancialPriority.ACCUMULATION, futurePlans: 'Du học thạc sĩ', biggestWorry: 'Không có tiền tiết kiệm', pastExperience: 'Đã có thẻ sức khỏe cty', influencer: 'Mẹ', buyCondition: 'Tích lũy linh hoạt', preference: 'Cashflow', riskTolerance: RiskTolerance.MEDIUM,
      financialStatus: FinancialStatus.JUST_ENOUGH, personality: PersonalityType.EMOTIONAL, readiness: ReadinessLevel.WARM
    },
    interactionHistory: [], timeline: [], claims: [], assets: [], liabilities: [], status: CustomerStatus.POTENTIAL
  },
  {
    id: 'c4',
    fullName: 'Phạm Quang Huy (VIP)',
    gender: Gender.MALE,
    dob: '1978-03-10',
    phone: '0918888999',
    idCard: '079178000999',
    job: 'Giám đốc Doanh nghiệp',
    occupation: 'Chủ doanh nghiệp',
    companyAddress: 'KCN Tân Bình, TP.HCM',
    maritalStatus: MaritalStatus.MARRIED,
    financialRole: FinancialRole.MAIN_BREADWINNER,
    dependents: 3,
    health: { medicalHistory: 'Mỡ máu nhẹ', height: 172, weight: 78, habits: 'Hút thuốc, hay đi nhậu' },
    analysis: {
      childrenCount: 3, incomeMonthly: 150000000, incomeTrend: IncomeTrend.STABLE, projectedIncome3Years: 200000000, monthlyExpenses: 80000000,
      existingInsurance: { hasLife: true, lifeSumAssured: 5000000000, lifeFee: 100000000, lifeTermRemaining: 10, hasAccident: true, accidentSumAssured: 2000000000, hasCI: false, ciSumAssured: 0, hasHealthCare: true, healthCareFee: 0, dissatisfaction: 'Chưa có bảo vệ bệnh lý nghiêm trọng' },
      currentPriority: FinancialPriority.PROTECTION, futurePlans: 'Chuyển giao tài sản', biggestWorry: 'Bệnh tật ảnh hưởng kinh doanh', pastExperience: 'Đã tham gia nhiều nơi', influencer: 'Vợ', buyCondition: 'Sản phẩm cao cấp, dịch vụ VIP', preference: 'Protection', riskTolerance: RiskTolerance.LOW,
      financialStatus: FinancialStatus.WEALTHY, personality: PersonalityType.DECISIVE, readiness: ReadinessLevel.HOT
    },
    interactionHistory: [], timeline: [], claims: [], assets: [], liabilities: [], status: CustomerStatus.SIGNED
  },
  {
    id: 'c5',
    fullName: 'Hoàng Thị Mai',
    gender: Gender.FEMALE,
    dob: '1992-12-05',
    phone: '0977111222',
    idCard: '079192000111',
    job: 'Giáo viên',
    occupation: 'Giáo viên',
    companyAddress: 'Trường THPT Nguyễn Thượng Hiền',
    maritalStatus: MaritalStatus.MARRIED,
    financialRole: FinancialRole.SHARED_BREADWINNER,
    dependents: 1,
    health: { medicalHistory: 'Viêm xoang', height: 162, weight: 52, habits: 'Lành mạnh' },
    analysis: {
      childrenCount: 1, incomeMonthly: 12000000, incomeTrend: IncomeTrend.STABLE, projectedIncome3Years: 15000000, monthlyExpenses: 8000000,
      existingInsurance: { hasLife: false, lifeSumAssured: 0, lifeFee: 0, lifeTermRemaining: 0, hasAccident: false, accidentSumAssured: 0, hasCI: false, ciSumAssured: 0, hasHealthCare: false, healthCareFee: 0, dissatisfaction: '' },
      currentPriority: FinancialPriority.ACCUMULATION, futurePlans: 'Quỹ học vấn cho con', biggestWorry: 'Con ốm đau', pastExperience: 'Chưa có', influencer: 'Đồng nghiệp', buyCondition: 'Phí rẻ, quyền lợi y tế tốt', preference: 'Balanced', riskTolerance: RiskTolerance.LOW,
      financialStatus: FinancialStatus.JUST_ENOUGH, personality: PersonalityType.CAUTIOUS, readiness: ReadinessLevel.WARM
    },
    interactionHistory: [], timeline: [], claims: [], assets: [], liabilities: [], status: CustomerStatus.ADVISING
  },
  {
    id: 'c6',
    fullName: 'Ngô Văn Minh',
    gender: Gender.MALE,
    dob: '1962-09-20',
    phone: '0903333444',
    idCard: '079162000333',
    job: 'Hưu trí',
    occupation: 'Cán bộ hưu trí',
    companyAddress: 'Tại nhà',
    maritalStatus: MaritalStatus.MARRIED,
    financialRole: FinancialRole.DEPENDENT,
    dependents: 0,
    health: { medicalHistory: 'Cao huyết áp', height: 168, weight: 65, habits: 'Tập dưỡng sinh' },
    analysis: {
      childrenCount: 0, incomeMonthly: 8000000, incomeTrend: IncomeTrend.STABLE, projectedIncome3Years: 8000000, monthlyExpenses: 5000000,
      existingInsurance: { hasLife: false, lifeSumAssured: 0, lifeFee: 0, lifeTermRemaining: 0, hasAccident: false, accidentSumAssured: 0, hasCI: false, ciSumAssured: 0, hasHealthCare: true, healthCareFee: 0, dissatisfaction: 'BHYT chờ lâu' },
      currentPriority: FinancialPriority.PROTECTION, futurePlans: 'An hưởng tuổi già', biggestWorry: 'Gánh nặng y tế cho con', pastExperience: 'Chưa có BHNT', influencer: 'Con cái', buyCondition: 'Được bảo vệ ở tuổi già', preference: 'Protection', riskTolerance: RiskTolerance.LOW,
      financialStatus: FinancialStatus.JUST_ENOUGH, personality: PersonalityType.EMOTIONAL, readiness: ReadinessLevel.COLD
    },
    interactionHistory: [], timeline: [], claims: [], assets: [], liabilities: [], status: CustomerStatus.POTENTIAL
  },
  {
    id: 'c7',
    fullName: 'Đặng Tuấn Kiệt',
    gender: Gender.MALE,
    dob: '1997-04-30',
    phone: '0966555666',
    idCard: '079197000555',
    job: 'Freelancer IT',
    occupation: 'Lập trình viên',
    companyAddress: 'Làm việc tự do',
    maritalStatus: MaritalStatus.SINGLE,
    financialRole: FinancialRole.INDEPENDENT,
    dependents: 0,
    health: { medicalHistory: 'Đau dạ dày', height: 178, weight: 72, habits: 'Thức khuya, uống cafe' },
    analysis: {
      childrenCount: 0, incomeMonthly: 35000000, incomeTrend: IncomeTrend.FLUCTUATING, projectedIncome3Years: 50000000, monthlyExpenses: 15000000,
      existingInsurance: { hasLife: false, lifeSumAssured: 0, lifeFee: 0, lifeTermRemaining: 0, hasAccident: false, accidentSumAssured: 0, hasCI: false, ciSumAssured: 0, hasHealthCare: false, healthCareFee: 0, dissatisfaction: '' },
      currentPriority: FinancialPriority.INVESTMENT, futurePlans: 'Khởi nghiệp', biggestWorry: 'Thu nhập không ổn định', pastExperience: 'Thấy bạn bè mua nhiều', influencer: 'Bạn bè', buyCondition: 'Lãi suất đầu tư cao', preference: 'Cashflow', riskTolerance: RiskTolerance.HIGH,
      financialStatus: FinancialStatus.STABLE, personality: PersonalityType.ANALYTICAL, readiness: ReadinessLevel.WARM
    },
    interactionHistory: [], timeline: [], claims: [], assets: [], liabilities: [], status: CustomerStatus.ADVISING
  },
  {
    id: 'c8',
    fullName: 'Vũ Thị Lan',
    gender: Gender.FEMALE,
    dob: '1986-02-14',
    phone: '0988777888',
    idCard: '079186000777',
    job: 'Kinh doanh Shop',
    occupation: 'Tiểu thương',
    companyAddress: 'Chợ Bến Thành',
    maritalStatus: MaritalStatus.DIVORCED,
    financialRole: FinancialRole.MAIN_BREADWINNER,
    dependents: 1,
    health: { medicalHistory: 'Khỏe mạnh', height: 155, weight: 50, habits: 'Bận rộn' },
    analysis: {
      childrenCount: 1, incomeMonthly: 25000000, incomeTrend: IncomeTrend.STABLE, projectedIncome3Years: 30000000, monthlyExpenses: 18000000,
      existingInsurance: { hasLife: true, lifeSumAssured: 1000000000, lifeFee: 15000000, lifeTermRemaining: 12, hasAccident: false, accidentSumAssured: 0, hasCI: false, ciSumAssured: 0, hasHealthCare: true, healthCareFee: 3000000, dissatisfaction: '' },
      currentPriority: FinancialPriority.PROTECTION, futurePlans: 'Mua nhà cho con', biggestWorry: 'Rủi ro tai nạn khi đi lấy hàng', pastExperience: 'Tốt', influencer: 'Bản thân', buyCondition: 'Bảo vệ tai nạn cao', preference: 'Protection', riskTolerance: RiskTolerance.MEDIUM,
      financialStatus: FinancialStatus.STABLE, personality: PersonalityType.DECISIVE, readiness: ReadinessLevel.HOT
    },
    interactionHistory: [], timeline: [], claims: [], assets: [], liabilities: [], status: CustomerStatus.SIGNED
  },
  {
    id: 'c9',
    fullName: 'Trần Đức Thắng',
    gender: Gender.MALE,
    dob: '1989-11-20',
    phone: '0912222333',
    idCard: '079189000222',
    job: 'Kỹ sư xây dựng',
    occupation: 'Kỹ sư công trình',
    companyAddress: 'Công ty Xây dựng Hòa Bình',
    maritalStatus: MaritalStatus.MARRIED,
    financialRole: FinancialRole.MAIN_BREADWINNER,
    dependents: 2,
    health: { medicalHistory: 'Đau lưng', height: 170, weight: 68, habits: 'Hút thuốc' },
    analysis: {
      childrenCount: 2, incomeMonthly: 22000000, incomeTrend: IncomeTrend.STABLE, projectedIncome3Years: 28000000, monthlyExpenses: 18000000,
      existingInsurance: { hasLife: false, lifeSumAssured: 0, lifeFee: 0, lifeTermRemaining: 0, hasAccident: true, accidentSumAssured: 100000000, hasCI: false, ciSumAssured: 0, hasHealthCare: false, healthCareFee: 0, dissatisfaction: 'Mức bảo vệ thấp' },
      currentPriority: FinancialPriority.PROTECTION, futurePlans: 'Lo cho 2 con ăn học', biggestWorry: 'Tai nạn nghề nghiệp', pastExperience: 'Đã mua BH tai nạn 100k', influencer: 'Vợ', buyCondition: 'Phí vừa phải, bảo vệ tai nạn cao', preference: 'Protection', riskTolerance: RiskTolerance.MEDIUM,
      financialStatus: FinancialStatus.JUST_ENOUGH, personality: PersonalityType.CAUTIOUS, readiness: ReadinessLevel.WARM
    },
    interactionHistory: [], timeline: [], claims: [], assets: [], liabilities: [], status: CustomerStatus.ADVISING
  },
  {
    id: 'c10',
    fullName: 'Nguyễn Ngọc Ánh',
    gender: Gender.FEMALE,
    dob: '1995-07-07',
    phone: '0905555444',
    idCard: '079195000555',
    job: 'Nhân viên Ngân hàng',
    occupation: 'Giao dịch viên',
    companyAddress: 'Vietcombank',
    maritalStatus: MaritalStatus.SINGLE,
    financialRole: FinancialRole.INDEPENDENT,
    dependents: 0,
    health: { medicalHistory: 'Cận thị', height: 160, weight: 49, habits: 'Ít vận động' },
    analysis: {
      childrenCount: 0, incomeMonthly: 18000000, incomeTrend: IncomeTrend.INCREASING, projectedIncome3Years: 25000000, monthlyExpenses: 10000000,
      existingInsurance: { hasLife: true, lifeSumAssured: 0, lifeFee: 0, lifeTermRemaining: 0, hasAccident: false, accidentSumAssured: 0, hasCI: false, ciSumAssured: 0, hasHealthCare: false, healthCareFee: 0, dissatisfaction: 'Bảo hiểm qua ngân hàng (Bancassurance)' },
      currentPriority: FinancialPriority.INVESTMENT, futurePlans: 'Đầu tư sinh lời', biggestWorry: 'Tiền mất giá', pastExperience: 'Bị ép mua BH khi vay vốn', influencer: 'Bản thân', buyCondition: 'Lãi suất tốt hơn ngân hàng', preference: 'Cashflow', riskTolerance: RiskTolerance.HIGH,
      financialStatus: FinancialStatus.STABLE, personality: PersonalityType.ANALYTICAL, readiness: ReadinessLevel.COLD
    },
    interactionHistory: [], timeline: [], claims: [], assets: [], liabilities: [], status: CustomerStatus.POTENTIAL
  },
  {
    id: 'c11',
    fullName: 'Bùi Văn Hùng',
    gender: Gender.MALE,
    dob: '1984-01-15',
    phone: '0938888777',
    idCard: '079184000888',
    job: 'Tài xế công nghệ',
    occupation: 'Tài xế',
    companyAddress: 'Grab',
    maritalStatus: MaritalStatus.MARRIED,
    financialRole: FinancialRole.MAIN_BREADWINNER,
    dependents: 3,
    health: { medicalHistory: 'Đau xương khớp', height: 165, weight: 70, habits: 'Ngồi nhiều' },
    analysis: {
      childrenCount: 3, incomeMonthly: 15000000, incomeTrend: IncomeTrend.FLUCTUATING, projectedIncome3Years: 15000000, monthlyExpenses: 14000000,
      existingInsurance: { hasLife: false, lifeSumAssured: 0, lifeFee: 0, lifeTermRemaining: 0, hasAccident: false, accidentSumAssured: 0, hasCI: false, ciSumAssured: 0, hasHealthCare: false, healthCareFee: 0, dissatisfaction: '' },
      currentPriority: FinancialPriority.PROTECTION, futurePlans: 'Đủ ăn đủ mặc', biggestWorry: 'Tai nạn xe cộ, ốm đau không đi làm được', pastExperience: 'Chưa có', influencer: 'Vợ', buyCondition: 'Phí rẻ nhất có thể', preference: 'Protection', riskTolerance: RiskTolerance.LOW,
      financialStatus: FinancialStatus.STRUGGLING, personality: PersonalityType.EMOTIONAL, readiness: ReadinessLevel.COLD
    },
    interactionHistory: [], timeline: [], claims: [], assets: [], liabilities: [], status: CustomerStatus.POTENTIAL
  },
  {
    id: 'c12',
    fullName: 'Đỗ Mỹ Linh',
    gender: Gender.FEMALE,
    dob: '1991-06-01',
    phone: '0944333222',
    idCard: '079191000333',
    job: 'Trưởng phòng Nhân sự',
    occupation: 'HR Manager',
    companyAddress: 'KCN Vsip 1',
    maritalStatus: MaritalStatus.MARRIED,
    financialRole: FinancialRole.SHARED_BREADWINNER,
    dependents: 1,
    health: { medicalHistory: 'Sắp sinh bé thứ 2', height: 158, weight: 55, habits: 'Lành mạnh' },
    analysis: {
      childrenCount: 1, incomeMonthly: 35000000, incomeTrend: IncomeTrend.INCREASING, projectedIncome3Years: 45000000, monthlyExpenses: 25000000,
      existingInsurance: { hasLife: true, lifeSumAssured: 2000000000, lifeFee: 30000000, lifeTermRemaining: 15, hasAccident: false, accidentSumAssured: 0, hasCI: true, ciSumAssured: 500000000, hasHealthCare: true, healthCareFee: 5000000, dissatisfaction: '' },
      currentPriority: FinancialPriority.PROTECTION, futurePlans: 'Thai sản & Sức khỏe cho bé', biggestWorry: 'Chi phí sinh nở', pastExperience: 'Rất tốt', influencer: 'Bản thân', buyCondition: 'Có quyền lợi thai sản', preference: 'Balanced', riskTolerance: RiskTolerance.MEDIUM,
      financialStatus: FinancialStatus.STABLE, personality: PersonalityType.ANALYTICAL, readiness: ReadinessLevel.HOT
    },
    interactionHistory: [], timeline: [], claims: [], assets: [], liabilities: [], status: CustomerStatus.SIGNED
  }
];

export const INITIAL_CONTRACTS: Contract[] = [
  {
    id: 'ct1',
    contractNumber: '78900123',
    customerId: 'c1',
    effectiveDate: '2023-02-01',
    nextPaymentDate: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString().split('T')[0], 
    status: ContractStatus.ACTIVE,
    paymentFrequency: PaymentFrequency.ANNUAL,
    mainProduct: {
      productId: 'p1',
      productName: 'PRU-Cuộc Sống Bình An',
      insuredName: 'Nguyễn Thị Thanh',
      fee: 20000000,
      sumAssured: 1000000000
    },
    riders: [
      {
        productId: 'r1',
        productName: 'Bảo hiểm Chăm sóc Sức khỏe Toàn diện',
        insuredName: 'Nguyễn Thị Thanh',
        fee: 5000000,
        sumAssured: 500000000,
        attributes: { plan: 'Toàn diện', package: 'Chuẩn' }
      }
    ],
    totalFee: 25000000
  },
  // Add Contract for VIP Customer (c4)
  {
    id: 'ct2',
    contractNumber: '999888777',
    customerId: 'c4',
    effectiveDate: '2022-06-15',
    nextPaymentDate: '2024-06-15',
    status: ContractStatus.ACTIVE,
    paymentFrequency: PaymentFrequency.ANNUAL,
    mainProduct: {
      productId: 'p3',
      productName: 'PRU-Đầu Tư Vững Tiến',
      insuredName: 'Phạm Quang Huy',
      fee: 100000000,
      sumAssured: 5000000000
    },
    riders: [],
    totalFee: 100000000
  }
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'a1',
    customerId: 'c2',
    customerName: 'Trần Văn Ba',
    date: new Date().toISOString().split('T')[0], 
    time: '14:00',
    type: AppointmentType.CONSULTATION,
    status: AppointmentStatus.UPCOMING,
    note: 'Tư vấn giải pháp hưu trí'
  },
  {
    id: 'a2',
    customerId: 'c1',
    customerName: 'Nguyễn Thị Thanh',
    date: '2024-02-01',
    time: '09:00',
    type: AppointmentType.FEE_REMINDER,
    status: AppointmentStatus.UPCOMING,
    note: 'Nhắc đóng phí tái tục năm 2'
  },
  {
    id: 'a3',
    customerId: 'c4',
    customerName: 'Phạm Quang Huy',
    date: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString().split('T')[0],
    time: '10:00',
    type: AppointmentType.CARE_CALL,
    status: AppointmentStatus.UPCOMING,
    note: 'Tặng quà sinh nhật VIP'
  }
];
