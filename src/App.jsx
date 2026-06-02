import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Plus, Trash2, ArrowRight, Zap, Download, Wifi, ArrowLeft, AlertTriangle, Cpu, Activity, Settings2, LogOut, ShieldCheck, CheckCircle2, Coffee, X, ScanLine, MessageSquare, Send, UserCog, MailOpen, Crown } from 'lucide-react';
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { db } from './firebase';
import { collection, addDoc, getDocs, deleteDoc, serverTimestamp, query, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';

const API_ENDPOINT = "https://ev-dashboard-j1l5.onrender.com/api/voltage";

// SEMI-CIRCULAR GAUGE WITH NEEDLE
const Gauge = ({ value, max }) => {
  const radius = 130;
  const cx = 175;
  const cy = 150;
  
  const percent = Math.min(Math.max(value / max, 0), 1);
  const angle = percent * 180 - 90; // -90 (Left) to +90 (Right)
  
  // Generate ticks
  const ticks = [];
  const majorTickCount = 10;
  const minorTickCount = 40;
  
  for (let i = 0; i <= minorTickCount; i++) {
    const tickPercent = i / minorTickCount;
    const tickAngle = tickPercent * 180 - 180;
    const isMajor = i % (minorTickCount / majorTickCount) === 0;
    
    const rad = (tickAngle * Math.PI) / 180;
    const innerRadius = isMajor ? radius - 15 : radius - 8;
    const outerRadius = radius;
    
    const x1 = cx + outerRadius * Math.cos(rad);
    const y1 = cy + outerRadius * Math.sin(rad);
    const x2 = cx + innerRadius * Math.cos(rad);
    const y2 = cy + innerRadius * Math.sin(rad);
    
    ticks.push(
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth={isMajor ? 2.5 : 1} />
    );
    
    if (isMajor) {
      const textRadius = radius - 30;
      const tx = cx + textRadius * Math.cos(rad);
      const ty = cy + textRadius * Math.sin(rad);
      const tickVal = Math.round((tickPercent * max));
      ticks.push(
        <text key={`t-${i}`} x={tx} y={ty} fill="#64748b" fontSize="11" fontWeight="700" textAnchor="middle" dominantBaseline="middle" className="font-mono">
          {tickVal}
        </text>
      );
    }
  }

  return (
    <div className="relative w-full max-w-[350px] mx-auto flex flex-col items-center">
      <svg viewBox="0 0 350 180" className="w-full h-auto drop-shadow-sm">
        {/* Ticks */}
        {ticks}

        {/* Needle */}
        <g transform={`rotate(${angle}, ${cx}, ${cy})`} className="transition-transform duration-700 ease-out">
          <polygon points={`${cx-5},${cy} ${cx+5},${cy} ${cx},${cy-radius+15}`} fill="#334155" />
          <circle cx={cx} cy={cy} r="10" fill="#334155" />
          <circle cx={cx} cy={cy} r="4" fill="#ffffff" />
        </g>
      </svg>
      
      {/* Readout */}
      <div className="absolute bottom-[-20px] left-0 right-0 flex flex-col items-center justify-center">
        <span className="text-slate-500 text-xs font-semibold mb-1 uppercase tracking-widest">Voltage</span>
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-bold font-mono tracking-tighter text-slate-800 drop-shadow-sm">{value.toFixed(2)}</span>
          <span className="text-xl text-slate-400 font-medium">V</span>
        </div>
      </div>
    </div>
  );
};

// AMBIENT BACKGROUND
const AmbientBackground = () => (
  <>
    <div className="animated-bg"></div>
    <div className="orb orb-1"></div>
    <div className="orb orb-2"></div>
    <div className="orb orb-3"></div>
  </>
);

// MAIN APP
export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('ev_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [screen, setScreen] = useState(() => {
    const saved = localStorage.getItem('ev_user');
    return saved ? 'devices' : 'login';
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState("");
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [lang, setLang] = useState('GB');
  const [isOnline, setIsOnline] = useState(true);
  const [mode, setMode] = useState('');
  const [range, setRange] = useState(400); 
  
  const [devicesList, setDevicesList] = useState(() => {
    const saved = localStorage.getItem('ev_devices');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeDeviceId, setActiveDeviceId] = useState(() => {
    return localStorage.getItem('ev_active_device') || null;
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceName, setNewDeviceName] = useState(''); 
  
  // Save Devices to localStorage when updated
  useEffect(() => {
    localStorage.setItem('ev_devices', JSON.stringify(devicesList));
  }, [devicesList]); 

  useEffect(() => {
    if (activeDeviceId) {
      localStorage.setItem('ev_active_device', activeDeviceId);
      
      // ส่งคำขอลงทะเบียนรับแจ้งเตือน Email สำหรับอุปกรณ์นี้
      if (user && user.email) {
        const subscribeEndpoint = API_ENDPOINT.replace('/voltage', '/subscribe');
        fetch(subscribeEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_id: activeDeviceId, email: user.email })
        }).catch(err => console.log("Alert subscription omitted in dev mode", err));
      }
    }
  }, [activeDeviceId, user]); 

  // Real API pinging for device data
  useEffect(() => {
    if (screen !== 'devices' || devicesList.length === 0) return;
    let isMounted = true;
    
    const interval = setInterval(() => {
      devicesList.forEach(async (dev) => {
        try {
          const res = await fetch(`${API_ENDPOINT}?device_id=${dev.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data && Object.keys(data).length > 0 && isMounted) {
              
              const currentString = data.last_updated || JSON.stringify(data);
              
              // เช็คจาก prev state เพื่อป้องกันบั๊กเวลาดึงข้อมูลถี่เกินไป
              setDevicesList(prev => prev.map(d => {
                if (d.id !== dev.id) return d;
                
                if (d.lastSeenString === currentString) {
                  const unchangedCount = (d.unchangedCount || 0) + 1;
                  // ถ้าซ้ำเกิน 2 รอบ (400ms) ให้ถือว่าตาย
                  return { ...d, isOnline: unchangedCount <= 2, unchangedCount };
                } else {
                  // ข้อมูลใหม่มา รีเซ็ตการนับและตั้งเป็น ONLINE
                  return { ...d, isOnline: true, lastSeenString: currentString, unchangedCount: 0 };
                }
              }));

            } else if (dev.isOnline && isMounted) {
              setDevicesList(prev => prev.map(d => d.id === dev.id ? { ...d, isOnline: false } : d));
            }
          } else if (dev.isOnline && isMounted) {
            setDevicesList(prev => prev.map(d => d.id === dev.id ? { ...d, isOnline: false } : d));
          }
        } catch (error) {
          if (dev.isOnline && isMounted) {
            setDevicesList(prev => prev.map(d => d.id === dev.id ? { ...d, isOnline: false } : d));
          }
        }
      });
    }, 200); // ดึงข้อมูลทุกๆ 200ms เพื่อความเรียลไทม์สูงสุด

    return () => { 
      isMounted = false; 
      clearInterval(interval);
    };
  }, [screen, devicesList]);
  
  // Dashboard State
  const [voltage, setVoltage] = useState(0);
  const [history, setHistory] = useState({}); // { deviceId: [data...] }
  const [isRecording, setIsRecording] = useState(false);
  const [autoSaveIntervalVal, setAutoSaveIntervalVal] = useState(1);
  const [autoSaveUnit, setAutoSaveUnit] = useState('seconds');
  const voltageRef = React.useRef(0);
  
  const [posShort, setPosShort] = useState(false);
  const [negShort, setNegShort] = useState(false);

  const posShortRef = React.useRef(false);
  const negShortRef = React.useRef(false);
  const activeDeviceRef = React.useRef(activeDeviceId);

  useEffect(() => {
    voltageRef.current = voltage;
    posShortRef.current = posShort;
    negShortRef.current = negShort;
    activeDeviceRef.current = activeDeviceId;
  }, [voltage, posShort, negShort, activeDeviceId]);

  // Real API Fetch Logic
  // Admin Check
  useEffect(() => {
    const checkAdmin = async () => {
      if (user?.email) {
        // อภิสิทธิ์ชน 555 - ล็อคให้เป็น Owner ถาวร
        if (user.email.toLowerCase() === 'folknantayot@gmail.com') {
          setIsAdmin(true);
          setUserRole('owner');
          try { await setDoc(doc(db, "admins", user.email), { role: "owner", addedAt: serverTimestamp() }, { merge: true }); } catch(e) {}
          return;
        }

        try {
          // Check if admins collection is completely empty
          const adminSnapshot = await getDocs(collection(db, "admins"));
          if (adminSnapshot.empty) {
            // First user ever becomes master admin automatically!
            await setDoc(doc(db, "admins", user.email), { role: "admin", addedAt: serverTimestamp() });
            setIsAdmin(true);
            setUserRole('admin');
            return;
          }

          const adminDoc = await getDoc(doc(db, "admins", user.email));
          if (adminDoc.exists()) {
            setIsAdmin(true);
            setUserRole(adminDoc.data().role || 'admin');
          } else {
            setIsAdmin(false);
            setUserRole('user');
          }
        } catch (e) {
          console.error("Error checking admin:", e);
        }
      } else {
        setIsAdmin(false);
        setUserRole('user');
      }
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (!user && screen !== 'login') {
      setScreen('login');
    }
  }, [user, screen]);

  useEffect(() => {
    let interval;
    if (screen === 'dashboard') {
      let localUnchangedCount = 0;
      let localLastSeen = "";
      
      interval = setInterval(async () => {
        try {
          if (devicesList.length === 0) return;
          // Use the active device, or fallback to the first device in list
          const activeDevice = devicesList.find(d => d.id === activeDeviceId) || devicesList.find(d => d.isOnline) || devicesList[0];
          const res = await fetch(`${API_ENDPOINT}?device_id=${activeDevice.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.voltage !== undefined) {
              const currentString = data.last_updated || JSON.stringify(data);
              
              if (localLastSeen === currentString) {
                localUnchangedCount++;
                if (localUnchangedCount > 2) {
                  setVoltage(0); // ตัดค่าเป็น 0 ถ้าออฟไลน์เกิน 3 รอบ (600ms)
                }
              } else {
                localLastSeen = currentString;
                localUnchangedCount = 0;
                setVoltage(data.voltage);
                setPosShort(data.posShort || false);
                setNegShort(data.negShort || false);
              }
            }
          }
        } catch (err) {
          // No mock data - keep last known state if backend goes offline
          console.error("Backend fetch failed:", err);
          setVoltage(0);
        }
      }, 200); // อัปเดตทุก 200ms เพื่อความเรียลไทม์สูงสุด
    }
    return () => clearInterval(interval);
  }, [screen, range]);

  useEffect(() => {
    let interval;
    if (isRecording && screen === 'dashboard') {
      let ms = autoSaveIntervalVal * 1000;
      if (autoSaveUnit === 'minutes') ms *= 60;
      if (autoSaveUnit === 'hours') ms *= 3600;
      
      interval = setInterval(() => {
        setHistory(prev => {
          const currentId = activeDeviceRef.current;
          if (!currentId) return prev;
          const now = new Date();
          const dateStr = now.toLocaleDateString('th-TH');
          const timeStr = now.toLocaleTimeString('th-TH');
          const deviceHistory = prev[currentId] || [];
          return {
            ...prev,
            [currentId]: [...deviceHistory, { 
              time: timeStr, 
              fullDate: `${dateStr} ${timeStr}`,
              voltage: parseFloat(voltageRef.current.toFixed(2)),
              posShort: posShortRef.current,
              negShort: negShortRef.current
            }]
          };
        });
      }, ms);
    }
    return () => clearInterval(interval);
  }, [isRecording, screen, autoSaveIntervalVal, autoSaveUnit]);

  const downloadCSV = () => {
    const currentHistory = history[activeDeviceId] || [];
    if (currentHistory.length === 0) return;
    const headers = "DateTime,Voltage(V),Battery Status,Short Status\n";
    const rows = currentHistory.map(h => {
      const rowPercent = Math.min(Math.max(h.voltage / range, 0), 1);
      const rowIsDanger = rowPercent > 0.8;
      const rowIsWarning = rowPercent > 0.6;
      
      let status = "NORMAL";
      if (h.posShort) status = "(+) SHORT";
      else if (h.negShort) status = "(-) SHORT";
      
      let battStatus = "NORMAL";
      if (rowIsDanger) battStatus = "CRITICAL";
      else if (rowIsWarning) battStatus = "WARNING";
      
      return `"${h.fullDate}",${h.voltage},"${battStatus}","${status}"`;
    }).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `voltage_history_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // UI Components
  const LanguageSelector = () => (
    <div className="flex w-max mx-auto bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/60 shadow-sm">
      {['TH', 'GB', 'CN', 'JP'].map(l => (
        <button 
          key={l} 
          onClick={() => setLang(l)} 
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
            lang === l 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );

  const TopBar = ({ showPill = true }) => {
    const handleLogout = () => {
      googleLogout();
      setUser(null);
      localStorage.removeItem('ev_user');
      setIsRecording(false);
      setHistory({});
      setScreen('login');
    };
    return (
      <div className="w-full flex justify-between items-center mb-10 mt-4">
        {showPill ? (
          <div className="px-5 py-2 rounded-2xl bg-white/60 border border-white/80 text-blue-600 text-sm font-semibold flex items-center gap-2 shadow-sm backdrop-blur-md">
            <ShieldCheck size={18} /> {t.secureSession}
          </div>
        ) : <div />}
          <div className="flex items-center gap-3">
          {isAdmin && (
            <button onClick={() => setScreen('admin')} className="hidden sm:flex items-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded-xl text-sm font-bold transition-all shadow-sm">
              <UserCog size={16} /> {t.adminBtn || "Admin"}
            </button>
          )}
          <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/80 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden shadow-inner flex-shrink-0">
              <img src={user?.picture || "https://api.dicebear.com/7.x/avataaars/svg?seed=Glass"} alt="avatar" />
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-sm font-semibold text-slate-700 truncate max-w-[120px]">{user?.name || t.guestUser}</span>
              {userRole === 'owner' && (
                <span className="text-[10px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                  <Crown size={12} className="text-amber-500"/> Owner
                </span>
              )}
              {userRole === 'admin' && (
                <span className="text-[10px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                  <ShieldCheck size={12} className="text-blue-500"/> Admin
                </span>
              )}
            </div>
          </div>
          <button onClick={handleLogout} className="bg-red-50 hover:bg-red-500 hover:text-white text-red-500 p-3 rounded-2xl transition-all shadow-sm border border-red-100">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    );
  };

  // Content Dictionaries
  const textData = {
    TH: {
      title: "ระบบตรวจวัดแรงดันไฟฟ้า",
      subtitle: "เข้าสู่ระบบเพื่อเข้าถึงแดชบอร์ดของคุณ",
      loginBtn: "เข้าสู่ระบบด้วย Google",
      devices: "เครื่องของฉัน",
      modeTitle: "เลือกโหมดการทำงาน",
      autoMode: "อัตโนมัติ",
      manualMode: "กำหนดเอง",
      rangeTitle: "เลือกย่านวัด",
      dashboard: "แดชบอร์ดเรียลไทม์",
      addDevice: "เพิ่มเครื่อง",
      deviceId: "รหัสเครื่อง",
      deviceName: "ชื่อ (ไม่บังคับ)",
      cancel: "ยกเลิก",
      save: "บันทึก",
      noDevices: "ยังไม่มีเครื่อง — เพิ่มเครื่องเพื่อเริ่มดูข้อมูล",
      posShortTitle: "(+) ไฟฟ้าลัดวงจรขั้วบวก",
      negShortTitle: "(-) ไฟฟ้าลัดวงจรขั้วลบ",
      detected: "พบความผิดปกติ",
      clear: "ปกติ",
      chartTitle: "กราฟประวัติแรงดันไฟฟ้า",
      noHistory: "ไม่มีประวัติ เปิดใช้งานบันทึกอัตโนมัติเพื่อบันทึกข้อมูล",
      donateBtn: "สนับสนุน",
      donateTitle: "สนับสนุนค่าน้ำชา ☕️",
      donateDesc: "ช่วยสนับสนุนผู้พัฒนาเพื่อต่อยอดฟีเจอร์ใหม่ๆ และดูแลเซิร์ฟเวอร์",
      reportBtn: "แจ้งปัญหา",
      adminBtn: "แอดมินบอร์ด",
      saveNow: "บันทึกตอนนี้",
      autoSaveTitle: "ตั้งค่าบันทึกอัตโนมัติ",
      seconds: "วินาที",
      minutes: "นาที",
      hours: "ชั่วโมง",
      startAutoSave: "เริ่มบันทึกอัตโนมัติ",
      stopAutoSave: "หยุดบันทึกอัตโนมัติ",
      recordedValues: "ค่าที่บันทึกไว้",
      downloadCSV: "ดาวน์โหลด CSV",
      clearData: "ล้างข้อมูล",
      dateCol: "วันที่",
      timeCol: "เวลา",
      statusCol: "สถานะช็อต",
      battCol: "สถานะแบตเตอรี่",
      voltCol: "แรงดันไฟฟ้า (V)",
      noRecords: "ไม่มีค่าที่บันทึกไว้",
      live: "เรียลไทม์",
      back: "กลับ",
      online: "ออนไลน์",
      offline: "ออฟไลน์",
      guestUser: "ผู้เยี่ยมชม",
      secureSession: "เซสชั่นปลอดภัย",
      critical: "อันตราย",
      warning: "ระวัง",
      normal: "ปกติ",
    },
    GB: {
      title: "Voltage Monitoring System",
      subtitle: "Sign in to access your secure dashboard",
      loginBtn: "Continue with Google",
      devices: "My Devices",
      modeTitle: "Select Operation Mode",
      autoMode: "Auto Scale",
      manualMode: "Manual",
      rangeTitle: "Select Voltage Range",
      dashboard: "Real-time Dashboard",
      addDevice: "Add Device",
      deviceId: "Device ID",
      deviceName: "Name (Optional)",
      cancel: "Cancel",
      save: "Save",
      noDevices: "No devices yet — add a device to start viewing data",
      posShortTitle: "(+) Positive Short",
      negShortTitle: "(-) Negative Short",
      detected: "DETECTED",
      clear: "CLEAR",
      chartTitle: "Voltage History Chart",
      noHistory: "No history. Enable Auto Save to record data.",
      donateBtn: "Support",
      donateTitle: "Buy me a coffee ☕️",
      donateDesc: "Help me keep this project alive and add more features!",
      reportBtn: "Report Issue",
      adminBtn: "Admin Panel",
      saveNow: "Save Now",
      autoSaveTitle: "Auto Save Settings",
      seconds: "Seconds",
      minutes: "Minutes",
      hours: "Hours",
      startAutoSave: "Start Auto Save",
      stopAutoSave: "Stop Auto Save",
      recordedValues: "Recorded Values",
      downloadCSV: "Download CSV",
      clearData: "Clear Data",
      dateCol: "Date",
      timeCol: "Time",
      statusCol: "Short Status",
      battCol: "Battery Status",
      voltCol: "Voltage (V)",
      noRecords: "No recorded values.",
      live: "LIVE",
      back: "Back",
      online: "Online",
      offline: "Offline",
      guestUser: "Guest User",
      secureSession: "Secure Session",
      critical: "CRITICAL",
      warning: "WARNING",
      normal: "NORMAL",
    },
    CN: {
      title: "电压监测系统",
      subtitle: "登录以访问您的仪表板",
      loginBtn: "使用 Google 登录",
      devices: "我的设备",
      modeTitle: "选择操作模式",
      autoMode: "自动",
      manualMode: "手动",
      rangeTitle: "选择电压范围",
      dashboard: "实时仪表板",
      addDevice: "添加设备",
      deviceId: "设备ID",
      deviceName: "名称（可选）",
      cancel: "取消",
      save: "保存",
      noDevices: "暂无设备 — 添加设备以开始查看数据",
      posShortTitle: "(+) 正极短路",
      negShortTitle: "(-) 负极短路",
      detected: "检测到异常",
      clear: "正常",
      chartTitle: "电压历史图表",
      noHistory: "暂无历史记录。启用自动保存以记录数据。",
      donateBtn: "支持",
      donateTitle: "请我喝杯咖啡 ☕️",
      donateDesc: "帮助我保持这个项目的活跃并添加更多功能！",
      reportBtn: "报告问题",
      adminBtn: "管理面板",
      saveNow: "立即保存",
      autoSaveTitle: "自动保存设置",
      seconds: "秒",
      minutes: "分钟",
      hours: "小时",
      startAutoSave: "开始自动保存",
      stopAutoSave: "停止自动保存",
      recordedValues: "记录值",
      downloadCSV: "下载 CSV",
      clearData: "清除数据",
      dateCol: "日期",
      timeCol: "时间",
      statusCol: "短路状态",
      battCol: "电池状态",
      voltCol: "电压 (V)",
      noRecords: "无记录值。",
      live: "实时",
      back: "返回",
      online: "在线",
      offline: "离线",
      guestUser: "访客",
      secureSession: "安全会话",
      critical: "危险",
      warning: "警告",
      normal: "正常",
    },
    JP: {
      title: "電圧モニタリングシステム",
      subtitle: "ログインしてダッシュボードにアクセス",
      loginBtn: "Googleで続ける",
      devices: "マイデバイス",
      modeTitle: "動作モードの選択",
      autoMode: "自動",
      manualMode: "マニュアル",
      rangeTitle: "電圧範囲の選択",
      dashboard: "リアルタイムダッシュボード",
      addDevice: "デバイスを追加",
      deviceId: "デバイスID",
      deviceName: "名前 (任意)",
      cancel: "キャンセル",
      save: "保存",
      noDevices: "デバイスがありません — デバイスを追加してデータ表示を開始",
      posShortTitle: "(+) 正極ショート",
      negShortTitle: "(-) 負極ショート",
      detected: "異常検出",
      clear: "正常",
      chartTitle: "電圧履歴チャート",
      noHistory: "履歴なし。自動保存を有効にしてデータを記録してください。",
      donateBtn: "サポート",
      donateTitle: "コーヒーをおごる ☕️",
      donateDesc: "このプロジェクトを継続し、機能を追加するためにご支援ください！",
      reportBtn: "問題を報告",
      adminBtn: "管理パネル",
      saveNow: "今すぐ保存",
      autoSaveTitle: "自動保存設定",
      seconds: "秒",
      minutes: "分",
      hours: "時間",
      startAutoSave: "自動保存を開始",
      stopAutoSave: "自動保存を停止",
      recordedValues: "記録された値",
      downloadCSV: "CSVをダウンロード",
      clearData: "データをクリア",
      dateCol: "日付",
      timeCol: "時間",
      statusCol: "ショート状態",
      battCol: "バッテリー状態",
      voltCol: "電圧 (V)",
      noRecords: "記録された値はありません。",
      live: "ライブ",
      back: "戻る",
      online: "オンライン",
      offline: "オフライン",
      guestUser: "ゲストユーザー",
      secureSession: "セキュアセッション",
      critical: "危険",
      warning: "警告",
      normal: "正常",
    }
  };
  const t = textData[lang] || textData.GB;

  // Update Document Title based on language
  useEffect(() => {
    document.title = t.title;
  }, [t.title]);

  const SupportFeatures = () => (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3 items-end">
        <button 
          onClick={() => setShowReportModal(true)}
          className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 p-3 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center gap-2 group"
        >
          <span className="font-bold hidden md:block max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap px-0 group-hover:px-2 text-sm">
            {t.reportBtn || "Report"}
          </span>
          <MessageSquare size={20} className="text-blue-500" />
        </button>

        <button 
          onClick={() => setShowDonateModal(true)}
          className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center gap-2 group"
        >
          <Coffee size={24} className="group-hover:animate-bounce" />
          <span className="font-bold hidden md:block max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap px-0 group-hover:px-2">
            {t.donateBtn || "Support"}
          </span>
        </button>
      </div>

      {showDonateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white/90 backdrop-blur-xl border border-white p-8 rounded-3xl shadow-2xl max-w-sm w-full relative animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setShowDonateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mb-4">
                <Coffee size={32} />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">{t.donateTitle || "Support Project"}</h3>
              <p className="text-slate-500 text-sm mb-6">{t.donateDesc || "Help me keep this project alive!"}</p>
              
               <div className="w-48 h-48 bg-slate-100 rounded-2xl mb-6 flex items-center justify-center border-2 border-slate-300 overflow-hidden relative shadow-inner p-2">
                 <img src="https://i.ibb.co/bML3q7Y4/9391.jpg" alt="PromptPay QR" className="w-full h-full object-contain relative z-10 rounded-xl" />
              </div>
              
              <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                <p className="text-sm font-bold text-slate-700">ชื่อบัญชี: นายนันทยศ รอดอยู่</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const ReportModal = () => {
    if (!showReportModal) return null;
    const handleSubmit = async () => {
      if (!reportText.trim()) return;
      try {
        await addDoc(collection(db, "messages"), {
          text: reportText,
          senderName: user?.name || "Anonymous",
          senderEmail: user?.email || "No Email",
          createdAt: serverTimestamp(),
          status: "unread"
        });
        setReportText("");
        setShowReportModal(false);
        alert("ส่งข้อความเรียบร้อยแล้ว! (Message Sent)");
      } catch (e) {
        alert("เกิดข้อผิดพลาดในการส่งข้อความ: " + e.message);
      }
    };
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="bg-white/90 backdrop-blur-xl border border-white p-6 rounded-3xl shadow-2xl max-w-md w-full relative animate-in zoom-in-95 duration-300">
          <button onClick={() => setShowReportModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors">
            <X size={20} />
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">{t.reportBtn || "Report Issue"}</h3>
          </div>
          <textarea 
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder="อธิบายปัญหาที่พบ หรือข้อเสนอแนะ..."
            className="w-full h-32 p-4 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4 text-slate-700"
          ></textarea>
          <button onClick={handleSubmit} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md flex justify-center items-center gap-2">
            <Send size={18} /> ส่งข้อความ
          </button>
        </div>
      </div>
    );
  };

  const AdminDashboardScreen = () => {
    const [messages, setMessages] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [newAdminEmail, setNewAdminEmail] = useState("");
    const [activeTab, setActiveTab] = useState("messages");

    useEffect(() => {
      const fetchData = async () => {
        try {
          const msgQ = query(collection(db, "messages"), orderBy("createdAt", "desc"));
          const msgSnapshot = await getDocs(msgQ);
          setMessages(msgSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          
          const adminSnapshot = await getDocs(collection(db, "admins"));
          setAdmins(adminSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (e) {
          console.error("Admin fetch error", e);
        }
      };
      fetchData();
    }, []);

    const handleAddAdmin = async () => {
      if (!newAdminEmail.trim() || !newAdminEmail.includes("@")) return;
      await setDoc(doc(db, "admins", newAdminEmail), { role: "admin", addedAt: serverTimestamp() });
      setNewAdminEmail("");
      const adminSnapshot = await getDocs(collection(db, "admins"));
      setAdmins(adminSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    const handleDeleteMsg = async (id) => {
      if (!window.confirm("Delete this message?")) return;
      await deleteDoc(doc(db, "messages", id));
      setMessages(messages.filter(m => m.id !== id));
    };

    const handleDeleteAdmin = async (id) => {
      if (!window.confirm("Remove this admin?")) return;
      if (id === user.email) {
         alert("Cannot remove yourself!"); return;
      }
      await deleteDoc(doc(db, "admins", id));
      setAdmins(admins.filter(a => a.id !== id));
    };

    return (
      <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto flex flex-col relative z-10">
        <AmbientBackground />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-white shadow-sm gap-4">
          <div className="flex items-center gap-3">
             <button onClick={() => setScreen('devices')} className="p-2 bg-white/80 hover:bg-white rounded-full text-slate-600 transition-all shadow-sm">
                <ArrowLeft size={20} />
             </button>
             <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><UserCog size={28} className="text-blue-600"/> Admin Panel</h2>
          </div>
          <div className="flex bg-slate-200/50 p-1 rounded-xl w-full md:w-auto">
            <button onClick={() => setActiveTab('messages')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-semibold transition-all ${activeTab === 'messages' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Messages</button>
            <button onClick={() => setActiveTab('admins')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-semibold transition-all ${activeTab === 'admins' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Admins</button>
          </div>
        </div>

        <div className="flex-1 glass-panel p-6 overflow-hidden flex flex-col">
          {activeTab === 'messages' && (
            <div className="flex-1 overflow-auto">
               <h3 className="text-lg font-bold mb-4 text-slate-700 flex items-center gap-2"><MailOpen size={20}/> User Feedback</h3>
               {messages.length === 0 ? (
                 <div className="text-center text-slate-500 py-10">No messages yet.</div>
               ) : (
                 <div className="grid gap-4">
                   {messages.map(msg => (
                     <div key={msg.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative pr-12">
                       <button onClick={() => handleDeleteMsg(msg.id)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500"><Trash2 size={18}/></button>
                       <p className="font-bold text-slate-800">{msg.senderName} <span className="text-xs font-normal text-slate-500 ml-2">{msg.senderEmail}</span></p>
                       <p className="text-xs text-slate-400 mb-2">{msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString() : 'Just now'}</p>
                       <p className="text-slate-600 bg-slate-50 p-3 rounded-lg text-sm">{msg.text}</p>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          )}

          {activeTab === 'admins' && (
            <div className="flex-1 overflow-auto">
               <h3 className="text-lg font-bold mb-4 text-slate-700 flex items-center gap-2"><ShieldCheck size={20}/> Manage Admins</h3>
               
               <div className="flex gap-2 mb-6">
                 <input type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="Email address..." className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                 <button onClick={handleAddAdmin} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2"><Plus size={18}/> Add</button>
               </div>

               <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                     <tr><th className="p-4">Email</th><th className="p-4">Role</th><th className="p-4 w-20 text-center">Action</th></tr>
                   </thead>
                   <tbody>
                     {admins.map(admin => (
                       <tr key={admin.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                         <td className="p-4 font-medium text-slate-700 break-all">{admin.id}</td>
                         <td className="p-4"><span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-lg uppercase tracking-wide">{admin.role}</span></td>
                         <td className="p-4 text-center">
                           <button onClick={() => handleDeleteAdmin(admin.id)} className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50"><Trash2 size={18}/></button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Screens
  // Using GoogleLogin component for better mobile support instead of useGoogleLogin hook

  if (screen === 'login' || !user) {
    return (
      <div className="min-h-screen p-6 md:p-12 flex flex-col items-center justify-center relative z-10">
        <AmbientBackground />
        
        <div className="absolute top-6 right-6 z-20">
          <LanguageSelector />
        </div>
        
        <div className="glass-panel p-12 max-w-md w-full flex flex-col items-center relative overflow-hidden transition-all duration-700">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-[0_8px_30px_rgba(0,122,255,0.15)] mb-8">
            <Zap className="text-blue-500" size={36} strokeWidth={2.5} />
          </div>
          
          <h1 className="text-3xl font-bold mb-3 tracking-tight text-center text-slate-800">
            {t.title}
          </h1>
          <p className="text-slate-500 text-sm mb-12 font-medium text-center">
            {t.subtitle}
          </p>
          
          <div className="w-full flex items-center justify-center mb-2">
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                try {
                  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credentialResponse.credential}`);
                  const userInfo = await res.json();
                  setUser(userInfo);
                  localStorage.setItem('ev_user', JSON.stringify(userInfo));
                  setScreen('devices');
                } catch (error) {
                  console.error('Failed to fetch user info', error);
                }
              }}
              onError={() => {
                console.log('Login Failed');
              }}
              useOneTap
              shape="rectangular"
              size="large"
              width="300"
            />
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'admin' && isAdmin) {
    return <AdminDashboardScreen />;
  }

  if (screen === 'devices') {
    return (
      <div className="min-h-screen p-6 md:p-12 max-w-5xl mx-auto relative z-10 flex flex-col">
        <AmbientBackground />
        <TopBar />
        <SupportFeatures />
        {ReportModal()}
        
        <div className="flex-1 flex flex-col items-center justify-center -mt-10">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold tracking-tight text-slate-800 mb-3">{t.title}</h1>
            <LanguageSelector />
          </div>

          <div className="glass-panel p-8 w-full max-w-lg transition-all duration-500">
             <div className="flex justify-between items-center mb-6">
                <span className="font-bold text-slate-700 text-lg">{t.devices}</span>
                {!showAddForm && (
                  <button onClick={() => setShowAddForm(true)} className="glass-btn px-4 py-1.5 text-sm font-semibold flex items-center gap-2 text-blue-600 hover:text-blue-700">
                    <Plus size={16} /> {t.addDevice}
                  </button>
                )}
             </div>

             {showAddForm && (
               <div className="bg-white/60 border border-white/80 rounded-2xl p-5 mb-6 shadow-sm">
                 <input 
                   type="text" 
                   placeholder={t.deviceId} 
                   className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 mb-3 outline-none focus:border-blue-400 focus:bg-white transition-all text-slate-700"
                   value={newDeviceId}
                   onChange={e => setNewDeviceId(e.target.value)}
                 />
                 <input 
                   type="text" 
                   placeholder={t.deviceName} 
                   className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 mb-4 outline-none focus:border-blue-400 focus:bg-white transition-all text-slate-700"
                   value={newDeviceName}
                   onChange={e => setNewDeviceName(e.target.value)}
                 />
                 <div className="flex justify-end gap-3">
                   <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-slate-500 hover:text-slate-800 font-medium transition-colors">
                     {t.cancel}
                   </button>
                   <button 
                     onClick={() => {
                       if(newDeviceId.trim() === '') return;
                       setDevicesList([...devicesList, { id: newDeviceId, name: newDeviceName || newDeviceId, isOnline: false }]);
                       setShowAddForm(false);
                       setNewDeviceId('');
                       setNewDeviceName('');
                     }}
                     className="primary-btn px-6 py-2 text-sm"
                   >
                     {t.save}
                   </button>
                 </div>
               </div>
             )}

             {!showAddForm && devicesList.length === 0 ? (
               <div className="text-center py-8 mb-6 text-slate-500 text-sm">
                 {t.noDevices}
               </div>
             ) : (!showAddForm && (
               <div className="space-y-3 mb-8">
                 {devicesList.map((dev, idx) => (
                   <div 
                     key={idx} 
                     onClick={() => {
                        if (!dev.isOnline) return; // Prevent clicking if offline
                        setActiveDeviceId(dev.id);
                        setScreen('mode');
                     }}
                     className={`border rounded-2xl p-4 flex justify-between items-center shadow-sm transition-colors group
                       ${!dev.isOnline ? 'opacity-60 cursor-not-allowed bg-slate-50/50 border-slate-200' : 
                       (activeDeviceId === dev.id ? 'bg-blue-50/80 border-blue-200 cursor-pointer' : 'bg-white/50 border-white/80 hover:bg-white/70 cursor-pointer')}`}
                   >
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-xl ${dev.isOnline ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                          <Cpu size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                             <h4 className="font-bold text-slate-800">{dev.name}</h4>
                             <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider
                               ${dev.isOnline ? 'bg-green-50 border-green-200 text-green-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
                             >
                               <div className={`w-1.5 h-1.5 rounded-full ${dev.isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
                               {dev.isOnline ? t.online : t.offline}
                             </div>
                          </div>
                          <p className="text-xs text-slate-500">{dev.id}</p>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDevicesList(devicesList.filter((_, i) => i !== idx));
                          if (activeDeviceId === dev.id) setActiveDeviceId(null);
                        }}
                        className="text-slate-400 hover:text-red-500 transition-colors p-2"
                      >
                        <Trash2 size={18} />
                      </button>
                   </div>
                 ))}
               </div>
             ))}
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'mode') {
    return (
      <div className="min-h-screen p-6 md:p-12 max-w-5xl mx-auto relative z-10 flex flex-col">
        <AmbientBackground />
        <TopBar showPill={false} />
        <SupportFeatures />
        {ReportModal()}

        <div className="flex-1 flex flex-col justify-center -mt-10">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-800 mb-3 tracking-tight">{t.modeTitle}</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto w-full">
            <button 
              onClick={() => { setMode('auto'); setScreen('dashboard'); }}
              className="glass-panel p-10 flex flex-col items-center text-center hover:scale-105 transition-transform duration-300 group"
            >
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors duration-300 mb-6 text-blue-500 shadow-sm">
                <Activity size={36} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">{t.autoMode}</h2>
            </button>

            <button 
              onClick={() => { setMode('manual'); setScreen('range'); }}
              className="glass-panel p-10 flex flex-col items-center text-center hover:scale-105 transition-transform duration-300 group"
            >
              <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors duration-300 mb-6 text-purple-500 shadow-sm">
                <Settings2 size={36} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">{t.manualMode}</h2>
            </button>
          </div>
          
          <button onClick={() => setScreen('devices')} className="mx-auto mt-12 glass-btn px-6 py-3 flex items-center gap-2">
            <ArrowLeft size={18} /> {t.back}
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'range') {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-20 p-6">
        <AmbientBackground />
        <SupportFeatures />
        {ReportModal()}
        <div className="glass-panel p-10 w-full max-w-2xl relative text-center">
          <h2 className="text-3xl font-bold mb-10 text-slate-800 tracking-tight">{t.rangeTitle}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[48, 72, 400].map(v => (
              <button 
                key={v}
                onClick={() => { setRange(v); setScreen('dashboard'); }}
                className="glass-btn py-10 flex flex-col items-center justify-center hover:bg-white hover:border-blue-200 group"
              >
                <span className="text-4xl font-bold font-mono text-slate-700 group-hover:text-blue-600 transition-colors">{v}V</span>
              </button>
            ))}
          </div>
          <button onClick={() => setScreen('mode')} className="mt-10 mx-auto glass-btn px-6 py-3 flex items-center gap-2">
            <ArrowLeft size={18} /> {t.back}
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'dashboard') {
    const percent = Math.min(Math.max(voltage / range, 0), 1);
    const isWarning = percent > 0.6;
    const isDanger = percent > 0.8;

    return (
      <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto flex flex-col relative z-10">
        <AmbientBackground />
        <SupportFeatures />
        {ReportModal()}
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
             <button onClick={() => setScreen('mode')} className="glass-btn p-3 rounded-full">
               <ArrowLeft size={20} />
             </button>
             <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{t.dashboard}</h1>
          </div>
          <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full border border-green-200">
            <Wifi size={16} className="text-green-500" />
            <span className="text-green-600 font-semibold text-sm">{t.live}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
          {/* Main Gauge Panel */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="glass-panel p-8 flex flex-col h-full justify-between">
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{t.modeTitle}: {mode === 'auto' ? t.autoMode : t.manualMode}</h2>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center py-10">
                 <Gauge value={voltage} max={range} />
              </div>

              {/* Status Badge */}
              <div className="flex justify-center mb-8">
                 <div className={`px-6 py-2.5 rounded-full border flex items-center gap-2 font-bold text-sm shadow-sm
                   ${isDanger ? 'bg-red-50 border-red-200 text-red-600' : 
                     isWarning ? 'bg-yellow-50 border-yellow-200 text-yellow-600' : 
                     'bg-green-50 border-green-200 text-green-600'}`}
                 >
                   <CheckCircle2 size={18} />
                   {isDanger ? t.critical : isWarning ? t.warning : t.normal}
                 </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-4 mt-2">
                 <button 
                   onClick={() => {
                     const now = new Date();
                     setHistory(prev => [...prev, { 
                       time: now.toLocaleTimeString('th-TH'), 
                       fullDate: `${now.toLocaleDateString('th-TH')} ${now.toLocaleTimeString('th-TH')}`,
                       voltage: parseFloat(voltage.toFixed(2)),
                       posShort: posShort,
                       negShort: negShort
                     }]);
                   }}
                   className="glass-btn py-3.5 flex items-center justify-center gap-2 font-semibold"
                 >
                   <Download size={18} /> {t.saveNow}
                 </button>
                 
                 <div className="flex flex-col gap-3 p-4 bg-white/40 border border-white/60 rounded-xl shadow-sm">
                   <div className="flex items-center justify-between">
                     <span className="text-sm font-bold text-slate-700">{t.autoSaveTitle}</span>
                   </div>
                   <div className="flex gap-2">
                     <input 
                       type="number" 
                       min="1"
                       value={autoSaveIntervalVal}
                       onChange={e => setAutoSaveIntervalVal(Number(e.target.value))}
                       disabled={isRecording}
                       className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-2 text-center text-sm font-bold outline-none text-slate-700 disabled:opacity-50"
                     />
                     <select 
                       value={autoSaveUnit}
                       onChange={e => setAutoSaveUnit(e.target.value)}
                       disabled={isRecording}
                       className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-semibold outline-none text-slate-700 disabled:opacity-50"
                     >
                       <option value="seconds">{t.seconds}</option>
                       <option value="minutes">{t.minutes}</option>
                       <option value="hours">{t.hours}</option>
                     </select>
                   </div>
                   <button 
                     onClick={() => setIsRecording(!isRecording)}
                     className={`py-2.5 mt-1 flex items-center justify-center gap-2 rounded-lg font-semibold transition-all shadow-sm
                       ${isRecording ? 'bg-red-50 border border-red-200 text-red-500 hover:bg-red-100' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
                   >
                     {isRecording ? t.stopAutoSave : t.startAutoSave}
                   </button>
                 </div>
              </div>
            </div>
          </div>

          {/* Right Column: Shorts & Chart */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            
            {/* Short Indicators */}
            <div className="grid grid-cols-2 gap-6">
              <div className="glass-panel p-6 flex items-center gap-4">
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${posShort ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                   <Zap size={24} />
                 </div>
                 <div>
                   <span className="font-bold text-lg text-slate-800 block">{t.posShortTitle}</span>
                   <span className={`text-sm font-semibold ${posShort ? 'text-red-500' : 'text-slate-400'}`}>{posShort ? t.detected : t.clear}</span>
                 </div>
              </div>
              <div className="glass-panel p-6 flex items-center gap-4">
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${negShort ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                   <Zap size={24} />
                 </div>
                 <div>
                   <span className="font-bold text-lg text-slate-800 block">{t.negShortTitle}</span>
                   <span className={`text-sm font-semibold ${negShort ? 'text-red-500' : 'text-slate-400'}`}>{negShort ? t.detected : t.clear}</span>
                 </div>
              </div>
            </div>

            {/* Chart */}
            <div className="glass-panel p-8 flex flex-col min-h-[350px]">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="font-bold text-xl text-slate-800 tracking-tight">{t.chartTitle}</h3>
              </div>
              
              <div className="w-full mt-4 h-[280px]">
                {(history[activeDeviceId] || []).length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                    <Activity size={48} strokeWidth={1} />
                    <span className="text-sm font-medium">{t.noHistory}</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history[activeDeviceId] || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorV" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#007aff" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#007aff" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                      <XAxis dataKey="time" stroke="#86868b" tick={{fontSize: 11, fontFamily: 'Inter'}} tickLine={false} axisLine={false} dy={10} />
                      <YAxis domain={[0, range]} stroke="#86868b" tick={{fontSize: 11, fontFamily: 'Inter'}} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', backdropFilter: 'blur(10px)' }}
                        itemStyle={{ color: '#007aff', fontWeight: 'bold' }}
                        labelFormatter={(label, payload) => {
                          if (payload && payload.length > 0 && payload[0].payload.fullDate) {
                            return payload[0].payload.fullDate;
                          }
                          return label;
                        }}
                      />
                      <Area type="monotone" dataKey="voltage" stroke="#007aff" strokeWidth={4} fillOpacity={1} fill="url(#colorV)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Data Table */}
            <div className="glass-panel p-8 flex flex-col max-h-[400px]">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="font-bold text-xl text-slate-800 tracking-tight">{t.recordedValues}</h3>
                 <div className="flex gap-2">
                   <button onClick={downloadCSV} className="glass-btn px-4 py-2 text-sm flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                     <Download size={16} /> {t.downloadCSV}
                   </button>
                   <button onClick={() => setHistory(prev => ({...prev, [activeDeviceId]: []}))} className="glass-btn px-4 py-2 text-sm flex items-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200">
                     <Trash2 size={16} /> {t.clearData}
                   </button>
                 </div>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-3 px-4 font-semibold text-slate-500 text-sm">{t.dateCol}</th>
                      <th className="py-3 px-4 font-semibold text-slate-500 text-sm">{t.timeCol}</th>
                      <th className="py-3 px-4 font-semibold text-slate-500 text-sm">{t.battCol}</th>
                      <th className="py-3 px-4 font-semibold text-slate-500 text-sm">{t.statusCol}</th>
                      <th className="py-3 px-4 font-semibold text-slate-500 text-sm text-right">{t.voltCol}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(history[activeDeviceId] || [])].reverse().map((h, i) => (
                      <tr key={i} className="border-b border-slate-100/50 hover:bg-white/40 transition-colors">
                        <td className="py-3 px-4 text-slate-700 font-medium text-sm">{h.fullDate.split(' ')[0]}</td>
                        <td className="py-3 px-4 text-slate-700 font-medium text-sm">{h.time}</td>
                        <td className="py-3 px-4">
                          {(() => {
                            const rowPercent = Math.min(Math.max(h.voltage / range, 0), 1);
                            const rowIsDanger = rowPercent > 0.8;
                            const rowIsWarning = rowPercent > 0.6;
                            
                            if (rowIsDanger) {
                              return (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-bold tracking-wide">
                                  <AlertTriangle size={14} /> {t.critical.toUpperCase()}
                                </div>
                              );
                            }
                            if (rowIsWarning) {
                              return (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-50 text-yellow-600 border border-yellow-200 rounded-full text-xs font-bold tracking-wide">
                                  <AlertTriangle size={14} /> {t.warning.toUpperCase()}
                                </div>
                              );
                            }
                            return (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 border border-green-200 rounded-full text-xs font-bold tracking-wide">
                                <CheckCircle2 size={14} /> {t.normal.toUpperCase()}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4">
                          {(() => {
                            if (h.posShort) {
                              return (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-bold tracking-wide">
                                  <AlertTriangle size={14} /> {t.posShortTitle.toUpperCase()}
                                </div>
                              );
                            }
                            if (h.negShort) {
                              return (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-bold tracking-wide">
                                  <AlertTriangle size={14} /> {t.negShortTitle.toUpperCase()}
                                </div>
                              );
                            }
                            return (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 border border-green-200 rounded-full text-xs font-bold tracking-wide">
                                <CheckCircle2 size={14} /> {t.normal.toUpperCase()}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800 text-right">{h.voltage.toFixed(2)}</td>
                      </tr>
                    ))}
                    {(history[activeDeviceId] || []).length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-400 text-sm font-medium">{t.noRecords}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
