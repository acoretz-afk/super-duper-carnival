'use client';

import { useState, useCallback } from 'react';
import {
  CaseType,
  HoldoverSubtype,
  CASE_TYPE_LABELS,
  HOLDOVER_SUBTYPE_LABELS,
} from '../lib/types';
import type { CaseAnalysisResult } from '../lib/analysis/orchestrator';

interface Props {
  onAnalysisComplete: (result: CaseAnalysisResult) => void;
  onAnalysisStart: () => void;
  onError: (msg: string) => void;
  isAnalyzing: boolean;
}

interface UploadedFile {
  file: File;
  nyscefLabel: string;
}

export default function CaseIntakeForm({
  onAnalysisComplete,
  onAnalysisStart,
  onError,
  isAnalyzing,
}: Props) {
  const [caseType, setCaseType] = useState<CaseType>('nonpayment');
  const [holdoverSubtype, setHoldoverSubtype] = useState<HoldoverSubtype>('lease_expiration');
  const [indexNumber, setIndexNumber] = useState('');
  const [filingDate, setFilingDate] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files)
      .filter(f => f.type === 'application/pdf')
      .map(f => ({ file: f, nyscefLabel: '' }));

    setFiles(prev => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files)
      .filter(f => f.type === 'application/pdf')
      .map(f => ({ file: f, nyscefLabel: '' }));
    setFiles(prev => [...prev, ...selected]);
  };

  const updateNyscefLabel = (index: number, label: string) => {
    setFiles(prev =>
      prev.map((f, i) => (i === index ? { ...f, nyscefLabel: label } : f))
    );
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (files.length === 0) {
      onError('Please upload at least one PDF document.');
      return;
    }

    onAnalysisStart();

    try {
      const formData = new FormData();
      formData.append('caseType', caseType);
      if (caseType === 'holdover') {
        formData.append('holdoverSubtype', holdoverSubtype);
      }
      if (indexNumber) formData.append('indexNumber', indexNumber);
      if (filingDate) formData.append('filingDate', filingDate);

      files.forEach((f, i) => {
        formData.append(`file_${i}`, f.file);
        formData.append(`label_${i}`, f.nyscefLabel);
      });
      formData.append('fileCount', files.length.toString());

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Analysis failed (${response.status})`);
      }

      const result = await response.json();
      onAnalysisComplete(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Case Information */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Case Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Case Type *
            </label>
            <select
              value={caseType}
              onChange={e => setCaseType(e.target.value as CaseType)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(CASE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {caseType === 'holdover' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Holdover Subtype
              </label>
              <select
                value={holdoverSubtype}
                onChange={e => setHoldoverSubtype(e.target.value as HoldoverSubtype)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.entries(HOLDOVER_SUBTYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Index Number
            </label>
            <input
              type="text"
              value={indexNumber}
              onChange={e => setIndexNumber(e.target.value)}
              placeholder="e.g., LT-123456-24/NY"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filing Date
            </label>
            <input
              type="date"
              value={filingDate}
              onChange={e => setFilingDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Document Upload */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Upload NYSCEF Documents</h2>
        <p className="text-sm text-gray-600 mb-4">
          Upload the case PDFs from NYSCEF. The system will automatically classify each
          document (petition, notice of petition, affidavits of service, predicate notices, etc.).
          For best results, include the NYSCEF document label.
        </p>

        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="text-gray-500">
            <p className="text-lg mb-2">Drop PDF files here</p>
            <p className="text-sm mb-4">or</p>
            <label className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm">
              Browse Files
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-4 space-y-3">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-gray-50 rounded-md p-3 border border-gray-200"
              >
                <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                  <span className="text-xs text-red-700 font-medium">PDF</span>
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-medium truncate">{f.file.name}</p>
                  <input
                    type="text"
                    value={f.nyscefLabel}
                    onChange={e => updateNyscefLabel(i, e.target.value)}
                    placeholder="NYSCEF label (e.g., 'Verified Petition', 'Affidavit of Service')"
                    className="mt-1 w-full text-xs border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isAnalyzing || files.length === 0}
          className={`px-6 py-3 rounded-md text-white font-medium transition-colors ${
            isAnalyzing || files.length === 0
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isAnalyzing ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Analyzing Documents...
            </span>
          ) : (
            'Analyze Case'
          )}
        </button>
      </div>
    </form>
  );
}
