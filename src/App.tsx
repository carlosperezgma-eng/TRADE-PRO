/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  LayoutDashboard, 
  ClipboardList, 
  History, 
  PlusCircle, 
  MapPin, 
  Package, 
  Users, 
  Gift, 
  TrendingUp,
  ChevronRight,
  Store,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  LogOut,
  LogIn,
  Camera,
  X,
  Image as ImageIcon,
  Loader2,
  BookOpen,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Report, ReportType, DashboardStats, ZONES, Zone } from './types';
import { PRODUCTS } from './constants';
import { POINTS_OF_SALE } from './pdv_constants';

// Firebase Imports
import { auth, db, storage } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  Timestamp,
  serverTimestamp,
  getDocFromServer,
  doc
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from 'firebase/storage';

// Utility for tailwind classes
// Error Boundary Component
class ErrorBoundary extends Component<any, any> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Algo salió mal</h1>
          <p className="text-gray-600 mb-6">La aplicación encontró un error inesperado. Por favor, recarga la página.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all"
          >
            Recargar Aplicación
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'dashboard' | 'reports' | 'history' | 'products';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [reports, setReports] = useState<Report[]>([]);
  const [showReportForm, setShowReportForm] = useState<ReportType | null>(null);
  const [prefilledProduct, setPrefilledProduct] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedZone, setSelectedZone] = useState<Zone | 'TODAS'>('TODAS');

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  // Test Connection
  useEffect(() => {
    async function testConnection() {
      try {
        console.log('Probando conexión a Firestore...');
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log('Conexión a Firestore exitosa (o al menos alcanzable)');
      } catch (error) {
        console.error('Error al probar conexión a Firestore:', error);
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
          toast.error('Parece que no hay conexión a la base de datos.');
        }
      }
    }
    testConnection();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Reports Listener
  useEffect(() => {
    if (!user) {
      setReports([]);
      return;
    }

    const q = query(
      collection(db, 'reports'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReports: Report[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedReports.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toMillis() || Date.now()
        } as Report);
      });
      setReports(fetchedReports);
    }, (error) => {
      handleFirestoreError(error, 'get', 'reports');
    });

    return () => unsubscribe();
  }, [user]);

  const filteredReports = reports.filter(r => {
    const d = new Date(r.timestamp);
    const monthMatch = d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    const zoneMatch = selectedZone === 'TODAS' || r.zone === selectedZone;
    return monthMatch && zoneMatch;
  });

  const stats: DashboardStats = {
    totalDegustaciones: filteredReports.filter(r => r.type === 'degustacion').reduce((acc, r) => acc + (Number(r.quantity) || 0), 0),
    totalAmarres: filteredReports.filter(r => r.type === 'amarre').length,
    totalMuestreos: filteredReports.filter(r => r.type === 'muestreo').reduce((acc, r) => acc + (Number(r.quantity) || 0), 0),
    totalValoresAgregados: filteredReports.filter(r => r.type === 'valor_agregado').length,
    storesVisited: new Set(filteredReports.map(r => r.storeName || 'Desconocida')).size
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Sesión iniciada correctamente');
    } catch (error) {
      console.error(error);
      toast.error('Error al iniciar sesión');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.info('Sesión cerrada');
    } catch (error) {
      console.error(error);
    }
  };

  const handleFirestoreError = (error: any, operationType: string, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType,
      path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      }
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    toast.error('Error de base de datos. Por favor intenta de nuevo.');
    throw new Error(JSON.stringify(errInfo));
  };

  const handleAddReport = async (reportData: Omit<Report, 'id' | 'timestamp' | 'userId'>) => {
    if (!user) {
      console.error('handleAddReport: No hay usuario autenticado');
      toast.error('Debes iniciar sesión para enviar reportes');
      return;
    }

    try {
      console.log('--- INICIO handleAddReport ---');
      console.log('Usuario:', user.uid);
      
      const finalReportData = {
        ...reportData,
        userId: user.uid,
        timestamp: serverTimestamp()
      };
      
      console.log('Objeto final a guardar en Firestore:', finalReportData);
      console.log('Instancia de DB:', db ? 'Inicializada' : 'NO INICIALIZADA');
      console.log('Colección Path:', collection(db, 'reports').path);
      
      console.log('Iniciando addDoc...');
      const docRef = await addDoc(collection(db, 'reports'), finalReportData);
      console.log('addDoc completado.');
      
      console.log('Reporte guardado con ID:', docRef.id);
      console.log('--- FIN handleAddReport EXITOSO ---');
      
      setShowReportForm(null);
      toast.success('Reporte enviado con éxito', {
        description: `Se registró ${reportData.type} en ${reportData.storeName}`,
        icon: <CheckCircle2 className="w-5 h-5 text-green-500" />
      });
    } catch (error) {
      console.error('Error en handleAddReport:', error);
      handleFirestoreError(error, 'addDoc', 'reports');
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-brand-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-brand-200 mb-10 relative"
        >
          <TrendingUp className="w-12 h-12 text-white" />
          <div className="absolute -right-2 -top-2 w-8 h-8 bg-brand-400 rounded-full blur-xl opacity-50 animate-pulse" />
        </motion.div>
        <h1 className="text-4xl font-display font-bold tracking-tight mb-3 text-slate-900">TradePro</h1>
        <p className="text-slate-500 mb-10 max-w-xs text-lg leading-relaxed font-medium">
          Gestión profesional de trade marketing en tiempo real.
        </p>
        <button 
          onClick={handleLogin}
          className="w-full max-w-xs flex items-center justify-center gap-3 py-4.5 bg-white border border-slate-200 rounded-2xl font-bold shadow-soft hover:shadow-md hover:border-brand-200 transition-all active:scale-95 group"
        >
          <div className="w-6 h-6 flex items-center justify-center bg-slate-50 rounded-lg group-hover:bg-brand-50 transition-colors">
            <LogIn className="w-4 h-4 text-brand-600" />
          </div>
          <span className="text-slate-700">Continuar con Google</span>
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-28">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-30 px-6 py-5 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-brand-600">TradePro</h1>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
            <Clock className="w-3 h-3" />
            <span>{format(currentTime, 'HH:mm:ss')}</span>
            <span className="opacity-30">•</span>
            <span>{format(currentTime, 'dd MMM yyyy')}</span>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2.5 hover:bg-slate-100 rounded-2xl transition-all active:scale-90 text-slate-400 hover:text-slate-600"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="max-w-md mx-auto p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Indicadores Clave</h2>
                  <div className="flex items-center gap-2">
                    <select 
                      value={selectedZone}
                      onChange={(e) => setSelectedZone(e.target.value as any)}
                      className="text-[10px] font-bold bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all cursor-pointer"
                    >
                      <option value="TODAS">TODAS LAS ZONAS</option>
                      {ZONES.map(z => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                    <select 
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="text-[10px] font-bold bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all cursor-pointer"
                    >
                      {[2024, 2025, 2026].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-6 scrollbar-hide -mx-6 px-6">
                  {months.map((m, idx) => (
                    <button
                      key={m}
                      onClick={() => setSelectedMonth(idx)}
                      className={cn(
                        "px-5 py-2.5 rounded-2xl text-[11px] font-bold whitespace-nowrap transition-all border",
                        selectedMonth === idx 
                          ? "bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-100" 
                          : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <StatCard 
                    title="Degustaciones" 
                    value={stats.totalDegustaciones} 
                    icon={<Users className="w-5 h-5 text-brand-600" />}
                    color="bg-brand-50"
                  />
                  <StatCard 
                    title="Amarres" 
                    value={stats.totalAmarres} 
                    icon={<Package className="w-5 h-5 text-orange-600" />}
                    color="bg-orange-50"
                  />
                  <StatCard 
                    title="Muestreos" 
                    value={stats.totalMuestreos} 
                    icon={<Gift className="w-5 h-5 text-purple-600" />}
                    color="bg-purple-50"
                  />
                  <StatCard 
                    title="Valores Agreg." 
                    value={stats.totalValoresAgregados} 
                    icon={<PlusCircle className="w-5 h-5 text-emerald-600" />}
                    color="bg-emerald-50"
                  />
                  <StatCard 
                    title="Tiendas Visitadas" 
                    value={stats.storesVisited} 
                    icon={<Store className="w-5 h-5 text-slate-600" />}
                    color="bg-slate-50"
                    className="col-span-2"
                  />
                </div>
              </section>

              <section className="bg-white rounded-[2rem] p-7 shadow-soft border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-display font-bold text-slate-900 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-brand-600" />
                    </div>
                    Metas del Día
                  </h3>
                  <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full uppercase tracking-wider">
                    {Math.min(Math.round(((stats.totalDegustaciones/100 + stats.totalAmarres/20 + stats.totalMuestreos/50 + stats.totalValoresAgregados/30)/4)*100), 100)}% Total
                  </span>
                </div>
                <div className="space-y-6">
                  <ProgressBar label="Degustaciones" current={stats.totalDegustaciones} target={100} color="bg-brand-600" />
                  <ProgressBar label="Amarres" current={stats.totalAmarres} target={20} color="bg-orange-500" />
                  <ProgressBar label="Muestreos" current={stats.totalMuestreos} target={50} color="bg-purple-500" />
                  <ProgressBar label="Valores Agregados" current={stats.totalValoresAgregados} target={30} color="bg-emerald-500" />
                </div>
              </section>

              {/* Detailed Dashboard for Degustaciones and Valores Agregados */}
              <section className="space-y-6">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <h3 className="font-bold flex items-center gap-2 mb-6">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    Detalle de Degustaciones
                  </h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(
                          filteredReports
                            .filter(r => r.type === 'degustacion')
                            .reduce((acc, r) => {
                              acc[r.productName] = (acc[r.productName] || 0) + (Number(r.quantity) || 0);
                              return acc;
                            }, {} as Record<string, number>)
                        ).map(([name, value]) => ({ name: name.split(' ').slice(0, 2).join(' '), full: name, value }))}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={80} 
                          fontSize={10} 
                          tick={{ fill: '#6b7280' }}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          formatter={(value: number) => [`${value} unidades`, 'Cantidad']}
                        />
                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* List of recent Degustaciones */}
                  <div className="mt-6 space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Registros del Mes</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {filteredReports
                        .filter(r => r.type === 'degustacion')
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .map((r, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-gray-900 truncate max-w-[120px]">{r.productName}</span>
                              <span className="text-[9px] text-gray-400">{format(r.timestamp, 'dd/MM/yyyy')}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-bold text-blue-600">+{r.quantity}</span>
                              <p className="text-[8px] text-gray-400 truncate max-w-[80px]">{r.storeName}</p>
                            </div>
                          </div>
                        ))}
                      {filteredReports.filter(r => r.type === 'degustacion').length === 0 && (
                        <p className="text-center py-4 text-xs text-gray-400 italic">No hay registros este mes</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <h3 className="font-bold flex items-center gap-2 mb-6">
                    <PieChartIcon className="w-4 h-4 text-green-600" />
                    Distribución de Valores Agregados
                  </h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(
                            filteredReports
                              .filter(r => r.type === 'valor_agregado')
                              .reduce((acc, r) => {
                                acc[r.productName] = (acc[r.productName] || 0) + 1;
                                return acc;
                              }, {} as Record<string, number>)
                          ).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d'].map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* List of recent Valores Agregados */}
                  <div className="mt-6 space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Registros del Mes</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {filteredReports
                        .filter(r => r.type === 'valor_agregado')
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .map((r, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-gray-900 truncate max-w-[120px]">{r.productName}</span>
                              <span className="text-[9px] text-gray-400">{format(r.timestamp, 'dd/MM/yyyy')}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-bold text-green-600">+{r.quantity}</span>
                              <p className="text-[8px] text-gray-400 truncate max-w-[80px]">{r.storeName}</p>
                            </div>
                          </div>
                        ))}
                      {filteredReports.filter(r => r.type === 'valor_agregado').length === 0 && (
                        <p className="text-center py-4 text-xs text-gray-400 italic">No hay registros este mes</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {Object.entries(
                      filteredReports
                        .filter(r => r.type === 'valor_agregado')
                        .reduce((acc, r) => {
                          acc[r.productName] = (acc[r.productName] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                    ).slice(0, 4).map(([name, value], idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#22c55e', '#16a34a', '#15803d', '#166534'][idx % 4] }} />
                        <span className="text-[10px] text-gray-500 truncate">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Acciones Rápidas</h2>
                <div className="grid grid-cols-4 gap-2">
                  <QuickAction icon={<Users />} label="Degust." onClick={() => { setActiveTab('reports'); setShowReportForm('degustacion'); }} />
                  <QuickAction icon={<Package />} label="Amarre" onClick={() => { setActiveTab('reports'); setShowReportForm('amarre'); }} />
                  <QuickAction icon={<Gift />} label="Muestreo" onClick={() => { setActiveTab('reports'); setShowReportForm('muestreo'); }} />
                  <QuickAction icon={<PlusCircle />} label="Valor" onClick={() => { setActiveTab('reports'); setShowReportForm('valor_agregado'); }} />
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {!showReportForm ? (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold">Nuevo Reporte</h2>
                  <p className="text-gray-500 text-sm">Selecciona el tipo de actividad que deseas reportar en el punto de venta.</p>
                  
                  <div className="space-y-3">
                    <ReportTypeButton 
                      type="degustacion" 
                      title="Reporte de Degustaciones" 
                      desc="Registro de pruebas de producto con clientes."
                      icon={<Users className="w-6 h-6" />}
                      onClick={() => { setShowReportForm('degustacion'); setPrefilledProduct(''); }}
                    />
                    <ReportTypeButton 
                      type="amarre" 
                      title="Reporte de Amarres" 
                      desc="Control de promociones y packs armados."
                      icon={<Package className="w-6 h-6" />}
                      onClick={() => { setShowReportForm('amarre'); setPrefilledProduct(''); }}
                    />
                    <ReportTypeButton 
                      type="muestreo" 
                      title="Muestreo de Productos" 
                      desc="Seguimiento de distribución de muestras."
                      icon={<Gift className="w-6 h-6" />}
                      onClick={() => { setShowReportForm('muestreo'); setPrefilledProduct(''); }}
                    />
                    <ReportTypeButton 
                      type="valor_agregado" 
                      title="Valores Agregados" 
                      desc="Actividades adicionales en tienda."
                      icon={<PlusCircle className="w-6 h-6" />}
                      onClick={() => { setShowReportForm('valor_agregado'); setPrefilledProduct(''); }}
                    />
                  </div>
                </div>
              ) : (
                <ReportForm 
                  type={showReportForm} 
                  prefilledProduct={prefilledProduct}
                  onCancel={() => { setShowReportForm(null); setPrefilledProduct(''); }} 
                  onSubmit={handleAddReport}
                />
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">Historial de Actividad</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar por tienda o producto..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                {reports
                  .filter(r => 
                    r.storeName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    r.productName.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((report) => (
                    <HistoryItem key={report.id} report={report} />
                  ))}
                {reports.length === 0 && (
                  <div className="text-center py-12">
                    <ClipboardList className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No hay reportes registrados hoy.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {activeTab === 'products' && (
            <motion.div
              key="products"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">Catálogo de Productos</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar producto..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {PRODUCTS
                    .filter(p => p.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((product, index) => (
                      <div 
                        key={index} 
                        className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group cursor-pointer"
                        onClick={() => {
                          setActiveTab('reports');
                          setShowReportForm('degustacion'); // Default to degustacion or let them pick?
                          // We need a way to pass the product to the form. 
                          // Let's add a state for prefilledProduct.
                          setPrefilledProduct(product);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                            <Package className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium text-gray-700">{product}</span>
                        </div>
                        <PlusCircle className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                      </div>
                    ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 px-6 py-4 flex justify-around items-center z-40">
        <NavButton 
          active={activeTab === 'dashboard'} 
          onClick={() => { setActiveTab('dashboard'); setShowReportForm(null); setPrefilledProduct(''); }} 
          icon={<LayoutDashboard />} 
          label="Inicio" 
        />
        <NavButton 
          active={activeTab === 'products'} 
          onClick={() => { setActiveTab('products'); setShowReportForm(null); setPrefilledProduct(''); }} 
          icon={<BookOpen />} 
          label="Catálogo" 
        />
        <NavButton 
          active={activeTab === 'reports'} 
          onClick={() => { setActiveTab('reports'); setShowReportForm(null); setPrefilledProduct(''); }} 
          icon={<PlusCircle />} 
          label="Reportar" 
        />
        <NavButton 
          active={activeTab === 'history'} 
          onClick={() => { setActiveTab('history'); setShowReportForm(null); setPrefilledProduct(''); }} 
          icon={<History />} 
          label="Historial" 
        />
      </nav>
    </div>
    </ErrorBoundary>
  );
}

function StatCard({ title, value, icon, color, className }: { title: string, value: number, icon: React.ReactNode, color: string, className?: string }) {
  return (
    <div className={cn("bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-soft transition-all hover:shadow-md hover:-translate-y-1", className)}>
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", color)}>
        {icon}
      </div>
      <p className="text-3xl font-display font-bold text-slate-900 leading-none mb-1">{value}</p>
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{title}</p>
    </div>
  );
}

function ProgressBar({ label, current, target, color }: { label: string, current: number, target: number, color: string }) {
  const percentage = Math.min(Math.round((current / target) * 100), 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <span className="text-[10px] font-mono font-bold text-slate-400">{current} / {target}</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className={cn("h-full rounded-full shadow-sm", color)}
        />
      </div>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-soft hover:border-brand-200 hover:bg-brand-50 transition-all active:scale-95 group"
    >
      <div className="text-brand-600 transition-transform group-hover:scale-110">{icon}</div>
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-brand-700">{label}</span>
    </button>
  );
}

function ReportTypeButton({ type, title, desc, icon, onClick }: { type: ReportType, title: string, desc: string, icon: React.ReactNode, onClick: () => void }) {
  const colors = {
    degustacion: "text-brand-600 bg-brand-50",
    amarre: "text-orange-600 bg-orange-50",
    muestreo: "text-purple-600 bg-purple-50",
    valor_agregado: "text-emerald-600 bg-emerald-50"
  };

  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-5 p-5 bg-white rounded-3xl border border-slate-100 shadow-soft hover:border-brand-200 transition-all active:scale-[0.98] text-left group"
    >
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105", colors[type])}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-display font-bold text-slate-900 text-lg leading-tight mb-1">{title}</h3>
        <p className="text-xs text-slate-400 font-medium line-clamp-1">{desc}</p>
      </div>
      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-brand-600 group-hover:bg-brand-50 transition-all">
        <ChevronRight className="w-5 h-5" />
      </div>
    </button>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactElement, label: string }) {
  return (
    <button 
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 transition-all relative py-2 px-4 rounded-2xl",
        active ? "text-brand-600" : "text-slate-400 hover:text-slate-600"
      )}
    >
      <div className={cn(
        "transition-transform duration-300",
        active ? "scale-110" : "scale-100"
      )}>
        {React.cloneElement(icon, { className: "w-6 h-6" })}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-[0.15em]">{label}</span>
      {active && (
        <motion.div 
          layoutId="nav-indicator"
          className="absolute -bottom-1 w-1 h-1 bg-brand-600 rounded-full"
        />
      )}
    </button>
  );
}

function ReportForm({ type, prefilledProduct, onCancel, onSubmit }: { type: ReportType, prefilledProduct?: string, onCancel: () => void, onSubmit: (report: Omit<Report, 'id' | 'timestamp' | 'userId'>) => void }) {
  const [formData, setFormData] = useState({
    storeName: '',
    productName: prefilledProduct || '',
    quantity: 1,
    notes: '',
    zone: '' as Zone | ''
  });
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [location, setLocation] = useState<{ latitude: number, longitude: number } | undefined>();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [submissionStep, setSubmissionStep] = useState<string>('');
  const [productSearch, setProductSearch] = useState(prefilledProduct || '');
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');
  const [showStoreSuggestions, setShowStoreSuggestions] = useState(false);

  useEffect(() => {
    if (prefilledProduct) {
      setFormData(prev => ({ ...prev, productName: prefilledProduct }));
      setProductSearch(prefilledProduct);
    }
  }, [prefilledProduct]);

  const filteredProducts = PRODUCTS.filter(p => 
    p.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 20);

  const filteredStores = POINTS_OF_SALE.filter(s => 
    s.toLowerCase().includes(storeSearch.toLowerCase())
  ).slice(0, 20);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (selectedFiles.length + files.length > 3) {
      toast.error('Máximo 3 fotos por reporte');
      return;
    }

    const newFiles = [...selectedFiles, ...files];
    setSelectedFiles(newFiles);

    const newPreviews = files.map(file => URL.createObjectURL(file));
    setPreviews([...previews, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);

    const newPreviews = [...previews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setPreviews(newPreviews);
  };

  const handleCaptureLocation = () => {
    setIsCapturingLocation(true);
    
    // Timeout de 15 segundos para la ubicación
    const locationTimeout = setTimeout(() => {
      if (isCapturingLocation) {
        setIsCapturingLocation(false);
        toast.error('Tiempo de espera agotado al capturar ubicación');
      }
    }, 15000);

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(locationTimeout);
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setIsCapturingLocation(false);
          toast.success('Ubicación capturada');
        },
        (error) => {
          clearTimeout(locationTimeout);
          console.error(error);
          setIsCapturingLocation(false);
          toast.error('Error al capturar ubicación: ' + error.message);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      clearTimeout(locationTimeout);
      setIsCapturingLocation(false);
      toast.error('Geolocalización no disponible');
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
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
          
          // Comprimir a JPEG con calidad 0.7 para ahorrar espacio
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const processImages = async (): Promise<string[]> => {
    if (selectedFiles.length === 0) {
      return [];
    }
    
    console.log(`Procesando ${selectedFiles.length} imágenes...`);
    const processPromises = selectedFiles.map(async (file, index) => {
      console.log(`Comprimiendo imagen ${index + 1}...`);
      setSubmissionStep(`Procesando foto ${index + 1}...`);
      return await compressImage(file);
    });
    
    const base64Images = await Promise.all(processPromises);
    console.log('Todas las imágenes procesadas con éxito.');
    return base64Images;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('--- FORM SUBMIT CLICKED ---');
    
    if (isUploading) {
      console.log('Ya hay un envío en curso, ignorando...');
      return;
    }

    console.log('--- INICIO handleSubmit ---');
    console.log('FormData:', formData);
    console.log('Ubicación actual:', location);
    console.log('Archivos seleccionados:', selectedFiles.length);
    
    if (!formData.storeName || !formData.productName || !formData.zone) {
      console.error('Campos obligatorios faltantes');
      toast.error('Por favor completa los campos obligatorios (Tienda, Producto y Zona)');
      return;
    }

    setIsUploading(true);
    setSubmissionStep('Iniciando envío...');
    try {
      console.log('Iniciando proceso de envío (timeout 180s)...');
      // Timeout de 180 segundos para todo el proceso
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), 180000)
      );

      const submissionPromise = (async () => {
        console.log('Paso 1: Procesando imágenes...');
        setSubmissionStep('Procesando fotos...');
        const imageUrls = await processImages();
        console.log('Paso 1 completado. Imágenes listas.');
        
        console.log('Paso 2: Guardando reporte en Firestore...');
        setSubmissionStep('Guardando reporte...');
        
        const reportToSubmit: any = {
          type,
          ...formData,
          images: imageUrls
        };
        
        if (location) {
          console.log('Incluyendo ubicación:', location);
          reportToSubmit.location = { latitude: location.latitude, longitude: location.longitude };
        }

        console.log('Paso 3: Llamando a onSubmit (handleAddReport) con:', reportToSubmit);
        await onSubmit(reportToSubmit);
        console.log('Paso 4: onSubmit completado.');
        setSubmissionStep('¡Completado!');
      })();

      await Promise.race([submissionPromise, timeoutPromise]);
      console.log('--- FIN handleSubmit EXITOSO ---');
    } catch (error: any) {
      console.error('--- ERROR EN handleSubmit ---');
      console.error('Error completo:', error);
      
      let errorMessage = 'Error al enviar reporte. Por favor intenta de nuevo.';
      
      if (error && error.message === 'TIMEOUT_EXCEEDED') {
        errorMessage = 'La operación tardó demasiado. Por favor revisa tu conexión.';
      } else if (error && error.message === 'AUTH_REQUIRED') {
        errorMessage = 'Debes iniciar sesión para enviar reportes.';
      } else if (error && error.message) {
        try {
          const parsedError = JSON.parse(error.message);
          if (parsedError.error) {
            errorMessage = `Error: ${parsedError.error}`;
          }
        } catch (e) {
          if (typeof error.message === 'string' && error.message.length < 100) {
            errorMessage = error.message;
          }
        }
      }
      
      toast.error(errorMessage, {
        duration: 8000
      });
    } finally {
      setIsUploading(false);
    }
  };

  const titles = {
    degustacion: "Reporte de Degustación",
    amarre: "Reporte de Amarre",
    muestreo: "Reporte de Muestreo",
    valor_agregado: "Reporte de Valor Agregado"
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto scrollbar-hide"
    >
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">{titles[type]}</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Nuevo Registro</p>
        </div>
        <button 
          onClick={onCancel} 
          className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Zona de Trabajo *</label>
          <div className="grid grid-cols-2 gap-3">
            {ZONES.map(z => (
              <button
                key={z}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, zone: z }))}
                className={cn(
                  "py-3.5 px-2 text-[10px] font-bold rounded-2xl border transition-all text-center leading-tight",
                  formData.zone === z 
                    ? "bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-100" 
                    : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                )}
              >
                {z}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 relative">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Punto de Venta *</label>
          <div className="relative group">
            <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
            <input 
              type="text" 
              required
              placeholder="Buscar tienda..."
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 focus:bg-white transition-all text-sm font-medium"
              value={storeSearch}
              onChange={e => {
                setStoreSearch(e.target.value);
                setFormData({...formData, storeName: e.target.value});
                setShowStoreSuggestions(true);
              }}
              onFocus={() => setShowStoreSuggestions(true)}
            />
          </div>
          {showStoreSuggestions && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl max-h-60 overflow-y-auto scrollbar-hide py-2">
              {filteredStores.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className="w-full text-left px-5 py-3 text-sm hover:bg-brand-50 hover:text-brand-700 transition-colors border-b border-slate-50 last:border-0 font-medium"
                  onClick={() => {
                    setFormData({...formData, storeName: s});
                    setStoreSearch(s);
                    setShowStoreSuggestions(false);
                  }}
                >
                  {s}
                </button>
              ))}
              {filteredStores.length === 0 && storeSearch && (
                <div className="px-5 py-4 text-xs text-slate-400 italic">No se encontraron tiendas</div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2 relative">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Producto *</label>
          <div className="relative group">
            <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
            <input 
              type="text" 
              required
              placeholder="Buscar producto..."
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 focus:bg-white transition-all text-sm font-medium"
              value={productSearch}
              onChange={e => {
                setProductSearch(e.target.value);
                setFormData({...formData, productName: e.target.value});
                setShowProductSuggestions(true);
              }}
              onFocus={() => setShowProductSuggestions(true)}
            />
          </div>
          {showProductSuggestions && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl max-h-60 overflow-y-auto scrollbar-hide py-2">
              {filteredProducts.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  className="w-full text-left px-5 py-3 text-sm hover:bg-brand-50 hover:text-brand-700 transition-colors border-b border-slate-50 last:border-0 font-medium"
                  onClick={() => {
                    setFormData({...formData, productName: p});
                    setProductSearch(p);
                    setShowProductSuggestions(false);
                  }}
                >
                  {p}
                </button>
              ))}
              {filteredProducts.length === 0 && productSearch && (
                <div className="px-5 py-4 text-xs text-slate-400 italic">No se encontraron productos</div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Cantidad</label>
            <input 
              type="number" 
              required
              min="1"
              className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 focus:bg-white transition-all text-sm font-bold"
              value={formData.quantity || ''}
              onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Ubicación</label>
            <button 
              type="button"
              onClick={handleCaptureLocation}
              disabled={isCapturingLocation}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-4 rounded-2xl border transition-all text-xs font-bold",
                location 
                  ? "bg-emerald-50 border-emerald-100 text-emerald-600" 
                  : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
              )}
            >
              {isCapturingLocation ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : location ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
              {location ? 'Capturada' : isCapturingLocation ? 'Capturando...' : 'Capturar'}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">Fotos (Máx. 3)</label>
          <div className="flex gap-3">
            <label className="flex-1 flex flex-col items-center justify-center gap-1 p-4 border-2 border-dashed border-gray-200 rounded-2xl hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer">
              <Camera className="w-6 h-6 text-gray-400" />
              <span className="text-[10px] font-bold text-gray-500 uppercase">Añadir Foto</span>
              <input 
                type="file" 
                accept="image/*" 
                multiple 
                className="hidden" 
                onChange={handleFileChange}
                disabled={selectedFiles.length >= 3}
              />
            </label>
            <div className="flex gap-2">
              {previews.map((preview, index) => (
                <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Notas / Observaciones</label>
          <textarea 
            rows={3}
            placeholder="Detalles adicionales..."
            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 focus:bg-white transition-all text-sm font-medium resize-none"
            value={formData.notes}
            onChange={e => setFormData({...formData, notes: e.target.value})}
          />
        </div>

        <div className="pt-4 flex gap-3">
          <button 
            type="button"
            onClick={onCancel}
            disabled={isUploading}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            disabled={isUploading}
            className="flex-[2] py-3 px-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {submissionStep || "Enviando..."}
              </>
            ) : (
              "Enviar Reporte"
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}

const HistoryItem: React.FC<{ report: Report }> = ({ report }) => {
  const typeLabels: Record<string, { label: string, color: string }> = {
    degustacion: { label: "Degustación", color: "text-brand-600 bg-brand-50" },
    amarre: { label: "Amarre", color: "text-orange-600 bg-orange-50" },
    muestreo: { label: "Muestreo", color: "text-purple-600 bg-purple-50" },
    valor_agregado: { label: "Valor Agregado", color: "text-emerald-600 bg-emerald-50" }
  };

  const config = typeLabels[report.type] || { label: "Reporte", color: "text-slate-600 bg-slate-50" };
  const { label, color } = config;

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-soft flex flex-col gap-4 hover:shadow-md transition-all">
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-2">
            <span className={cn("text-[10px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg", color)}>
              {label}
            </span>
            <span className="text-[10px] text-slate-400 font-bold font-mono">
              {format(report.timestamp, 'HH:mm')}
            </span>
          </div>
          <h4 className="font-display font-bold text-slate-900 truncate text-lg leading-tight">{report.storeName}</h4>
          <p className="text-xs text-slate-500 font-medium mt-1">{report.productName} • <span className="text-brand-600 font-bold">{report.quantity}</span> unidades</p>
          {report.notes && (
            <p className="text-[11px] text-slate-400 italic mt-2 line-clamp-2 leading-relaxed">"{report.notes}"</p>
          )}
        </div>
        {report.location && (
          <div className="flex items-center justify-center shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100" title="Verificado con GPS">
              <MapPin className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
        )}
      </div>
      
      {report.images && report.images.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {report.images.map((url, idx) => (
            <div key={idx} className="relative w-28 h-28 shrink-0 rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
              <img 
                src={url} 
                alt={`Reporte ${idx + 1}`} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
