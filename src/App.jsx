import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Plus, Trash2, ArrowRight, Zap, Download, Wifi, ArrowLeft, TriangleAlert, Cpu, Activity, Settings2, LogOut, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';

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
              
              // เราจะเช็คว่าถ้าข้อความซ้ำกัน 2 รอบ (ประมาณ 2 วินาที) ถือว่าออฟไลน์ทันที
              const currentString = data.last_updated || JSON.stringify(data);
              
              if (dev.lastSeenString === currentString) {
                const unchangedCount = (dev.unchangedCount || 0) + 1;
                
                if (unchangedCount > 1) { // ลดเหลือ > 1 คือซ้ำ 2 รอบปุ๊บถือว่าตายเลย
                  if (dev.isOnline) {
                    setDevicesList(prev => prev.map(d => d.id === dev.id ? { ...d, isOnline: false, unchangedCount } : d));
                  } else {
                    setDevicesList(prev => prev.map(d => d.id === dev.id ? { ...d, unchangedCount } : d));
                  }
                } else {
                  setDevicesList(prev => prev.map(d => d.id === dev.id ? { ...d, unchangedCount } : d));
                }
              } else {
                // ข้อมูลใหม่มา รีเซ็ตการนับและตั้งเป็น ONLINE
                setDevicesList(prev => prev.map(d => d.id === dev.id ? { ...d, isOnline: true, lastSeenString: currentString, unchangedCount: 0 } : d));
              }

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
    }, 1000); // ดึงข้อมูลทุกๆ 1 วินาที (เดิม 2000)

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
  useEffect(() => {
    if (!user && screen !== 'login') {
      setScreen('login');
    }
  }, [user, screen]);

  useEffect(() => {
    let interval;
    if (screen === 'dashboard') {
      interval = setInterval(async () => {
        try {
          if (devicesList.length === 0) return;
          // Use the active device, or fallback to the first device in list
          const activeDevice = devicesList.find(d => d.id === activeDeviceId) || devicesList.find(d => d.isOnline) || devicesList[0];
          const res = await fetch(`${API_ENDPOINT}?device_id=${activeDevice.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.voltage !== undefined) {
              setVoltage(data.voltage);
              setPosShort(data.posShort || false);
              setNegShort(data.negShort || false);
            }
          }
        } catch (err) {
          // No mock data - keep last known state if backend goes offline
          console.error("Backend fetch failed:", err);
        }
      }, 1000);
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
    const headers = "DateTime,Voltage(V),Status\n";
    const rows = currentHistory.map(h => {
      let status = "NORMAL";
      if (h.posShort) status = "(+) SHORT";
      if (h.negShort) status = "(-) SHORT";
      return `"${h.fullDate}",${h.voltage},"${status}"`;
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
          <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/80 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden shadow-inner">
              <img src={user?.picture || "https://api.dicebear.com/7.x/avataaars/svg?seed=Glass"} alt="avatar" />
            </div>
            <span className="text-sm font-semibold text-slate-700 truncate max-w-[120px]">{user?.name || t.guestUser}</span>
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
      statusCol: "สถานะ",
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
      statusCol: "Status",
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
      statusCol: "状态",
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
      statusCol: "状態",
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

  // Screens
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userInfo = await res.json();
        setUser(userInfo);
        localStorage.setItem('ev_user', JSON.stringify(userInfo));
        setScreen('devices');
      } catch (error) {
        console.error('Failed to fetch user info', error);
      }
    },
  });

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
          
          <button 
            onClick={() => login()}
            className="w-full primary-btn py-4 flex items-center justify-center gap-4 mb-2"
          >
            <div className="bg-white p-1 rounded-full flex items-center justify-center">
               <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
            </div>
            {t.loginBtn}
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'devices') {
    return (
      <div className="min-h-screen p-6 md:p-12 max-w-5xl mx-auto relative z-10 flex flex-col">
        <AmbientBackground />
        <TopBar />
        
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
                      <th className="py-3 px-4 font-semibold text-slate-500 text-sm">{t.statusCol}</th>
                      <th className="py-3 px-4 font-semibold text-slate-500 text-sm text-right">{t.voltCol}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(history[activeDeviceId] || [])].reverse().map((h, i) => (
                      <tr key={i} className="border-b border-slate-100/50 hover:bg-white/40 transition-colors">
                        <td className="py-3 px-4 text-slate-700 font-medium text-sm">{h.fullDate.split(' ')[0]}</td>
                        <td className="py-3 px-4 text-slate-700 font-medium text-sm">{h.time}</td>
                        <td className="py-3 px-4 text-sm font-semibold">
                          {h.posShort ? <span className="text-red-500">{t.posShortTitle}</span> : 
                           h.negShort ? <span className="text-red-500">{t.negShortTitle}</span> : 
                           <span className="text-green-500">{t.normal}</span>}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800 text-right">{h.voltage.toFixed(2)}</td>
                      </tr>
                    ))}
                    {(history[activeDeviceId] || []).length === 0 && (
                      <tr>
                        <td colSpan="4" className="py-8 text-center text-slate-400 text-sm font-medium">{t.noRecords}</td>
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
