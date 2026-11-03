import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, BookOpen, CheckCircle2, ChevronRight, CircleHelp, Clock3,
  Download, Eye, EyeOff, FileText, Globe2, GraduationCap, History, Home,
  Languages, LayoutDashboard, LogOut, Menu, MessageCircle, RefreshCw, Shield,
  Sparkles, Target, Timer, Users, XCircle, Zap
} from 'lucide-react';
import { isConfigured, supabase } from './lib/supabase';
import { UNITS, gradeFor } from './data/units';

const LANGS = ['English', 'Hindi', 'Both'];
const fmtDate = (v) => v ? new Date(v).toLocaleString() : '—';
const safeError = (e) => e?.message || 'Something went wrong. Please try again.';
const eventLog = async (eventName, userId = null) => {
  if (!supabase) return;
  try {
    let clientId = localStorage.getItem('net-jrf-client-id');
    if (!clientId) { clientId = crypto.randomUUID(); localStorage.setItem('net-jrf-client-id', clientId); }
    await supabase.from('site_events').insert({ event_name: eventName, user_id: userId, client_id: clientId });
  } catch { /* analytics must never block practice */ }
};

function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [available, setAvailable] = useState(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (mode !== 'signup' || username.trim().length < 3 || !supabase) { setAvailable(null); return; }
    let live = true;
    const check = async () => {
      const { data, error: e } = await supabase.rpc('is_username_available', { username_in: username.trim() });
      if (live) setAvailable(e ? null : Boolean(data));
    };
    const t = setTimeout(check, 350);
    return () => { live = false; clearTimeout(t); };
  }, [username, mode]);

  const submit = async (e) => {
    e.preventDefault(); setError(''); setMessage('');
    if (!isConfigured) { setError('Pehle Supabase setup karke .env values add karo. README mein step-by-step diya hai.'); return; }
    const clean = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(clean)) { setError('Username 3–24 characters ka ho; sirf English letters, numbers aur underscore.'); return; }
    if (mode !== 'reset' && password.length < 8) { setError('Password kam se kam 8 characters ka rakho.'); return; }
    setBusy(true);
    try {
      if (mode === 'reset') {
        const { data, error: resetErr } = await supabase.functions.invoke('username-reset', { body: { username: clean } });
        if (resetErr) throw resetErr;
        setResetSent(true); setMessage(data?.message || 'Password reset request processed.');
      } else if (mode === 'signup') {
        const { data: check, error: checkErr } = await supabase.rpc('is_username_available', { username_in: clean });
        if (checkErr) throw checkErr;
        if (!check) throw new Error('This name is already taken. Please choose another username.');
        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Account recovery ke liye valid email address dalo.');
        const { data, error: signErr } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(), password,
          options: { data: { username: clean } }
        });
        if (signErr) throw signErr;
        if (!data.session) {
          await eventLog('signup', null);
          setMessage('Account request sent. Apne recovery email ka inbox kholo, verification link complete karo, phir username se login karo.');
        } else {
          await eventLog('signup', data.user?.id);
          window.location.reload();
        }
      } else {
        const { data, error: signErr } = await supabase.functions.invoke('username-login', { body: { username: clean, password } });
        if (signErr || data?.error || !data?.session) throw new Error(data?.error || safeError(signErr) || 'Invalid username or password.');
        const { data: signedIn, error: setErr } = await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
        if (setErr) throw setErr;
        await eventLog('login', signedIn.user?.id);
        window.location.reload();
      }
    } catch (err) { setError(safeError(err)); }
    finally { setBusy(false); }
  };

  return <div className="auth-layout">
    <div className="auth-hero">
      <div className="brand-mark"><GraduationCap size={24}/></div>
      <div className="eyebrow">YOUR PERSONAL EXAM COMMAND CENTRE</div>
      <h1>NET JRF<br/><span>Studio</span></h1>
      <p>Paper 1 ko unit-wise master karo. Har set mein 5 sawal, clear explanation aur tumhari progress cloud par saved.</p>
      <div className="hero-pills"><span>10 Units</span><span>5 MCQs / Set</span><span>Hindi + English</span></div>
      <div className="hero-note"><Shield size={16}/> Secure login · Multi-device progress sync</div>
    </div>
    <div className="auth-card-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="card-kicker">WELCOME</div>
        <h2>{mode === 'login' ? 'Login to continue' : mode === 'signup' ? 'Create your account' : 'Reset your password'}</h2>
        <p className="muted">{mode === 'login' ? 'Apni saved practice history wapas kholo.' : mode === 'signup' ? 'Apna unique username banao aur practice shuru karo.' : 'Username enter karo; reset link recovery email par milega.'}</p>
        <label>Username / ID</label>
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. Rakesh99" autoComplete="username" required />
        {mode === 'signup' && available === false && <div className="inline-error">This name is already taken. Try another username.</div>}
        {mode === 'signup' && available === true && <div className="inline-good">Username available</div>}
        {mode === 'signup' && <><label>Recovery email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></>}
        {mode !== 'reset' && <><label>Password</label><div className="password-wrap"><input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /><button type="button" className="icon-button" onClick={() => setShowPass(!showPass)} aria-label="Show password">{showPass ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></>}
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert info">{message}</div>}
        <button className="primary-btn full" disabled={busy || (mode === 'signup' && available === false)}>{busy ? 'Please wait…' : mode === 'login' ? 'Login securely' : mode === 'signup' ? 'Create account' : 'Send reset link'} <ChevronRight size={17}/></button>
        <div className="auth-switch">{mode === 'login' ? <>New here? <button type="button" onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>Create an account</button><br/><button type="button" onClick={() => { setMode('reset'); setError(''); setMessage(''); setResetSent(false); }}>Forgot password?</button></> : <>{mode === 'reset' ? 'Remembered it?' : 'Already registered?'} <button type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }}>Back to login</button></>}</div>
        <div className="small-print">Password is handled by Supabase Auth; recovery email is used for account recovery.</div>
      </form>
    </div>
  </div>;
}

function SetupNotice() {
  return <div className="setup-screen"><div className="setup-icon"><GraduationCap size={32}/></div><h1>NET JRF Studio</h1><p>Website code ready hai. Login aur permanent cloud history chalane ke liye Supabase project connect karna zaroori hai.</p><div className="setup-steps"><b>Setup ke 3 kaam:</b><ol><li>Supabase project banao.</li><li><code>supabase/schema.sql</code> SQL Editor mein run karo.</li><li><code>.env</code> mein Project URL aur publishable key dalo.</li></ol></div><p className="muted">Pura guide project ke README.md mein diya gaya hai.</p></div>;
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [selectedUnit, setSelectedUnit] = useState(1);
  const [lang, setLang] = useState(localStorage.getItem('net-jrf-lang') || 'Both');
  const [timerOn, setTimerOn] = useState(localStorage.getItem('net-jrf-timer') !== 'off');
  const [seconds, setSeconds] = useState(0);
  const [activeSet, setActiveSet] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState([]);
  const [seenCount, setSeenCount] = useState(0);
  const [stats, setStats] = useState({ completed: 0, correct: 0, score: 0 });
  const [adminData, setAdminData] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [doubt, setDoubt] = useState('');
  const [doubtAnswer, setDoubtAnswer] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session;
      setSession(s);
      if (s?.user) await loadProfile(s.user.id);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setPage('reset-password');
      if (!s) setProfile(null);
    });
    eventLog('page_open', null);
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId) => {
    const { data, error } = await supabase.from('profiles').select('id, username, role, created_at, last_seen_at').eq('id', userId).single();
    if (!error) setProfile(data);
    else setNotice('Profile load nahi hua: ' + error.message);
  };

  const refreshUserData = useCallback(async () => {
    if (!session?.user?.id) return;
    const allRows = [];
    for (let offset = 0; offset < 50000; offset += 500) {
      const { data: batch, error } = await supabase.from('practice_sessions')
        .select('id, unit, set_number, started_at, submitted_at, duration_seconds, correct_count, total_questions, score, grade, status')
        .eq('user_id', session.user.id).order('started_at', { ascending: false }).range(offset, offset + 499);
      if (error) { setNotice('History load error: ' + error.message); break; }
      allRows.push(...(batch || []));
      if (!batch || batch.length < 500) break;
    }
    const { count: seen } = await supabase.from('user_question_history').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id);
    setHistory(allRows);
    setSeenCount(seen || 0);
    const completed = allRows.filter(x => x.status === 'completed');
    const totalCorrect = completed.reduce((a, x) => a + (x.correct_count || 0), 0);
    const totalQ = completed.reduce((a, x) => a + (x.total_questions || 5), 0);
    setStats({ completed: completed.length, correct: totalCorrect, score: completed.reduce((a, x) => a + (x.score || 0), 0), totalQ });
  }, [session?.user?.id]);

  useEffect(() => { if (session?.user?.id && profile) refreshUserData(); }, [session?.user?.id, profile?.id, refreshUserData]);
  useEffect(() => { localStorage.setItem('net-jrf-lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('net-jrf-timer', timerOn ? 'on' : 'off'); }, [timerOn]);
  useEffect(() => {
    if (!activeSet || result || !timerOn) return;
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [activeSet, result, timerOn]);

  const openUnit = async (unitId) => {
    setSelectedUnit(unitId); setPage('practice'); setActiveSet(null); setResult(null); setAnswers({}); setSeconds(0); setNotice('');
    await startSet(unitId);
  };

  const startSet = async (unitId) => {
    if (!supabase) return;
    setBusy(true); setNotice('');
    const { data, error } = await supabase.functions.invoke('generate-set', { body: { unit: unitId } });
    if (error || data?.error) { setNotice(data?.error || safeError(error)); setBusy(false); return; }
    setActiveSet(data);
    const prev = {};
    (data.questions || []).forEach(q => { if (q.selected_index !== null && q.selected_index !== undefined) prev[q.id] = q.selected_index; });
    setAnswers(prev); setSeconds(data.elapsed_seconds || 0); setBusy(false);
    if (data.resumed) setNotice('Pichhla incomplete set resume hua hai. Tumhare sawal repeat ya delete nahi hue.');
    refreshUserData();
  };

  const selectAnswer = (questionId, selectedIndex) => {
    setAnswers(a => ({ ...a, [questionId]: selectedIndex }));
    if (activeSet?.session_id) {
      supabase.functions.invoke('save-answer', { body: { session_id: activeSet.session_id, question_id: questionId, selected_index: selectedIndex } })
        .then(({ error }) => { if (error) setNotice('Answer auto-save nahi hua. Submit karne par answers phir bhi save honge.'); });
    }
  };

  const submitSet = async () => {
    if (!activeSet || busy) return;
    if (Object.keys(answers).length < activeSet.questions.length) {
      if (!window.confirm('Kuch questions unanswered hain. Kya phir bhi submit karna hai?')) return;
    }
    setBusy(true); setNotice('');
    const answerList = activeSet.questions.map(q => ({ question_id: q.id, selected_index: answers[q.id] ?? null }));
    const { data, error } = await supabase.functions.invoke('submit-set', { body: { session_id: activeSet.session_id, answers: answerList, duration_seconds: timerOn ? seconds : null } });
    if (error || data?.error) { setNotice(data?.error || safeError(error)); setBusy(false); return; }
    setResult(data); setBusy(false); refreshUserData();
  };

  const logout = async () => { await supabase.auth.signOut(); setSession(null); setProfile(null); setActiveSet(null); setPage('home'); };

  const loadAdmin = async () => {
    setBusy(true); setNotice('');
    const [usersRes, eventsRes, sessionsRes, pageCount, loginCount, signupCount, completedCount, userCount, unitCounts] = await Promise.all([
      supabase.from('profiles').select('id, username, role, created_at, last_seen_at').order('created_at', { ascending: false }).limit(1000),
      supabase.from('site_events').select('id, event_name, user_id, created_at, client_id').order('created_at', { ascending: false }).limit(500),
      supabase.from('practice_sessions').select('id, user_id, status, unit, score, created_at:started_at').order('started_at', { ascending: false }).limit(500),
      supabase.from('site_events').select('id', { count: 'exact', head: true }).eq('event_name', 'page_open'),
      supabase.from('site_events').select('id', { count: 'exact', head: true }).eq('event_name', 'login'),
      supabase.from('site_events').select('id', { count: 'exact', head: true }).eq('event_name', 'signup'),
      supabase.from('practice_sessions').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      Promise.all(UNITS.map(async u => {
        const { count, error } = await supabase.from('question_bank').select('id', { count: 'exact', head: true }).eq('unit', u.id);
        return { unit: u.id, count: count || 0, error };
      }))
    ]);
    const error = usersRes.error || eventsRes.error || sessionsRes.error || pageCount.error || loginCount.error || signupCount.error || completedCount.error || userCount.error || unitCounts.find(x => x.error)?.error;
    if (error) setNotice('Admin data load error: ' + error.message);
    const qCount = {};
    unitCounts.forEach(q => qCount[q.unit] = q.count);
    setAdminData({ users: usersRes.data || [], events: eventsRes.data || [], sessions: sessionsRes.data || [], qCount,
      counts: { visits: pageCount.count || 0, logins: loginCount.count || 0, signups: signupCount.count || 0, completed: completedCount.count || 0, users: userCount.count || 0 } });
    setBusy(false);
  };

  useEffect(() => {
    if (page !== 'admin' || profile?.role !== 'admin') return;
    loadAdmin();
    const poll = setInterval(loadAdmin, 30000);
    return () => clearInterval(poll);
  }, [page, profile?.role]);

  const askDoubt = async (e) => {
    e.preventDefault(); if (!doubt.trim()) return;
    setBusy(true); setNotice(''); setDoubtAnswer(null);
    const { data, error } = await supabase.functions.invoke('ask-doubt', { body: { question: doubt.trim(), language: 'both' } });
    if (error || data?.error) setNotice(data?.error || safeError(error));
    else setDoubtAnswer(data);
    setBusy(false);
  };

  if (!isConfigured) return <SetupNotice/>;
  if (authLoading) return <div className="loading-screen"><div className="loader"/>Account check ho raha hai…</div>;
  if (!session) return <AuthScreen/>;

  const currentUnit = UNITS.find(u => u.id === selectedUnit) || UNITS[0];
  const totalPercent = stats.totalQ ? Math.round((stats.correct / stats.totalQ) * 100) : 0;
  const navItems = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'history', label: 'My History', icon: History },
    { id: 'doubts', label: 'Ask AI Doubt', icon: MessageCircle },
    { id: 'settings', label: 'Settings', icon: Activity },
    ...(profile?.role === 'admin' ? [{ id: 'admin', label: 'Admin Panel', icon: Shield }] : [])
  ];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
      <div className="sidebar-brand"><div className="brand-mark small"><GraduationCap size={20}/></div><div><b>NET JRF</b><span>STUDIO</span></div><button className="mobile-close" onClick={() => setMobileMenu(false)}><XCircle size={18}/></button></div>
      <div className="nav-label">WORKSPACE</div>
      {navItems.map(item => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setMobileMenu(false); setNotice(''); }}><item.icon size={18}/>{item.label}</button>)}
      <div className="nav-label units-label">PAPER 1 · 10 UNITS</div>
      <div className="unit-nav">{UNITS.map(u => <button key={u.id} className={`unit-nav-item ${page === 'practice' && selectedUnit === u.id ? 'active' : ''}`} onClick={() => { openUnit(u.id); setMobileMenu(false); }}><span className="unit-number">{String(u.id).padStart(2,'0')}</span><span>{u.short}</span></button>)}</div>
      <div className="sidebar-bottom"><div className="user-mini"><div className="avatar">{profile?.username?.slice(0,1).toUpperCase() || 'U'}</div><div className="user-mini-text"><b>{profile?.username || 'Student'}</b><span>{profile?.role === 'admin' ? 'Administrator' : 'NET/JRF Candidate'}</span></div><button className="logout-icon" onClick={logout} title="Logout"><LogOut size={17}/></button></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="menu-button" onClick={() => setMobileMenu(true)}><Menu size={20}/></button><span className="crumb">Paper 1 <ChevronRight size={14}/> {page === 'practice' ? currentUnit.short : page === 'home' ? 'Dashboard' : page === 'admin' ? 'Admin Panel' : page === 'doubts' ? 'AI Doubt Helper' : page === 'history' ? 'Practice History' : 'Settings'}</span></div><div className="topbar-right"><div className="sync-pill"><span className="live-dot"/> Cloud sync active</div><div className="avatar top-avatar">{profile?.username?.slice(0,1).toUpperCase()}</div></div></header>
      <div className="content-wrap">
        {notice && <div className="alert info dismissible">{notice}<button onClick={() => setNotice('')}><XCircle size={16}/></button></div>}

        {page === 'home' && <>
          <div className="welcome-row"><div><div className="eyebrow">YOUR PREPARATION, ORGANIZED</div><h1>Welcome back, {profile?.username || 'Candidate'} <span className="wave">✦</span></h1><p className="muted">Aaj ka target chhota rakho, consistency badi rakho.</p></div><button className="outline-btn" onClick={refreshUserData}><RefreshCw size={16}/> Refresh progress</button></div>
          <section className="stats-grid">
            <StatCard icon={BookOpen} label="Questions seen" value={seenCount} note="Saved to your account"/>
            <StatCard icon={CheckCircle2} label="Sets completed" value={stats.completed} note="5 questions per set"/>
            <StatCard icon={Target} label="Correct answers" value={stats.correct} note="Across completed sets"/>
            <StatCard icon={Activity} label="Accuracy" value={`${totalPercent}%`} note="Overall performance"/>
          </section>
          <div className="section-heading"><div><h2>Choose your unit</h2><p>Har unit alag hai. Ek set mein 5 MCQs milenge.</p></div><span className="count-chip">10 UNITS</span></div>
          <div className="unit-grid">{UNITS.map(u => <button className="unit-card" key={u.id} onClick={() => openUnit(u.id)}><div className="unit-card-top"><span className="unit-badge">UNIT {String(u.id).padStart(2,'0')}</span><ChevronRight size={18}/></div><h3>{u.short}</h3><div className="unit-hi">{u.hi}</div><p>{u.topics}</p><div className="unit-card-bottom"><span>Target: 500 questions</span><span className="start-link">Practice <ChevronRight size={14}/></span></div></button>)}</div>
          <div className="bottom-grid"><div className="panel progress-panel"><div className="panel-title"><div><h3>Overall progress</h3><p>Completed question sets</p></div><GraduationCap size={21}/></div><div className="progress-number">{stats.completed * 5}<span> / 5,000 target questions</span></div><div className="progress-track"><div style={{ width: `${Math.min(100, (stats.completed * 5 / 5000) * 100)}%` }}/></div><p className="muted tiny">Target tab poora hoga jab 10 units mein 500-500 question bank available aur attempted ho jayenge.</p></div><div className="panel grade-panel"><div className="panel-title"><div><h3>Current grade</h3><p>Based on submitted answers</p></div><Target size={21}/></div><div className="grade-big">{stats.totalQ >= 20 ? gradeFor(totalPercent) : '—'}</div><p className="muted tiny">20 questions attend karne ke baad grade card unlock hoga.</p>{stats.totalQ >= 20 && <button className="text-btn" onClick={() => setPage('history')}>View grade card <ChevronRight size={14}/></button>}</div></div>
        </>}

        {page === 'practice' && <>
          {!activeSet && <div className="empty-state"><div className="setup-icon"><BookOpen size={28}/></div><h2>{currentUnit.short}</h2><p>{busy ? 'Question set tayyar ho raha hai…' : 'Is unit ka agla unique 5-question set kholo.'}</p><button className="primary-btn" onClick={() => startSet(selectedUnit)} disabled={busy}>{busy ? 'Loading…' : 'Start 5-question set'} <ChevronRight size={17}/></button></div>}
          {activeSet && !result && <>
            <div className="practice-head"><div><div className="eyebrow">UNIT {String(currentUnit.id).padStart(2,'0')} · PRACTICE SET</div><h1>{currentUnit.short}</h1><p className="muted">Har question ke liye ek option choose karo, phir submit karo.</p></div><div className="practice-tools"><LanguageControl lang={lang} setLang={setLang}/><div className={`timer-chip ${timerOn ? '' : 'off'}`}><Clock3 size={16}/>{timerOn ? `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}` : 'Timer off'}</div></div></div>
            <div className="set-progress"><span>Set {activeSet.set_number || '—'}</span><span>{Object.keys(answers).length} / {activeSet.questions.length} answered</span></div><div className="progress-track"><div style={{ width: `${(Object.keys(answers).length / activeSet.questions.length) * 100}%` }}/></div>
            <div className="question-list">{activeSet.questions.map((q, i) => <article className="question-card" key={q.id}><div className="question-meta"><span>QUESTION {i+1}</span><span>2 MARKS</span></div><div className="question-text">{lang !== 'Hindi' && <div>{q.question_en}</div>}{lang !== 'English' && <div className={lang === 'Both' ? 'hindi-text' : ''}>{q.question_hi}</div>}</div><div className="options-grid">{(lang === 'Hindi' ? q.options_hi : q.options_en).map((option, idx) => <button key={idx} onClick={() => selectAnswer(q.id, idx)} className={`option ${answers[q.id] === idx ? 'selected' : ''}`}><span className="option-letter">{String.fromCharCode(65+idx)}</span><span>{option}</span>{answers[q.id] === idx && <CheckCircle2 className="option-check" size={17}/>}</button>)}</div>{lang === 'Both' && <div className="options-translation"><span>Hindi options:</span>{q.options_hi?.map((o, ix) => <div key={ix}>{String.fromCharCode(65+ix)}. {o}</div>)}</div>}</article>)}</div>
            <div className="submit-bar"><div><b>{Object.keys(answers).length} of 5 selected</b><span>Submit ke baad correct answer aur explanation dikhega.</span></div><button className="primary-btn" onClick={submitSet} disabled={busy}>{busy ? 'Submitting…' : 'Submit set'} <ChevronRight size={17}/></button></div>
          </>}
          {result && <ResultView result={result} lang={lang} onNext={() => { setResult(null); setActiveSet(null); startSet(selectedUnit); }} onHistory={() => setPage('history')}/>}
        </>}

        {page === 'history' && <HistoryPage history={history} seenCount={seenCount} stats={stats} refresh={refreshUserData} lang={lang} onResume={(unit) => openUnit(unit)}/>}
        {page === 'settings' && <SettingsPage lang={lang} setLang={setLang} timerOn={timerOn} setTimerOn={setTimerOn} profile={profile}/>}
        {page === 'doubts' && <div className="doubt-page"><div className="eyebrow">STUDY ASSISTANT</div><h1>Ask your doubt</h1><p className="muted">Question ya concept likho. AI response English aur Hindi dono mein dega.</p><form className="doubt-form" onSubmit={askDoubt}><textarea value={doubt} onChange={e => setDoubt(e.target.value)} placeholder="Example: Explain the difference between formative and summative evaluation…" rows={5}/><button className="primary-btn" disabled={busy || !doubt.trim()}>{busy ? 'Thinking…' : 'Ask AI'} <Sparkles size={17}/></button></form>{doubtAnswer && <div className="answer-panel"><div className="answer-heading"><Sparkles size={18}/> AI explanation</div><h3>English</h3><p className="answer-text">{doubtAnswer.english}</p><h3>Hindi</h3><p className="answer-text">{doubtAnswer.hindi}</p>{doubtAnswer.sources?.length > 0 && <div className="doubt-sources"><b>Web sources used</b>{doubtAnswer.sources.map((src, i) => <a key={i} href={src.url} target="_blank" rel="noreferrer">{src.title} <ChevronRight size={12}/></a>)}</div>}<p className="tiny muted">AI answers can contain mistakes. Important exam facts ko official sources se verify karo.</p></div>}<div className="external-ai"><h3>Open other study tools</h3><p className="muted tiny">Ye links unki official websites kholte hain; in services ka separate account/API access zaroori ho sakta hai.</p><div className="ai-link-grid"><a href="https://gemini.google.com/" target="_blank" rel="noreferrer">Google Gemini <ChevronRight size={15}/></a><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT <ChevronRight size={15}/></a><a href="https://www.perplexity.ai/" target="_blank" rel="noreferrer">Perplexity <ChevronRight size={15}/></a><a href="https://www.google.com/" target="_blank" rel="noreferrer">Google Search <ChevronRight size={15}/></a></div></div></div>}

        {page === 'admin' && profile?.role === 'admin' && <AdminPage data={adminData} busy={busy} reload={loadAdmin}/>}
        {page === 'reset-password' && <div className="reset-password-page"><div className="eyebrow">ACCOUNT SECURITY</div><h1>Choose a new password</h1><p className="muted">Naya strong password kam se kam 8 characters ka rakho.</p><form className="auth-card reset-card" onSubmit={async (e) => { e.preventDefault(); setResetError(''); if (newPassword.length < 8) { setResetError('Password kam se kam 8 characters ka ho.'); return; } setResetBusy(true); const { error } = await supabase.auth.updateUser({ password: newPassword }); setResetBusy(false); if (error) setResetError(error.message); else { setNewPassword(''); setPage('home'); setNotice('Password successfully updated.'); } }}><label>New password</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8}/>{resetError && <div className="alert error">{resetError}</div>}<button className="primary-btn full" disabled={resetBusy}>{resetBusy ? 'Updating…' : 'Update password'}</button></form></div>}
      </div>
      <footer className="footer"><span>NET JRF Studio</span><span>Made for focused Paper 1 preparation · AI questions should be verified</span></footer>
    </main>
  </div>;
}

function StatCard({ icon: Icon, label, value, note }) {
  return <div className="stat-card"><div className="stat-icon"><Icon size={19}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>;
}
function LanguageControl({ lang, setLang }) {
  return <div className="seg-control">{LANGS.map(l => <button key={l} className={lang === l ? 'selected' : ''} onClick={() => setLang(l)}>{l === 'Hindi' ? 'हिन्दी' : l}</button>)}</div>;
}
function ResultView({ result, lang, onNext, onHistory }) {
  const pct = Math.round((result.correct_count / result.total_questions) * 100);
  return <div className="result-wrap">
    <div className="result-hero">
      <div className="result-icon"><CheckCircle2 size={32}/></div>
      <div className="eyebrow">SET SUBMITTED</div>
      <h1>{result.correct_count} / {result.total_questions} correct</h1>
      <p>{result.score} / {result.total_questions * 2} marks · {result.duration_seconds !== null ? `${Math.floor(result.duration_seconds/60)}m ${result.duration_seconds%60}s` : 'Timer off'}</p>
      <div className="result-grade">Grade: <b>{result.grade}</b></div>
    </div>
    <div className="review-title"><h2>Answer review</h2><span>{pct}% accuracy</span></div>
    {result.review?.map((r,i) => <div className={`review-card ${r.is_correct ? 'is-correct' : 'is-wrong'}`} key={r.question_id}>
      <div className="review-top"><b>Q{i+1}. {r.is_correct ? 'Correct' : r.selected_index === null ? 'Not answered' : 'Incorrect'}</b><span>{r.is_correct ? '+2 marks' : '0 marks'}</span></div>
      {lang !== 'Hindi' && <p>{r.question_en}</p>}
      {lang !== 'English' && <p className="hindi-text">{r.question_hi}</p>}
      <div className="answer-line"><CheckCircle2 size={16}/> Correct: {String.fromCharCode(65+r.correct_index)}. {lang === 'Hindi' ? r.options_hi?.[r.correct_index] : r.options_en?.[r.correct_index]}</div>
      {r.selected_index !== null && r.selected_index !== r.correct_index && <div className="wrong-line">Your answer: {String.fromCharCode(65+r.selected_index)}. {lang === 'Hindi' ? r.options_hi?.[r.selected_index] : r.options_en?.[r.selected_index]}</div>}
      <div className="explanation"><b>Explanation</b>{lang !== 'Hindi' && <p>{r.explanation_en}</p>}{lang !== 'English' && <p className="hindi-text">{r.explanation_hi}</p>}{r.source_note && <p className="source-note">{r.source_note}</p>}</div>
    </div>)}
    <div className="result-actions"><button className="outline-btn" onClick={onHistory}><History size={16}/> View history</button><button className="primary-btn" onClick={onNext}>Next unique set <ChevronRight size={17}/></button></div>
  </div>;
}
function HistoryPage({ history, seenCount, stats, refresh, lang, onResume }) {
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [reviewCache, setReviewCache] = useState({});
  const [reviewBusy, setReviewBusy] = useState(null);
  const [reviewError, setReviewError] = useState('');
  const exportHistory = () => {
    const headers = ['Unit','Started At','Status','Correct','Score','Grade','Duration Seconds'];
    const lines = history.map(x => [x.unit, x.started_at, x.status, x.correct_count ?? '', x.score ?? '', x.grade ?? '', x.duration_seconds ?? ''].map(v => `"${String(v).replaceAll('"','""')}"`).join(','));
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'net-jrf-practice-history.csv'; a.click(); URL.revokeObjectURL(url);
  };
  const showReview = async (sessionId) => {
    if (expanded === sessionId) { setExpanded(null); setReviewError(''); return; }
    setExpanded(sessionId); setReviewError('');
    if (reviewCache[sessionId]) return;
    setReviewBusy(sessionId);
    try {
      const { data, error } = await supabase.functions.invoke('get-session-review', { body: { session_id: sessionId } });
      if (error || data?.error) throw new Error(data?.error || safeError(error));
      setReviewCache(prev => ({ ...prev, [sessionId]: data?.review || [] }));
    } catch (err) { setReviewError(safeError(err)); }
    finally { setReviewBusy(null); }
  };
  const filtered = history.filter(x => filter === 'all' || x.status === filter);
  const total = stats.totalQ || 0; const pct = total ? Math.round(stats.correct / total * 100) : 0;
  return <div className="history-page">
    <div className="welcome-row"><div><div className="eyebrow">YOUR LEARNING RECORD</div><h1>Practice history</h1><p className="muted">Tumhare attended questions aur completed sets cloud mein save hain. Purane answers dekhne ke liye Review kholo.</p></div><div className="row-actions"><button className="outline-btn" onClick={exportHistory}><Download size={16}/> Export CSV</button><button className="outline-btn" onClick={refresh}><RefreshCw size={16}/> Refresh</button></div></div>
    <div className="stats-grid compact-stats"><StatCard icon={BookOpen} label="Questions saved" value={seenCount} note="Seen questions never repeat"/><StatCard icon={CheckCircle2} label="Completed sets" value={stats.completed} note="Cloud saved"/><StatCard icon={Target} label="Accuracy" value={`${pct}%`} note={`${stats.correct} correct out of ${total}`}/><StatCard icon={GraduationCap} label="Current grade" value={total >= 20 ? gradeFor(pct) : 'Locked'} note="Unlocks after 20 questions"/></div>
    {total >= 20 && <div className="grade-download"><div><div className="eyebrow">20+ QUESTIONS COMPLETED</div><h3>Your progress grade card is ready</h3><p className="muted">Grade {gradeFor(pct)} · {pct}% accuracy · {total} questions attempted</p></div><button className="primary-btn" onClick={() => window.print()}><Download size={16}/> Download / Print grade card</button></div>}
    <div className="table-panel"><div className="table-head"><h2>Set history</h2><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All sets</option><option value="completed">Completed</option><option value="in_progress">In progress</option></select></div>
      {filtered.length === 0 ? <div className="empty-table">Abhi koi set nahi hai. Dashboard se kisi unit ka practice set shuru karo.</div> : <div className="responsive-table"><table><thead><tr><th>Unit</th><th>Set</th><th>Date</th><th>Status</th><th>Score</th><th>Grade</th><th>Duration</th><th>Review / Resume</th></tr></thead><tbody>{filtered.map(row => <React.Fragment key={row.id}>
        <tr><td><b>{UNITS.find(u => u.id === row.unit)?.short || `Unit ${row.unit}`}</b></td><td>#{row.set_number || '—'}</td><td>{fmtDate(row.started_at)}</td><td><span className={`status ${row.status}`}>{row.status.replace('_',' ')}</span></td><td>{row.status === 'completed' ? `${row.score}/10` : '—'}</td><td>{row.grade || '—'}</td><td>{row.duration_seconds != null ? `${Math.floor(row.duration_seconds/60)}m ${row.duration_seconds%60}s` : '—'}</td><td>{row.status === 'completed' ? <button className="table-action" onClick={() => showReview(row.id)}>{expanded === row.id ? 'Hide review' : 'Review answers'}</button> : <button className="table-action" onClick={() => onResume(row.unit)}>Resume set</button>}</td></tr>
        {expanded === row.id && <tr><td colSpan="8" className="history-review-cell">{reviewBusy === row.id ? <div className="empty-table">Loading saved answers…</div> : reviewError ? <div className="alert error">{reviewError}</div> : (reviewCache[row.id] || []).map((r, i) => <article className={`history-review-card ${r.is_correct ? 'is-correct' : 'is-wrong'}`} key={r.question_id}><div className="history-review-heading"><b>Question {r.position || i + 1} · {r.is_correct ? 'Correct' : r.selected_index === null ? 'Not answered' : 'Incorrect'}</b><span>{r.is_correct ? '+2 marks' : '0 marks'}</span></div>{lang !== 'Hindi' && <p>{r.question_en}</p>}{lang !== 'English' && <p className="hindi-text">{r.question_hi}</p>}<div className="history-answer"><b>Correct answer:</b> {String.fromCharCode(65 + r.correct_index)}. {(lang === 'Hindi' ? r.options_hi : r.options_en)?.[r.correct_index]}</div>{r.selected_index !== null && r.selected_index !== r.correct_index && <div className="history-wrong"><b>Your answer:</b> {String.fromCharCode(65 + r.selected_index)}. {(lang === 'Hindi' ? r.options_hi : r.options_en)?.[r.selected_index]}</div>}{r.selected_index === null && <div className="history-wrong">Not attempted</div>}<div className="explanation"><b>Explanation</b>{lang !== 'Hindi' && <p>{r.explanation_en}</p>}{lang !== 'English' && <p className="hindi-text">{r.explanation_hi}</p>}</div></article>)}</td></tr>}
      </React.Fragment>)}</tbody></table></div>}
    </div><div className="tiny muted history-note">Questions ko set open hote hi “seen” history mein save kiya jata hai. Incomplete set resume karne par pehle selected answers restore honge. Cloud backup/export ko apni taraf se bhi safe rakho.</div>
  </div>;
}
function SettingsPage({ lang, setLang, timerOn, setTimerOn, profile }) {
  return <div className="settings-page"><div className="eyebrow">PERSONAL PREFERENCES</div><h1>Settings</h1><p className="muted">Apna practice experience customize karo.</p><div className="settings-card"><div className="settings-row"><div className="settings-icon"><Languages size={20}/></div><div className="settings-copy"><b>Question language</b><span>English, Hindi ya dono ek saath.</span></div><LanguageControl lang={lang} setLang={setLang}/></div><div className="settings-divider"/><div className="settings-row"><div className="settings-icon"><Timer size={20}/></div><div className="settings-copy"><b>Practice timer</b><span>Set ka elapsed time track karo. Timer off hone par bhi set history save hoti hai.</span></div><button className={`toggle ${timerOn ? 'on' : ''}`} onClick={() => setTimerOn(!timerOn)} aria-pressed={timerOn}><span/></button></div><div className="settings-divider"/><div className="settings-row"><div className="settings-icon"><Shield size={20}/></div><div className="settings-copy"><b>Account</b><span>Username: {profile?.username} · Role: {profile?.role}</span></div><span className="cloud-tag">Cloud sync on</span></div></div><div className="info-box"><b>History kaise safe rehti hai?</b><p>Question attempts server database mein account ke saath linked hain. App close karne ya dusre device se login karne par saved history wapas load hoti hai. Apne account ka password safe rakho aur database provider ke regular backups enable rakho.</p></div></div>;
}
function AdminPage({ data, busy, reload }) {
  if (!data) return <div className="empty-state"><Shield size={30}/><h2>Admin overview</h2><p>{busy ? 'Admin data load ho raha hai…' : 'Dashboard data dekhne ke liye refresh karo.'}</p><button className="primary-btn" onClick={reload} disabled={busy}>Load admin data</button></div>;
  const signups = data.counts?.signups ?? data.events.filter(e => e.event_name === 'signup').length;
  const visits = data.counts?.visits ?? data.events.filter(e => e.event_name === 'page_open').length;
  const logins = data.counts?.logins ?? data.events.filter(e => e.event_name === 'login').length;
  const completed = data.counts?.completed ?? data.sessions.filter(s => s.status === 'completed').length;
  const qTotal = Object.values(data.qCount).reduce((a,b) => a+b,0);
  return <div className="admin-page"><div className="welcome-row"><div><div className="eyebrow">OWNER CONSOLE</div><h1>Admin dashboard</h1><p className="muted">Website activity, accounts aur question bank overview.</p></div><button className="outline-btn" onClick={reload} disabled={busy}><RefreshCw size={16}/> Refresh live data</button></div><div className="stats-grid"><StatCard icon={Users} label="Registered users" value={data.counts?.users ?? data.users.length} note={`${signups} signup events logged`}/><StatCard icon={Eye} label="Page opens logged" value={visits} note="Includes anonymous browser opens"/><StatCard icon={Zap} label="Login events" value={logins} note="Login activity events"/><StatCard icon={CheckCircle2} label="Completed sets" value={completed} note={`${qTotal} questions in bank`}/></div><div className="table-panel"><div className="table-head"><h2>Registered users</h2><span className="count-chip">{data.counts?.users ?? data.users.length} ACCOUNTS</span></div><div className="responsive-table"><table><thead><tr><th>Username</th><th>Role</th><th>Joined</th><th>Last login / signup</th></tr></thead><tbody>{data.users.map(u => <tr key={u.id}><td><b>{u.username}</b></td><td><span className={`status ${u.role}`}>{u.role}</span></td><td>{fmtDate(u.created_at)}</td><td>{fmtDate(u.last_seen_at)}</td></tr>)}</tbody></table></div></div><div className="table-panel"><div className="table-head"><h2>Recent activity</h2><span className="count-chip">AUTO REFRESH · 30 SEC</span></div><div className="responsive-table"><table><thead><tr><th>Event</th><th>Account</th><th>Time</th></tr></thead><tbody>{data.events.slice(0,20).map(ev => <tr key={ev.id}><td><b>{ev.event_name.replace('_',' ')}</b></td><td>{data.users.find(u => u.id === ev.user_id)?.username || 'Anonymous visitor'}</td><td>{fmtDate(ev.created_at)}</td></tr>)}</tbody></table></div></div><div className="table-panel"><div className="table-head"><h2>Question bank by unit</h2><span className="count-chip">{qTotal} / 5,000</span></div><div className="admin-unit-grid">{UNITS.map(u => <div className="admin-unit-row" key={u.id}><div><b>Unit {u.id}</b><span>{u.short}</span></div><div className="admin-count"><b>{data.qCount[u.id] || 0}</b><span>/ 500</span><div className="progress-track"><div style={{width:`${Math.min(100,((data.qCount[u.id]||0)/500)*100)}%`}}/></div></div></div>)}</div></div><div className="tiny muted">Privacy: admin view mein usernames aur activity metrics dikhte hain; kisi user ka password kabhi nahi dikhaya jata.</div></div>;
}

export default App;
