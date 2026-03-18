-- Cases table for persisting case intake and analysis results
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_number TEXT,
  case_type TEXT NOT NULL CHECK (case_type IN ('nonpayment', 'holdover', 'hp', 'lockout_illegal_eviction')),
  holdover_subtype TEXT,
  filing_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'error')),

  -- Extracted petition data (JSONB for flexibility)
  petition_data JSONB,

  -- Analysis results
  analysis_result JSONB,
  issues_count INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  summary TEXT,

  -- GCEL analysis
  gcel_analysis JSONB,

  -- External lookup data
  external_data JSONB,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Documents table for uploaded PDFs
CREATE TABLE IF NOT EXISTS case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  nyscef_label TEXT,
  category TEXT, -- classified document type
  storage_path TEXT, -- path in Supabase Storage
  extracted_text TEXT,
  page_count INTEGER,
  ocr_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_cases_index_number ON cases(index_number);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX idx_case_documents_case_id ON case_documents(case_id);

-- Row Level Security
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can manage their own cases
CREATE POLICY "Users can view their own cases"
  ON cases FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create cases"
  ON cases FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own cases"
  ON cases FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can view their own documents"
  ON case_documents FOR SELECT
  USING (case_id IN (SELECT id FROM cases WHERE created_by = auth.uid()));

CREATE POLICY "Users can upload documents to their cases"
  ON case_documents FOR INSERT
  WITH CHECK (case_id IN (SELECT id FROM cases WHERE created_by = auth.uid()));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
