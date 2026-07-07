import { useState, useEffect, useRef, useCallback } from "react";
import { buildAtcPrompt, buildMeetingPrompt, buildSummaryPrompt } from "./prompts.js";

// ══════════════════════════════════════════════════════════════
//  GEMINI CONFIG
// ══════════════════════════════════════════════════════════════
const GEMINI_MODELS = [
  { id:"gemini-2.0-flash",  label:"Gemini 2.0 Flash",  badge:"NHANH NHẤT",  color:"#34a853", note:"Tốc độ cao, chi phí thấp — khuyến nghị hàng ngày." },
  { id:"gemini-1.5-pro",    label:"Gemini 1.5 Pro",    badge:"CHÍNH XÁC",  color:"#4285f4", note:"Chính xác hơn cho audio phức tạp, nhiều người nói." },
  { id:"gemini-1.5-flash",  label:"Gemini 1.5 Flash",  badge:"FREE TIER",  color:"#ffb300", note:"Free quota 15 req/phút, phù hợp dùng thử." },
];

const ROOM_PRESETS = {
  small:  { label:"Phòng họp nhỏ",    sub:"< 20 người · ít vang",         icon:"▪",   hpFreq:100, compThreshold:-24, compRatio:4,  compAttack:0.005, compRelease:0.15, gain:1.3, tip:"Cài đặt nhẹ — normalize mức âm." },
  medium: { label:"Hội trường vừa",   sub:"20-60 người · vang trung bình", icon:"▪▪",  hpFreq:160, compThreshold:-38, compRatio:8,  compAttack:0.003, compRelease:0.10, gain:1.7, tip:"HP filter cắt vang tần thấp." },
  large:  { label:"Hội trường lớn",   sub:"> 60 người · vang nhiều",       icon:"▪▪▪", hpFreq:220, compThreshold:-50, compRatio:14, compAttack:0.002, compRelease:0.08, gain:2.2, tip:"Chế độ mạnh nhất — khuyến nghị mic conference." },
};

const ATC_UNITS    = ["ACC","APP","TWR","GND","AFIS"];
const ATC_AIRPORTS = ["Hà Nội (Nội Bài)","TP.HCM (Tân Sơn Nhất)","Đà Nẵng","Cam Ranh","Phú Quốc","Liên Khương","Cát Bi","Thọ Xuân","Điện Biên","Đồng Hới","Phú Bài","Pleiku","Buôn Ma Thuột"];

const CAT = {
  "THÔNG TIN":  { color:"#38bdf8", bg:"#38bdf811", icon:"ℹ" },
  "QUYẾT ĐỊNH": { color:"#a78bfa", bg:"#a78bfa11", icon:"✓" },
  "THẢO LUẬN":  { color:"#fbbf24", bg:"#fbbf2411", icon:"◎" },
  "HÀNH ĐỘNG":  { color:"#f87171", bg:"#f8717111", icon:"!" },
};

const SEV = {
  NORMAL:    { color:"#4a7080", icon:"" },
  WARNING:   { color:"#ffb300", icon:"⚠ " },
  EMERGENCY: { color:"#ff3d3d", icon:"🚨 " },
};

const DEFAULT_GLOSSARY = [
  { id:"g1",  abbr:"ACC",   vi:"Trung tâm Kiểm soát Đường dài",   en:"Area Control Center",              note:"Điều hành tàu bay trong vùng trời FIR." },
  { id:"g2",  abbr:"APP",   vi:"Kiểm soát Tiếp cận",              en:"Approach Control",                 note:"Kiểm soát TB giai đoạn đến/đi." },
  { id:"g3",  abbr:"TWR",   vi:"Đài Kiểm soát Sân bay",           en:"Aerodrome Control Tower",          note:"Điều hành lăn bánh, cất/hạ cánh." },
  { id:"g4",  abbr:"GND",   vi:"Kiểm soát Mặt đất",              en:"Ground Control",                   note:"Điều hành tàu bay trên sân đỗ." },
  { id:"g5",  abbr:"FIR",   vi:"Vùng Thông báo Bay",             en:"Flight Information Region",        note:"Vùng trời cung cấp dịch vụ thông báo bay." },
  { id:"g6",  abbr:"FL",    vi:"Mực Bay",                         en:"Flight Level",                     note:"Mặt đẳng áp tại khí áp chuẩn 1013.25 hPa." },
  { id:"g7",  abbr:"QNH",   vi:"Khí áp Mực Biển",                en:"Altimeter Setting",                note:"Dùng hiệu chỉnh cao độ kế về MSL." },
  { id:"g8",  abbr:"ILS",   vi:"Hệ thống Hạ cánh Thiết bị",      en:"Instrument Landing System",        note:"Tiếp cận chính xác CAT I/II/III." },
  { id:"g9",  abbr:"SID",   vi:"Phương thức Khởi hành Tiêu chuẩn",en:"Standard Instrument Departure",   note:"Hành trình khởi hành bằng thiết bị." },
  { id:"g10", abbr:"STAR",  vi:"Phương thức Đến Tiêu chuẩn",     en:"Standard Instrument Arrival",      note:"Hành trình đến bằng thiết bị." },
  { id:"g11", abbr:"RVR",   vi:"Tầm nhìn Đường băng",            en:"Runway Visual Range",              note:"Đo bằng transmissometer." },
  { id:"g12", abbr:"ATIS",  vi:"Dịch vụ Thông tin Tự động",      en:"Automatic Terminal Info Service",  note:"Phát thanh khí tượng + NOTAM sân bay." },
  { id:"g13", abbr:"METAR", vi:"Bản tin Khí tượng Định kỳ",      en:"Meteorological Aerodrome Report",  note:"Chu kỳ 30 phút hoặc 1 giờ." },
  { id:"g14", abbr:"KSVKL", vi:"Kiểm soát viên Không lưu",       en:"Air Traffic Controller",           note:"Nhân viên cung cấp dịch vụ ATC." },
  { id:"g15", abbr:"VATM",  vi:"Tổng công ty Quản lý bay VN",    en:"Vietnam Air Traffic Management",   note:"Đơn vị bảo đảm hoạt động bay VN." },
  { id:"g16", abbr:"NDB",   vi:"Đài dẫn đường Vô hướng",         en:"Non-Directional Beacon",           note:"Thiết bị dẫn đường sóng trung LF/MF." },
  { id:"g17", abbr:"VOR",   vi:"Đài Toàn hướng VHF",             en:"VHF Omnidirectional Range",        note:"Thiết bị dẫn đường VHF ±1°." },
  { id:"g18", abbr:"NOTAM", vi:"Thông báo gửi phi công",          en:"Notice to Airmen",                 note:"Thông tin quan trọng cho hoạt động bay." },
  { id:"g19", abbr:"AFIS",  vi:"Dịch vụ Thông báo Bay Sân bay",  en:"Aerodrome Flight Info Service",    note:"Sân bay không có đài kiểm soát." },
  { id:"g20", abbr:"DME",   vi:"Thiết bị Đo Cự ly",              en:"Distance Measuring Equipment",     note:"Đo khoảng cách tàu bay đến đài." },
];

const TABS = [
  { id:"dashboard", icon:"⬡", label:"Tổng quan"  },
  { id:"record",    icon:"◉", label:"Ghi âm R/T" },
  { id:"meeting",   icon:"⊕", label:"Cuộc họp"   },
  { id:"prompt",    icon:"◐", label:"Prompt Lab"  },
  { id:"history",   icon:"≡", label:"Lịch sử"    },
  { id:"glossary",  icon:"◈", label:"Thuật ngữ"  },
  { id:"settings",  icon:"◎", label:"Cài đặt"    },
];

const C = {
  bg:"#070d12", surface:"#0c1620", card:"#101d28", border:"#1a2e3f", borderHi:"#1e4060",
  cyan:"#00d4ff", cyanDim:"#007a99", green:"#00e87a",
  amber:"#ffb300", purple:"#a78bfa", red:"#ff3d3d",
  text:"#c8dde8", textDim:"#4a7080", textMid:"#7a9aaa",
  gemBlue:"#4285f4", gemGreen:"#34a853",
};
const MONO = "'JetBrains Mono','Fira Code','Courier New',monospace";
const SANS = "'IBM Plex Sans','Segoe UI',sans-serif";

const uid   = () => Math.random().toString(36).slice(2,10);
const pad2  = n  => String(n).padStart(2,"0");
const fmtD  = s  => `${pad2(Math.floor(s/60))}:${pad2(s%60)}`;
const tvi   = iso => new Date(iso).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
const dvi   = iso => new Date(iso).toLocaleString("vi-VN");
const load  = (k,d) => { try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch{ return d; } };
const save  = (k,v) => localStorage.setItem(k,JSON.stringify(v));
const b64   = (blob) => new Promise((res,rej) => {
  const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=()=>rej(new Error("read error")); r.readAsDataURL(blob);
});
const parseJSON = (text) => JSON.parse(text.replace(/```json|```/g,"").trim());

// ── UI Atoms ──
const Dot = ({color=C.cyan,pulse=false}) => (
  <span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",
    backgroundColor:color,boxShadow:`0 0 8px ${color}`,animation:pulse?"blink 1s infinite":"none"}}/>
);
const Badge = ({children,color=C.cyan}) => (
  <span style={{display:"inline-block",padding:"2px 10px",borderRadius:2,fontSize:11,
    fontFamily:MONO,letterSpacing:"0.08em",fontWeight:700,color,
    border:`1px solid ${color}33`,backgroundColor:`${color}11`}}>{children}</span>
);
const Card = ({children,style={},hi=false}) => (
  <div style={{backgroundColor:C.card,border:`1px solid ${hi?C.borderHi:C.border}`,borderRadius:4,padding:20,...style}}>{children}</div>
);
const Lbl = ({children,style={}}) => (
  <div style={{fontSize:10,fontFamily:MONO,letterSpacing:"0.15em",color:C.textDim,textTransform:"uppercase",marginBottom:8,...style}}>{children}</div>
);
const Btn = ({children,onClick,variant="primary",small=false,disabled=false,style={}}) => {
  const p=small?"6px 14px":"10px 22px", fs=small?12:13;
  const vs={
    primary:{backgroundColor:C.cyan,   color:C.bg,     boxShadow:`0 0 12px ${C.cyan}44`},
    ghost:  {backgroundColor:"transparent",color:C.textMid,border:`1px solid ${C.border}`},
    danger: {backgroundColor:"transparent",color:C.red, border:`1px solid ${C.red}44`},
    purple: {backgroundColor:C.purple, color:C.bg,     boxShadow:`0 0 12px ${C.purple}44`},
    green:  {backgroundColor:C.green,  color:C.bg,     boxShadow:`0 0 12px ${C.green}44`},
  };
  return <button onClick={disabled?undefined:onClick} style={{cursor:disabled?"not-allowed":"pointer",
    border:"none",borderRadius:3,fontFamily:MONO,fontWeight:700,letterSpacing:"0.05em",
    transition:"all 0.15s",opacity:disabled?0.5:1,padding:p,fontSize:fs,...vs[variant],...style}}>{children}</button>;
};
const Inp = ({value,onChange,placeholder,type="text",style={}}) => (
  <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{width:"100%",padding:"9px 14px",borderRadius:3,border:`1px solid ${C.border}`,
      backgroundColor:"#060e14",color:C.text,fontSize:13,fontFamily:MONO,outline:"none",boxSizing:"border-box",...style}}
    onFocus={e=>e.target.style.borderColor=C.cyanDim}
    onBlur={e=>e.target.style.borderColor=C.border}/>
);
const Sel = ({value,onChange,options,style={}}) => (
  <select value={value} onChange={e=>onChange(e.target.value)} style={{
    width:"100%",padding:"9px 14px",borderRadius:3,border:`1px solid ${C.border}`,
    backgroundColor:"#060e14",color:C.text,fontSize:13,fontFamily:MONO,outline:"none",...style}}>
    {options.map(o=><option key={o} value={o}>{o}</option>)}
  </select>
);

// ── ATC Card ──
const spColor = sp => sp==="KSVKL"?{c:C.cyan,bg:`${C.cyan}11`,b:`${C.cyan}44`}:sp==="PHI CÔNG"?{c:C.green,bg:`${C.green}11`,b:`${C.green}44`}:{c:C.amber,bg:`${C.amber}11`,b:`${C.amber}44`};
const AtcCard = ({t}) => {
  const sc=spColor(t.speaker);
  const sv=SEV[t.severity||"NORMAL"];
  const kv=t.key_values||{};
  const kvItems=Object.entries(kv).filter(([,v])=>v&&v!=="null"&&v!=="0");
  return (
    <div style={{backgroundColor:C.card,border:`1px solid ${t.severity==="EMERGENCY"?C.red:C.border}`,
      borderLeft:`3px solid ${t.severity==="EMERGENCY"?C.red:sc.c}`,borderRadius:4,
      padding:"12px 16px",marginBottom:8,animation:"slideIn 0.3s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:6}}>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:11,fontFamily:MONO,fontWeight:700,letterSpacing:"0.1em",
            color:sc.c,backgroundColor:sc.bg,border:`1px solid ${sc.b}`,padding:"2px 10px",borderRadius:2}}>{t.speaker}</span>
          {t.unit&&<Badge color={C.cyanDim}>{t.unit}</Badge>}
          {t.callsign&&<Badge color={C.green}>{t.callsign}</Badge>}
          {t.severity&&t.severity!=="NORMAL"&&<Badge color={sv.color}>{sv.icon}{t.severity}</Badge>}
        </div>
        <span style={{fontSize:11,fontFamily:MONO,color:C.textDim}}>{tvi(t.timestamp)}</span>
      </div>
      {t.original!==t.corrected&&(
        <p style={{margin:"0 0 6px",fontSize:12,color:C.textDim,fontStyle:"italic",fontFamily:SANS}}>▸ Raw: {t.original}</p>
      )}
      <p style={{margin:0,fontSize:14,color:C.text,lineHeight:1.6,fontFamily:SANS}}>{t.corrected}</p>
      {kvItems.length>0&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
          {kvItems.map(([k,v])=>(
            <span key={k} style={{fontSize:11,fontFamily:MONO,padding:"2px 8px",borderRadius:2,
              color:C.cyan,backgroundColor:`${C.cyan}0d`,border:`1px solid ${C.cyan}22`}}>
              {k.toUpperCase()}: {v}
            </span>
          ))}
        </div>
      )}
      {t.notes&&<p style={{margin:"8px 0 0",fontSize:12,color:t.severity==="EMERGENCY"?C.red:C.amber,fontFamily:MONO}}>{t.notes}</p>}
    </div>
  );
};

// ── Meeting Card ──
const MeetCard = ({t}) => {
  const cat=CAT[t.category]||CAT["THẢO LUẬN"];
  return (
    <div style={{backgroundColor:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${cat.color}`,
      borderRadius:4,padding:"12px 16px",marginBottom:8,animation:"slideIn 0.3s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,gap:8,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:11,fontFamily:MONO,fontWeight:700,color:t.speaker==="CHỦ TỌA"?C.purple:C.textMid}}>{t.speaker}</span>
          <span style={{fontSize:11,fontFamily:MONO,padding:"2px 8px",borderRadius:2,
            color:cat.color,backgroundColor:cat.bg,border:`1px solid ${cat.color}44`}}>{cat.icon} {t.category}</span>
        </div>
        <span style={{fontSize:11,fontFamily:MONO,color:C.textDim,whiteSpace:"nowrap"}}>{tvi(t.timestamp)}</span>
      </div>
      {t.original!==t.cleaned&&<p style={{margin:"0 0 6px",fontSize:12,color:C.textDim,fontStyle:"italic",fontFamily:SANS}}>▸ Raw: {t.original}</p>}
      <p style={{margin:0,fontSize:14,color:C.text,lineHeight:1.7,fontFamily:SANS}}>{t.cleaned}</p>
      {t.action_item&&(
        <div style={{margin:"10px 0 0",padding:"8px 12px",borderRadius:3,
          backgroundColor:`${C.red}0d`,border:`1px solid ${C.red}33`,fontSize:12,color:"#fca5a5",fontFamily:SANS}}>
          <span style={{fontFamily:MONO,fontWeight:700,color:C.red,marginRight:8}}>ACTION</span>{t.action_item}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [apiKey,     setApiKey]     = useState(()=>localStorage.getItem("as_gemini_key")||"");
  const [gemModel,   setGemModel]   = useState(()=>localStorage.getItem("as_gem_model")||"gemini-2.0-flash");
  const [glossary,   setGlossary]   = useState(()=>load("as_glossary",DEFAULT_GLOSSARY));
  const [atcRecs,    setAtcRecs]    = useState(()=>load("as_atc",[]));
  const [meetRecs,   setMeetRecs]   = useState(()=>load("as_meet",[]));

  const [tab,        setTab]        = useState("dashboard");
  const [isRec,      setIsRec]      = useState(false);
  const [isProc,     setIsProc]     = useState(false);
  const [audioLvl,   setAudioLvl]   = useState(0);
  const [recTime,    setRecTime]    = useState(0);
  const [speakerMode,setSpeakerMode]= useState("KSVKL");
  const [atcUnit,    setAtcUnit]    = useState("APP");
  const [atcAirport, setAtcAirport] = useState("Đà Nẵng");
  const [roomPreset, setRoomPreset] = useState("medium");
  const [sessionId,  setSessionId]  = useState(null);
  const [meetMode,   setMeetMode]   = useState(false);
  const [alert,      setAlert]      = useState(null);
  const [devices,    setDevices]    = useState([]);
  const [selDev,     setSelDev]     = useState("");
  const [gSearch,    setGSearch]    = useState("");
  const [showAddG,   setShowAddG]   = useState(false);
  const [newTerm,    setNewTerm]    = useState({abbr:"",vi:"",en:"",note:""});
  const [showSumm,   setShowSumm]   = useState(false);
  const [summary,    setSummary]    = useState("");
  const [isSumm,     setIsSumm]     = useState(false);
  const [histFilter, setHistFilter] = useState("all");
  // Prompt Lab
  const [labText,    setLabText]    = useState("");
  const [labResult,  setLabResult]  = useState(null);
  const [labLoading, setLabLoading] = useState(false);

  const mediaRecRef = useRef(null);
  const chunksRef   = useRef([]);
  const audioCtxRef = useRef(null);
  const canvasRef   = useRef(null);
  const animRef     = useRef(null);
  const timerRef    = useRef(null);

  useEffect(()=>{ localStorage.setItem("as_gemini_key",apiKey); },[apiKey]);
  useEffect(()=>{ localStorage.setItem("as_gem_model",gemModel); },[gemModel]);
  useEffect(()=>{ save("as_glossary",glossary); },[glossary]);
  useEffect(()=>{ save("as_atc",atcRecs); },[atcRecs]);
  useEffect(()=>{ save("as_meet",meetRecs); },[meetRecs]);

  useEffect(()=>{
    navigator.mediaDevices.getUserMedia({audio:true})
      .then(()=>navigator.mediaDevices.enumerateDevices())
      .then(list=>{ const m=list.filter(d=>d.kind==="audioinput"); setDevices(m); if(m.length) setSelDev(m[0].deviceId); })
      .catch(()=>{});
  },[]);

  const flash=(msg,type="error")=>{ setAlert({msg,type}); setTimeout(()=>setAlert(null),4500); };
  const gc = ()=>glossary.map(g=>`${g.abbr}:${g.vi}`).join(" | ");
  const gemEndpoint = ()=>`https://generativelanguage.googleapis.com/v1beta/models/${gemModel}:generateContent?key=${apiKey}`;

  // DSP
  const buildDSP = useCallback((stream,preset)=>{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const src=ctx.createMediaStreamSource(stream);
    const hp=ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=preset.hpFreq; hp.Q.value=0.7;
    const comp=ctx.createDynamicsCompressor();
    comp.threshold.value=preset.compThreshold; comp.ratio.value=preset.compRatio;
    comp.attack.value=preset.compAttack; comp.release.value=preset.compRelease; comp.knee.value=16;
    const gain=ctx.createGain(); gain.gain.value=preset.gain;
    const analyser=ctx.createAnalyser(); analyser.fftSize=512;
    const dest=ctx.createMediaStreamDestination();
    src.connect(hp); hp.connect(comp); comp.connect(gain); gain.connect(analyser); gain.connect(dest);
    return {ctx,analyser,dest};
  },[]);

  const buildSimple=useCallback((stream)=>{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const src=ctx.createMediaStreamSource(stream);
    const analyser=ctx.createAnalyser(); analyser.fftSize=512;
    src.connect(analyser);
    return {ctx,analyser,dest:null};
  },[]);

  const startViz=useCallback((analyser)=>{
    const buf=new Uint8Array(analyser.frequencyBinCount);
    const draw=()=>{
      if(!canvasRef.current) return;
      const cv=canvasRef.current,cx=cv.getContext("2d");
      analyser.getByteFrequencyData(buf);
      cx.clearRect(0,0,cv.width,cv.height);
      setAudioLvl(Math.round(buf.reduce((a,b)=>a+b,0)/buf.length));
      const W=cv.width,H=cv.height,bw=W/buf.length*2.2;
      buf.forEach((v,i)=>{ cx.fillStyle=`hsla(${180+(i/buf.length)*60},90%,55%,${0.5+(v/255)*0.5})`; cx.fillRect(i*(bw+1),H-(v/255)*H,bw,(v/255)*H); });
      animRef.current=requestAnimationFrame(draw);
    };
    draw();
  },[]);

  const stopViz=useCallback(()=>{
    if(animRef.current) cancelAnimationFrame(animRef.current);
    if(audioCtxRef.current) audioCtxRef.current.close().catch(()=>{});
    setAudioLvl(0);
    if(canvasRef.current) canvasRef.current.getContext("2d").clearRect(0,0,canvasRef.current.width,canvasRef.current.height);
  },[]);

  // Recording
  const startRec=async(isMeeting=false)=>{
    if(!apiKey){ flash("Vui lòng nhập Gemini API Key trong Cài đặt ◎"); return; }
    try {
      const stream=await navigator.mediaDevices.getUserMedia({
        audio:{...(selDev?{deviceId:{exact:selDev}}:{}),echoCancellation:true,noiseSuppression:true,autoGainControl:!isMeeting,channelCount:1}
      });
      let recStream=stream;
      if(isMeeting){
        const {ctx,analyser,dest}=buildDSP(stream,ROOM_PRESETS[roomPreset]);
        audioCtxRef.current=ctx; startViz(analyser); recStream=dest.stream;
      } else {
        const {ctx,analyser}=buildSimple(stream);
        audioCtxRef.current=ctx; startViz(analyser);
      }
      setMeetMode(isMeeting); chunksRef.current=[];
      const mr=new MediaRecorder(recStream,{mimeType:"audio/webm;codecs=opus"});
      mediaRecRef.current=mr;
      mr.ondataavailable=e=>{ if(e.data.size>0) chunksRef.current.push(e.data); };
      mr.onstop=async()=>{
        const blob=new Blob(chunksRef.current,{type:"audio/webm"});
        stream.getTracks().forEach(t=>t.stop()); stopViz();
        await gemProcess(blob,isMeeting);
      };
      mr.start(200); setIsRec(true); setRecTime(0);
      const sid=sessionId||uid(); setSessionId(sid);
      timerRef.current=setInterval(()=>setRecTime(t=>t+1),1000);
    } catch(e){ flash("Không thể truy cập microphone: "+e.message); }
  };

  const stopRec=()=>{
    if(mediaRecRef.current&&isRec){ mediaRecRef.current.stop(); setIsRec(false); clearInterval(timerRef.current); }
  };

  // Gemini call
  const gemProcess=async(blob,isMeeting)=>{
    setIsProc(true);
    try {
      const audio64=await b64(blob);
      const sessAtcForContext=atcRecs.filter(r=>r.sessionId===sessionId).slice(0,3);
      const prompt=isMeeting
        ? buildMeetingPrompt({roomLabel:ROOM_PRESETS[roomPreset].label, glossaryCtx:gc()})
        : buildAtcPrompt({speakerHint:speakerMode, unit:atcUnit, airport:atcAirport, glossaryCtx:gc(), prevLines:sessAtcForContext});

      const res=await fetch(gemEndpoint(),{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          contents:[{ parts:[{inline_data:{mime_type:"audio/webm",data:audio64}},{text:prompt}] }],
          generationConfig:{temperature:0.05, maxOutputTokens:700, responseMimeType:"application/json"},
        }),
      });
      if(!res.ok){ const e=await res.json(); throw new Error(e.error?.message||`HTTP ${res.status}`); }
      const data=await res.json();
      const raw=data.candidates?.[0]?.content?.parts?.[0]?.text||"";
      if(!raw.trim()) throw new Error("Gemini trả về rỗng");
      let parsed;
      try { parsed=parseJSON(raw); } catch { throw new Error("JSON parse error: "+raw.slice(0,100)); }

      const ts=new Date().toISOString();
      if(isMeeting){
        setMeetRecs(prev=>[{id:uid(),timestamp:ts,sessionId,
          speaker:parsed.speaker||"THAM DỰ", original:parsed.original||raw,
          cleaned:parsed.cleaned||raw, category:parsed.category||"THẢO LUẬN",
          action_item:parsed.action_item||null, confidence:parsed.confidence??0.7},...prev]);
        flash("Ghi nhận cuộc họp ✓","success");
      } else {
        const entry={id:uid(),timestamp:ts,sessionId,
          speaker:parsed.speaker||speakerMode, unit:parsed.unit||atcUnit,
          callsign:parsed.callsign||null, original:parsed.original||raw,
          corrected:parsed.corrected||raw, key_values:parsed.key_values||{},
          notes:parsed.notes||"", severity:parsed.severity||"NORMAL"};
        setAtcRecs(prev=>[entry,...prev]);
        if(entry.severity==="EMERGENCY") flash("🚨 EMERGENCY DETECTED — "+entry.corrected,"error");
        else if(entry.severity==="WARNING") flash("⚠ Cảnh báo: "+entry.notes,"warn");
        else flash("Phiên dịch R/T hoàn tất ✓","success");
      }
    } catch(e){ flash("Lỗi Gemini: "+e.message); }
    finally { setIsProc(false); }
  };

  // Prompt Lab — test with text
  const labTest=async()=>{
    if(!apiKey||!labText.trim()) return;
    setLabLoading(true); setLabResult(null);
    try {
      const prompt=buildAtcPrompt({speakerHint:speakerMode,unit:atcUnit,airport:atcAirport,glossaryCtx:gc(),prevLines:[]});
      const res=await fetch(gemEndpoint(),{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          contents:[{parts:[{text:prompt+`\n\n[AUDIO TRANSCRIPT TO PROCESS]\n"${labText}"`}]}],
          generationConfig:{temperature:0.05,maxOutputTokens:600,responseMimeType:"application/json"},
        }),
      });
      const data=await res.json();
      const raw=data.candidates?.[0]?.content?.parts?.[0]?.text||"";
      setLabResult(parseJSON(raw));
    } catch(e){ setLabResult({error:e.message}); }
    finally { setLabLoading(false); }
  };

  // Summary
  const genSummary=async()=>{
    const sess=meetRecs.filter(r=>r.sessionId===sessionId);
    if(!sess.length){ flash("Chưa có nội dung cuộc họp"); return; }
    setIsSumm(true); setShowSumm(true); setSummary("");
    try {
      const content=sess.slice().reverse().map(r=>`[${tvi(r.timestamp)}] ${r.speaker} (${r.category}): ${r.cleaned}`).join("\n");
      const actions=sess.filter(r=>r.action_item).map(r=>`- ${r.speaker}: ${r.action_item}`).join("\n");
      const res=await fetch(gemEndpoint(),{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          contents:[{parts:[{text:buildSummaryPrompt(content,actions)}]}],
          generationConfig:{temperature:0.2,maxOutputTokens:1200},
        }),
      });
      const data=await res.json();
      setSummary(data.candidates?.[0]?.content?.parts?.[0]?.text||"Không tạo được biên bản.");
    } catch(e){ setSummary("Lỗi: "+e.message); }
    finally { setIsSumm(false); }
  };

  const exportAtc=()=>{
    const txt=atcRecs.map(t=>`[${dvi(t.timestamp)}] ${t.speaker}${t.callsign?" | "+t.callsign:""}\n${t.original!==t.corrected?"  RAW : "+t.original+"\n":""}  ICAO: ${t.corrected}\n${t.notes?"  NOTE: "+t.notes+"\n":""}`).join("─".repeat(50)+"\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([txt],{type:"text/plain;charset=utf-8"})); a.download=`aeroscribe_atc_${new Date().toISOString().slice(0,10)}.txt`; a.click();
  };

  const sessAtc=atcRecs.filter(r=>r.sessionId===sessionId);
  const sessMeet=meetRecs.filter(r=>r.sessionId===sessionId);
  const allActions=meetRecs.filter(r=>r.action_item);
  const filtG=glossary.filter(g=>g.abbr.toLowerCase().includes(gSearch.toLowerCase())||g.vi.toLowerCase().includes(gSearch.toLowerCase()));
  const preset=ROOM_PRESETS[roomPreset];

  return (
    <div style={{minHeight:"100vh",backgroundColor:C.bg,color:C.text,fontFamily:SANS}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::selection{background:${C.cyan}33;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:${C.bg};}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px;}
        input::placeholder,textarea::placeholder{color:${C.textDim};}
        select option{background:${C.surface};}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.15}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes slideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glowRed{0%,100%{box-shadow:0 0 16px ${C.red}55}50%{box-shadow:0 0 32px ${C.red}99}}
        @keyframes glowPurple{0%,100%{box-shadow:0 0 16px ${C.purple}55}50%{box-shadow:0 0 32px ${C.purple}99}}
        button:hover:not(:disabled){filter:brightness(1.12);}
        input:focus,select:focus,textarea:focus{outline:none;}
        textarea{resize:vertical;font-family:${MONO};font-size:12px;line-height:1.6;}
      `}</style>

      {alert&&(
        <div style={{position:"fixed",top:16,right:16,zIndex:9999,padding:"10px 18px",borderRadius:3,fontFamily:MONO,fontSize:13,
          boxShadow:"0 8px 32px rgba(0,0,0,0.6)",animation:"slideIn 0.2s ease",
          border:`1px solid ${alert.type==="success"?C.green:alert.type==="warn"?C.amber:C.red}`,
          backgroundColor:alert.type==="success"?`${C.green}11`:alert.type==="warn"?`${C.amber}11`:`${C.red}11`,
          color:alert.type==="success"?C.green:alert.type==="warn"?C.amber:C.red}}>{alert.msg}</div>
      )}

      {/* HEADER */}
      <div style={{backgroundColor:C.surface,borderBottom:`1px solid ${C.border}`,padding:"14px 28px",
        display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,
        backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,212,255,0.015) 2px,rgba(0,212,255,0.015) 4px)"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {[1,0.6,0.3].map((o,i)=><div key={i} style={{width:20-i*4,height:2,backgroundColor:C.cyan,opacity:o,borderRadius:1}}/>)}
          </div>
          <div>
            <div style={{fontFamily:MONO,fontWeight:700,fontSize:17,color:C.cyan,letterSpacing:"0.12em"}}>AEROSCRIBE VIET</div>
            <div style={{fontSize:10,fontFamily:MONO,color:C.textDim,letterSpacing:"0.2em"}}>R/T · CUỘC HỌP · GEMINI OPTIMIZED PROMPTS · DSP</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {isRec&&(
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 14px",borderRadius:3,
              border:`1px solid ${meetMode?C.purple:C.red}`,backgroundColor:meetMode?`${C.purple}11`:`${C.red}11`,
              animation:meetMode?"glowPurple 1.5s infinite":"glowRed 1.5s infinite"}}>
              <Dot color={meetMode?C.purple:C.red} pulse/>
              <span style={{fontFamily:MONO,fontSize:13,fontWeight:700,color:meetMode?C.purple:C.red}}>{meetMode?"MTG":"REC"} {fmtD(recTime)}</span>
            </div>
          )}
          {isProc&&(
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 14px",borderRadius:3,border:`1px solid ${C.gemBlue}55`,backgroundColor:`${C.gemBlue}0d`}}>
              <span style={{display:"inline-block",animation:"spin 1s linear infinite",fontSize:12}}>◌</span>
              <span style={{fontFamily:MONO,fontSize:12,color:C.gemBlue}}>GEMINI</span>
            </div>
          )}
          {apiKey&&<Dot color={C.gemGreen}/>}
        </div>
      </div>

      {/* TABS */}
      <div style={{backgroundColor:C.surface,borderBottom:`1px solid ${C.border}`,display:"flex",padding:"0 20px",gap:2,overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"11px 16px",border:"none",cursor:"pointer",fontSize:12,fontFamily:MONO,letterSpacing:"0.06em",fontWeight:600,
            backgroundColor:"transparent",whiteSpace:"nowrap",
            color:tab===t.id?(t.id==="meeting"?C.purple:t.id==="prompt"?C.amber:C.cyan):C.textDim,
            borderBottom:tab===t.id?`2px solid ${t.id==="meeting"?C.purple:t.id==="prompt"?C.amber:C.cyan}`:"2px solid transparent",
            transition:"all 0.15s"}}>
            <span style={{marginRight:6}}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div style={{maxWidth:920,margin:"0 auto",padding:"28px 24px"}}>

        {/* ════ DASHBOARD ════ */}
        {tab==="dashboard"&&(
          <div style={{animation:"slideIn 0.3s ease"}}>
            <Lbl>TỔNG QUAN HỆ THỐNG</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
              {[
                {label:"LIÊN LẠC R/T", value:atcRecs.length,  color:C.cyan,  icon:"◉"},
                {label:"KSVKL",        value:atcRecs.filter(r=>r.speaker==="KSVKL").length,    color:C.cyan,  icon:"⬡"},
                {label:"PHI CÔNG",     value:atcRecs.filter(r=>r.speaker==="PHI CÔNG").length, color:C.green, icon:"✈"},
                {label:"CUỘC HỌP",     value:meetRecs.length, color:C.purple,icon:"⊕"},
              ].map((s,i)=>(
                <Card key={i}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                    <span style={{fontSize:14,color:s.color,opacity:0.6}}>{s.icon}</span><Dot color={s.color}/>
                  </div>
                  <div style={{fontSize:32,fontFamily:MONO,fontWeight:700,color:s.color,lineHeight:1}}>{s.value}</div>
                  <div style={{fontSize:10,fontFamily:MONO,letterSpacing:"0.1em",color:C.textDim,marginTop:6}}>{s.label}</div>
                </Card>
              ))}
            </div>
            {allActions.length>0&&(
              <Card style={{marginBottom:16,borderColor:`${C.red}44`}}>
                <Lbl>ACTION ITEMS ({allActions.length})</Lbl>
                {allActions.slice(0,3).map((r,i)=>(
                  <div key={r.id} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
                    <span style={{fontFamily:MONO,fontSize:12,color:C.red,minWidth:20}}>{i+1}.</span>
                    <div><span style={{fontSize:11,color:C.textDim,fontFamily:MONO}}>{r.speaker}</span>
                    <p style={{margin:"2px 0 0",fontSize:13,color:C.text,fontFamily:SANS}}>{r.action_item}</p></div>
                  </div>
                ))}
              </Card>
            )}
            <Card style={{marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <Dot color={apiKey?C.gemGreen:C.red}/>
                <span style={{fontFamily:MONO,fontSize:13}}>{apiKey?"GEMINI API CONNECTED":"CHƯA CÓ API KEY"}</span>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <Badge color={C.gemBlue}>{gemModel}</Badge>
                <Badge color={C.purple}>DSP ENGINE</Badge>
                <Badge color={C.amber}>OPTIMIZED PROMPTS</Badge>
              </div>
            </Card>
            <Lbl>LIÊN LẠC GẦN NHẤT</Lbl>
            {atcRecs.slice(0,4).map(t=><AtcCard key={t.id} t={t}/>)}
            {!atcRecs.length&&(
              <Card style={{textAlign:"center",padding:"40px 24px"}}>
                <div style={{fontSize:32,marginBottom:12,opacity:0.3}}>◉</div>
                <p style={{color:C.textDim,fontFamily:MONO,fontSize:12}}>CHƯA CÓ LIÊN LẠC NÀO</p>
                <Btn onClick={()=>setTab("record")} style={{marginTop:16}}>BẮT ĐẦU GHI ÂM R/T</Btn>
              </Card>
            )}
          </div>
        )}

        {/* ════ ATC RECORD ════ */}
        {tab==="record"&&(
          <div style={{animation:"slideIn 0.3s ease"}}>
            <Lbl>GHI ÂM LIÊN LẠC R/T · OPTIMIZED PROMPT</Lbl>
            <Card style={{marginBottom:16}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
                <div><Lbl>VAI TRÒ</Lbl>
                  <div style={{display:"flex",gap:6}}>
                    {["KSVKL","PHI CÔNG","TỰ ĐỘNG"].map(m=>(
                      <button key={m} onClick={()=>setSpeakerMode(m)} style={{
                        flex:1,padding:"7px 6px",borderRadius:3,border:"none",cursor:"pointer",
                        fontFamily:MONO,fontSize:11,fontWeight:700,transition:"all 0.15s",
                        backgroundColor:speakerMode===m?(m==="KSVKL"?C.cyan:m==="PHI CÔNG"?C.green:C.amber):C.border,
                        color:speakerMode===m?C.bg:C.textMid}}>{m}</button>
                    ))}
                  </div>
                </div>
                <div><Lbl>ĐƠN VỊ</Lbl><Sel value={atcUnit} onChange={setAtcUnit} options={ATC_UNITS}/></div>
                <div><Lbl>SÂN BAY</Lbl><Sel value={atcAirport} onChange={setAtcAirport} options={ATC_AIRPORTS}/></div>
              </div>
              <div style={{backgroundColor:C.bg,borderRadius:3,padding:"8px 12px",border:`1px solid ${C.border}`,fontSize:12,color:C.textDim,fontFamily:MONO}}>
                Prompt context: <span style={{color:C.cyan}}>{speakerMode}</span> · <span style={{color:C.amber}}>{atcUnit} {atcAirport}</span> · <span style={{color:C.green}}>{sessAtc.length} liên lạc trong phiên (context readback)</span>
              </div>
            </Card>

            <Card style={{marginBottom:16,position:"relative"}}>
              <canvas ref={canvasRef} width={820} height={90} style={{width:"100%",height:90,display:"block",borderRadius:2,backgroundColor:"#060e14"}}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:6,height:6,borderRadius:"50%",transition:"all 0.1s",backgroundColor:audioLvl>15?C.green:C.border,boxShadow:audioLvl>15?`0 0 8px ${C.green}`:undefined}}/>
                  <span style={{fontSize:11,fontFamily:MONO,color:C.textDim}}>LEVEL: {audioLvl}</span>
                </div>
                <span style={{fontSize:11,fontFamily:MONO,color:C.textDim}}>{isRec&&!meetMode?`REC ${fmtD(recTime)}`:isProc?"GEMINI...":"STANDBY"}</span>
              </div>
            </Card>

            <div style={{display:"flex",justifyContent:"center",margin:"20px 0"}}>
              {!isRec
                ? <button onClick={()=>startRec(false)} disabled={isProc} style={{width:88,height:88,borderRadius:"50%",border:`3px solid ${C.red}`,backgroundColor:`${C.red}11`,cursor:isProc?"not-allowed":"pointer",fontSize:28,display:"flex",alignItems:"center",justifyContent:"center",opacity:isProc?0.4:1,boxShadow:isProc?"none":`0 0 24px ${C.red}66`}}>🎙️</button>
                : !meetMode&&<button onClick={stopRec} style={{width:88,height:88,borderRadius:"50%",border:`3px solid ${C.cyan}`,backgroundColor:`${C.cyan}11`,cursor:"pointer",fontSize:28,display:"flex",alignItems:"center",justifyContent:"center",animation:"glowRed 1.5s infinite"}}>⏹</button>
              }
            </div>
            <p style={{textAlign:"center",fontFamily:MONO,fontSize:12,color:C.textDim,letterSpacing:"0.08em",marginBottom:20}}>
              {isProc?"◌ GEMINI XỬ LÝ — PHONETIC MAP + ICAO NORMALIZE + READBACK CHECK...":isRec&&!meetMode?"ĐANG GHI — NHẤN ⏹ ĐỂ PHIÊN DỊCH":"NHẤN 🎙️ — PROMPT TỰ ĐỘNG INJECT PHONETIC + CALLSIGN + CONTEXT"}
            </p>

            {sessAtc.length>0&&(
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <Lbl>PHIÊN HIỆN TẠI ({sessAtc.length})</Lbl>
                  <div style={{display:"flex",gap:8}}><Btn variant="ghost" small onClick={exportAtc}>↓ Xuất</Btn><Btn variant="ghost" small onClick={()=>setSessionId(uid())}>Phiên mới</Btn></div>
                </div>
                {sessAtc.map(t=><AtcCard key={t.id} t={t}/>)}
              </>
            )}
          </div>
        )}

        {/* ════ MEETING ════ */}
        {tab==="meeting"&&(
          <div style={{animation:"slideIn 0.3s ease"}}>
            <Lbl>CHẾ ĐỘ CUỘC HỌP · DSP ENGINE</Lbl>
            <Card style={{marginBottom:16}} hi>
              <Lbl>KÍCH THƯỚC PHÒNG</Lbl>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
                {Object.entries(ROOM_PRESETS).map(([key,p])=>(
                  <button key={key} onClick={()=>setRoomPreset(key)} style={{
                    padding:"12px 10px",borderRadius:4,cursor:"pointer",textAlign:"left",border:"none",
                    backgroundColor:roomPreset===key?`${C.purple}22`:C.surface,
                    border:`1px solid ${roomPreset===key?C.purple:C.border}`,
                    boxShadow:roomPreset===key?`0 0 12px ${C.purple}44`:"none",transition:"all 0.2s"}}>
                    <div style={{fontSize:13,fontFamily:MONO,color:roomPreset===key?C.purple:C.textMid,marginBottom:4}}>{p.icon} {p.label}</div>
                    <div style={{fontSize:11,color:C.textDim,fontFamily:SANS}}>{p.sub}</div>
                  </button>
                ))}
              </div>
              <div style={{backgroundColor:C.bg,borderRadius:3,padding:"10px 14px",border:`1px solid ${C.border}`}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:8}}>
                  {[{l:"HP FILTER",v:`${preset.hpFreq}Hz`,c:C.cyan},{l:"THRESHOLD",v:`${preset.compThreshold}dB`,c:C.amber},{l:"RATIO",v:`${preset.compRatio}:1`,c:C.green},{l:"GAIN",v:`×${preset.gain}`,c:C.purple}].map((d,i)=>(
                    <div key={i} style={{textAlign:"center"}}>
                      <div style={{fontSize:16,fontFamily:MONO,fontWeight:700,color:d.c}}>{d.v}</div>
                      <div style={{fontSize:9,fontFamily:MONO,letterSpacing:"0.12em",color:C.textDim,marginTop:2}}>{d.l}</div>
                    </div>
                  ))}
                </div>
                <p style={{fontSize:12,color:C.textMid,fontFamily:SANS,borderTop:`1px solid ${C.border}`,paddingTop:8,margin:0}}>💡 {preset.tip}</p>
              </div>
            </Card>

            <Card style={{marginBottom:16}}>
              <canvas ref={meetMode&&isRec?canvasRef:null} width={820} height={90} style={{width:"100%",height:90,display:"block",borderRadius:2,backgroundColor:"#060e14"}}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:6,height:6,borderRadius:"50%",transition:"all 0.1s",backgroundColor:audioLvl>15?C.purple:C.border}}/>
                  <span style={{fontSize:11,fontFamily:MONO,color:C.textDim}}>DSP LEVEL: {audioLvl}</span>
                </div>
                <span style={{fontSize:11,fontFamily:MONO,color:C.textDim}}>{isRec&&meetMode?`MTG ${fmtD(recTime)}`:isProc?"GEMINI...":"STANDBY"}</span>
              </div>
            </Card>

            <div style={{display:"flex",justifyContent:"center",margin:"20px 0"}}>
              {!isRec
                ? <button onClick={()=>startRec(true)} disabled={isProc} style={{width:88,height:88,borderRadius:"50%",border:`3px solid ${C.purple}`,backgroundColor:`${C.purple}11`,cursor:isProc?"not-allowed":"pointer",fontSize:28,display:"flex",alignItems:"center",justifyContent:"center",opacity:isProc?0.4:1,boxShadow:isProc?"none":`0 0 24px ${C.purple}66`}}>📋</button>
                : meetMode&&<button onClick={stopRec} style={{width:88,height:88,borderRadius:"50%",border:`3px solid ${C.purple}`,backgroundColor:`${C.purple}11`,cursor:"pointer",fontSize:28,display:"flex",alignItems:"center",justifyContent:"center",animation:"glowPurple 1.5s infinite"}}>⏹</button>
              }
            </div>

            {sessMeet.length>0&&(
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
                  <Lbl>PHIÊN HỌP ({sessMeet.length} đoạn)</Lbl>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <Btn variant="purple" small onClick={genSummary} disabled={isSumm}>{isSumm?"◌ Đang tóm tắt...":"⊕ Biên bản AI"}</Btn>
                    <Btn variant="ghost" small onClick={()=>setSessionId(uid())}>Phiên mới</Btn>
                  </div>
                </div>
                {sessMeet.filter(r=>r.action_item).length>0&&(
                  <Card style={{marginBottom:12,borderColor:`${C.red}44`}}>
                    <Lbl>ACTION ITEMS</Lbl>
                    {sessMeet.filter(r=>r.action_item).map((r,i)=>(
                      <div key={r.id} style={{display:"flex",gap:10,padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                        <span style={{fontFamily:MONO,fontSize:12,color:C.red,minWidth:20}}>{i+1}.</span>
                        <div><span style={{fontSize:11,color:C.textDim,fontFamily:MONO}}>{r.speaker}</span><p style={{margin:"2px 0 0",fontSize:13,color:C.text,fontFamily:SANS}}>{r.action_item}</p></div>
                      </div>
                    ))}
                  </Card>
                )}
                {sessMeet.map(t=><MeetCard key={t.id} t={t}/>)}
              </>
            )}

            {showSumm&&(
              <div style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
                <div style={{backgroundColor:C.card,border:`1px solid ${C.purple}`,borderRadius:6,width:"100%",maxWidth:660,maxHeight:"80vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
                  <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontFamily:MONO,fontWeight:700,color:C.purple,fontSize:14}}>⊕ BIÊN BẢN CUỘC HỌP</span>
                    <button onClick={()=>setShowSumm(false)} style={{background:"none",border:"none",cursor:"pointer",color:C.textDim,fontSize:20}}>✕</button>
                  </div>
                  <div style={{padding:20,overflowY:"auto",flex:1}}>
                    {isSumm?<div style={{textAlign:"center",padding:40}}><span style={{display:"inline-block",animation:"spin 1.2s linear infinite",fontSize:24,color:C.purple}}>◌</span></div>
                    :<div style={{fontFamily:SANS,fontSize:14,lineHeight:1.8,color:C.text,whiteSpace:"pre-wrap"}}>{summary}</div>}
                  </div>
                  <div style={{padding:"12px 20px",borderTop:`1px solid ${C.border}`,display:"flex",gap:8,justifyContent:"flex-end"}}>
                    <Btn variant="ghost" small onClick={()=>setShowSumm(false)}>Đóng</Btn>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ PROMPT LAB ════ */}
        {tab==="prompt"&&(
          <div style={{animation:"slideIn 0.3s ease"}}>
            <Lbl>PROMPT LAB — TEST VÀ XEM PROMPT THỰC TẾ</Lbl>

            {/* Show current prompt */}
            <Card style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <Lbl style={{marginBottom:0}}>PROMPT HIỆN TẠI ({speakerMode} · {atcUnit} · {atcAirport})</Lbl>
                <span style={{fontSize:11,fontFamily:MONO,color:C.textDim}}>Thay đổi ở tab Ghi âm R/T</span>
              </div>
              <textarea readOnly value={buildAtcPrompt({speakerHint:speakerMode,unit:atcUnit,airport:atcAirport,glossaryCtx:gc(),prevLines:[]})}
                style={{width:"100%",height:320,backgroundColor:"#040a0e",border:`1px solid ${C.border}`,color:C.textDim,
                  padding:"12px",borderRadius:3,fontSize:11,lineHeight:1.7,boxSizing:"border-box"}}/>
            </Card>

            {/* Test box */}
            <Card style={{marginBottom:16}} hi>
              <Lbl>THỬ VỚI TEXT (không cần audio)</Lbl>
              <p style={{fontSize:12,color:C.textDim,fontFamily:SANS,marginBottom:12}}>
                Nhập transcript R/T mẫu để xem Gemini xử lý như thế nào với prompt hiện tại.
              </p>
              <textarea value={labText} onChange={e=>setLabText(e.target.value)}
                placeholder={`VD: VNA một hai ba, leo lên mực bay ba năm không, duy trì tốc độ hai năm không, liên lạc Hà Nội một hai bốn phẩy chín`}
                style={{width:"100%",height:90,backgroundColor:"#060e14",border:`1px solid ${C.border}`,color:C.text,
                  padding:"10px 14px",borderRadius:3,marginBottom:12,boxSizing:"border-box"}}
                onFocus={e=>e.target.style.borderColor=C.cyanDim}
                onBlur={e=>e.target.style.borderColor=C.border}/>
              <Btn onClick={labTest} disabled={labLoading||!apiKey||!labText.trim()} variant="green">
                {labLoading?"◌ Đang gửi Gemini...":"▶ Chạy thử với prompt hiện tại"}
              </Btn>
              {!apiKey&&<span style={{marginLeft:12,fontSize:12,color:C.red,fontFamily:MONO}}>Cần API Key</span>}
            </Card>

            {labResult&&(
              <Card hi={!labResult.error}>
                <Lbl>{labResult.error?"LỖI":"KẾT QUẢ GEMINI"}</Lbl>
                {labResult.error
                  ? <p style={{color:C.red,fontFamily:MONO,fontSize:13}}>{labResult.error}</p>
                  : (
                    <div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                        {[
                          {label:"Speaker",   value:labResult.speaker,   color:labResult.speaker==="KSVKL"?C.cyan:C.green},
                          {label:"Unit",      value:labResult.unit,      color:C.amber},
                          {label:"Callsign",  value:labResult.callsign||"—", color:C.green},
                          {label:"Severity",  value:labResult.severity||"NORMAL", color:labResult.severity==="EMERGENCY"?C.red:labResult.severity==="WARNING"?C.amber:C.textDim},
                        ].map((f,i)=>(
                          <div key={i} style={{backgroundColor:C.bg,padding:"8px 12px",borderRadius:3,border:`1px solid ${C.border}`}}>
                            <div style={{fontSize:9,fontFamily:MONO,letterSpacing:"0.12em",color:C.textDim,marginBottom:4}}>{f.label.toUpperCase()}</div>
                            <div style={{fontSize:14,fontFamily:MONO,fontWeight:700,color:f.color}}>{f.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{backgroundColor:C.bg,padding:"12px",borderRadius:3,border:`1px solid ${C.border}`,marginBottom:10}}>
                        <div style={{fontSize:9,fontFamily:MONO,letterSpacing:"0.12em",color:C.textDim,marginBottom:6}}>RAW → CORRECTED</div>
                        {labResult.original!==labResult.corrected&&<p style={{fontSize:12,color:C.textDim,fontStyle:"italic",marginBottom:6,fontFamily:SANS}}>▸ {labResult.original}</p>}
                        <p style={{fontSize:14,color:C.text,lineHeight:1.6,fontFamily:SANS,margin:0}}>{labResult.corrected}</p>
                      </div>
                      {Object.entries(labResult.key_values||{}).filter(([,v])=>v&&v!=="null").length>0&&(
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                          {Object.entries(labResult.key_values).filter(([,v])=>v&&v!=="null").map(([k,v])=>(
                            <Badge key={k} color={C.cyan}>{k.toUpperCase()}: {v}</Badge>
                          ))}
                        </div>
                      )}
                      {labResult.notes&&<p style={{fontSize:12,color:C.amber,fontFamily:MONO}}>{labResult.notes}</p>}
                    </div>
                  )
                }
              </Card>
            )}
          </div>
        )}

        {/* ════ HISTORY ════ */}
        {tab==="history"&&(
          <div style={{animation:"slideIn 0.3s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
              <Lbl>LỊCH SỬ</Lbl>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[["all","Tất cả"],["atc","R/T"],["meet","Cuộc họp"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setHistFilter(v)} style={{padding:"5px 14px",borderRadius:3,border:"none",cursor:"pointer",fontFamily:MONO,fontSize:11,fontWeight:700,backgroundColor:histFilter===v?C.cyanDim:C.border,color:histFilter===v?"white":C.textMid}}>{l}</button>
                ))}
                <Btn variant="ghost" small onClick={exportAtc}>↓ Xuất R/T</Btn>
                <Btn variant="danger" small onClick={()=>{ if(!confirm("Xóa?")) return; if(histFilter!=="meet") setAtcRecs([]); if(histFilter!=="atc") setMeetRecs([]); }}>✕</Btn>
              </div>
            </div>
            {histFilter!=="meet"&&atcRecs.length>0&&<>{histFilter==="all"&&<Lbl>LIÊN LẠC R/T</Lbl>}{atcRecs.map(t=><AtcCard key={t.id} t={t}/>)}</>}
            {histFilter!=="atc"&&meetRecs.length>0&&<>{histFilter==="all"&&<Lbl style={{marginTop:16}}>CUỘC HỌP</Lbl>}{meetRecs.map(t=><MeetCard key={t.id} t={t}/>)}</>}
            {((histFilter==="all"&&!atcRecs.length&&!meetRecs.length)||(histFilter==="atc"&&!atcRecs.length)||(histFilter==="meet"&&!meetRecs.length))&&(
              <Card style={{textAlign:"center",padding:"48px 24px"}}><p style={{color:C.textDim,fontFamily:MONO,fontSize:12}}>CHƯA CÓ LỊCH SỬ</p></Card>
            )}
          </div>
        )}

        {/* ════ GLOSSARY ════ */}
        {tab==="glossary"&&(
          <div style={{animation:"slideIn 0.3s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <Lbl>THUẬT NGỮ ({glossary.length}) — Inject vào mọi prompt tự động</Lbl>
              <Btn small onClick={()=>setShowAddG(v=>!v)}>+ THÊM</Btn>
            </div>
            <Inp value={gSearch} onChange={setGSearch} placeholder="◈ Tìm kiếm..." style={{marginBottom:16}}/>
            {showAddG&&(
              <Card hi style={{marginBottom:16}}>
                <Lbl>THUẬT NGỮ MỚI</Lbl>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <Inp value={newTerm.abbr} onChange={v=>setNewTerm(p=>({...p,abbr:v}))} placeholder="Từ viết tắt"/>
                  <Inp value={newTerm.vi}   onChange={v=>setNewTerm(p=>({...p,vi:v}))}   placeholder="Tên tiếng Việt"/>
                  <Inp value={newTerm.en}   onChange={v=>setNewTerm(p=>({...p,en:v}))}   placeholder="Tên tiếng Anh"/>
                  <Inp value={newTerm.note} onChange={v=>setNewTerm(p=>({...p,note:v}))} placeholder="Mô tả"/>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <Btn small onClick={()=>{ if(newTerm.abbr&&newTerm.vi){setGlossary(g=>[...g,{...newTerm,id:uid()}]); setNewTerm({abbr:"",vi:"",en:"",note:""}); setShowAddG(false); flash("Đã thêm ✓","success");} else flash("Cần từ viết tắt và tên tiếng Việt"); }}>LƯU</Btn>
                  <Btn variant="ghost" small onClick={()=>setShowAddG(false)}>HỦY</Btn>
                </div>
              </Card>
            )}
            {filtG.map(g=>(
              <div key={g.id} style={{backgroundColor:C.card,border:`1px solid ${C.border}`,borderRadius:4,padding:"12px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:4}}>
                    <span style={{fontFamily:MONO,fontWeight:700,fontSize:15,color:C.cyan}}>{g.abbr}</span>
                    <span style={{fontSize:13,color:C.text}}>{g.vi}</span>
                    {g.en&&<span style={{fontSize:12,color:C.textDim}}>/ {g.en}</span>}
                  </div>
                  {g.note&&<p style={{fontSize:12,color:C.textDim,fontFamily:SANS}}>{g.note}</p>}
                </div>
                <button onClick={()=>setGlossary(p=>p.filter(x=>x.id!==g.id))} style={{background:"none",border:"none",cursor:"pointer",color:C.textDim,fontSize:16,padding:"0 4px"}}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* ════ SETTINGS ════ */}
        {tab==="settings"&&(
          <div style={{animation:"slideIn 0.3s ease"}}>
            <Lbl>CÀI ĐẶT HỆ THỐNG</Lbl>
            <Card style={{marginBottom:16}}>
              <Lbl>GOOGLE GEMINI API KEY</Lbl>
              <p style={{fontSize:13,color:C.textDim,marginBottom:12,fontFamily:SANS,lineHeight:1.7}}>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{color:C.gemBlue}}>aistudio.google.com/app/apikey</a> — miễn phí với Google AI Studio
              </p>
              <Inp type="password" value={apiKey} onChange={setApiKey} placeholder="AIzaSy..." style={{marginBottom:8}}/>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <Dot color={apiKey?C.gemGreen:C.textDim}/>
                <span style={{fontSize:12,fontFamily:MONO,color:apiKey?C.gemGreen:C.textDim}}>{apiKey?"KEY ĐÃ LƯU (localStorage)":"CHƯA CÀI"}</span>
              </div>
            </Card>
            <Card style={{marginBottom:16}}>
              <Lbl>GEMINI MODEL</Lbl>
              <div style={{display:"grid",gap:8}}>
                {GEMINI_MODELS.map(m=>(
                  <button key={m.id} onClick={()=>setGemModel(m.id)} style={{
                    padding:"12px 16px",borderRadius:4,cursor:"pointer",textAlign:"left",border:"none",
                    backgroundColor:gemModel===m.id?`${m.color}15`:C.surface,
                    border:`1px solid ${gemModel===m.id?m.color:C.border}`,
                    boxShadow:gemModel===m.id?`0 0 10px ${m.color}33`:"none",transition:"all 0.2s"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontFamily:MONO,fontWeight:700,fontSize:13,color:gemModel===m.id?m.color:C.textMid}}>{m.label}</span>
                      <span style={{fontSize:10,fontFamily:MONO,color:m.color,backgroundColor:`${m.color}11`,border:`1px solid ${m.color}44`,padding:"1px 8px",borderRadius:2}}>{m.badge}</span>
                    </div>
                    <p style={{fontSize:12,color:C.textDim,fontFamily:SANS,margin:0}}>{m.note}</p>
                  </button>
                ))}
              </div>
            </Card>
            <Card>
              <Lbl>MICROPHONE</Lbl>
              <select value={selDev} onChange={e=>setSelDev(e.target.value)} style={{width:"100%",padding:"9px 14px",borderRadius:3,border:`1px solid ${C.border}`,backgroundColor:"#060e14",color:C.text,fontSize:13,fontFamily:MONO}}>
                {devices.map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||`Mic (${d.deviceId.slice(0,8)})`}</option>)}
              </select>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
