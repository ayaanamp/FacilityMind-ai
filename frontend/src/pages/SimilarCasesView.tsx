import React, { useEffect, useState } from 'react';
import {
  Compass,
  Database,
  ExternalLink,
  Filter,
  Loader2,
  Search,
  Sparkles,
  Wrench,
  X,
  FileText,
  Clock,
  IndianRupee,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { fetchEquipmentCategories, searchSimilarCases } from '../services/api';
import { SimilarCase } from '../types';

interface SimilarCasesViewProps {
  initialQuery?: string;
  initialEquipment?: string;
  onSelectForComplaint?: (caseItem: SimilarCase) => void;
}

export const SimilarCasesView: React.FC<SimilarCasesViewProps> = ({
  initialQuery = 'AC is not cooling properly and is making a loud rattling noise',
  initialEquipment = '',
  onSelectForComplaint,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [equipmentType, setEquipmentType] = useState(initialEquipment);
  const [categories, setCategories] = useState<Array<{ type: string; count: number }>>([]);
  const [cases, setCases] = useState<SimilarCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<SimilarCase | null>(null);

  useEffect(() => {
    fetchEquipmentCategories().then(setCategories).catch(() => {});
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const results = await searchSimilarCases(query, equipmentType || undefined, 12);
      setCases(results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, [equipmentType]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300 pb-16">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono uppercase tracking-wider mb-1.5">
          <Database className="h-4 w-4 text-zinc-300" />
          <span>Semantic Vector Engine & Bullseye Case Matching</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
          Historical Evidence & Case Explorer
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Perform cosine similarity vector retrieval across 265+ verified historical facility engineering records with live ranking and cost benchmarks.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <Card className="border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search symptoms, failure modes, vibrations, tripped breakers, error codes..."
                className="w-full rounded-md border border-zinc-800 bg-black pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>

            <div className="sm:w-64">
              <div className="relative">
                <Filter className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
                <select
                  value={equipmentType}
                  onChange={(e) => setEquipmentType(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-black pl-8 pr-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 appearance-none cursor-pointer"
                >
                  <option value="">All Equipment ({categories.reduce((acc, c) => acc + c.count, 0)})</option>
                  {categories.map((c) => (
                    <option key={c.type} value={c.type}>
                      {c.type} ({c.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="bg-white hover:bg-zinc-200 text-black text-xs font-semibold px-5 shrink-0 flex items-center gap-1.5 transition-all shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Search Evidence
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
        <span className="flex items-center gap-2">
          <Compass className="h-3.5 w-3.5 text-zinc-400" />
          Showing top {cases.length} semantic similarity matches
        </span>
        <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
          Embedding Vector: 384-dim (Cosine Similarity)
        </span>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 rounded-lg bg-red-950/30 border border-red-900/50 text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Cases Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cases.map((c) => {
          const isHighMatch = c.similarity_percentage >= 80;
          return (
            <Card
              key={c.case_id}
              onClick={() => setSelectedCase(c)}
              className="border-zinc-800/80 bg-zinc-950/70 hover:border-zinc-600 hover:bg-zinc-900/50 cursor-pointer transition-all flex flex-col justify-between group shadow-sm"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-zinc-300 group-hover:text-white flex items-center gap-1.5">
                    Case #{c.case_id}
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400" />
                  </span>
                  <Badge
                    className={
                      isHighMatch
                        ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60 font-mono text-[10px]'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-700 font-mono text-[10px]'
                    }
                  >
                    {c.similarity_percentage}% Match
                  </Badge>
                </div>
                <CardDescription className="text-xs flex items-center justify-between pt-1 text-zinc-400">
                  <span className="font-medium text-zinc-300">{c.equipment_type} ({c.equipment_id})</span>
                  <span className="text-zinc-500 font-mono text-[11px] truncate max-w-[140px]">{c.location}</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 text-xs pt-1 flex-1 flex flex-col justify-between">
                <div>
                  {/* Reported Symptom Box */}
                  <div className="p-2.5 rounded bg-black/60 border border-zinc-850 font-mono text-[11px] text-zinc-300 line-clamp-2 mb-2">
                    "{c.complaint}"
                  </div>

                  {/* Diagnosis & Root Cause */}
                  <div className="space-y-1.5 text-[11px]">
                    <div>
                      <span className="text-zinc-500 font-medium">Diagnosis: </span>
                      <span className="text-zinc-200">{c.diagnosis}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 font-medium">Root Cause: </span>
                      <span className="text-amber-400/90">{c.root_cause}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 font-medium">Prescribed Fix: </span>
                      <span className="text-emerald-400/90">{c.recommended_fix}</span>
                    </div>
                  </div>
                </div>

                {/* Metrics Row */}
                <div className="pt-3 mt-2 border-t border-zinc-850 grid grid-cols-3 gap-1 text-[10px] text-zinc-500 font-mono">
                  <div>
                    <span className="block text-[9px] text-zinc-600">COST</span>
                    <span className="font-semibold text-zinc-200">₹{c.estimated_cost.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-zinc-600">DURATION</span>
                    <span className="font-semibold text-zinc-200">{c.repair_time}h</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[9px] text-zinc-600">URGENCY</span>
                    <span
                      className={`font-semibold ${
                        c.urgency === 'Critical'
                          ? 'text-red-400'
                          : c.urgency === 'High'
                          ? 'text-amber-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {c.urgency}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Case Details Inspection Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-2xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto font-sans">
            <button
              onClick={() => setSelectedCase(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-md border border-zinc-800 bg-zinc-900 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-zinc-900 border border-zinc-800 text-white">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white font-mono">
                    Case #{selectedCase.case_id} &bull; {selectedCase.equipment_type}
                  </h3>
                  <Badge className="bg-zinc-900 text-zinc-300 border-zinc-700 font-mono text-[10px]">
                    {selectedCase.similarity_percentage}% Vector Match
                  </Badge>
                </div>
                <p className="text-xs text-zinc-400 font-mono">
                  Asset Tag: {selectedCase.equipment_id} &bull; Location: {selectedCase.location}
                </p>
              </div>
            </div>

            {/* Original Symptom / Complaint */}
            <div className="p-3.5 rounded-md bg-black border border-zinc-800">
              <span className="text-[11px] font-mono text-zinc-500 uppercase block mb-1">
                Reported Issue & Observations
              </span>
              <p className="text-xs font-mono text-zinc-200 leading-relaxed">
                "{selectedCase.complaint}"
              </p>
            </div>

            {/* Technical Diagnosis Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-md bg-zinc-900/50 border border-zinc-800/80">
                <span className="text-zinc-500 text-[10px] font-mono uppercase block mb-1">
                  Root Cause Analysis
                </span>
                <p className="text-amber-300 font-medium">{selectedCase.root_cause}</p>
              </div>

              <div className="p-3 rounded-md bg-zinc-900/50 border border-zinc-800/80">
                <span className="text-zinc-500 text-[10px] font-mono uppercase block mb-1">
                  Diagnosis Summary
                </span>
                <p className="text-zinc-200">{selectedCase.diagnosis}</p>
              </div>
            </div>

            {/* Prescribed Resolution */}
            <div className="p-3.5 rounded-md bg-zinc-900/40 border border-zinc-800">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-semibold mb-1">
                <Wrench className="h-3.5 w-3.5" />
                <span>Standard Operating Resolution Procedure</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {selectedCase.recommended_fix}
              </p>
            </div>

            {/* Metrics & Operational Impact */}
            <div className="grid grid-cols-3 gap-3 p-3 rounded-md bg-black border border-zinc-850 font-mono text-xs">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-zinc-400" />
                <div>
                  <span className="text-[10px] text-zinc-500 block">COST OUTLAY</span>
                  <span className="font-bold text-white">₹{selectedCase.estimated_cost.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-zinc-400" />
                <div>
                  <span className="text-[10px] text-zinc-500 block">DOWNTIME</span>
                  <span className="font-bold text-white">{selectedCase.repair_time} Hours</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <div>
                  <span className="text-[10px] text-zinc-500 block">SEVERITY</span>
                  <span className="font-bold text-amber-400">{selectedCase.urgency}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCase(null)}
                className="border-zinc-800 text-zinc-400 hover:text-white text-xs"
              >
                Close Window
              </Button>

              {onSelectForComplaint && (
                <Button
                  size="sm"
                  onClick={() => {
                    onSelectForComplaint(selectedCase);
                    setSelectedCase(null);
                  }}
                  className="bg-white hover:bg-zinc-200 text-black font-semibold text-xs flex items-center gap-1.5"
                >
                  <span>Re-run Analysis as Complaint</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
