import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Agent, View } from './types';
import { T, FONT, SKILL_META } from './theme';
import { Badge, Card, Input, Spinner, Btn, ThinkingAnimation, DeleteBtn } from './components/ui';
import { ResultView } from './components/ResultView';
import { fmtPrice } from './utils';

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<View>('marketplace');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [runPrompt, setRunPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<Record<string, unknown> | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Deploy form state
  const [dName, setDName] = useState('');
  const [dDesc, setDDesc] = useState('');
  const [dSkill, setDSkill] = useState('custom');
  const [dPrice, setDPrice] = useState('0');
  const [dEmail, setDEmail] = useState('');
  const [dPrompt, setDPrompt] = useState('');
  const [dApiUrl, setDApiUrl] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [deployDone, setDeployDone] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Semua');

  // Payment state
  const [paymentStatus, setPaymentStatus] = useState<'checking' | 'paid' | 'unpaid' | 'free'>('checking');
  const [paymentEmail, setPaymentEmail] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  const filteredAgents = useMemo(() => {
    if (activeFilter === 'Semua') return agents;
    return agents.filter(a => a.skill === activeFilter);
  }, [agents, activeFilter]);

  // Elapsed timer for thinking animation
  useEffect(() => {
    if (running) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(prev => prev + 0.1), 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/agents');
      const data = await res.json();
      setAgents(data.agents || []);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  // Check payment status when selecting an agent
  const checkPaymentStatus = useCallback(async (agentId: string, price: number) => {
    if (!price || price === 0) { setPaymentStatus('free'); return; }
    setPaymentStatus('checking');
    try {
      const res = await fetch(`/api/v1/payments/check/${agentId}`);
      const data = await res.json();
      setPaymentStatus(data.paid ? 'paid' : 'unpaid');
    } catch {
      setPaymentStatus('paid'); // fail open
    }
  }, []);

  // Detect post-payment redirect (?paid=agent_id)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paidAgentId = params.get('paid');
    if (paidAgentId && agents.length > 0) {
      const agent = agents.find(a => a.id === paidAgentId);
      if (agent) {
        setSelectedAgent(agent);
        setPaymentStatus('paid');
        setView('run');
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [agents]);

  const handleRun = async () => {
    if (!selectedAgent || !runPrompt.trim()) return;
    setRunning(true);
    try {
      const res = await fetch(`/api/v1/agents/${selectedAgent.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: runPrompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Handle payment required
        if (res.status === 402) {
          setPaymentStatus('unpaid');
          alert('Pembayaran diperlukan sebelum menggunakan agent ini.');
          return;
        }
        throw new Error(data.error);
      }
      setRunResult(data.result);
      setView('result');
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Gagal menjalankan agent'}`);
    } finally {
      setRunning(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedAgent || !paymentEmail.trim()) return;
    setPaymentLoading(true);
    try {
      const res = await fetch('/api/v1/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: selectedAgent.id, email: paymentEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.free || data.already_paid) {
        setPaymentStatus('paid');
        return;
      }

      if (data.payment_url) {
        window.location.href = data.payment_url;
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Gagal membuat pembayaran'}`);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleDelete = async (agent: Agent) => {
    if (!confirm(`Yakin ingin menghapus agent "${agent.name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/agents/${agent.id}`, { method: 'DELETE' });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus agent');
      setAgents(prev => prev.filter(a => a.id !== agent.id));
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Gagal menghapus agent'}`);
    }
  };

  const handleDeploy = async () => {
    if (!dName || !dDesc || !dEmail || (!dPrompt && !dApiUrl)) return;
    setDeploying(true);
    try {
      const res = await fetch('/api/v1/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: dName, description: dDesc, skill: dSkill,
          price: Number(dPrice) || 0, owner_email: dEmail,
          system_prompt: dPrompt || undefined,
          external_api_url: dApiUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeployDone(true);
      setAgents(prev => [data.agent, ...prev]);
      setTimeout(() => {
        setDeployDone(false); setView('marketplace');
        setDName(''); setDDesc(''); setDEmail(''); setDPrompt(''); setDPrice('0'); setDApiUrl('');
      }, 2000);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Gagal deploy agent'}`);
    } finally {
      setDeploying(false);
    }
  };

  const navItems = [
    { id: 'marketplace', label: 'Marketplace' },
    { id: 'deploy', label: '+ Deploy Agent' },
  ] as const;

  return (
    <>
      <style>{FONT}</style>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: `${T.bg}e0`, backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${T.border}`,
        padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0', marginRight: 40 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: T.accent, display: 'grid', placeItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5" stroke="white" strokeWidth="2" />
              <path d="M7 4v3l2 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, color: T.heading, letterSpacing: '-0.02em' }}>
            FlowMind<span style={{ color: T.accentLight }}>.ai</span>
          </span>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setView(item.id as View)} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 13,
              background: view === item.id ? T.accentGlow : 'transparent',
              color: view === item.id ? T.accentLight : T.muted,
              borderBottom: view === item.id ? `2px solid ${T.accent}` : '2px solid transparent',
              transition: 'all 0.15s',
            }}>
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.green, boxShadow: `0 0 6px ${T.green}` }} />
          <span style={{ fontSize: 11, color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>{agents.length} agents live</span>
        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main style={{ maxWidth: 1140, margin: '0 auto', padding: '40px 24px', minHeight: 'calc(100vh - 61px)' }}>
        <AnimatePresence mode="wait">

          {/* ══════ MARKETPLACE ══════ */}
          {view === 'marketplace' && (
            <motion.div key="marketplace" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
              style={{ position: 'relative' }}>

              {/* Animated background blobs for glassmorphism effect */}
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', top: '10%', left: '15%', width: 400, height: 400, borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
                  animation: 'blob-float-1 15s ease-in-out infinite', filter: 'blur(40px)',
                }} />
                <div style={{
                  position: 'absolute', top: '50%', right: '10%', width: 350, height: 350, borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(14,165,233,0.10) 0%, transparent 70%)',
                  animation: 'blob-float-2 18s ease-in-out infinite', filter: 'blur(40px)',
                }} />
                <div style={{
                  position: 'absolute', bottom: '10%', left: '40%', width: 300, height: 300, borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
                  animation: 'blob-float-1 20s ease-in-out infinite reverse', filter: 'blur(40px)',
                }} />
              </div>

              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* Hero Section with glassmorphism */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  style={{
                    marginBottom: 48, maxWidth: 700, padding: '40px 36px', borderRadius: 24,
                    background: T.glass, backdropFilter: T.glassBlur, WebkitBackdropFilter: T.glassBlur as string,
                    border: `1px solid ${T.glassBorder}`,
                  }}
                >
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px',
                    borderRadius: 99, background: `linear-gradient(135deg, ${T.accent}25, ${T.accentGlow})`,
                    border: `1px solid ${T.accent}40`, fontSize: 11, color: T.accentLight,
                    fontFamily: "'JetBrains Mono', monospace", marginBottom: 20, letterSpacing: '0.05em',
                  }}>
                    <span style={{ animation: 'thinking-pulse 2s ease-in-out infinite' }}>⚡</span> AI AGENT MARKETPLACE
                  </div>
                  <h1 style={{
                    fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 800, color: T.heading,
                    lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 16,
                  }}>
                    Sewa AI Agent<br />
                    <span style={{
                      background: `linear-gradient(135deg, ${T.accentLight}, ${T.accent}, #0ea5e9)`,
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}>siap pakai.</span>
                  </h1>
                  <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7, maxWidth: 500 }}>
                    Pilih AI agent dengan skill yang kamu butuhkan. Jalankan langsung, hasil instan. Atau deploy agent kamu sendiri ke marketplace.
                  </p>

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
                    {[
                      { label: 'Agents Live', value: agents.length, icon: '🤖' },
                      { label: 'Total Runs', value: agents.reduce((s, a) => s + (a.run_count || 0), 0), icon: '⚡' },
                      { label: 'Categories', value: new Set(agents.map(a => a.skill)).size, icon: '📦' },
                    ].map((stat, i) => (
                      <div key={i} style={{
                        padding: '10px 18px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.glassBorder}`,
                      }}>
                        <div style={{ fontSize: 11, color: T.muted, fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>
                          {stat.icon} {stat.label}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: T.heading }}>{stat.value}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Filter pills */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
                  {['Semua', ...Object.keys(SKILL_META)].map(s => {
                    const meta = SKILL_META[s];
                    const isActive = activeFilter === s || (s === 'Semua' && activeFilter === 'Semua');
                    return (
                      <motion.button key={s} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => setActiveFilter(s)}
                        style={{
                          padding: '7px 18px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
                          border: isActive ? `1px solid ${meta ? meta.color : T.accentLight}` : `1px solid ${T.glassBorder}`,
                          color: isActive ? (meta ? meta.color : T.accentLight) : T.muted,
                          background: isActive ? `${meta ? meta.color : T.accent}20` : T.glass,
                          backdropFilter: T.glassBlur, WebkitBackdropFilter: T.glassBlur as string,
                          fontWeight: isActive ? 600 : 500,
                          fontFamily: "'Inter', sans-serif",
                          transition: 'all 0.2s',
                          boxShadow: isActive ? `0 0 20px ${meta ? meta.color : T.accent}15` : 'none',
                        }}
                      >
                        {meta ? `${meta.icon} ${meta.label}` : s}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Agent grid */}
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><Spinner /></div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                    {filteredAgents.map((agent, i) => {
                      const skillMeta = SKILL_META[agent.skill] || SKILL_META['custom'];
                      return (
                        <motion.div key={agent.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                        >
                          <div className="glass-card" style={{ padding: 26 }}>
                            {/* Skill accent glow at top */}
                            <div style={{
                              position: 'absolute', top: 0, left: '20%', right: '20%', height: 2,
                              background: `linear-gradient(90deg, transparent, ${skillMeta.color}60, transparent)`,
                            }} />

                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Badge skill={agent.skill} />
                                {agent.external_api_url && (
                                  <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                                    background: 'rgba(14, 165, 233, 0.12)', border: '1px solid rgba(14, 165, 233, 0.3)',
                                    color: '#38bdf8', fontFamily: "'JetBrains Mono', monospace",
                                  }}>
                                    🔗 External
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  padding: '3px 10px', borderRadius: 99,
                                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.glassBorder}`,
                                  fontSize: 11, color: T.muted, fontFamily: "'JetBrains Mono', monospace",
                                }}>
                                  ▶ {agent.run_count}
                                </div>
                                <DeleteBtn onClick={(e) => { e.stopPropagation(); handleDelete(agent); }} />
                              </div>
                            </div>

                            <h3 style={{ fontSize: 18, fontWeight: 700, color: T.heading, marginBottom: 8, letterSpacing: '-0.01em' }}>
                              {agent.name}
                            </h3>
                            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.7, marginBottom: 22, minHeight: 60 }}>
                              {agent.description}
                            </p>

                            <div style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              paddingTop: 14, borderTop: `1px solid ${T.glassBorder}`,
                            }}>
                              <div>
                                <div style={{ fontSize: 10, color: T.muted, fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>HARGA</div>
                                <span style={{
                                  fontSize: 18, fontWeight: 700,
                                  color: agent.price === 0 ? T.green : T.heading,
                                }}>
                                  {fmtPrice(agent.price)}
                                </span>
                              </div>
                              <Btn variant="outline" onClick={() => { setSelectedAgent(agent); setRunPrompt(''); checkPaymentStatus(agent.id, agent.price); setView('run'); }}>
                                Gunakan →
                              </Btn>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}

                    {/* Deploy CTA card — glassmorphism style */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: filteredAgents.length * 0.06 + 0.1 }}
                    >
                      <div className="glass-card" onClick={() => setView('deploy')} style={{
                        padding: 28, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        minHeight: 260, textAlign: 'center', gap: 16,
                        border: `1px dashed ${T.accent}35`,
                        background: `linear-gradient(135deg, ${T.accent}08, transparent)`,
                      }}>
                        <div style={{
                          width: 56, height: 56, borderRadius: 16,
                          background: `linear-gradient(135deg, ${T.accent}30, ${T.accentGlow})`,
                          border: `1px solid ${T.accent}50`,
                          display: 'grid', placeItems: 'center', fontSize: 24,
                        }}>⚡</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16, color: T.accentLight, marginBottom: 6 }}>
                            Deploy Agent Kamu
                          </div>
                          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
                            Buat AI agent kustom dan<br />monetize di marketplace
                          </div>
                        </div>
                        <div style={{
                          padding: '8px 20px', borderRadius: 10,
                          border: `1px solid ${T.accent}40`, color: T.accentLight,
                          fontSize: 13, fontWeight: 600,
                        }}>
                          + Deploy Sekarang
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ══════ RUN AGENT ══════ */}
          {view === 'run' && selectedAgent && (
            <motion.div key="run" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
              style={{ maxWidth: 640, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                <button onClick={() => setView('marketplace')} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 20 }}>←</button>
                <div>
                  <div style={{ fontSize: 11, color: T.muted, fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>GUNAKAN AGENT</div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: T.heading }}>{selectedAgent.name}</h2>
                </div>
                <div style={{ marginLeft: 'auto' }}><Badge skill={selectedAgent.skill} /></div>
              </div>

              <Card style={{ padding: 28 }}>
                {running ? (
                  <ThinkingAnimation elapsed={elapsed} />
                ) : paymentStatus === 'checking' ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <Spinner />
                    <p style={{ color: T.muted, marginTop: 12, fontSize: 13 }}>Mengecek status pembayaran...</p>
                  </div>
                ) : paymentStatus === 'unpaid' ? (
                  /* ── Payment Gate ── */
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div style={{
                      textAlign: 'center', padding: '20px 0 24px',
                      borderBottom: `1px solid ${T.border}`, marginBottom: 24,
                    }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
                        background: `linear-gradient(135deg, ${T.yellow}20, ${T.yellow}08)`,
                        border: `1px solid ${T.yellow}30`,
                        display: 'grid', placeItems: 'center', fontSize: 24,
                      }}>💳</div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: T.heading, marginBottom: 8 }}>
                        Pembayaran Diperlukan
                      </h3>
                      <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
                        Agent ini berbayar. Selesaikan pembayaran untuk mulai menggunakan.
                      </p>
                    </div>

                    <div style={{
                      padding: 20, borderRadius: 14,
                      background: 'rgba(251, 191, 36, 0.05)',
                      border: '1px solid rgba(251, 191, 36, 0.15)',
                      marginBottom: 20,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: T.muted }}>Agent</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.heading }}>{selectedAgent.name}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: T.muted }}>Harga</span>
                        <span style={{ fontSize: 18, fontWeight: 700, color: T.yellow }}>{fmtPrice(selectedAgent.price)}</span>
                      </div>
                    </div>

                    <Input label="EMAIL UNTUK BUKTI PEMBAYARAN" value={paymentEmail} onChange={setPaymentEmail}
                      type="email" placeholder="email@kamu.com" />

                    <div style={{ marginTop: 8 }}>
                      <Btn fullWidth onClick={handlePayment} disabled={paymentLoading || !paymentEmail.trim()}>
                        {paymentLoading ? <><Spinner /> Memproses...</> : '💳 Bayar via Mayar'}
                      </Btn>
                    </div>

                    <p style={{ fontSize: 11, color: T.muted, textAlign: 'center', marginTop: 12, lineHeight: 1.6 }}>
                      Pembayaran diproses oleh <strong style={{ color: T.text }}>Mayar</strong>. Setelah berhasil, kamu akan diarahkan kembali ke FlowMind.
                    </p>
                  </motion.div>
                ) : (
                  /* ── Run Form (paid or free) ── */
                  <>
                    <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 24, paddingBottom: 20, borderBottom: `1px solid ${T.border}` }}>
                      {selectedAgent.description}
                    </p>

                    <Input label="DESKRIPSI TUGAS / PROMPT"
                      value={runPrompt} onChange={setRunPrompt} as="textarea"
                      placeholder={
                        selectedAgent.skill === 'market-research' ? 'Contoh: Analisis pasar EV di Indonesia untuk tahun 2025...' :
                          selectedAgent.skill === 'copywriting' ? 'Contoh: Buat caption Instagram untuk produk skincare halal...' :
                            selectedAgent.skill === 'data-analysis' ? 'Contoh: Analisis data penjualan Q1 vs Q2 berikut: ...' :
                              selectedAgent.skill === 'seo-writing' ? 'Contoh: Tulis artikel SEO tentang "investasi saham pemula"...' :
                                'Deskripsikan tugas yang ingin dikerjakan agent...'
                      }
                    />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      <div style={{ fontSize: 13, color: T.muted }}>
                        Harga: <strong style={{ color: selectedAgent.price === 0 ? T.green : T.heading }}>{fmtPrice(selectedAgent.price)}</strong>
                        {selectedAgent.price > 0 && <span style={{ color: T.green, marginLeft: 8, fontSize: 11 }}>✅ Dibayar</span>}
                      </div>
                      <Btn onClick={handleRun} disabled={!runPrompt.trim() || running}>
                        ▶ Jalankan Agent
                      </Btn>
                    </div>
                  </>
                )}
              </Card>
            </motion.div>
          )}

          {/* ══════ RESULT ══════ */}
          {view === 'result' && runResult && selectedAgent && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <ResultView
                result={runResult}
                agentName={selectedAgent.name}
                skill={selectedAgent.skill}
                onBack={() => { setView('run'); setRunResult(null); }}
              />
              <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
                <Btn variant="ghost" onClick={() => { setView('marketplace'); setRunResult(null); }}>← Kembali ke Marketplace</Btn>
                <Btn variant="outline" onClick={() => { setRunResult(null); setView('run'); }}>Jalankan Lagi</Btn>
              </div>
            </motion.div>
          )}

          {/* ══════ DEPLOY ══════ */}
          {view === 'deploy' && (
            <motion.div key="deploy" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
              style={{ maxWidth: 640, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                <button onClick={() => setView('marketplace')} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 20 }}>←</button>
                <div>
                  <div style={{ fontSize: 11, color: T.muted, fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>AGENT BUILDER</div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: T.heading }}>Deploy Agent Kamu</h2>
                </div>
              </div>

              {deployDone ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  style={{ textAlign: 'center', padding: 60 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                  <h3 style={{ fontSize: 22, fontWeight: 700, color: T.heading, marginBottom: 8 }}>Agent berhasil dideploy!</h3>
                  <p style={{ color: T.muted }}>Agent kamu sudah live di marketplace.</p>
                </motion.div>
              ) : (
                <Card style={{ padding: 28 }}>
                  <Input label="NAMA AGENT" value={dName} onChange={setDName} placeholder="e.g. Email Outreach Pro" />
                  <Input label="DESKRIPSI" value={dDesc} onChange={setDDesc} as="textarea" placeholder="Jelaskan apa yang bisa agent kamu lakukan..." />

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: T.muted, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 6 }}>KATEGORI SKILL</div>
                    <select value={dSkill} onChange={e => setDSkill(e.target.value)} style={{
                      width: '100%', padding: '11px 14px', background: T.bg,
                      border: `1px solid ${T.border}`, borderRadius: 10, color: T.text,
                      fontSize: 14, fontFamily: "'Inter', sans-serif",
                    }}>
                      {Object.entries(SKILL_META).map(([k, v]) => (
                        <option key={k} value={k}>{v.icon} {v.label}</option>
                      ))}
                    </select>
                  </div>

                  <Input label="HARGA (Rp, 0 = Gratis)" value={dPrice} onChange={setDPrice} type="number" placeholder="25000" />
                  <Input label="EMAIL KAMU" value={dEmail} onChange={setDEmail} type="email" placeholder="kamu@email.com" />
                  <Input label={`SYSTEM PROMPT (Instruksi agent)${dApiUrl ? ' — Opsional untuk External' : ''}`} value={dPrompt} onChange={setDPrompt} as="textarea"
                    placeholder={`Anda adalah [peran]. Ketika menerima tugas, [instruksi spesifik].
WAJIB jawab dengan JSON murni tanpa markdown.
Format: { "key": "value", ... }`} />

                  {/* ── External API Section ── */}
                  <div style={{
                    marginTop: 8, marginBottom: 16, padding: 20, borderRadius: 14,
                    background: 'rgba(14, 165, 233, 0.05)',
                    border: '1px solid rgba(14, 165, 233, 0.15)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: 'rgba(14, 165, 233, 0.15)',
                        display: 'grid', placeItems: 'center', fontSize: 14,
                      }}>🔗</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#38bdf8' }}>Integrasi API Eksternal</div>
                        <div style={{ fontSize: 11, color: T.muted }}>Hubungkan AI agent self-hosted kamu</div>
                      </div>
                    </div>

                    <Input label="EXTERNAL API ENDPOINT (OPSIONAL)" value={dApiUrl} onChange={setDApiUrl}
                      placeholder="https://your-api.com/v1/agent/run" />

                    {/* Format standard instructions */}
                    <div style={{
                      marginTop: 12, padding: 14, borderRadius: 10,
                      background: T.bg, border: `1px solid ${T.border}`,
                    }}>
                      <div style={{ fontSize: 10, color: T.accentLight, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 8 }}>
                        ℹ️ FORMAT STANDARD API
                      </div>
                      <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.8 }}>
                        FlowMind akan mengirim <code style={{ color: T.accentLight, background: `${T.accent}20`, padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>POST</code> ke URL kamu dengan body:
                      </div>
                      <pre style={{
                        marginTop: 8, padding: 12, borderRadius: 8,
                        background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.border}`,
                        fontSize: 10, color: '#a78bfa', fontFamily: "'JetBrains Mono', monospace",
                        lineHeight: 1.7, overflowX: 'auto',
                      }}>
                        {`// Request dari FlowMind:
{ "prompt": "input user", "agent_id": "uuid" }

// Response yang HARUS dikembalikan (JSON):
{
  "summary": "Ringkasan hasil",
  "data": { ... },
  "insights": ["item 1", "item 2"]
}`}
                      </pre>
                      <div style={{ marginTop: 8, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                        ⚠️ API harus return <strong style={{ color: T.text }}>JSON valid</strong>. Timeout: 30 detik.
                        Header: <code style={{ color: T.accentLight, fontSize: 9 }}>X-FlowMind-Source: flowmind.ai</code>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 4 }}>
                    <Btn fullWidth onClick={handleDeploy} disabled={deploying || !dName || !dDesc || !dEmail || (!dPrompt && !dApiUrl)}>
                      {deploying ? <><Spinner /> Mendeploy...</> : '⚡ Deploy ke Marketplace'}
                    </Btn>
                  </div>
                </Card>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </>
  );
}
