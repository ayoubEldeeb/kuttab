import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Users, 
  UserCheck, 
  Crown, 
  Search, 
  Phone, 
  ExternalLink, 
  FileText, 
  AlertCircle, 
  CheckSquare, 
  Square, 
  Edit3, 
  X, 
  Check, 
  Bookmark, 
  Award,
  ArrowUpDown
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { getQuranStage } from '../utils/quranStages';
import { getKhatmahLabel } from '../utils/khatmahUtils';
import { formatPart } from '../utils/formatPart';

interface StudentProgress {
  id: number;
  serialNumber: string;
  name: string;
  guardianName?: string;
  guardianPhone?: string;
  currentReach?: string;
  startReach?: string;
  isKhatim: boolean;
  khatmahCount: number;
  attendanceRate: number;
  lastActivity?: {
    date: string;
    status: string;
    type?: string;
    fromPart?: string;
    toPart?: string;
  } | null;
}

interface SheikhSupervisionData {
  id: number;
  name: string;
  username?: string;
  phone?: string;
  role: string;
  isActive: boolean;
  recordedSessionsCount: number;
  assignedStudentsCount: number;
  khatmeenCount: number;
  averageAttendanceRate: number;
  students: StudentProgress[];
}

interface SupervisionStatsResponse {
  totalStudents: number;
  assignedStudentsCount: number;
  unassignedStudentsCount: number;
  sheikhsCount: number;
  sheikhs: SheikhSupervisionData[];
  unassignedStudents: StudentProgress[];
}

export default function SheikhsSupervisionTab() {
  const queryClient = useQueryClient();

  // Selected sheikh filter: 'all' | 'unassigned' | sheikhId as string
  const [selectedSheikhId, setSelectedSheikhId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [khatmahFilter, setKhatmahFilter] = useState<'all' | 'khatmeen_only' | 'in_progress'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'attendance' | 'khatmah'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Multi-selection for bulk sheikh assignment
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [targetStudentForAssign, setTargetStudentForAssign] = useState<StudentProgress | null>(null);
  const [selectedSheikhForAssignment, setSelectedSheikhForAssignment] = useState<string>('');

  const { data: stats, isLoading } = useQuery<SupervisionStatsResponse>({
    queryKey: ['sheikhs-supervision-stats'],
    queryFn: async () => {
      const res = await api.get('/sheikhs/supervision/stats');
      return res.data;
    },
  });

  const { data: allSheikhs } = useQuery({
    queryKey: ['sheikhs'],
    queryFn: async () => {
      const res = await api.get('/sheikhs');
      return res.data;
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ sheikhId, studentIds }: { sheikhId: number | null; studentIds: number[] }) => {
      const res = await api.post('/students/bulk-assign-sheikh', { sheikhId, studentIds });
      return res.data;
    },
    onSuccess: (_, variables) => {
      const sheikhName = variables.sheikhId 
        ? allSheikhs?.find((s: any) => s.id === variables.sheikhId)?.name || 'الشيخ المحدد'
        : 'بدون مشرف';
      toast.success(`تم إسناد ${variables.studentIds.length} طالب إلى «${sheikhName}» بنجاح`);
      queryClient.invalidateQueries({ queryKey: ['sheikhs-supervision-stats'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['sheikhs'] });
      setIsAssignModalOpen(false);
      setTargetStudentForAssign(null);
      setSelectedStudentIds([]);
    },
    onError: () => {
      toast.error('حدث خطأ أثناء إسناد الطلاب للشيخ');
    },
  });

  // Flattened and augmented students list with supervising sheikh details
  const allStudentsAugmented = useMemo(() => {
    if (!stats) return [];
    const list: Array<StudentProgress & { supervisingSheikh?: SheikhSupervisionData | null }> = [];

    stats.sheikhs.forEach((sh) => {
      sh.students.forEach((st) => {
        list.push({
          ...st,
          supervisingSheikh: sh,
        });
      });
    });

    stats.unassignedStudents.forEach((st) => {
      list.push({
        ...st,
        supervisingSheikh: null,
      });
    });

    return list;
  }, [stats]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return allStudentsAugmented.filter((student) => {
      // 1. Sheikh filter
      if (selectedSheikhId === 'unassigned') {
        if (student.supervisingSheikh !== null) return false;
      } else if (selectedSheikhId !== 'all') {
        const idNum = parseInt(selectedSheikhId, 10);
        if (student.supervisingSheikh?.id !== idNum) return false;
      }

      // 2. Search filter
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = student.name.toLowerCase().includes(q);
        const matchesSerial = student.serialNumber.toLowerCase().includes(q);
        const matchesGuardian = student.guardianName?.toLowerCase().includes(q);
        if (!matchesName && !matchesSerial && !matchesGuardian) return false;
      }

      // 3. Stage filter
      if (stageFilter !== 'all') {
        const studentStage = getQuranStage(student.currentReach);
        if (studentStage !== stageFilter) return false;
      }

      // 4. Khatmah filter
      if (khatmahFilter === 'khatmeen_only' && !student.isKhatim) return false;
      if (khatmahFilter === 'in_progress' && student.isKhatim) return false;

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name, 'ar');
      } else if (sortBy === 'attendance') {
        comparison = a.attendanceRate - b.attendanceRate;
      } else if (sortBy === 'khatmah') {
        const aVal = a.isKhatim ? a.khatmahCount + 10 : 0;
        const bVal = b.isKhatim ? b.khatmahCount + 10 : 0;
        comparison = aVal - bVal;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [allStudentsAugmented, selectedSheikhId, search, stageFilter, khatmahFilter, sortBy, sortOrder]);

  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    }
  };

  const handleToggleSelectStudent = (id: number) => {
    setSelectedStudentIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleOpenSingleAssign = (student: StudentProgress) => {
    setTargetStudentForAssign(student);
    const currentSheikh = (student as any).supervisingSheikh?.id?.toString() || '';
    setSelectedSheikhForAssignment(currentSheikh);
    setIsAssignModalOpen(true);
  };

  const handleOpenBulkAssign = () => {
    if (selectedStudentIds.length === 0) {
      toast.error('يرجى تحديد طالب واحد على الأقل أولاً');
      return;
    }
    setTargetStudentForAssign(null);
    setSelectedSheikhForAssignment('');
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssignment = () => {
    const studentIds = targetStudentForAssign 
      ? [targetStudentForAssign.id]
      : selectedStudentIds;

    if (studentIds.length === 0) return;

    const sheikhId = selectedSheikhForAssignment ? Number(selectedSheikhForAssignment) : null;
    bulkAssignMutation.mutate({ sheikhId, studentIds });
  };

  const openWhatsapp = (student: StudentProgress) => {
    if (!student.guardianPhone) return;
    const cleanPhone = student.guardianPhone.replace(/\D/g, '');
    const text = `السلام عليكم ورحمة الله وبركاته،\nتحية طيبة من إدارة حلقات القرآن الكريم بخصوص الطالب: *${student.name}* (المشرف: ${(student as any).supervisingSheikh?.name || 'إدارة المركز'}).`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const totalAssignedPercent = stats?.totalStudents 
    ? Math.round((stats.assignedStudentsCount / stats.totalStudents) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Supervision KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Total Students */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold shrink-0 border border-emerald-100">
            <Users size={24} />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-slate-900">{stats?.totalStudents || 0}</div>
            <div className="text-xs font-bold text-slate-400">إجمالي طلاب الكُتّاب</div>
          </div>
        </div>

        {/* Card 2: Assigned Students */}
        <div className="bg-white p-5 rounded-3xl border border-emerald-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shrink-0 border border-indigo-100">
            <UserCheck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black font-mono text-indigo-950">{stats?.assignedStudentsCount || 0}</span>
              <span className="text-[11px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">
                {totalAssignedPercent}% موزّع
              </span>
            </div>
            <div className="text-xs font-bold text-slate-400">تحت إشراف المشايخ</div>
          </div>
        </div>

        {/* Card 3: Unassigned Students */}
        <div className={`bg-white p-5 rounded-3xl border shadow-xs flex items-center justify-between gap-3 ${
          (stats?.unassignedStudentsCount || 0) > 0 ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200/80'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shrink-0 border ${
              (stats?.unassignedStudentsCount || 0) > 0 
                ? 'bg-amber-100 text-amber-900 border-amber-300' 
                : 'bg-slate-100 text-slate-400 border-slate-200'
            }`}>
              <AlertCircle size={24} />
            </div>
            <div>
              <div className="text-2xl font-black font-mono text-slate-900">{stats?.unassignedStudentsCount || 0}</div>
              <div className="text-xs font-bold text-slate-400">بانتظار الإسناد لمشرف</div>
            </div>
          </div>

          {(stats?.unassignedStudentsCount || 0) > 0 && (
            <button
              onClick={() => {
                setSelectedSheikhId('unassigned');
                toast('تم تصفية العرض لإظهار الطلاب غير المسندين', { icon: '🔍' });
              }}
              className="text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              عرضهم
            </button>
          )}
        </div>

        {/* Card 4: Active Sheikhs */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold shrink-0 border border-teal-100">
            <Award size={24} />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-slate-900">{stats?.sheikhsCount || 0}</div>
            <div className="text-xs font-bold text-slate-400">مشايخ ومقرؤون نشطون</div>
          </div>
        </div>
      </div>

      {/* Interactive Sheikhs Selector Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            <h3 className="text-sm font-bold text-slate-900 font-heading">
              اختر الشيخ المشرف لعرض وتتبع إنجاز طلابه
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            انقر على بطاقة الشيخ لتصفية القائمة أدناه
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card: All Sheikhs */}
          <div
            onClick={() => setSelectedSheikhId('all')}
            className={`p-4 rounded-3xl border transition-all cursor-pointer relative overflow-hidden ${
              selectedSheikhId === 'all'
                ? 'bg-gradient-to-br from-emerald-800 to-teal-900 text-white shadow-md shadow-emerald-900/15 border-transparent ring-2 ring-emerald-600'
                : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-800 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold ${selectedSheikhId === 'all' ? 'text-emerald-200' : 'text-slate-400'}`}>
                عرض عام
              </span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                selectedSheikhId === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {stats?.totalStudents || 0} طالب
              </span>
            </div>
            <div className="mt-3">
              <h4 className="text-base font-black font-heading">جميع الطلاب والمشايخ</h4>
              <p className={`text-[11px] mt-0.5 ${selectedSheikhId === 'all' ? 'text-emerald-100/80' : 'text-slate-400'}`}>
                تتبع شامل لجميع طلاب الحلقات
              </p>
            </div>
          </div>

          {/* Cards for each Sheikh */}
          {stats?.sheikhs.map((sh) => {
            const isSelected = selectedSheikhId === sh.id.toString();
            return (
              <div
                key={sh.id}
                onClick={() => setSelectedSheikhId(sh.id.toString())}
                className={`p-4 rounded-3xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-gradient-to-br from-indigo-900 to-slate-900 text-white shadow-md shadow-indigo-950/20 border-transparent ring-2 ring-indigo-500'
                    : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-800 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md truncate ${
                    isSelected ? 'bg-white/15 text-indigo-200' : 'bg-indigo-50 text-indigo-800 border border-indigo-200/60'
                  }`}>
                    {sh.role}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {sh.khatmeenCount > 0 && (
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                        isSelected ? 'bg-amber-400 text-amber-950' : 'bg-amber-100 text-amber-900'
                      }`} title={`${sh.khatmeenCount} طلاب خاتمون`}>
                        <Crown size={11} />
                        <span>{sh.khatmeenCount}</span>
                      </span>
                    )}
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {sh.assignedStudentsCount} طالب
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <h4 className="text-sm font-black font-heading truncate">{sh.name}</h4>
                  <div className="flex items-center justify-between text-[11px] mt-1.5">
                    <span className={isSelected ? 'text-indigo-200' : 'text-slate-400'}>
                      المواظبة:
                    </span>
                    <span className={`font-mono font-bold ${
                      sh.averageAttendanceRate >= 85 
                        ? (isSelected ? 'text-emerald-300' : 'text-emerald-700')
                        : (isSelected ? 'text-amber-300' : 'text-amber-700')
                    }`}>
                      {sh.averageAttendanceRate}%
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-100/30 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        isSelected ? 'bg-indigo-300' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, sh.averageAttendanceRate))}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Card: Unassigned Students */}
          {(stats?.unassignedStudentsCount || 0) > 0 && (
            <div
              onClick={() => setSelectedSheikhId('unassigned')}
              className={`p-4 rounded-3xl border transition-all cursor-pointer relative ${
                selectedSheikhId === 'unassigned'
                  ? 'bg-gradient-to-br from-amber-700 to-amber-900 text-white shadow-md shadow-amber-900/20 border-transparent ring-2 ring-amber-500'
                  : 'bg-amber-50/50 hover:bg-amber-50 border-amber-300 text-slate-800 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  selectedSheikhId === 'unassigned' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900'
                }`}>
                  توزيع معلق
                </span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                  selectedSheikhId === 'unassigned' ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-900'
                }`}>
                  {stats?.unassignedStudentsCount} طالب
                </span>
              </div>
              <div className="mt-3">
                <h4 className="text-sm font-black font-heading">طلاب بدون مشرف محدد</h4>
                <p className={`text-[11px] mt-0.5 ${selectedSheikhId === 'unassigned' ? 'text-amber-100' : 'text-amber-800'}`}>
                  انقر هنا لتوزيعهم وإسنادهم للمشايخ
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Action Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Right filters: Search + Khatmah filter */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute right-3.5 top-3 text-slate-400" size={17} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم الطالب أو الرقم التسلسلي..."
              className="pr-10 h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-bold focus:bg-white"
            />
          </div>

          {/* Khatmah Quick Filter */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/80 text-xs font-bold">
            <button
              onClick={() => setKhatmahFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                khatmahFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({allStudentsAugmented.length})
            </button>
            <button
              onClick={() => setKhatmahFilter('khatmeen_only')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                khatmahFilter === 'khatmeen_only'
                  ? 'bg-amber-500 text-white shadow-2xs font-black'
                  : 'text-amber-900 hover:bg-amber-100/50'
              }`}
            >
              <Crown size={12} />
              <span>الخاتمون 👑</span>
            </button>
            <button
              onClick={() => setKhatmahFilter('in_progress')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                khatmahFilter === 'in_progress'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              قيد التدرج
            </button>
          </div>

          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="all">جميع المراحل القرآنية</option>
            <option value="جزء عمّ">جزء عمّ</option>
            <option value="جزء تبارك">جزء تبارك</option>
            <option value="جزء قد سمع">جزء قد سمع</option>
            <option value="ربع ياسين">ربع ياسين</option>
            <option value="ربع مريم">ربع مريم</option>
            <option value="ربع الأعراف">ربع الأعراف</option>
            <option value="ربع البقرة">ربع البقرة</option>
          </select>

          {/* Sort selector */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="عكس الترتيب"
            >
              <ArrowUpDown size={15} />
            </button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="name">ترتيب أبجدي (الاسم)</option>
              <option value="attendance">ترتيب حسب نسبة المواظبة</option>
              <option value="khatmah">ترتيب حسب الختمة والتقدم</option>
            </select>
          </div>
        </div>

        {/* Left actions: Bulk selection action */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {selectedStudentIds.length > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in">
              <span className="text-xs font-bold text-slate-600 bg-emerald-50 text-emerald-900 px-3 py-1.5 rounded-xl border border-emerald-200">
                محدد: <strong>{selectedStudentIds.length}</strong> طالب
              </span>
              <Button
                onClick={handleOpenBulkAssign}
                className="px-4 py-2 rounded-2xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs shadow-md shadow-indigo-700/20 cursor-pointer flex items-center gap-1.5"
              >
                <UserCheck size={14} />
                <span>إسناد لمشرف</span>
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            onClick={handleToggleSelectAll}
            className="px-3.5 py-2 rounded-2xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-1.5"
          >
            {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
              <>
                <CheckSquare size={14} className="text-emerald-700" />
                <span>إلغاء التحديد</span>
              </>
            ) : (
              <>
                <Square size={14} />
                <span>تحديد الكل</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Student Progress Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h4 className="font-black text-slate-900 text-base font-heading">
              سجل متابعة وإنجاز الطلاب
            </h4>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
              {filteredStudents.length} طالب
            </span>
          </div>

          {selectedSheikhId !== 'all' && (
            <button
              onClick={() => setSelectedSheikhId('all')}
              className="text-xs font-bold text-emerald-800 hover:underline flex items-center gap-1"
            >
              <span>إلغاء تصفية الشيخ وعرض الكل</span>
              <X size={13} />
            </button>
          )}
        </div>

        <div className="overflow-x-auto min-h-[380px]">
          <table className="w-full text-right">
            <thead className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 text-xs font-bold">
              <tr>
                <th className="py-4 px-4 text-center w-12">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="py-4 px-6">الطالب</th>
                <th className="py-4 px-6">الشيخ المشرف المسؤول</th>
                <th className="py-4 px-6">موضع البداية والوصول</th>
                <th className="py-4 px-6 text-center">حالة الختمة</th>
                <th className="py-4 px-6 text-center">نسبة المواظبة</th>
                <th className="py-4 px-6">آخر نشاط مرصود</th>
                <th className="py-4 px-6 text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 text-xs">
                    جاري تحميل سجل إشراف المشايخ وإنجاز الطلاب...
                  </td>
                </tr>
              )}

              {!isLoading && filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 text-xs">
                    لا يوجد طلاب مطابقون للبحث أو الفلتر المحدد
                  </td>
                </tr>
              )}

              {filteredStudents.map((student) => {
                const isSelected = selectedStudentIds.includes(student.id);
                const supervisingSheikh = (student as any).supervisingSheikh as SheikhSupervisionData | null;

                return (
                  <tr 
                    key={student.id} 
                    className={`transition-colors hover:bg-slate-50/80 ${isSelected ? 'bg-indigo-50/30' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="py-4 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectStudent(student.id)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Student Info */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-900 flex items-center justify-center font-bold text-sm border border-emerald-200/60 shadow-2xs shrink-0">
                          {student.name.charAt(0) || 'ط'}
                        </div>
                        <div>
                          <Link
                            to={`/students/${student.id}`}
                            className="font-bold text-slate-900 hover:text-emerald-700 transition-colors text-sm font-heading block"
                          >
                            {student.name}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-mono font-bold text-slate-400">
                              {student.serialNumber}
                            </span>
                            {student.guardianPhone && (
                              <button
                                onClick={() => openWhatsapp(student)}
                                className="text-[10px] text-emerald-700 hover:underline flex items-center gap-0.5"
                                title="مراسلة ولي الأمر واتساب"
                              >
                                <Phone size={10} />
                                <span>واتساب</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Supervising Sheikh */}
                    <td className="py-4 px-6">
                      {supervisingSheikh ? (
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200/70 text-indigo-950">
                            <div className="font-bold text-xs flex items-center gap-1.5">
                              <UserCheck size={13} className="text-indigo-700" />
                              <span>{supervisingSheikh.name}</span>
                            </div>
                            <div className="text-[10px] text-indigo-700 font-medium mt-0.5">
                              {supervisingSheikh.role}
                            </div>
                          </div>
                          <button
                            onClick={() => handleOpenSingleAssign(student)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="تغيير الشيخ المشرف"
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold">
                            <AlertCircle size={12} className="text-amber-600" />
                            <span>بدون مشرف</span>
                          </span>
                          <button
                            onClick={() => handleOpenSingleAssign(student)}
                            className="text-[11px] font-bold text-indigo-700 hover:underline bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200/60 transition-colors cursor-pointer"
                          >
                            إسناد شيخ
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Start Reach & Current Reach */}
                    <td className="py-4 px-6">
                      <div>
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1">
                          <span className="text-slate-400 text-[10px]">الموضع:</span>
                          <span>{student.currentReach ? formatPart(student.currentReach) : 'غير محدد'}</span>
                        </div>
                        {student.startReach && (
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Bookmark size={10} className="text-amber-600" />
                            <span>نقطة البداية: {formatPart(student.startReach)}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Khatmah Status */}
                    <td className="py-4 px-6 text-center">
                      {student.isKhatim ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-2xs">
                          <Crown size={12} className="text-amber-100" />
                          <span>{getKhatmahLabel(student.khatmahCount)}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-xl">
                          قيد الحفظ والتدرج
                        </span>
                      )}
                    </td>

                    {/* Attendance Rate */}
                    <td className="py-4 px-6 text-center">
                      <div className="inline-block text-center">
                        <span className={`font-mono font-black text-xs px-2.5 py-0.5 rounded-full ${
                          student.attendanceRate >= 85
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : student.attendanceRate >= 70
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {student.attendanceRate}%
                        </span>
                        <div className="w-16 bg-slate-100 rounded-full h-1 mt-1 mx-auto overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              student.attendanceRate >= 85
                                ? 'bg-emerald-600'
                                : student.attendanceRate >= 70
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, student.attendanceRate))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Last Activity */}
                    <td className="py-4 px-6">
                      {student.lastActivity ? (
                        <div className="text-xs">
                          <div className="font-bold text-slate-800 truncate max-w-[170px]">
                            {student.lastActivity.type ? `${student.lastActivity.type}: ` : ''}
                            {student.lastActivity.toPart || student.lastActivity.status}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(student.lastActivity.date).toLocaleDateString('ar-EG', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/students/${student.id}`}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 transition-colors"
                          title="عرض ملف الطالب"
                        >
                          <ExternalLink size={14} />
                        </Link>
                        <Link
                          to={`/students/${student.id}/report`}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-teal-600 hover:text-white text-slate-700 transition-colors"
                          title="تقرير ولي الأمر"
                        >
                          <FileText size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Assign / Reassign Supervising Sheikh */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-6 animate-in zoom-in-95 duration-200 text-right">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200 shrink-0">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base font-heading">
                    {targetStudentForAssign ? 'إسناد الشيخ المشرف للطالب' : 'إسناد جماعي لمجموعة طلاب'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {targetStudentForAssign 
                      ? `الطالب: ${targetStudentForAssign.name}` 
                      : `عدد الطلاب المحددين: ${selectedStudentIds.length} طالب`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  اختر الشيخ المشرف المسؤول:
                </label>
                <select
                  value={selectedSheikhForAssignment}
                  onChange={(e) => setSelectedSheikhForAssignment(e.target.value)}
                  className="w-full h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none cursor-pointer"
                >
                  <option value="">بدون مشرف (إلغاء الإسناد)</option>
                  {allSheikhs?.map((sh: any) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.name} ({sh.role || 'محفظ'}) {sh.phone ? `- ${sh.phone}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  * سيتم ربط الطالب بالشيخ المشرف ليظهر في لوحة إشرافه، وتنسب له تقارير المتابعة والتسميع.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <Button
                type="button"
                disabled={bulkAssignMutation.isPending}
                onClick={handleConfirmAssignment}
                className="px-6 py-2.5 rounded-2xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold shadow-md shadow-indigo-700/20 cursor-pointer flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>{bulkAssignMutation.isPending ? 'جاري الحفظ...' : 'تأكيد الإسناد'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
