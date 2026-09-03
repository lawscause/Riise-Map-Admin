import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, DollarSign, Calendar, Users, ChevronRight, Plus, X, Check, Circle, Loader2, Trash2, Edit, Paperclip, FileText, Upload, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useGetFundingSources, useCreateFundingSource, useUpdateFundingSource, type FundingSource } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth-fetch";
import Papa from "papaparse";

interface Goal {
  id: number;
  fundingSourceId: number;
  title: string;
  note: string | null;
  status: string;
  documentFileName: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started", icon: Circle, color: "text-muted-foreground" },
  { value: "in_progress", label: "In Progress", icon: Loader2, color: "text-amber-500" },
  { value: "completed", label: "Completed", icon: Check, color: "text-emerald-500" },
];

const emptyForm = {
  name: "",
  objectives: "",
  narrative: "",
  startDate: "",
  endDate: "",
  amount: "",
  learnerCount: "",
};

export default function FundingSources() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: sources = [], isLoading } = useGetFundingSources();
  const createMutation = useCreateFundingSource({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/funding-sources"] }) } });
  const updateMutation = useUpdateFundingSource({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/funding-sources"] }) } });

  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name-az" | "name-za">("newest");
  const sortedSources = [...sources].sort((a: FundingSource, b: FundingSource) => {
    if (sortBy === "newest") return b.id - a.id;
    if (sortBy === "oldest") return a.id - b.id;
    if (sortBy === "name-az") return a.name.localeCompare(b.name);
    return b.name.localeCompare(a.name);
  });

  const [selected, setSelected] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingSource, setEditingSource] = useState<FundingSource | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Goals state
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editGoalForm, setEditGoalForm] = useState({ title: "", note: "", status: "" });
  // Narrative state
  const [narrativeText, setNarrativeText] = useState("");
  const [narrativeDirty, setNarrativeDirty] = useState(false);
  const [narrativeFileName, setNarrativeFileName] = useState<string | null>(null);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-select delete state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const baseUrl = import.meta.env.VITE_API_URL || "";

  const fetchGoals = useCallback(async (fundingSourceId: number) => {
    try {
      const res = await authFetch(`${baseUrl}/api/funding-sources/${fundingSourceId}/goals`);
      if (res.ok) setGoals(await res.json());
    } catch { /* ignore */ }
  }, [baseUrl]);

  useEffect(() => {
    if (selected) {
      fetchGoals(selected);
      const s = sources.find((x: FundingSource) => x.id === selected);
      setNarrativeText(s?.narrative || "");
      setNarrativeFileName(s?.narrativeFileName || null);
      setNarrativeDirty(false);
    }
  }, [selected, sources, fetchGoals]);

  const source = sources.find((s: FundingSource) => s.id === selected);

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    else if (form.name.trim().length > 150) errs.name = "Must be 150 characters or less";
    if (form.objectives.length > 1000) errs.objectives = "Must be 1000 characters or less";
    if (form.amount && isNaN(Number(form.amount))) errs.amount = "Must be a valid number";
    if (form.learnerCount && isNaN(Number(form.learnerCount))) errs.learnerCount = "Must be a valid number";
    if (form.startDate && form.endDate && form.startDate > form.endDate) errs.endDate = "End date must be after start date";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    try {
      await createMutation.mutateAsync({
        data: {
          name: form.name.trim(),
          objectives: form.objectives.trim() || null,
          narrative: form.narrative.trim() || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          amount: form.amount ? Number(form.amount) : null,
          learnerCount: form.learnerCount ? Number(form.learnerCount) : null,
        },
      });
      toast({ title: "Funding Source Created", description: `${form.name} has been added.` });
      setShowCreate(false);
      setForm(emptyForm);
      setFormErrors({});
    } catch {
      toast({ title: "Error", description: "Failed to create funding source.", variant: "destructive" });
    }
  };

  const openEdit = (s: FundingSource) => {
    setEditingSource(s);
    setForm({
      name: s.name,
      objectives: s.objectives || "",
      narrative: s.narrative || "",
      startDate: s.startDate || "",
      endDate: s.endDate || "",
      amount: s.amount != null ? String(s.amount) : "",
      learnerCount: s.learnerCount != null ? String(s.learnerCount) : "",
    });
    setFormErrors({});
  };

  const handleEdit = async () => {
    if (!validateForm() || !editingSource) return;
    try {
      await updateMutation.mutateAsync({
        id: editingSource.id,
        data: {
          name: form.name.trim(),
          objectives: form.objectives.trim() || null,
          narrative: form.narrative.trim() || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          amount: form.amount ? Number(form.amount) : null,
          learnerCount: form.learnerCount ? Number(form.learnerCount) : null,
        },
      });
      toast({ title: "Funding Source Updated", description: `${form.name} has been updated.` });
      setEditingSource(null);
      setForm(emptyForm);
      setFormErrors({});
    } catch {
      toast({ title: "Error", description: "Failed to update funding source.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirmText !== deleteTarget.name) return;
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "";
      const res = await authFetch(`${baseUrl}/api/funding-sources/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast({ title: "Error", description: data?.error || "Failed to delete funding source.", variant: "destructive" });
        setDeleteTarget(null);
        setDeleteConfirmText("");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/funding-sources"] });
      toast({ title: "Funding Source Deleted", description: `${deleteTarget.name} has been removed.` });
      setSelected(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete funding source.", variant: "destructive" });
    }
    setDeleteTarget(null);
    setDeleteConfirmText("");
  };

  if (isLoading) {
    return (
      <div className="px-6 py-8 max-w-5xl mx-auto">
        <div className="text-center py-12"><p className="text-muted-foreground">Loading funding sources...</p></div>
      </div>
    );
  }

  /* ── Detail view ─────────────────────────────────────────── */
  if (selected && source) {
    return (
      <div className="px-6 py-8 max-w-4xl mx-auto">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
          <ArrowLeft size={14} /> Back to Funding Sources
        </button>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{source.name}</h1>
            {source.objectives && <p className="text-sm text-muted-foreground mt-1">{source.objectives}</p>}
          </div>
          <div className="flex gap-2 ml-4">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { openEdit(source); setSelected(null); }}>Edit</Button>
            <Button variant="outline" size="sm" className="text-xs h-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ id: source.id, name: source.name })}>Delete</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="text-2xl font-semibold text-foreground">{source.amount != null ? `$${Number(source.amount).toLocaleString()}` : "—"}</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Learner Count</p>
            <p className="text-2xl font-semibold text-foreground">{source.learnerCount ?? "—"}</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Start Date</p>
            <p className="text-sm font-medium text-foreground mt-1">{source.startDate || "—"}</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">End Date</p>
            <p className="text-sm font-medium text-foreground mt-1">{source.endDate || "—"}</p>
          </div>
        </div>

        {/* Grant Narrative */}
        <Card className="border-card-border mb-5">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Grant Narrative</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <Textarea
              className="text-sm resize-none min-h-[120px]"
              placeholder="Enter the grant narrative text here..."
              value={narrativeText}
              onChange={e => { setNarrativeText(e.target.value); setNarrativeDirty(true); }}
            />
            {narrativeDirty && (
              <Button
                size="sm"
                className="mt-3 text-xs h-8"
                onClick={async () => {
                  try {
                    await updateMutation.mutateAsync({ id: source.id, data: { narrative: narrativeText.trim() || null } });
                    setNarrativeDirty(false);
                    toast({ title: "Saved", description: "Narrative updated." });
                  } catch {
                    toast({ title: "Error", description: "Failed to save narrative.", variant: "destructive" });
                  }
                }}
              >
                Save Narrative
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Goals */}
        <Card className="border-card-border mb-5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Grant Goals</CardTitle>
              <span className="text-xs text-muted-foreground">{goals.filter(g => g.status === "completed").length}/{goals.length} completed</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {goals.map(goal => {
              const statusInfo = STATUS_OPTIONS.find(s => s.value === goal.status) || STATUS_OPTIONS[0];
              const StatusIcon = statusInfo.icon;

              if (editingGoal?.id === goal.id) {
                return (
                  <div key={goal.id} className="border border-border rounded-lg p-3 space-y-2">
                    <Input className="h-9 text-sm" value={editGoalForm.title} onChange={e => setEditGoalForm(f => ({ ...f, title: e.target.value }))} placeholder="Goal title" />
                    <Textarea className="text-sm resize-none" rows={2} value={editGoalForm.note} onChange={e => setEditGoalForm(f => ({ ...f, note: e.target.value }))} placeholder="Note..." />
                    <Select value={editGoalForm.status} onValueChange={v => setEditGoalForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger className="h-9 text-sm w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button size="sm" className="text-xs h-7" onClick={async () => {
                        try {
                          await authFetch(`${baseUrl}/api/funding-sources/${selected}/goals/${goal.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editGoalForm) });
                          setEditingGoal(null);
                          fetchGoals(selected!);
                        } catch { toast({ title: "Error", description: "Failed to update goal.", variant: "destructive" }); }
                      }}>Save</Button>
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setEditingGoal(null)}>Cancel</Button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={goal.id} className="flex items-start gap-3 border border-border rounded-lg p-3 group">
                  <button
                    className="mt-0.5 flex-shrink-0"
                    onClick={async () => {
                      const next = goal.status === "completed" ? "not_started" : "completed";
                      await authFetch(`${baseUrl}/api/funding-sources/${selected}/goals/${goal.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: goal.title, note: goal.note, status: next }) });
                      fetchGoals(selected!);
                    }}
                  >
                    <StatusIcon size={16} className={statusInfo.color} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", goal.status === "completed" && "line-through text-muted-foreground")}>{goal.title}</p>
                    {goal.note && <p className="text-xs text-muted-foreground mt-0.5">{goal.note}</p>}
                    <div className="flex items-center gap-3 mt-1">
                      <span className={cn("text-[10px] font-medium", statusInfo.color)}>{statusInfo.label}</span>
                      {goal.documentFileName ? (
                        <span className="flex items-center gap-1 text-[10px] text-primary">
                          <Paperclip size={10} />
                          <button className="hover:underline" onClick={() => window.open(`${baseUrl}/api/funding-sources/${selected}/goals/${goal.id}/document`, "_blank")}>{goal.documentFileName}</button>
                          <button className="text-destructive ml-1 hover:text-destructive/70" onClick={async () => {
                            await authFetch(`${baseUrl}/api/funding-sources/${selected}/goals/${goal.id}/document`, { method: "DELETE" });
                            fetchGoals(selected!);
                          }}><X size={10} /></button>
                        </span>
                      ) : (
                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                          <Paperclip size={10} />
                          <span>Attach</span>
                          <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) { toast({ title: "Error", description: "File must be under 5MB.", variant: "destructive" }); return; }
                            const reader = new FileReader();
                            reader.onload = async () => {
                              const base64 = (reader.result as string).split(",")[1];
                              await authFetch(`${baseUrl}/api/funding-sources/${selected}/goals/${goal.id}/document`, {
                                method: "PUT", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ fileName: file.name, fileData: base64 }),
                              });
                              fetchGoals(selected!);
                            };
                            reader.readAsDataURL(file);
                            e.target.value = "";
                          }} />
                        </label>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 hover:bg-muted rounded" onClick={() => { setEditingGoal(goal); setEditGoalForm({ title: goal.title, note: goal.note || "", status: goal.status }); }}><Edit size={12} /></button>
                    <button className="p-1 hover:bg-muted rounded text-destructive" onClick={async () => {
                      await authFetch(`${baseUrl}/api/funding-sources/${selected}/goals/${goal.id}`, { method: "DELETE" });
                      fetchGoals(selected!);
                    }}><Trash2 size={12} /></button>
                  </div>
                </div>
              );
            })}

            {/* Add goal inline */}
            <div className="flex gap-2">
              <Input
                className="h-9 text-sm flex-1"
                placeholder="Add a new goal..."
                value={newGoalTitle}
                onChange={e => setNewGoalTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && newGoalTitle.trim()) {
                    e.preventDefault();
                    (async () => {
                      await authFetch(`${baseUrl}/api/funding-sources/${selected}/goals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newGoalTitle.trim() }) });
                      setNewGoalTitle("");
                      fetchGoals(selected!);
                    })();
                  }
                }}
              />
              <Button variant="outline" size="sm" className="h-9 px-3" disabled={!newGoalTitle.trim()} onClick={async () => {
                await authFetch(`${baseUrl}/api/funding-sources/${selected}/goals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newGoalTitle.trim() }) });
                setNewGoalTitle("");
                fetchGoals(selected!);
              }}><Plus size={14} /></Button>
            </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
            <div className="bg-background rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-semibold text-foreground mb-2">Delete Funding Source</h2>
              <p className="text-sm text-muted-foreground mb-4">
                This will permanently delete <span className="font-medium text-foreground">{deleteTarget.name}</span> and cannot be undone.
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                Type <span className="font-mono font-medium text-foreground">{deleteTarget.name}</span> to confirm:
              </p>
              <Input className="h-10 text-sm mb-4" placeholder="Type name to confirm..." value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} autoFocus />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}>Cancel</Button>
                <Button variant="destructive" className="flex-1" disabled={deleteConfirmText !== deleteTarget.name} onClick={handleDelete}>Delete</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Form modal (shared for create/edit) ─────────────────── */
  const formModal = (showCreate || editingSource) && (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-background rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-background z-10">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{editingSource ? "Edit Funding Source" : "Add Funding Source"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{editingSource ? "Update funding source details." : "Add a new funding source to track grants and budgets."}</p>
          </div>
          <button onClick={() => { setShowCreate(false); setEditingSource(null); setForm(emptyForm); setFormErrors({}); }} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <Label className="text-sm font-medium">Name <span className="text-destructive">*</span></Label>
            <Input
              className={cn("mt-1.5 h-10 text-sm", formErrors.name && "border-destructive")}
              placeholder="e.g. City Workforce Development Grant"
              maxLength={150}
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormErrors(er => ({ ...er, name: "" })); }}
            />
            {formErrors.name && <p className="text-xs text-destructive mt-1">{formErrors.name}</p>}
          </div>

          <div>
            <Label className="text-sm font-medium">Objectives</Label>
            <Textarea
              className={cn("mt-1.5 text-sm resize-none", formErrors.objectives && "border-destructive")}
              rows={3}
              maxLength={1000}
              placeholder="Describe the goals and objectives of this funding..."
              value={form.objectives}
              onChange={e => { setForm(f => ({ ...f, objectives: e.target.value })); setFormErrors(er => ({ ...er, objectives: "" })); }}
            />
            <div className="flex justify-end mt-1"><span className="text-xs text-muted-foreground">{form.objectives.length}/1000</span></div>
          </div>

          <div>
            <Label className="text-sm font-medium">Grant Narrative</Label>
            <Textarea
              className="mt-1.5 text-sm resize-none"
              rows={4}
              placeholder="Enter the full grant narrative text..."
              value={form.narrative}
              onChange={e => setForm(f => ({ ...f, narrative: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Amount ($)</Label>
              <Input
                className={cn("mt-1.5 h-10 text-sm", formErrors.amount && "border-destructive")}
                placeholder="e.g. 250000"
                value={form.amount}
                onChange={e => { setForm(f => ({ ...f, amount: e.target.value })); setFormErrors(er => ({ ...er, amount: "" })); }}
              />
              {formErrors.amount && <p className="text-xs text-destructive mt-1">{formErrors.amount}</p>}
            </div>
            <div>
              <Label className="text-sm font-medium">Learner Count</Label>
              <Input
                className={cn("mt-1.5 h-10 text-sm", formErrors.learnerCount && "border-destructive")}
                placeholder="e.g. 50"
                value={form.learnerCount}
                onChange={e => { setForm(f => ({ ...f, learnerCount: e.target.value })); setFormErrors(er => ({ ...er, learnerCount: "" })); }}
              />
              {formErrors.learnerCount && <p className="text-xs text-destructive mt-1">{formErrors.learnerCount}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Start Date</Label>
              <Input type="date" className="mt-1.5 h-10 text-sm" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm font-medium">End Date</Label>
              <Input type="date" className={`mt-1.5 h-10 text-sm ${formErrors.endDate ? "border-destructive" : ""}`} value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              {formErrors.endDate && <p className="text-xs text-destructive mt-1">{formErrors.endDate}</p>}
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <Button variant="outline" className="flex-1" onClick={() => { setShowCreate(false); setEditingSource(null); setForm(emptyForm); setFormErrors({}); }}>Cancel</Button>
          <Button className="flex-1" onClick={editingSource ? handleEdit : handleCreate}>
            {editingSource ? "Save Changes" : "Create Funding Source"}
          </Button>
        </div>
      </div>
    </div>
  );

  /* ── List view ───────────────────────────────────────────── */
  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Funding Sources</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {sources.length} funding source{sources.length !== 1 ? "s" : ""} tracking ${sources.reduce((a: number, s: FundingSource) => a + (Number(s.amount) || 0), 0).toLocaleString()} in total funding
          </p>
          {sources.length > 0 && <p className="text-xs text-muted-foreground/70 mt-0.5">Select items with checkboxes to delete multiple at once</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
            <Upload size={14} className="mr-1.5" /> Import CSV
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} className="mr-1.5" /> Add Funding Source
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-20 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-4 shadow-sm">
          <span className="text-sm text-amber-800 font-medium">{selectedIds.size} funding source{selectedIds.size > 1 ? "s" : ""} selected</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setSelectedIds(new Set())}>Clear</Button>
            <Button variant="destructive" size="sm" className="text-xs h-7" onClick={() => setShowBulkDelete(true)}>
              <Trash2 size={12} className="mr-1" /> Delete Selected
            </Button>
          </div>
        </div>
      )}

      {sources.length === 0 ? (
        <Card className="border-card-border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <DollarSign size={24} className="text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No Funding Sources Yet</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm">
              Add your first funding source to track grants, budgets, and learner allocations.
            </p>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={13} className="mr-1.5" /> Add Your First Funding Source
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort by:</span>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="name-az">Name A–Z</SelectItem>
                <SelectItem value="name-za">Name Z–A</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {sortedSources.map((s: FundingSource) => (
            <Card key={s.id} className="border-card-border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Checkbox
                      checked={selectedIds.has(s.id)}
                      onCheckedChange={(checked) => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (checked) next.add(s.id); else next.delete(s.id);
                          return next;
                        });
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-foreground mb-1">{s.name}</h2>
                    {s.objectives && <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{s.objectives}</p>}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="text-lg font-semibold text-foreground flex items-center gap-1">
                          <DollarSign size={14} className="text-primary" />
                          {s.amount != null ? Number(s.amount).toLocaleString() : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Learners</p>
                        <p className="text-lg font-semibold text-foreground flex items-center gap-1">
                          <Users size={14} className="text-emerald-500" />
                          {s.learnerCount ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Start</p>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1">
                          <Calendar size={12} className="text-muted-foreground" />
                          {s.startDate || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">End</p>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1">
                          <Calendar size={12} className="text-muted-foreground" />
                          {s.endDate || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setSelected(s.id)}>
                      View <ChevronRight size={12} className="ml-1" />
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => openEdit(s)}>Edit</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {formModal}

      {/* Delete Confirmation Modal */}
      {deleteTarget && !selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-background rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">Delete Funding Source</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This will permanently delete <span className="font-medium text-foreground">{deleteTarget.name}</span> and cannot be undone.
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              Type <span className="font-mono font-medium text-foreground">{deleteTarget.name}</span> to confirm:
            </p>
            <Input className="h-10 text-sm mb-4" placeholder="Type name to confirm..." value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} autoFocus />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}>Cancel</Button>
              <Button variant="destructive" className="flex-1" disabled={deleteConfirmText !== deleteTarget.name} onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      <Dialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} Funding Source{selectedIds.size > 1 ? "s" : ""}?</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">The following funding sources will be deleted. Sources attached to learners or pathways cannot be deleted and will be skipped.</p>
            <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
              {[...selectedIds].map(id => {
                const s = sources.find((x: FundingSource) => x.id === id);
                return s ? <li key={id} className="flex items-center gap-2"><Trash2 size={12} className="text-muted-foreground" />{s.name}</li> : null;
              })}
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBulkDelete(false)}>Cancel</Button>
            <Button variant="destructive" disabled={bulkDeleting} onClick={async () => {
              setBulkDeleting(true);
              try {
                const res = await authFetch(`${baseUrl}/api/funding-sources/bulk-delete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...selectedIds] }) });
                const result = await res.json();
                queryClient.invalidateQueries({ queryKey: ["/api/funding-sources"] });
                setSelectedIds(new Set());
                setShowBulkDelete(false);
                if (result.blocked?.length > 0) {
                  toast({ title: "Partially Deleted", description: `${result.deleted} deleted. ${result.blocked.length} skipped (attached to learners or pathways).` });
                } else {
                  toast({ title: "Deleted", description: `${result.deleted} funding source${result.deleted !== 1 ? "s" : ""} deleted.` });
                }
              } catch {
                toast({ title: "Error", description: "Failed to delete. Please try again.", variant: "destructive" });
              } finally {
                setBulkDeleting(false);
              }
            }}>
              {bulkDeleting ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Deleting...</> : "Confirm Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={showImport} onOpenChange={(open) => { if (!open) { setShowImport(false); setImportRows([]); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Funding Sources from CSV</DialogTitle>
          </DialogHeader>

          {importRows.length === 0 ? (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">Upload a CSV file to bulk-import funding sources. Download the template to ensure your file has the correct columns.</p>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={() => {
                  const csv = [
                    "name,objectives,narrative,startDate,endDate,amount,learnerCount,goal1,goal2,goal3,goal4,goal5",
                    "# REQUIRED text (max 255),Optional text (max 1000),Optional text (no limit),Optional date (YYYY-MM-DD),Optional date (YYYY-MM-DD),Optional number (e.g. 50000),Optional whole number,Optional goal title,Optional goal title,Optional goal title,Optional goal title,Optional goal title",
                    "Example Grant,\"Fund workforce training and coaching\",\"This grant supports a 12-month workforce development initiative focused on placing underserved residents into technology careers through structured coaching, skills training, and employer partnerships.\",2026-01-01,2026-12-31,50000,25,Place 15 learners in jobs,Achieve 80% completion rate,Host 4 employer events,,",
                    "",
                  ].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = "funding_sources_template.csv"; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download size={14} className="mr-1.5" /> Download Template
                </Button>
                <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} className="mr-1.5" /> Choose File
                </Button>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    comments: "#",
                    complete: (result) => {
                      setImportRows(result.data as Record<string, string>[]);
                    },
                  });
                  e.target.value = "";
                }} />
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">{importRows.length} row{importRows.length !== 1 ? "s" : ""} found. Review before importing:</p>
              <div className="border rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Amount</th>
                      <th className="px-3 py-2 text-left font-medium">Start</th>
                      <th className="px-3 py-2 text-left font-medium">End</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((row, i) => {
                      const isDuplicate = sources.some((s: FundingSource) => s.name.toLowerCase().trim() === (row.name || "").toLowerCase().trim());
                      const isMissing = !row.name?.trim();
                      return (
                        <tr key={i} className={cn("border-t", isMissing && "bg-red-50", isDuplicate && !isMissing && "bg-amber-50")}>
                          <td className="px-3 py-1.5">{i + 1}</td>
                          <td className="px-3 py-1.5 font-medium">{row.name || <span className="text-red-500 italic">Missing</span>}</td>
                          <td className="px-3 py-1.5">{row.amount ? `$${Number(row.amount).toLocaleString()}` : "—"}</td>
                          <td className="px-3 py-1.5">{row.startDate || "—"}</td>
                          <td className="px-3 py-1.5">{row.endDate || "—"}</td>
                          <td className="px-3 py-1.5">
                            {isMissing && <span className="text-red-600 flex items-center gap-1"><X size={10} /> Invalid</span>}
                            {isDuplicate && !isMissing && <span className="text-amber-600 flex items-center gap-1"><AlertTriangle size={10} /> Duplicate</span>}
                            {!isMissing && !isDuplicate && <span className="text-emerald-600 flex items-center gap-1"><Check size={10} /> Ready</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {importRows.some(r => !r.name?.trim()) && (
                <p className="text-xs text-red-600">Rows without a name will be skipped.</p>
              )}
              {importRows.some(r => r.name?.trim() && sources.some((s: FundingSource) => s.name.toLowerCase().trim() === r.name.toLowerCase().trim())) && (
                <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle size={12} /> Some rows match existing funding sources. They will still be imported.</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setImportRows([])}>Back</Button>
                <Button disabled={importing || importRows.every(r => !r.name?.trim())} onClick={async () => {
                  setImporting(true);
                  try {
                    const validRows = importRows.filter(r => r.name?.trim()).map(r => ({
                      name: r.name.trim(),
                      objectives: r.objectives?.trim() || null,
                      narrative: r.narrative?.trim() || null,
                      startDate: r.startDate?.trim() || null,
                      endDate: r.endDate?.trim() || null,
                      amount: r.amount?.trim() || null,
                      learnerCount: r.learnerCount?.trim() || null,
                      goals: [r.goal1, r.goal2, r.goal3, r.goal4, r.goal5].filter(g => g?.trim()).map(g => g!.trim()),
                    }));
                    const res = await authFetch(`${baseUrl}/api/funding-sources/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validRows) });
                    const result = await res.json();
                    queryClient.invalidateQueries({ queryKey: ["/api/funding-sources"] });
                    toast({ title: "Import Complete", description: `${result.imported} funding source${result.imported !== 1 ? "s" : ""} imported.${result.errors?.length ? ` ${result.errors.length} failed.` : ""}` });
                    setShowImport(false);
                    setImportRows([]);
                  } catch {
                    toast({ title: "Import Failed", description: "Something went wrong. Please try again.", variant: "destructive" });
                  } finally {
                    setImporting(false);
                  }
                }}>
                  {importing ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Importing...</> : <><Upload size={14} className="mr-1.5" /> Import {importRows.filter(r => r.name?.trim()).length} Rows</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
