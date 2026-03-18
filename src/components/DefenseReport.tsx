'use client';

import type { CaseAnalysisResult } from '../lib/analysis/orchestrator';
import type { DefenseIssue } from '../lib/types';
import { CASE_TYPE_LABELS } from '../lib/types';

interface Props {
  result: CaseAnalysisResult;
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-900',
    badge: 'bg-red-600 text-white',
  },
  high: {
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-900',
    badge: 'bg-orange-500 text-white',
  },
  medium: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    text: 'text-yellow-900',
    badge: 'bg-yellow-500 text-white',
  },
  low: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-900',
    badge: 'bg-blue-500 text-white',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  service: 'Service of Process',
  predicate_notice: 'Predicate Notice',
  notice_of_petition: 'Notice of Petition',
  filing_dates: 'Filing Dates & Timing',
  gcel: 'Good Cause Eviction Law',
  petition: 'Petition Defects',
  other: 'Other Issues',
};

export default function DefenseReport({ result }: Props) {
  const criticalCount = result.issues.filter(i => i.severity === 'critical').length;
  const highCount = result.issues.filter(i => i.severity === 'high').length;
  const mediumCount = result.issues.filter(i => i.severity === 'medium').length;
  const lowCount = result.issues.filter(i => i.severity === 'low').length;

  // Group issues by category
  const groupedIssues = result.issues.reduce<Record<string, DefenseIssue[]>>((acc, issue) => {
    const cat = issue.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(issue);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      <div
        className={`rounded-lg p-6 border ${
          criticalCount > 0
            ? 'bg-red-50 border-red-200'
            : highCount > 0
            ? 'bg-orange-50 border-orange-200'
            : 'bg-green-50 border-green-200'
        }`}
      >
        <h2 className="text-lg font-bold mb-2">
          Defense Analysis Report
          {result.indexNumber && (
            <span className="text-sm font-normal ml-2 text-gray-600">
              {result.indexNumber}
            </span>
          )}
        </h2>
        <p className="text-sm mb-3">
          {CASE_TYPE_LABELS[result.caseType]} case
          {result.holdoverSubtype && ` (${result.holdoverSubtype})`}
        </p>
        <p className="text-sm">{result.summary}</p>

        {/* Severity Counts */}
        <div className="flex gap-3 mt-4">
          {criticalCount > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-600 text-white">
              {criticalCount} Critical
            </span>
          )}
          {highCount > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-500 text-white">
              {highCount} High
            </span>
          )}
          {mediumCount > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500 text-white">
              {mediumCount} Medium
            </span>
          )}
          {lowCount > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500 text-white">
              {lowCount} Low
            </span>
          )}
        </div>
      </div>

      {/* Document Classifications */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-md font-semibold mb-3">Documents Analyzed</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {result.documentClassifications.map((doc, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
              <span className="font-medium truncate">{doc.filename}</span>
              <span className="text-gray-500 text-xs">({doc.category})</span>
            </div>
          ))}
        </div>
      </section>

      {/* Issues by Category */}
      {Object.entries(groupedIssues).map(([category, issues]) => (
        <section
          key={category}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <h3 className="text-md font-semibold mb-4">
            {CATEGORY_LABELS[category] || category}
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({issues.length} issue{issues.length > 1 ? 's' : ''})
            </span>
          </h3>

          <div className="space-y-4">
            {issues.map((issue, i) => {
              const style = SEVERITY_STYLES[issue.severity];
              return (
                <div
                  key={i}
                  className={`rounded-lg border-l-4 p-4 ${style.bg} ${style.border}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold uppercase flex-shrink-0 ${style.badge}`}
                    >
                      {issue.severity}
                    </span>
                    <div className="flex-grow">
                      <h4 className={`font-semibold text-sm ${style.text}`}>
                        {issue.title}
                      </h4>
                      <p className="text-sm mt-1 text-gray-700">{issue.description}</p>
                      {issue.legalBasis && (
                        <p className="text-xs mt-2 text-gray-500">
                          <span className="font-medium">Legal basis:</span> {issue.legalBasis}
                        </p>
                      )}
                      {issue.recommendation && (
                        <div className="mt-2 p-2 bg-white bg-opacity-60 rounded text-xs">
                          <span className="font-medium">Recommendation:</span>{' '}
                          {issue.recommendation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* GCEL Analysis */}
      {result.gcelAnalysis && (
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-md font-semibold mb-3">Good Cause Eviction Law Analysis</h3>
          <div className="text-sm space-y-2">
            <p>
              <span className="font-medium">Subject to GCEL:</span>{' '}
              {(result.gcelAnalysis as any).likelySubjectToGCEL ? 'Likely Yes' : 'Likely No'}
              <span className="ml-2 text-gray-500">
                (Confidence: {(result.gcelAnalysis as any).confidence})
              </span>
            </p>
            {(result.gcelAnalysis as any).exceptionsFound?.length > 0 && (
              <p>
                <span className="font-medium">Exceptions found:</span>{' '}
                {(result.gcelAnalysis as any).exceptionsFound.join(', ')}
              </p>
            )}
            <p className="text-gray-600 whitespace-pre-line">
              {(result.gcelAnalysis as any).reasoning}
            </p>
          </div>
        </section>
      )}

      {/* External Data */}
      {(result.externalData.hpd || result.externalData.justfix) && (
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-md font-semibold mb-3">Building Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {result.externalData.hpd && (
              <div>
                <h4 className="font-medium text-gray-700 mb-1">HPD Registration</h4>
                <dl className="space-y-1">
                  <div className="flex gap-2">
                    <dt className="text-gray-500">Address:</dt>
                    <dd>{(result.externalData.hpd as any).buildingAddress}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-gray-500">Total Units:</dt>
                    <dd>{(result.externalData.hpd as any).totalUnits || 'N/A'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-gray-500">Owner:</dt>
                    <dd>{(result.externalData.hpd as any).ownerName || 'N/A'}</dd>
                  </div>
                </dl>
              </div>
            )}
            {result.externalData.justfix && (
              <div>
                <h4 className="font-medium text-gray-700 mb-1">JustFix WhoOwnsWhat</h4>
                <dl className="space-y-1">
                  <div className="flex gap-2">
                    <dt className="text-gray-500">Residential Units:</dt>
                    <dd>{(result.externalData.justfix as any).unitsRes || 'N/A'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-gray-500">HPD Violations:</dt>
                    <dd>{(result.externalData.justfix as any).hpdViolations || 'N/A'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-gray-500">Portfolio Size:</dt>
                    <dd>{(result.externalData.justfix as any).portfolioSize || 'N/A'}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Disclaimer */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-4 border border-gray-200">
        <p className="font-medium mb-1">Disclaimer</p>
        <p>
          This automated analysis is intended to assist tenant attorneys in identifying
          potential procedural defenses. It is not a substitute for professional legal
          judgment. All findings should be independently verified against the actual
          documents and applicable law. External data lookups may not be current or complete.
        </p>
      </div>
    </div>
  );
}
