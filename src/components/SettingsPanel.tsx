import React, { useState } from 'react';
import type { ApiConfig } from '../types/metals';
import { Settings, Check, AlertCircle, RefreshCw, Globe, Shield } from 'lucide-react';

interface SettingsPanelProps {
  apiConfig: ApiConfig;
  setApiConfig: (config: ApiConfig) => void;
  refreshInterval: number; // in seconds
  setRefreshInterval: (interval: number) => void;
  lastUpdated: Date | null;
  fetchError: string | null;
  isFetching: boolean;
  triggerManualFetch: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  apiConfig,
  setApiConfig,
  refreshInterval,
  setRefreshInterval,
  lastUpdated,
  fetchError,
  isFetching,
  triggerManualFetch,
}) => {
  const [provider, setProvider] = useState<'simulated' | 'hono'>(apiConfig.provider);
  const [serverUrl, setServerUrl] = useState<string>(apiConfig.serverUrl);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setApiConfig({ provider, serverUrl });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleProviderChange = (prov: 'simulated' | 'hono') => {
    setProvider(prov);
  };

  return (
    <div className={`settings-drawer ${isOpen ? 'open' : ''}`}>
      <button 
        className="settings-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle Price Feed & API Configuration"
      >
        <Settings size={18} className={isFetching ? 'spinning-sparkle' : ''} />
        <span>Price Feed Settings</span>
        {apiConfig.provider !== 'simulated' && (
          <span className="live-pill">YAHOO LIVE</span>
        )}
      </button>

      {isOpen && (
        <div className="settings-content-wrapper">
          <div className="settings-header">
            <h3>
              <Settings size={16} /> Data Feed Configuration
            </h3>
            <span className="api-status-badge">
              {apiConfig.provider === 'simulated' ? 'Mode: Simulated Ticker' : 'Mode: Hono SSE Stream'}
            </span>
          </div>

          <form onSubmit={handleSave} className="settings-form">
            {/* Feed Mode Select */}
            <div className="form-group">
              <label>Data Provider</label>
              <div className="provider-options">
                <button
                  type="button"
                  className={`prov-btn ${provider === 'simulated' ? 'active' : ''}`}
                  onClick={() => handleProviderChange('simulated')}
                >
                  Simulation (Offline Mode)
                </button>
                <button
                  type="button"
                  className={`prov-btn ${provider === 'hono' ? 'active' : ''}`}
                  onClick={() => handleProviderChange('hono')}
                >
                  Yahoo Finance (Local Hono Server)
                </button>
              </div>
            </div>

            {/* Hono Server URL (if selected) */}
            {provider === 'hono' && (
              <div className="form-group fade-in">
                <label htmlFor="settings-serverurl" className="label-with-icon">
                  <Globe size={12} /> Hono Server Base URL
                </label>
                <input
                  id="settings-serverurl"
                  type="url"
                  placeholder="http://localhost:3000"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  required
                />
                <div className="api-note">
                  <Shield size={10} />
                  <span>Streams SSE events from Yahoo Finance via the Hono backend. Make sure your Hono backend is running.</span>
                </div>
              </div>
            )}

            {/* Refresh Rate */}
            <div className="form-group">
              <label htmlFor="settings-refresh">Feed Refresh Interval (Yahoo Query Rate)</label>
              <select
                id="settings-refresh"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(parseInt(e.target.value, 10))}
              >
                <option value={10}>10 Seconds (Fast Updates)</option>
                <option value={30}>30 Seconds</option>
                <option value={60}>60 Seconds (Recommended)</option>
                <option value={300}>5 Minutes (Eco)</option>
              </select>
            </div>

            {/* Form Actions */}
            <div className="form-actions">
              <button 
                type="button" 
                className="manual-fetch-btn"
                onClick={triggerManualFetch}
                disabled={isFetching}
              >
                <RefreshCw size={14} className={isFetching ? 'spinning-sparkle' : ''} />
                Reconnect / Restart Stream
              </button>
              
              <button type="submit" className="save-settings-btn">
                {isSaved ? <Check size={14} /> : null}
                {isSaved ? 'Saved!' : 'Apply Settings'}
              </button>
            </div>
          </form>

          {/* Status Panel */}
          <div className="settings-status-box">
            <div className="status-item">
              <span>Status:</span>
              <strong className={fetchError ? 'text-red' : 'text-green'}>
                {isFetching ? 'Connecting Stream...' : fetchError ? 'Connection Error' : 'Stream Connected & Active'}
              </strong>
            </div>
            
            {lastUpdated && (
              <div className="status-item">
                <span>Last Updated:</span>
                <strong>{lastUpdated.toLocaleTimeString()}</strong>
              </div>
            )}

            {fetchError && (
              <div className="error-banner">
                <AlertCircle size={14} />
                <span>{fetchError}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
