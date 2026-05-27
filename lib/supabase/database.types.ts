export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type CaseType = "civil" | "criminal" | "family" | "juvenile";

export type CaseStatus =
  | "draft"
  | "intake"
  | "clarifying"
  | "evidence_review"
  | "strategy_review"
  | "ready_for_simulation"
  | "simulating"
  | "judged"
  | "report_ready";

export type Database = {
  public: {
    Tables: {
      cases: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          case_type: CaseType;
          user_position: string | null;
          short_description: string | null;
          status: CaseStatus;
          goal_priorities: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          case_type?: CaseType;
          user_position?: string | null;
          short_description?: string | null;
          status?: CaseStatus;
          goal_priorities?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          case_type?: CaseType;
          user_position?: string | null;
          short_description?: string | null;
          status?: CaseStatus;
          goal_priorities?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      case_inputs: {
        Row: {
          id: string;
          case_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          content?: string;
        };
        Relationships: [];
      };
      case_summaries: {
        Row: {
          id: string;
          case_id: string;
          summary: string | null;
          timeline: Json;
          people: Json;
          core_facts: Json;
          favorable_facts: Json;
          unfavorable_facts: Json;
          expected_issues: Json;
          case_type_candidates: Json;
          missing_information: Json;
          model: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          summary?: string | null;
          timeline?: Json;
          people?: Json;
          core_facts?: Json;
          favorable_facts?: Json;
          unfavorable_facts?: Json;
          expected_issues?: Json;
          case_type_candidates?: Json;
          missing_information?: Json;
          model?: string | null;
          created_at?: string;
        };
        Update: {
          summary?: string | null;
          timeline?: Json;
          people?: Json;
          core_facts?: Json;
          favorable_facts?: Json;
          unfavorable_facts?: Json;
          expected_issues?: Json;
          case_type_candidates?: Json;
          missing_information?: Json;
          model?: string | null;
        };
        Relationships: [];
      };
      case_questions: {
        Row: {
          id: string;
          case_id: string;
          question: string;
          answer: string | null;
          reason: string | null;
          is_required: boolean;
          answered_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          question: string;
          answer?: string | null;
          reason?: string | null;
          is_required?: boolean;
          answered_at?: string | null;
          created_at?: string;
        };
        Update: {
          question?: string;
          answer?: string | null;
          reason?: string | null;
          is_required?: boolean;
          answered_at?: string | null;
        };
        Relationships: [];
      };
      evidences: {
        Row: {
          id: string;
          case_id: string;
          user_id: string;
          name: string;
          evidence_type: string | null;
          storage_path: string | null;
          content_text: string | null;
          summary: string | null;
          proves_fact: string | null;
          related_argument: string | null;
          strengths: Json;
          weaknesses: Json;
          needed_supplements: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          user_id: string;
          name: string;
          evidence_type?: string | null;
          storage_path?: string | null;
          content_text?: string | null;
          summary?: string | null;
          proves_fact?: string | null;
          related_argument?: string | null;
          strengths?: Json;
          weaknesses?: Json;
          needed_supplements?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          evidence_type?: string | null;
          storage_path?: string | null;
          content_text?: string | null;
          summary?: string | null;
          proves_fact?: string | null;
          related_argument?: string | null;
          strengths?: Json;
          weaknesses?: Json;
          needed_supplements?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      legal_sources: {
        Row: {
          id: string;
          kind: string;
          title: string;
          source: string;
          case_number: string | null;
          court_name: string | null;
          decision_date: string | null;
          original_url: string | null;
          api_id: string | null;
          retrieved_at: string;
          body: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          kind: string;
          title: string;
          source?: string;
          case_number?: string | null;
          court_name?: string | null;
          decision_date?: string | null;
          original_url?: string | null;
          api_id?: string | null;
          retrieved_at?: string;
          body?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          kind?: string;
          title?: string;
          source?: string;
          case_number?: string | null;
          court_name?: string | null;
          decision_date?: string | null;
          original_url?: string | null;
          api_id?: string | null;
          retrieved_at?: string;
          body?: string | null;
          metadata?: Json;
        };
        Relationships: [];
      };
      case_legal_links: {
        Row: {
          id: string;
          case_id: string;
          legal_source_id: string;
          relevance_summary: string | null;
          matched_issues: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          legal_source_id: string;
          relevance_summary?: string | null;
          matched_issues?: Json;
          created_at?: string;
        };
        Update: {
          relevance_summary?: string | null;
          matched_issues?: Json;
        };
        Relationships: [];
      };
      api_call_logs: {
        Row: {
          id: string;
          user_id: string | null;
          case_id: string | null;
          provider: string;
          operation: string;
          endpoint: string | null;
          method: string;
          request_metadata: Json;
          response_status: number | null;
          success: boolean;
          duration_ms: number | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          case_id?: string | null;
          provider: string;
          operation: string;
          endpoint?: string | null;
          method?: string;
          request_metadata?: Json;
          response_status?: number | null;
          success?: boolean;
          duration_ms?: number | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string | null;
          case_id?: string | null;
          provider?: string;
          operation?: string;
          endpoint?: string | null;
          method?: string;
          request_metadata?: Json;
          response_status?: number | null;
          success?: boolean;
          duration_ms?: number | null;
          error_message?: string | null;
        };
        Relationships: [];
      };
      legal_source_chunks: {
        Row: {
          id: string;
          legal_source_id: string;
          chunk_index: number;
          content: string;
          embedding: string | null;
          token_count: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          legal_source_id: string;
          chunk_index: number;
          content: string;
          embedding?: string | null;
          token_count?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          chunk_index?: number;
          content?: string;
          embedding?: string | null;
          token_count?: number | null;
          metadata?: Json;
        };
        Relationships: [];
      };
      arguments: {
        Row: {
          id: string;
          case_id: string;
          side: "user" | "opponent" | "prosecutor";
          title: string;
          content: string;
          evidence_links: Json;
          legal_links: Json;
          expected_rebuttals: Json;
          needed_materials: Json;
          model: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          side: "user" | "opponent" | "prosecutor";
          title: string;
          content: string;
          evidence_links?: Json;
          legal_links?: Json;
          expected_rebuttals?: Json;
          needed_materials?: Json;
          model?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          side?: "user" | "opponent" | "prosecutor";
          title?: string;
          content?: string;
          evidence_links?: Json;
          legal_links?: Json;
          expected_rebuttals?: Json;
          needed_materials?: Json;
          model?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      simulation_sessions: {
        Row: {
          id: string;
          case_id: string;
          status: string;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          status?: string;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      simulation_logs: {
        Row: {
          id: string;
          session_id: string;
          case_id: string;
          role: "intake" | "counsel" | "opponent" | "prosecutor" | "judge" | "recorder";
          turn_index: number;
          speaker_label: string;
          content: string;
          legal_citations: Json;
          model: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          case_id: string;
          role: "intake" | "counsel" | "opponent" | "prosecutor" | "judge" | "recorder";
          turn_index: number;
          speaker_label: string;
          content: string;
          legal_citations?: Json;
          model?: string | null;
          created_at?: string;
        };
        Update: {
          role?: "intake" | "counsel" | "opponent" | "prosecutor" | "judge" | "recorder";
          turn_index?: number;
          speaker_label?: string;
          content?: string;
          legal_citations?: Json;
          model?: string | null;
        };
        Relationships: [];
      };
      simulation_judgments: {
        Row: {
          id: string;
          session_id: string;
          case_id: string;
          conclusion: string;
          safety_notice: string;
          created_at: string;
          recognized_facts: Json;
          issue_judgments: Json;
          evidence_assessment: Json;
          related_laws: Json;
          related_precedents: Json;
          uncertainties: Json;
          consultation_checkpoints: Json;
          model: string | null;
        };
        Insert: {
          session_id: string;
          case_id: string;
          conclusion: string;
          safety_notice?: string;
          recognized_facts?: Json;
          issue_judgments?: Json;
          evidence_assessment?: Json;
          related_laws?: Json;
          related_precedents?: Json;
          uncertainties?: Json;
          consultation_checkpoints?: Json;
          model?: string | null;
        };
        Update: {
          conclusion?: string;
          safety_notice?: string;
          recognized_facts?: Json;
          issue_judgments?: Json;
          evidence_assessment?: Json;
          related_laws?: Json;
          related_precedents?: Json;
          uncertainties?: Json;
          consultation_checkpoints?: Json;
          model?: string | null;
        };
        Relationships: [];
      };
      consultation_reports: {
        Row: {
          id: string;
          case_id: string;
          simulation_judgment_id: string | null;
          case_summary: string | null;
          timeline: Json;
          people: Json;
          user_goals: Json;
          key_evidences: Json;
          missing_evidences: Json;
          key_issues: Json;
          user_arguments: Json;
          opponent_arguments: Json;
          related_sources: Json;
          simulation_summary: string | null;
          questions_for_lawyer: Json;
          consultation_material_checklist: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          simulation_judgment_id?: string | null;
          case_summary?: string | null;
          timeline?: Json;
          people?: Json;
          user_goals?: Json;
          key_evidences?: Json;
          missing_evidences?: Json;
          key_issues?: Json;
          user_arguments?: Json;
          opponent_arguments?: Json;
          related_sources?: Json;
          simulation_summary?: string | null;
          questions_for_lawyer?: Json;
          consultation_material_checklist?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          simulation_judgment_id?: string | null;
          case_summary?: string | null;
          timeline?: Json;
          people?: Json;
          user_goals?: Json;
          key_evidences?: Json;
          missing_evidences?: Json;
          key_issues?: Json;
          user_arguments?: Json;
          opponent_arguments?: Json;
          related_sources?: Json;
          simulation_summary?: string | null;
          questions_for_lawyer?: Json;
          consultation_material_checklist?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_legal_source_chunks: {
        Args: {
          query_embedding: string;
          match_count?: number;
        };
        Returns: {
          id: string;
          legal_source_id: string;
          content: string;
          similarity: number;
        }[];
      };
      match_case_legal_source_chunks: {
        Args: {
          target_case_id: string;
          query_embedding: string;
          match_count?: number;
        };
        Returns: {
          id: string;
          legal_source_id: string;
          content: string;
          similarity: number;
        }[];
      };
    };
    Enums: {
      case_type: CaseType;
      case_status: CaseStatus;
    };
  };
};
