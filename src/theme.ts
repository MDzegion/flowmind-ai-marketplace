export const T = {
    bg: '#07090e',
    surface: '#0d1117',
    surface2: '#111827',
    border: 'rgba(255,255,255,0.07)',
    accent: '#7c3aed',       // purple
    accentGlow: 'rgba(124,58,237,0.15)',
    accentLight: '#a78bfa',
    muted: '#4b5563',
    text: '#c9d1e0',
    heading: '#f0f4ff',
    green: '#34d399',
    yellow: '#fbbf24',
    red: '#f87171',
    // Glassmorphism tokens
    glass: 'rgba(13, 17, 23, 0.6)',
    glassHover: 'rgba(13, 17, 23, 0.75)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    glassBorderHover: 'rgba(167, 139, 250, 0.3)',
    glassBlur: 'blur(20px)',
};

export const SKILL_META: Record<string, { label: string; color: string; icon: string }> = {
    'market-research': { label: 'Market Research', color: '#7c3aed', icon: '📊' },
    'copywriting': { label: 'Copywriting', color: '#0ea5e9', icon: '✍️' },
    'data-analysis': { label: 'Data Analysis', color: '#10b981', icon: '📈' },
    'seo-writing': { label: 'SEO Writing', color: '#f59e0b', icon: '🔍' },
    'custom': { label: 'Custom', color: '#ec4899', icon: '⚡' },
};

export const FONT = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: ${T.bg}; font-family: 'Inter', sans-serif; }
::selection { background: ${T.accent}; color: #fff; }
input::placeholder, textarea::placeholder { color: ${T.muted}; }
input:focus, textarea:focus, select:focus { outline: none; }
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: ${T.bg}; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }

@keyframes blob-float-1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -50px) scale(1.1); }
  50% { transform: translate(-20px, 20px) scale(0.9); }
  75% { transform: translate(20px, 40px) scale(1.05); }
}
@keyframes blob-float-2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(-40px, 30px) scale(1.15); }
  50% { transform: translate(30px, -30px) scale(0.85); }
  75% { transform: translate(-10px, -40px) scale(1.1); }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.glass-card {
  background: ${T.glass};
  backdrop-filter: ${T.glassBlur};
  -webkit-backdrop-filter: ${T.glassBlur};
  border: 1px solid ${T.glassBorder};
  border-radius: 20px;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}
.glass-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
}
.glass-card:hover {
  background: ${T.glassHover};
  border-color: ${T.glassBorderHover};
  transform: translateY(-4px);
  box-shadow: 0 20px 60px rgba(124, 58, 237, 0.15), 0 0 40px rgba(124, 58, 237, 0.05);
}
`;

