'use client';

import { useState } from 'react';
import CaseIntakeForm from '../components/CaseIntakeForm';
import DefenseReport from '../components/DefenseReport';
import type { CaseAnalysisResult } from '../lib/analysis/orchestrator';

export default function Home() {
  const [analysisResult, setAnalysisResult] = useState<CaseAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalysisComplete = (result: CaseAnalysisResult) => {
    setAnalysisResult(result);
    setIsAnalyzing(false);
    setError(null);
  };

  const handleAnalysisStart = () => {
    setIsAnalyzing(true);
    setError(null);
  };

  const handleError = (msg: string) => {
    setError(msg);
    setIsAnalyzing(false);
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setError(null);
  };

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                NYC Housing Court Case Intake
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Automated defense analysis for tenant attorneys
              </p>
            </div>
            {analysisResult && (
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                New Case
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        )}

        {!analysisResult ? (
          <CaseIntakeForm
            onAnalysisComplete={handleAnalysisComplete}
            onAnalysisStart={handleAnalysisStart}
            onError={handleError}
            isAnalyzing={isAnalyzing}
          />
        ) : (
          <DefenseReport result={analysisResult} />
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs text-gray-500 text-center">
            This tool provides automated analysis to assist attorneys. All findings should be
            independently verified. This is not legal advice.
          </p>
        </div>
      </footer>
    </main>
  );
}
