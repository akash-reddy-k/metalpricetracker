import React, { useState } from 'react';
import type { ApiConfig } from '../types/metals';
import { Settings, Check, AlertCircle, RefreshCw, Key, Shield } from 'lucide-react';

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
  const [provider, setProvider] = useState<'simulated' | 'goldapi' | 'metalpriceapi'>(apiConfig.provider);
  const [apiKey, setApiKey] = useState<string>(apiConfig.apiKey);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setApiConfig({ provider, apiKey });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
    
    // Automatically trigger fetch when settings change
    if (provider !== 'simulated' && apiKey) {
      setTimeout(() => triggerManualFetch(), 100);
    }
  };

  const handleProviderChange = (prov: 'simulated' | 'goldapi' | 'metalpriceapi') => {
    setProvider(prov);
    if (prov === 'simulated') {
      setApiKey('');
    }
  };

  return (
    <div className={`settings-drawer ${isOpen ? 'open' : ''}`}>
      <button 
        className="settings-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle Price Feed & API Configuration"
      >
        <Settings size={18} className={isFetching ? 'spinning-sparkle' : ''} />
        <span>Feed Settings</span>
        {apiConfig.provider !== 'simulated' && (
          <span className="live-pill">LIVE</span>
        )}
      </button>

      {isOpen && (
        <div className="settings-content-wrapper">
          <div className="settings-header">
            <h3>
              <Settings size={16} /> Data Feed Configuration
            </h3>
            <span className="api-status-badge">
              {apiConfig.provider === 'simulated' ? 'Mode: Simulated' : 'Mode: Live API'}
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
                  Simulation (No Key)
                </button>
                <button
                  type="button"
                  className={`prov-btn ${provider === 'goldapi' ? 'active' : ''}`}
                  onClick={() => handleProviderChange('goldapi')}
                >
                  GoldAPI.io
                </button>
                <button
                  type="button"
                  className={`prov-btn ${provider === 'metalpriceapi' ? 'active' : ''}`}
                  onClick={() => handleProviderChange('metalpriceapi')}
                >
                  MetalpriceAPI.com
                </button>
              </div>
            </div>

            {/* API Key Input (if live) */}
            {provider !== 'simulated' && (
              <div className="form-group fade-in">
                <label htmlFor="settings-apikey" className="label-with-icon">
                  <Key size={12} /> Enter API Access Token / Key
                </label>
                <input
                  id="settings-apikey"
                  type="password"
                  placeholder={`Enter your ${provider === 'goldapi' ? 'GoldAPI' : 'MetalpriceAPI'} token`}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                />
                <div className="api-note">
                  <Shield size={10} />
                  <span>Stored client-side. Make sure your browser has CORS proxy bypass capability or uses standard HTTP headers.</span>
                </div>
              </div>
            )}

            {/* Refresh Rate */}
            <div className="form-group">
              <label htmlFor="settings-refresh">Feed Refresh Interval</label>
              <select
                id="settings-refresh"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(parseInt(e.target.value, 10))}
              >
                <option value={10}>10 Seconds (Fast Demo)</option>
                <option value={30}>30 Seconds</option>
                <option value={60}>60 Seconds (Default)</option>
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
                Force Refresh
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
                {isFetching ? 'Refreshing...' : fetchError ? 'API Error' : 'Connected & Active'}
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
