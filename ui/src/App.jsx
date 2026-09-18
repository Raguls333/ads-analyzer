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
  if (type === 'offer') {
    const s2Match = text.match(/(?:STAGE\s*2[\s\S]*?)(?:STAGE\s*3|$)/i);
    if (s2Match) {
      const offerMatch = s2Match[0].match(/(?:OFFER ENGINEERING|Irresistible offer statement|Core offer)[\s\S]*?(?:STAGE\s*3|$)/i);
      if (offerMatch) return offerMatch[0].trim();
      return s2Match[0].trim();
    }
    return '';
  }
  if (type === 'prompt') {
    const s3Match = text.match(/(?:STAGE\s*3[\s\S]*?)(?:STAGE\s*4|EXECUTIVE SUMMARY|$)/i);
    const searchTarget = s3Match ? s3Match[0] : text;
    const codeMatch = searchTarget.match(/```(?:text|markdown|prompt)?\s*([\s\S]*?)```/);
    if (codeMatch) return codeMatch[1].trim();
    const promptMatch = searchTarget.match(/(?:Prompt|prompt|Canva)[\s\S]*?(?:Headline variants|Short-video|$)/i);
    if (promptMatch) return promptMatch[0].trim();
    return '';
  }
  if (type === 'script') {
    const s3Match = text.match(/(?:STAGE\s*3[\s\S]*?)(?:STAGE\s*4|EXECUTIVE SUMMARY|$)/i);
    const searchTarget = s3Match ? s3Match[0] : text;

    // Look for Short-Video Script header
    const scriptHeaderMatch = searchTarget.match(/(?:(?:#{1,4}\s*)?(?:Short[- ]Video|Video Script|30[- ]Second|Screenplay|SCRIPT)[\s\S]*?(?:STAGE\s*4|EXECUTIVE SUMMARY|$))/i);
    if (scriptHeaderMatch) return scriptHeaderMatch[0].trim();

    // Look for Hook beat
    const hookMatch = searchTarget.match(/(?:(?:\*{1,2}|#{1,4}\s*)?(?:HOOK|Hook)[\s\S]*?(?:STAGE\s*4|EXECUTIVE SUMMARY|$))/i);
    if (hookMatch) return hookMatch[0].trim();

    // Fallback: If Stage 3 exists, return Stage 3 (excluding image prompt if present)
    if (s3Match) {
      const trimmedS3 = s3Match[0].trim();
      return trimmedS3;
    }
    return text.trim();
  }
  return '';
}

function replaceScriptInStrategyText(fullText, newScript) {
  if (!fullText) return newScript;

  // Locate Stage 3
  const s3Match = fullText.match(/(STAGE\s*3[\s\S]*?)(STAGE\s*4|EXECUTIVE SUMMARY|$)/i);
  if (!s3Match) {
    return fullText + '\n\n### REWRITTEN SHORT-VIDEO SCRIPT (30s)\n\n' + newScript;
  }

  const s3Full = s3Match[1];

  // If Stage 3 contains a static ad prompt block (Canva prompt) before the script, preserve it!
  const hasStaticPrompt = /(?:Canva|Image prompt|Prompt block|Midjourney)/i.test(s3Full);
  if (hasStaticPrompt) {
    const splitMatch = s3Full.match(/([\s\S]*?(?:```[\s\S]*?```|alternate headline variants[^\n]*\n\n))(?:[\s\S]*)/i);
    if (splitMatch && splitMatch[1]) {
      const preservedPrompt = splitMatch[1].trim();
      const updatedS3 = `${preservedPrompt}\n\n### 30-Second Short-Video Script (Rewritten)\n\n${newScript.trim()}\n\n`;
      return fullText.replace(s3Full, updatedS3);
    }
  }

  // Otherwise replace Stage 3's body with the new script while keeping the section header
  const headerMatch = s3Full.match(/(^[\s\S]*?STAGE\s*3[^\n]*\n(?:=*\n)?)/i);
  const headerPrefix = headerMatch ? headerMatch[1] : '=====================================================\nSTAGE 3 — CREATIVE OUTPUT\n=====================================================\n\n';
  const updatedS3 = `${headerPrefix}### 30-Second Short-Video Script (Rewritten)\n\n${newScript.trim()}\n\n`;
  return fullText.replace(s3Full, updatedS3);
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
  const [rewritingScript, setRewritingScript] = useState(false);
  const [scriptAngleHint, setScriptAngleHint] = useState('');
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

  const handleRewriteScript = async (targetLang = null, customHint = '') => {
    if (!strategyResult) return;
    setRewritingScript(true);
    setStrategyError('');

    const langToUse = targetLang || scriptLanguage || 'tanglish';
    const effectiveKey = typeof customApiKey === 'string' ? customApiKey.trim() : '';

    // Extract current script if available to avoid repeating the hook
    const existingScript = extractStrategySnippet(strategyResult, 'script');
    const offerSnippet = extractStrategySnippet(strategyResult, 'offer') || strategyMeta?.goal || '';

    const payload = {
      niche: strategyMeta?.niche || strategyNiche || '',
      selectedGap: strategyMeta?.selectedGap || '',
      offer: offerSnippet,
      scriptLanguage: langToUse,
      existingScript: existingScript,
      customInstructions: customHint || scriptAngleHint,
    };
    if (effectiveKey) payload.apiKey = effectiveKey;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (effectiveKey) headers['X-Gemini-API-Key'] = effectiveKey;

      const res = await fetch(`${API_BASE}/api/strategy-agent/rewrite-script`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to rewrite script');
      }

      const newScript = data.script;
      const updatedFullText = replaceScriptInStrategyText(strategyResult, newScript);

      setStrategyResult(updatedFullText);
      if (targetLang && targetLang !== scriptLanguage) {
        setScriptLanguage(targetLang);
      }

      const updatedMeta = {
        ...(strategyMeta || {}),
        scriptLanguage: langToUse,
        timestamp: new Date().toLocaleString(),
      };
      setStrategyMeta(updatedMeta);

      // Update history in localStorage
      setStrategyHistory((prev) => {
        const updated = prev.map((item) =>
          item.niche === updatedMeta.niche
            ? { ...item, result: updatedFullText, scriptLanguage: langToUse, timestamp: updatedMeta.timestamp }
            : item
        );
        try {
          localStorage.setItem('ad_strategy_history', JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed updating history:', e);
        }
        return updated;
      });

      // Switch view to Stage 3 tab so the user immediately sees the fresh script
      setActiveStageFilter('stage3');
      const langLabel = SCRIPT_LANGUAGES.find((l) => l.id === langToUse)?.label || langToUse;
      notifyCopy(`✨ 30s Short-Video Script rewritten with a fresh angle! (${langLabel})`);
    } catch (err) {
      setStrategyError(err.message || 'Failed to rewrite script.');
    } finally {
      setRewritingScript(false);
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
              {hasScript && (
                <button
                  type="button"
                  className="btn-secondary btn-action-sm btn-rewrite-header-btn"
                  onClick={() => handleRewriteScript()}
                  disabled={rewritingScript}
                  title="Rewrite the 30-second video script alone with a new hook angle and dialogue"
                >
                  {rewritingScript ? (
                    <>
                      <span className="spinner"></span>
                      <span>Rewriting Script...</span>
                    </>
                  ) : (
                    <>
                      <span>✍️ Rewrite Script Alone</span>
                    </>
                  )}
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
            {/* Dedicated Short-Video Screenplay Control & Rewrite Card */}
            {hasScript && (activeStageFilter === 'stage3' || activeStageFilter === 'all') && (
              <div className="script-screenplay-control-card">
                <div className="control-card-top-row">
                  <div className="control-card-info">
                    <span className="control-tag">Stage 3 • Direct-Response Short-Video Screenplay</span>
                    <h4 className="control-heading">🎬 30-Second Video Script</h4>
                    <span className="control-meta-pill">
                      🗣️ Language: <strong>{currentLangMeta.label}</strong>
                    </span>
                  </div>

                  <div className="control-card-buttons">
                    <button
                      type="button"
                      className="btn-copy-script-main"
                      onClick={handleCopyScript}
                      title="Copy complete 30-second video script to clipboard"
                    >
                      📋 Copy Script
                    </button>
                    <button
                      type="button"
                      className="btn-rewrite-script-main"
                      onClick={() => handleRewriteScript()}
                      disabled={rewritingScript}
                      title="Generate a brand new script with alternative hook and dialogue"
                    >
                      {rewritingScript ? (
                        <>
                          <span className="spinner"></span>
                          <span>Rewriting Script with Gemini...</span>
                        </>
                      ) : (
                        <>
                          <span>🔄 Rewrite Script Alone (New Angle)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="control-card-quick-options">
                  <div className="quick-switch-section">
                    <span className="quick-section-label">Rewrite in another language:</span>
                    <div className="quick-lang-pills">
                      {SCRIPT_LANGUAGES.map((lang) => (
                        <button
                          key={lang.id}
                          type="button"
                          className={`lang-switch-btn ${scriptLanguage === lang.id ? 'active' : ''}`}
                          onClick={() => handleRewriteScript(lang.id)}
                          disabled={rewritingScript}
                          title={`Click to rewrite the script in ${lang.label}`}
                        >
                          <span className="switch-flag">{lang.flag}</span>
                          <span>{lang.badge}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="quick-angles-section">
                    <span className="quick-section-label">Or choose a fresh hook angle:</span>
                    <div className="quick-angle-chips">
                      {[
                        '🔥 Pain & Shocking Stat',
                        '🤫 Contrarian Secret',
                        '🛑 "Stop Doing This" Interrupt',
                        '💸 Costly Mistake Exposed',
                      ].map((angle, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="angle-chip"
                          onClick={() => handleRewriteScript(scriptLanguage, angle)}
                          disabled={rewritingScript}
                        >
                          {angle}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

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

// ---------------------------------------------------------------------------
// Instagram Profile Auditor Constants & Helpers
// ---------------------------------------------------------------------------
const SAMPLE_INSTA_PROFILES = [
  {
    label: '🧠 @hubermanlab',
    handle: '@hubermanlab',
    url: 'https://www.instagram.com/hubermanlab/',
    niche: 'Health, Neuroscience & Human Performance',
  },
  {
    label: '💼 @alexhormozi',
    handle: '@alexhormozi',
    url: 'https://www.instagram.com/alexhormozi/',
    niche: 'Business Growth, Scaling & Acquisition',
  },
  {
    label: '🎨 @thefutur',
    handle: '@thefutur',
    url: 'https://www.instagram.com/thefutur/',
    niche: 'Design, Brand Strategy & Creative Business',
  },
  {
    label: '🍕 @zomato',
    handle: '@zomato',
    url: 'https://www.instagram.com/zomato/',
    niche: 'Viral Indian Food Delivery & Meme Marketing',
  },
  {
    label: '🏋️ @gymshark',
    handle: '@gymshark',
    url: 'https://www.instagram.com/gymshark/',
    niche: 'Fitness Apparel, Workouts & Gym Humor',
  },
];

function extractInstaAuditSnippet(text, type) {
  if (!text) return '';
  if (type === 'summary') {
    const match = text.match(/(?:#+\s*)?(?:EXECUTIVE SUMMARY|Executive Summary)[\s\S]*$/i);
    if (match) return match[0].replace(/^(?:#+\s*)?(?:EXECUTIVE SUMMARY|Executive Summary)\s*/i, '').trim();
    return '';
  }
  if (type === 'reels' || type === 'plan') {
    const match = text.match(/(?:STAGE\s*5[\s\S]*?)(?:EXECUTIVE SUMMARY|Executive Summary|$)/i);
    if (match) return match[0].trim();
    return '';
  }
  return '';
}

function FormattedInstaAuditMarkdown({ content, filterStage, onCopy }) {
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
    const match = content.match(/(?:STAGE\s*4[\s\S]*?)(?:STAGE\s*5|$)/i);
    if (match) targetContent = match[0];
  } else if (filterStage === 'stage5') {
    const match = content.match(/(?:STAGE\s*5[\s\S]*?)(?:EXECUTIVE SUMMARY|Executive Summary|$)/i);
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
            <span className="code-lang-label">{codeBlockLang || 'Reel Script / Framework'}</span>
            <button
              type="button"
              className="btn-copy-sm"
              onClick={() => {
                navigator.clipboard.writeText(codeText);
                onCopy('Copied script block to clipboard!');
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
                {headerRow.map((cell, cIdx) => (
                  <th key={cIdx}>{renderInlineMarkdown(cell.trim())}</th>
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
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCode(`code-${i}`);
        inCodeBlock = false;
      } else {
        if (inTable) {
          flushTable(`tbl-${i}`);
          inTable = false;
        }
        inCodeBlock = true;
        codeBlockLang = trimmed.replace('```', '').trim();
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').slice(1, -1);
      const isSep = cells.every((c) => /^:?-+:?$/.test(c.trim()));
      if (!isSep) {
        inTable = true;
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable(`tbl-${i}`);
      inTable = false;
    }

    if (!trimmed) continue;
    if (/^={4,}/.test(trimmed)) continue;

    if (trimmed.startsWith('# ')) {
      elements.push(<h2 key={`h1-${i}`} className="strategy-h1">{trimmed.replace(/^#\s+/, '')}</h2>);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={`h2-${i}`} className="strategy-h2">{trimmed.replace(/^##\s+/, '')}</h3>);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(<h4 key={`h3-${i}`} className="strategy-h3">{trimmed.replace(/^###\s+/, '')}</h4>);
      continue;
    }

    if (/^STAGE\s*[1-5]/i.test(trimmed)) {
      elements.push(
        <div key={`stage-${i}`} className="strategy-stage-banner insta-stage-banner">
          <span className="stage-banner-badge">STAGE</span>
          <span className="stage-banner-text">{trimmed}</span>
        </div>
      );
      continue;
    }

    if (/^(?:EXECUTIVE SUMMARY|Executive Summary)/i.test(trimmed)) {
      elements.push(
        <div key={`exec-${i}`} className="strategy-stage-banner exec-summary-banner">
          <span className="stage-banner-badge exec-badge">⚡ SUMMARY</span>
          <span className="stage-banner-text">{trimmed}</span>
        </div>
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const bulletContent = trimmed.replace(/^[-*]\s+/, '');
      elements.push(
        <div key={`li-${i}`} className="strategy-li">
          <span className="strategy-bullet">•</span>
          <span className="strategy-li-text">{renderInlineMarkdown(bulletContent)}</span>
        </div>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s+(.*)/);
      elements.push(
        <div key={`oli-${i}`} className="strategy-li">
          <span className="strategy-number-badge">{match ? match[1] : '•'}</span>
          <span className="strategy-li-text">{renderInlineMarkdown(match ? match[2] : trimmed)}</span>
        </div>
      );
      continue;
    }

    if (trimmed.startsWith('>')) {
      elements.push(
        <blockquote key={`bq-${i}`} className="strategy-quote">
          {renderInlineMarkdown(trimmed.replace(/^>\s*/, ''))}
        </blockquote>
      );
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

function InstaProfileAuditSection({ apiHealth, customApiKey, API_BASE, onOpenKeyModal }) {
  const [profileInput, setProfileInput] = useState(() => {
    return sessionStorage.getItem('ad_insta_prefill_handle') || '';
  });
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditStageIndex, setAuditStageIndex] = useState(0);
  const [auditError, setAuditError] = useState('');
  const [auditResult, setAuditResult] = useState('');
  const [auditMeta, setAuditMeta] = useState(null);
  const [activeStageFilter, setActiveStageFilter] = useState('all');
  const [copyNotice, setCopyNotice] = useState('');

  useEffect(() => {
    const prefill = sessionStorage.getItem('ad_insta_prefill_handle');
    if (prefill) {
      setProfileInput(prefill);
      sessionStorage.removeItem('ad_insta_prefill_handle');
    }
  }, []);
  const [auditHistory, setAuditHistory] = useState(() => {
    try {
      const raw = localStorage.getItem('ad_insta_audits');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const notifyCopy = (msg) => {
    setCopyNotice(msg);
    setTimeout(() => setCopyNotice(''), 3000);
  };

  const handleRunAudit = async (targetVal = null) => {
    const rawVal = (typeof targetVal === 'string' ? targetVal : profileInput).trim();
    if (!rawVal) {
      setAuditError('Please enter an Instagram profile URL or username handle (e.g. @alexhormozi or https://instagram.com/hubermanlab).');
      return;
    }

    setAuditError('');
    setAuditLoading(true);
    setAuditStageIndex(1);

    const timer = setInterval(() => {
      setAuditStageIndex((prev) => (prev < 5 ? prev + 1 : prev));
    }, 4500);

    const effectiveKey = typeof customApiKey === 'string' ? customApiKey.trim() : '';
    const payload = { url: rawVal };
    if (effectiveKey) payload.apiKey = effectiveKey;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (effectiveKey) headers['X-Gemini-API-Key'] = effectiveKey;

      const res = await fetch(`${API_BASE}/api/insta-audit`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze Instagram profile');
      }

      const resultText = data.result;
      const meta = {
        handle: data.handle || rawVal,
        url: data.url || rawVal,
        timestamp: new Date().toLocaleString(),
        model: data.model || apiHealth.model || 'gemini-2.5-flash',
      };

      setAuditResult(resultText);
      setAuditMeta(meta);
      setActiveStageFilter('all');
      window.scrollTo({ top: 120, behavior: 'smooth' });

      const historyItem = {
        id: Date.now().toString(),
        ...meta,
        result: resultText,
      };
      setAuditHistory((prev) => {
        const updated = [historyItem, ...prev.filter((p) => p.handle !== meta.handle)].slice(0, 20);
        try {
          localStorage.setItem('ad_insta_audits', JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed saving insta audit history:', e);
        }
        return updated;
      });
    } catch (err) {
      setAuditError(err.message || 'An error occurred while auditing the Instagram profile.');
    } finally {
      clearInterval(timer);
      setAuditLoading(false);
      setAuditStageIndex(0);
    }
  };

  const handleCopyFullAudit = () => {
    if (!auditResult) return;
    navigator.clipboard.writeText(auditResult);
    notifyCopy('Full Instagram Profile Audit copied to clipboard!');
  };

  const handleCopyReelPlan = () => {
    const reelSnippet = extractInstaAuditSnippet(auditResult, 'reels');
    if (reelSnippet) {
      navigator.clipboard.writeText(reelSnippet);
      notifyCopy('🎬 5 Outperforming Reel Ideas & Scripts copied!');
    } else {
      navigator.clipboard.writeText(auditResult);
      notifyCopy('Audit copied to clipboard.');
    }
  };

  const handleCopySummary = () => {
    const summarySnippet = extractInstaAuditSnippet(auditResult, 'summary');
    if (summarySnippet) {
      navigator.clipboard.writeText(summarySnippet);
      notifyCopy('Executive Summary copied!');
    } else {
      notifyCopy('Audit copied to clipboard.');
      navigator.clipboard.writeText(auditResult);
    }
  };

  const handleLoadHistory = (item) => {
    setAuditResult(item.result);
    setProfileInput(item.url || item.handle);
    setAuditMeta({
      handle: item.handle,
      url: item.url,
      timestamp: item.timestamp,
      model: item.model,
    });
    setActiveStageFilter('all');
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const handleDeleteHistory = (id, e) => {
    e.stopPropagation();
    setAuditHistory((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem('ad_insta_audits', JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to delete history:', err);
      }
      return updated;
    });
  };

  const hasReelPlan = Boolean(extractInstaAuditSnippet(auditResult, 'reels'));

  return (
    <div className="insta-audit-section">
      {copyNotice && <div className="strategy-toast-notice">{copyNotice}</div>}

      {/* Hero Header */}
      <div className="strategy-hero-card insta-hero-card">
        <div className="strategy-hero-badge insta-hero-badge">
          <span className="badge-pulse"></span>
          <span>Competitive Intelligence • Instagram Profile Auditor</span>
        </div>
        <h2 className="strategy-hero-title">Instagram Profile Auditor</h2>
        <p className="strategy-hero-subtitle">
          Paste any Instagram profile URL or handle. The AI investigates their top-performing Reels & Carousels, diagnoses what's working vs. broken, uncovers hidden niche content gaps, and builds an outperforming content plan with <strong>5 ready-to-shoot Reel ideas grounded in their winning videos</strong>.
        </p>
      </div>

      {/* Input Form Card */}
      <section className="card strategy-form-card insta-form-card">
        <div className="form-group">
          <div className="label-with-hint">
            <label className="input-label" htmlFor="instaProfileInput">
              <strong>Instagram Profile URL or Username Handle *</strong>
            </label>
            <span className="label-hint">Paste full link or @username</span>
          </div>

          <div className="insta-input-wrapper">
            <span className="insta-prefix-icon">📸</span>
            <input
              id="instaProfileInput"
              type="text"
              className="url-field insta-text-field"
              placeholder="e.g. https://www.instagram.com/hubermanlab/ or @alexhormozi or zomato"
              value={profileInput}
              onChange={(e) => setProfileInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRunAudit();
                }
              }}
            />
          </div>

          <div className="strategy-quick-chips">
            <span className="chips-label">Popular creators to test:</span>
            {SAMPLE_INSTA_PROFILES.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                className="quick-chip-btn"
                onClick={() => {
                  setProfileInput(sample.url);
                  handleRunAudit(sample.url);
                }}
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        {auditError && <div className="error-toast">{auditError}</div>}

        <button
          type="button"
          className="btn-primary btn-run-pipeline btn-run-insta-audit"
          onClick={() => handleRunAudit()}
          disabled={auditLoading}
        >
          {auditLoading ? (
            <>
              <span className="spinner"></span>
              <span>Auditing Profile Signals & Reels with Gemini...</span>
            </>
          ) : (
            <>
              <span>🔍 Run 5-Stage Instagram Profile Audit ➡️</span>
            </>
          )}
        </button>
      </section>

      {/* Live Pipeline Step Progress Bar */}
      {auditLoading && (
        <div className="pipeline-progress-card">
          <div className="progress-header">
            <h4>⚡ Analyzing Instagram Profile Intelligence</h4>
            <span className="progress-status-pill">Live Research</span>
          </div>
          <div className="pipeline-steps">
            <div className={`pipeline-step ${auditStageIndex >= 1 ? 'active' : ''} ${auditStageIndex > 1 ? 'completed' : ''}`}>
              <div className="step-circle">{auditStageIndex > 1 ? '✓' : '1'}</div>
              <div className="step-body">
                <strong>Stage 1: Content Formats & Engagement Signals</strong>
                <span>Auditing Reels vs Carousels vs Static distribution and view/like ratios</span>
              </div>
            </div>
            <div className={`pipeline-step ${auditStageIndex >= 2 ? 'active' : ''} ${auditStageIndex > 2 ? 'completed' : ''}`}>
              <div className="step-circle">{auditStageIndex > 2 ? '✓' : '2'}</div>
              <div className="step-body">
                <strong>Stage 2: 5-10 Top Performing Posts & Hook Patterns</strong>
                <span>Deconstructing 0-3s visual hooks, pacing, tone, and thumbnail contrast</span>
              </div>
            </div>
            <div className={`pipeline-step ${auditStageIndex >= 3 ? 'active' : ''} ${auditStageIndex > 3 ? 'completed' : ''}`}>
              <div className="step-circle">{auditStageIndex > 3 ? '✓' : '3'}</div>
              <div className="step-body">
                <strong>Stage 3: The Good & The Bad Audit</strong>
                <span>Unvarnished diagnosis of authority strengths, buried captions & inconsistent cadence</span>
              </div>
            </div>
            <div className={`pipeline-step ${auditStageIndex >= 4 ? 'active' : ''} ${auditStageIndex > 4 ? 'completed' : ''}`}>
              <div className="step-circle">{auditStageIndex > 4 ? '✓' : '4'}</div>
              <div className="step-body">
                <strong>Stage 4: Niche Content Gaps & Competitor Opportunities</strong>
                <span>Uncovering high-converting topics competitors cover that this account neglects</span>
              </div>
            </div>
            <div className={`pipeline-step ${auditStageIndex >= 5 ? 'active' : ''}`}>
              <div className="step-circle">{auditStageIndex >= 5 ? '⏳' : '5'}</div>
              <div className="step-body">
                <strong>Stage 5: Outperforming Content Plan & 5 Ready-to-Shoot Reels</strong>
                <span>Writing 5 specific, grounded Reel scripts to outperform their best videos</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Results Presentation Card */}
      {auditResult && !auditLoading && (
        <div className="strategy-results-card insta-results-card">
          <div className="strategy-results-header">
            <div className="results-title-group">
              <span className="strategy-topic-tag insta-tag">Instagram Profile Audit</span>
              <h3 className="results-niche-title">{auditMeta?.handle || profileInput}</h3>
              <div className="strategy-meta-tags">
                <span className="meta-tag">
                  🔗 <a href={auditMeta?.url || profileInput} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
                    View on Instagram ↗
                  </a>
                </span>
                <span className="meta-tag">📅 {auditMeta?.timestamp}</span>
                {auditMeta?.model && <span className="meta-tag model-tag">⚡ {auditMeta.model}</span>}
              </div>
            </div>

            <div className="results-action-buttons">
              <button
                type="button"
                className="btn-secondary btn-action-sm"
                onClick={handleCopyFullAudit}
              >
                📋 Copy Full Audit
              </button>
              {hasReelPlan && (
                <button
                  type="button"
                  className="btn-secondary btn-action-sm"
                  onClick={handleCopyReelPlan}
                >
                  🎬 Copy 5 Reel Ideas
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
                  setAuditResult('');
                  window.scrollTo({ top: 120, behavior: 'smooth' });
                }}
              >
                🔄 Audit Another Profile
              </button>
            </div>
          </div>

          {/* Stage Filter Tabs */}
          <div className="stage-filter-tabs">
            {[
              { id: 'all', label: '📋 All 5 Stages' },
              { id: 'summary', label: '⚡ Executive Summary' },
              { id: 'stage1', label: '📊 1. Formats & Engagement' },
              { id: 'stage2', label: '🔥 2. Top Posts & Patterns' },
              { id: 'stage3', label: '⚖️ 3. Good & Bad Audit' },
              { id: 'stage4', label: '🎯 4. Niche Content Gaps' },
              { id: 'stage5', label: '🚀 5. Outperforming 5-Reel Plan' },
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
            <FormattedInstaAuditMarkdown
              content={auditResult}
              filterStage={activeStageFilter}
              onCopy={notifyCopy}
            />
          </div>
        </div>
      )}

      {/* Saved Profile Audits History */}
      {auditHistory.length > 0 && (
        <section className="card strategy-history-card">
          <div className="history-header">
            <h4>💾 Saved Instagram Audits ({auditHistory.length})</h4>
            <span className="history-subtitle">Past creator audits saved in local browser storage</span>
          </div>

          <div className="history-items-grid">
            {auditHistory.map((item) => (
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
                    title="Delete audit"
                    onClick={(e) => handleDeleteHistory(item.id, e)}
                  >
                    ✕
                  </button>
                </div>
                <h5 className="history-item-niche">{item.handle}</h5>
                <div className="history-item-badges">
                  <span className="badge-sm">Instagram Audit</span>
                  {item.model && <span className="badge-sm">{item.model}</span>}
                </div>
                <button type="button" className="btn-load-history">
                  Load Audit →
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Instagram Niche Competitive Intelligence Component & Helpers
// ---------------------------------------------------------------------------

const NICHE_DATA_TEMPLATE = `Account 1:
- Handle: @competitor_one
- Follower Count: 85K
- Bio: Helping founders scale organic reach | Free playbook below 👇
- Link-in-Bio: beacons.ai/competitor_one -> Free Playbook / Community
- Posting Frequency: 5 Reels/week, 2 Carousels/week
- Post Formats: 70% Reels, 30% Carousels
- Rough Engagement: ~2.5K avg likes, 180 comments (high save rate)
- Last 10-15 Post Captions / Hooks:
  1. "Stop creating content every day (do this weekly batching system instead)" [Reel, 4.2k likes, 310 comments]
  2. "The 4-step framework we used to book 38 calls without paid ads" [Carousel, 2.1k likes, 190 comments]
  3. "Unpopular opinion: Long-form captions are killing your reach" [Reel, 6.8k likes, 520 comments]
  4. "3 tools I use to write a week of content in 45 minutes" [Reel, 3.4k likes, 240 comments]
  5. "Why your Instagram views dropped this week (and the fix)" [Carousel, 1.9k likes, 140 comments]

Account 2:
- Handle: @competitor_two
- Follower Count: 210K
- Bio: Micro-SaaS founder sharing daily growth experiments 🚀
- Link-in-Bio: saastool.io/free-trial
- Posting Frequency: Daily Reels (talking head + screen share)
- Post Formats: 90% Reels, 10% Carousels
- Rough Engagement: ~8K avg likes, 450 comments
- Last 10-15 Post Captions / Hooks:
  1. "3 AI automations that save me 15 hours every single week" [Reel, 12k likes, 890 comments]
  2. "How I built a $40k/mo tool with zero employees" [Reel, 9.4k likes, 610 comments]
  3. "If you still do data entry manually, watch this" [Reel, 7.8k likes, 420 comments]

Account 3:
- Handle: @competitor_three
- Follower Count: 32K
- Bio: Boutique B2B consulting | We scale systems for 7-figure creators
- Link-in-Bio: cal.com/consulting-call
- Posting Frequency: 3 Carousels/week
- Post Formats: 80% Carousels, 20% Static
- Rough Engagement: ~900 likes, 120 comments (very high conversion DMs)
- Last 10-15 Post Captions / Hooks:
  1. "Swipe through our exact client onboarding SOP" [Carousel, 1.2k likes, 160 comments]
  2. "Why most $50k/mo agencies break before reaching $100k" [Carousel, 1.4k likes, 180 comments]
  3. "The one metrics dashboard every founder should check on Monday" [Carousel, 850 likes, 95 comments]`;

const SAMPLE_NICHE_SAAS = {
  niche: 'B2B SaaS & AI Productivity',
  goal: 'Launch a new creator-led SaaS page, find high-intent content gaps & drive free trials',
  accountsData: `Account 1:
- Handle: @flowdesk_app
- Follower Count: 142K
- Bio: Automate your daily repetitive work | 14-day free trial 👇
- Link-in-Bio: flowdesk.io/trial -> SaaS trial signup
- Posting Frequency: 5 Reels/week, 2 Carousels/week
- Post Formats: 75% Reels, 25% Carousels
- Rough Engagement: ~4.5K avg likes, 320 comments per post
- Last 10-15 Post Captions / Hooks:
  1. "Stop doing client follow-ups manually (here is the 1-click workflow)" [Reel, 8.2k likes, 540 comments]
  2. "I automated 80% of my inbox in 10 minutes (steal this zap)" [Reel, 6.1k likes, 410 comments]
  3. "Why Google Docs is secretly killing your team's weekly output" [Carousel, 3.4k likes, 290 comments]
  4. "3 chrome extensions that feel illegal for project managers" [Reel, 9.5k likes, 720 comments]
  5. "How to build a custom CRM without writing a single line of code" [Carousel, 2.8k likes, 180 comments]
  6. "The exact stack we used to handle 500 support tickets with 1 person" [Reel, 4.3k likes, 260 comments]

Account 2:
- Handle: @saascodex
- Follower Count: 39K
- Bio: We build & teardown 7-figure micro-SaaS | Free weekly breakdown newsletter 📬
- Link-in-Bio: saascodex.substack.com -> Free Newsletter & Notion swipe files
- Posting Frequency: 4 Carousels/week, 1 Reel/week
- Post Formats: 80% Carousels, 20% Reels
- Rough Engagement: ~1.8K avg likes, 410 comments (extremely high comment quality & saves)
- Last 10-15 Post Captions / Hooks:
  1. "5 Notion templates generating $10k/mo on pure autopilot" [Carousel, 2.9k likes, 580 comments]
  2. "The technical architecture of a $1M ARR solo founder" [Carousel, 3.2k likes, 620 comments]
  3. "How we cut customer churn from 8% to 1.2% with one automated email" [Carousel, 2.1k likes, 490 comments]
  4. "Why 90% of AI wrapper startups will die before Q4" [Reel, 1.4k likes, 310 comments]
  5. "The exact pricing page tear-down that doubled our checkout conversion" [Carousel, 2.4k likes, 510 comments]

Account 3:
- Handle: @productivityos
- Follower Count: 235K
- Bio: Daily AI tools to work 4 hours a day 🚀 | Download free prompt pack
- Link-in-Bio: stan.store/prodos -> $27 prompt pack & affiliate links
- Posting Frequency: Daily Reels (7 Reels/week, heavy B-roll + text overlays)
- Post Formats: 95% Reels, 5% Static
- Rough Engagement: ~9.8K avg likes, 680 comments (viral reach, shallow comment depth)
- Last 10-15 Post Captions / Hooks:
  1. "3 AI websites that feel illegal to know in 2026" [Reel, 24k likes, 1.4k comments]
  2. "Stop using ChatGPT like an amateur (use this prompt instead)" [Reel, 18k likes, 1.1k comments]
  3. "If you are not using this AI tool, you are wasting 3 hours every day" [Reel, 14k likes, 820 comments]
  4. "This free tool replaces 5 paid apps instantly" [Reel, 11k likes, 740 comments]
  5. "Secret AI hack for Excel that nobody talks about" [Reel, 15k likes, 930 comments]`,
};

const SAMPLE_NICHE_FITNESS = {
  niche: 'Online Fitness Coaching for Busy Founders & Executives',
  goal: 'Position a $3,000 high-ticket coaching offer and find untouched content angles nobody covers',
  accountsData: `Account 1:
- Handle: @founderfit_alex
- Follower Count: 68K
- Bio: Dropped 40lbs while scaling to $2M ARR | Helping tech founders get lean without giving up alcohol or family dinners
- Link-in-Bio: typeform.com/founderfit-apply -> $3,500 12-week high-ticket application
- Posting Frequency: 4 Reels/week, 2 Carousels/week
- Post Formats: 70% Reels, 30% Carousels
- Rough Engagement: ~2.8K avg likes, 260 comments
- Last 10-15 Post Captions / Hooks:
  1. "Why doing 45 minutes of cardio is keeping busy founders fat" [Reel, 5.2k likes, 410 comments]
  2. "The exact 3-meal blueprint I use while working 65 hours a week" [Carousel, 3.8k likes, 380 comments]
  3. "How my client lost 28lbs without stepping foot in a commercial gym" [Carousel, 2.4k likes, 290 comments]
  4. "Stop cutting carbs on Monday only to binge on Friday night" [Reel, 4.1k likes, 320 comments]
  5. "The travel nutrition protocol for founders living out of airports" [Carousel, 2.9k likes, 270 comments]

Account 2:
- Handle: @dr_metabolic
- Follower Count: 190K
- Bio: MD & Functional Health Specialist | Reversing executive burnout & insulin resistance
- Link-in-Bio: masterclass.drmetabolic.com -> Webinar -> $1,200 lab review package
- Posting Frequency: 5 Reels/week (talking head in white coat / clinical setting)
- Post Formats: 85% Reels, 15% Carousels
- Rough Engagement: ~7.5K avg likes, 610 comments
- Last 10-15 Post Captions / Hooks:
  1. "If you wake up tired at 3 AM every night, your liver is telling you this" [Reel, 16k likes, 1.2k comments]
  2. "The #1 blood test your doctor never runs for brain fog" [Reel, 12k likes, 880 comments]
  3. "3 supplements that actually lower afternoon cortisol spikes" [Reel, 9.4k likes, 620 comments]
  4. "Why high protein might actually be causing your bloating" [Reel, 6.7k likes, 490 comments]
  5. "The circadian light routine that fixed my executive insomnia" [Carousel, 4.2k likes, 350 comments]

Account 3:
- Handle: @deskbound_physique
- Follower Count: 26K
- Bio: Sitting 10 hours a day? Fix your posture, kill lower back pain & build visible abs with 3x40min workouts
- Link-in-Bio: DM 'POSTURE' for free mobility routine
- Posting Frequency: 3 Reels/week, 3 Carousels/week
- Post Formats: 50% Reels, 50% Carousels
- Rough Engagement: ~1.1K avg likes, 190 comments (extremely high DM conversion)
- Last 10-15 Post Captions / Hooks:
  1. "Do this 2-minute stretch before opening your laptop" [Reel, 3.6k likes, 340 comments]
  2. "The dead hang protocol: How 3 minutes a day cured my spine compression" [Carousel, 2.2k likes, 280 comments]
  3. "Why standard ergonomic chairs make your anterior pelvic tilt worse" [Carousel, 1.8k likes, 210 comments]
  4. "3 exercises to undo 8 hours of slouching" [Reel, 2.9k likes, 310 comments]
  5. "The hip flexor release that immediately relieves lower back tension" [Reel, 2.1k likes, 220 comments]`,
};

function extractNicheIntelSnippet(text, type) {
  if (!text) return '';
  if (type === 'summary') {
    const match = text.match(/(?:#+\s*)?(?:EXECUTIVE SUMMARY|Executive Summary)[\s\S]*$/i);
    return match ? match[0].trim() : '';
  }
  if (type === 'hooks') {
    const match = text.match(/(?:STAGE\s*3[\s\S]*?)(?:STAGE\s*4|$)/i);
    return match ? match[0].trim() : '';
  }
  if (type === 'gaps') {
    const match = text.match(/(?:STAGE\s*6[\s\S]*?)(?:STAGE\s*7|$)/i);
    return match ? match[0].trim() : '';
  }
  if (type === 'plan') {
    const match = text.match(/(?:STAGE\s*7[\s\S]*?)(?:EXECUTIVE SUMMARY|Executive Summary|$)/i);
    return match ? match[0].trim() : '';
  }
  if (type === 'tiers') {
    const match = text.match(/(?:STAGE\s*1[\s\S]*?)(?:STAGE\s*2|$)/i);
    return match ? match[0].trim() : '';
  }
  return '';
}

function FormattedNicheIntelMarkdown({ content, filterStage, onCopy }) {
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
    const match = content.match(/(?:STAGE\s*4[\s\S]*?)(?:STAGE\s*5|$)/i);
    if (match) targetContent = match[0];
  } else if (filterStage === 'stage5') {
    const match = content.match(/(?:STAGE\s*5[\s\S]*?)(?:STAGE\s*6|$)/i);
    if (match) targetContent = match[0];
  } else if (filterStage === 'stage6') {
    const match = content.match(/(?:STAGE\s*6[\s\S]*?)(?:STAGE\s*7|$)/i);
    if (match) targetContent = match[0];
  } else if (filterStage === 'stage7') {
    const match = content.match(/(?:STAGE\s*7[\s\S]*?)(?:EXECUTIVE SUMMARY|Executive Summary|$)/i);
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
        <div key={key} className="strategy-code-box niche-code-box">
          <div className="strategy-code-header">
            <span className="code-lang-label">{codeBlockLang || 'Formula / Template'}</span>
            <button
              type="button"
              className="btn-copy-sm"
              onClick={() => {
                navigator.clipboard.writeText(codeText);
                onCopy('Copied template block to clipboard!');
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
          <table className="strategy-table niche-strategy-table">
            <thead>
              <tr>
                {headerRow.map((cell, cIdx) => (
                  <th key={cIdx}>{renderInlineMarkdown(cell.trim())}</th>
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
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCode(`code-${i}`);
        inCodeBlock = false;
      } else {
        if (inTable) {
          flushTable(`tbl-${i}`);
          inTable = false;
        }
        inCodeBlock = true;
        codeBlockLang = trimmed.replace('```', '').trim();
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').slice(1, -1);
      const isSep = cells.every((c) => /^:?-+:?$/.test(c.trim()));
      if (!isSep) {
        inTable = true;
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable(`tbl-${i}`);
      inTable = false;
    }

    if (!trimmed) continue;
    if (/^={4,}/.test(trimmed)) continue;

    if (trimmed.startsWith('# ')) {
      elements.push(<h2 key={`h1-${i}`} className="strategy-h1">{trimmed.replace(/^#\s+/, '')}</h2>);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={`h2-${i}`} className="strategy-h2">{trimmed.replace(/^##\s+/, '')}</h3>);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(<h4 key={`h3-${i}`} className="strategy-h3">{trimmed.replace(/^###\s+/, '')}</h4>);
      continue;
    }

    if (/^STAGE\s*[1-7]/i.test(trimmed)) {
      elements.push(
        <div key={`stage-${i}`} className="strategy-stage-banner niche-stage-banner">
          <span className="stage-banner-badge niche-badge">STAGE</span>
          <span className="stage-banner-text">{trimmed}</span>
        </div>
      );
      continue;
    }

    if (/^(?:EXECUTIVE SUMMARY|Executive Summary)/i.test(trimmed)) {
      elements.push(
        <div key={`exec-${i}`} className="strategy-stage-banner exec-summary-banner niche-exec-banner">
          <span className="stage-banner-badge exec-badge">⚡ SUMMARY</span>
          <span className="stage-banner-text">{trimmed}</span>
        </div>
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const bulletContent = trimmed.replace(/^[-*]\s+/, '');
      elements.push(
        <div key={`li-${i}`} className="strategy-li">
          <span className="strategy-bullet">•</span>
          <span className="strategy-li-text">{renderInlineMarkdown(bulletContent)}</span>
        </div>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s+(.*)/);
      elements.push(
        <div key={`oli-${i}`} className="strategy-li">
          <span className="strategy-number-badge niche-number-badge">{match ? match[1] : '•'}</span>
          <span className="strategy-li-text">{renderInlineMarkdown(match ? match[2] : trimmed)}</span>
        </div>
      );
      continue;
    }

    if (trimmed.startsWith('>')) {
      elements.push(
        <blockquote key={`bq-${i}`} className="strategy-quote niche-quote">
          {renderInlineMarkdown(trimmed.replace(/^>\s*/, ''))}
        </blockquote>
      );
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

const LOCATION_CONFIG = {
  Global: {
    name: '🌍 Global / Worldwide (All Locations)',
    states: ['All Regions / Worldwide'],
  },
  'United States': {
    name: '🇺🇸 United States',
    states: [
      'All States (Nationwide)',
      'California',
      'New York',
      'Texas',
      'Florida',
      'Illinois',
      'Washington',
      'Georgia',
      'North Carolina',
      'Massachusetts',
      'Colorado',
      'Pennsylvania',
      'Arizona',
      'Ohio',
      'Michigan',
      'New Jersey',
      'Virginia',
      'Utah',
      'Oregon',
      'Nevada',
      'Tennessee',
    ],
  },
  India: {
    name: '🇮🇳 India',
    states: [
      'All States / Nationwide',
      'Maharashtra (Mumbai / Pune)',
      'Karnataka (Bengaluru)',
      'Delhi / NCR',
      'Tamil Nadu (Chennai)',
      'Telangana (Hyderabad)',
      'Gujarat (Ahmedabad / Surat)',
      'Uttar Pradesh',
      'West Bengal (Kolkata)',
      'Kerala (Kochi / Trivandrum)',
      'Punjab (Chandigarh)',
      'Rajasthan (Jaipur)',
      'Haryana (Gurugram)',
      'Goa',
      'Madhya Pradesh (Indore)',
      'Andhra Pradesh',
    ],
  },
  'United Kingdom': {
    name: '🇬🇧 United Kingdom',
    states: [
      'All Regions',
      'Greater London',
      'South East England',
      'North West England (Manchester)',
      'West Midlands (Birmingham)',
      'Yorkshire & Humber (Leeds)',
      'Scotland (Edinburgh / Glasgow)',
      'South West England (Bristol)',
      'East of England (Cambridge)',
      'Wales (Cardiff)',
      'Northern Ireland (Belfast)',
    ],
  },
  Canada: {
    name: '🇨🇦 Canada',
    states: [
      'All Provinces',
      'Ontario (Toronto / Ottawa)',
      'British Columbia (Vancouver)',
      'Quebec (Montreal)',
      'Alberta (Calgary / Edmonton)',
      'Manitoba (Winnipeg)',
      'Nova Scotia (Halifax)',
      'Saskatchewan',
    ],
  },
  Australia: {
    name: '🇦🇺 Australia',
    states: [
      'All States',
      'New South Wales (Sydney)',
      'Victoria (Melbourne)',
      'Queensland (Brisbane / Gold Coast)',
      'Western Australia (Perth)',
      'South Australia (Adelaide)',
      'Australian Capital Territory (Canberra)',
    ],
  },
  'United Arab Emirates': {
    name: '🇦🇪 United Arab Emirates (UAE)',
    states: [
      'All Emirates',
      'Dubai',
      'Abu Dhabi',
      'Sharjah',
      'Ajman',
      'Ras Al Khaimah',
    ],
  },
  Germany: {
    name: '🇩🇪 Germany',
    states: [
      'All States',
      'Berlin',
      'Bavaria (Munich)',
      'North Rhine-Westphalia (Cologne / Düsseldorf)',
      'Baden-Württemberg (Stuttgart)',
      'Hesse (Frankfurt)',
      'Hamburg',
    ],
  },
  France: {
    name: '🇫🇷 France',
    states: [
      'All Regions',
      'Île-de-France (Paris)',
      'Auvergne-Rhône-Alpes (Lyon)',
      'Provence-Alpes-Côte d\'Azur (Marseille / Nice)',
      'Occitanie (Toulouse)',
      'Nouvelle-Aquitaine (Bordeaux)',
    ],
  },
  Singapore: {
    name: '🇸🇬 Singapore',
    states: [
      'Singapore (All Areas)',
      'Central Region / CBD',
      'East Region',
      'West Region',
      'North Region',
    ],
  },
  Brazil: {
    name: '🇧🇷 Brazil',
    states: [
      'All States',
      'São Paulo',
      'Rio de Janeiro',
      'Minas Gerais',
      'Paraná (Curitiba)',
      'Rio Grande do Sul (Porto Alegre)',
      'Federal District (Brasília)',
    ],
  },
  Custom: {
    name: '🌐 Other Country / Custom City',
    states: [],
  },
};

function InstaNicheIntelSection({ apiHealth, customApiKey, API_BASE, onOpenKeyModal, onSwitchToProfileAudit }) {
  const [niche, setNiche] = useState('B2B SaaS & AI Productivity');
  const [goal, setGoal] = useState('Launch a new creator-led SaaS page, find high-intent content gaps & drive free trials');
  const [accountsData, setAccountsData] = useState(SAMPLE_NICHE_SAAS.accountsData);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelStageIndex, setIntelStageIndex] = useState(0);
  const [intelError, setIntelError] = useState('');
  const [intelResult, setIntelResult] = useState('');
  const [intelMeta, setIntelMeta] = useState(null);
  const [activeStageFilter, setActiveStageFilter] = useState('all');
  const [copyNotice, setCopyNotice] = useState('');

  // Location Narrowing State
  const [selectedCountry, setSelectedCountry] = useState('Global');
  const [selectedState, setSelectedState] = useState('All Regions / Worldwide');
  const [customCountry, setCustomCountry] = useState('');
  const [customState, setCustomState] = useState('');

  // Auto-Discovery State
  const [discoveringAccounts, setDiscoveringAccounts] = useState(false);
  const [discoveredAccounts, setDiscoveredAccounts] = useState([]);
  const [discoveryError, setDiscoveryError] = useState('');
  const [importedHandles, setImportedHandles] = useState([]);

  const [intelHistory, setIntelHistory] = useState(() => {
    try {
      const raw = localStorage.getItem('ad_insta_niche_audits');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const notifyCopy = (msg) => {
    setCopyNotice(msg);
    setTimeout(() => setCopyNotice(''), 3000);
  };

  const handleCountryChange = (e) => {
    const newCountry = e.target.value;
    setSelectedCountry(newCountry);
    const config = LOCATION_CONFIG[newCountry];
    if (config && config.states && config.states.length > 0) {
      setSelectedState(config.states[0]);
    } else {
      setSelectedState('');
    }
  };

  const getActiveLocationLabel = () => {
    if (selectedCountry === 'Custom') {
      const parts = [customState.trim(), customCountry.trim()].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : 'Custom Location';
    }
    if (selectedCountry === 'Global') {
      return 'Global / Worldwide';
    }
    const stateClean = selectedState && !selectedState.startsWith('All ') ? selectedState.split(' (')[0] : '';
    return stateClean ? `${stateClean}, ${selectedCountry}` : selectedCountry;
  };

  const serializeAccountsToCohortData = (accounts) => {
    return accounts.map((acc, idx) => {
      const hooks = Array.isArray(acc.top_hooks) ? acc.top_hooks : [];
      const hooksStr = hooks.map((h, hIdx) => `  ${hIdx + 1}. "${String(h).replace(/"/g, '')}"`).join('\n');
      return `Account ${idx + 1}:
- Handle: ${acc.handle || '@creator'}
- Name: ${acc.name || 'Creator'}
- Follower Count: ${acc.follower_count || 'Unknown'}
- Location: ${acc.location || getActiveLocationLabel()}
- Tier: ${acc.tier || 'Competitor'}
- Bio: ${acc.bio || 'N/A'}
- Link-in-Bio: ${acc.link_in_bio || 'N/A'}
- Primary Format: ${acc.primary_format || 'Reels & Carousels'}
- Rough Engagement: ${acc.rough_engagement || 'High'}
- Posting Frequency: ${acc.posting_frequency || 'Regular'}
- Growth Secret: ${acc.growth_secret || 'Strong hooks & retention'}
- Last 10-15 Post Captions / Hooks:
${hooksStr || '  1. "Top performing hook in this niche"'}`;
    }).join('\n\n');
  };

  const handleDiscoverAccounts = async () => {
    const trimmedNiche = niche.trim();
    if (!trimmedNiche) {
      setDiscoveryError('Please enter a target niche or industry first to discover high-performing accounts.');
      return;
    }

    setDiscoveryError('');
    setDiscoveringAccounts(true);

    const effectiveCountry = selectedCountry === 'Custom' ? customCountry.trim() : selectedCountry;
    const effectiveState = selectedCountry === 'Custom' ? customState.trim() : selectedState;
    const customLocStr = selectedCountry === 'Custom' ? [customState.trim(), customCountry.trim()].filter(Boolean).join(', ') : '';

    const effectiveKey = typeof customApiKey === 'string' ? customApiKey.trim() : '';
    const payload = {
      niche: trimmedNiche,
      goal: goal.trim() || 'Find high-performing accounts and content gaps',
      country: effectiveCountry,
      state: effectiveState,
      custom_location: customLocStr,
    };
    if (effectiveKey) payload.apiKey = effectiveKey;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (effectiveKey) headers['X-Gemini-API-Key'] = effectiveKey;

      const res = await fetch(`${API_BASE}/api/insta-niche-intel/discover`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to discover competitor accounts.');
      }

      const foundList = Array.isArray(data.accounts) ? data.accounts : [];
      if (foundList.length === 0) {
        throw new Error(`No accounts found for "${trimmedNiche}" in ${getActiveLocationLabel()}. Try using broader niche keywords or a wider location.`);
      }

      setDiscoveredAccounts(foundList);
      notifyCopy(`✨ Discovered ${foundList.length} verified accounts in ${trimmedNiche} (${getActiveLocationLabel()})!`);
    } catch (err) {
      setDiscoveryError(err.message || 'Error discovering accounts.');
    } finally {
      setDiscoveringAccounts(false);
    }
  };

  const handleImportAllDiscovered = () => {
    if (!discoveredAccounts || discoveredAccounts.length === 0) return;
    const formatted = serializeAccountsToCohortData(discoveredAccounts);
    setAccountsData(formatted);
    setImportedHandles(discoveredAccounts.map((a) => a.handle));
    notifyCopy(`✨ Imported all ${discoveredAccounts.length} accounts into teardown data!`);
  };

  const handleAddSingleAccount = (account) => {
    const singleFormatted = serializeAccountsToCohortData([account]);
    setAccountsData((prev) => {
      const cleanPrev = prev.trim();
      return cleanPrev ? `${cleanPrev}\n\n${singleFormatted}` : singleFormatted;
    });
    setImportedHandles((prev) => [...new Set([...prev, account.handle])]);
    notifyCopy(`Added ${account.handle} to cohort data!`);
  };

  const handleRunIntel = async () => {
    const trimmedNiche = niche.trim();
    const trimmedGoal = goal.trim();
    const trimmedData = accountsData.trim();

    if (!trimmedNiche) {
      setIntelError('Please enter the target niche or industry.');
      return;
    }
    if (!trimmedData) {
      setIntelError('Please paste competitive data for at least 1 or 2 competitor accounts, or load a sample cohort.');
      return;
    }

    setIntelError('');
    setIntelLoading(true);
    setIntelStageIndex(1);

    const timer = setInterval(() => {
      setIntelStageIndex((prev) => (prev < 7 ? prev + 1 : prev));
    }, 4000);

    const effectiveKey = typeof customApiKey === 'string' ? customApiKey.trim() : '';
    const payload = {
      niche: trimmedNiche,
      goal: trimmedGoal || 'Find content gaps and build a 30-day content plan',
      accountsData: trimmedData,
    };
    if (effectiveKey) payload.apiKey = effectiveKey;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (effectiveKey) headers['X-Gemini-API-Key'] = effectiveKey;

      const res = await fetch(`${API_BASE}/api/insta-niche-intel`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze niche competitive intelligence');
      }

      const resultText = data.result;
      const meta = {
        niche: data.niche || trimmedNiche,
        goal: data.goal || trimmedGoal,
        timestamp: new Date().toLocaleString(),
        model: data.model || apiHealth.model || 'gemini-2.5-flash',
      };

      setIntelResult(resultText);
      setIntelMeta(meta);
      setActiveStageFilter('all');
      window.scrollTo({ top: 120, behavior: 'smooth' });

      const historyItem = {
        id: Date.now().toString(),
        ...meta,
        result: resultText,
        accountsData: trimmedData,
      };

      setIntelHistory((prev) => {
        const updated = [historyItem, ...prev.filter((p) => p.niche !== meta.niche)].slice(0, 20);
        try {
          localStorage.setItem('ad_insta_niche_audits', JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed saving niche intel history:', e);
        }
        return updated;
      });
    } catch (err) {
      setIntelError(err.message || 'An error occurred during competitive intelligence analysis.');
    } finally {
      clearInterval(timer);
      setIntelLoading(false);
      setIntelStageIndex(0);
    }
  };

  const handleCopyFull = () => {
    if (!intelResult) return;
    navigator.clipboard.writeText(intelResult);
    notifyCopy('Full Competitive Intelligence Report copied!');
  };

  const handleCopyHooks = () => {
    const snippet = extractNicheIntelSnippet(intelResult, 'hooks');
    if (snippet) {
      navigator.clipboard.writeText(snippet);
      notifyCopy('🪝 Top 10 Hook Teardowns copied!');
    } else {
      navigator.clipboard.writeText(intelResult);
      notifyCopy('Report copied to clipboard.');
    }
  };

  const handleCopyGaps = () => {
    const snippet = extractNicheIntelSnippet(intelResult, 'gaps');
    if (snippet) {
      navigator.clipboard.writeText(snippet);
      notifyCopy('🎯 5 Untouched Gap Angles copied!');
    } else {
      navigator.clipboard.writeText(intelResult);
      notifyCopy('Report copied to clipboard.');
    }
  };

  const handleCopyPlan = () => {
    const snippet = extractNicheIntelSnippet(intelResult, 'plan');
    if (snippet) {
      navigator.clipboard.writeText(snippet);
      notifyCopy('📅 30-Day Content Plan copied!');
    } else {
      navigator.clipboard.writeText(intelResult);
      notifyCopy('Report copied to clipboard.');
    }
  };

  const handleCopySummary = () => {
    const snippet = extractNicheIntelSnippet(intelResult, 'summary');
    if (snippet) {
      navigator.clipboard.writeText(snippet);
      notifyCopy('⚡ Executive Summary copied!');
    } else {
      navigator.clipboard.writeText(intelResult);
      notifyCopy('Report copied to clipboard.');
    }
  };

  const handleLoadHistory = (item) => {
    setIntelResult(item.result);
    setNiche(item.niche || '');
    setGoal(item.goal || '');
    if (item.accountsData) setAccountsData(item.accountsData);
    setIntelMeta({
      niche: item.niche,
      goal: item.goal,
      timestamp: item.timestamp,
      model: item.model,
    });
    setActiveStageFilter('all');
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const handleDeleteHistory = (id, e) => {
    e.stopPropagation();
    setIntelHistory((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem('ad_insta_niche_audits', JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to delete history:', err);
      }
      return updated;
    });
  };

  const hasHooks = Boolean(extractNicheIntelSnippet(intelResult, 'hooks'));
  const hasGaps = Boolean(extractNicheIntelSnippet(intelResult, 'gaps'));
  const hasPlan = Boolean(extractNicheIntelSnippet(intelResult, 'plan'));

  return (
    <div className="niche-intel-section">
      {copyNotice && <div className="strategy-toast-notice">{copyNotice}</div>}

      {/* Hero Header */}
      <div className="strategy-hero-card niche-hero-card">
        <div className="strategy-hero-badge niche-hero-badge">
          <span className="badge-pulse"></span>
          <span>Competitive Intelligence • Multi-Account Cohort Analysis</span>
        </div>
        <h2 className="strategy-hero-title">Instagram Niche Competitive Intelligence</h2>
        <p className="strategy-hero-subtitle">
          Benchmark a cohort of competitor accounts in your niche. Group accounts into strategic tiers, map high-engagement content pillars, deconstruct the <strong>Top 10 highest-performing hooks</strong>, identify format winners, dissect monetization funnels, expose market saturation vs. <strong>5 untouched gap angles</strong>, and generate a <strong>30-day content plan built from gaps</strong>.
        </p>
      </div>

      {/* Input Form Card */}
      <section className="card strategy-form-card niche-form-card">
        {/* Niche Input & Location Narrowing */}
        <div className="form-group">
          <div className="label-with-hint">
            <label className="input-label" htmlFor="nicheInput">
              <strong>Target Niche / Industry *</strong>
            </label>
            <span className="label-hint">What market & location are you targeting?</span>
          </div>

          {/* Combined Search Bar */}
          <div className="niche-search-input-group">
            <input
              id="nicheInput"
              type="text"
              className="url-field niche-text-field"
              placeholder="e.g. B2B SaaS, Fitness Coaching for Founders, AI Video Editing, Skincare"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleDiscoverAccounts();
                }
              }}
            />
            <button
              type="button"
              className="btn-discover-accounts"
              onClick={handleDiscoverAccounts}
              disabled={discoveringAccounts || !niche.trim()}
              title={`Auto-discover real verified Instagram accounts in ${niche} (${getActiveLocationLabel()})`}
            >
              {discoveringAccounts ? (
                <>
                  <span className="spinner"></span>
                  <span>Scouting Verified Creators...</span>
                </>
              ) : (
                <>
                  <span>🔍 Auto-Discover Top Accounts</span>
                </>
              )}
            </button>
          </div>

          {/* Location Narrowing Toolbar (Country & State / Region) */}
          <div className="niche-location-toolbar">
            <div className="location-picker-group">
              <div className="location-select-field">
                <label htmlFor="countrySelect" className="location-field-label">🌍 Country / Geography</label>
                <select
                  id="countrySelect"
                  className="location-select"
                  value={selectedCountry}
                  onChange={handleCountryChange}
                >
                  {Object.entries(LOCATION_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.name}</option>
                  ))}
                </select>
              </div>

              {selectedCountry !== 'Custom' && LOCATION_CONFIG[selectedCountry]?.states?.length > 0 && (
                <div className="location-select-field">
                  <label htmlFor="stateSelect" className="location-field-label">📍 State / Region</label>
                  <select
                    id="stateSelect"
                    className="location-select"
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                  >
                    {LOCATION_CONFIG[selectedCountry].states.map((st, sIdx) => (
                      <option key={sIdx} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedCountry === 'Custom' && (
                <div className="location-custom-inputs">
                  <div className="location-select-field">
                    <label htmlFor="customCountryInput" className="location-field-label">🌍 Country Name</label>
                    <input
                      id="customCountryInput"
                      type="text"
                      className="location-text-input"
                      placeholder="e.g. Japan, Spain, South Africa"
                      value={customCountry}
                      onChange={(e) => setCustomCountry(e.target.value)}
                    />
                  </div>
                  <div className="location-select-field">
                    <label htmlFor="customStateInput" className="location-field-label">📍 State, Province, or City</label>
                    <input
                      id="customStateInput"
                      type="text"
                      className="location-text-input"
                      placeholder="e.g. Tokyo, Madrid, Cape Town"
                      value={customState}
                      onChange={(e) => setCustomState(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="location-active-badge">
              <span className="loc-dot"></span>
              <span>Narrowed Target: <strong>{getActiveLocationLabel()}</strong></span>
            </div>
          </div>

          <div className="strategy-quick-chips">
            <span className="chips-label">Popular Niches:</span>
            {[
              'B2B SaaS / AI Productivity',
              'Fitness Coaching for Busy Founders',
              'Personal Finance & Investing',
              'D2C E-commerce & Fashion',
              'B2B Agency & Client Acquisition',
            ].map((n, idx) => (
              <button
                key={idx}
                type="button"
                className="quick-chip-btn"
                onClick={() => setNiche(n)}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Discovery Loading State */}
          {discoveringAccounts && (
            <div className="discovery-loading-banner">
              <span className="spinner"></span>
              <div className="discovery-loading-text">
                <strong>Searching live Instagram creator benchmarks for "{niche}" in {getActiveLocationLabel()}...</strong>
                <p>Scouting verified creator accounts, viral reel velocity, and authentic profiles via live web search.</p>
              </div>
            </div>
          )}

          {/* Discovery Error */}
          {discoveryError && <div className="error-toast">{discoveryError}</div>}

          {/* Discovered Accounts Container */}
          {discoveredAccounts.length > 0 && !discoveringAccounts && (
            <div className="discovered-accounts-container">
              <div className="discovered-accounts-header">
                <div className="discovered-header-left">
                  <span className="discovered-sparkle-icon">✨</span>
                  <div>
                    <h4 className="discovered-title">
                      High-Performing Accounts in <em>{niche}</em> • <span className="location-highlight">{getActiveLocationLabel()}</span> ({discoveredAccounts.length})
                    </h4>
                    <p className="discovered-subtitle">
                      Scouted via verified Instagram presence, viral reels velocity & funnel architecture. Add individual creators or import all into your cohort data below.
                    </p>
                  </div>
                </div>

                <div className="discovered-header-actions">
                  <button
                    type="button"
                    className="btn-import-all"
                    onClick={handleImportAllDiscovered}
                  >
                    ✨ Import All ({discoveredAccounts.length}) to Cohort Data ⬇
                  </button>
                  <button
                    type="button"
                    className="btn-clear-discovered"
                    onClick={() => setDiscoveredAccounts([])}
                    title="Dismiss discovered accounts"
                  >
                    ✕ Dismiss
                  </button>
                </div>
              </div>

              <div className="discovered-accounts-grid">
                {discoveredAccounts.map((account, aIdx) => {
                  const isImported = importedHandles.includes(account.handle);
                  const igUrl = account.instagram_url || `https://www.instagram.com/${(account.handle || '').replace(/^@/, '')}/`;
                  return (
                    <div key={aIdx} className="discovered-account-card">
                      <div className="card-top-row">
                        <div className="creator-identity">
                          <a
                            href={igUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="creator-handle-link"
                            title="Open live verified profile on Instagram"
                          >
                            {account.handle} ↗
                          </a>
                          {account.name && <span className="creator-name">{account.name}</span>}
                        </div>
                        {account.tier && (
                          <span className={`tier-badge tier-${(account.tier || '').toLowerCase().replace(/[^a-z]/g, '')}`}>
                            {account.tier}
                          </span>
                        )}
                      </div>

                      <div className="card-metrics-row">
                        <span className="metric-pill">👥 {account.follower_count || 'N/A'}</span>
                        <span className="metric-pill location-pill">📍 {account.location || getActiveLocationLabel()}</span>
                        <span className="metric-pill">📊 {account.primary_format || 'Reels'}</span>
                        <span className="metric-pill">🔥 {account.rough_engagement || 'High'}</span>
                      </div>

                      {account.bio && (
                        <p className="card-bio">
                          <strong>Bio:</strong> {account.bio}
                        </p>
                      )}

                      {account.link_in_bio && (
                        <p className="card-funnel">
                          <strong>Funnel:</strong> <code>{account.link_in_bio}</code>
                        </p>
                      )}

                      {account.growth_secret && (
                        <div className="card-growth-secret">
                          <span className="secret-icon">💡</span>
                          <span><strong>Winning Secret:</strong> {account.growth_secret}</span>
                        </div>
                      )}

                      {account.top_hooks && account.top_hooks.length > 0 && (
                        <div className="card-hooks-preview">
                          <span className="hooks-label">Top Hooks:</span>
                          <ul>
                            {account.top_hooks.slice(0, 2).map((hk, hIdx) => (
                              <li key={hIdx}>"{hk}"</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="card-actions-row">
                        <button
                          type="button"
                          className={`btn-add-account ${isImported ? 'added' : ''}`}
                          onClick={() => handleAddSingleAccount(account)}
                        >
                          {isImported ? '✓ Added to Cohort' : '➕ Add to Cohort'}
                        </button>
                        <a
                          href={igUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-view-ig"
                          title="Open live Instagram profile in new tab"
                        >
                          📸 View on IG ↗
                        </a>
                        <button
                          type="button"
                          className="btn-audit-account"
                          onClick={() => {
                            sessionStorage.setItem('ad_insta_prefill_handle', account.handle);
                            if (onSwitchToProfileAudit) {
                              onSwitchToProfileAudit(account.handle);
                            }
                          }}
                          title={`Run full 5-stage profile teardown on ${account.handle}`}
                        >
                          ⚡ Full Audit ↗
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Goal Input */}
        <div className="form-group">
          <div className="label-with-hint">
            <label className="input-label" htmlFor="goalInput">
              <strong>Strategic Goal *</strong>
            </label>
            <span className="label-hint">What do you want to achieve?</span>
          </div>
          <input
            id="goalInput"
            type="text"
            className="url-field niche-text-field"
            placeholder="e.g. Launch a new page, position a SaaS, find monetization gaps"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />

          <div className="strategy-quick-chips">
            <span className="chips-label">Goal Presets:</span>
            {[
              'Launch a new creator-led page',
              'Position a SaaS product & drive trials',
              'Find content gaps & untapped hook angles',
              'Build a $3k-$5k high-ticket client funnel',
              'Scale organic reach with viral Reels & Carousels',
            ].map((g, idx) => (
              <button
                key={idx}
                type="button"
                className="quick-chip-btn"
                onClick={() => setGoal(g)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Competitor Accounts Data */}
        <div className="form-group">
          <div className="label-with-hint">
            <label className="input-label" htmlFor="accountsDataInput">
              <strong>Competitor Accounts Data (N Accounts) *</strong>
            </label>
            <span className="label-hint">Handle, followers, bio, link, post hooks, formats, engagement</span>
          </div>

          <div className="niche-data-toolbar">
            <div className="niche-data-toolbar-left">
              <button
                type="button"
                className="btn-toolbar-action"
                onClick={() => {
                  setNiche(SAMPLE_NICHE_SAAS.niche);
                  setGoal(SAMPLE_NICHE_SAAS.goal);
                  setAccountsData(SAMPLE_NICHE_SAAS.accountsData);
                  notifyCopy('Loaded B2B SaaS cohort dataset!');
                }}
              >
                ⚡ Load SaaS Sample (3 Accounts)
              </button>
              <button
                type="button"
                className="btn-toolbar-action"
                onClick={() => {
                  setNiche(SAMPLE_NICHE_FITNESS.niche);
                  setGoal(SAMPLE_NICHE_FITNESS.goal);
                  setAccountsData(SAMPLE_NICHE_FITNESS.accountsData);
                  notifyCopy('Loaded Fitness Coaching cohort dataset!');
                }}
              >
                ⚡ Load Fitness Sample (3 Accounts)
              </button>
              <button
                type="button"
                className="btn-toolbar-action"
                onClick={() => {
                  setAccountsData(NICHE_DATA_TEMPLATE);
                  notifyCopy('Inserted structured template!');
                }}
              >
                📋 Insert Blank Template
              </button>
            </div>
            <button
              type="button"
              className="btn-toolbar-clear"
              onClick={() => setAccountsData('')}
              title="Clear data"
            >
              ✕ Clear
            </button>
          </div>

          <textarea
            id="accountsDataInput"
            className="niche-data-textarea"
            rows={14}
            placeholder={`Paste data collected on N accounts here...\nFor each account include:\n- Handle (@username)\n- Follower count\n- Bio & Link-in-bio destination\n- Last 10-15 post captions / hooks\n- Post formats (Reel / Carousel / Static)\n- Rough engagement (likes + comments)\n- Posting cadence`}
            value={accountsData}
            onChange={(e) => setAccountsData(e.target.value)}
          />
        </div>

        {intelError && <div className="error-toast">{intelError}</div>}

        <button
          type="button"
          className="btn-primary btn-run-pipeline btn-run-niche-intel"
          onClick={handleRunIntel}
          disabled={intelLoading}
        >
          {intelLoading ? (
            <>
              <span className="spinner"></span>
              <span>Running 7-Stage Niche Competitive Intelligence...</span>
            </>
          ) : (
            <>
              <span>🎯 Run 7-Stage Niche Intelligence & 30-Day Plan ➡️</span>
            </>
          )}
        </button>
      </section>

      {/* Live Pipeline Step Progress Bar */}
      {intelLoading && (
        <div className="pipeline-progress-card niche-progress-card">
          <div className="progress-header">
            <h4>⚡ Synthesizing Cohort Intelligence ({niche || 'Niche'})</h4>
            <span className="progress-status-pill niche-status-pill">Live Reasoning</span>
          </div>
          <div className="pipeline-steps">
            <div className={`pipeline-step ${intelStageIndex >= 1 ? 'active' : ''} ${intelStageIndex > 1 ? 'completed' : ''}`}>
              <div className="step-circle">{intelStageIndex > 1 ? '✓' : '1'}</div>
              <div className="step-body">
                <strong>Stage 1: Account Tiers & Optimization Matrix</strong>
                <span>Grouping by size and true intent (reach vs trust vs direct sales vs community)</span>
              </div>
            </div>
            <div className={`pipeline-step ${intelStageIndex >= 2 ? 'active' : ''} ${intelStageIndex > 2 ? 'completed' : ''}`}>
              <div className="step-circle">{intelStageIndex > 2 ? '✓' : '2'}</div>
              <div className="step-body">
                <strong>Stage 2: Cross-Account Content Pillar Map</strong>
                <span>Correlating recurring content pillars with engagement across all accounts</span>
              </div>
            </div>
            <div className={`pipeline-step ${intelStageIndex >= 3 ? 'active' : ''} ${intelStageIndex > 3 ? 'completed' : ''}`}>
              <div className="step-circle">{intelStageIndex > 3 ? '✓' : '3'}</div>
              <div className="step-body">
                <strong>Stage 3: Top 10 Hook Teardowns & Formulas</strong>
                <span>Naming copywriting patterns (contrarian, listicle, callout, story, pattern interrupt)</span>
              </div>
            </div>
            <div className={`pipeline-step ${intelStageIndex >= 4 ? 'active' : ''} ${intelStageIndex > 4 ? 'completed' : ''}`}>
              <div className="step-circle">{intelStageIndex > 4 ? '✓' : '4'}</div>
              <div className="step-body">
                <strong>Stage 4: Format vs Performance Benchmark</strong>
                <span>Reels vs Carousels vs Static: distinguishing niche trends from single outliers</span>
              </div>
            </div>
            <div className={`pipeline-step ${intelStageIndex >= 5 ? 'active' : ''} ${intelStageIndex > 5 ? 'completed' : ''}`}>
              <div className="step-circle">{intelStageIndex > 5 ? '✓' : '5'}</div>
              <div className="step-body">
                <strong>Stage 5: Monetization & Funnel Architecture</strong>
                <span>Bio paths, lead magnets, offer prices, and value-to-pitch ratio teardowns</span>
              </div>
            </div>
            <div className={`pipeline-step ${intelStageIndex >= 6 ? 'active' : ''} ${intelStageIndex > 6 ? 'completed' : ''}`}>
              <div className="step-circle">{intelStageIndex > 6 ? '✓' : '6'}</div>
              <div className="step-body">
                <strong>Stage 6: Saturation vs 5 Untouched Gap Angles</strong>
                <span>Diagnosing fatigue and crafting 5 high-intent angles nobody in this cohort covers</span>
              </div>
            </div>
            <div className={`pipeline-step ${intelStageIndex >= 7 ? 'active' : ''}`}>
              <div className="step-circle">{intelStageIndex >= 7 ? '⏳' : '7'}</div>
              <div className="step-body">
                <strong>Stage 7: 30-Day Content Plan Built from Gaps</strong>
                <span>Week-by-week calendar with hooks, formats, delivery beats, and CTAs</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Presentation Card */}
      {intelResult && !intelLoading && (
        <div className="strategy-results-card niche-results-card">
          <div className="strategy-results-header">
            <div className="results-title-group">
              <span className="strategy-topic-tag niche-tag">Niche Competitive Intelligence</span>
              <h3 className="results-niche-title">{intelMeta?.niche || niche}</h3>
              <p className="results-goal-sub">🎯 Goal: {intelMeta?.goal || goal}</p>
              <div className="strategy-meta-tags">
                <span className="meta-tag">📅 {intelMeta?.timestamp}</span>
                {intelMeta?.model && <span className="meta-tag model-tag">⚡ {intelMeta.model}</span>}
              </div>
            </div>

            <div className="results-action-buttons">
              <button
                type="button"
                className="btn-secondary btn-action-sm"
                onClick={handleCopyFull}
              >
                📋 Copy Full Report
              </button>
              {hasHooks && (
                <button
                  type="button"
                  className="btn-secondary btn-action-sm"
                  onClick={handleCopyHooks}
                >
                  🪝 Copy 10 Hooks
                </button>
              )}
              {hasGaps && (
                <button
                  type="button"
                  className="btn-secondary btn-action-sm"
                  onClick={handleCopyGaps}
                >
                  🎯 Copy 5 Gap Angles
                </button>
              )}
              {hasPlan && (
                <button
                  type="button"
                  className="btn-secondary btn-action-sm"
                  onClick={handleCopyPlan}
                >
                  📅 Copy 30-Day Plan
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
                  setIntelResult('');
                  window.scrollTo({ top: 120, behavior: 'smooth' });
                }}
              >
                🔄 New Cohort Audit
              </button>
            </div>
          </div>

          {/* Stage Filter Tabs */}
          <div className="stage-filter-tabs">
            {[
              { id: 'all', label: '📋 All 7 Stages' },
              { id: 'summary', label: '⚡ Executive Summary' },
              { id: 'stage1', label: '🏢 1. Account Tiers' },
              { id: 'stage2', label: '🗺️ 2. Pillar Map' },
              { id: 'stage3', label: '🪝 3. Hook Teardown' },
              { id: 'stage4', label: '📊 4. Format Benchmark' },
              { id: 'stage5', label: '💰 5. Funnels' },
              { id: 'stage6', label: '🎯 6. 5 Gap Angles' },
              { id: 'stage7', label: '📅 7. 30-Day Plan' },
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
            <FormattedNicheIntelMarkdown
              content={intelResult}
              filterStage={activeStageFilter}
              onCopy={notifyCopy}
            />
          </div>
        </div>
      )}

      {/* Saved Cohort Audits History */}
      {intelHistory.length > 0 && (
        <section className="card strategy-history-card">
          <div className="history-header">
            <h4>💾 Saved Niche Intelligence Reports ({intelHistory.length})</h4>
            <span className="history-subtitle">Past competitor cohort analyses saved locally in browser</span>
          </div>

          <div className="history-items-grid">
            {intelHistory.map((item) => (
              <div
                key={item.id}
                className="history-item-card niche-history-item"
                onClick={() => handleLoadHistory(item)}
              >
                <div className="history-item-top">
                  <span className="history-item-date">{item.timestamp}</span>
                  <button
                    type="button"
                    className="btn-delete-history"
                    title="Delete report"
                    onClick={(e) => handleDeleteHistory(item.id, e)}
                  >
                    ✕
                  </button>
                </div>
                <h5 className="history-item-niche">{item.niche}</h5>
                <p className="history-item-goal" style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  🎯 {item.goal}
                </p>
                <div className="history-item-badges">
                  <span className="badge-sm niche-badge-sm">Niche Intel</span>
                  {item.model && <span className="badge-sm">{item.model}</span>}
                </div>
                <button type="button" className="btn-load-history">
                  Load Report →
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

        <button
          type="button"
          className={`section-nav-pill ${mainSection === 'insta-audit' ? 'active' : ''}`}
          onClick={() => {
            setMainSection('insta-audit');
            localStorage.setItem('ad_analyzer_section', 'insta-audit');
          }}
        >
          <span className="pill-icon">📸</span>
          <div className="pill-text-wrap">
            <div className="pill-title-row">
              <span className="pill-title">Instagram Profile Auditor</span>
              <span className="pill-badge pill-badge-pink">Competitor Intel</span>
            </div>
            <span className="pill-desc">Formats • Top Posts • The Good/Bad • Gaps • 5 Reel Ideas</span>
          </div>
        </button>

        <button
          type="button"
          className={`section-nav-pill ${mainSection === 'niche-intel' ? 'active' : ''}`}
          onClick={() => {
            setMainSection('niche-intel');
            localStorage.setItem('ad_analyzer_section', 'niche-intel');
          }}
        >
          <span className="pill-icon">🎯</span>
          <div className="pill-text-wrap">
            <div className="pill-title-row">
              <span className="pill-title">Niche Competitive Intel</span>
              <span className="pill-badge pill-badge-purple">Cohort Intel</span>
            </div>
            <span className="pill-desc">Tiers • Pillars • 10 Hooks • Funnels • 30-Day Plan</span>
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
        ) : mainSection === 'insta-audit' ? (
          <InstaProfileAuditSection
            apiHealth={apiHealth}
            customApiKey={customApiKey}
            API_BASE={API_BASE}
            onOpenKeyModal={() => {
              setModalKeyInput(customApiKey);
              setShowKeyModal(true);
            }}
          />
        ) : mainSection === 'niche-intel' ? (
          <InstaNicheIntelSection
            apiHealth={apiHealth}
            customApiKey={customApiKey}
            API_BASE={API_BASE}
            onOpenKeyModal={() => {
              setModalKeyInput(customApiKey);
              setShowKeyModal(true);
            }}
            onSwitchToProfileAudit={(handle) => {
              sessionStorage.setItem('ad_insta_prefill_handle', handle);
              setMainSection('insta-audit');
              localStorage.setItem('ad_analyzer_section', 'insta-audit');
              window.scrollTo({ top: 120, behavior: 'smooth' });
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
