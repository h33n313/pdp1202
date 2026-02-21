
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User, UserRole, PDPForm, PDPStatus, JobCategory, QuestionResponse, WardType } from '../types';
import { getAllPDPs, updatePDP, deletePDP, resetPDPReview, restoreDatabase, getAllUsers, saveUser, deleteUser } from '../services/dataService';
import { LogOut, Check, X, Eye, Search, User as UserIcon, Save, PieChart, List, BarChart2, Filter, History, FileText, ArrowUp, Database, Download, Upload, Trash2, RefreshCw, FileSpreadsheet, TrendingUp, Bell, ChevronUp, ChevronDown, Users, AlertCircle, Contact, Key, Plus, Edit2, UserPlus, Settings, ShieldCheck } from 'lucide-react';
import { JOB_CATEGORIES_CONFIG, APP_VERSION, getWardType, WARD_OPTIONS, FLOOR_OPTIONS, MOCK_USERS } from '../constants';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

type ManagerViewMode = 'TABLE_ALL' | 'TABLE_SEPARATED' | 'ANALYTICS' | 'USERS' | 'CARDS';
type SeparatedTab = 'SUPERVISOR' | 'HEAD_NURSE' | 'STAFF' | 'ADMIN' | 'SUPPORT' | 'OTHER';

interface Toast {
    id: number;
    message: string;
    type: 'error' | 'success';
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [pdps, setPdps] = useState<PDPForm[]>([]);
  const [selectedPDP, setSelectedPDP] = useState<PDPForm | null>(null);
  const [comment, setComment] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);
  
  // Notifications
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Table State (Search & Sort)
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  
  // Developer Bulk Action State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Manager Specific State - Default changed to TABLE_ALL
  const [managerViewMode, setManagerViewMode] = useState<ManagerViewMode>(
    (user.role === UserRole.MANAGER || user.role === UserRole.QUALITY_MANAGER || user.role === UserRole.DEVELOPER) ? 'TABLE_ALL' : 'TABLE_ALL'
  );
  const [managerTableTab, setManagerTableTab] = useState<SeparatedTab>(
      user.role === UserRole.QUALITY_MANAGER ? 'SUPPORT' : 'SUPERVISOR'
  );
  const [showCategoryStatsInReview, setShowCategoryStatsInReview] = useState(false);
  
  // Feedback Modal State
  const [selectedFeedback, setSelectedFeedback] = useState<{ text: string; user: string; ward: string } | null>(null);

  // Changelog Modal State
  const [showChangelog, setShowChangelog] = useState(false);


  // Review Logic State
  const [localResponses, setLocalResponses] = useState<QuestionResponse[]>([]);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  // Developer Specific State
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDevPasswordModal, setShowDevPasswordModal] = useState(false);
  const [devPasswordInput, setDevPasswordInput] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addToast = (message: string, type: 'error' | 'success' = 'error') => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
  };

  useEffect(() => {
    loadPDPs();
    if (user.role === UserRole.DEVELOPER) loadUsers();
    
    const handleScroll = () => {
        if (window.scrollY > 300) setShowBackToTop(true);
        else setShowBackToTop(false);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [user]);

  const loadUsers = async () => {
    const allUsers = await getAllUsers();
    if (allUsers.length === 0) {
        // If DB is empty, save MOCK_USERS to DB so they can be edited
        for (const u of MOCK_USERS) {
            await saveUser(u);
        }
        setUsers(MOCK_USERS);
    } else {
        setUsers(allUsers);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    await saveUser(editingUser);
    setShowUserModal(false);
    setEditingUser(null);
    loadUsers();
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm('آیا از حذف این کاربر مطمئن هستید؟')) {
      await deleteUser(id);
      loadUsers();
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;
    
    try {
        const updatedUser = { ...user, password: newPassword };
        await saveUser(updatedUser);
        addToast('رمز عبور با موفقیت تغییر یافت. لطفاً دوباره وارد شوید.', 'success');
        setTimeout(() => {
            onLogout();
        }, 2000);
    } catch (e) {
        addToast('خطا در تغییر رمز عبور', 'error');
    }
  };

  const handleApproveAllPending = async () => {
    const pending = pdps.filter(p => {
        if (user.role === UserRole.HEAD_NURSE) return p.status === PDPStatus.SUBMITTED;
        if (user.role === UserRole.SUPERVISOR) {
            const isHN = p.jobCategory === JobCategory.SET_9_MANAGEMENT && p.bioData.orgPost === 'سرپرستار';
            return isHN ? p.status === PDPStatus.SUBMITTED : p.status === PDPStatus.APPROVED_BY_HN;
        }
        return false;
    });

    if (pending.length === 0) return;

    if (!confirm(`آیا از تایید تمامی ${pending.length} فرم منتظر بررسی اطمینان دارید؟`)) return;

    try {
        for (const pdp of pending) {
            const updatedResponses = pdp.responses.map(r => {
                const updated = { ...r };
                if (user.role === UserRole.HEAD_NURSE) updated.hnApproved = true;
                if (user.role === UserRole.SUPERVISOR) updated.supApproved = true;
                return updated;
            });

            const updatedPDP: PDPForm = {
                ...pdp,
                status: user.role === UserRole.HEAD_NURSE ? PDPStatus.APPROVED_BY_HN : PDPStatus.APPROVED_BY_SUP,
                responses: updatedResponses,
                headNurseComment: user.role === UserRole.HEAD_NURSE ? 'تایید کلی توسط سیستم' : pdp.headNurseComment,
                supervisorComment: user.role === UserRole.SUPERVISOR ? 'تایید کلی توسط سیستم' : pdp.supervisorComment
            };
            await updatePDP(updatedPDP.id, updatedPDP);
        }
        addToast(`${pending.length} فرم با موفقیت تایید شدند`, 'success');
        loadPDPs();
    } catch (e) {
        addToast('خطا در تایید فرم‌ها', 'error');
    }
  };

  const handleQuickApproveAll = async () => {
    if (!selectedPDP) return;
    
    const updatedResponses = localResponses.map(r => {
        const updated = { ...r };
        if (user.role === UserRole.HEAD_NURSE) updated.hnApproved = true;
        if (user.role === UserRole.SUPERVISOR) updated.supApproved = true;
        if (user.role === UserRole.MANAGER || user.role === UserRole.QUALITY_MANAGER) updated.managerApproved = true;
        return updated;
    });
    
    setLocalResponses(updatedResponses);
    
    // Determine next status
    let nextStatus = selectedPDP.status;
    if (user.role === UserRole.HEAD_NURSE) nextStatus = PDPStatus.APPROVED_BY_HN;
    else if (user.role === UserRole.SUPERVISOR) nextStatus = PDPStatus.APPROVED_BY_SUP;
    else if (user.role === UserRole.MANAGER) nextStatus = PDPStatus.APPROVED_BY_MANAGER;
    else if (user.role === UserRole.QUALITY_MANAGER) nextStatus = PDPStatus.APPROVED_BY_QM;
    
    const updatedPDP: PDPForm = {
        ...selectedPDP,
        status: nextStatus,
        responses: updatedResponses
    };
    
    await updatePDP(updatedPDP);
    setSelectedPDP(null);
    loadPDPs();
    alert('تمامی موارد تایید و به مرحله بعد ارسال شد.');
  };
  const loadPDPs = async () => {
    const all = await getAllPDPs();
    let filtered: PDPForm[] = [];

    if (user.role === UserRole.DEVELOPER) {
        filtered = all; // Developer sees everything
    }
    else if (user.role === UserRole.QUALITY_MANAGER) {
      // Quality Manager sees forms from non-clinical wards that are approved by Supervisor
      filtered = all.filter(p => {
        const isNonClinical = getWardType(p.ward) === WardType.NON_CLINICAL;
        return isNonClinical && (p.status === PDPStatus.APPROVED_BY_SUP || p.status === PDPStatus.APPROVED_BY_QM);
      });
    } 
    else if (user.role === UserRole.MANAGER) {
      // Nursing Manager sees forms from clinical wards that are approved by Supervisor
      filtered = all.filter(p => {
        const isClinical = getWardType(p.ward) === WardType.CLINICAL;
        return isClinical && (p.status === PDPStatus.APPROVED_BY_SUP || p.status === PDPStatus.APPROVED_BY_MANAGER);
      });
    } 
    else if (user.role === UserRole.SUPERVISOR) {
      // Supervisor sees forms approved by Head Nurse
      filtered = all.filter(p => p.status === PDPStatus.APPROVED_BY_HN || p.status === PDPStatus.APPROVED_BY_SUP);
    } 
    else if (user.role === UserRole.HEAD_NURSE) {
      // Head Nurse sees forms from their ward
      filtered = all.filter(p => p.ward === user.ward);
    }

    setPdps(filtered);
    setSelectedIds(new Set()); // Reset selection on reload
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openReview = (pdp: PDPForm) => {
    setSelectedPDP(pdp);
    setLocalResponses(JSON.parse(JSON.stringify(pdp.responses)));
    setComment(
        user.role === UserRole.HEAD_NURSE ? pdp.headNurseComment || '' :
        user.role === UserRole.SUPERVISOR ? pdp.supervisorComment || '' :
        user.role === UserRole.MANAGER ? pdp.managerComment || '' :
        user.role === UserRole.QUALITY_MANAGER ? pdp.qualityManagerComment || '' : ''
    );
    setShowCategoryStatsInReview(false);
  };

  // --- NOTIFICATION LOGIC ---
  const pendingCount = useMemo(() => {
    if (!pdps.length) return 0;
    if (user.role === UserRole.DEVELOPER) return 0;

    return pdps.filter(p => {
        if (user.role === UserRole.HEAD_NURSE) {
            return p.status === PDPStatus.SUBMITTED;
        }
        if (user.role === UserRole.SUPERVISOR) {
             const isHN = p.jobCategory === JobCategory.SET_9_MANAGEMENT && p.bioData.orgPost === 'سرپرستار';
             return isHN ? p.status === PDPStatus.SUBMITTED : p.status === PDPStatus.APPROVED_BY_HN;
        }
        if (user.role === UserRole.QUALITY_MANAGER) {
             return p.status === PDPStatus.SUBMITTED;
        }
        if (user.role === UserRole.MANAGER) {
             return p.status === PDPStatus.APPROVED_BY_SUP;
        }
        return false;
    }).length;
  }, [pdps, user]);

  // --- DEVELOPER ACTIONS ---
  
  const handleBackup = async () => {
    const data = await getAllPDPs();
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = "hassan_data_base.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // EXPORT ONLY PERSONAL BIO DATA
  const handleBioExport = () => {
      const csvRows = [];
      const headers = ['نام و نام خانوادگی', 'کد پرسنلی', 'کد ملی', 'بخش', 'سمت', 'مدرک تحصیلی', 'تاریخ استخدام', 'موبایل', 'تاریخ ثبت فرم', 'وضعیت فعلی'];
      csvRows.push(headers.join(','));

      pdps.forEach(p => {
          const row = [
              `"${p.bioData.fullName}"`,
              p.bioData.personnelId,
              p.bioData.nationalId,
              `"${p.ward}"`,
              `"${p.bioData.orgPost}"`,
              `"${p.bioData.education}"`,
              p.bioData.hireDate,
              p.bioData.mobile,
              p.submissionDate,
              p.status
          ];
          csvRows.push(row.join(','));
      });

      const csvString = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = "personnel_bio_data.csv";
      link.click();
  };

  // EXPORT FULL DATA
  const handleExcelExport = () => {
      const questionMap = new Map<string, string>();
      pdps.forEach(p => {
        p.responses.forEach(r => {
          if (!questionMap.has(r.questionId)) {
            questionMap.set(r.questionId, r.questionText);
          }
        });
      });

      const questionIds = Array.from(questionMap.keys());
      const headers = [
        'شناسه فرم',
        'نام و نام خانوادگی', 
        'کد پرسنلی', 
        'کد ملی', 
        'بخش', 
        'سمت', 
        'مدرک تحصیلی', 
        'تاریخ استخدام', 
        'موبایل', 
        'تاریخ ثبت', 
        'وضعیت',
        ...questionIds.map(id => `"${questionMap.get(id)?.replace(/"/g, '""')}"`)
      ];

      const csvRows = [headers.join(',')];

      pdps.forEach(p => {
        const responseMap = new Map<string, string>();
        p.responses.forEach(r => responseMap.set(r.questionId, r.answer));

        const row = [
          p.id,
          `"${p.bioData.fullName}"`,
          p.bioData.personnelId,
          p.bioData.nationalId,
          `"${p.ward}"`,
          `"${p.bioData.orgPost}"`,
          `"${p.bioData.education}"`,
          p.bioData.hireDate || '',
          p.bioData.mobile,
          p.submissionDate,
          p.status,
          ...questionIds.map(qid => {
             const ans = responseMap.get(qid) || '';
             return `"${ans.replace(/"/g, '""')}"`;
          })
        ];
        csvRows.push(row.join(','));
      });

      const csvString = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = "full_pdp_export.csv";
      link.click();
      URL.revokeObjectURL(url);
  };

  const handleRestoreClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          const content = event.target?.result as string;
          if (content) {
              const success = await restoreDatabase(content);
              if (success) {
                  alert('دیتابیس با موفقیت بازگردانی شد.');
                  loadPDPs();
              } else {
                  alert('خطا در بازخوانی فایل. لطفا مطمئن شوید فایل صحیح است.');
              }
          }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset input
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
      e.preventDefault();
      e.stopPropagation(); 
      const isConfirmed = window.confirm(`آیا مطمئن هستید که می‌خواهید فرم "${name}" را حذف کنید؟\nاین عملیات غیرقابل بازگشت است.`);
      if (isConfirmed) {
          await deletePDP(id);
          loadPDPs();
      }
  };

  const handleReset = async (e: React.MouseEvent, id: string, name: string) => {
      e.preventDefault();
      e.stopPropagation(); 
      const isConfirmed = window.confirm(`آیا مطمئن هستید که می‌خواهید نظرات و وضعیت فرم "${name}" را ریست کنید؟\nوضعیت به حالت "ارسال شده" برمی‌گردد.`);
      if (isConfirmed) {
          await resetPDPReview(id);
          loadPDPs();
      }
  };
  
  // Bulk Delete
  const toggleSelection = (id: string) => {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(id)) newSelected.delete(id);
      else newSelected.add(id);
      setSelectedIds(newSelected);
  };

  const toggleAllSelection = (filteredPdps: PDPForm[]) => {
      if (selectedIds.size === filteredPdps.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(filteredPdps.map(p => p.id)));
      }
  };

  const handleBulkDelete = async () => {
      if (selectedIds.size === 0) return;
      const isConfirmed = window.confirm(`آیا مطمئن هستید که می‌خواهید ${selectedIds.size} مورد را حذف کنید؟`);
      if (isConfirmed) {
          for (const id of selectedIds) {
              await deletePDP(id);
          }
          loadPDPs();
      }
  };


  // --- REVIEW LOGIC HANDLERS ---
  const handleApprovalChange = (qId: string, approved: boolean, role: 'HN' | 'SUP' | 'MGR') => {
    setLocalResponses(prev => prev.map(r => {
        if (r.questionId !== qId) return r;
        const updated = { ...r };
        if (role === 'HN') {
            updated.hnApproved = approved;
            if (approved) updated.hnOverride = undefined;
        } else if (role === 'SUP') {
            updated.supApproved = approved;
            if (approved) updated.supOverride = undefined;
        } else if (role === 'MGR') {
            updated.managerApproved = approved;
            if (approved) updated.managerOverride = undefined;
        }
        return updated;
    }));
  };

  const handleOverrideChange = (qId: string, value: string, role: 'HN' | 'SUP' | 'MGR') => {
    setLocalResponses(prev => prev.map(r => {
        if (r.questionId !== qId) return r;
        const updated = { ...r };
        if (role === 'HN') updated.hnOverride = value;
        else if (role === 'SUP') updated.supOverride = value;
        else if (role === 'MGR') updated.managerOverride = value;
        return updated;
    }));
  };

  const handleSaveComment = async () => {
     if (!selectedPDP) return;
     const updatedPDP = { ...selectedPDP, responses: localResponses };
     
     if (user.role === UserRole.HEAD_NURSE) updatedPDP.headNurseComment = comment;
     if (user.role === UserRole.SUPERVISOR) updatedPDP.supervisorComment = comment;
     if (user.role === UserRole.MANAGER) updatedPDP.managerComment = comment;
     if (user.role === UserRole.QUALITY_MANAGER) updatedPDP.qualityManagerComment = comment;

     await updatePDP(updatedPDP);
     alert('تغییرات و نظر شما با موفقیت ثبت شد.');
     loadPDPs();
     setSelectedPDP(updatedPDP);
  };

  const handleStatusChange = async (newStatus: PDPStatus) => {
    if (!selectedPDP) return;
    
    const updatedPDP: PDPForm = {
        ...selectedPDP,
        status: newStatus,
        responses: localResponses
    };

    if (user.role === UserRole.HEAD_NURSE) updatedPDP.headNurseComment = comment;
    if (user.role === UserRole.SUPERVISOR) updatedPDP.supervisorComment = comment;
    if (user.role === UserRole.MANAGER) updatedPDP.managerComment = comment;
    if (user.role === UserRole.QUALITY_MANAGER) updatedPDP.qualityManagerComment = comment;

    await updatePDP(updatedPDP);
    setSelectedPDP(null);
    loadPDPs();
  };

  const getRoleTitle = () => {
    switch (user.role) {
      case UserRole.HEAD_NURSE: return 'پنل سرپرستار';
      case UserRole.SUPERVISOR: return 'پنل سوپروایزر';
      case UserRole.MANAGER: return 'پنل مدیر پرستاری';
      case UserRole.QUALITY_MANAGER: return 'پنل مدیر بهبود کیفیت';
      case UserRole.DEVELOPER: return 'پنل توسعه‌دهنده';
      default: return 'داشبورد';
    }
  };

  const getQuestionOptions = (qId: string, categoryId: JobCategory) => {
    const config = JOB_CATEGORIES_CONFIG.find(c => c.id === categoryId);
    if (!config) return undefined;
    for (const sec of config.sections) {
        const q = sec.questions.find(q => q.id === qId);
        if (q) return q.options;
    }
    return undefined;
  };

  const groupResponsesBySection = (responses: QuestionResponse[]) => {
    const grouped: Record<string, QuestionResponse[]> = {};
    responses.forEach(r => {
      if (!grouped[r.section]) grouped[r.section] = [];
      grouped[r.section].push(r);
    });
    return grouped;
  };

  // --- ANALYTICS HELPER FUNCTIONS ---
  const getStatsByWard = () => {
    const counts: Record<string, number> = {};
    pdps.forEach(p => {
        counts[p.ward] = (counts[p.ward] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  };

  const getStatsByJobTitle = () => {
    const counts: Record<string, number> = {};
    pdps.forEach(p => {
        counts[p.bioData.orgPost] = (counts[p.bioData.orgPost] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  };

  const getFullQuestionStats = (categoryId: JobCategory) => {
     const config = JOB_CATEGORIES_CONFIG.find(c => c.id === categoryId);
     if (!config) return {};
     const categoryPdps = pdps.filter(p => p.jobCategory === categoryId);
     const stats: Record<string, { text: string, answers: Record<string, number>, total: number }> = {};
     config.sections.forEach(section => {
         section.questions.forEach(q => {
             stats[q.id] = { text: q.text, answers: {}, total: 0 };
         });
     });
     categoryPdps.forEach(p => {
         p.responses.forEach(r => {
             if (stats[r.questionId]) {
                 const val = r.answer;
                 if (val && val !== 'پاسخ داده نشده') {
                     const parts = val.split('، ');
                     parts.forEach(part => {
                         stats[r.questionId].answers[part] = (stats[r.questionId].answers[part] || 0) + 1;
                         stats[r.questionId].total += 1;
                     });
                 }
             }
         });
     });
     return stats;
  };

  const getGeneralAggregatedStats = () => {
    const stats: Record<string, { text: string, answers: Record<string, number>, total: number }> = {};
    pdps.forEach(p => {
        p.responses.forEach(r => {
            const isGeneral = r.questionId.startsWith('gen_') || r.questionId.startsWith('q_');
            if (isGeneral) {
                if (!stats[r.questionId]) {
                    stats[r.questionId] = { text: r.questionText, answers: {}, total: 0 };
                }
                const val = r.answer;
                if (val && val !== 'پاسخ داده نشده') {
                    const parts = val.split('، ');
                    parts.forEach(part => {
                        if (part.trim()) {
                            stats[r.questionId].answers[part] = (stats[r.questionId].answers[part] || 0) + 1;
                            stats[r.questionId].total += 1;
                        }
                    });
                }
            }
        });
    });
    return stats;
  };
  
  const getOpenEndedResponses = (categoryId: JobCategory) => {
     const categoryPdps = pdps.filter(p => p.jobCategory === categoryId);
     const responses: { text: string, user: string, ward: string }[] = [];
     categoryPdps.forEach(p => {
         const r = p.responses.find(res => res.questionId === 'q_unit_need');
         if (r && r.answer && r.answer !== 'پاسخ داده نشده' && r.answer.trim().length > 1) {
             responses.push({
                 text: r.answer,
                 user: p.nurseName,
                 ward: p.ward
             });
         }
     });
     return responses;
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // --- RENDERERS ---

  const renderCategoryStats = (categoryId: JobCategory) => {
      const config = JOB_CATEGORIES_CONFIG.find(c => c.id === categoryId);
      const stats = getFullQuestionStats(categoryId);
      const questionIds = Object.keys(stats);
      const openEnded = getOpenEndedResponses(categoryId);

      return (
        <div className="space-y-6 animate-in fade-in">
            <h4 className="font-bold text-lg text-omid-800 border-b pb-2">آمار تخصصی گروه: {config?.title}</h4>
            
            {openEnded.length > 0 && (
                <div className="bg-orange-50/70 p-4 rounded-lg border border-orange-100 shadow-sm mb-4 backdrop-blur-md">
                    <h5 className="font-bold text-orange-800 text-sm mb-3 flex items-center gap-2"><AlertCircle size={16}/> نیازهای آموزشی پیشنهادی (متنی)</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {openEnded.map((item, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => setSelectedFeedback(item)}
                                className="bg-white/60 p-3 rounded border border-orange-200 text-xs cursor-pointer hover:bg-orange-100 transition-colors"
                            >
                                <p className="text-gray-700 truncate">{item.text}</p>
                                <span className="text-gray-400 text-[10px] block mt-1">{item.user} - {item.ward}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {questionIds.map(qId => {
                const data = stats[qId];
                if (!data || Object.keys(data.answers).length === 0) return null;
                const sortedAnswers = Object.entries(data.answers).sort((a, b) => b[1] - a[1]);
                return (
                    <div key={qId} className="bg-white/60 p-4 rounded-lg border border-white/40 shadow-sm backdrop-blur-sm">
                        <p className="text-sm font-bold text-gray-700 mb-3">{data.text}</p>
                        {sortedAnswers.length > 0 ? (
                            <div className="space-y-2">
                                {sortedAnswers.map(([ans, count]) => {
                                    const percent = data.total > 0 ? Math.round((count / data.total) * 100) : 0;
                                    return (
                                        <div key={ans} className="relative h-6 bg-gray-100/80 rounded-md overflow-hidden flex items-center">
                                            <div className="absolute top-0 right-0 h-full bg-blue-100/80" style={{ width: `${percent}%` }}></div>
                                            <div className="relative z-10 flex justify-between w-full px-3 text-xs">
                                                <span className="font-medium text-gray-800 truncate w-3/4">{ans}</span>
                                                <span className="font-bold text-blue-800">{percent}% ({count})</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : <p className="text-xs text-gray-400">بدون داده</p>}
                    </div>
                );
            })}
        </div>
      );
  };

  const renderGeneralAggregatedStats = () => {
    const stats = getGeneralAggregatedStats();
    const questionIds = Object.keys(stats).sort();

    return (
        <div className="bg-white/60 p-6 rounded-3xl shadow-xl border border-white/40 mt-8 border-t-4 border-t-indigo-500 backdrop-blur-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-200 pb-4">
                <TrendingUp className="text-indigo-600" />
                آمار تجمیعی سوالات عمومی و کلی (کل بیمارستان)
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {questionIds.map(qId => {
                    const data = stats[qId];
                    const sortedAnswers = Object.entries(data.answers).sort((a, b) => b[1] - a[1]);
                    return (
                        <div key={qId} className="bg-white/40 p-5 rounded-2xl border border-white/60 shadow-sm hover:shadow-md transition-all">
                            <div className="mb-3">
                                <span className="text-xs font-bold text-indigo-500 bg-indigo-50/80 px-2 py-1 rounded mb-2 inline-block">
                                    {qId.startsWith('gen_a') ? 'آموزش عمومی (الف)' : 
                                     qId.startsWith('gen_b') ? 'کنترل عفونت (ب)' : 'سوالات کلی'}
                                </span>
                                <p className="text-sm font-bold text-gray-800 leading-6">{data.text}</p>
                            </div>
                            
                            {sortedAnswers.length > 0 ? (
                                <div className="space-y-3">
                                    {sortedAnswers.map(([ans, count]) => {
                                        const percent = data.total > 0 ? Math.round((count / data.total) * 100) : 0;
                                        return (
                                            <div key={ans}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="font-medium text-gray-700">{ans}</span>
                                                    <span className="font-bold text-indigo-700">{percent}% ({count} نفر)</span>
                                                </div>
                                                <div className="h-2 bg-gray-200/50 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${percent}%` }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <p className="text-xs text-gray-400">بدون داده</p>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  const renderManagerAnalytics = () => {
    const wardStats = getStatsByWard();
    const jobStats = getStatsByJobTitle();
    
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/50">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <BarChart2 className="text-blue-500" />
                        تعداد پاسخ‌دهندگان به تفکیک بخش
                    </h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                        {wardStats.map(([ward, count]) => (
                            <div key={ward} className="flex items-center gap-3 text-sm">
                                <div className="w-24 text-gray-600 truncate">{ward}</div>
                                <div className="flex-1 h-3 bg-gray-200/50 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full shadow-sm" style={{ width: `${(count / pdps.length) * 100}%` }}></div>
                                </div>
                                <div className="w-8 font-bold text-gray-800">{count}</div>
                            </div>
                        ))}
                    </div>
                </div>

                 <div className="bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/50">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Users className="text-purple-500" />
                        تعداد پاسخ‌دهندگان به تفکیک سمت
                    </h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                        {jobStats.map(([job, count]) => (
                            <div key={job} className="flex items-center gap-3 text-sm">
                                <div className="w-24 text-gray-600 truncate">{job}</div>
                                <div className="flex-1 h-3 bg-gray-200/50 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 rounded-full shadow-sm" style={{ width: `${(count / pdps.length) * 100}%` }}></div>
                                </div>
                                <div className="w-8 font-bold text-gray-800">{count}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white/60 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50">
                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-200 pb-4">
                    <PieChart className="text-omid-600" />
                    تحلیل تخصصی سوالات به تفکیک گروه شغلی
                </h3>
                
                <div className="space-y-8">
                    {JOB_CATEGORIES_CONFIG.map(cat => {
                        if (user.role === UserRole.QUALITY_MANAGER) {
                            if (cat.id !== JobCategory.SET_13_SUPPORT) return null;
                        } else {
                            if (cat.id === JobCategory.SET_13_SUPPORT) return null;
                        }
                        
                        return (
                            <div key={cat.id} className="bg-white/40 rounded-2xl p-6 border border-white/60 shadow-sm">
                                {renderCategoryStats(cat.id)}
                            </div>
                        );
                    })}
                </div>
            </div>
            
            {renderGeneralAggregatedStats()}
        </div>
    );
  };

  const renderFilteredTable = (filterRole: SeparatedTab) => {
     let filteredPdps = [];
     if (filterRole === 'SUPERVISOR') filteredPdps = pdps.filter(p => p.bioData.orgPost === 'سوپروایزر');
     else if (filterRole === 'HEAD_NURSE') filteredPdps = pdps.filter(p => p.bioData.orgPost === 'سرپرستار');
     else if (filterRole === 'STAFF') filteredPdps = pdps.filter(p => p.bioData.orgPost !== 'سوپروایزر' && p.bioData.orgPost !== 'سرپرستار');
     else if (filterRole === 'ADMIN') filteredPdps = pdps.filter(p => p.bioData.orgPost === 'اداری');
     else if (filterRole === 'SUPPORT') filteredPdps = pdps.filter(p => p.bioData.orgPost === 'پشتیبانی');
     else if (filterRole === 'OTHER') filteredPdps = pdps.filter(p => p.bioData.orgPost === 'سایر');

     return renderTable(filteredPdps);
  };

  const renderUserManagement = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-black text-gray-800 flex items-center gap-2">
          <Users className="text-omid-600" /> مدیریت کاربران (سوپروایزر و سرپرستار)
        </h3>
        <button 
          onClick={() => {
            setEditingUser({ id: Date.now().toString(), username: '', password: '', name: '', role: UserRole.HEAD_NURSE });
            setShowUserModal(true);
          }}
          className="bg-omid-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-omid-600/20 hover:bg-omid-700 transition-all"
        >
          <Plus size={20} /> افزودن کاربر جدید
        </button>
      </div>

      <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white/40 shadow-xl overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-gray-50/50 text-gray-500 text-xs font-bold uppercase tracking-wider">
            <tr>
              <th className="p-5">نام و نام خانوادگی</th>
              <th className="p-5">نقش</th>
              <th className="p-5">بخش / طبقه</th>
              <th className="p-5">نام کاربری</th>
              <th className="p-5">رمز عبور</th>
              <th className="p-5 text-center">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100/30">
            {users.filter(u => u.role !== UserRole.DEVELOPER).map(u => (
              <tr key={u.id} className="hover:bg-blue-50/30 transition-colors">
                <td className="p-5 font-bold text-gray-800">{u.name}</td>
                <td className="p-5">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                    u.role === UserRole.SUPERVISOR ? 'bg-purple-100 text-purple-700' : 
                    u.role === UserRole.HEAD_NURSE ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {u.role === UserRole.SUPERVISOR ? 'سوپروایزر' : 
                     u.role === UserRole.HEAD_NURSE ? 'سرپرستار' : 
                     u.role === UserRole.MANAGER ? 'مدیر پرستاری' : 'مدیر بهبود'}
                  </span>
                </td>
                <td className="p-5 text-gray-600 text-sm">
                  {u.ward ? `${u.ward} ${u.floor ? `(${u.floor})` : ''}` : '-'}
                </td>
                <td className="p-5 font-mono text-sm text-gray-500">{u.username}</td>
                <td className="p-5 font-mono text-sm text-gray-500">{u.password}</td>
                <td className="p-5">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => { setEditingUser(u); setShowUserModal(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16}/></button>
                    <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showUserModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-white/20">
            <div className="bg-gray-900 p-6 text-white text-center relative">
              <h3 className="text-xl font-black">{editingUser.id ? 'ویرایش کاربر' : 'افزودن کاربر جدید'}</h3>
              <button onClick={() => setShowUserModal(false)} className="absolute top-6 left-6 text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveUser} className="p-8 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">نام و نام خانوادگی</label>
                <input 
                  type="text" 
                  required
                  className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-omid-500"
                  value={editingUser.name}
                  onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">نقش</label>
                <select 
                  className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-omid-500"
                  value={editingUser.role}
                  onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})}
                >
                  <option value={UserRole.HEAD_NURSE}>سرپرستار</option>
                  <option value={UserRole.SUPERVISOR}>سوپروایزر</option>
                  <option value={UserRole.MANAGER}>مدیر پرستاری</option>
                  <option value={UserRole.QUALITY_MANAGER}>مدیر بهبود</option>
                </select>
              </div>
              {editingUser.role === UserRole.HEAD_NURSE && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2">بخش (نام بخش)</label>
                    <input 
                      type="text" 
                      className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-omid-500"
                      value={editingUser.ward}
                      onChange={e => setEditingUser({...editingUser, ward: e.target.value, wardType: getWardType(e.target.value)})}
                      placeholder="مثال: داخلی"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2">طبقه</label>
                    <input 
                      type="text" 
                      className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-omid-500"
                      value={editingUser.floor}
                      onChange={e => setEditingUser({...editingUser, floor: e.target.value})}
                      placeholder="مثال: اول"
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">نام کاربری</label>
                  <input 
                    type="text" 
                    required
                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-omid-500 font-mono"
                    value={editingUser.username}
                    onChange={e => setEditingUser({...editingUser, username: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">رمز عبور</label>
                  <input 
                    type="text" 
                    required
                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-omid-500 font-mono"
                    value={editingUser.password}
                    onChange={e => setEditingUser({...editingUser, password: e.target.value})}
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-omid-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-omid-600/20 hover:bg-omid-700 transition-all mt-4">ذخیره کاربر</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  const renderStatistics = () => {
    const stats = useMemo(() => {
        const total = pdps.length;
        const statusCounts = {
            [PDPStatus.SUBMITTED]: pdps.filter(p => p.status === PDPStatus.SUBMITTED).length,
            [PDPStatus.APPROVED_BY_HN]: pdps.filter(p => p.status === PDPStatus.APPROVED_BY_HN).length,
            [PDPStatus.APPROVED_BY_SUP]: pdps.filter(p => p.status === PDPStatus.APPROVED_BY_SUP).length,
            [PDPStatus.APPROVED_BY_MANAGER]: pdps.filter(p => p.status === PDPStatus.APPROVED_BY_MANAGER).length,
            [PDPStatus.APPROVED_BY_QM]: pdps.filter(p => p.status === PDPStatus.APPROVED_BY_QM).length,
            [PDPStatus.REJECTED]: pdps.filter(p => p.status === PDPStatus.REJECTED).length,
        };

        const wardCounts: Record<string, number> = {};
        pdps.forEach(p => {
            wardCounts[p.ward] = (wardCounts[p.ward] || 0) + 1;
        });

        return { total, statusCounts, wardCounts };
    }, [pdps]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                        <FileText size={24} />
                    </div>
                    <div className="text-3xl font-black text-gray-800">{stats.total}</div>
                    <div className="text-xs text-gray-400 font-bold uppercase mt-1">کل فرم‌های ثبت شده</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
                        <Check size={24} />
                    </div>
                    <div className="text-3xl font-black text-gray-800">{stats.statusCounts[PDPStatus.APPROVED_BY_MANAGER] + stats.statusCounts[PDPStatus.APPROVED_BY_QM]}</div>
                    <div className="text-xs text-gray-400 font-bold uppercase mt-1">تایید نهایی شده</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-3">
                        <AlertCircle size={24} />
                    </div>
                    <div className="text-3xl font-black text-gray-800">{stats.statusCounts[PDPStatus.SUBMITTED]}</div>
                    <div className="text-xs text-gray-400 font-bold uppercase mt-1">در انتظار بررسی</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                    <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <PieChart size={20} className="text-omid-600"/> توزیع وضعیت فرم‌ها
                    </h4>
                    <div className="space-y-4">
                        {Object.entries(stats.statusCounts).map(([status, count]) => (
                            <div key={status} className="flex items-center gap-4">
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs font-bold mb-1.5">
                                        <span className="text-gray-600">{status}</span>
                                        <span className="text-gray-400">{count} مورد ({stats.total > 0 ? Math.round((count / stats.total) * 100) : 0}٪)</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${status.includes('APPROVED') ? 'bg-green-500' : status === 'REJECTED' ? 'bg-red-500' : 'bg-blue-500'}`} 
                                            style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                    <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <BarChart2 size={20} className="text-omid-600"/> آمار به تفکیک بخش‌ها
                    </h4>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {Object.entries(stats.wardCounts).sort((a,b) => b[1] - a[1]).map(([ward, count]) => (
                            <div key={ward} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-sm font-bold text-gray-700">{ward}</span>
                                <span className="bg-white px-3 py-1 rounded-lg border border-gray-200 text-xs font-black text-omid-600 shadow-sm">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <TrendingUp size={20} className="text-omid-600"/> تحلیل سوالات تخصصی
                </h4>
                <p className="text-sm text-gray-500 mb-6">در این بخش می‌توانید فراوانی پاسخ‌ها به سوالات هر گروه شغلی را مشاهده کنید.</p>
                <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-3xl text-gray-400">
                    <PieChart size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-bold">انتخاب گروه شغلی جهت مشاهده تحلیل دقیق سوالات</p>
                </div>
            </div>
        </div>
    );
  };

  const renderManagerView = () => {
    const isPrimaryManager = user.username === 'manager' || user.username === 'behbood';
    
    const handleUserClick = (u: User) => {
        // Managers open "directly" in the same window
        const isManager = u.role === UserRole.MANAGER || u.role === UserRole.QUALITY_MANAGER;
        
        if (isManager) {
            localStorage.setItem('impersonating', 'true');
            window.location.href = `/?autoLogin=${u.username}`;
        } else {
            // Supervisors and Head Nurses open in new tab
            const url = `${window.location.origin}/?autoLogin=${u.username}`;
            window.open(url, '_blank');
        }
    };

    if (managerViewMode === 'CARDS') {
        // Show Card View for managers and developer
        const supervisors = users.filter(u => u.role === UserRole.SUPERVISOR).sort((a, b) => a.name.localeCompare(b.name, 'fa'));
        const headNurses = users.filter(u => u.role === UserRole.HEAD_NURSE);
        const otherManagers = users.filter(u => (u.role === UserRole.MANAGER || u.role === UserRole.QUALITY_MANAGER) && u.id !== user.id);
        
        return (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
                {otherManagers.length > 0 && (
                    <div>
                        <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
                            <ShieldCheck className="text-blue-600" /> سایر مدیران
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {otherManagers.map(m => (
                                <button 
                                    key={m.id}
                                    onClick={() => handleUserClick(m)} 
                                    className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all text-right group"
                                >
                                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <ShieldCheck size={24} />
                                    </div>
                                    <div className="font-bold text-gray-800">{m.name}</div>
                                    <div className="text-xs text-gray-400 mt-1">مشاهده کارتابل (مستقیم)</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
                        <UserPlus className="text-purple-600" /> سوپروایزرها
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {supervisors.map(s => (
                            <button 
                                key={s.id}
                                onClick={() => handleUserClick(s)} 
                                className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all text-right group"
                            >
                                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                    <UserPlus size={24} />
                                </div>
                                <div className="font-bold text-gray-800">{s.name}</div>
                                <div className="text-xs text-gray-400 mt-1">مشاهده کارتابل (صفحه جدید)</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-8">
                    <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <Users className="text-orange-600" /> سرپرستاران (به تفکیک طبقات)
                    </h3>
                    
                    {FLOOR_OPTIONS.map(floor => {
                        const floorHNs = headNurses.filter(hn => hn.floor === floor).sort((a, b) => a.name.localeCompare(b.name, 'fa'));
                        if (floorHNs.length === 0) return null;
                        
                        return (
                            <div key={floor} className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-px flex-1 bg-gray-100"></div>
                                    <span className="bg-gray-100 px-4 py-1 rounded-full text-xs font-black text-gray-500">{floor}</span>
                                    <div className="h-px flex-1 bg-gray-100"></div>
                                </div>
                                <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-200/50 shadow-inner">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {floorHNs.map(hn => (
                                            <button 
                                                key={hn.id}
                                                onClick={() => handleUserClick(hn)}
                                                className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all text-right group"
                                            >
                                                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                                    <Users size={24} />
                                                </div>
                                                <div className="font-bold text-gray-800">{hn.name}</div>
                                                <div className="text-xs text-gray-400 mt-1">بخش: {hn.ward}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <>
            {managerViewMode === 'ANALYTICS' && renderManagerAnalytics()}
            {managerViewMode === 'TABLE_SEPARATED' && (
                <div>
                    <div className="flex border-b border-gray-200 mb-6 overflow-x-auto pb-1">
                        {user.role === UserRole.MANAGER ? (
                            <>
                                <button onClick={() => setManagerTableTab('SUPERVISOR')} className={`pb-3 px-6 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${managerTableTab === 'SUPERVISOR' ? 'border-omid-500 text-omid-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>سوپروایزران</button>
                                <button onClick={() => setManagerTableTab('HEAD_NURSE')} className={`pb-3 px-6 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${managerTableTab === 'HEAD_NURSE' ? 'border-omid-500 text-omid-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>سرپرستاران</button>
                                <button onClick={() => setManagerTableTab('STAFF')} className={`pb-3 px-6 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${managerTableTab === 'STAFF' ? 'border-omid-500 text-omid-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>سایر پرسنل</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setManagerTableTab('ADMIN')} className={`pb-3 px-6 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${managerTableTab === 'ADMIN' ? 'border-omid-500 text-omid-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>اداری</button>
                                <button onClick={() => setManagerTableTab('SUPPORT')} className={`pb-3 px-6 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${managerTableTab === 'SUPPORT' ? 'border-omid-500 text-omid-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>پشتیبانی</button>
                                <button onClick={() => setManagerTableTab('OTHER')} className={`pb-3 px-6 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${managerTableTab === 'OTHER' ? 'border-omid-500 text-omid-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>سایر</button>
                            </>
                        )}
                    </div>
                    {renderFilteredTable(managerTableTab)}
                </div>
            )}
            {managerViewMode === 'TABLE_ALL' && renderTable(pdps)}
        </>
    );
  };

  const renderTable = (data: PDPForm[], showHeader = true) => {
    // 1. FILTER
    let processedData = data.filter(p => {
        const term = searchTerm.toLowerCase();
        return (
            p.nurseName.toLowerCase().includes(term) ||
            p.ward.toLowerCase().includes(term) ||
            p.bioData.orgPost.toLowerCase().includes(term) ||
            p.userId.includes(term)
        );
    });

    // 2. SORT
    if (sortConfig) {
        processedData.sort((a, b) => {
            let aValue = '';
            let bValue = '';
            
            switch(sortConfig.key) {
                case 'name': aValue = a.nurseName; bValue = b.nurseName; break;
                case 'ward': aValue = a.ward; bValue = b.ward; break;
                case 'date': aValue = a.submissionDate; bValue = b.submissionDate; break;
                case 'status': aValue = a.status; bValue = b.status; break;
                default: return 0;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    if (processedData.length === 0) return <div className="p-10 text-center text-gray-500 bg-white/40 rounded-2xl border border-dashed border-gray-300 backdrop-blur-sm">موردی یافت نشد.</div>;

    return (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 shadow-xl overflow-hidden">
            {/* Search Bar */}
            {showHeader && (
                <div className="p-4 border-b border-gray-200/50 bg-white/30 flex items-center gap-2">
                    <Search className="text-gray-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="جستجو در نام، کد پرسنلی، بخش یا سمت..." 
                        className="bg-transparent outline-none w-full text-sm font-medium placeholder-gray-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && <button onClick={() => setSearchTerm('')}><X size={16} className="text-gray-400 hover:text-red-500 transition-colors" /></button>}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                    {showHeader && (
                        <thead className="bg-gray-50/50 text-gray-500 text-xs uppercase font-bold tracking-wider">
                        <tr>
                            {user.role === UserRole.DEVELOPER && (
                                <th className="p-5 border-b border-gray-100 w-10 text-center">
                                    <input 
                                        type="checkbox" 
                                        onChange={() => toggleAllSelection(processedData)}
                                        checked={processedData.length > 0 && selectedIds.size === processedData.length}
                                        className="rounded border-gray-300 text-omid-600 focus:ring-omid-500"
                                    />
                                </th>
                            )}
                            <th className="p-5 border-b border-gray-100 w-10 text-center">#</th>
                            <th className="p-5 border-b border-gray-100 cursor-pointer hover:bg-gray-100/50 transition-colors" onClick={() => handleSort('name')}>
                                <div className="flex items-center gap-1">نام پرسنل {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                            </th>
                            <th className="p-5 border-b border-gray-100 cursor-pointer hover:bg-gray-100/50 transition-colors" onClick={() => handleSort('ward')}>
                                <div className="flex items-center gap-1">سمت / بخش {sortConfig?.key === 'ward' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                            </th>
                            <th className="p-5 border-b border-gray-100 cursor-pointer hover:bg-gray-100/50 transition-colors" onClick={() => handleSort('date')}>
                                <div className="flex items-center gap-1">تاریخ ثبت {sortConfig?.key === 'date' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                            </th>
                            <th className="p-5 border-b border-gray-100 text-center cursor-pointer hover:bg-gray-100/50 transition-colors" onClick={() => handleSort('status')}>
                                <div className="flex items-center justify-center gap-1">وضعیت {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                            </th>
                            <th className="p-5 border-b border-gray-100">عملیات</th>
                        </tr>
                        </thead>
                    )}
                    <tbody className="divide-y divide-gray-100/30">
                    {processedData.map((pdp, index) => {
                        const isHNApproved = pdp.status === PDPStatus.APPROVED_BY_HN || pdp.status === PDPStatus.APPROVED_BY_SUP || pdp.status === PDPStatus.APPROVED_BY_QM || pdp.status === PDPStatus.APPROVED_BY_MANAGER;
                        const isSupApproved = pdp.status === PDPStatus.APPROVED_BY_SUP || pdp.status === PDPStatus.APPROVED_BY_QM || pdp.status === PDPStatus.APPROVED_BY_MANAGER;
                        const isMgrApproved = pdp.status === PDPStatus.APPROVED_BY_MANAGER;
                        const isQmApproved = pdp.status === PDPStatus.APPROVED_BY_QM;
                        const isRejected = pdp.status === PDPStatus.REJECTED;
                        
                        const isSupportRole = pdp.jobCategory === JobCategory.SET_13_SUPPORT;

                        return (
                        <tr key={pdp.id} className={`hover:bg-blue-50/30 transition-colors group ${selectedIds.has(pdp.id) ? 'bg-blue-50/60' : ''}`}>
                        {user.role === UserRole.DEVELOPER && (
                            <td className="p-5 text-center">
                                <input 
                                    type="checkbox" 
                                    onChange={() => toggleSelection(pdp.id)}
                                    checked={selectedIds.has(pdp.id)}
                                    className="rounded border-gray-300 text-omid-600 focus:ring-omid-500"
                                />
                            </td>
                        )}
                        <td className="p-5 text-center text-gray-400 font-mono text-xs font-bold">{index + 1}</td>
                        <td className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-tr from-blue-100 to-white rounded-full flex items-center justify-center text-blue-600 font-bold text-sm shadow-sm border border-white">
                                {pdp.nurseName.charAt(0)}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-800">{pdp.nurseName}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">کد: {pdp.bioData.personnelId}</span>
                                        <span className="text-[10px] text-blue-500 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{pdp.bioData.education}</span>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td className="p-5">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-700">{pdp.ward}</span>
                                <span className="text-xs text-gray-400">{pdp.bioData.orgPost}</span>
                            </div>
                        </td>
                        <td className="p-5 text-gray-600 font-medium text-sm">{pdp.submissionDate}</td>
                        <td className="p-5 text-center">
                            <div className="flex flex-col gap-2 justify-center items-center">
                                {isRejected ? (
                                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold border border-red-200">رد شده</span>
                                ) : (
                                    <div className="flex flex-col gap-1 w-full max-w-[140px]">
                                        {/* Step 1: Head Nurse (if applicable) */}
                                        {pdp.jobCategory !== JobCategory.SET_9_MANAGEMENT && !isSupportRole && (
                                            <div className={`flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-bold border ${isHNApproved ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-600 border-orange-200 animate-pulse'}`}>
                                                <span>سرپرستار:</span>
                                                <span>{isHNApproved ? '✓ تایید' : '○ منتظر'}</span>
                                            </div>
                                        )}
                                        
                                        {/* Step 2: Supervisor (if applicable) */}
                                        {!isSupportRole && (
                                            <div className={`flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-bold border ${isSupApproved ? 'bg-purple-50 text-purple-700 border-purple-200' : (isHNApproved || pdp.jobCategory === JobCategory.SET_9_MANAGEMENT) ? 'bg-orange-50 text-orange-600 border-orange-200 animate-pulse' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                                <span>سوپروایزر:</span>
                                                <span>{isSupApproved ? '✓ تایید' : '○ منتظر'}</span>
                                            </div>
                                        )}

                                        {/* Step 3: Quality Manager (for support) */}
                                        {isSupportRole && (
                                            <div className={`flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-bold border ${isQmApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-600 border-orange-200 animate-pulse'}`}>
                                                <span>مدیر بهبود:</span>
                                                <span>{isQmApproved ? '✓ تایید' : '○ منتظر'}</span>
                                            </div>
                                        )}

                                        {/* Step 4: Nursing Manager (final) */}
                                        {!isSupportRole && (
                                            <div className={`flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-bold border ${isMgrApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isSupApproved ? 'bg-orange-50 text-orange-600 border-orange-200 animate-pulse' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                                <span>مدیر پرستاری:</span>
                                                <span>{isMgrApproved ? '✓ تایید' : '○ منتظر'}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </td>
                        <td className="p-5">
                        <div className="flex items-center gap-2">
                                <button 
                                onClick={() => openReview(pdp)}
                                className="bg-white/80 border border-omid-200 text-omid-600 hover:bg-omid-50 hover:border-omid-300 px-3.5 py-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shadow-sm whitespace-nowrap backdrop-blur-sm group-hover:bg-white"
                                >
                                <Eye size={16} />
                                بررسی
                                </button>
                                
                                {/* DEVELOPER ACTIONS */}
                                {user.role === UserRole.DEVELOPER && (
                                    <>
                                        <button 
                                            onClick={(e) => handleReset(e, pdp.id, pdp.nurseName)}
                                            className="bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 p-2 rounded-xl transition-all shadow-sm"
                                            title="پاکسازی نظرات و ریست وضعیت"
                                        >
                                            <RefreshCw size={16} />
                                        </button>
                                        <button 
                                            onClick={(e) => handleDelete(e, pdp.id, pdp.nurseName)}
                                            className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 p-2 rounded-xl transition-all shadow-sm"
                                            title="حذف کامل"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                )}
                        </div>
                        </td>
                        </tr>
                    )})}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  const renderSplitLists = () => {
    const pending = pdps.filter(p => {
        if (user.role === UserRole.HEAD_NURSE) return p.status === PDPStatus.SUBMITTED;
        if (user.role === UserRole.SUPERVISOR) {
            const isHN = p.jobCategory === JobCategory.SET_9_MANAGEMENT && p.bioData.orgPost === 'سرپرستار';
            return isHN ? p.status === PDPStatus.SUBMITTED : p.status === PDPStatus.APPROVED_BY_HN;
        }
        return false;
    });

    const history = pdps.filter(p => {
         if (user.role === UserRole.HEAD_NURSE) return p.status !== PDPStatus.SUBMITTED;
         if (user.role === UserRole.SUPERVISOR) {
             const isHN = p.jobCategory === JobCategory.SET_9_MANAGEMENT && p.bioData.orgPost === 'سرپرستار';
             return isHN ? p.status !== PDPStatus.SUBMITTED : p.status !== PDPStatus.APPROVED_BY_HN;
         }
         return false;
    });

    return (
        <div className="space-y-8">
            <div>
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-orange-600">
                    <List size={20}/> فرم‌های منتظر بررسی
                </h3>
                {renderTable(pending)}
            </div>

            <div>
                 <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-500 border-t pt-6">
                    <History size={20}/> تاریخچه بررسی‌ها
                </h3>
                {renderTable(history)}
            </div>
        </div>
    )
  };

  const isManagerOrQuality = user.role === UserRole.MANAGER || user.role === UserRole.QUALITY_MANAGER;
  const isDeveloper = user.role === UserRole.DEVELOPER;
  const showManagerTabs = isManagerOrQuality || isDeveloper;

  return (
    <div className="min-h-screen bg-gray-100 font-sans flex flex-col bg-[url('https://www.transparenttextures.com/patterns/subtle-grey.png')]">
      {/* TOAST CONTAINER */}
      <div className="fixed top-24 right-4 z-[100] flex flex-col gap-3 w-full max-w-[90%] md:max-w-sm">
          {toasts.map(toast => (
              <div key={toast.id} className={`${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} backdrop-blur-xl border shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-right duration-300`}>
                  <div className={`${toast.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'} p-2.5 rounded-xl shadow-inner shrink-0`}>
                      {toast.type === 'success' ? <Check size={22} /> : <AlertCircle size={22} />}
                  </div>
                  <div className="flex-1">
                      <h4 className="font-black text-gray-800 text-sm font-sans mb-0.5">{toast.type === 'success' ? 'موفقیت' : 'خطا'}</h4>
                      <p className="text-xs font-bold text-gray-600 font-sans leading-5">{toast.message}</p>
                  </div>
                  <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="text-gray-400 hover:text-gray-600 transition-colors bg-white/50 p-1 rounded-lg"><X size={16}/></button>
              </div>
          ))}
      </div>

      {/* Feedback Details Modal */}
      {selectedFeedback && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/20">
                  <div className="bg-orange-50/80 p-5 border-b border-orange-100 flex justify-between items-center">
                      <h3 className="font-bold text-orange-800">جزئیات نظر کاربر</h3>
                      <button onClick={() => setSelectedFeedback(null)} className="text-gray-500 hover:text-gray-800 bg-white/50 p-1 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="p-8">
                      <div className="flex items-center gap-4 mb-6">
                           <div className="bg-blue-100 p-3 rounded-full text-blue-600"><UserIcon size={24}/></div>
                           <div>
                               <p className="font-bold text-gray-800 text-lg">{selectedFeedback.user}</p>
                               <p className="text-sm text-gray-500 mt-1">بخش: {selectedFeedback.ward}</p>
                           </div>
                      </div>
                      <div className="bg-gray-50/80 p-5 rounded-2xl border border-gray-100 text-gray-700 leading-8 text-justify shadow-inner">
                          {selectedFeedback.text}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showBackToTop && (
        <button 
            onClick={scrollToTop}
            className="fixed bottom-12 left-6 z-50 p-3 rounded-full shadow-xl bg-omid-600 text-white hover:bg-omid-700 hover:scale-110 transition-all animate-in fade-in backdrop-blur-sm border border-white/20"
        >
            <ArrowUp size={24} />
        </button>
      )}

      <nav className="bg-white/70 backdrop-blur-xl shadow-sm px-6 py-4 flex justify-between items-center sticky top-0 z-30 border-b border-white/40">
        <div className="flex items-center gap-4">
          <div className={`${user.role === UserRole.DEVELOPER ? 'bg-gray-800' : 'bg-omid-600'} text-white p-3 rounded-2xl shadow-lg shadow-omid-500/20`}>
            {user.role === UserRole.DEVELOPER ? <Database size={24} /> : <FileText size={24} />}
          </div>
          <div>
            <h1 className="text-lg font-black text-gray-800 tracking-tight">{getRoleTitle()}</h1>
            <p className="text-xs text-gray-500 font-bold mt-0.5">{user.name} {user.ward ? `| بخش ${user.ward}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 relative">
            {localStorage.getItem('impersonating') === 'true' && (
                <button 
                    onClick={() => setShowDevPasswordModal(true)}
                    className="flex items-center gap-2 text-omid-600 hover:text-omid-700 transition-colors bg-omid-50 hover:bg-omid-100 px-4 py-2.5 rounded-xl text-sm font-bold border border-omid-100"
                >
                    <ShieldCheck size={18} />
                    <span>بازگشت به پنل توسعه‌دهنده</span>
                </button>
            )}
            <div className="relative">
                <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2.5 text-gray-500 hover:bg-gray-100/50 rounded-xl transition-colors relative"
                >
                    <Bell size={20} />
                    {pendingCount > 0 && (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
                    )}
                </button>
                
                {showNotifications && (
                    <div className="absolute top-full left-0 mt-2 w-72 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 p-5 z-50 animate-in slide-in-from-top-2 text-right">
                        <h4 className="font-bold text-gray-800 mb-3 text-sm border-b pb-2 flex items-center gap-2">
                            <Bell size={16} className="text-omid-500"/> اعلان‌ها
                        </h4>
                        {pendingCount > 0 ? (
                            <p className="text-sm text-gray-600 leading-6">
                                شما <span className="font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">{pendingCount}</span> فرم جدید منتظر بررسی دارید.
                            </p>
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-2">در حال حاضر اعلانی وجود ندارد.</p>
                        )}
                    </div>
                )}
            </div>

            <div className="h-8 w-px bg-gray-300/50 mx-2"></div>
            <button 
                onClick={() => setShowChangePasswordModal(true)}
                className="p-2.5 text-gray-500 hover:bg-gray-100/50 rounded-xl transition-colors"
                title="تغییر رمز عبور"
            >
                <Settings size={20} />
            </button>
            <button onClick={onLogout} className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors bg-gray-100/50 hover:bg-red-50 px-4 py-2.5 rounded-xl text-sm font-bold border border-transparent hover:border-red-100">
            <LogOut size={18} />
            <span>خروج</span>
            </button>
        </div>
      </nav>

      <main className="p-6 md:p-8 max-w-[1600px] mx-auto flex-grow w-full">
        
        {/* DEVELOPER DASHBOARD HEADER ACTIONS */}
        {isDeveloper && !selectedPDP && (
             <div className="bg-gray-800/90 backdrop-blur-xl text-white p-8 rounded-3xl shadow-2xl mb-10 animate-in slide-in-from-top-4 border border-gray-700/50 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                 <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                     <div>
                         <h2 className="text-2xl font-black mb-2 flex items-center gap-2"><Database size={24}/> مدیریت پایگاه داده</h2>
                         <p className="text-gray-400 text-sm font-medium">دسترسی کامل به تمام داده‌ها، پشتیبان‌گیری و خروجی اکسل.</p>
                     </div>
                     <div className="flex flex-wrap gap-3 justify-center md:justify-end">
                         <button onClick={() => loadPDPs()} className="bg-gray-700/80 hover:bg-gray-600 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg border border-gray-600 hover:-translate-y-0.5" title="بارگذاری مجدد">
                             <RefreshCw size={18} /> رفرش
                         </button>
                         <button onClick={handleBackup} className="bg-blue-600/80 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/50 backdrop-blur-sm hover:-translate-y-0.5 border border-blue-500/50">
                             <Download size={18} /> دانلود بکاپ
                         </button>
                         <button onClick={handleRestoreClick} className="bg-orange-600/80 hover:bg-orange-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-orange-900/50 backdrop-blur-sm hover:-translate-y-0.5 border border-orange-500/50">
                             <Upload size={18} /> بازگردانی
                         </button>
                         <button onClick={handleExcelExport} className="bg-emerald-600/80 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/50 backdrop-blur-sm hover:-translate-y-0.5 border border-emerald-500/50">
                             <FileSpreadsheet size={18} /> خروجی کامل
                         </button>
                         {/* NEW EXPORT BUTTON */}
                         <button onClick={() => setManagerViewMode('USERS')} className="bg-purple-600/80 hover:bg-purple-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-purple-900/50 backdrop-blur-sm hover:-translate-y-0.5 border border-purple-500/50">
                             <Key size={18} /> مدیریت رمز عبور
                         </button>
                         <button onClick={handleBioExport} className="bg-teal-600/80 hover:bg-teal-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-teal-900/50 backdrop-blur-sm hover:-translate-y-0.5 border border-teal-500/50">
                             <Contact size={18} /> خروجی پرسنلی
                         </button>
                         <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                     </div>
                 </div>
                 
                 {/* BULK ACTIONS FOR DEVELOPER */}
                 {selectedIds.size > 0 && (
                     <div className="mt-6 pt-6 border-t border-gray-700/50 flex items-center justify-between animate-in fade-in">
                         <span className="text-sm font-bold text-blue-300 bg-blue-900/30 px-3 py-1 rounded-lg border border-blue-800">{selectedIds.size} مورد انتخاب شده</span>
                         <button 
                            onClick={handleBulkDelete}
                            className="bg-red-500/90 hover:bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-red-900/50 border border-red-500/50 hover:-translate-y-0.5 transition-all"
                         >
                             <Trash2 size={16}/> حذف موارد انتخاب شده
                         </button>
                     </div>
                 )}
             </div>
        )}

        {selectedPDP ? (
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gray-50/80 px-8 py-5 border-b border-gray-200 flex justify-between items-center sticky top-0 backdrop-blur-md z-10">
              <h2 className="text-xl font-black flex items-center gap-3 text-gray-800">
                <span className="bg-gradient-to-tr from-omid-600 to-blue-500 text-white w-10 h-10 rounded-xl flex items-center justify-center text-sm shadow-lg shadow-blue-500/20">{localResponses.length}</span>
                بررسی فرم PDP - {selectedPDP.nurseName}
              </h2>
              
              <div className="flex gap-2">
                  {(user.role === UserRole.HEAD_NURSE || user.role === UserRole.SUPERVISOR || user.role === UserRole.MANAGER || user.role === UserRole.QUALITY_MANAGER) && (
                      <button 
                        onClick={handleQuickApproveAll}
                        className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-200 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-sm"
                        title="تایید سریع تمامی موارد"
                      >
                        <Key size={18} />
                        تایید کلی
                      </button>
                  )}
                  {isManagerOrQuality && (
                      <button 
                        onClick={() => setShowCategoryStatsInReview(!showCategoryStatsInReview)}
                        className="text-omid-600 bg-white hover:bg-blue-50 border border-omid-200 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-sm"
                      >
                        <PieChart size={18} />
                        {showCategoryStatsInReview ? 'بستن آمار' : 'مشاهده آمار گروه'}
                      </button>
                  )}
                  <button onClick={() => setSelectedPDP(null)} className="text-gray-400 hover:text-gray-800 bg-white p-2.5 rounded-xl border hover:shadow-md transition-all">
                    <X size={20} />
                  </button>
              </div>
            </div>

            {showCategoryStatsInReview && selectedPDP && (
                <div className="bg-blue-50/50 p-8 border-b border-blue-100 animate-in slide-in-from-top-4">
                    {renderCategoryStats(selectedPDP.jobCategory)}
                </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 lg:p-10">
              <div className="lg:col-span-2 space-y-8">
                {/* Approval Pipeline Summary */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
                        <Activity size={18} className="text-omid-600" /> وضعیت تاییدات فرم
                    </h3>
                    <div className="flex flex-wrap gap-4">
                        {selectedPDP.jobCategory !== JobCategory.SET_9_MANAGEMENT && (
                            <div className={`flex-1 min-w-[120px] p-3 rounded-2xl border flex flex-col items-center gap-1 ${selectedPDP.status === PDPStatus.SUBMITTED ? 'bg-orange-50 border-orange-200 animate-pulse' : 'bg-green-50 border-green-200'}`}>
                                <span className="text-[10px] font-bold text-gray-500">سرپرستار</span>
                                <span className={`text-xs font-black ${selectedPDP.status === PDPStatus.SUBMITTED ? 'text-orange-600' : 'text-green-600'}`}>
                                    {selectedPDP.status === PDPStatus.SUBMITTED ? 'در انتظار' : 'تایید شده'}
                                </span>
                            </div>
                        )}
                        <div className={`flex-1 min-w-[120px] p-3 rounded-2xl border flex flex-col items-center gap-1 ${(selectedPDP.status === PDPStatus.APPROVED_BY_HN || (selectedPDP.jobCategory === JobCategory.SET_9_MANAGEMENT && selectedPDP.status === PDPStatus.SUBMITTED)) ? 'bg-orange-50 border-orange-200 animate-pulse' : (selectedPDP.status === PDPStatus.APPROVED_BY_SUP || selectedPDP.status === PDPStatus.APPROVED_BY_MANAGER || selectedPDP.status === PDPStatus.APPROVED_BY_QM) ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                            <span className="text-[10px] font-bold text-gray-500">سوپروایزر</span>
                            <span className={`text-xs font-black ${(selectedPDP.status === PDPStatus.APPROVED_BY_HN || (selectedPDP.jobCategory === JobCategory.SET_9_MANAGEMENT && selectedPDP.status === PDPStatus.SUBMITTED)) ? 'text-orange-600' : (selectedPDP.status === PDPStatus.APPROVED_BY_SUP || selectedPDP.status === PDPStatus.APPROVED_BY_MANAGER || selectedPDP.status === PDPStatus.APPROVED_BY_QM) ? 'text-green-600' : 'text-gray-400'}`}>
                                {(selectedPDP.status === PDPStatus.APPROVED_BY_HN || (selectedPDP.jobCategory === JobCategory.SET_9_MANAGEMENT && selectedPDP.status === PDPStatus.SUBMITTED)) ? 'در انتظار' : (selectedPDP.status === PDPStatus.APPROVED_BY_SUP || selectedPDP.status === PDPStatus.APPROVED_BY_MANAGER || selectedPDP.status === PDPStatus.APPROVED_BY_QM) ? 'تایید شده' : 'معلق'}
                            </span>
                        </div>
                        <div className={`flex-1 min-w-[120px] p-3 rounded-2xl border flex flex-col items-center gap-1 ${selectedPDP.status === PDPStatus.APPROVED_BY_SUP ? 'bg-orange-50 border-orange-200 animate-pulse' : selectedPDP.status === PDPStatus.APPROVED_BY_MANAGER ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                            <span className="text-[10px] font-bold text-gray-500">مدیر پرستاری</span>
                            <span className={`text-xs font-black ${selectedPDP.status === PDPStatus.APPROVED_BY_SUP ? 'text-orange-600' : selectedPDP.status === PDPStatus.APPROVED_BY_MANAGER ? 'text-green-600' : 'text-gray-400'}`}>
                                {selectedPDP.status === PDPStatus.APPROVED_BY_SUP ? 'در انتظار' : selectedPDP.status === PDPStatus.APPROVED_BY_MANAGER ? 'تایید شده' : 'معلق'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Full Bio Data for Review */}
                {selectedPDP.bioData && (
                  <div className="bg-blue-50/40 backdrop-blur-md border border-blue-100/60 rounded-3xl p-6 shadow-sm">
                    <h3 className="font-bold text-blue-900 mb-6 flex items-center gap-2 text-lg">
                      <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><UserIcon size={20} /></div> اطلاعات پرسنلی کامل
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12 text-sm">
                      <div className="flex items-center justify-between border-b border-blue-200/50 pb-2">
                          <span className="text-gray-500">نام و نام خانوادگی:</span> 
                          <span className="font-bold text-gray-800 text-base">{selectedPDP.bioData.fullName}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-blue-200/50 pb-2">
                          <span className="text-gray-500">کد پرسنلی:</span> 
                          <span className="font-bold text-gray-800 text-base font-mono">{selectedPDP.bioData.personnelId}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-blue-200/50 pb-2">
                          <span className="text-gray-500">پست سازمانی:</span> 
                          <span className="font-bold text-gray-800 text-base">{selectedPDP.bioData.orgPost}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-blue-200/50 pb-2">
                          <span className="text-gray-500">بخش محل خدمت:</span> 
                          <span className="font-bold text-gray-800 text-base">{selectedPDP.ward}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-blue-200/50 pb-2">
                          <span className="text-gray-500">مدرک تحصیلی:</span> 
                          <span className="font-bold text-gray-800 text-base">{selectedPDP.bioData.education}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-blue-200/50 pb-2">
                          <span className="text-gray-500">تاریخ استخدام:</span> 
                          <span className="font-bold text-gray-800 text-base font-mono">{selectedPDP.bioData.hireDate || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-blue-200/50 pb-2">
                          <span className="text-gray-500">کد ملی:</span> 
                          <span className="font-bold text-gray-800 tracking-wider text-base font-mono">{selectedPDP.bioData.nationalId}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-blue-200/50 pb-2">
                          <span className="text-gray-500">شماره موبایل:</span> 
                          <span className="font-bold text-gray-800 tracking-wider text-base font-mono">{selectedPDP.bioData.mobile}</span>
                      </div>
                    </div>
                  </div>
                )}

                {Object.entries(groupResponsesBySection(localResponses)).map(([section, responses], idx) => {
                    // Hide General Questions for non-Managers/Devs
                    if (section === 'سوالات کلی' && !isManagerOrQuality && !isDeveloper) {
                        return null;
                    }

                    return (
                        <div key={idx} className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm bg-white/60">
                            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100">
                                <h3 className="font-bold text-gray-800 text-base">{section}</h3>
                            </div>
                            <div className="p-6 space-y-8">
                            {responses.map((resp, rIdx) => {
                                const options = getQuestionOptions(resp.questionId, selectedPDP.jobCategory);
                                const isHeadNurse = user.role === UserRole.HEAD_NURSE;
                                const isSupervisor = user.role === UserRole.SUPERVISOR;
                                const isManager = user.role === UserRole.MANAGER;
                                const isQualityManager = user.role === UserRole.QUALITY_MANAGER;
                                
                                return (
                                <div key={rIdx} className="border-b border-gray-50 pb-8 last:border-0 last:pb-0">
                                <p className="text-sm font-bold text-gray-700 mb-4">{resp.questionText}</p>
                                
                                <div className="flex flex-col md:flex-row md:items-start gap-4">
                                    <div className="flex-1 bg-white p-4 rounded-xl border border-gray-200 text-gray-700 text-sm leading-7 shadow-sm">
                                        <span className="text-xs text-blue-500 font-bold block mb-2">پاسخ پرسنل:</span>
                                        {resp.answer}
                                    </div>

                                    <div className="flex flex-col gap-3 min-w-[220px]">
                                        {(isHeadNurse || isSupervisor || isManager || isQualityManager) && (
                                            <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${resp.hnApproved === true ? 'bg-green-50 border-green-200' : resp.hnApproved === false ? 'bg-orange-50 border-orange-200' : 'bg-gray-50/50 border-gray-200'}`}>
                                                <span className="font-bold text-gray-500">سرپرستار:</span>
                                                {isHeadNurse ? (
                                                    <div className="flex gap-1.5">
                                                        <button onClick={() => handleApprovalChange(resp.questionId, true, 'HN')} className={`p-1.5 rounded-lg transition-colors ${resp.hnApproved ? 'bg-green-500 text-white shadow-sm' : 'bg-gray-200 hover:bg-green-200 text-gray-400'}`}><Check size={14} /></button>
                                                        <button onClick={() => handleApprovalChange(resp.questionId, false, 'HN')} className={`p-1.5 rounded-lg transition-colors ${resp.hnApproved === false ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-200 hover:bg-red-200 text-gray-400'}`}><X size={14} /></button>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        {resp.hnApproved === true && <span className="flex items-center gap-1 text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded-md"><Check size={12}/>تایید</span>}
                                                        {resp.hnApproved === false && <span className="flex items-center gap-1 text-orange-600 font-bold bg-orange-100 px-2 py-0.5 rounded-md"><X size={12}/>رد</span>}
                                                        {resp.hnApproved === undefined && <span className="text-gray-400">-</span>}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {resp.hnApproved === false && (
                                            <div className="text-xs animate-in fade-in space-y-2">
                                                {isHeadNurse ? (
                                                    <>
                                                        {options ? 
                                                        <select className="w-full p-2 border rounded-lg bg-white" value={resp.hnOverride || ''} onChange={(e) => handleOverrideChange(resp.questionId, e.target.value, 'HN')}><option value="">انتخاب اصلاحیه...</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select> 
                                                        : <input className="w-full p-2 border rounded-lg bg-white" placeholder="متن اصلاحیه..." value={resp.hnOverride || ''} onChange={(e) => handleOverrideChange(resp.questionId, e.target.value, 'HN')} />
                                                        }
                                                        <textarea 
                                                            className="w-full p-2 border rounded-lg bg-white text-[10px]" 
                                                            placeholder="دلیل رد یا توضیح..." 
                                                            value={resp.hnReason || ''} 
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setLocalResponses(prev => prev.map(r => r.questionId === resp.questionId ? { ...r, hnReason: val } : r));
                                                            }}
                                                        />
                                                    </>
                                                ) : (
                                                    <div className="bg-orange-50 p-2 rounded-lg border border-orange-100">
                                                        <div className="text-orange-700 italic">" {resp.hnOverride} "</div>
                                                        {resp.hnReason && <div className="text-[10px] text-orange-600 mt-1 font-bold">دلیل: {resp.hnReason}</div>}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {(isSupervisor || isManager || isQualityManager) && (
                                            <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${resp.supApproved === true ? 'bg-green-50 border-green-200' : resp.supApproved === false ? 'bg-purple-50 border-purple-200' : 'bg-gray-50/50 border-gray-200'}`}>
                                                <span className="font-bold text-gray-500">سوپروایزر:</span>
                                                {isSupervisor ? (
                                                    <div className="flex gap-1.5">
                                                        <button onClick={() => handleApprovalChange(resp.questionId, true, 'SUP')} className={`p-1.5 rounded-lg transition-colors ${resp.supApproved ? 'bg-green-500 text-white shadow-sm' : 'bg-gray-200 hover:bg-green-200 text-gray-400'}`}><Check size={14} /></button>
                                                        <button onClick={() => handleApprovalChange(resp.questionId, false, 'SUP')} className={`p-1.5 rounded-lg transition-colors ${resp.supApproved === false ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-200 hover:bg-red-200 text-gray-400'}`}><X size={14} /></button>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        {resp.supApproved === true && <span className="flex items-center gap-1 text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded-md"><Check size={12}/>تایید</span>}
                                                        {resp.supApproved === false && <span className="flex items-center gap-1 text-purple-600 font-bold bg-purple-100 px-2 py-0.5 rounded-md"><X size={12}/>رد</span>}
                                                        {resp.supApproved === undefined && <span className="text-gray-400">-</span>}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {resp.supApproved === false && (
                                            <div className="text-xs animate-in fade-in space-y-2">
                                                {isSupervisor ? (
                                                    <>
                                                        {options ? 
                                                        <select className="w-full p-2 border rounded-lg bg-white" value={resp.supOverride || ''} onChange={(e) => handleOverrideChange(resp.questionId, e.target.value, 'SUP')}><option value="">انتخاب اصلاحیه...</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select> 
                                                        : <input className="w-full p-2 border rounded-lg bg-white" placeholder="متن اصلاحیه..." value={resp.supOverride || ''} onChange={(e) => handleOverrideChange(resp.questionId, e.target.value, 'SUP')} />
                                                        }
                                                        <textarea 
                                                            className="w-full p-2 border rounded-lg bg-white text-[10px]" 
                                                            placeholder="دلیل رد یا توضیح..." 
                                                            value={resp.supReason || ''} 
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setLocalResponses(prev => prev.map(r => r.questionId === resp.questionId ? { ...r, supReason: val } : r));
                                                            }}
                                                        />
                                                    </>
                                                ) : (
                                                    <div className="bg-purple-50 p-2 rounded-lg border border-purple-100">
                                                        <div className="text-purple-700 italic">" {resp.supOverride} "</div>
                                                        {resp.supReason && <div className="text-[10px] text-purple-600 mt-1 font-bold">دلیل: {resp.supReason}</div>}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {(isManager || isQualityManager) && (
                                            <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${resp.managerApproved === true ? 'bg-green-50 border-green-200' : resp.managerApproved === false ? 'bg-blue-50 border-blue-200' : 'bg-gray-50/50 border-gray-200'}`}>
                                                <span className="font-bold text-gray-500">
                                                   {isQualityManager ? 'مدیر بهبود:' : 'مدیر پرستاری:'}
                                                </span>
                                                <div className="flex gap-1.5">
                                                    <button onClick={() => handleApprovalChange(resp.questionId, true, 'MGR')} className={`p-1.5 rounded-lg transition-colors ${resp.managerApproved ? 'bg-green-500 text-white shadow-sm' : 'bg-gray-200 hover:bg-green-200 text-gray-400'}`}><Check size={14} /></button>
                                                    <button onClick={() => handleApprovalChange(resp.questionId, false, 'MGR')} className={`p-1.5 rounded-lg transition-colors ${resp.managerApproved === false ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-200 hover:bg-red-200 text-gray-400'}`}><X size={14} /></button>
                                                </div>
                                            </div>
                                        )}
                                        {resp.managerApproved === false && (
                                            <div className="text-xs animate-in fade-in space-y-2">
                                                {options ? 
                                                <select className="w-full p-2 border rounded-lg bg-white" value={resp.managerOverride || ''} onChange={(e) => handleOverrideChange(resp.questionId, e.target.value, 'MGR')}><option value="">انتخاب اصلاحیه...</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select> 
                                                : <input className="w-full p-2 border rounded-lg bg-white" placeholder="متن اصلاحیه..." value={resp.managerOverride || ''} onChange={(e) => handleOverrideChange(resp.questionId, e.target.value, 'MGR')} />
                                                }
                                                <textarea 
                                                    className="w-full p-2 border rounded-lg bg-white text-[10px]" 
                                                    placeholder="دلیل رد یا توضیح..." 
                                                    value={resp.managerReason || ''} 
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setLocalResponses(prev => prev.map(r => r.questionId === resp.questionId ? { ...r, managerReason: val } : r));
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                </div>
                            )})}
                            </div>
                        </div>
                    );
                })}
              </div>

              {/* Right Column: Sidebar */}
              <div className="lg:col-span-1 space-y-6">
                <div className="sticky top-24 space-y-6">
                  <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-xl">
                    <h3 className="font-bold text-gray-800 mb-6 text-lg flex items-center gap-2"><FileText size={20} className="text-omid-600"/>اقدامات و نظرات</h3>
                    
                    {/* PREVIOUS COMMENTS - READ ONLY */}
                    {(user.role === UserRole.MANAGER || user.role === UserRole.QUALITY_MANAGER || isDeveloper) && (
                        <div className="space-y-3 mb-6">
                            {selectedPDP.headNurseComment && (
                                <div className="bg-orange-50/50 p-3 rounded-2xl border border-orange-100 text-sm">
                                    <span className="font-bold text-orange-600 block mb-1 text-xs">نظر سرپرستار:</span>
                                    <p className="text-gray-700 leading-6">{selectedPDP.headNurseComment}</p>
                                </div>
                            )}
                             {selectedPDP.supervisorComment && (
                                <div className="bg-purple-50/50 p-3 rounded-2xl border border-purple-100 text-sm">
                                    <span className="font-bold text-purple-600 block mb-1 text-xs">نظر سوپروایزر:</span>
                                    <p className="text-gray-700 leading-6">{selectedPDP.supervisorComment}</p>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Only show comment box if NOT developer (Devs use Reset button) */}
                    {!isDeveloper && (
                        <div className="mb-4">
                        <textarea 
                            className="w-full border rounded-2xl p-4 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none bg-gray-50/50 transition-all resize-none" 
                            rows={4} 
                            placeholder={
                                user.role === UserRole.MANAGER ? "نظر نهایی مدیر پرستاری..." : 
                                user.role === UserRole.QUALITY_MANAGER ? "نظر نهایی مدیر بهبود کیفیت..." :
                                "توضیحات و نظر کلی..."
                            }
                            value={comment} 
                            onChange={(e) => setComment(e.target.value)} 
                        />
                        <button 
                            onClick={handleSaveComment} 
                            className="mt-3 w-full bg-indigo-600 text-white h-12 rounded-xl text-base font-bold hover:bg-indigo-700 flex justify-center items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5"
                        >
                            <Save size={18} /> 
                            ثبت نظر موقت
                        </button>
                        </div>
                    )}
                    
                    <div className="flex flex-col gap-3 border-t border-gray-100 pt-6">
                      {user.role === UserRole.HEAD_NURSE && (
                         <button onClick={() => handleStatusChange(PDPStatus.APPROVED_BY_HN)} className="bg-gradient-to-l from-green-500 to-emerald-600 text-white py-3.5 rounded-xl text-sm font-bold hover:shadow-lg transition-all flex justify-center items-center gap-2"><Check size={18} /> تایید و ارسال به سوپروایزر</button>
                      )}
                      {user.role === UserRole.SUPERVISOR && (
                         <button onClick={() => handleStatusChange(PDPStatus.APPROVED_BY_SUP)} className="bg-gradient-to-l from-green-500 to-emerald-600 text-white py-3.5 rounded-xl text-sm font-bold hover:shadow-lg transition-all flex justify-center items-center gap-2"><Check size={18} /> تایید و ارسال به مدیر پرستاری</button>
                      )}
                      {user.role === UserRole.QUALITY_MANAGER && (
                         <button onClick={() => handleStatusChange(PDPStatus.APPROVED_BY_QM)} className="bg-gradient-to-l from-emerald-500 to-teal-600 text-white py-3.5 rounded-xl text-sm font-bold hover:shadow-lg transition-all flex justify-center items-center gap-2"><Check size={18} /> تایید نهایی</button>
                      )}
                      {user.role === UserRole.MANAGER && (
                         <button onClick={() => handleStatusChange(PDPStatus.APPROVED_BY_MANAGER)} className="bg-gradient-to-l from-emerald-600 to-teal-700 text-white py-3.5 rounded-xl text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 shadow-md"><Check size={20} /> تایید نهایی و بستن پرونده</button>
                      )}
                      
                      {!isDeveloper && (
                          <button onClick={() => handleStatusChange(PDPStatus.REJECTED)} className="bg-white text-red-500 py-3.5 rounded-xl text-sm font-bold hover:bg-red-50 border border-red-100 flex justify-center items-center gap-2 mt-2"><X size={18} /> رد و بازگشت به پرسنل</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-xl border border-white/60 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
            <div className="p-8 border-b border-gray-200/50 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-black text-gray-800 tracking-tight">کارتابل الکترونیک PDP</h2>
              </div>
              {(isManagerOrQuality || isDeveloper) && (
                  <div className="flex gap-1 bg-gray-100/50 p-1.5 rounded-xl border border-gray-200/50">
                      {(isManagerOrQuality || isDeveloper) && (
                          <button onClick={() => setManagerViewMode('CARDS')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${managerViewMode === 'CARDS' ? 'bg-white shadow-sm text-omid-600' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}><Users size={18}/>پنل مدیریتی</button>
                      )}
                      {isDeveloper && (
                          <button onClick={() => setManagerViewMode('USERS')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${managerViewMode === 'USERS' ? 'bg-white shadow-sm text-omid-600' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}><ShieldCheck size={18}/>کاربران</button>
                      )}
                      <button onClick={() => setManagerViewMode('TABLE_ALL')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${managerViewMode === 'TABLE_ALL' ? 'bg-white shadow-sm text-omid-600' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}><List size={18}/>کلی</button>
                      <button onClick={() => setManagerViewMode('TABLE_SEPARATED')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${managerViewMode === 'TABLE_SEPARATED' ? 'bg-white shadow-sm text-omid-600' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}><Filter size={18}/>تفکیکی</button>
                      <button onClick={() => setManagerViewMode('ANALYTICS')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${managerViewMode === 'ANALYTICS' ? 'bg-white shadow-sm text-omid-600' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}><PieChart size={18}/>نتایج</button>
                  </div>
              )}
            </div>
            
            <div className="p-8 min-h-[500px]">
                {isManagerOrQuality || (isDeveloper && managerViewMode === 'CARDS') ? renderManagerView() : isDeveloper ? (
                    // DEVELOPER VIEW
                    <>
                        {managerViewMode === 'USERS' ? renderUserManagement() : renderTable(pdps)}
                    </>
                ) : (
                    // NORMAL USERS
                    renderSplitLists()
                )}
            </div>
          </div>
        )}
      </main>
      
      <footer className="w-full text-center py-4 text-[11px] text-gray-400 border-t bg-white/50 mt-auto backdrop-blur-sm">
          بیمارستان تخصصی و فوق تخصصی امید
      </footer>

      {/* Floating Approve All Button for HN/SUP */}
      {(user.role === UserRole.HEAD_NURSE || user.role === UserRole.SUPERVISOR) && pdps.some(p => {
          if (user.role === UserRole.HEAD_NURSE) return p.status === PDPStatus.SUBMITTED;
          if (user.role === UserRole.SUPERVISOR) {
              const isHN = p.jobCategory === JobCategory.SET_9_MANAGEMENT && p.bioData.orgPost === 'سرپرستار';
              return isHN ? p.status === PDPStatus.SUBMITTED : p.status === PDPStatus.APPROVED_BY_HN;
          }
          return false;
      }) && (
          <button 
            onClick={handleApproveAllPending}
            className="fixed bottom-8 left-8 bg-green-600 text-white p-5 rounded-full shadow-2xl hover:bg-green-700 hover:scale-110 transition-all z-50 group flex items-center gap-2"
            title="تایید تمامی فرم‌های منتظر"
          >
            <Check size={28} />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap font-bold">تایید تمامی موارد</span>
          </button>
      )}

      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-white/20">
            <div className="bg-omid-600 p-6 text-white text-center relative">
              <h3 className="text-xl font-black">تغییر رمز عبور</h3>
              <button onClick={() => setShowChangePasswordModal(false)} className="absolute top-6 left-6 text-white/70 hover:text-white"><X size={20}/></button>
            </div>
            <form onSubmit={handleUpdatePassword} className="p-8 space-y-4">
              <p className="text-sm text-gray-500 text-center mb-4">رمز عبور جدید خود را وارد کنید:</p>
              <input 
                type="text" 
                required
                className="w-full p-4 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-omid-500/10 focus:border-omid-500 text-center font-mono text-xl"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="رمز عبور جدید"
                autoFocus
              />
              <button 
                type="submit"
                className="w-full bg-omid-600 text-white py-4 rounded-2xl font-bold hover:bg-omid-700 transition-all shadow-lg"
              >
                ذخیره و خروج
              </button>
            </form>
          </div>
        </div>
      )}

      {showDevPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-white/20">
            <div className="bg-gray-900 p-8 text-white text-center">
                <div className="w-16 h-16 bg-omid-500/20 text-omid-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Key size={32} />
                </div>
                <h3 className="text-xl font-black">ورود به بخش توسعه‌دهنده</h3>
                <p className="text-xs text-gray-400 mt-2">لطفاً رمز عبور مدیریت سیستم را وارد کنید</p>
            </div>
            <div className="p-8 space-y-4">
                <input 
                    type="password" 
                    autoFocus
                    className="w-full p-4 border-2 border-gray-100 rounded-2xl outline-none focus:border-omid-500 text-center font-mono text-2xl tracking-widest"
                    placeholder="••••"
                    value={devPasswordInput}
                    onChange={e => setDevPasswordInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            if (devPasswordInput === '427726') {
                                const devUser = users.find(u => u.role === UserRole.DEVELOPER);
                                if (devUser) {
                                    localStorage.removeItem('impersonating');
                                    onLogout(); // Clear current
                                    setTimeout(() => {
                                        // This is a hack for the demo to switch roles
                                        // In a real app we'd have a proper session
                                        window.location.href = `/?autoLogin=${devUser.username}`;
                                    }, 100);
                                }
                            } else {
                                alert('رمز عبور اشتباه است');
                                setDevPasswordInput('');
                            }
                        }
                    }}
                />
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowDevPasswordModal(false)}
                        className="flex-1 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 transition-all"
                    >
                        انصراف
                    </button>
                    <button 
                        onClick={() => {
                            if (devPasswordInput === '427726') {
                                const devUser = users.find(u => u.role === UserRole.DEVELOPER);
                                if (devUser) {
                                    localStorage.removeItem('impersonating');
                                    onLogout();
                                    setTimeout(() => {
                                        window.location.href = `/?autoLogin=${devUser.username}`;
                                    }, 100);
                                }
                            } else {
                                alert('رمز عبور اشتباه است');
                                setDevPasswordInput('');
                            }
                        }}
                        className="flex-[2] bg-omid-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-omid-600/20 hover:bg-omid-700 transition-all"
                    >
                        تایید و ورود
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
