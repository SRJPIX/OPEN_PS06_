import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Save,
  RotateCcw,
  Building,
  Scale,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { PlacementSettingData } from '../../types/officer';

export const OfficerSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<PlacementSettingData>({
    institutionName: 'Apex Institute of Technology - Placement Cell',
    defaultGraduationYear: 2026,
    minCgpaThreshold: 6.0,
    scoringWeights: {
      requiredSkillWeight: 0.5,
      preferredSkillWeight: 0.3,
      courseworkWeight: 0.2,
      verificationPenalty: 0.2,
    },
    autoArchivePastDeadlines: true,
    strictDuplicateRejection: true,
    emailAlertsEnabled: false,
    evidenceReviewSlaDays: 3,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await api.get<PlacementSettingData>('/officer/settings');
      if (res) {
        setSettings({
          institutionName: res.institutionName || 'Apex Institute of Technology',
          defaultGraduationYear: res.defaultGraduationYear || 2026,
          minCgpaThreshold: res.minCgpaThreshold ?? 6.0,
          scoringWeights: {
            requiredSkillWeight: res.scoringWeights?.requiredSkillWeight ?? 0.5,
            preferredSkillWeight: res.scoringWeights?.preferredSkillWeight ?? 0.3,
            courseworkWeight: res.scoringWeights?.courseworkWeight ?? 0.2,
            verificationPenalty: res.scoringWeights?.verificationPenalty ?? 0.2,
          },
          autoArchivePastDeadlines: res.autoArchivePastDeadlines ?? true,
          strictDuplicateRejection: res.strictDuplicateRejection ?? true,
          emailAlertsEnabled: res.emailAlertsEnabled ?? false,
          evidenceReviewSlaDays: res.evidenceReviewSlaDays ?? 3,
          updatedBy: res.updatedBy,
          updatedAt: res.updatedAt,
        });
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      setErrorMessage(err?.message || 'Failed to load placement configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccessMessage(null);
      setErrorMessage(null);

      const res = await api.put<PlacementSettingData>('/officer/settings', settings);
      if (res) {
        setSettings(res);
        setSuccessMessage('Placement configuration and scoring parameters saved successfully.');
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err: any) {
      console.error('Failed to update settings:', err);
      setErrorMessage(err?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setSettings((prev) => ({
      ...prev,
      defaultGraduationYear: 2026,
      minCgpaThreshold: 6.0,
      scoringWeights: {
        requiredSkillWeight: 0.5,
        preferredSkillWeight: 0.3,
        courseworkWeight: 0.2,
        verificationPenalty: 0.2,
      },
      autoArchivePastDeadlines: true,
      strictDuplicateRejection: true,
      emailAlertsEnabled: false,
      evidenceReviewSlaDays: 3,
    }));
  };

  const totalAlgorithmWeight =
    settings.scoringWeights.requiredSkillWeight +
    settings.scoringWeights.preferredSkillWeight +
    settings.scoringWeights.courseworkWeight;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Placement Settings &amp; Policies</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200">
              <Sliders className="w-3.5 h-3.5" /> Institutional Rules
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Configure matching algorithm weights, academic eligibility thresholds, and automated quality gates across the placement cell.
          </p>
        </div>

        {settings.updatedAt && (
          <div className="text-xs text-slate-500 text-right">
            <div>Last modified by: <span className="font-medium text-slate-700">{settings.updatedBy?.email || 'Admin'}</span></div>
            <div>{new Date(settings.updatedAt).toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          <Sliders className="w-8 h-8 mx-auto animate-spin text-slate-400 mb-2" />
          <p className="text-sm font-medium">Loading institutional configuration...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: General Institution Profile */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building className="w-5 h-5 text-primary-600" />
              <h2 className="text-base font-semibold text-slate-900">Institutional Profile &amp; Cohort Defaults</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Institution Name
                </label>
                <input
                  type="text"
                  value={settings.institutionName}
                  onChange={(e) => setSettings({ ...settings, institutionName: e.target.value })}
                  required
                  placeholder="e.g. Apex Institute of Technology - Placement Office"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-slate-400 mt-1">Displayed on student job notifications and ranking export headers.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Default Batch Year
                </label>
                <input
                  type="number"
                  value={settings.defaultGraduationYear}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultGraduationYear: parseInt(e.target.value, 10) || 2026 })
                  }
                  required
                  min={2020}
                  max={2035}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-slate-400 mt-1">Default active graduating cohort for batch ranking.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Baseline Minimum CGPA
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={settings.minCgpaThreshold}
                    onChange={(e) =>
                      setSettings({ ...settings, minCgpaThreshold: parseFloat(e.target.value) || 0 })
                    }
                    required
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">/ 10.0</div>
                </div>
                <p className="text-xs text-slate-400 mt-1">Institutional cutoff when job opening does not specify a threshold.</p>
              </div>
            </div>
          </div>

          {/* Section 2: Matching Algorithm Weights */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-900">Batch Matching &amp; Fit Scoring Weights</h2>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                Component Sum: <strong className={totalAlgorithmWeight === 1.0 ? 'text-emerald-600' : 'text-amber-600'}>{totalAlgorithmWeight.toFixed(2)}</strong>
              </span>
            </div>

            <p className="text-xs text-slate-500">
              These weights calibrate how candidate match scores are computed during batch ranking against job requisitions.
            </p>

            {/* Visual breakdown bar */}
            <div className="space-y-1">
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                <div
                  style={{ width: `${(settings.scoringWeights.requiredSkillWeight / (totalAlgorithmWeight || 1)) * 100}%` }}
                  className="bg-primary-500 h-full transition-all duration-300"
                  title={`Required Skills: ${(settings.scoringWeights.requiredSkillWeight * 100).toFixed(0)}%`}
                />
                <div
                  style={{ width: `${(settings.scoringWeights.preferredSkillWeight / (totalAlgorithmWeight || 1)) * 100}%` }}
                  className="bg-sky-400 h-full transition-all duration-300"
                  title={`Preferred Skills: ${(settings.scoringWeights.preferredSkillWeight * 100).toFixed(0)}%`}
                />
                <div
                  style={{ width: `${(settings.scoringWeights.courseworkWeight / (totalAlgorithmWeight || 1)) * 100}%` }}
                  className="bg-emerald-400 h-full transition-all duration-300"
                  title={`Coursework / Academic: ${(settings.scoringWeights.courseworkWeight * 100).toFixed(0)}%`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary-500"></span> Required Skills ({Math.round(settings.scoringWeights.requiredSkillWeight * 100)}%)</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-400"></span> Preferred Skills ({Math.round(settings.scoringWeights.preferredSkillWeight * 100)}%)</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Coursework Match ({Math.round(settings.scoringWeights.courseworkWeight * 100)}%)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Required Skill Weight */}
              <div className="space-y-1.5 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span>Required Skill Weight</span>
                  <span className="font-mono text-primary-600 font-bold">{settings.scoringWeights.requiredSkillWeight}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={settings.scoringWeights.requiredSkillWeight}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      scoringWeights: {
                        ...settings.scoringWeights,
                        requiredSkillWeight: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-primary-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">Weight assigned to must-have skills specified in requisition.</p>
              </div>

              {/* Preferred Skill Weight */}
              <div className="space-y-1.5 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span>Preferred Skill Weight</span>
                  <span className="font-mono text-sky-600 font-bold">{settings.scoringWeights.preferredSkillWeight}</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.5"
                  step="0.05"
                  value={settings.scoringWeights.preferredSkillWeight}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      scoringWeights: {
                        ...settings.scoringWeights,
                        preferredSkillWeight: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-sky-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">Bonus weight for desirable and secondary skill overlap.</p>
              </div>

              {/* Coursework Weight */}
              <div className="space-y-1.5 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span>Coursework &amp; Academic Match</span>
                  <span className="font-mono text-emerald-600 font-bold">{settings.scoringWeights.courseworkWeight}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.4"
                  step="0.05"
                  value={settings.scoringWeights.courseworkWeight}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      scoringWeights: {
                        ...settings.scoringWeights,
                        courseworkWeight: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">Alignment with completed academic curriculum and degree programs.</p>
              </div>

              {/* Verification Penalty */}
              <div className="space-y-1.5 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-1">
                    Unverified Skill Penalty Factor
                    <span title="Discount applied when a candidate claims a skill without supporting evidence">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                  </span>
                  <span className="font-mono text-amber-600 font-bold">-{settings.scoringWeights.verificationPenalty * 100}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.5"
                  step="0.05"
                  value={settings.scoringWeights.verificationPenalty}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      scoringWeights: {
                        ...settings.scoringWeights,
                        verificationPenalty: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">Reduces contribution of unverified student claims to reward certified evidence.</p>
              </div>
            </div>
          </div>

          {/* Section 3: Operational Automations & Quality Gates */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-semibold text-slate-900">Governance Policies &amp; Automation Controls</h2>
            </div>

            <div className="space-y-4">
              {/* Strict Duplicate Rejection */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.strictDuplicateRejection}
                  onChange={(e) => setSettings({ ...settings, strictDuplicateRejection: e.target.checked })}
                  className="mt-0.5 rounded text-primary-600 focus:ring-primary-500"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-slate-800">
                    Strict Duplicate Safeguard (Requisition ID Separation)
                  </div>
                  <div className="text-xs text-slate-500">
                    Prevent automated merging of job requisitions that have distinct requisition codes or differing locations, ensuring distinct openings are never silently consolidated.
                  </div>
                </div>
              </label>

              {/* Auto Archive Past Deadlines */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoArchivePastDeadlines}
                  onChange={(e) => setSettings({ ...settings, autoArchivePastDeadlines: e.target.checked })}
                  className="mt-0.5 rounded text-primary-600 focus:ring-primary-500"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-slate-800">
                    Automated Opening Expiration
                  </div>
                  <div className="text-xs text-slate-500">
                    Automatically shift active job postings to 'closed' status once their application cutoff date has elapsed.
                  </div>
                </div>
              </label>

              {/* Email Alerts */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailAlertsEnabled}
                  onChange={(e) => setSettings({ ...settings, emailAlertsEnabled: e.target.checked })}
                  className="mt-0.5 rounded text-primary-600 focus:ring-primary-500"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-slate-800">
                    Automated Email Notifications
                  </div>
                  <div className="text-xs text-slate-500">
                    Send email notifications to students when application statuses advance (Shortlisted, Offered, Interview Scheduled).
                  </div>
                </div>
              </label>

              {/* SLA Days */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-slate-800">Evidence Review Turnaround SLA</span>
                  <p className="text-xs text-slate-400">Target maximum turnaround window for faculty to evaluate submitted evidence before escalation.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={settings.evidenceReviewSlaDays}
                    onChange={(e) =>
                      setSettings({ ...settings, evidenceReviewSlaDays: parseInt(e.target.value, 10) || 3 })
                    }
                    className="w-16 px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-xs text-slate-600 font-medium">days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition shadow-xs"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Recommended Defaults
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Policies...' : 'Save Placement Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
export default OfficerSettingsPage;
