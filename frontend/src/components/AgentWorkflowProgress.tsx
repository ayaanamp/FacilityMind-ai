import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileText,
  Lightbulb,
  Loader2,
  ShieldCheck,
  Stethoscope,
  Wrench,
} from 'lucide-react';
import { AgentRun } from '../types';

interface AgentWorkflowProgressProps {
  isRunning: boolean;
  activeAgentIndex?: number;
  agentRuns?: AgentRun[];
  isFallback?: boolean;
}

interface AgentDefinition {
  name: string;
  role: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const AGENT_PIPELINE: AgentDefinition[] = [
  {
    name: 'Complaint Analysis Agent',
    role: 'Entity & Symptom Extraction',
    icon: Stethoscope,
    description: 'Extracts equipment category, ID, location, specific mechanical/electrical symptoms, and severity.',
  },
  {
    name: 'Historical Retrieval Agent',
    role: 'Semantic Vector Retrieval',
    icon: Database,
    description: 'Performs semantic vector search across 265+ historical records to retrieve matching precedents.',
  },
  {
    name: 'Diagnosis Agent',
    role: 'Root Cause Inference',
    icon: Lightbulb,
    description: 'Correlates extracted symptoms with historical failure modes to determine primary and secondary causes.',
  },
  {
    name: 'Recommendation Agent',
    role: 'Corrective Fix Prescription',
    icon: Wrench,
    description: 'Calculates cost range (₹), repair time, safety procedures, required technician trade, and tool list.',
  },
  {
    name: 'Explanation Agent',
    role: 'Decision Rationale Synthesis',
    icon: FileText,
    description: 'Generates a transparent, auditable 5-point plain-language explanation of why this decision was reached.',
  },
  {
    name: 'Validation & Guardrail Agent',
    role: 'Integrity & Bounds Verification',
    icon: ShieldCheck,
    description: 'Validates safety constraints, price sanity bounds, urgency consistency, and evidence grounding.',
  },
];

export const AgentWorkflowProgress: React.FC<AgentWorkflowProgressProps> = ({
  isRunning,
  activeAgentIndex = 0,
  agentRuns = [],
  isFallback = false,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);

  const getAgentStatus = (index: number) => {
    if (agentRuns && agentRuns.length > index) {
      return { status: 'completed', run: agentRuns[index] };
    }
    if (isRunning && activeAgentIndex === index) {
      return { status: 'running', run: null };
    }
    if (isRunning && activeAgentIndex > index) {
      return { status: 'completed', run: null };
    }
    return { status: 'waiting', run: null };
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold tracking-wide text-foreground">
            Multi-Agent Decision Orchestration Pipeline
          </h3>
        </div>
        {isFallback && (
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono">
            Evidence Fallback Engine Active
          </span>
        )}
      </div>

      {/* Visual Stepper / Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {AGENT_PIPELINE.map((agent, idx) => {
          const Icon = agent.icon;
          const { status, run } = getAgentStatus(idx);
          const isSelected = selectedAgent === idx;

          return (
            <div
              key={agent.name}
              onClick={() => setSelectedAgent(isSelected ? null : idx)}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer relative overflow-hidden ${
                status === 'running'
                  ? 'border-white bg-zinc-900/90 shadow-lg ring-1 ring-white/30'
                  : status === 'completed'
                  ? 'border-emerald-800/60 bg-zinc-950 hover:border-emerald-700'
                  : 'border-zinc-850 bg-zinc-950/60 opacity-60 hover:opacity-90'
              }`}
            >
              {/* Top Row: Icon, Name & Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`h-8 w-8 rounded-md flex items-center justify-center ${
                      status === 'running'
                        ? 'bg-white text-black animate-pulse'
                        : status === 'completed'
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white leading-tight block font-mono">
                      {agent.name}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">{agent.role}</span>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="shrink-0">
                  {status === 'running' ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-primary animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      RUNNING
                    </span>
                  ) : status === 'completed' ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      DONE
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-muted-foreground">WAITING</span>
                  )}
                </div>
              </div>

              {/* Execution Summary / Description */}
              <div className="mt-2.5 pt-2 border-t border-border/30 text-xs">
                {run ? (
                  <div className="space-y-1">
                    <p className="text-[11px] text-foreground font-mono leading-relaxed line-clamp-2">
                      {run.output_summary}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                      <Clock className="h-3 w-3" />
                      <span>{run.execution_time_ms} ms</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{agent.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
