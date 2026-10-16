import React from 'react';
import { ShieldCheck, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-800/80 bg-[#070d18] text-slate-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-teal-400 p-[1px]">
                <div className="w-full h-full bg-[#070d18] rounded-[11px] flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                </div>
              </div>
              <span className="font-bold text-lg text-white">Evidra</span>
            </div>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Every skill. Proven. The verifiable, explainable placement intelligence platform
              bridging universities, students, and tier-one recruiters with cryptographic-grade
              evidence.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Core Matching Engine v1.0 &bull; 100% Deterministic &bull; Zero Hallucinations
              </span>
            </div>
          </div>

          {/* Platform Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">
              Platform
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#features" className="hover:text-slate-200 transition-colors">
                  Evidence Vault
                </a>
              </li>
              <li>
                <a href="#matching" className="hover:text-slate-200 transition-colors">
                  Explainable Match Engine
                </a>
              </li>
              <li>
                <a href="#evidence" className="hover:text-slate-200 transition-colors">
                  Placement Officer Hub
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-slate-200 transition-colors">
                  Recruiter Verification
                </a>
              </li>
            </ul>
          </div>

          {/* Trust & Security */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">
              Trust &amp; Governance
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="text-slate-500">Tamper-Proof Audit Trail</span>
              </li>
              <li>
                <span className="text-slate-500">Zero Self-Reported Bias</span>
              </li>
              <li>
                <span className="text-slate-500">Configurable Weight Policies</span>
              </li>
              <li>
                <span className="text-slate-500">Role-Based Access Control</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} Evidra Intelligence Inc. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Engineered with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> for
            academic integrity
          </p>
        </div>
      </div>
    </footer>
  );
};
