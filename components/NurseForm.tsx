import React, { useState, useEffect, useRef } from 'react';
import { PDPStatus, PDPForm, JobCategory, BioData } from '../types';
import { JOB_CATEGORIES_CONFIG, JOB_TITLES, getCategoryByJobTitle, YES_NO_OPTIONS, EDUCATION_OPTIONS, WARD_OPTIONS, APP_VERSION } from '../constants';
import { savePDP } from '../services/dataService';
import { CheckCircle, ChevronLeft, User, FileText, Activity, Lock, ArrowDown, Check, X, Moon, Sun, Clock, Calendar, ArrowUp, AlertTriangle, AlertCircle, Calculator, Save } from 'lucide-react';

interface NurseFormProps {
  onAdminLoginClick: () => void;
}

// --- TOAST COMPONENT ---
interface Toast {
    id: number;
    message: string;
    type: 'error' | 'success';
}

const JALALI_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const JALALI_YEARS = Array.from({length: 50}, (_, i) => 1403 - i); // 1403 down to 1353
const JALALI_DAYS = Array.from({length: 31}, (_, i) => i + 1);

const NurseForm: React.FC<NurseFormProps> = ({ onAdminLoginClick }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const questionsStartRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showBackToTop, setShowBackToTop] = useState(false);
  
  // Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'error' | 'success' = 'error') => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
  };

  // State: Bio
  const [bioData, setBioData] = useState<BioData>({
    fullName: '',
    nationalId: '',
    education: '',
    formDate: new Date().toLocaleDateString('fa-IR'),
    hireDate: '',
    mobile: '',
    personnelId: '',
    orgPost: '' 
  });
  
  // Validation Error State
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Hire Date Picker State
  const [hireYear, setHireYear] = useState('');
  const [hireMonth, setHireMonth] = useState('');
  const [hireDay, setHireDay] = useState('');
  const [workExperience, setWorkExperience] = useState('');

  useEffect(() => {
    if(hireYear && hireMonth && hireDay) {
        setBioData(prev => ({ ...prev, hireDate: `${hireYear}/${hireMonth}/${hireDay}` }));
        calculateExperience(hireYear, hireMonth, hireDay);
    } else {
        setWorkExperience('');
    }
  }, [hireYear, hireMonth, hireDay]);

  const calculateExperience = (y: string, m: string, d: string) => {
      try {
          // Get Current Jalali Date
          const now = new Date();
          const options: Intl.DateTimeFormatOptions = { calendar: 'persian', year: 'numeric', month: 'numeric', day: 'numeric' };
          const todayJalali = new Intl.DateTimeFormat('fa-IR-u-ca-persian', options).format(now);
          
          const toEnDigits = (s: string) => s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
          const parts = toEnDigits(todayJalali).split('/');
          
          let currentY = parseInt(parts[0]);
          let currentM = parseInt(parts[1]);
          let currentD = parseInt(parts[2]);

          if (currentY < 1000) { 
             currentD = parseInt(parts[0]);
             currentM = parseInt(parts[1]);
             currentY = parseInt(parts[2]);
          }

          let startY = parseInt(y);
          let startM = JALALI_MONTHS.indexOf(m) + 1;
          let startD = parseInt(d);

          let diffY = currentY - startY;
          let diffM = currentM - startM;
          let diffD = currentD - startD;

          if (diffD < 0) {
              diffM -= 1;
              diffD += 30; // Approx month length
          }
          if (diffM < 0) {
              diffY -= 1;
              diffM += 12;
          }

          if (diffY < 0) {
              setWorkExperience('تاریخ انتخاب شده در آینده است!');
          } else {
              setWorkExperience(`${diffY} سال و ${diffM} ماه و ${diffD} روز`);
          }

      } catch (e) {
          console.error(e);
      }
  };

  // Ward States
  const [selectedWard, setSelectedWard] = useState('');
  const [customWard, setCustomWard] = useState('');

  // State: Responses
  const [responses, setResponses] = useState<Record<string, string>>({});

  // Progress Bar State
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Clock Timer
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    // Scroll Listener for BackToTop
    const handleScroll = () => {
        if (window.scrollY > 300) {
            setShowBackToTop(true);
        } else {
            setShowBackToTop(false);
        }
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
        clearInterval(timer);
        window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    // Dark Mode Class Handling
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // --- PROGRESS CALCULATION ---
  useEffect(() => {
      // Only calculate if OrgPost is selected
      if (!bioData.orgPost) {
          setProgress(0);
          return;
      }

      let totalFields = 6; // Bio fields remaining (name, id, mobile, education, personnelId, ward) -> orgPost is already selected
      let completedFields = 0;
      
      // Bio Check
      if (bioData.fullName) completedFields++;
      if (bioData.nationalId && bioData.nationalId.length === 10) completedFields++;
      if (bioData.mobile && bioData.mobile.length === 11) completedFields++;
      if (bioData.education) completedFields++;
      if (bioData.personnelId) completedFields++;
      if (selectedWard) completedFields++;

      const config = getActiveCategoryConfig();
      if (config) {
          config.sections.forEach(sec => {
              sec.questions.forEach(q => {
                  if (q.required) {
                      totalFields++;
                      if (responses[q.id]) completedFields++;
                  }
              });
          });
      }

      const percent = totalFields > 0 ? Math.min(100, Math.round((completedFields / totalFields) * 100)) : 0;
      setProgress(percent);

  }, [bioData, selectedWard, responses]);


  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBioChange = (field: keyof BioData, value: string) => {
    // Input Restrictions
    if (field === 'nationalId') {
        if (!/^\d*$/.test(value)) return; // Only numbers
        if (value.length > 10) return; // Max 10
    }
    if (field === 'mobile') {
        if (!/^\d*$/.test(value)) return; // Only numbers
        if (value.length > 11) return; // Max 11
        if (value.length >= 2 && !value.startsWith('09')) {
            addToast('همه شماره تلفن‌ها در ایران با 09 شروع می‌شوند', 'error');
            return;
        }
    }
    if (field === 'personnelId') {
        if (!/^\d*$/.test(value)) return; // Only numbers
        if (value.length > 4) return; // Max 4
    }

    setBioData(prev => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleWardChange = (val: string) => {
      setSelectedWard(val);
      if (errors['ward']) setErrors(prev => ({ ...prev, ward: false }));
  }

  const handleResponseChange = (qid: string, value: string) => {
    setResponses(prev => ({ ...prev, [qid]: value }));
    if (errors[qid]) {
        setErrors(prev => ({ ...prev, [qid]: false }));
    }
  };

  const handleCheckboxChange = (qid: string, option: string, checked: boolean) => {
    const currentVal = responses[qid] || '';
    let currentOptions = currentVal ? currentVal.split('، ') : [];
    currentOptions = currentOptions.filter(o => o.trim() !== '');

    if (checked) {
        if (!currentOptions.includes(option)) {
            currentOptions.push(option);
        }
    } else {
        currentOptions = currentOptions.filter(o => o !== option);
    }
    
    setResponses(prev => ({ ...prev, [qid]: currentOptions.join('، ') }));
    if (errors[qid]) {
        setErrors(prev => ({ ...prev, [qid]: false }));
    }
  };

  // Scroll to questions when job title is selected
  useEffect(() => {
    if (bioData.orgPost && questionsStartRef.current) {
      setTimeout(() => {
        questionsStartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [bioData.orgPost]);

  const getFinalWard = () => selectedWard === 'سایر' ? customWard : selectedWard;

  const getActiveCategoryConfig = () => {
    if (!bioData.orgPost) return undefined;
    const categoryId = getCategoryByJobTitle(bioData.orgPost);
    return JOB_CATEGORIES_CONFIG.find(c => c.id === categoryId);
  };

  const validateForm = () => {
    const wardValue = getFinalWard();
    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (!bioData.fullName) { newErrors.fullName = true; hasError = true; }
    if (!bioData.nationalId) { newErrors.nationalId = true; hasError = true; }
    if (!bioData.mobile) { newErrors.mobile = true; hasError = true; }
    if (!bioData.education) { newErrors.education = true; hasError = true; }
    if (!bioData.personnelId) { newErrors.personnelId = true; hasError = true; }
    if (!wardValue) { newErrors.ward = true; hasError = true; }
    if (!bioData.orgPost) { newErrors.orgPost = true; hasError = true; }

    if (bioData.nationalId && bioData.nationalId.length !== 10) {
        addToast('کد ملی باید دقیقا ۱۰ رقم باشد');
        newErrors.nationalId = true; 
        hasError = true;
    }
    if (bioData.mobile && !bioData.mobile.startsWith('09')) {
        addToast('شماره موبایل باید با 09 شروع شود', 'error');
        newErrors.mobile = true;
        hasError = true;
    }
    if (bioData.mobile && bioData.mobile.length !== 11) {
        addToast('شماره موبایل باید دقیقا ۱۱ رقم باشد', 'error');
        newErrors.mobile = true;
        hasError = true;
    }
    if (bioData.personnelId && bioData.personnelId.length !== 4) {
        addToast('شماره پرسنلی باید ۴ رقم باشد');
        newErrors.personnelId = true;
        hasError = true;
    }

    const config = getActiveCategoryConfig();
    if (config) {
        config.sections.forEach(sec => {
            sec.questions.forEach(q => {
                if (q.required && !responses[q.id]) {
                    newErrors[q.id] = true;
                    hasError = true;
                }
            });
        });
    }

    setErrors(newErrors);

    if (hasError) {
        addToast('لطفا موارد ستاره‌دار قرمز را تکمیل کنید');
        // Try to scroll to the first error
        const firstError = document.querySelector('.border-red-500');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return false;
    }

    return true;
  };

  const handleSaveDraft = () => {
    const draftData = {
      bioData,
      selectedWard,
      customWard,
      responses,
      hireYear,
      hireMonth,
      hireDay
    };
    localStorage.setItem('pdp_draft', JSON.stringify(draftData));
    addToast('اطلاعات با موفقیت در مرورگر شما ذخیره شد (پیش‌نویس)', 'success');
  };

  useEffect(() => {
    const savedDraft = localStorage.getItem('pdp_draft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setBioData(parsed.bioData);
        setSelectedWard(parsed.selectedWard);
        setCustomWard(parsed.customWard);
        setResponses(parsed.responses);
        setHireYear(parsed.hireYear);
        setHireMonth(parsed.hireMonth);
        setHireDay(parsed.hireDay);
        addToast('پیش‌نویس قبلی شما بازیابی شد', 'success');
      } catch (e) {
        console.error('Failed to load draft', e);
      }
    }
  }, []);

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const config = getActiveCategoryConfig();
    if (!config) return;

    setIsSubmitting(true);

    const flatResponses = config.sections.flatMap(sec => 
      sec.questions.map(q => ({
        questionId: q.id,
        questionText: q.text,
        section: sec.title,
        answer: responses[q.id] || 'پاسخ داده نشده'
      }))
    );

    const newPDP: PDPForm = {
      id: Date.now().toString(),
      userId: bioData.personnelId,
      nurseName: bioData.fullName,
      ward: getFinalWard(),
      submissionDate: bioData.formDate,
      status: PDPStatus.SUBMITTED,
      bioData: bioData,
      jobCategory: config.id,
      responses: flatResponses
    };

    try {
      await savePDP(newPDP);
      setIsSubmitting(false);
      setIsSuccess(true);
    } catch (e) {
      addToast('خطا در ارتباط با سرور. لطفا مجددا تلاش کنید.');
      setIsSubmitting(false);
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  // --- DYNAMIC PROGRESS COLOR ---
  const getProgressColorClass = (p: number) => {
      if (p < 30) return 'from-red-500 to-orange-500';
      if (p < 60) return 'from-orange-500 to-yellow-400';
      if (p < 90) return 'from-blue-500 to-indigo-500';
      return 'from-green-500 to-emerald-400';
  };
  
  const progressGradient = getProgressColorClass(progress);

  const formattedDate = currentTime.toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });
  const formattedTime = currentTime.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

  const getInputErrorClass = (hasError: boolean) => {
      if (hasError) return 'border-red-500 bg-red-50 focus:ring-red-200';
      return isDarkMode ? 'bg-gray-800/50 border-gray-600 text-white focus:border-blue-500' : 'bg-white/80 border-gray-200 focus:border-blue-500';
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4 bg-[url('https://www.transparenttextures.com/patterns/subtle-grey.png')]">
        <div className="bg-white/60 backdrop-blur-xl dark:bg-gray-800/60 p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center border border-white/40 animate-in zoom-in-95">
          <div className="mx-auto w-24 h-24 bg-green-100/50 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <CheckCircle className="text-green-600 dark:text-green-400" size={48} />
          </div>
          <h2 className="text-3xl font-black text-gray-800 dark:text-white mb-4">ثبت موفقیت‌آمیز</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8 leading-8 font-medium">
            فرم PDP شما با موفقیت ثبت شد و جهت بررسی به مدیر مربوطه ارسال گردید.
          </p>
          <button onClick={handleReload} className="bg-gradient-to-r from-omid-600 to-omid-500 text-white px-8 py-4 rounded-2xl hover:shadow-lg hover:-translate-y-1 transition-all font-bold w-full shadow-md text-lg">
             بازگشت به صفحه اصلی
          </button>
        </div>
        <footer className="fixed bottom-0 w-full text-center py-2 text-[10px] text-gray-400">
           بیمارستان تخصصی و فوق تخصصی امید
        </footer>
      </div>
    );
  }

  const activeConfig = getActiveCategoryConfig();

  return (
    <div className={`min-h-screen font-sans flex flex-col bg-[url('https://www.transparenttextures.com/patterns/subtle-grey.png')] ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-800'}`}>
      
      {/* TOAST CONTAINER */}
      <div className="fixed top-24 right-4 z-[100] flex flex-col gap-3 w-full max-w-[90%] md:max-w-sm">
          {toasts.map(toast => (
              <div key={toast.id} className="bg-blue-50/90 backdrop-blur-xl border border-blue-200 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-right duration-300">
                  <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600 shadow-inner shrink-0">
                      <AlertTriangle size={22} />
                  </div>
                  <div className="flex-1">
                      <h4 className="font-black text-gray-800 text-sm font-sans mb-0.5">توجه</h4>
                      <p className="text-xs font-bold text-gray-600 font-sans leading-5">{toast.message}</p>
                  </div>
                  <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="text-gray-400 hover:text-blue-500 transition-colors bg-white/50 p-1 rounded-lg"><X size={16}/></button>
              </div>
          ))}
      </div>

      {/* PRETTY FLOATING PROGRESS BAR - Only Show After OrgPost Selection */}
      {bioData.orgPost && (
        <div className="fixed bottom-6 left-0 right-0 z-[60] flex justify-center px-4 pointer-events-none">
            <div className="w-full max-w-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl p-2 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.2)] border border-white/60 dark:border-gray-600 flex items-center gap-3 animate-in slide-in-from-bottom-4 ring-1 ring-black/5">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1.5 min-w-[4.5rem] text-center shadow-inner border border-gray-200/50 dark:border-gray-600">
                    <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>{progress}%</span>
                </div>
                <div className="flex-1 h-4 md:h-5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative shadow-inner">
                    <div 
                        className={`h-full bg-gradient-to-r ${progressGradient} rounded-full transition-all duration-700 ease-out shadow-[0_0_20px_rgba(255,255,255,0.4)] relative overflow-hidden`}
                        style={{ width: `${progress}%` }}
                    >
                        <div className="absolute inset-0 bg-white/30 w-full h-full animate-[shimmer_2s_infinite] transform -skew-x-12"></div>
                    </div>
                </div>
                <div className="whitespace-nowrap px-2 text-[10px] font-bold text-gray-500 hidden sm:block">
                     درصد تکمیل فرم PDP
                </div>
            </div>
        </div>
      )}

      {/* Floating Back to Top Button */}
      {showBackToTop && (
        <button 
            onClick={scrollToTop}
            className="fixed bottom-24 left-4 z-50 p-3 rounded-full shadow-xl bg-omid-600 text-white hover:bg-omid-700 hover:scale-110 transition-all animate-in fade-in backdrop-blur-sm border border-white/20"
        >
            <ArrowUp size={24} />
        </button>
      )}

      {/* Public Header */}
      <div className={`shadow-sm sticky top-0 z-40 border-b transition-colors backdrop-blur-xl ${isDarkMode ? 'bg-gray-900/80 border-gray-700' : 'bg-white/80 border-white/40'}`}>
        <div className="max-w-7xl mx-auto px-4 py-2 md:py-3">
          
          {/* DESKTOP VIEW */}
          <div className="hidden md:flex justify-between items-center relative min-h-[70px]">
              {/* Right: Time */}
              <div className="flex items-center gap-4 z-10 w-1/3">
                <div className={`flex items-center justify-center px-4 py-2 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-gray-800/50 border-gray-600 text-blue-400' : 'bg-white/50 border-white/50 text-omid-700'}`}>
                    <Clock size={18} className="ml-2 opacity-70" />
                    {/* Fixed Clock Font */}
                    <div className="text-xl font-black tracking-wider pt-1 font-sans">
                    {formattedTime}
                    </div>
                </div>
              </div>

              {/* Center: Title */}
              <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-1/3 pointer-events-none">
                    <div className="flex items-center gap-2 pointer-events-auto">
                        <div className="bg-gradient-to-tr from-omid-600 to-blue-400 text-white p-2 rounded-xl shadow-lg shadow-blue-500/20"><Activity size={24} /></div>
                        <h1 className="font-black text-2xl text-gray-800 dark:text-white tracking-tight text-center drop-shadow-sm">بیمارستان فوق تخصصی امید</h1>
                    </div>
                    <span className={`text-xs font-bold tracking-wide mt-1 px-3 py-0.5 rounded-full ${isDarkMode ? 'text-gray-300 bg-gray-800/50' : 'text-gray-500 bg-gray-100/50'}`}>سیستم جامع توسعه فردی (PDP)</span>
              </div>

              {/* Left: Actions */}
              <div className="flex items-center justify-end gap-3 z-10 w-1/3">
                <div className={`flex items-center gap-2 text-sm font-bold whitespace-nowrap px-3 py-1.5 rounded-lg ${isDarkMode ? 'text-gray-300 bg-gray-800/50' : 'text-gray-600 bg-white/40'}`}>
                    <Calendar size={16} className="opacity-70" />
                    {formattedDate}
                </div>
                
                <div className="flex items-center gap-2 border-r border-gray-300/30 dark:border-gray-700 pr-3">
                    <button 
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className={`p-2.5 rounded-xl transition-all shadow-sm ${isDarkMode ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-white/80 text-gray-500 hover:bg-white'}`}
                    >
                        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <button 
                        onClick={onAdminLoginClick}
                        className="bg-omid-100 text-omid-700 hover:bg-omid-200 px-4 py-2.5 rounded-xl font-sans font-bold text-base flex items-center gap-2 transition-all shadow-sm hover:shadow-md border border-omid-200"
                        style={{ backgroundColor: '#e0f2fe' }}
                    >
                        <Lock size={18} />
                        <span>ورود مدیران</span>
                    </button>
                </div>
              </div>
          </div>

          {/* MOBILE VIEW (Simplified) */}
          <div className="md:hidden flex justify-between items-center min-h-[60px] gap-2">
             {/* Title Takes Most Space */}
             <div className="flex-1 flex items-center justify-center">
                 <h1 className="font-black text-lg text-gray-800 dark:text-white tracking-tight text-center leading-tight">بیمارستان فوق تخصصی امید</h1>
             </div>

             {/* Compact Actions */}
             <div className="flex items-center gap-2 shrink-0">
                 <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`p-2 rounded-xl transition-all shadow-sm border ${isDarkMode ? 'bg-gray-800 text-yellow-400 border-gray-700' : 'bg-white text-gray-500 border-gray-200'}`}
                >
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button 
                    onClick={onAdminLoginClick}
                    className="bg-blue-100 text-blue-700 p-2 rounded-xl border border-blue-200 shadow-sm"
                >
                    <Lock size={18} />
                </button>
             </div>
          </div>

        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow pb-32 md:pb-24">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-omid-800 to-slate-900 text-white py-8 md:py-12 px-4 shadow-xl mb-6 md:mb-8 rounded-b-[2rem] md:rounded-none -mt-[1px]">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl"></div>
            
            <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="text-2xl md:text-4xl font-black mb-3 md:mb-4 leading-tight drop-shadow-md">همکار گرامی، خوش آمدید</h2>
            <p className="text-xs md:text-base opacity-90 leading-relaxed max-w-3xl mx-auto font-light bg-white/10 backdrop-blur-sm p-3 md:p-4 rounded-2xl border border-white/10">
                توسعه شغلی و حرفه ای یک فرایند مستمر در خصوص ارزیابی نیاز های آموزشی هر فرد و برنامه ریزی برای رفع این نیاز می باشد.
            </p>
            </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 space-y-6 md:space-y-8">
            
            {/* SECTION 1: BIO & JOB INFO */}
            <div className={`rounded-3xl shadow-xl border p-5 md:p-10 animate-in fade-in slide-in-from-bottom-4 relative z-10 backdrop-blur-md ${isDarkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-white/60 border-white/50'}`}>
            <div className={`flex items-center gap-4 mb-6 md:mb-8 pb-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200/50'}`}>
                <div className={`p-3 md:p-4 rounded-2xl shadow-lg ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-gradient-to-tr from-blue-50 to-white text-blue-600 border border-white'}`}>
                <User size={24} className="md:w-7 md:h-7" />
                </div>
                <div>
                <h2 className="text-lg md:text-xl font-black">اطلاعات پرسنلی</h2>
                <p className={`text-xs md:text-sm mt-1 font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>مشخصات فردی و پست سازمانی</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                {/* Personal Info */}
                <div className={`col-span-1 md:col-span-2 p-5 md:p-6 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-gray-700/30 border-gray-600' : 'bg-white/40 border-white/60'}`}>
                    <h3 className={`text-sm font-bold mb-4 md:mb-6 flex items-center gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                        <div className="w-1.5 h-5 bg-blue-500 rounded-full"></div>
                        هویت فردی
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="relative group">
                        <label className="block text-xs font-bold mb-2 text-gray-500 group-focus-within:text-blue-500 transition-colors">نام و نام خانوادگی <span className="text-red-500">*</span></label>
                        <input
                        type="text"
                        value={bioData.fullName}
                        onChange={e => handleBioChange('fullName', e.target.value)}
                        className={`w-full p-3 md:p-3.5 border rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm text-sm md:text-base ${getInputErrorClass(errors.fullName)}`}
                        placeholder="مثال: علی علوی"
                        />
                        {errors.fullName && <div className="text-red-500 text-[10px] mt-1 flex items-center gap-1"><AlertCircle size={10}/> این فیلد الزامی است</div>}
                    </div>
                    <div className="relative group">
                        <label className="block text-xs font-bold mb-2 text-gray-500 group-focus-within:text-blue-500 transition-colors">کد ملی <span className="text-red-500">*</span></label>
                        <input
                        type="tel" 
                        maxLength={10}
                        value={bioData.nationalId}
                        onChange={e => handleBioChange('nationalId', e.target.value)}
                        className={`w-full p-3 md:p-3.5 border rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm text-sm md:text-base ${getInputErrorClass(errors.nationalId)}`}
                        placeholder="۱۰ رقم بدون خط تیره"
                        />
                        {/* Dynamic Character Count Feedback */}
                        {bioData.nationalId.length > 0 && bioData.nationalId.length < 10 && (
                            <div className="text-orange-500 text-[10px] mt-1 flex items-center gap-1 font-bold">
                                {10 - bioData.nationalId.length} رقم دیگر وارد کنید
                            </div>
                        )}
                        {errors.nationalId && <div className="text-red-500 text-[10px] mt-1 flex items-center gap-1"><AlertCircle size={10}/> کد ملی ۱۰ رقمی الزامی است</div>}
                    </div>
                    <div className="relative group">
                        <label className="block text-xs font-bold mb-2 text-gray-500 group-focus-within:text-blue-500 transition-colors">شماره موبایل <span className="text-red-500">*</span></label>
                        <input
                            type="tel"
                            maxLength={11}
                            value={bioData.mobile}
                            onChange={e => handleBioChange('mobile', e.target.value)}
                            className={`w-full p-3 md:p-3.5 border rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm text-sm md:text-base ${getInputErrorClass(errors.mobile)}`}
                            placeholder="مثال: 09121234567"
                        />
                        {/* Dynamic Character Count Feedback */}
                         {bioData.mobile.length > 0 && bioData.mobile.length < 11 && (
                            <div className="text-orange-500 text-[10px] mt-1 flex items-center gap-1 font-bold">
                                {11 - bioData.mobile.length} رقم دیگر وارد کنید
                            </div>
                        )}
                        {errors.mobile && <div className="text-red-500 text-[10px] mt-1 flex items-center gap-1"><AlertCircle size={10}/> شماره موبایل ۱۱ رقمی الزامی است</div>}
                        </div>
                        <div className="relative group">
                        <label className="block text-xs font-bold mb-2 text-gray-500 group-focus-within:text-blue-500 transition-colors">مدرک تحصیلی <span className="text-red-500">*</span></label>
                        <select
                            value={bioData.education}
                            onChange={e => handleBioChange('education', e.target.value)}
                            className={`w-full p-3 md:p-3.5 border rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none shadow-sm text-sm md:text-base ${getInputErrorClass(errors.education)}`}
                        >
                            <option value="">انتخاب مدرک...</option>
                            {EDUCATION_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                        {errors.education && <div className="text-red-500 text-[10px] mt-1 flex items-center gap-1"><AlertCircle size={10}/> انتخاب مدرک الزامی است</div>}
                        <div className="absolute left-4 top-[38px] md:top-[44px] transform pointer-events-none text-gray-400 group-hover:text-blue-500 transition-colors">
                            <ChevronLeft size={18} className="-rotate-90" />
                        </div>
                        </div>
                    </div>
                </div>

                {/* Work Info */}
                <div className={`col-span-1 md:col-span-2 p-5 md:p-6 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-blue-900/10 border-blue-800/30' : 'bg-blue-50/30 border-blue-100'}`}>
                <h3 className="text-sm font-bold text-blue-500 mb-4 md:mb-6 flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-blue-500 rounded-full"></div>
                    اطلاعات شغلی
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="relative group">
                    <label className="block text-xs font-bold mb-2 text-gray-500 group-focus-within:text-blue-500 transition-colors">شماره پرسنلی <span className="text-red-500">*</span></label>
                    <input
                        type="tel"
                        maxLength={4}
                        value={bioData.personnelId}
                        onChange={e => handleBioChange('personnelId', e.target.value)}
                        className={`w-full p-3 md:p-3.5 border rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm text-sm md:text-base ${getInputErrorClass(errors.personnelId)}`}
                        placeholder="۴ رقم"
                    />
                    {bioData.personnelId.length > 0 && bioData.personnelId.length < 4 && (
                            <div className="text-orange-500 text-[10px] mt-1 flex items-center gap-1 font-bold">
                                {4 - bioData.personnelId.length} رقم دیگر وارد کنید
                            </div>
                    )}
                    {errors.personnelId && <div className="text-red-500 text-[10px] mt-1 flex items-center gap-1"><AlertCircle size={10}/> شماره پرسنلی ۴ رقمی الزامی است</div>}
                    </div>
                    
                    {/* CUSTOM JALALI DATE PICKER FOR HIRE DATE */}
                    <div className="relative group">
                    <div className="flex justify-between items-end mb-2">
                        <label className="block text-xs font-bold text-gray-500 group-focus-within:text-blue-500 transition-colors">تاریخ استخدام</label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="relative">
                            <select
                                value={hireDay}
                                onChange={(e) => setHireDay(e.target.value)}
                                className={`w-full p-3 md:p-3.5 border rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none appearance-none shadow-sm text-sm md:text-base ${isDarkMode ? 'bg-gray-800/50 border-gray-600 text-white' : 'bg-white/80 border-gray-200'}`}
                            >
                                <option value="">روز</option>
                                {JALALI_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div className="relative">
                            <select
                                value={hireMonth}
                                onChange={(e) => setHireMonth(e.target.value)}
                                className={`w-full p-3 md:p-3.5 border rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none appearance-none shadow-sm text-sm md:text-base ${isDarkMode ? 'bg-gray-800/50 border-gray-600 text-white' : 'bg-white/80 border-gray-200'}`}
                            >
                                <option value="">ماه</option>
                                {JALALI_MONTHS.map((m, idx) => <option key={idx} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="relative">
                            <select
                                value={hireYear}
                                onChange={(e) => setHireYear(e.target.value)}
                                className={`w-full p-3 md:p-3.5 border rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none appearance-none shadow-sm text-sm md:text-base ${isDarkMode ? 'bg-gray-800/50 border-gray-600 text-white' : 'bg-white/80 border-gray-200'}`}
                            >
                                <option value="">سال</option>
                                {JALALI_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* MOVED WORK EXPERIENCE HERE - AS REQUESTED */}
                    {workExperience && (
                        <div className="mt-3 p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl animate-in fade-in slide-in-from-top-2 backdrop-blur-sm shadow-sm">
                             <div className="flex flex-col gap-1.5 text-center">
                                <span className="text-[11px] font-bold text-emerald-800">میزان سابقه حضور در بیمارستان فوق تخصصی امید:</span>
                                <span className="text-sm font-black text-gray-700 flex items-center justify-center gap-2">
                                     <Clock size={16} className="text-emerald-500"/>
                                     {workExperience}
                                </span>
                             </div>
                        </div>
                    )}

                    </div>
                    
                    {/* Ward Selection */}
                    <div className="relative group">
                    <label className="block text-xs font-bold mb-2 text-gray-500 group-focus-within:text-blue-500 transition-colors">بخش محل خدمت <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <select 
                            value={selectedWard}
                            onChange={(e) => handleWardChange(e.target.value)}
                            className={`w-full p-3 md:p-3.5 border rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none shadow-sm text-sm md:text-base ${getInputErrorClass(errors.ward)}`}
                        >
                            <option value="">انتخاب کنید...</option>
                            {WARD_OPTIONS.map(w => (
                                <option key={w} value={w}>{w}</option>
                            ))}
                        </select>
                        {errors.ward && <div className="text-red-500 text-[10px] mt-1 flex items-center gap-1"><AlertCircle size={10}/> انتخاب بخش الزامی است</div>}
                        <div className="absolute left-4 top-[20px] md:top-[22px] transform pointer-events-none text-gray-400">
                        <ChevronLeft size={18} className="-rotate-90" />
                        </div>
                    </div>
                    
                    {selectedWard === 'سایر' && (
                        <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                            <input
                                type="text"
                                value={customWard}
                                onChange={(e) => setCustomWard(e.target.value)}
                                placeholder="نام بخش را بنویسید..."
                                className={`w-full p-3.5 border rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all ${isDarkMode ? 'bg-gray-800/50 border-gray-600 text-white' : 'bg-white/80 border-gray-200'}`}
                            />
                        </div>
                    )}
                    </div>

                    <div className="relative group">
                    <label className="block text-xs font-bold mb-2 text-blue-600 group-focus-within:text-blue-700 transition-colors">پست سازمانی (عنوان شغلی) <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <select
                        value={bioData.orgPost}
                        onChange={e => handleBioChange('orgPost', e.target.value)}
                        className={`w-full p-3 md:p-3.5 border-2 border-blue-400/30 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none shadow-sm text-sm md:text-base ${errors.orgPost ? 'border-red-500 bg-red-50' : (isDarkMode ? 'bg-gray-800 text-white' : 'bg-white/90')}`}
                        >
                        <option value="">انتخاب کنید...</option>
                        {JOB_TITLES.map(title => (
                            <option key={title} value={title}>{title}</option>
                        ))}
                        </select>
                        {errors.orgPost && <div className="text-red-500 text-[10px] mt-1 flex items-center gap-1"><AlertCircle size={10}/> انتخاب سمت الزامی است</div>}
                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-blue-500">
                        <ChevronLeft size={18} className="-rotate-90" />
                        </div>
                    </div>
                    <p className="text-[10px] text-blue-500 mt-2 mr-1 flex items-center gap-1 opacity-80">
                        <AlertCircle size={12}/> با انتخاب پست سازمانی، سوالات مربوطه در پایین نمایش داده می‌شوند.
                    </p>
                    </div>
                </div>
                </div>
            </div>
            </div>

            {/* SECTION 2: DYNAMIC QUESTIONS */}
            <div ref={questionsStartRef}>
            {activeConfig ? (
                <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                
                <div className={`flex items-center justify-between p-4 md:p-5 rounded-2xl border shadow-lg border-l-4 border-l-omid-500 backdrop-blur-md ${isDarkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-white/50'}`}>
                    <div>
                        <h3 className="font-black text-base md:text-lg">سوالات گروه: {activeConfig.title}</h3>
                        <p className={`text-xs mt-1 font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>لطفا به تمام سوالات زیر با دقت پاسخ دهید.</p>
                    </div>
                    <ArrowDown className="text-omid-500 animate-bounce" />
                </div>

                {activeConfig.sections.map((section, sIdx) => (
                    <div key={sIdx} className={`rounded-3xl shadow-lg border overflow-hidden backdrop-blur-md ${isDarkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-white/60 border-white/40'}`}>
                    <div className={`px-5 py-4 md:px-8 md:py-5 border-b border-r-4 border-r-omid-500 ${isDarkMode ? 'bg-gray-700/30 border-gray-700' : 'bg-gray-50/50 border-gray-100'}`}>
                        <h3 className="font-bold text-base md:text-lg">{section.title}</h3>
                    </div>
                    <div className="p-5 md:p-8 space-y-8 md:space-y-10">
                        {section.questions.map((q) => (
                        <div key={q.id} className="relative group">
                            <label className={`block font-bold mb-3 md:mb-4 leading-7 text-sm md:text-base ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} ${errors[q.id] ? 'text-red-600' : ''}`}>
                            {q.required && <span className="text-red-500 ml-1 inline-block transform translate-y-1 text-lg">*</span>}
                            {q.text}
                            </label>
                            
                            {q.options ? (
                            q.allowMultiple ? (
                                // Multi-select Checkboxes
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {q.options.map((opt, idx) => {
                                        const isChecked = (responses[q.id] || '').split('، ').includes(opt);
                                        return (
                                            <label key={idx} className={`flex items-center p-3 md:p-3.5 rounded-xl border cursor-pointer transition-all ${
                                                errors[q.id] ? 'border-red-500 bg-red-50' : 
                                                isChecked 
                                                ? (isDarkMode ? 'bg-blue-900/30 border-blue-500/50 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800 shadow-sm')
                                                : (isDarkMode ? 'bg-gray-800/50 border-gray-600 hover:bg-gray-700' : 'bg-white/60 border-gray-200 hover:bg-white')
                                            }`}>
                                                <input 
                                                    type="checkbox" 
                                                    className="w-5 h-5 text-omid-600 rounded focus:ring-omid-500 border-gray-300 ml-2"
                                                    checked={isChecked}
                                                    onChange={(e) => handleCheckboxChange(q.id, opt, e.target.checked)}
                                                />
                                                <span className="text-xs md:text-sm font-medium select-none">{opt}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            ) : (
                                // Check if options are exactly YES/NO for button style
                                JSON.stringify(q.options) === JSON.stringify(YES_NO_OPTIONS) ? (
                                    <div>
                                        <div className="flex gap-3 md:gap-4">
                                            <button
                                                type="button"
                                                onClick={() => handleResponseChange(q.id, YES_NO_OPTIONS[0])}
                                                className={`flex-1 py-3 md:py-3.5 px-4 rounded-xl border font-bold transition-all flex items-center justify-center gap-2 shadow-sm text-sm md:text-base ${
                                                    responses[q.id] === YES_NO_OPTIONS[0] 
                                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500 shadow-md transform scale-[1.02]' 
                                                    : (errors[q.id] ? 'border-red-500 bg-red-50 text-red-600' : isDarkMode ? 'bg-gray-800/50 text-gray-300 border-gray-600 hover:bg-gray-700' : 'bg-white/60 text-gray-600 border-gray-200 hover:bg-white')
                                                }`}
                                            >
                                                <Check size={18} />
                                                {YES_NO_OPTIONS[0]}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleResponseChange(q.id, YES_NO_OPTIONS[1])}
                                                className={`flex-1 py-3 md:py-3.5 px-4 rounded-xl border font-bold transition-all flex items-center justify-center gap-2 shadow-sm text-sm md:text-base ${
                                                    responses[q.id] === YES_NO_OPTIONS[1] 
                                                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white border-red-500 shadow-md transform scale-[1.02]' 
                                                    : (errors[q.id] ? 'border-red-500 bg-red-50 text-red-600' : isDarkMode ? 'bg-gray-800/50 text-gray-300 border-gray-600 hover:bg-gray-700' : 'bg-white/60 text-gray-600 border-gray-200 hover:bg-white')
                                                }`}
                                            >
                                                <X size={18} />
                                                {YES_NO_OPTIONS[1]}
                                            </button>
                                        </div>
                                        {/* Specific message for WhatsApp 'No' */}
                                        {q.id === 'q_whatsapp' && responses[q.id] === 'خیر' && (
                                            <div className="mt-4 p-4 bg-red-50/80 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-300 rounded-xl text-sm font-bold animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
                                                <AlertCircle size={16}/> جهت عضویت با واحد آموزش تماس بگیرید
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    // Standard Select
                                    <div className="relative">
                                    <select
                                        className={`w-full p-3.5 md:p-4 border rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm appearance-none cursor-pointer text-sm md:text-base ${getInputErrorClass(errors[q.id])}`}
                                        value={responses[q.id] || ''}
                                        onChange={(e) => handleResponseChange(q.id, e.target.value)}
                                    >
                                        <option value="">انتخاب کنید...</option>
                                        {q.options.map((opt, idx) => (
                                        <option key={idx} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                                        <ChevronLeft size={18} className="-rotate-90" />
                                    </div>
                                    </div>
                                )
                            )
                            ) : (
                            // Text Area
                            <textarea
                                className={`w-full min-h-[120px] md:min-h-[140px] p-3.5 md:p-4 border rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none resize-y transition-all shadow-sm text-sm md:text-base ${getInputErrorClass(errors[q.id])}`}
                                placeholder={q.placeholder || "پاسخ خود را اینجا بنویسید..."}
                                value={responses[q.id] || ''}
                                onChange={(e) => handleResponseChange(q.id, e.target.value)}
                            />
                            )}
                            {errors[q.id] && <div className="text-red-500 text-[10px] mt-1.5 flex items-center gap-1 font-bold"><AlertCircle size={10}/> لطفاً به این سوال پاسخ دهید</div>}
                        </div>
                        ))}
                    </div>
                    </div>
                ))}

                <div className="flex flex-col md:flex-row justify-center gap-4 pt-6 pb-8 md:pt-8 md:pb-10">
                    <button
                        onClick={handleSaveDraft}
                        className="w-full md:w-auto bg-white text-omid-600 px-12 py-4 rounded-2xl font-bold border-2 border-omid-100 hover:bg-omid-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        <Save size={20} />
                        ذخیره پیش‌نویس
                    </button>
                    <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full md:w-auto bg-gradient-to-l from-omid-600 to-omid-700 text-white px-16 py-4 md:px-20 md:py-5 rounded-2xl font-black shadow-xl shadow-omid-500/30 hover:-translate-y-1 hover:shadow-2xl transition-all disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-3 text-base md:text-lg border-t border-white/20"
                    >
                    {isSubmitting ? (
                        <>
                        <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                        در حال ثبت...
                        </>
                    ) : (
                        <>
                        <FileText size={24} />
                        ثبت نهایی فرم PDP
                        </>
                    )}
                    </button>
                </div>
                </div>
            ) : (
                <div className={`text-center py-12 md:py-16 border-2 border-dashed rounded-3xl backdrop-blur-sm ${isDarkMode ? 'border-gray-700 bg-gray-800/30 text-gray-400' : 'bg-white/40 border-gray-300 text-gray-400'}`}>
                <FileText size={40} className="mx-auto mb-4 opacity-50 md:w-12 md:h-12"/>
                <p className="text-base md:text-lg font-bold">منتظر انتخاب پست سازمانی...</p>
                <p className="text-xs md:text-sm mt-2 opacity-80">برای مشاهده سوالات، لطفا پست سازمانی خود را در فرم بالا انتخاب کنید.</p>
                </div>
            )}
            </div>
        </div>
      </div>
      
      <footer className="w-full text-center py-4 text-[11px] text-gray-400 border-t bg-white/50 dark:bg-gray-900/50 mt-auto pb-24 md:pb-20 backdrop-blur-sm">
          بیمارستان تخصصی و فوق تخصصی امید
      </footer>
    </div>
  );
};

export default NurseForm;