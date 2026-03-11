import React from 'react';
import { motion } from 'motion/react';
import { T } from '../theme';
import { Badge, Card } from './ui';
import { fmt } from '../utils';

export function ResultView({ result, agentName, skill, onBack }: {
    result: Record<string, unknown>; agentName: string; skill: string; onBack: () => void;
}) {
    const renderValue = (v: unknown): React.ReactNode => {
        if (Array.isArray(v)) return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {v.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{
                            width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                            background: `${T.accent}18`, border: `1px solid ${T.accent}35`,
                            display: 'grid', placeItems: 'center', fontSize: 9, color: T.accentLight,
                            fontFamily: "'JetBrains Mono', monospace", fontWeight: 600
                        }}>
                            {String(i + 1).padStart(2, '0')}
                        </div>
                        <p style={{ fontSize: 13, color: T.text, lineHeight: 1.65 }}>{String(item)}</p>
                    </div>
                ))}
            </div>
        );
        if (typeof v === 'object' && v !== null) return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(v as Record<string, unknown>).map(([k, val]) => (
                    <div key={k}>
                        <div style={{ fontSize: 10, color: T.muted, fontFamily: "'JetBrains Mono', monospace", marginBottom: 3 }}>{k.toUpperCase()}</div>
                        <div style={{ fontSize: 13, color: T.text }}>{String(val)}</div>
                    </div>
                ))}
            </div>
        );
        if (typeof v === 'number') return (
            <span style={{ fontSize: 22, fontWeight: 700, color: T.heading }}>{fmt(v as number)}</span>
        );
        return <p style={{ fontSize: 14, color: T.text, lineHeight: 1.7 }}>{String(v)}</p>;
    };

    const sectionColor = (key: string) => {
        if (['insights', 'recommendations', 'patterns', 'keywords', 'outline', 'hashtags'].includes(key)) return T.accentLight;
        if (['opportunities', 'key_metrics'].includes(key)) return T.green;
        if (['risks'].includes(key)) return T.red;
        return T.yellow;
    };

    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>←</button>
                <div>
                    <div style={{ fontSize: 11, color: T.muted, fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>HASIL EKSEKUSI</div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: T.heading }}>{agentName}</h2>
                </div>
                <div style={{ marginLeft: 'auto' }}><Badge skill={skill} /></div>
            </div>

            {/* Plain text result */}
            {'text' in result ? (
                <Card style={{ padding: 24 }}>
                    <p style={{ fontSize: 14, color: T.text, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{result.text as string}</p>
                </Card>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                    {Object.entries(result).map(([key, value]) => (
                        <Card key={key} style={{ padding: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: sectionColor(key) }} />
                                <div style={{ fontSize: 10, color: T.muted, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', fontWeight: 600 }}>
                                    {key.replace(/_/g, ' ').toUpperCase()}
                                </div>
                            </div>
                            {renderValue(value)}
                        </Card>
                    ))}
                </div>
            )}
        </motion.div>
    );
}
