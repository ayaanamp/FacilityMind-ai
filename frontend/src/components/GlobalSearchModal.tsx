import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  FileCheck2,
  FolderArchive,
  Loader2,
  Phone,
  Search,
  User,
  X,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { searchComplaintDossiers, searchSimilarCases } from '../services/api';
import { ComplaintDossierItem, SimilarCase } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInspectComplaint?: (complaintId: number) => void;
  onSelectPrecedentForComplaint?: (caseItem: SimilarCase) => void;
  onSelectForComplaint?: (query: string, equipment?: string, location?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onInspectComplaint,
  onSelectPrecedentForComplaint,
  onSelectForComplaint,
}) => {
  const [query, setQuery] = useState('');
  const [dossiers, setDossiers] = useState<ComplaintDossierItem[]>([]);
  const [similarCases, setSimilarCases] = useState<SimilarCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'complaints' | 'precedents'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setDossiers([]);
      setSimilarCases([]);
    }
  }, [isOpen]);

  // Keyboard shortcut listener (Cmd/Ctrl + K and Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSearch = async (searchTerm: string) => {
    setQuery(searchTerm);
    if (!searchTerm.trim()) {
      setDossiers([]);
      setSimilarCases([]);
      return;
    }

    setLoading(true);
    try {
      const [dossierRes, casesRes] = await Promise.all([
        searchComplaintDossiers(searchTerm).catch(() => ({ results: [] })),
        searchSimilarCases(searchTerm, undefined, 5).catch(() => []),
      ]);
      setDossiers(dossierRes.results || []);
      setSimilarCases(casesRes || []);
    } catch {
      setDossiers([]);
      setSimilarCases([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalResults = dossiers.length + similarCases.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden flex flex-col max-h-[82vh] font-sans">
        {/* Search Header Bar */}
        <div className="p-3 sm:p-4 border-b border-zinc-850 flex items-center gap-3 bg-zinc-900/60">
          <Search className="h-5 w-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by reporter name (e.g. Sharma), mobile number, room, equipment, or symptoms..."
            className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder-zinc-500 focus:outline-none font-mono"
          />
          {query && (
            <button
              onClick={() => handleSearch('')}
              className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs font-mono text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 border border-zinc-700 active:scale-95"
          >
            ESC
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2 bg-zinc-950 border-b border-zinc-850/80 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-[11px]">Filter:</span>
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-0.5 rounded transition-colors ${
                activeFilter === 'all'
                  ? 'bg-zinc-800 text-white border border-zinc-700 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All ({totalResults})
            </button>
            <button
              onClick={() => setActiveFilter('complaints')}
              className={`px-2.5 py-0.5 rounded transition-colors ${
                activeFilter === 'complaints'
                  ? 'bg-zinc-800 text-white border border-zinc-700 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Live Complaints ({dossiers.length})
            </button>
            <button
              onClick={() => setActiveFilter('precedents')}
              className={`px-2.5 py-0.5 rounded transition-colors ${
                activeFilter === 'precedents'
                  ? 'bg-zinc-800 text-white border border-zinc-700 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Knowledge Base ({similarCases.length})
            </button>
          </div>

          {loading && (
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
              <span>Searching index...</span>
            </div>
          )}
        </div>

        {/* Search Results Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!query.trim() ? (
            <div className="py-12 text-center text-zinc-500 font-mono text-xs space-y-2">
              <Search className="h-8 w-8 mx-auto text-zinc-700" />
              <p className="text-zinc-300 font-semibold">Universal Campus Search Engine</p>
              <p className="text-zinc-500 text-[11px] max-w-sm mx-auto">
                Type a faculty name (e.g. &ldquo;Sharma&rdquo;), contact number, classroom (&ldquo;Lab 3&rdquo;), equipment category, or symptoms.
              </p>
            </div>
          ) : totalResults === 0 && !loading ? (
            <div className="py-12 text-center text-zinc-500 font-mono text-xs space-y-2">
              <AlertTriangle className="h-8 w-8 mx-auto text-zinc-700" />
              <p className="text-zinc-300 font-semibold">No matching records found</p>
              <p className="text-zinc-500 text-[11px]">No active complaints or knowledge base precedents matched &ldquo;{query}&rdquo;.</p>
            </div>
          ) : (
            <>
              {/* Section 1: Live Complaint Dossiers */}
              {(activeFilter === 'all' || activeFilter === 'complaints') && dossiers.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase tracking-wider">
                    <FileCheck2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Live Complaint Dossiers ({dossiers.length})</span>
                  </div>

                  <div className="space-y-2.5">
                    {dossiers.map((c) => (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-lg bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-all font-mono text-xs space-y-2.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[11px]">
                              {c.work_order_code}
                            </span>
                            <span className="font-bold text-white text-xs">{c.equipment_type}</span>
                            <span className="text-zinc-400 text-[11px]">&bull; {c.location}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded ${
                                c.severity === 'Critical'
                                  ? 'bg-red-950 text-red-400 border border-red-800'
                                  : c.severity === 'High'
                                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                              }`}
                            >
                              {c.severity}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded ${
                                c.status === 'Resolved'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-sky-950 text-sky-300 border border-sky-800'
                              }`}
                            >
                              {c.status}
                            </span>
                          </div>
                        </div>

                        {/* Reporter & Contact Bar */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-zinc-300 bg-black/50 p-2 rounded border border-zinc-850">
                          <div className="flex items-center gap-1.5 truncate">
                            <User className="h-3 w-3 text-zinc-400 shrink-0" />
                            <span>{c.reporter_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate">
                            <Phone className="h-3 w-3 text-emerald-400 shrink-0" />
                            <a href={`tel:${c.reporter_phone}`} className="text-emerald-400 hover:underline">
                              {c.reporter_phone}
                            </a>
                          </div>
                          <div className="flex items-center gap-1.5 truncate text-zinc-400">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>{c.noticed_at}</span>
                          </div>
                        </div>

                        {/* Symptoms & Diagnosis */}
                        <div className="text-[11px] text-zinc-300 space-y-1">
                          <div>
                            <span className="text-zinc-500">Complaint: </span>
                            <span>&ldquo;{c.raw_complaint}&rdquo;</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">AI Diagnosis: </span>
                            <span className="text-white font-semibold">{c.primary_cause}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Recommended Action: </span>
                            <span className="text-emerald-400">{c.action_recommended}</span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 border-t border-zinc-850 flex items-center justify-between">
                          <div className="text-[10px] text-zinc-400">
                            {c.assigned_technician_name ? (
                              <span>Assigned: <strong className="text-white">{c.assigned_technician_name}</strong></span>
                            ) : (
                              <span>Est Cost: <strong className="text-white">₹{c.estimated_cost}</strong></span>
                            )}
                          </div>

                          {onInspectComplaint && (
                            <Button
                              size="sm"
                              onClick={() => {
                                onInspectComplaint(c.id);
                                onClose();
                              }}
                              className="h-7 text-[11px] bg-white hover:bg-zinc-200 text-black font-bold font-mono px-3 active:scale-95"
                            >
                              <span>Inspect Full Report &rarr;</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 2: Historical Knowledge Base Precedents */}
              {(activeFilter === 'all' || activeFilter === 'precedents') && similarCases.length > 0 && (
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase tracking-wider">
                    <FolderArchive className="h-3.5 w-3.5 text-sky-400" />
                    <span>Knowledge Base Precedents ({similarCases.length})</span>
                  </div>

                  <div className="space-y-2.5">
                    {similarCases.map((cs) => (
                      <div
                        key={cs.case_id}
                        className="p-3.5 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all font-mono text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-300">Case #{cs.case_id}</span>
                            <span className="font-bold text-white">{cs.equipment_type}</span>
                            <span className="text-zinc-400 text-[11px]">&bull; {cs.location}</span>
                          </div>
                          <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px]">
                            {cs.similarity_percentage}% Semantic Match
                          </Badge>
                        </div>

                        <div className="text-[11px] text-zinc-300 space-y-1">
                          <p><span className="text-zinc-500">Historical Issue:</span> {cs.complaint}</p>
                          <p><span className="text-zinc-500">Root Cause:</span> {cs.root_cause || cs.diagnosis}</p>
                          <p className="text-emerald-400"><span className="text-zinc-500">Verified Fix:</span> {cs.recommended_fix}</p>
                        </div>

                        <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-[11px]">
                          <span className="text-zinc-400">Est Outlay: ₹{cs.estimated_cost} &bull; {cs.technician_type}</span>
                          {(onSelectPrecedentForComplaint || onSelectForComplaint) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (onSelectPrecedentForComplaint) {
                                  onSelectPrecedentForComplaint(cs);
                                } else if (onSelectForComplaint) {
                                  onSelectForComplaint(cs.complaint, cs.equipment_type, cs.location);
                                }
                                onClose();
                              }}
                              className="h-7 text-[10px] font-mono border-zinc-700 text-zinc-300 hover:text-white"
                            >
                              <span>Use as Precedent Template &rarr;</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
