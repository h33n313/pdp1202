
import { User, UserRole, JobCategory, JobCategoryConfig, PDPForm, PDPStatus, WardType } from './types';

// --- VERSION CONTROL ---
export const APP_VERSION = "6";

// --- LOGIC & MAPPING ---

export const JOB_TITLES = [
  'سوپروایزر',
  'سرپرستار',
  'پرستار',
  'ماما',
  'کارشناس اتاق عمل',
  'هوشبری',
  'کمک پرستار',
  'منشی',
  'اداری',
  'پشتیبانی',
  'سایر'
];

export const EDUCATION_OPTIONS = [
  'دیپلم',
  'کاردانی',
  'کارشناسی',
  'کارشناسی ارشد',
  'دکتری'
];

export const CLINICAL_WARDS = [
  'داخلی',
  'اطفال',
  'ICU S',
  'NICU',
  'OH ICU',
  'ICU ER',
  'IVF',
  'CSSD',
  'اتاق عمل جنرال',
  'آنژیوگرافی',
  'بلوک زایمان',
  'اورژانس'
];

export const WARD_OPTIONS = [
  ...CLINICAL_WARDS,
  'کلینیک قلب',
  'کلینیک گوارش',
  'کلینیک جنرال',
  'فیزیوتراپی',
  'رادیولوژی',
  'دفتر پرستاری',
  'سایر'
];

export const FLOOR_OPTIONS = [
  'منفی دو',
  'منفی یک',
  'همکف',
  'اول',
  'دوم',
  'سوم',
  'چهارم'
];

export const getFloorByWard = (ward: string): string => {
  if (['آنژیوگرافی', 'بلوک زایمان'].includes(ward)) return 'منفی دو';
  if (['اتاق عمل جنرال', 'CSSD'].includes(ward)) return 'منفی یک';
  if (['اورژانس', 'رادیولوژی', 'فیزیوتراپی'].includes(ward)) return 'همکف';
  if (['داخلی', 'اطفال'].includes(ward)) return 'اول';
  if (['ICU S', 'NICU'].includes(ward)) return 'دوم';
  if (['OH ICU', 'ICU ER'].includes(ward)) return 'سوم';
  if (['IVF', 'کلینیک قلب', 'کلینیک گوارش', 'کلینیک جنرال'].includes(ward)) return 'چهارم';
  return 'همکف'; // Default
};

export const getWardType = (ward: string): WardType => {
  return CLINICAL_WARDS.includes(ward) ? WardType.CLINICAL : WardType.NON_CLINICAL;
};

export const getCategoryByJobTitle = (title: string): JobCategory => {
  switch (title) {
    case 'سرپرستار':
    case 'سوپروایزر':
      return JobCategory.SET_9_MANAGEMENT;
    
    case 'پرستار':
    case 'ماما':
    case 'کارشناس اتاق عمل':
    case 'هوشبری':
      return JobCategory.SET_10_CLINICAL;
    
    case 'کمک پرستار':
      return JobCategory.SET_11_ASSISTANT;

    case 'منشی':
      return JobCategory.SET_12_SECRETARY;
    
    case 'اداری':
    case 'پشتیبانی':
    case 'سایر':
    default:
      return JobCategory.SET_13_SUPPORT;
  }
};

// --- MOCK USERS (ADMINS) ---

const generateUsers = (): User[] => {
  const users: User[] = [];

  // DEVELOPER (Hassan Shamloo)
  users.push({
    id: 'dev_hassan',
    username: 'hassan',
    password: '123',
    name: 'مهندس حسن شاملو',
    role: UserRole.DEVELOPER
  });

  // 1 Nursing Manager (Modir Parastari)
  users.push({
    id: 'manager_nursing',
    username: 'manager',
    password: '123',
    name: 'سرکار خانم زهره باقری (مدیر پرستاری)',
    role: UserRole.MANAGER
  });

  // 1 Quality Improvement Manager (Modir Behbood)
  users.push({
    id: 'manager_quality',
    username: 'behbood',
    password: '123',
    name: 'سرکار خانم زهرا خسروانی (مدیر بهبود کیفیت)',
    role: UserRole.QUALITY_MANAGER
  });

  // 10 Supervisors
  for (let i = 1; i <= 10; i++) {
    users.push({
      id: `sup${i}`,
      username: `sup${i}`,
      password: '123',
      name: `سوپروایزر ${i}`,
      role: UserRole.SUPERVISOR
    });
  }

  // 20 Head Nurses
  const validWards = WARD_OPTIONS.filter(w => w !== 'سایر');
  
  for (let i = 1; i <= 20; i++) {
    const wardName = validWards[(i - 1) % validWards.length];
    users.push({
      id: `hn${i}`,
      username: `head${i}`,
      password: '123',
      name: `سرپرستار ${wardName}`,
      role: UserRole.HEAD_NURSE,
      ward: wardName,
      wardType: getWardType(wardName),
      floor: getFloorByWard(wardName)
    });
  }

  return users;
};

export const MOCK_USERS = generateUsers();

// --- QUESTION DEFINITIONS ---

export const GENERAL_TRAINING_OPTIONS = [
  'CPR پایه',
  'ارزش حقوق گیرنده خدمت',
  'مهارت‌های رفتاری و ارتباطی',
  'آتش‌نشانی (کار با کپسول و...)',
  'مانور آتش‌نشانی (تخلیه اماکن در هنگام آتش‌سوزی)',
  'بهداشت محیط (دفع صحیح پسماند)',
  'ایمنی بیمار',
  'مدیریت خطا',
  'مدیریت بحران',
  'وقایع ناخواسته ناشی از ارائه خدمات (۲۸ گانه)',
  'ارتقا سلامت پرسنل (تغذیه _ ورزش)',
  'کنترل عفونت و خط مشی',
  'مواجهه شغلی و نیدل استیک',
  'ایمنی و سلامت شغلی',
  'کلیات مفاهیم اعتبار بخشی',
  'ارگونومی اداری',
  'اتوماسیون اداری',
  'چگونگی ثبت در سیستم حضور و غیاب',
  'کمک‌های اولیه',
  'شیوه تکریم شخصیت ارباب رجوع و همکاران'
];

export const INFECTION_CONTROL_OPTIONS = [
  'اهمیت بهداشت دست',
  'آشنایی با بیماری‌های واگیردار',
  'آشنایی با بیماری‌های مشترک انسان و دام',
  'نظام مراقبت سندرومیک',
  'ایزولاسیون و روش‌های حفاظت فردی',
  'بیماری‌های نوپدید مانند: کرونا و...'
];

export const MANAGEMENT_TRAINING_OPTIONS = [
  'مدیریت تخصصی',
  'مدیریت حل مسئله',
  'مدیریت زمان',
  'مدیریت تغییر',
  'مدیریت استرس',
  'تفکر نقادانه',
  'مدیریت عمومی',
  'ثبت گزارش نویسی و مستندات پرونده',
  'پزشکی قانونی و کادر درمان'
];

export const CLINICAL_SPECIALIZED_OPTIONS = [
  'تشخیص پرستاری',
  'ثبت صحیح گزارش پرستاری',
  'ثبت صحیح ارزیابی اولیه',
  'فرایند پرستاری',
  'هموویژلانس',
  'CPR - پیشرفته',
  'CPR - نوزاد',
  'طرز کار با ونتیلاتور',
  'طرز کار با دفیبریلاتور',
  'آشنایی با داروهای ترالی اورژانس',
  'فارماکوویژلانس',
  'محاسبات دارویی',
  'اختلالات آب و الکترولیت‌ها',
  'آموزش به بیمار',
  'کادر درمان و قانون',
  'ABG - تفسیر',
  'ECG - تفسیر',
  'آشنایی با آریتمی',
  'اصول تهویه مکانیکی',
  'اصول مراقبت از بیمار بی‌قرار',
  'مراقبت پرستاری از بیمار در مراحل پایانی زندگی',
  'مروری بر پروسیجرهای مراقبتی استاندارد و ساکشن / گاواژ / پانسمان / کنترل دفع و جذب',
  'مدیریت درد',
  'پیشگیری و مراقبت از زخم بستر'
];

export const SPECIAL_WARD_OPTIONS = [
  'کارگاه ترویج تغذیه با شیرمادر',
  'کارگاه مراقبت آغوشی مادر و نوزاد',
  'کارگاه تماس پوست با پوست مادر و نوزاد',
  'اورژانس‌های مامایی',
  'مدیریت خونریزی دوران بارداری (سه ماه اول / دوم / سوم)',
  'مراقبت از نوزاد سالم و بیمار',
  'مراقبت از نوزاد در معرض خط (ACRON)',
  'دوره مراقبت‌های پرستاری در ICU',
  'دوره مراقبت‌های پرستاری در CCU',
  'دوره مراقبت‌های پرستاری در N ICU',
  'اورژانس‌های پرستاری',
  'تریاژ',
  'تفکر نقدانه',
  'مدیریت حل مسئله',
  'مدیریت زمان'
];

export const ASSISTANT_SPECIALIZED_OPTIONS = [
  'وضعیت‌دهی مناسب بیماران',
  'مراقبت از اتصالات',
  'پیشگیری زخم فشاری',
  'مراقبت از بیمار بی‌قرار و استفاده از مهار فیزیکی',
  'انواع روش‌های ضدعفونی دستگاه‌ها و تجهیزات پزشکی',
  'آشنایی با انواع اندیکاتورها و کاربرد آن‌ها',
  'مراقبت از جسد و بیمار در حال احتضار',
  'تأمین نیازهای بهداشتی بیمار',
  'آماده کردن تخت و بالابردن بیمار / برانکارد و تخت پس از عمل',
  'روش‌های صحیح تخلیه ترشحات',
  'ایزولاسیون و حفاظت فردی',
  'شرح وظایف، قوانین و مقررات حرفه‌ای',
  'شست‌وشو و ضدعفونی یونیت بیمار پس از ترخیص',
  'اختصارات و اصطلاحات پزشکی',
  'شناسایی بیمار و کنترل هویت او',
  'نحوه گرفتن نوار قلب صحیح از بیمار'
];

export const SECRETARY_SPECIALIZED_OPTIONS = [
  'اصول اولیه کار با کامپیوتر',
  'آشنایی با شاخص‌های آمار بیمارستانی',
  'تسلط به نرم‌افزارهای آماری اکسل',
  'آشنایی با اصول مستند سازی پرونده پزشکی',
  'آشنایی با اختصارات و اصطلاحات پزشکی',
  'آشنایی با روش‌های حفظ امنیت داده‌ها در سیستم‌های اطلاعات مراقبت درمان',
  'HIS سیستم بیمارستانی',
  'ETS - سیستم بیمارستانی',
  'ICDL - آشنایی با مهارت‌های هفتگانه'
];

export const TRAINING_METHOD_OPTIONS = [
  'برگزاری وبینار',
  'آموزش عملی',
  'ارائه جزوات',
  'کارگاه آموزشی',
  'کلاس /کنفرانس درون بیمارستانی',
  'آموزش مجازی واتس اپ'
];

export const YES_NO_OPTIONS = ['بله', 'خیر'];

const SECTION_GENERAL_A = {
  title: 'آموزش عمومی (الف)',
  questions: [
    { id: 'gen_a_1', text: 'اولویت اول آموزش عمومی (الف)', required: true, options: GENERAL_TRAINING_OPTIONS },
    { id: 'gen_a_2', text: 'اولویت دوم آموزش عمومی (الف)', required: true, options: GENERAL_TRAINING_OPTIONS },
    { id: 'gen_a_3', text: 'اولویت سوم آموزش عمومی (الف)', required: true, options: GENERAL_TRAINING_OPTIONS },
    { id: 'gen_a_4', text: 'اولویت چهارم آموزش عمومی (الف)', required: true, options: GENERAL_TRAINING_OPTIONS },
  ]
};

const SECTION_GENERAL_B = {
  title: 'آموزش عمومی (ب) - آموزش‌های اختصاصی کنترل عفونت همگانی',
  questions: [
    { id: 'gen_b_1', text: 'اولویت اول آموزش عمومی (ب)', required: true, options: INFECTION_CONTROL_OPTIONS },
    { id: 'gen_b_2', text: 'اولویت دوم آموزش عمومی (ب)', required: true, options: INFECTION_CONTROL_OPTIONS },
  ]
};

const SECTION_QUESTIONS_GENERAL_FULL = {
  title: 'سوالات کلی',
  questions: [
    { 
      id: 'q_method', 
      text: 'روش پیشنهادی شما برای پاسخ به نیاز آموزشی کدام است؟ (هر تعداد گزینه را می‌توانید انتخاب کنید)', 
      required: true, 
      options: TRAINING_METHOD_OPTIONS,
      allowMultiple: true 
    },
    { id: 'q_unit_need', text: 'همکار گرامی به نظر مسئول واحد شما و سایر همکاران به چه آموزشی بیشتر نیاز می باشد؟', required: false },
    { 
      id: 'q_ircme_know', 
      text: 'آیا می دانید هر کادر پرستاری سالیانه 30-35 امتیاز بازآموزی در سامانه IRCME باید داشته باشد؟', 
      required: true, 
      options: YES_NO_OPTIONS 
    },
    { 
      id: 'q_ircme_member', 
      text: 'همکار گرامی اگر شما کادر پرستاری می باشید آیا عضو سامانه IRCME می باشید؟', 
      required: true, 
      options: YES_NO_OPTIONS 
    },
    { 
      id: 'q_whatsapp', 
      text: 'آیا عضو گروه واتس آپ آموزش بیمارستان امید می باشید؟', 
      required: true, 
      options: YES_NO_OPTIONS 
    },
  ]
};

const SECTION_QUESTIONS_GENERAL_SIMPLE = {
  title: 'سوالات کلی',
  questions: [
    { 
      id: 'q_method', 
      text: 'روش پیشنهادی شما برای پاسخ به نیاز آموزشی کدام است؟ (هر تعداد گزینه را می‌توانید انتخاب کنید)', 
      required: true, 
      options: TRAINING_METHOD_OPTIONS,
      allowMultiple: true 
    },
    { id: 'q_unit_need', text: 'همکار گرامی به نظر مسئول واحد شما و سایر همکاران به چه آموزشی بیشتر نیاز می باشد؟', required: false },
    { 
      id: 'q_whatsapp', 
      text: 'آیا عضو گروه واتس آپ آموزش بیمارستان امید می باشید؟', 
      required: true,
      options: YES_NO_OPTIONS
    },
  ]
};

// --- JOB CATEGORY CONFIGURATIONS (SETS 9-13) ---

export const JOB_CATEGORIES_CONFIG: JobCategoryConfig[] = [
  // SET 9
  {
    id: JobCategory.SET_9_MANAGEMENT,
    title: 'سوپروایزران و سرپرستاران',
    sections: [
      SECTION_GENERAL_A,
      SECTION_GENERAL_B,
      {
        title: 'آموزش اختصاصی سوپروایزران و سرپرستاران',
        questions: [
          { id: 'spec_hn_1', text: 'اولویت اول آموزش اختصاصی سوپروایزران و سرپرستاران', required: true, options: MANAGEMENT_TRAINING_OPTIONS },
          { id: 'spec_hn_2', text: 'اولویت دوم آموزش اختصاصی سوپروایزران و سرپرستاران', required: true, options: MANAGEMENT_TRAINING_OPTIONS },
        ]
      },
      SECTION_QUESTIONS_GENERAL_FULL
    ]
  },
  // SET 10
  {
    id: JobCategory.SET_10_CLINICAL,
    title: 'پرستار / ماما / کارشناس اتاق عمل / هوشبری',
    sections: [
      SECTION_GENERAL_A,
      SECTION_GENERAL_B,
      {
        title: 'آموزش اختصاصی پرستاران / ماماها / اتاق عمل / هوشبری',
        questions: [
          { id: 'spec_nurse_1', text: 'اولویت اول آموزش اختصاصی', required: true, options: CLINICAL_SPECIALIZED_OPTIONS },
          { id: 'spec_nurse_2', text: 'اولویت دوم آموزش اختصاصی', required: true, options: CLINICAL_SPECIALIZED_OPTIONS },
          { id: 'spec_nurse_3', text: 'اولویت سوم آموزش اختصاصی', required: true, options: CLINICAL_SPECIALIZED_OPTIONS },
          { id: 'spec_nurse_4', text: 'اولویت چهارم آموزش اختصاصی', required: true, options: CLINICAL_SPECIALIZED_OPTIONS },
        ]
      },
      {
        title: 'آموزش اختصاصی بخش‌های ویژه / مادر و نوزاد',
        questions: [
          { id: 'spec_special_1', text: 'اولویت اول آموزش اختصاصی مربوط به بخش‌های ویژه', required: false, options: SPECIAL_WARD_OPTIONS },
          { id: 'spec_special_2', text: 'اولویت دوم آموزش اختصاصی مربوط به بخش‌های ویژه', required: false, options: SPECIAL_WARD_OPTIONS },
        ]
      },
      SECTION_QUESTIONS_GENERAL_FULL
    ]
  },
  // SET 11
  {
    id: JobCategory.SET_11_ASSISTANT,
    title: 'کمک پرستاران',
    sections: [
      SECTION_GENERAL_A,
      SECTION_GENERAL_B,
      {
        title: 'سوالات اختصاصی کمک پرستاران',
        questions: [
          { id: 'spec_aid_1', text: 'اولویت اول مربوط به کمک پرستاران', required: true, options: ASSISTANT_SPECIALIZED_OPTIONS },
          { id: 'spec_aid_2', text: 'اولویت دوم مربوط به کمک پرستاران', required: true, options: ASSISTANT_SPECIALIZED_OPTIONS },
          { id: 'spec_aid_3', text: 'اولویت سوم مربوط به کمک پرستاران', required: true, options: ASSISTANT_SPECIALIZED_OPTIONS },
          { id: 'spec_aid_4', text: 'اولویت چهارم مربوط به کمک پرستاران', required: true, options: ASSISTANT_SPECIALIZED_OPTIONS },
        ]
      },
      SECTION_QUESTIONS_GENERAL_SIMPLE
    ]
  },
  // SET 12
  {
    id: JobCategory.SET_12_SECRETARY,
    title: 'منشی‌ها',
    sections: [
      SECTION_GENERAL_A,
      SECTION_GENERAL_B,
      {
        title: 'سوالات اختصاصی منشی‌ها',
        questions: [
          { id: 'spec_sec_1', text: 'اولویت اول آموزش اختصاصی به منشی‌ها', required: true, options: SECRETARY_SPECIALIZED_OPTIONS },
          { id: 'spec_sec_2', text: 'اولویت دوم آموزش اختصاصی به منشی‌ها', required: true, options: SECRETARY_SPECIALIZED_OPTIONS },
          { id: 'spec_sec_3', text: 'اولویت سوم آموزش اختصاصی به منشی‌ها', required: true, options: SECRETARY_SPECIALIZED_OPTIONS },
        ]
      },
      SECTION_QUESTIONS_GENERAL_SIMPLE
    ]
  },
  // SET 13
  {
    id: JobCategory.SET_13_SUPPORT,
    title: 'اداری / پشتیبانی / سایر',
    sections: [
      SECTION_GENERAL_A,
      SECTION_GENERAL_B,
      SECTION_QUESTIONS_GENERAL_SIMPLE
    ]
  }
];

export const INITIAL_MOCK_PDPS: PDPForm[] = [];
