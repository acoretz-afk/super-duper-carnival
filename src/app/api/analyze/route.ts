import { NextRequest, NextResponse } from 'next/server';
import { analyzeCase, CaseDocument, CaseAnalysisInput } from '../../../lib/analysis/orchestrator';
import { CaseType, HoldoverSubtype } from '../../../lib/types';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract case metadata
    const caseType = formData.get('caseType') as CaseType;
    if (!caseType || !['nonpayment', 'holdover', 'hp', 'lockout_illegal_eviction'].includes(caseType)) {
      return NextResponse.json({ error: 'Invalid case type' }, { status: 400 });
    }

    const holdoverSubtype = formData.get('holdoverSubtype') as HoldoverSubtype | null;
    const indexNumber = formData.get('indexNumber') as string | null;
    const filingDate = formData.get('filingDate') as string | null;
    const fileCount = parseInt(formData.get('fileCount') as string || '0');

    if (fileCount === 0) {
      return NextResponse.json({ error: 'No documents uploaded' }, { status: 400 });
    }

    // Extract uploaded files
    const documents: CaseDocument[] = [];

    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`file_${i}`) as File | null;
      const label = formData.get(`label_${i}`) as string | null;

      if (!file) continue;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      documents.push({
        id: randomUUID(),
        filename: file.name,
        nyscefLabel: label || undefined,
        buffer,
      });
    }

    if (documents.length === 0) {
      return NextResponse.json({ error: 'No valid PDF documents found' }, { status: 400 });
    }

    // Build analysis input
    const input: CaseAnalysisInput = {
      caseType,
      holdoverSubtype: caseType === 'holdover' ? holdoverSubtype || undefined : undefined,
      indexNumber: indexNumber || undefined,
      filingDate: filingDate || undefined,
      documents,
    };

    // Run analysis
    const result = await analyzeCase(input);

    // Strip buffers from response (not serializable)
    return NextResponse.json(result);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}

export const maxDuration = 60;
