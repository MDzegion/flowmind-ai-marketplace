import React from 'react';
import { motion } from 'motion/react';
import { T, SKILL_META } from '../theme';

export function Badge({ skill }: { skill: string }) {
    const meta = SKILL_META[skill] || SKILL_META['custom'];
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
            background: `${meta.color}18`, border: `1px solid ${meta.color}40`,
            color: meta.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.03em',
        }}>
            {meta.icon} {meta.label}
        </span>
    );
}

export function Card({ children, style, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
    return (
        <div onClick={onClick} style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 16, position: 'relative', overflow: 'hidden',
            cursor: onClick ? 'pointer' : 'default',
            transition: 'border-color 0.2s, transform 0.2s',
            ...style,
        }}
            onMouseEnter={e => { if (onClick) { (e.currentTarget as HTMLDivElement).style.borderColor = `${T.accentLight}50`; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; } }}
            onMouseLeave={e => { if (onClick) { (e.currentTarget as HTMLDivElement).style.borderColor = T.border; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; } }}
        >
            <div style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />
            {children}
        </div>
    );
}

export function Input({ label, value, onChange, placeholder, type = 'text', as = 'input' }: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; type?: string; as?: 'input' | 'textarea' | 'select';
    children?: React.ReactNode;
}) {
    const shared: React.CSSProperties = {
        width: '100%', padding: '11px 14px', background: T.bg,
        border: `1px solid ${T.border}`, borderRadius: 10, color: T.text,
        fontSize: 14, fontFamily: "'Inter', sans-serif", resize: 'vertical' as const,
        transition: 'border-color 0.2s',
    };
    return (
        <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: T.muted, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
            {as === 'textarea'
                ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={4} style={shared}
                    onFocus={e => e.currentTarget.style.borderColor = T.accentLight}
                    onBlur={e => e.currentTarget.style.borderColor = T.border} />
                : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={shared}
                    onFocus={e => e.currentTarget.style.borderColor = T.accentLight}
                    onBlur={e => e.currentTarget.style.borderColor = T.border} />
            }
        </div>
    );
}

export function Spinner() {
    return (
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ width: 20, height: 20, border: `2px solid ${T.border}`, borderTopColor: T.accentLight, borderRadius: '50%' }} />
    );
}

const thinkingKeyframes = `
@keyframes thinking-pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}
@keyframes thinking-orbit {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes thinking-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@keyframes thinking-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(124,58,237,0.2), 0 0 60px rgba(124,58,237,0.05); }
  50% { box-shadow: 0 0 30px rgba(124,58,237,0.4), 0 0 80px rgba(124,58,237,0.15); }
}
@keyframes thinking-bar {
  0% { width: 0%; }
  100% { width: 100%; }
}
`;

const thinkingPhrases = [
    '🧠 Menganalisis permintaan...',
    '⚡ Memproses data...',
    '🔍 Mencari insight...',
    '📊 Menyusun hasil...',
    '💡 Membuat rekomendasi...',
    '✨ Menyempurnakan output...',
];

export function ThinkingAnimation({ elapsed }: { elapsed: number }) {
    const phraseIndex = Math.min(Math.floor(elapsed / 3), thinkingPhrases.length - 1);
    const dots = '.'.repeat((Math.floor(elapsed * 2) % 3) + 1);

    return (
        <>
            <style>{thinkingKeyframes}</style>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '48px 24px', gap: 28,
                }}
            >
                {/* Animated brain with orbit ring */}
                <div style={{ position: 'relative', width: 100, height: 100 }}>
                    {/* Glow background */}
                    <div style={{
                        position: 'absolute', inset: -10, borderRadius: '50%',
                        animation: 'thinking-glow 2s ease-in-out infinite',
                    }} />
                    {/* Orbit ring */}
                    <div style={{
                        position: 'absolute', inset: -6, borderRadius: '50%',
                        border: `2px dashed ${T.accent}40`,
                        animation: 'thinking-orbit 4s linear infinite',
                    }}>
                        <div style={{
                            position: 'absolute', top: -4, left: '50%', marginLeft: -4,
                            width: 8, height: 8, borderRadius: '50%', background: T.accentLight,
                            boxShadow: `0 0 10px ${T.accentLight}`,
                        }} />
                    </div>
                    {/* Brain icon */}
                    <div style={{
                        width: 100, height: 100, borderRadius: '50%',
                        background: `linear-gradient(135deg, ${T.accent}30, ${T.accentGlow})`,
                        border: `2px solid ${T.accent}60`,
                        display: 'grid', placeItems: 'center', fontSize: 40,
                        animation: 'thinking-float 2.5s ease-in-out infinite',
                    }}>
                        🧠
                    </div>
                </div>

                {/* Status text */}
                <div style={{ textAlign: 'center' }}>
                    <motion.div
                        key={phraseIndex}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        style={{
                            fontSize: 16, fontWeight: 600, color: T.heading,
                            marginBottom: 8,
                        }}
                    >
                        {thinkingPhrases[phraseIndex]}
                    </motion.div>
                    <div style={{
                        fontSize: 13, color: T.muted,
                        fontFamily: "'JetBrains Mono', monospace",
                    }}>
                        Agent sedang berpikir{dots}
                    </div>
                </div>

                {/* Animated dots */}
                <div style={{ display: 'flex', gap: 8 }}>
                    {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: T.accentLight,
                            animation: `thinking-pulse 1.5s ease-in-out ${i * 0.2}s infinite`,
                        }} />
                    ))}
                </div>

                {/* Timer */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 16px', borderRadius: 99,
                    background: T.surface, border: `1px solid ${T.border}`,
                    fontSize: 12, color: T.muted,
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: T.green,
                        boxShadow: `0 0 8px ${T.green}`,
                        animation: 'thinking-pulse 1s ease-in-out infinite',
                    }} />
                    {elapsed.toFixed(1)}s elapsed
                </div>
            </motion.div>
        </>
    );
}

export function DeleteBtn({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
    return (
        <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.15, background: 'rgba(248,113,113,0.2)' }}
            whileTap={{ scale: 0.9 }}
            style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'rgba(248,113,113,0.08)',
                border: `1px solid rgba(248,113,113,0.2)`,
                display: 'grid', placeItems: 'center',
                cursor: 'pointer', transition: 'all 0.2s',
                color: T.red, fontSize: 14, padding: 0,
            }}
            title="Hapus agent"
        >
            🗑
        </motion.button>
    );
}

export function Btn({ children, onClick, disabled, variant = 'primary', fullWidth }: {
    children: React.ReactNode; onClick?: () => void; disabled?: boolean;
    variant?: 'primary' | 'ghost' | 'outline'; fullWidth?: boolean;
}) {
    const styles: Record<string, React.CSSProperties> = {
        primary: { background: T.accent, color: '#fff', border: 'none' },
        ghost: { background: 'transparent', color: T.muted, border: `1px solid ${T.border}` },
        outline: { background: T.accentGlow, color: T.accentLight, border: `1px solid ${T.accent}50` },
    };
    return (
        <motion.button onClick={onClick} disabled={disabled}
            whileHover={{ scale: disabled ? 1 : 1.02 }} whileTap={{ scale: disabled ? 1 : 0.97 }}
            style={{
                padding: '11px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14,
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: fullWidth ? '100%' : 'auto', fontFamily: "'Inter', sans-serif",
                transition: 'opacity 0.2s', ...styles[variant],
            }}>
            {children}
        </motion.button>
    );
}
