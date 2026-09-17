import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// ---------------------------------------------------------------------------
// 6-Digit Passcode Protection Screen
// ---------------------------------------------------------------------------
function PasscodeGate({ onUnlock }) {
  const [pinDigits, setPinDigits] = useState(['', '', '', '', '', '']);
  const [errorMsg, setErrorMsg] = useState('');
  const [shake, setShake] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [pinChangeNotice, setPinChangeNotice] = useState('');
  const inputRefs = useRef([]);

  const getStoredPin = () => {
    return localStorage.getItem('ad_analyzer_pin') || import.meta.env.VITE_APP_PIN || '123456';
  };

  const verifyCode = (code) => {
    const validPin = getStoredPin();
    if (code === validPin) {
      sessionStorage.setItem('ad_analyzer_auth', 'true');
      onUnlock();
    } else {
      setErrorMsg('Incorrect 6-digit code. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPinDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        if (inputRefs.current[0]) inputRefs.current[0].focus();
      }, 50);
    }
  };

  const handleDigitChange = (index, value) => {
    const char = value.slice(-1);
    if (char && !/^\d$/.test(char)) return;

    const newDigits = [...pinDigits];
    newDigits[index] = char;
    setPinDigits(newDigits);
    setErrorMsg('');

    if (char && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }

    const completeCode = newDigits.join('');
    if (completeCode.length === 6 && !newDigits.includes('')) {
      verifyCode(completeCode);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!pinDigits[index] && index > 0 && inputRefs.current[index - 1]) {
        inputRefs.current[index - 1].focus();
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setPinDigits(newDigits);

    if (pasted.length === 6) {
      verifyCode(pasted);
    } else if (inputRefs.current[pasted.length]) {
      inputRefs.current[pasted.length].focus();
    }
  };

  const handleKeypadPress = (val) => {
    if (val === 'clear') {
      setPinDigits(['', '', '', '', '', '']);
      setErrorMsg('');
      if (inputRefs.current[0]) inputRefs.current[0].focus();
      return;
    }
    if (val === 'delete') {
      const lastIndex = pinDigits.map(d => Boolean(d)).lastIndexOf(true);
      if (lastIndex >= 0) {
        const newDigits = [...pinDigits];
        newDigits[lastIndex] = '';
        setPinDigits(newDigits);
        if (inputRefs.current[lastIndex]) inputRefs.current[lastIndex].focus();
      }
      return;
    }

    const firstEmptyIndex = pinDigits.findIndex(d => !d);
    if (firstEmptyIndex !== -1) {
      const newDigits = [...pinDigits];
      newDigits[firstEmptyIndex] = val;
      setPinDigits(newDigits);

      if (firstEmptyIndex < 5 && inputRefs.current[firstEmptyIndex + 1]) {
        inputRefs.current[firstEmptyIndex + 1].focus();
      }

      if (firstEmptyIndex === 5) {
        verifyCode(newDigits.join(''));
      }
    }
  };

  const handleChangePinSubmit = (e) => {
    e.preventDefault();
    const currentValid = getStoredPin();
    if (currentPinInput.trim() !== currentValid) {
      setPinChangeNotice('Current code does not match.');
      return;
    }
    if (!/^\d{6}$/.test(newPinInput.trim())) {
      setPinChangeNotice('New code must be exactly 6 numeric digits.');
      return;
    }
    localStorage.setItem('ad_analyzer_pin', newPinInput.trim());
    setPinChangeNotice('Access code updated successfully!');
    setTimeout(() => {
      setShowChangePin(false);
      setPinChangeNotice('');
      setCurrentPinInput('');
      setNewPinInput('');
    }, 1200);
  };

  return (
    <div className="pin-gate-screen">
      <div className={`pin-card ${shake ? 'pin-shake' : ''}`}>
        <div className="pin-header">
          <div className="logo-badge pin-logo">
            <span className="logo-spark">✨</span>
          </div>
          <h2 className="pin-title">Ad Analyzer</h2>
          <p className="pin-subtitle">Enter your 6-digit access code</p>
        </div>

        {/* 6 Digit Input Row */}
        <div className="pin-inputs-row" onPaste={handlePaste}>
          {pinDigits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              type="password"
              inputMode="numeric"
              maxLength={1}
              autoComplete="off"
              className={`pin-box ${digit ? 'filled' : ''}`}
              value={digit}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              autoFocus={i === 0}
            />
          ))}
        </div>

        {errorMsg && <div className="pin-error-toast">{errorMsg}</div>}

        {/* Mobile/Touch Keypad */}
        <div className="pin-keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              className="pin-key"
              onClick={() => handleKeypadPress(String(num))}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            className="pin-key pin-key-fn"
            onClick={() => handleKeypadPress('clear')}
            title="Clear"
          >
            C
          </button>
          <button
            type="button"
            className="pin-key"
            onClick={() => handleKeypadPress('0')}
          >
            0
          </button>
          <button
            type="button"
            className="pin-key pin-key-fn"
            onClick={() => handleKeypadPress('delete')}
            title="Backspace"
          >
            ⌫
          </button>
        </div>

        {/* Footer info & Change Code */}
        <div className="pin-footer-links">
          <button
            type="button"
            className="pin-change-btn"
            onClick={() => setShowChangePin(true)}
          >
            ⚙️ Change 6-Digit Code
          </button>
          <span className="pin-default-hint">Default code: <code>123456</code></span>
        </div>

        {/* Change Pin Modal */}
        {showChangePin && (
          <div className="modal-backdrop" onClick={() => setShowChangePin(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>⚙️ Change Access Code</h3>
                <button type="button" className="close-btn" onClick={() => setShowChangePin(false)}>✕</button>
              </div>
              <form onSubmit={handleChangePinSubmit} className="modal-body">
                <p className="modal-desc">
                  Set a custom 6-digit numeric PIN to protect your Ad Analyzer workspace.
                </p>

                <div className="form-group">
                  <label className="input-label" htmlFor="currentPin">Current 6-Digit Code</label>
                  <input
                    id="currentPin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    className="url-field modal-field"
                    placeholder="Enter current code (e.g. 123456)"
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="input-label" htmlFor="newPin">New 6-Digit Code</label>
                  <input
                    id="newPin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    className="url-field modal-field"
                    placeholder="Enter new 6 digits (e.g. 849201)"
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value)}
                    required
                  />
                </div>

                {pinChangeNotice && (
                  <div className={pinChangeNotice.includes('successfully') ? 'copy-notice' : 'error-toast'}>
                    {pinChangeNotice}
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowChangePin(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Update Code
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ad Strategy Agent Constants & Helpers
// ---------------------------------------------------------------------------
const AVAILABLE_PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'LinkedIn'];

const SCRIPT_LANGUAGES = [
  {
    id: 'tanglish',
    label: 'Tanglish (Conversational Tamil)',
    badge: 'Tanglish',
    flag: '🇮🇳',
    hint: 'Colloquial Tamil dialogue in English script (e.g. "Neenga innum excel-la accounts panreengala? Stop panunga!"). High converting for IG Reels & Shorts.',
  },
  {
    id: 'tamil',
    label: 'Tamil (தமிழ்)',
    badge: 'தமிழ்',
    flag: '🇮🇳',
    hint: 'Authentic, natural spoken Tamil dialogue written in Tamil script for direct-response South Indian video ads.',
  },
  {
    id: 'english',
    label: 'English',
    badge: 'English',
    flag: '🌐',
    hint: 'Direct-response punchy English dialogue with tension, proof beats, and fast-paced hook retention.',
  },
  {
    id: 'hinglish',
    label: 'Hinglish (Conversational Hindi)',
    badge: 'Hinglish',
    flag: '🇮🇳',
    hint: 'Conversational Hindi dialogue written in English script (e.g. "Kya aap bhi client follow-ups se pareshan ho?").',
  },
  {
    id: 'hindi',
    label: 'Hindi (हिंदी)',
    badge: 'हिंदी',
    flag: '🇮🇳',
    hint: 'Spoken Hindi dialogue in Devanagari script for social video ads.',
  },
];

const PRESET_GOALS = [
  { id: 'Book Free Demo / Consultation Call', label: '📞 Book Free Demo / Call' },
  { id: 'Direct E-Commerce Purchase', label: '🛒 Direct Purchase' },
  { id: 'Free Trial / App Install', label: '📱 Free Trial / App' },
  { id: 'Lead Form / Instant Quote', label: '📝 Lead Form / Quote' },
  { id: 'Send WhatsApp / Direct Message', label: '💬 WhatsApp / DM' },
  { id: 'custom', label: '✏️ Custom CTA...' },
];

const SAMPLE_NICHES = [
  {
    label: '🏢 B2B SaaS for Indian Manufacturers',
    niche: 'B2B SaaS lead-gen campaign targeting Indian manufacturing unit owners with ERP/inventory automation',
    platforms: ['Facebook', 'LinkedIn', 'Instagram'],
    goal: 'Book Free Demo / Consultation Call',
    format: 'both',
  },
  {
    label: '❄️ Cold Plunge Tubs for Athletes',
    niche: 'High-end cold plunge ice bath tubs for home recovery, biohackers & CrossFit athletes',
    platforms: ['Instagram', 'TikTok', 'Facebook'],
    goal: 'Direct E-Commerce Purchase',
    format: 'both',
  },
  {
    label: '🦷 Invisalign / Dental Aligners',
    niche: 'Invisalign and invisible teeth aligners for young professionals and brides-to-be',
    platforms: ['Instagram', 'Facebook'],
    goal: 'Book Free Demo / Consultation Call',
    format: 'short-video',
  },
  {
    label: '👗 Eco-Friendly Activewear',
    niche: 'Sustainable recycled gym & yoga activewear for women wanting squat-proof comfort',
    platforms: ['Instagram', 'TikTok'],
    goal: 'Direct E-Commerce Purchase',
    format: 'static',
  },
  {
    label: '🏡 Real Estate Investor Mastermind',
    niche: 'High-ticket real estate investing mentorship & off-market deal acquisition software',
    platforms: ['Facebook', 'Instagram', 'YouTube'],
    goal: 'Book Free Demo / Consultation Call',
    format: 'both',
  },
];

function renderInlineMarkdown(text) {
  if (!text) return '';
  const parts = [];
  const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(<code key={match.index} className="inline-code">{token.slice(1, -1)}</code>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

function extractStrategySnippet(text, type) {
  if (!text) return '';
  if (type === 'summary') {
    const match = text.match(/(?:#+\s*)?(?:EXECUTIVE SUMMARY|Executive Summary)[\s\S]*$/i);
    if (match) return match[0].replace(/^(?:#+\s*)?(?:EXECUTIVE SUMMARY|Executive Summary)\s*/i, '').trim();
    return '';
  }
  if (type === 'prompt') {
    const s3Match = text.match(/(?:STAGE\s*3[\s\S]*?)(?:STAGE\s*4|$)/i);
    const searchTarget = s3Match ? s3Match[0] : text;
    const codeMatch = searchTarget.match(/```(?:text|markdown|prompt)?\s*([\s\S]*?)```/);
    if (codeMatch) return codeMatch[1].trim();
    const promptMatch = searchTarget.match(/(?:Prompt|prompt|Canva)[\s\S]*?(?:Headline variants|Short-video|$)/i);
    if (promptMatch) return promptMatch[0].trim();
    return '';
  }
  if (type === 'script') {
    const s3Match = text.match(/(?:STAGE\s*3[\s\S]*?)(?:STAGE\s*4|$)/i);
    const searchTarget = s3Match ? s3Match[0] : text;
    const scriptMatch = searchTarget.match(/(?:HOOK\s*\(0-3s\)[\s\S]*?(?:STAGE\s*4|$))/i);
    if (scriptMatch) return scriptMatch[0].trim();
    return '';
  }
  return '';
}

function FormattedStrategyMarkdown({ content, filterStage, onCopy }) {
  if (!content) return null;

  let targetContent = content;
  if (filterStage === 'summary') {
    const match = content.match(/(?:#+\s*)?(?:EXECUTIVE SUMMARY|Executive Summary)[\s\S]*$/i);
    if (match) targetContent = match[0];
  } else if (filterStage === 'stage1') {
    const match = content.match(/(?:STAGE\s*1[\s\S]*?)(?:STAGE\s*2|$)/i);
    if (match) targetContent = match[0];
  } else if (filterStage === 'stage2') {
    const match = content.match(/(?:STAGE\s*2[\s\S]*?)(?:STAGE\s*3|$)/i);
    if (match) targetContent = match[0];
  } else if (filterStage === 'stage3') {
    const match = content.match(/(?:STAGE\s*3[\s\S]*?)(?:STAGE\s*4|$)/i);
    if (match) targetContent = match[0];
  } else if (filterStage === 'stage4') {
    const match = content.match(/(?:STAGE\s*4[\s\S]*?)(?:EXECUTIVE SUMMARY|Executive Summary|$)/i);
    if (match) targetContent = match[0];
  }

  const lines = targetContent.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeBlockLines = [];
  let codeBlockLang = '';
  let inTable = false;
  let tableRows = [];

  const flushCode = (key) => {
    if (codeBlockLines.length > 0) {
      const codeText = codeBlockLines.join('\n');
      elements.push(
        <div key={key} className="strategy-code-box">
          <div className="strategy-code-header">
            <span className="code-lang-label">{codeBlockLang || 'Prompt / Screenplay / Code'}</span>
            <button
              type="button"
              className="btn-copy-sm"
              onClick={() => {
                navigator.clipboard.writeText(codeText);
                onCopy('Copied code block to clipboard!');
              }}
            >
              📋 Copy
            </button>
          </div>
          <pre className="strategy-code-pre">{codeText}</pre>
        </div>
      );
      codeBlockLines = [];
      codeBlockLang = '';
    }
  };

  const flushTable = (key) => {
    if (tableRows.length > 0) {
      const headerRow = tableRows[0];
      const dataRows = tableRows.slice(1).filter((r) => !r.every((c) => /^:?-+:?$/.test(c.trim())));
      elements.push(
        <div key={key} className="strategy-table-scroll">
          <table className="strategy-table">
            <thead>
              <tr>
                {headerRow.map((cell, idx) => (
                  <th key={idx}>{renderInlineMarkdown(cell.trim())}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{renderInlineMarkdown(cell.trim())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        flushCode(`code-${i}`);
        inCodeBlock = false;
      } else {
        if (inTable) {
          flushTable(`tbl-${i}`);
          inTable = false;
        }
        inCodeBlock = true;
        codeBlockLang = line.trim().replace(/^```/, '').trim();
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.trim().split('|').slice(1, -1);
      if (cells.length > 0) {
        inTable = true;
        tableRows.push(cells);
        continue;
      }
    } else if (inTable) {
      flushTable(`tbl-${i}`);
      inTable = false;
    }

    const trimmed = line.trim();

    if (/^(=+|-{3,}|\*{3,})$/.test(trimmed)) {
      elements.push(<hr key={`hr-${i}`} className="strategy-divider" />);
      continue;
    }

    if (trimmed.startsWith('#') || /^STAGE\s*[1-4]/i.test(trimmed) || /^EXECUTIVE\s*SUMMARY/i.test(trimmed)) {
      const level = trimmed.startsWith('####') ? 4 : (trimmed.startsWith('###') ? 3 : (trimmed.startsWith('##') ? 2 : (trimmed.startsWith('#') ? 1 : 2)));
      const cleanTitle = trimmed.replace(/^#+\s*/, '');

      let stageClass = '';
      let stageIcon = '📌';
      if (/STAGE\s*1/i.test(cleanTitle) || /GAP/i.test(cleanTitle)) {
        stageClass = 'stage-1-header';
        stageIcon = '🔍';
      } else if (/STAGE\s*2/i.test(cleanTitle) || /OFFER|HORMOZI|ICP|SEGMENTATION/i.test(cleanTitle)) {
        stageClass = 'stage-2-header';
        stageIcon = '💡';
      } else if (/STAGE\s*3/i.test(cleanTitle) || /CREATIVE|SCRIPT/i.test(cleanTitle)) {
        stageClass = 'stage-3-header';
        stageIcon = '🎨';
      } else if (/STAGE\s*4/i.test(cleanTitle) || /CAMPAIGN|BUDGET/i.test(cleanTitle)) {
        stageClass = 'stage-4-header';
        stageIcon = '📊';
      } else if (/EXECUTIVE\s*SUMMARY/i.test(cleanTitle)) {
        stageClass = 'exec-summary-header';
        stageIcon = '⚡';
      }

      elements.push(
        <div key={`head-${i}`} className={`strategy-heading-wrap ${stageClass}`}>
          <span className="heading-icon">{stageIcon}</span>
          {level === 1 && <h2 className="strategy-h1">{cleanTitle}</h2>}
          {level === 2 && <h3 className="strategy-h2">{cleanTitle}</h3>}
          {level >= 3 && <h4 className="strategy-h3">{cleanTitle}</h4>}
        </div>
      );
      continue;
    }

    if (trimmed.startsWith('>')) {
      elements.push(
        <blockquote key={`quote-${i}`} className="strategy-quote">
          {renderInlineMarkdown(trimmed.replace(/^>\s*/, ''))}
        </blockquote>
      );
      continue;
    }

    if (/^(\*|-|\d+\.)\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\*|-|\d+\.)\s+(.*)/);
      elements.push(
        <div key={`li-${i}`} className="strategy-list-item">
          <span className="list-bullet">{match[1]}</span>
          <span className="list-content">{renderInlineMarkdown(match[2])}</span>
        </div>
      );
      continue;
    }

    if (!trimmed) {
      elements.push(<div key={`space-${i}`} className="strategy-spacing"></div>);
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="strategy-p">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  }

  if (inCodeBlock) flushCode('code-final');
  if (inTable) flushTable('tbl-final');

  return elements;
}

function StrategyAgentSection({ apiHealth, customApiKey, API_BASE, onOpenKeyModal }) {
  // Input parameters
  const [strategyNiche, setStrategyNiche] = useState('');
  const [strategyPlatforms, setStrategyPlatforms] = useState(['Instagram', 'Facebook']);
  const [strategyGoal, setStrategyGoal] = useState('Book Free Demo / Consultation Call');
  const [strategyCustomGoal, setStrategyCustomGoal] = useState('');
  const [strategyFormat, setStrategyFormat] = useState('both');
  const [scriptLanguage, setScriptLanguage] = useState('tanglish');

  // Pipeline phases: 'setup' | 'gaps' | 'strategy'
  const [currentPhase, setCurrentPhase] = useState('setup');

  // Stage 1 Gaps state
  const [gapsList, setGapsList] = useState([]);
  const [selectedGapId, setSelectedGapId] = useState('');
  const [customGapText, setCustomGapText] = useState('');
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [moreGapsLoading, setMoreGapsLoading] = useState(false);

  // Strategy Execution state
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategyStageIndex, setStrategyStageIndex] = useState(0);
  const [strategyError, setStrategyError] = useState('');
  const [strategyResult, setStrategyResult] = useState('');
  const [strategyMeta, setStrategyMeta] = useState(null);
  const [activeStageFilter, setActiveStageFilter] = useState('all');
  const [copyNotice, setCopyNotice] = useState('');
  const [strategyHistory, setStrategyHistory] = useState(() => {
    try {
      const raw = localStorage.getItem('ad_strategy_history');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const notifyCopy = (msg) => {
    setCopyNotice(msg);
    setTimeout(() => setCopyNotice(''), 3000);
  };

  // Helper: Get active script language metadata
  const currentLangMeta = SCRIPT_LANGUAGES.find((l) => l.id === scriptLanguage) || SCRIPT_LANGUAGES[0];

  // Helper: Format intensity badge
  const renderIntensityBadge = (intensity) => {
    const raw = String(intensity || 'High').toLowerCase();
    let badgeClass = 'intensity-high';
    let label = intensity || 'High';
    if (raw.includes('extreme')) {
      badgeClass = 'intensity-extreme';
      label = '🔥 Extreme Pain';
    } else if (raw.includes('very high') || raw.includes('very')) {
      badgeClass = 'intensity-very-high';
      label = '⚡ Very High Pain';
    } else {
      label = '⚠️ High Pain';
    }
    return <span className={`gap-intensity-pill ${badgeClass}`}>{label}</span>;
  };

  // Step 1: Discover Market Gaps & Pain Points
  const handleDiscoverGaps = async () => {
    const trimmedNiche = strategyNiche.trim();
    if (!trimmedNiche) {
      setStrategyError('Please enter a niche, product, or service topic to discover market gaps.');
      return;
    }
    setStrategyError('');
    setGapsLoading(true);
    setCurrentPhase('gaps');

    const effectiveKey = typeof customApiKey === 'string' ? customApiKey.trim() : '';
    const payload = {
      niche: trimmedNiche,
      platforms: strategyPlatforms.join(', ') || 'Instagram, Facebook',
      excludeGaps: [],
    };
    if (effectiveKey) payload.apiKey = effectiveKey;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (effectiveKey) headers['X-Gemini-API-Key'] = effectiveKey;

      const res = await fetch(`${API_BASE}/api/strategy-agent/gaps`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to research market gaps and pain points');
      }

      const researchData = data.data || {};
      const rawGaps = Array.isArray(researchData.gaps) ? researchData.gaps : [];
      setGapsList(rawGaps);
      setAiRecommendation({
        id: researchData.recommended_gap_id || (rawGaps[0] ? rawGaps[0].id : ''),
        reason: researchData.recommended_reason || 'Identified as the highest-converting and most emotionally charged gap.',
      });

      // Default select the recommended gap or the first one
      if (researchData.recommended_gap_id && rawGaps.some((g) => g.id === researchData.recommended_gap_id)) {
        setSelectedGapId(researchData.recommended_gap_id);
      } else if (rawGaps.length > 0) {
        setSelectedGapId(rawGaps[0].id);
      }
      window.scrollTo({ top: 120, behavior: 'smooth' });
    } catch (err) {
      setStrategyError(err.message || 'Failed to research customer pain points. Please try again.');
      setCurrentPhase('setup');
    } finally {
      setGapsLoading(false);
    }
  };

  // Step 1b: User asks for MORE pain points & gaps
  const handleFindMoreGaps = async () => {
    const trimmedNiche = strategyNiche.trim();
    if (!trimmedNiche) return;

    setMoreGapsLoading(true);
    setStrategyError('');

    const effectiveKey = typeof customApiKey === 'string' ? customApiKey.trim() : '';
    // Collect existing gaps to explicitly exclude duplicates
    const excludeList = gapsList.map((g) => `${g.title || ''}: ${g.gap_statement || ''}`).filter(Boolean);

    const payload = {
      niche: trimmedNiche,
      platforms: strategyPlatforms.join(', ') || 'Instagram, Facebook',
      excludeGaps: excludeList,
    };
    if (effectiveKey) payload.apiKey = effectiveKey;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (effectiveKey) headers['X-Gemini-API-Key'] = effectiveKey;

      const res = await fetch(`${API_BASE}/api/strategy-agent/gaps`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to find additional pain points');
      }

      const researchData = data.data || {};
      const newGaps = Array.isArray(researchData.gaps) ? researchData.gaps : [];
      if (newGaps.length === 0) {
        notifyCopy('No additional distinct angles found.');
        return;
      }

      // Re-index new gaps to avoid ID collisions
      const baseRank = gapsList.length;
      const formattedNew = newGaps.map((g, idx) => ({
        ...g,
        id: `gap_batch2_${baseRank + idx + 1}`,
        frequency_rank: baseRank + idx + 1,
        isNewBatch: true,
      }));

      setGapsList((prev) => [...prev, ...formattedNew]);
      notifyCopy(`✨ Discovered ${formattedNew.length} additional fresh market gaps!`);
    } catch (err) {
      setStrategyError(err.message || 'Failed to fetch more pain points.');
    } finally {
      setMoreGapsLoading(false);
    }
  };

  // Step 2-4: Proceed with Selected Gap to generate Offer, Creatives & Meta Architecture
  const handleRunPipelineWithSelectedGap = async () => {
    const trimmedNiche = strategyNiche.trim();
    if (!trimmedNiche) {
      setStrategyError('Please enter a niche topic.');
      return;
    }

    let chosenGapText = '';
    let chosenGapTitle = '';
    if (selectedGapId === 'custom') {
      chosenGapText = customGapText.trim();
      chosenGapTitle = 'Custom Market Gap';
      if (!chosenGapText) {
        setStrategyError('Please write your custom gap or pain point statement.');
        return;
      }
    } else {
      const found = gapsList.find((g) => g.id === selectedGapId);
      if (!found) {
        setStrategyError('Please select a customer gap card above before proceeding.');
        return;
      }
      chosenGapTitle = found.title;
      chosenGapText = `${found.title} — "${found.gap_statement}" (Why it matters: ${found.why_it_matters || 'Critical customer frustration'})`;
    }

    setStrategyError('');
    setStrategyLoading(true);
    setCurrentPhase('strategy');
    setStrategyStageIndex(2); // Stage 1 is already selected!

    const timer = setInterval(() => {
      setStrategyStageIndex((prev) => (prev < 4 ? prev + 1 : prev));
    }, 4500);

    const effectiveKey = typeof customApiKey === 'string' ? customApiKey.trim() : '';
    const finalGoal = strategyGoal === 'custom' ? (strategyCustomGoal.trim() || 'Direct Conversion') : strategyGoal;

    const payload = {
      niche: trimmedNiche,
      platforms: strategyPlatforms.join(', ') || 'Instagram, Facebook',
      goal: finalGoal,
      formatPreference: strategyFormat,
      selectedGap: chosenGapText,
      scriptLanguage: scriptLanguage,
    };
    if (effectiveKey) payload.apiKey = effectiveKey;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (effectiveKey) headers['X-Gemini-API-Key'] = effectiveKey;

      const res = await fetch(`${API_BASE}/api/strategy-agent`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate ad strategy');
      }

      const resultText = data.result;
      const meta = {
        niche: trimmedNiche,
        platforms: payload.platforms,
        goal: payload.goal,
        format: strategyFormat,
        selectedGapTitle: chosenGapTitle,
        selectedGap: chosenGapText,
        scriptLanguage: scriptLanguage,
        timestamp: new Date().toLocaleString(),
        model: data.model || apiHealth.model || 'gemini-2.5-flash',
      };

      setStrategyResult(resultText);
      setStrategyMeta(meta);
      setActiveStageFilter('all');
      window.scrollTo({ top: 120, behavior: 'smooth' });

      const historyItem = {
        id: Date.now().toString(),
        ...meta,
        result: resultText,
      };
      setStrategyHistory((prev) => {
        const updated = [historyItem, ...prev.filter((p) => p.niche !== trimmedNiche)].slice(0, 20);
        try {
          localStorage.setItem('ad_strategy_history', JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed saving strategy history:', e);
        }
        return updated;
      });
    } catch (err) {
      setStrategyError(err.message || 'An error occurred while generating the strategy.');
      // Keep on strategy phase or return so user sees error
    } finally {
      clearInterval(timer);
      setStrategyLoading(false);
      setStrategyStageIndex(0);
    }
  };

  // Instant Full Pipeline (Auto-pick top gap without intermediate screen)
  const handleRunInstantPipeline = async () => {
    const trimmedNiche = strategyNiche.trim();
    if (!trimmedNiche) {
      setStrategyError('Please enter a niche, product, or service topic.');
      return;
    }
    setStrategyError('');
    setStrategyLoading(true);
    setCurrentPhase('strategy');
    setStrategyStageIndex(1);

    const timer = setInterval(() => {
      setStrategyStageIndex((prev) => (prev < 4 ? prev + 1 : prev));
    }, 4500);

    const effectiveKey = typeof customApiKey === 'string' ? customApiKey.trim() : '';
    const finalGoal = strategyGoal === 'custom' ? (strategyCustomGoal.trim() || 'Direct Conversion') : strategyGoal;
    const payload = {
      niche: trimmedNiche,
      platforms: strategyPlatforms.join(', ') || 'Instagram, Facebook',
      goal: finalGoal,
      formatPreference: strategyFormat,
      scriptLanguage: scriptLanguage,
    };
    if (effectiveKey) payload.apiKey = effectiveKey;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (effectiveKey) headers['X-Gemini-API-Key'] = effectiveKey;

      const res = await fetch(`${API_BASE}/api/strategy-agent`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate ad strategy');
      }

      const resultText = data.result;
      const meta = {
        niche: trimmedNiche,
        platforms: payload.platforms,
        goal: payload.goal,
        format: strategyFormat,
        scriptLanguage: scriptLanguage,
        timestamp: new Date().toLocaleString(),
        model: data.model || apiHealth.model || 'gemini-2.5-flash',
      };

      setStrategyResult(resultText);
      setStrategyMeta(meta);
      setActiveStageFilter('all');
      window.scrollTo({ top: 120, behavior: 'smooth' });

      const historyItem = {
        id: Date.now().toString(),
        ...meta,
        result: resultText,
      };
      setStrategyHistory((prev) => {
        const updated = [historyItem, ...prev.filter((p) => p.niche !== trimmedNiche)].slice(0, 20);
        try {
          localStorage.setItem('ad_strategy_history', JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed saving strategy history:', e);
        }
        return updated;
      });
    } catch (err) {
      setStrategyError(err.message || 'An error occurred while generating the strategy.');
    } finally {
      clearInterval(timer);
      setStrategyLoading(false);
      setStrategyStageIndex(0);
    }
  };

  const handleCopyFull = () => {
    if (!strategyResult) return;
    navigator.clipboard.writeText(strategyResult);
    notifyCopy('Full Ad Strategy copied to clipboard!');
  };

  const handleCopyPrompt = () => {
    const promptSnippet = extractStrategySnippet(strategyResult, 'prompt');
    if (promptSnippet) {
      navigator.clipboard.writeText(promptSnippet);
      notifyCopy('Canva/Gemini Image Prompt copied!');
    } else {
      notifyCopy('Strategy copied to clipboard.');
      navigator.clipboard.writeText(strategyResult);
    }
  };

  const handleCopyScript = () => {
    const scriptSnippet = extractStrategySnippet(strategyResult, 'script');
    if (scriptSnippet) {
      navigator.clipboard.writeText(scriptSnippet);
      notifyCopy(`30-Second Video Screenplay (${currentLangMeta.label}) copied!`);
    } else {
      notifyCopy('Strategy copied to clipboard.');
      navigator.clipboard.writeText(strategyResult);
    }
  };

  const handleCopySummary = () => {
    const summarySnippet = extractStrategySnippet(strategyResult, 'summary');
    if (summarySnippet) {
      navigator.clipboard.writeText(summarySnippet);
      notifyCopy('Executive Summary copied!');
    } else {
      notifyCopy('Summary copied.');
      navigator.clipboard.writeText(strategyResult);
    }
  };

  const handleLoadHistory = (item) => {
    setStrategyResult(item.result);
    setStrategyNiche(item.niche);
    if (item.scriptLanguage) setScriptLanguage(item.scriptLanguage);
    setStrategyMeta({
      niche: item.niche,
      platforms: item.platforms,
      goal: item.goal,
      format: item.format,
      selectedGap: item.selectedGap,
      selectedGapTitle: item.selectedGapTitle,
      scriptLanguage: item.scriptLanguage || 'tanglish',
      timestamp: item.timestamp,
      model: item.model,
    });
    setCurrentPhase('strategy');
    setActiveStageFilter('all');
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const handleDeleteHistory = (id, e) => {
    e.stopPropagation();
    setStrategyHistory((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem('ad_strategy_history', JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to update history:', err);
      }
      return updated;
    });
  };

  const hasPrompt = Boolean(extractStrategySnippet(strategyResult, 'prompt'));
  const hasScript = Boolean(extractStrategySnippet(strategyResult, 'script'));

  // Determine if proceed button should be active
  const isGapSelected = Boolean(
    (selectedGapId && selectedGapId !== 'custom') ||
    (selectedGapId === 'custom' && customGapText.trim())
  );

  return (
    <div className="strategy-agent-section">
      {copyNotice && <div className="strategy-toast-notice">{copyNotice}</div>}

      {/* Hero Header */}
      <div className="strategy-hero-card">
        <div className="strategy-hero-badge">
          <span className="badge-pulse"></span>
          <span>Autonomous 4-Stage Ad Strategy Pipeline</span>
        </div>
        <h2 className="strategy-hero-title">Ad Strategy Agent</h2>
        <p className="strategy-hero-subtitle">
          Discover real market gaps from Reddit, TikTok, and reviews. Select your preferred customer pain point, then engineer an Alex Hormozi offer, direct-response creative scripts in your chosen language (<strong>Tanglish</strong>, <strong>Tamil</strong>, or <strong>English</strong>), and Meta campaign architecture.
        </p>

        {/* Pipeline Phase Breadcrumb Bar */}
        <div className="pipeline-phase-breadcrumbs">
          <button
            type="button"
            className={`phase-crumb ${currentPhase === 'setup' ? 'active' : 'done'}`}
            onClick={() => setCurrentPhase('setup')}
          >
            <span className="crumb-number">1</span>
            <span className="crumb-label">Topic & Language</span>
          </button>
          <span className="crumb-sep">→</span>
          <button
            type="button"
            className={`phase-crumb ${currentPhase === 'gaps' ? 'active' : gapsList.length > 0 ? 'done' : 'disabled'}`}
            onClick={() => gapsList.length > 0 && setCurrentPhase('gaps')}
            disabled={gapsList.length === 0}
          >
            <span className="crumb-number">2</span>
            <span className="crumb-label">Select Market Gap</span>
            {gapsList.length > 0 && <span className="crumb-count">({gapsList.length})</span>}
          </button>
          <span className="crumb-sep">→</span>
          <button
            type="button"
            className={`phase-crumb ${currentPhase === 'strategy' ? 'active' : strategyResult ? 'done' : 'disabled'}`}
            onClick={() => strategyResult && setCurrentPhase('strategy')}
            disabled={!strategyResult}
          >
            <span className="crumb-number">3</span>
            <span className="crumb-label">Offer & Creative Scripts</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------
          PHASE 1: TOPIC & CONFIG SETUP FORM
      --------------------------------------------------------------------- */}
      {currentPhase === 'setup' && (
        <section className="card strategy-form-card">
          <div className="form-group">
            <div className="label-with-hint">
              <label className="input-label" htmlFor="strategyNicheInput">
                <strong>1. Niche / Product / Service Topic *</strong>
              </label>
              <span className="label-hint">Be specific for deeper customer pain point discovery</span>
            </div>
            <textarea
              id="strategyNicheInput"
              className="strategy-textarea"
              rows={3}
              placeholder="e.g., B2B SaaS lead-gen targeting Indian manufacturers with inventory automation, or Cold plunge ice bath tubs for fitness enthusiasts, or AI bookkeeping for Shopify stores"
              value={strategyNiche}
              onChange={(e) => setStrategyNiche(e.target.value)}
            />
            <div className="strategy-quick-chips">
              <span className="chips-label">Quick test examples:</span>
              {SAMPLE_NICHES.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="quick-chip-btn"
                  onClick={() => {
                    setStrategyNiche(sample.niche);
                    setStrategyGoal(sample.goal);
                    setStrategyPlatforms(sample.platforms);
                    setStrategyFormat(sample.format);
                  }}
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          {/* SCRIPT LANGUAGE SELECTION (English, Tamil, Tanglish, etc.) */}
          <div className="form-group script-lang-group">
            <div className="label-with-hint">
              <label className="input-label">
                <strong>2. Script Language for 30s Short-Video Ad (Reels / Shorts)</strong>
              </label>
              <span className="label-pill-badge">Direct-Response Conversational</span>
            </div>
            <div className="language-pills-row">
              {SCRIPT_LANGUAGES.map((lang) => {
                const isSelected = scriptLanguage === lang.id;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    className={`lang-pill ${isSelected ? 'selected' : ''}`}
                    onClick={() => setScriptLanguage(lang.id)}
                  >
                    <span className="lang-flag">{lang.flag}</span>
                    <span className="lang-label">{lang.label}</span>
                    {isSelected && <span className="lang-check">✓</span>}
                  </button>
                );
              })}
            </div>
            <div className="lang-hint-box">
              <span className="lang-hint-icon">💡</span>
              <span className="lang-hint-desc">{currentLangMeta.hint}</span>
            </div>
          </div>

          {/* Platforms to Advertise On */}
          <div className="form-group">
            <label className="input-label">
              <strong>3. Platform(s) to Advertise On</strong>
            </label>
            <div className="platform-pills-row">
              {AVAILABLE_PLATFORMS.map((platform) => {
                const isSelected = strategyPlatforms.includes(platform);
                return (
                  <button
                    key={platform}
                    type="button"
                    className={`platform-pill ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      if (isSelected) {
                        if (strategyPlatforms.length > 1) {
                          setStrategyPlatforms(strategyPlatforms.filter((p) => p !== platform));
                        }
                      } else {
                        setStrategyPlatforms([...strategyPlatforms, platform]);
                      }
                    }}
                  >
                    <span className="pill-check">{isSelected ? '✓' : '+'}</span>
                    <span>{platform}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary CTA / Conversion Goal */}
          <div className="form-group">
            <label className="input-label">
              <strong>4. Primary CTA / Conversion Goal</strong>
            </label>
            <div className="goal-pills-row">
              {PRESET_GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`goal-pill ${strategyGoal === g.id ? 'selected' : ''}`}
                  onClick={() => setStrategyGoal(g.id)}
                >
                  <span>{g.label}</span>
                </button>
              ))}
            </div>
            {strategyGoal === 'custom' && (
              <input
                type="text"
                className="url-field custom-goal-input"
                placeholder="Enter your custom conversion goal / CTA..."
                value={strategyCustomGoal}
                onChange={(e) => setStrategyCustomGoal(e.target.value)}
                autoFocus
              />
            )}
          </div>

          {/* Creative Format Preference */}
          <div className="form-group">
            <label className="input-label">
              <strong>5. Creative Format Preference</strong>
            </label>
            <div className="format-options-grid">
              <button
                type="button"
                className={`format-card-btn ${strategyFormat === 'both' ? 'selected' : ''}`}
                onClick={() => setStrategyFormat('both')}
              >
                <span className="format-icon">✨</span>
                <div className="format-info">
                  <strong>Both (Static + 30s Script)</strong>
                  <span>Canva/Gemini prompt AND 30s video screenplay in {currentLangMeta.label}</span>
                </div>
              </button>
              <button
                type="button"
                className={`format-card-btn ${strategyFormat === 'short-video' ? 'selected' : ''}`}
                onClick={() => setStrategyFormat('short-video')}
              >
                <span className="format-icon">🎬</span>
                <div className="format-info">
                  <strong>Short-Video Script</strong>
                  <span>30s direct-response screenplay in {currentLangMeta.label} (Hook, Tension, Proof, CTA)</span>
                </div>
              </button>
              <button
                type="button"
                className={`format-card-btn ${strategyFormat === 'static' ? 'selected' : ''}`}
                onClick={() => setStrategyFormat('static')}
              >
                <span className="format-icon">🖼️</span>
                <div className="format-info">
                  <strong>Static Ad Prompt</strong>
                  <span>Copy-pasteable Canva/Gemini image prompt & 2 headline variants</span>
                </div>
              </button>
            </div>
          </div>

          {strategyError && <div className="error-toast">{strategyError}</div>}

          {/* Action Buttons: Discovery vs Instant */}
          <div className="setup-actions-row">
            <button
              type="button"
              className="btn-primary btn-run-pipeline btn-discover-gaps"
              onClick={handleDiscoverGaps}
              disabled={gapsLoading || strategyLoading}
            >
              {gapsLoading ? (
                <>
                  <span className="spinner"></span>
                  <span>Researching Market Gaps on Reddit & Forums...</span>
                </>
              ) : (
                <>
                  <span>🔍 Step 1: Discover Market Gaps & Pain Points ➡️</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="btn-secondary btn-instant-pipeline"
              onClick={handleRunInstantPipeline}
              disabled={strategyLoading || gapsLoading}
              title="Skip manual gap selection and run all 4 stages automatically"
            >
              ⚡ Instant Full Strategy (Auto-Pick)
            </button>
          </div>
          <p className="setup-flow-hint">
            💡 <strong>Recommended:</strong> Click <em>"Step 1: Discover Market Gaps"</em> to review actual customer complaints, choose your preferred pain point, or ask for more pain points before generating the Hormozi offer and script.
          </p>
        </section>
      )}

      {/* ---------------------------------------------------------------------
          PHASE 2: INTERACTIVE MARKET GAPS & PAIN POINTS SELECTION
      --------------------------------------------------------------------- */}
      {currentPhase === 'gaps' && (
        <section className="card gaps-phase-card">
          <div className="gaps-phase-header">
            <div className="gaps-header-meta">
              <button
                type="button"
                className="btn-back-setup"
                onClick={() => setCurrentPhase('setup')}
              >
                ← Edit Topic
              </button>
              <div className="gaps-title-wrap">
                <span className="gaps-step-pill">Stage 1 of 4 • Human-in-the-Loop Selection</span>
                <h3 className="gaps-section-title">Select Customer Gap & Pain Point</h3>
                <p className="gaps-section-subtitle">
                  The agent scoured Reddit, forums, Google reviews, and TikTok discussions for <strong>"{strategyNiche}"</strong>.
                  Select the gap you want to build your ad around. <em>Only after selecting will it proceed to the Hormozi offer & creative scripts.</em>
                </p>
              </div>
            </div>

            <div className="gaps-header-badges">
              <span className="header-meta-pill">🗣️ Script Lang: {currentLangMeta.label}</span>
              <span className="header-meta-pill">🎯 Goal: {strategyGoal === 'custom' ? strategyCustomGoal : strategyGoal}</span>
            </div>
          </div>

          {/* AI Recommendation Highlight Box */}
          {aiRecommendation && aiRecommendation.reason && (
            <div className="gaps-ai-recommendation-box">
              <div className="ai-rec-header">
                <span className="ai-rec-star">⭐</span>
                <strong>AI Market Analysis Recommendation:</strong>
              </div>
              <p className="ai-rec-text">{aiRecommendation.reason}</p>
            </div>
          )}

          {strategyError && <div className="error-toast">{strategyError}</div>}

          {/* Loading State during initial gap fetch */}
          {gapsLoading && (
            <div className="gaps-loading-state">
              <span className="spinner large-spinner"></span>
              <h4>Scouring Reddit, TikTok & Industry Forums...</h4>
              <p>Extracting raw customer emotional frustrations, recurring complaints, and underserved angles.</p>
            </div>
          )}

          {/* Interactive Gap Cards Grid */}
          {!gapsLoading && gapsList.length > 0 && (
            <div className="gaps-cards-grid">
              {gapsList.map((gap, idx) => {
                const isSelected = selectedGapId === gap.id;
                const isRecommended = aiRecommendation && aiRecommendation.id === gap.id;
                return (
                  <div
                    key={gap.id || idx}
                    className={`gap-choice-card ${isSelected ? 'selected' : ''} ${isRecommended ? 'recommended-card' : ''}`}
                    onClick={() => setSelectedGapId(gap.id)}
                  >
                    <div className="gap-card-top">
                      <div className="gap-radio-wrap">
                        <div className={`gap-radio-circle ${isSelected ? 'checked' : ''}`}>
                          {isSelected && <span className="gap-radio-dot"></span>}
                        </div>
                        <span className="gap-rank-tag">#{gap.frequency_rank || idx + 1} Frequency</span>
                      </div>

                      <div className="gap-badges-right">
                        {isRecommended && <span className="gap-ai-pick-pill">⭐ AI Recommended</span>}
                        {renderIntensityBadge(gap.intensity)}
                        {gap.isNewBatch && <span className="gap-new-pill">✨ Fresh Angle</span>}
                      </div>
                    </div>

                    <h4 className="gap-card-title">{gap.title}</h4>

                    {/* Customer Voice Callout */}
                    <div className="gap-statement-callout">
                      <span className="callout-quote-icon">“</span>
                      <p className="callout-text">{gap.gap_statement}</p>
                    </div>

                    {/* Why it matters */}
                    {gap.why_it_matters && (
                      <div className="gap-why-matters">
                        <strong>📌 Why it costs them:</strong> {gap.why_it_matters}
                      </div>
                    )}

                    {/* Direct customer quotes */}
                    {gap.quotes && Array.isArray(gap.quotes) && gap.quotes.length > 0 && (
                      <div className="gap-quotes-container">
                        <span className="quotes-label">Real User Voice:</span>
                        {gap.quotes.map((q, qIdx) => {
                          const quoteText = typeof q === 'string' ? q : q.quote;
                          const quoteSource = typeof q === 'object' && q.source ? q.source : 'Discussion Forum';
                          return (
                            <div key={qIdx} className="gap-quote-bubble">
                              <p className="bubble-text">"{quoteText}"</p>
                              <span className="bubble-source">— {quoteSource}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="gap-card-footer">
                      <button
                        type="button"
                        className={`btn-select-gap ${isSelected ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGapId(gap.id);
                        }}
                      >
                        {isSelected ? '✓ Selected for Next Stage' : 'Select This Gap'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Option to write a custom or refined pain point */}
              <div
                className={`gap-choice-card custom-gap-card ${selectedGapId === 'custom' ? 'selected' : ''}`}
                onClick={() => setSelectedGapId('custom')}
              >
                <div className="gap-card-top">
                  <div className="gap-radio-wrap">
                    <div className={`gap-radio-circle ${selectedGapId === 'custom' ? 'checked' : ''}`}>
                      {selectedGapId === 'custom' && <span className="gap-radio-dot"></span>}
                    </div>
                    <span className="gap-rank-tag">✏️ Custom Angle</span>
                  </div>
                  <span className="gap-intensity-pill intensity-custom">User Defined</span>
                </div>

                <h4 className="gap-card-title">Write or Refine Your Own Customer Pain Point</h4>
                <p className="custom-gap-desc">
                  Have a specific insider frustration or proprietary angle? Enter it here and the agent will build the Hormozi offer and {currentLangMeta.label} script around it.
                </p>

                {selectedGapId === 'custom' && (
                  <div className="custom-gap-input-wrap" onClick={(e) => e.stopPropagation()}>
                    <textarea
                      className="strategy-textarea custom-gap-textarea"
                      rows={3}
                      placeholder="e.g. Traditional ERPs take 6 months to implement and cost ₹5 Lakhs upfront, while 90% of our inventory features sit unused..."
                      value={customGapText}
                      onChange={(e) => setCustomGapText(e.target.value)}
                      autoFocus
                    />
                  </div>
                )}

                <div className="gap-card-footer">
                  <button
                    type="button"
                    className={`btn-select-gap ${selectedGapId === 'custom' ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedGapId('custom');
                    }}
                  >
                    {selectedGapId === 'custom' ? '✓ Custom Gap Selected' : 'Use Custom Gap'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------
              ACTIONS TOOLBAR (Find More Pain Points + Proceed Gate)
          --------------------------------------------------------------- */}
          <div className="gaps-actions-toolbar">
            <div className="toolbar-left">
              <button
                type="button"
                className="btn-secondary btn-more-gaps"
                onClick={handleFindMoreGaps}
                disabled={moreGapsLoading || gapsLoading}
              >
                {moreGapsLoading ? (
                  <>
                    <span className="spinner"></span>
                    <span>Digging Deeper for Fresh Pain Points...</span>
                  </>
                ) : (
                  <>
                    <span>🔄 Not Satisfied? Find 5 More Pain Points & Gaps</span>
                  </>
                )}
              </button>
              <span className="toolbar-helper-note">
                Excludes already discovered angles and searches fresh subreddits & forums.
              </span>
            </div>

            <div className="toolbar-right">
              <button
                type="button"
                className={`btn-primary btn-proceed-stage ${!isGapSelected ? 'disabled-gate' : ''}`}
                onClick={handleRunPipelineWithSelectedGap}
                disabled={!isGapSelected || strategyLoading}
              >
                {strategyLoading ? (
                  <>
                    <span className="spinner"></span>
                    <span>Engineering Offer & Scripts...</span>
                  </>
                ) : (
                  <>
                    <span>🚀 Proceed to Stages 2–4 with Selected Gap ➡️</span>
                  </>
                )}
              </button>
              {!isGapSelected && (
                <span className="gate-locked-hint">
                  🔒 Please select a customer gap card above to unlock the next stages.
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------------
          LIVE PROGRESS MODAL / CARD DURING PIPELINE EXECUTION
      --------------------------------------------------------------------- */}
      {strategyLoading && (
        <div className="pipeline-progress-card">
          <div className="progress-header">
            <h4>⚡ Running Ad Strategy Pipeline</h4>
            <span className="progress-status-pill">Active Live Run</span>
          </div>
          <div className="pipeline-steps">
            <div className="pipeline-step completed">
              <div className="step-circle">✓</div>
              <div className="step-body">
                <strong>Stage 1: Customer Gap Selected</strong>
                <span>
                  {selectedGapId === 'custom' ? customGapText.slice(0, 80) : (gapsList.find((g) => g.id === selectedGapId)?.title || 'Market gap chosen')}
                </span>
              </div>
            </div>
            <div className={`pipeline-step ${strategyStageIndex >= 2 ? 'active' : ''} ${strategyStageIndex > 2 ? 'completed' : ''}`}>
              <div className="step-circle">{strategyStageIndex > 2 ? '✓' : '2'}</div>
              <div className="step-body">
                <strong>Stage 2: ICP & Alex Hormozi Offer Engineering</strong>
                <span>Avatar triggers, sub-segments, and calculating Value Equation around selected gap</span>
              </div>
            </div>
            <div className={`pipeline-step ${strategyStageIndex >= 3 ? 'active' : ''} ${strategyStageIndex > 3 ? 'completed' : ''}`}>
              <div className="step-circle">{strategyStageIndex > 3 ? '✓' : '3'}</div>
              <div className="step-body">
                <strong>Stage 3: Direct-Response Creative Output ({currentLangMeta.label})</strong>
                <span>Writing copy-pasteable image prompts and 30s video screenplay in authentic {currentLangMeta.label}</span>
              </div>
            </div>
            <div className={`pipeline-step ${strategyStageIndex >= 4 ? 'active' : ''}`}>
              <div className="step-circle">{strategyStageIndex >= 4 ? '⏳' : '4'}</div>
              <div className="step-body">
                <strong>Stage 4: Meta Campaign Architecture & Budget</strong>
                <span>CBO vs ABO, testing framework, 20-30% scaling cadence, and compliance</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          PHASE 3: STRATEGY RESULTS & CREATIVE SCRIPTS
      --------------------------------------------------------------------- */}
      {currentPhase === 'strategy' && strategyResult && !strategyLoading && (
        <div className="strategy-results-card">
          <div className="strategy-results-header">
            <div className="results-title-group">
              <span className="strategy-topic-tag">Complete 4-Stage Strategy</span>
              <h3 className="results-niche-title">{strategyMeta?.niche || strategyNiche}</h3>

              {/* Selected Gap Banner Callout */}
              {strategyMeta?.selectedGap && (
                <div className="results-gap-banner">
                  <span className="gap-banner-label">🎯 Targeted Gap:</span>
                  <span className="gap-banner-content">{strategyMeta.selectedGap}</span>
                </div>
              )}

              <div className="strategy-meta-tags">
                <span className="meta-tag">🗣️ Script: <strong>{currentLangMeta.label}</strong></span>
                <span className="meta-tag">📱 {strategyMeta?.platforms || strategyPlatforms.join(', ')}</span>
                <span className="meta-tag">🎯 {strategyMeta?.goal || strategyGoal}</span>
                <span className="meta-tag">🎨 Format: {strategyMeta?.format || strategyFormat}</span>
                {strategyMeta?.model && <span className="meta-tag model-tag">⚡ {strategyMeta.model}</span>}
              </div>
            </div>

            <div className="results-action-buttons">
              {gapsList.length > 0 && (
                <button
                  type="button"
                  className="btn-secondary btn-action-sm btn-back-gaps-action"
                  onClick={() => {
                    setCurrentPhase('gaps');
                    window.scrollTo({ top: 120, behavior: 'smooth' });
                  }}
                  title="Pick a different pain point from the list"
                >
                  ← Change Gap
                </button>
              )}
              <button
                type="button"
                className="btn-secondary btn-action-sm"
                onClick={handleCopyFull}
              >
                📋 Copy Full Plan
              </button>
              {hasScript && (
                <button
                  type="button"
                  className="btn-secondary btn-action-sm"
                  onClick={handleCopyScript}
                >
                  🎬 Copy 30s Script ({currentLangMeta.badge})
                </button>
              )}
              {hasPrompt && (
                <button
                  type="button"
                  className="btn-secondary btn-action-sm"
                  onClick={handleCopyPrompt}
                >
                  🎨 Copy Image Prompt
                </button>
              )}
              <button
                type="button"
                className="btn-secondary btn-action-sm"
                onClick={handleCopySummary}
              >
                ⚡ Copy Summary
              </button>
              <button
                type="button"
                className="btn-primary btn-action-sm"
                onClick={() => {
                  setCurrentPhase('setup');
                  setStrategyResult('');
                  window.scrollTo({ top: 120, behavior: 'smooth' });
                }}
              >
                🔄 New Topic
              </button>
            </div>
          </div>

          {/* Stage Filter Tabs */}
          <div className="stage-filter-tabs">
            {[
              { id: 'all', label: '📋 All 4 Stages' },
              { id: 'summary', label: '⚡ Executive Summary' },
              { id: 'stage1', label: '🔍 1. Gap Research' },
              { id: 'stage2', label: '💡 2. Hormozi Offer' },
              { id: 'stage3', label: `🎨 3. Creative (${currentLangMeta.badge})` },
              { id: 'stage4', label: '📊 4. Campaign & Budget' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`stage-filter-btn ${activeStageFilter === tab.id ? 'active' : ''}`}
                onClick={() => setActiveStageFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="strategy-content-body">
            <FormattedStrategyMarkdown
              content={strategyResult}
              filterStage={activeStageFilter}
              onCopy={notifyCopy}
            />
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SAVED STRATEGY HISTORY SECTION
      --------------------------------------------------------------------- */}
      {strategyHistory.length > 0 && (
        <section className="card strategy-history-card">
          <div className="history-header">
            <h4>💾 Saved Strategy History ({strategyHistory.length})</h4>
            <span className="history-subtitle">Previous pipeline runs saved in local browser storage</span>
          </div>

          <div className="history-items-grid">
            {strategyHistory.map((item) => (
              <div
                key={item.id}
                className="history-item-card"
                onClick={() => handleLoadHistory(item)}
              >
                <div className="history-item-top">
                  <span className="history-item-date">{item.timestamp}</span>
                  <button
                    type="button"
                    className="btn-delete-history"
                    title="Delete strategy"
                    onClick={(e) => handleDeleteHistory(item.id, e)}
                  >
                    ✕
                  </button>
                </div>
                <h5 className="history-item-niche">{item.niche}</h5>
                {item.selectedGapTitle && (
                  <span className="history-gap-title">🎯 {item.selectedGapTitle}</span>
                )}
                <div className="history-item-badges">
                  {item.scriptLanguage && (
                    <span className="badge-sm lang-badge">🗣️ {item.scriptLanguage.toUpperCase()}</span>
                  )}
                  <span className="badge-sm">{item.platforms}</span>
                  <span className="badge-sm">{item.goal}</span>
                </div>
                <button type="button" className="btn-load-history">
                  Load Strategy →
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('ad_analyzer_auth') === 'true';
  });

  const [mainSection, setMainSection] = useState(() => {
    return localStorage.getItem('ad_analyzer_section') || 'strategy-agent';
  });

  const [activeTab, setActiveTab] = useState('video'); // 'video' | 'image' | 'url'
  const [imageData, setImageData] = useState(null); // base64 data url
  const [imageMime, setImageMime] = useState('image/png');
  const [imageFileName, setImageFileName] = useState('');
  const [urlInput, setUrlInput] = useState('');

  // Video state
  const [videoUrl, setVideoUrl] = useState('');
  const [videoData, setVideoData] = useState(null);
  const [videoFileName, setVideoFileName] = useState('');
  const videoInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copySuccess, setCopySuccess] = useState('');

  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAwareness, setSelectedAwareness] = useState('ALL');
  const [apiHealth, setApiHealth] = useState({ status: 'checking', apiKeySet: false, model: 'gemini-2.5-flash' });

  // Custom user-provided Gemini API key (persisted in browser localStorage)
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('gemini_custom_api_key') || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [modalKeyInput, setModalKeyInput] = useState('');
  const [quickKeyInput, setQuickKeyInput] = useState('');

  // Meta Ads Benchmark Research Prompt Modal State
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [selectedMetaAd, setSelectedMetaAd] = useState(null);
  const [metaPromptRegion, setMetaPromptRegion] = useState('United States / Global');
  const [generatingBenchmark, setGeneratingBenchmark] = useState(false);
  const [benchmarkReport, setBenchmarkReport] = useState(null);
  const [benchmarkError, setBenchmarkError] = useState('');

  const fileInputRef = useRef(null);
  const API_BASE = import.meta.env.VITE_API_BASE || '';

  // Check health and load logs on mount
  useEffect(() => {
    checkHealth();
    fetchLogs();
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setApiHealth(data);
      }
    } catch {
      setApiHealth({ status: 'offline', apiKeySet: false, model: 'gemini-2.5-flash' });
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/logs`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  };

  // Global Ctrl+V clipboard paste handler
  const handlePaste = useCallback((e) => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setImageData(event.target.result);
            setImageMime(file.type || 'image/png');
            setImageFileName(`Pasted_Screenshot_${new Date().toLocaleTimeString().replace(/:/g, '-')}.png`);
            setActiveTab('image');
            setErrorMsg('');
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // File upload handler
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const processImageFile = (file) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (.png, .jpg, .webp).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageData(event.target.result);
      setImageMime(file.type || 'image/png');
      setImageFileName(file.name);
      setErrorMsg('');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleVideoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processVideoFile(file);
    }
  };

  const processVideoFile = (file) => {
    if (!file.type.startsWith('video/')) {
      setErrorMsg('Please select a valid video file (.mp4, .mov, .webm).');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('Video file must be under 50MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setVideoData(event.target.result);
      setVideoFileName(file.name);
      setVideoUrl('');
      setErrorMsg('');
    };
    reader.readAsDataURL(file);
  };

  // Save Custom Key Modal
  const handleSaveCustomKey = (keyVal) => {
    const trimmed = typeof keyVal === 'string' ? keyVal.trim() : '';
    setCustomApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem('gemini_custom_api_key', trimmed);
    } else {
      localStorage.removeItem('gemini_custom_api_key');
    }
    setShowKeyModal(false);
    setErrorMsg('');
  };

  // Run Analysis (supports explicit key override for instant retry)
  const handleAnalyze = async (overrideKey = null) => {
    setErrorMsg('');
    setCopySuccess('');

    // Ensure effectiveKey only uses overrideKey if it's a string (prevent React SyntheticEvent from breaking .trim())
    const rawKey = typeof overrideKey === 'string' ? overrideKey : (typeof customApiKey === 'string' ? customApiKey : '');
    const effectiveKey = rawKey.trim();

    if (activeTab === 'video' && !videoUrl.trim() && !videoData) {
      setErrorMsg('Please paste an Instagram Reel or YouTube link, or upload a video file.');
      return;
    }
    if (activeTab === 'image' && !imageData) {
      setErrorMsg('Please drop an image, paste a screenshot with Ctrl+V, or upload a file.');
      return;
    }
    if (activeTab === 'url' && !urlInput.trim()) {
      setErrorMsg('Please enter a valid landing page URL (e.g., https://example.com).');
      return;
    }

    setLoading(true);

    let payload;
    if (activeTab === 'video') {
      if (videoUrl.trim()) {
        payload = { type: 'video_url', url: videoUrl.trim() };
        setLoadingStage('Downloading clip from Instagram / YouTube...');
        setTimeout(() => setLoadingStage('Uploading video to Gemini Vision engine...'), 2500);
        setTimeout(() => setLoadingStage('Analyzing 0-3s hook, pacing, audio & strategy...'), 6000);
      } else {
        payload = { type: 'video_file', data: videoData, filename: videoFileName };
        setLoadingStage('Uploading video to Gemini Vision engine...');
        setTimeout(() => setLoadingStage('Analyzing 0-3s hook, pacing, audio & strategy...'), 3500);
      }
    } else if (activeTab === 'image') {
      payload = { type: 'image', data: imageData, mimeType: imageMime, filename: imageFileName };
      setLoadingStage('Analyzing image ad with Gemini Multimodal engine...');
      setTimeout(() => setLoadingStage('Extracting strategy, hooks & psychological angles...'), 1200);
    } else {
      payload = { type: 'url', url: urlInput.trim() };
      setLoadingStage('Fetching landing page and analyzing copy...');
      setTimeout(() => setLoadingStage('Extracting strategy, hooks & psychological angles...'), 1200);
    }

    if (effectiveKey) {
      payload.apiKey = effectiveKey;
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (effectiveKey) {
        headers['X-Gemini-API-Key'] = effectiveKey;
      }

      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to analyze ad');
      }

      setCurrentAnalysis({
        ...result.data,
        source: result.source,
        timestamp: result.timestamp,
        isVideo: activeTab === 'video',
        previewImage: activeTab === 'image' ? imageData : null,
      });

      // Refresh log
      await fetchLogs();
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred during analysis.');
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleApplyQuickKeyAndRetry = () => {
    const trimmed = quickKeyInput.trim();
    if (!trimmed) return;
    setCustomApiKey(trimmed);
    localStorage.setItem('gemini_custom_api_key', trimmed);
    setErrorMsg('');
    handleAnalyze(trimmed);
  };

  // Copy Markdown
  const handleCopyMarkdown = () => {
    if (!currentAnalysis) return;
    const obs = currentAnalysis.observed || {};
    const inf = currentAnalysis.inference || {};
    const proof = Array.isArray(obs.proof_elements)
      ? obs.proof_elements.join('; ')
      : obs.proof_elements || '';

    const md = `### Ad Strategy Breakdown
**Source:** ${currentAnalysis.source || 'Ad Screenshot'}
**Timestamp:** ${currentAnalysis.timestamp || ''}

#### Observed
- **Hook:** ${obs.hook || 'N/A'}
- **Offer:** ${obs.offer || 'N/A'}
- **CTA:** ${obs.cta || 'N/A'}
- **Proof Elements:** ${proof || 'N/A'}
- **Price Shown:** ${obs.price_shown || 'N/A'}
- **Creative Format:** ${obs.creative_format || 'N/A'}

#### Inferences
- **Target Audience:** ${inf.audience || 'N/A'}
- **Positioning:** ${inf.positioning || 'N/A'}
- **Psychological Angle:** ${inf.psychological_angle || 'N/A'}
- **Awareness Level:** ${inf.awareness_level || 'N/A'}

#### Notes & Mechanism
${currentAnalysis.notes || 'N/A'}
`;

    navigator.clipboard.writeText(md);
    setCopySuccess('Markdown copied to clipboard!');
    setTimeout(() => setCopySuccess(''), 3000);
  };

  // Generate exact Meta benchmark research prompt with ad metadata
  const generateMetaBenchmarkPrompt = (item, region = metaPromptRegion) => {
    if (!item) return '';
    const obs = item.observed || item || {};
    const inf = item.inference || item || {};

    const productService = (inf.positioning || obs.offer || 'this product/service').trim();
    const cta = (obs.cta || 'taking the next step').trim();
    const targetRegion = (region || 'United States / Global').trim();
    const niche = (inf.audience || inf.positioning || 'this niche audience').trim();
    const industry = (inf.positioning || 'this industry').trim();
    const awarenessLevel = (inf.awareness_level || 'Problem-Aware / Solution-Aware').trim();
    const pricePoint = (obs.price_shown || 'standard pricing').trim();

    return `Research Meta Ads (Facebook/Instagram) benchmark data and strategy for a ${productService} with the goal of "${cta}". I need:
Cost benchmarks: average CPL (cost per lead), CPC, and CTR for this industry/audience in ${targetRegion} in 2026, broken down by campaign objective (Leads vs Conversions vs Traffic).
Budget & duration: recommended daily budget to exit learning phase, typical testing-phase spend before declaring a winning creative, and scaling cadence that avoids resetting the algorithm.
Campaign structure: best-performing ad set structure for this audience size (CBO vs ABO, how many ad sets, how many creatives per ad set, broad vs interest targeting for ${niche}).
Creative benchmarks: average video completion rates, hook retention (3-second view rate), and what creative formats (UGC, talking-head, testimonial, static) currently outperform for ${industry} in 2026.
Funnel: whether single-stage cold campaigns or TOF/retargeting splits perform better for ${awarenessLevel} audiences buying ${pricePoint}.
Compliance/policy: any current Meta ad policy restrictions relevant to ${industry}.
Cite recent (2025-2026) sources — Meta's own benchmarks, agency case studies, or industry reports — not generic advice.`;
  };

  const handleQuickCopyMetaPrompt = (adItem, customRegion = metaPromptRegion) => {
    const text = generateMetaBenchmarkPrompt(adItem, customRegion);
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopySuccess('🎯 Meta benchmark prompt copied to clipboard!');
    setTimeout(() => setCopySuccess(''), 3500);
  };

  const handleOpenMetaPromptModal = (adItem) => {
    setSelectedMetaAd(adItem);
    setBenchmarkReport(null);
    setBenchmarkError('');
    setShowMetaModal(true);
  };

  const handleRunBenchmarkResearch = async () => {
    if (!selectedMetaAd) return;
    const prompt = generateMetaBenchmarkPrompt(selectedMetaAd, metaPromptRegion);
    setGeneratingBenchmark(true);
    setBenchmarkError('');
    setBenchmarkReport(null);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (customApiKey.trim()) {
        headers['X-Gemini-API-Key'] = customApiKey.trim();
      }

      const res = await fetch(`${API_BASE}/api/benchmark`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          apiKey: customApiKey.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed generating benchmark research');
      }

      setBenchmarkReport(data.result);
    } catch (err) {
      setBenchmarkError(err.message || 'Error running benchmark research');
    } finally {
      setGeneratingBenchmark(false);
    }
  };

  // Filter logs
  const filteredLogs = logs.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      item.hook?.toLowerCase().includes(q) ||
      item.offer?.toLowerCase().includes(q) ||
      item.source?.toLowerCase().includes(q) ||
      item.audience?.toLowerCase().includes(q) ||
      item.psychological_angle?.toLowerCase().includes(q) ||
      item.notes?.toLowerCase().includes(q);

    const matchAwareness =
      selectedAwareness === 'ALL' ||
      item.awareness_level?.toLowerCase() === selectedAwareness.toLowerCase();

    return matchSearch && matchAwareness;
  });

  // 6-Digit Passcode Protection Check
  if (!isAuthenticated) {
    return <PasscodeGate onUnlock={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="logo-badge">
            <span className="logo-spark">✨</span>
          </div>
          <div>
            <h1 className="brand-title">Ad Analyzer</h1>
            <p className="brand-subtitle">AI Advertising Strategy & Swipe File Intelligence</p>
          </div>
        </div>

        <div className="header-meta">
          <div className="model-chip">
            <span className="pulse-dot"></span>
            <span>{apiHealth.model}</span>
          </div>
          <div className={`api-chip ${apiHealth.apiKeySet || customApiKey ? 'status-ok' : 'status-warn'}`}>
            <span>{customApiKey ? 'Custom Key Active' : (apiHealth.apiKeySet ? 'Server Key Active' : 'API Key Missing')}</span>
          </div>
          <button
            type="button"
            className="key-settings-btn"
            title="API Key Settings & Quota"
            onClick={() => {
              setModalKeyInput(customApiKey);
              setShowKeyModal(true);
            }}
          >
            ⚙️ Key
          </button>
          <button
            type="button"
            className="btn-lock-header"
            title="Lock Application"
            onClick={() => {
              sessionStorage.removeItem('ad_analyzer_auth');
              setIsAuthenticated(false);
            }}
          >
            🔒 Lock
          </button>
        </div>
      </header>

      {/* Top-Level Section Navigation Switcher */}
      <nav className="section-nav-bar" aria-label="Main section navigation">
        <button
          type="button"
          className={`section-nav-pill ${mainSection === 'analyzer' ? 'active' : ''}`}
          onClick={() => {
            setMainSection('analyzer');
            localStorage.setItem('ad_analyzer_section', 'analyzer');
          }}
        >
          <span className="pill-icon">🎬</span>
          <div className="pill-text-wrap">
            <span className="pill-title">Ad Creative Analyzer</span>
            <span className="pill-desc">Video • Image • URL Teardown</span>
          </div>
        </button>

        <button
          type="button"
          className={`section-nav-pill ${mainSection === 'strategy-agent' ? 'active' : ''}`}
          onClick={() => {
            setMainSection('strategy-agent');
            localStorage.setItem('ad_analyzer_section', 'strategy-agent');
          }}
        >
          <span className="pill-icon">⚡</span>
          <div className="pill-text-wrap">
            <div className="pill-title-row">
              <span className="pill-title">Ad Strategy Agent</span>
              <span className="pill-badge">Autonomous 4-Stage</span>
            </div>
            <span className="pill-desc">Gap Research → Hormozi Offer → Creative → Meta Campaign</span>
          </div>
        </button>
      </nav>

      {/* Main Content Layout */}
      <main className="app-main">
        {/* Warning if API key is not set anywhere */}
        {!apiHealth.apiKeySet && !customApiKey && (
          <div className="key-alert-banner">
            <span className="alert-icon">⚠️</span>
            <div>
              <strong>Gemini API Key Required:</strong> Set your <code>GEMINI_API_KEY</code> on the server, or{' '}
              <button
                type="button"
                className="banner-link-btn"
                onClick={() => {
                  setModalKeyInput('');
                  setShowKeyModal(true);
                }}
              >
                enter your free API key here
              </button>{' '}
              from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>.
            </div>
          </div>
        )}

        {mainSection === 'strategy-agent' ? (
          <StrategyAgentSection
            apiHealth={apiHealth}
            customApiKey={customApiKey}
            API_BASE={API_BASE}
            onOpenKeyModal={() => {
              setModalKeyInput(customApiKey);
              setShowKeyModal(true);
            }}
          />
        ) : (
          <>
            {/* Input & Inspector Grid */}
            <div className="workspace-grid">
          {/* Left Column: Input Hub */}
          <section className="card input-card">
            <div className="tab-bar">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'video' ? 'active' : ''}`}
                onClick={() => setActiveTab('video')}
              >
                🎬 Video Ad <span className="kbd-hint">IG / YouTube</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'image' ? 'active' : ''}`}
                onClick={() => setActiveTab('image')}
              >
                📸 Ad Screenshot <span className="kbd-hint">Ctrl+V</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'url' ? 'active' : ''}`}
                onClick={() => setActiveTab('url')}
              >
                🌐 Landing Page
              </button>
            </div>

            {/* Video Tab */}
            {activeTab === 'video' && (
              <div className="video-input-container">
                <label htmlFor="videoUrlInput" className="input-label">
                  Instagram Reel / Post or YouTube Short / Video URL
                </label>
                <div className="url-input-wrapper">
                  <span className="url-icon">🎥</span>
                  <input
                    id="videoUrlInput"
                    type="url"
                    className="url-field"
                    placeholder="https://www.instagram.com/reel/... or https://youtube.com/shorts/..."
                    value={videoUrl}
                    onChange={(e) => {
                      setVideoUrl(e.target.value);
                      if (e.target.value) {
                        setVideoData(null);
                        setVideoFileName('');
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  />
                  {videoUrl && (
                    <button type="button" className="clear-btn" onClick={() => setVideoUrl('')}>✕</button>
                  )}
                </div>

                <div className="platform-badges">
                  <span className="platform-tag">Instagram Reels</span>
                  <span className="platform-tag">YouTube Shorts</span>
                  <span className="platform-tag">TikTok</span>
                </div>

                <div className="video-or-divider">
                  <span>OR UPLOAD VIDEO FILE (.MP4, .MOV, .WEBM)</span>
                </div>

                <div
                  className={`video-file-dropzone ${videoData ? 'has-file' : ''}`}
                  onClick={() => !videoData && videoInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={videoInputRef}
                    accept="video/mp4,video/quicktime,video/webm"
                    onChange={handleVideoFileChange}
                    style={{ display: 'none' }}
                  />
                  {videoData ? (
                    <div className="video-uploaded-row">
                      <span className="video-icon-sm">🎞️</span>
                      <span className="video-name">{videoFileName}</span>
                      <button
                        type="button"
                        className="btn-remove-video"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVideoData(null);
                          setVideoFileName('');
                        }}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  ) : (
                    <div className="video-drop-prompt">
                      <span>📁 Drag or click to upload local video file</span>
                    </div>
                  )}
                </div>

                <p className="helper-text">
                  Automatically extracts spoken audio, on-screen text, pacing, visual format & the 0-3s hook.
                </p>
              </div>
            )}

            {/* Image Tab */}
            {activeTab === 'image' && (
              <div
                className={`dropzone ${imageData ? 'has-image' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => !imageData && fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />

                {imageData ? (
                  <div className="image-preview-wrapper">
                    <img src={imageData} alt="Ad Preview" className="ad-preview-thumb" />
                    <div className="preview-overlay">
                      <span className="filename-label">{imageFileName || 'Pasted Image'}</span>
                      <button
                        type="button"
                        className="btn-remove-image"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageData(null);
                          setImageFileName('');
                        }}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="dropzone-prompt">
                    <div className="drop-icon">📥</div>
                    <h3>Drag & drop ad screenshot here</h3>
                    <p>or press <kbd>Ctrl + V</kbd> anywhere on this page to paste from clipboard</p>
                    <button type="button" className="btn-browse" onClick={() => fileInputRef.current?.click()}>
                      Browse Computer
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* URL Tab */}
            {activeTab === 'url' && (
              <div className="url-input-container">
                <label htmlFor="urlInput" className="input-label">Landing Page URL</label>
                <div className="url-input-wrapper">
                  <span className="url-icon">🔗</span>
                  <input
                    id="urlInput"
                    type="url"
                    className="url-field"
                    placeholder="https://example.com/special-offer"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  />
                  {urlInput && (
                    <button type="button" className="clear-btn" onClick={() => setUrlInput('')}>✕</button>
                  )}
                </div>
                <p className="helper-text">Extracts main headline, copy, proof, and offer text automatically.</p>
              </div>
            )}

            {/* Error Message or Quota Guide */}
            {errorMsg && (
              (errorMsg.toLowerCase().includes('429') ||
               errorMsg.toLowerCase().includes('rate limit') ||
               errorMsg.toLowerCase().includes('quota') ||
               errorMsg.toLowerCase().includes('resource_exhausted') ||
               errorMsg.toLowerCase().includes('per day')) ? (
                <div className="quota-card">
                  <div className="quota-header">
                    <span className="quota-icon">⚡</span>
                    <div>
                      <h4 className="quota-title">Gemini Free Tier Quota / Rate Limit (429)</h4>
                      <p className="quota-desc">{errorMsg}</p>
                    </div>
                  </div>

                  <div className="quota-body">
                    <div className="quota-tips">
                      <div className="quota-tip-item">
                        <span className="tip-bullet">1</span>
                        <div>
                          <strong>Per-Minute Limit (RPM/TPM):</strong> Video analysis uses ~250 tokens/sec. Wait ~60 seconds and retry.
                        </div>
                      </div>
                      <div className="quota-tip-item">
                        <span className="tip-bullet">2</span>
                        <div>
                          <strong>Daily Project Quota (RPD):</strong> If today's project quota is fully exhausted, quotas reset at midnight Pacific Time.
                        </div>
                      </div>
                      <div className="quota-tip-item">
                        <span className="tip-bullet">3</span>
                        <div>
                          <strong>Instant 100% Free Fix:</strong> Create a new project in <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio ↗</a> to get a fresh daily free quota, and paste it below:
                        </div>
                      </div>
                    </div>

                    <div className="quota-quick-input-group">
                      <input
                        type="password"
                        className="quota-key-field"
                        placeholder="Paste new Gemini API Key (AIzaSy...)"
                        value={quickKeyInput}
                        onChange={(e) => setQuickKeyInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleApplyQuickKeyAndRetry()}
                      />
                      <button
                        type="button"
                        className="btn-apply-key"
                        onClick={handleApplyQuickKeyAndRetry}
                        disabled={!quickKeyInput.trim() || loading}
                      >
                        ⚡ Save Key & Retry
                      </button>
                    </div>

                    {customApiKey && (
                      <div className="quota-footer-action">
                        <span>Using custom key ({customApiKey.slice(0, 6)}...{customApiKey.slice(-4)})</span>
                        <button
                          type="button"
                          className="btn-link-revert"
                          onClick={() => {
                            setCustomApiKey('');
                            localStorage.removeItem('gemini_custom_api_key');
                            setErrorMsg('');
                          }}
                        >
                          Revert to Server Key
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="error-toast">{errorMsg}</div>
              )
            )}

            {/* Submit Action */}
            <button
              type="button"
              className={`btn-analyze ${loading ? 'loading' : ''}`}
              onClick={() => handleAnalyze()}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  <span>{loadingStage || 'Analyzing Strategy...'}</span>
                </>
              ) : (
                <>
                  <span>🚀 Analyze Ad Strategy</span>
                </>
              )}
            </button>
          </section>

          {/* Right Column: Strategy Inspector */}
          <section className="card result-card">
            <div className="result-header">
              <div className="result-title-row">
                <h2>Analysis Breakdown</h2>
                {currentAnalysis && (
                  <div className="action-button-group">
                    <button
                      type="button"
                      className="action-btn action-btn-accent"
                      onClick={() => handleOpenMetaPromptModal(currentAnalysis)}
                      title="Customize or Run 2026 Meta Ads Benchmark Research"
                    >
                      🎯 Meta Benchmark Prompt
                    </button>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={() => handleQuickCopyMetaPrompt(currentAnalysis)}
                      title="Directly copy Meta benchmark prompt to clipboard"
                    >
                      📋 Copy Prompt
                    </button>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={handleCopyMarkdown}
                    >
                      📝 Markdown
                    </button>
                  </div>
                )}
              </div>
              {copySuccess && <div className="copy-notice">{copySuccess}</div>}
              {currentAnalysis && (
                <div className="result-meta-row">
                  <span className="meta-source" title={currentAnalysis.source}>
                    <strong>Source:</strong> {currentAnalysis.source}
                  </span>
                  <span className="meta-time">{currentAnalysis.timestamp}</span>
                </div>
              )}
            </div>

            {currentAnalysis ? (
              <div className="breakdown-body">
                {/* Visual Sections */}
                <div className="breakdown-grid">
                  {/* Observed Section */}
                  <div className="breakdown-col observed-col">
                    <div className="col-header">
                      <span className="section-tag tag-observed">OBSERVED</span>
                      <span className="section-note">Visibly stated or shown</span>
                    </div>

                    <div className="data-group">
                      <span className="data-label">Hook</span>
                      <div className="data-value hook-box">
                        {currentAnalysis.observed?.hook ? `"${currentAnalysis.observed.hook}"` : <span className="empty-val">None stated</span>}
                      </div>
                    </div>

                    <div className="data-group">
                      <span className="data-label">Offer</span>
                      <div className="data-value highlight-val">
                        {currentAnalysis.observed?.offer || <span className="empty-val">None visibly stated</span>}
                      </div>
                    </div>

                    <div className="data-group">
                      <span className="data-label">Call To Action (CTA)</span>
                      <div className="data-value">
                        {currentAnalysis.observed?.cta ? (
                          <span className="cta-pill">{currentAnalysis.observed.cta}</span>
                        ) : (
                          <span className="empty-val">None visibly stated</span>
                        )}
                      </div>
                    </div>

                    <div className="data-group">
                      <span className="data-label">Proof Elements</span>
                      <div className="badges-wrap">
                        {Array.isArray(currentAnalysis.observed?.proof_elements) && currentAnalysis.observed.proof_elements.length > 0 ? (
                          currentAnalysis.observed.proof_elements.map((proof, idx) => (
                            <span key={idx} className="badge badge-proof">✓ {proof}</span>
                          ))
                        ) : currentAnalysis.observed?.proof_elements ? (
                          <span className="badge badge-proof">{currentAnalysis.observed.proof_elements}</span>
                        ) : (
                          <span className="empty-val">No proof elements detected</span>
                        )}
                      </div>
                    </div>

                    <div className="metrics-row">
                      <div>
                        <span className="data-label">Price Shown</span>
                        <div className="data-value">{currentAnalysis.observed?.price_shown || '—'}</div>
                      </div>
                      <div>
                        <span className="data-label">Format</span>
                        <div className="data-value">{currentAnalysis.observed?.creative_format || '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Inference Section */}
                  <div className="breakdown-col inference-col">
                    <div className="col-header">
                      <span className="section-tag tag-inference">INFERENCE</span>
                      <span className="section-note">Strategic hypothesis</span>
                    </div>

                    <div className="data-group">
                      <span className="data-label">Target Audience</span>
                      <div className="data-value">
                        {currentAnalysis.inference?.audience || <span className="empty-val">Not inferred</span>}
                      </div>
                    </div>

                    <div className="data-group">
                      <span className="data-label">Positioning</span>
                      <div className="data-value">
                        {currentAnalysis.inference?.positioning || <span className="empty-val">Not inferred</span>}
                      </div>
                    </div>

                    <div className="data-group">
                      <span className="data-label">Psychological Angle</span>
                      <div className="data-value">
                        {currentAnalysis.inference?.psychological_angle ? (
                          <span className="badge badge-angle">⚡ {currentAnalysis.inference.psychological_angle}</span>
                        ) : (
                          <span className="empty-val">Not inferred</span>
                        )}
                      </div>
                    </div>

                    <div className="data-group">
                      <span className="data-label">Awareness Level</span>
                      <div className="data-value">
                        {currentAnalysis.inference?.awareness_level ? (
                          <span className="badge badge-awareness">🎯 {currentAnalysis.inference.awareness_level}</span>
                        ) : (
                          <span className="empty-val">Not inferred</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes Block */}
                <div className="notes-block">
                  <span className="data-label">Notes & Conversion Mechanism</span>
                  <p className="notes-text">{currentAnalysis.notes || 'No notes provided.'}</p>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <h3>Ready to Analyze</h3>
                <p>Paste a screenshot (<kbd>Ctrl+V</kbd>) or enter a landing page URL to get the strategy breakdown.</p>
              </div>
            )}
          </section>
        </div>

        {/* Swipe File Archive Section */}
        <section className="card archive-card">
          <div className="archive-header">
            <div>
              <h2>Swipe File Archive</h2>
              <p className="archive-subtitle">Saved analyses from <code>ad_log.csv</code> ({logs.length} logged)</p>
            </div>

            <div className="archive-controls">
              {/* Search */}
              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search hooks, offers, angles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-field"
                />
              </div>

              {/* Awareness Filter */}
              <select
                className="filter-select"
                value={selectedAwareness}
                onChange={(e) => setSelectedAwareness(e.target.value)}
              >
                <option value="ALL">All Awareness Levels</option>
                <option value="Unaware">Unaware</option>
                <option value="Problem-Aware">Problem-Aware</option>
                <option value="Solution-Aware">Solution-Aware</option>
                <option value="Product-Aware">Product-Aware</option>
                <option value="Most-Aware">Most-Aware</option>
              </select>

              <button type="button" className="btn-refresh" onClick={fetchLogs} title="Reload logs">
                ↻ Refresh
              </button>
            </div>
          </div>

          {/* Swipe File Grid */}
          {filteredLogs.length > 0 ? (
            <div className="archive-table-wrap">
              <table className="archive-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Source</th>
                    <th>Hook</th>
                    <th>Offer</th>
                    <th>Psychological Angle</th>
                    <th>Awareness</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((item, index) => (
                    <tr
                      key={index}
                      className="archive-row"
                      onClick={() => {
                        setCurrentAnalysis({
                          observed: {
                            hook: item.hook,
                            offer: item.offer,
                            cta: item.cta,
                            proof_elements: item.proof_elements,
                            price_shown: item.price_shown,
                            creative_format: item.creative_format,
                          },
                          inference: {
                            audience: item.audience,
                            positioning: item.positioning,
                            psychological_angle: item.psychological_angle,
                            awareness_level: item.awareness_level,
                          },
                          notes: item.notes,
                          source: item.source,
                          timestamp: item.timestamp,
                        });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <td className="cell-time">{item.timestamp}</td>
                      <td className="cell-source" title={item.source}>{item.source}</td>
                      <td className="cell-hook"><strong>{item.hook || '—'}</strong></td>
                      <td className="cell-offer">{item.offer || '—'}</td>
                      <td>
                        {item.psychological_angle ? (
                          <span className="badge badge-angle-sm">{item.psychological_angle}</span>
                        ) : '—'}
                      </td>
                      <td>
                        {item.awareness_level ? (
                          <span className="badge badge-awareness-sm">{item.awareness_level}</span>
                        ) : '—'}
                      </td>
                      <td className="cell-actions-row">
                        <button type="button" className="btn-inspect">Inspect →</button>
                        <button
                          type="button"
                          className="btn-meta-row"
                          title="Copy Meta benchmark research prompt for this ad"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickCopyMetaPrompt(item);
                          }}
                        >
                          🎯 Prompt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="archive-empty">
              {logs.length === 0 ? (
                <p>No ads analyzed yet. Analyze your first ad above to start building your swipe file!</p>
              ) : (
                <p>No logged ads match your current search/filter.</p>
              )}
            </div>
          )}
        </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>Ad Analyzer • Powered by Gemini Flash Multimodal • Local Swipe File</p>
      </footer>

      {/* API Key Settings Modal */}
      {showKeyModal && (
        <div className="modal-backdrop" onClick={() => setShowKeyModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚙️ Gemini API Key Settings</h3>
              <button type="button" className="close-btn" onClick={() => setShowKeyModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-desc">
                Provide your personal Gemini API key to override the server's default key. Your key is stored securely in your browser's local storage and passed directly for requests.
              </p>

              <div className="key-status-row">
                <span className="status-label">Active Source:</span>
                <span className="status-badge">
                  {customApiKey ? 'Custom Browser Key' : (apiHealth.apiKeySet ? 'Server Environment Key' : 'None')}
                </span>
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="modalApiKeyInput">Gemini API Key</label>
                <input
                  id="modalApiKeyInput"
                  type="password"
                  className="url-field modal-field"
                  placeholder="AIzaSy..."
                  value={modalKeyInput}
                  onChange={(e) => setModalKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveCustomKey(modalKeyInput)}
                />
              </div>

              <div className="modal-tips">
                <p>
                  💡 <strong>Need a fresh key or hit rate limits?</strong> Visit{' '}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                    Google AI Studio ↗
                  </a>{' '}
                  and create an API key under a <em>new project</em> for a fresh daily free quota.
                </p>
              </div>

              <div className="modal-actions">
                {customApiKey && (
                  <button
                    type="button"
                    className="btn-danger-outline"
                    onClick={() => {
                      handleSaveCustomKey('');
                      setModalKeyInput('');
                    }}
                  >
                    Clear & Use Server Key
                  </button>
                )}
                <div style={{ flex: 1 }}></div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowKeyModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleSaveCustomKey(modalKeyInput)}
                >
                  Save API Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Meta Benchmark Research Prompt Modal */}
      {showMetaModal && selectedMetaAd && (
        <div className="modal-backdrop" onClick={() => setShowMetaModal(false)}>
          <div className="modal-card meta-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="meta-modal-title-row">
                <span className="meta-badge-tag">Meta Ads 2026 Strategy</span>
                <h3>🎯 Meta Benchmark Research Prompt</h3>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowMetaModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <p className="modal-desc">
                This prompt automatically injects your ad's positioning, CTA, audience, and price point into a research framework for 2026 Meta benchmarks, CPL/CPC targets, and scaling architecture.
              </p>

              {/* Custom Region Input & Ad Pill Summary */}
              <div className="meta-controls-grid">
                <div className="form-group">
                  <label className="input-label" htmlFor="metaRegionInput">Target Country / Region</label>
                  <input
                    id="metaRegionInput"
                    type="text"
                    className="url-field meta-region-field"
                    placeholder="e.g. United States, India, UK, Europe, Australia"
                    value={metaPromptRegion}
                    onChange={(e) => setMetaPromptRegion(e.target.value)}
                  />
                </div>
                <div className="meta-meta-pills">
                  <div className="meta-pill">
                    <strong>Positioning:</strong> {selectedMetaAd.inference?.positioning || selectedMetaAd.positioning || 'N/A'}
                  </div>
                  <div className="meta-pill">
                    <strong>CTA:</strong> {selectedMetaAd.observed?.cta || selectedMetaAd.cta || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Generated Prompt Box */}
              <div className="meta-prompt-preview-wrap">
                <div className="meta-prompt-preview-header">
                  <span>Prompt for ChatGPT / Claude / Perplexity / Gemini</span>
                  <button
                    type="button"
                    className="btn-copy-sm"
                    onClick={() => handleQuickCopyMetaPrompt(selectedMetaAd, metaPromptRegion)}
                  >
                    📋 Copy Prompt
                  </button>
                </div>
                <pre className="meta-prompt-text">
                  {generateMetaBenchmarkPrompt(selectedMetaAd, metaPromptRegion)}
                </pre>
              </div>

              {/* Research Action Button */}
              <div className="meta-research-action-row">
                <button
                  type="button"
                  className="btn-primary btn-run-benchmark"
                  onClick={handleRunBenchmarkResearch}
                  disabled={generatingBenchmark}
                >
                  {generatingBenchmark ? (
                    <>
                      <span className="spinner"></span>
                      <span>Synthesizing 2026 Benchmarks with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <span>⚡ Run Meta Benchmark Research with Gemini</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleQuickCopyMetaPrompt(selectedMetaAd, metaPromptRegion)}
                >
                  📋 Copy to Clipboard
                </button>
              </div>

              {benchmarkError && (
                <div className="error-toast">{benchmarkError}</div>
              )}

              {benchmarkReport && (
                <div className="benchmark-report-container">
                  <div className="report-header">
                    <h4>📊 2026 Meta Ads Benchmark Strategy Report</h4>
                    <button
                      type="button"
                      className="btn-copy-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(benchmarkReport);
                        setCopySuccess('Benchmark report copied to clipboard!');
                        setTimeout(() => setCopySuccess(''), 3000);
                      }}
                    >
                      📋 Copy Report
                    </button>
                  </div>
                  <div className="report-content">
                    <pre className="report-pre">{benchmarkReport}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
