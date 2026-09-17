import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

export default function App() {
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
    const trimmed = (keyVal || '').trim();
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

    const effectiveKey = (overrideKey !== null ? overrideKey : customApiKey).trim();

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
        </div>
      </header>

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
              onClick={handleAnalyze}
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
                    <button type="button" className="action-btn" onClick={handleCopyMarkdown}>
                      📋 Copy Markdown
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
                      <td>
                        <button type="button" className="btn-inspect">Inspect →</button>
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
    </div>
  );
}
