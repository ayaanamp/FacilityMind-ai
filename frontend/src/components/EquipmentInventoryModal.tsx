import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { createEquipment, deleteEquipment, fetchEquipmentList, importEquipmentCsv } from '../services/api';
import { EquipmentItem } from '../types';

interface EquipmentInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
}

export const EquipmentInventoryModal: React.FC<EquipmentInventoryModalProps> = ({
  isOpen,
  onClose,
  categories,
}) => {
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // New Equipment Form Modal
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState(categories[0] || 'Air Conditioner');
  const [formId, setFormId] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formBuilding, setFormBuilding] = useState('');
  const [formFloor, setFormFloor] = useState('');
  const [formManufacturer, setFormManufacturer] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formStatus, setFormStatus] = useState('Operational');
  const [formCriticality, setFormCriticality] = useState('Medium');

  // CSV Import State
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  // Status message
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadEquipment = async () => {
    setLoading(true);
    try {
      const items = await fetchEquipmentList();
      setEquipmentList(items);
    } catch (err: any) {
      console.error('Failed to load equipment:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadEquipment();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formType.trim() || !formId.trim() || !formLocation.trim()) {
      setMessage({ type: 'error', text: 'Name, Type, ID, and Location are required.' });
      return;
    }
    setAdding(true);
    setMessage(null);
    try {
      await createEquipment({
        equipment_name: formName.trim(),
        equipment_type: formType.trim(),
        equipment_id: formId.trim(),
        location: formLocation.trim(),
        building: formBuilding.trim() || undefined,
        floor: formFloor.trim() || undefined,
        manufacturer: formManufacturer.trim() || undefined,
        model: formModel.trim() || undefined,
        status: formStatus,
        criticality: formCriticality,
      });

      setMessage({ type: 'success', text: `Asset ${formName} added to inventory.` });
      setShowAddForm(false);
      // Reset form
      setFormName('');
      setFormId('');
      setFormLocation('');
      setFormBuilding('');
      setFormFloor('');
      loadEquipment();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add equipment asset.' });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteEquipment = async (id: number) => {
    try {
      await deleteEquipment(id);
      setEquipmentList((prev) => prev.filter((item) => item.id !== id));
      setMessage({ type: 'success', text: 'Asset removed from inventory.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete asset.' });
    }
  };

  const handleImportCsv = async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    setMessage(null);
    try {
      const res = await importEquipmentCsv(csvText.trim());
      setMessage({ type: 'success', text: res.message });
      setShowCsvImport(false);
      setCsvText('');
      loadEquipment();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to import CSV inventory.' });
    } finally {
      setImporting(false);
    }
  };

  const filteredEquipment = equipmentList.filter((item) => {
    const matchesSearch =
      searchTerm === '' ||
      item.equipment_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.equipment_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || item.equipment_type === filterType;
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-mono">
      <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-sans">
                Facility Equipment &amp; Asset Inventory
              </h2>
              <p className="text-[11px] text-zinc-400">
                {equipmentList.length} physical assets registered across campus
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="p-4 bg-zinc-950 border-b border-zinc-850 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search assets by name, ID, or room..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-white focus:outline-none"
            >
              <option value="all">All Types</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-white focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="Operational">Operational</option>
              <option value="Degraded">Degraded</option>
              <option value="Under Maintenance">Under Maintenance</option>
              <option value="Offline">Offline</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCsvImport(true)}
              className="border-zinc-700 text-zinc-300 text-xs flex items-center gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              Import CSV
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowAddForm(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Equipment
            </Button>
          </div>
        </div>

        {/* Content Table / List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
          {message && (
            <div
              className={`p-3 rounded-lg border flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-600/80 text-emerald-300'
                  : 'bg-red-950/40 border-red-800/80 text-red-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
              <span>Loading asset database...</span>
            </div>
          ) : filteredEquipment.length === 0 ? (
            <div className="py-12 text-center space-y-2 text-zinc-400">
              <Layers className="h-8 w-8 mx-auto text-zinc-600" />
              <p className="font-semibold text-zinc-300">No equipment assets found</p>
              <p className="text-[11px] text-zinc-500">
                Add equipment assets or import CSV inventory to track your campus infrastructure.
              </p>
            </div>
          ) : (
            <div className="border border-zinc-850 rounded-xl overflow-hidden bg-zinc-900/30">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 text-[11px]">
                    <th className="p-3">Asset Name &amp; ID</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Criticality</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {filteredEquipment.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-white">{item.equipment_name}</div>
                        <div className="text-[10px] text-zinc-400 font-mono">{item.equipment_id}</div>
                      </td>
                      <td className="p-3 text-zinc-300">{item.equipment_type}</td>
                      <td className="p-3 text-zinc-400">{item.location}</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            item.status === 'Operational'
                              ? 'border-emerald-600/80 text-emerald-300 bg-emerald-950/30'
                              : item.status === 'Degraded'
                              ? 'border-amber-600/80 text-amber-300 bg-amber-950/30'
                              : 'border-red-600/80 text-red-300 bg-red-950/30'
                          }`}
                        >
                          {item.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span className={`text-[11px] font-semibold ${
                          item.criticality === 'Critical' ? 'text-red-400' :
                          item.criticality === 'High' ? 'text-amber-400' : 'text-zinc-400'
                        }`}>
                          {item.criticality}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDeleteEquipment(item.id)}
                          className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-all"
                          title="Delete asset"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-zinc-950 border-t border-zinc-850 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            Showing {filteredEquipment.length} of {equipmentList.length} assets
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-zinc-800 text-zinc-300 text-xs"
          >
            Done
          </Button>
        </div>
      </div>

      {/* Add Equipment Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
              <h3 className="font-bold text-sm text-white font-sans">Add Physical Asset to Inventory</h3>
              <button onClick={() => setShowAddForm(false)} className="text-zinc-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEquipment} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-300">Asset Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Server Room AC Unit 1"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-300">Asset / Tag ID *</label>
                  <input
                    type="text"
                    required
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    placeholder="e.g. AC-SRV-01"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-300">Category *</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-300">Location / Room *</label>
                  <input
                    type="text"
                    required
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Data Center Room 102"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-300">Building</label>
                  <input
                    type="text"
                    value={formBuilding}
                    onChange={(e) => setFormBuilding(e.target.value)}
                    placeholder="e.g. Tech Block A"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-300">Floor</label>
                  <input
                    type="text"
                    value={formFloor}
                    onChange={(e) => setFormFloor(e.target.value)}
                    placeholder="e.g. 2nd Floor"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-300">Manufacturer / Brand</label>
                  <input
                    type="text"
                    value={formManufacturer}
                    onChange={(e) => setFormManufacturer(e.target.value)}
                    placeholder="e.g. Daikin / Cummins"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-300">Model / Spec</label>
                  <input
                    type="text"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    placeholder="e.g. FTKF50 / X2.5-G2"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-300">Operational Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  >
                    <option value="Operational">Operational</option>
                    <option value="Degraded">Degraded</option>
                    <option value="Under Maintenance">Under Maintenance</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-300">Criticality</label>
                  <select
                    value={formCriticality}
                    onChange={(e) => setFormCriticality(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-850">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                  className="border-zinc-800 text-zinc-300 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={adding}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                >
                  {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Asset'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvImport && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white font-sans">Bulk CSV Inventory Import</h3>
              </div>
              <button onClick={() => setShowCsvImport(false)} className="text-zinc-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-zinc-400 text-xs">
              Paste CSV records with headers: <code className="text-emerald-400 font-mono">equipment_name,equipment_type,equipment_id,location,status,criticality</code>
            </p>

            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="equipment_name,equipment_type,equipment_id,location,status,criticality&#10;Main Chiller 1,Air Conditioner,CH-01,Central Plant,Operational,High&#10;Backup DG 500kVA,Diesel Generator,DG-01,Substation,Operational,Critical"
              className="w-full rounded-lg border border-zinc-800 bg-black p-3 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-850">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCsvImport(false)}
                className="border-zinc-800 text-zinc-300 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!csvText.trim() || importing}
                onClick={handleImportCsv}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1.5"
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Import Records
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
