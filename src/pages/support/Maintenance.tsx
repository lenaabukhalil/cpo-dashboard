import { useState, useEffect } from 'react'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import {
  getPeriodicMaintenanceList,
  createPeriodicMaintenance,
  updatePeriodicMaintenance,
  deletePeriodicMaintenance,
  getLocations,
  getChargers,
  type PeriodicMaintenance,
} from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { AppSelect } from '../../components/shared/AppSelect'
import { EmptyState } from '../../components/EmptyState'
import { Calendar, Plus, Trash2, Wrench, X } from 'lucide-react'

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const TEAM_OPTIONS = [
  { value: 'technical', label: 'Technical' },
  { value: 'financial', label: 'Financial' },
]

const SCOPE_OPTIONS = [
  { value: 'location', label: 'Location' },
  { value: 'charger', label: 'Charger' },
  { value: 'connector', label: 'Connector' },
]

function formatDate(s: string | null | undefined) {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { dateStyle: 'short' })
}

export default function SupportMaintenance() {
  const { user } = useAuth()
  const [list, setList] = useState<PeriodicMaintenance[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [locations, setLocations] = useState<{ location_id: number; name: string }[]>([])
  const [chargers, setChargers] = useState<{ id: number; name: string; locationId: number }[]>([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    team: 'technical',
    scope: 'location' as 'location' | 'charger' | 'connector',
    location_id: '',
    charger_id: '',
    connector_id: '',
    interval_days: '30',
    next_due_at: '',
    is_active: true,
  })

  const orgId = user?.organization_id != null ? String(user.organization_id) : undefined

  const loadList = () => {
    setLoading(true)
    getPeriodicMaintenanceList(orgId)
      .then((r) => {
        if (r.success && r.data) setList(Array.isArray(r.data) ? r.data : [])
        else setList([])
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadList()
  }, [orgId])

  useEffect(() => {
    if (!user?.organization_id) return
    getLocations(user.organization_id).then((r) => {
      const d = (r as { data?: { location_id: number; name: string }[] }).data ?? []
      setLocations(Array.isArray(d) ? d : [])
    })
  }, [user?.organization_id])

  const loadChargersForLocation = (locationId: number) => {
    getChargers(locationId).then((r) => {
      const d = (r as { data?: { id: number; name: string; locationId: number }[] }).data ?? []
      setChargers(Array.isArray(d) ? d : [])
    })
  }

  const openCreate = () => {
    setEditingId(null)
    const nextDue = new Date()
    nextDue.setDate(nextDue.getDate() + 30)
    setForm({
      title: '',
      description: '',
      priority: 'medium',
      team: 'technical',
      scope: 'location',
      location_id: '',
      charger_id: '',
      connector_id: '',
      interval_days: '30',
      next_due_at: nextDue.toISOString().slice(0, 10),
      is_active: true,
    })
    setChargers([])
    setMessage('')
    setModalOpen(true)
  }

  const openEdit = (row: PeriodicMaintenance) => {
    setEditingId(row.id)
    setForm({
      title: row.title,
      description: row.description || '',
      priority: row.priority || 'medium',
      team: row.team || 'technical',
      scope: row.scope,
      location_id: row.location_id ?? '',
      charger_id: row.charger_id ?? '',
      connector_id: row.connector_id ?? '',
      interval_days: String(row.interval_days),
      next_due_at: row.next_due_at ? row.next_due_at.slice(0, 10) : '',
      is_active: !!row.is_active,
    })
    if (row.location_id) loadChargersForLocation(Number(row.location_id))
    else setChargers([])
    setMessage('')
    setModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setMessage('Title is required')
      return
    }
    const interval = parseInt(form.interval_days, 10)
    if (isNaN(interval) || interval < 1) {
      setMessage('Interval (days) must be at least 1')
      return
    }
    if (!form.next_due_at.trim()) {
      setMessage('Next due date is required')
      return
    }
    setSubmitting(true)
    setMessage('')
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || '',
      priority: form.priority,
      team: form.team,
      scope: form.scope,
      location_id: form.location_id || null,
      charger_id: form.charger_id || null,
      connector_id: form.connector_id || null,
      interval_days: interval,
      next_due_at: form.next_due_at.trim(),
      organization_id: orgId!,
    }
    if (editingId) {
      updatePeriodicMaintenance(editingId, {
        title: body.title,
        description: body.description,
        priority: body.priority,
        team: body.team,
        scope: body.scope,
        location_id: body.location_id,
        charger_id: body.charger_id,
        connector_id: body.connector_id,
        interval_days: body.interval_days,
        next_due_at: body.next_due_at,
        is_active: form.is_active ? 1 : 0,
      })
        .then((r) => {
          if (r.success) {
            setModalOpen(false)
            loadList()
          } else setMessage(r.message || 'Update failed')
        })
        .catch(() => setMessage('Request failed'))
        .finally(() => setSubmitting(false))
    } else {
      createPeriodicMaintenance(body)
        .then((r) => {
          if (r.success) {
            setModalOpen(false)
            loadList()
          } else setMessage(r.message || 'Create failed')
        })
        .catch(() => setMessage('Request failed'))
        .finally(() => setSubmitting(false))
    }
  }

  const handleDelete = (id: string) => setDeleteConfirmId(id)

  const confirmDelete = () => {
    if (!deleteConfirmId) return
    deletePeriodicMaintenance(deleteConfirmId)
      .then((r) => {
        if (r.success) {
          setList((prev) => prev.filter((x) => x.id !== deleteConfirmId))
          setDeleteConfirmId(null)
        }
      })
  }

  return (
    <div className="space-y-6">
      <Card className="border border-border">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Periodic Maintenance</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Create recurring schedules for locations, chargers, or connectors.
                </p>
              </div>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Schedule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={<Wrench className="h-10 w-10 text-muted-foreground/70" />}
              title="No schedules"
              description="Add a periodic maintenance schedule to generate maintenance tickets on a recurring basis."
              actionLabel="Add Schedule"
              onAction={openCreate}
            />
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="text-left py-3 px-4 font-semibold">Title</th>
                    <th className="text-left py-3 px-4 font-semibold">Scope</th>
                    <th className="text-left py-3 px-4 font-semibold">Interval</th>
                    <th className="text-left py-3 px-4 font-semibold">Next due</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 font-semibold w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="py-3 px-4 font-medium">{row.title}</td>
                      <td className="py-3 px-4">{row.scope}</td>
                      <td className="py-3 px-4">{row.interval_days} days</td>
                      <td className="py-3 px-4">{formatDate(row.next_due_at)}</td>
                      <td className="py-3 px-4">
                        <span className={row.is_active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {row.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => openEdit(row)}>
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(row.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-4 p-6 pb-0 flex-shrink-0 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">
                {editingId ? 'Edit schedule' : 'Add schedule'}
              </h3>
              <Button type="button" variant="ghost" size="icon" onClick={() => setModalOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 pt-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                <Label htmlFor="pm-title">Title *</Label>
                <Input
                  id="pm-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Monthly charger inspection"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pm-desc">Description</Label>
                <textarea
                  id="pm-desc"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What to do during this maintenance"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <AppSelect
                    options={PRIORITY_OPTIONS}
                    value={form.priority}
                    onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Team</Label>
                  <AppSelect
                    options={TEAM_OPTIONS}
                    value={form.team}
                    onChange={(v) => setForm((f) => ({ ...f, team: v }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Scope</Label>
                <AppSelect
                  options={SCOPE_OPTIONS}
                  value={form.scope}
                  onChange={(v) => setForm((f) => ({ ...f, scope: v as 'location' | 'charger' | 'connector', location_id: '', charger_id: '', connector_id: '' }))}
                />
              </div>
              {(form.scope === 'location' || form.scope === 'charger') && (
                <div className="space-y-2">
                  <Label>Location</Label>
                  <AppSelect
                    options={[{ value: '', label: 'Select location' }, ...locations.map((l) => ({ value: String(l.location_id), label: l.name }))]}
                    value={form.location_id}
                    onChange={(v) => {
                      setForm((f) => ({ ...f, location_id: v, charger_id: '' }))
                      if (v) loadChargersForLocation(Number(v))
                      else setChargers([])
                    }}
                  />
                </div>
              )}
              {form.scope === 'charger' && form.location_id && (
                <div className="space-y-2">
                  <Label>Charger</Label>
                  <AppSelect
                    options={[{ value: '', label: 'Select charger' }, ...chargers.map((c) => ({ value: String(c.id), label: c.name }))]}
                    value={form.charger_id}
                    onChange={(v) => setForm((f) => ({ ...f, charger_id: v }))}
                  />
                </div>
              )}
              {form.scope === 'connector' && (
                <div className="space-y-2">
                  <Label>Connector ID (optional)</Label>
                  <Input
                    value={form.connector_id}
                    onChange={(e) => setForm((f) => ({ ...f, connector_id: e.target.value }))}
                    placeholder="Connector ID"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pm-interval">Interval (days) *</Label>
                  <Input
                    id="pm-interval"
                    type="number"
                    min={1}
                    value={form.interval_days}
                    onChange={(e) => setForm((f) => ({ ...f, interval_days: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pm-next">Next due date *</Label>
                  <Input
                    id="pm-next"
                    type="date"
                    value={form.next_due_at}
                    onChange={(e) => setForm((f) => ({ ...f, next_due_at: e.target.value }))}
                  />
                </div>
              </div>
              {editingId && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pm-active"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="rounded border-input"
                  />
                  <Label htmlFor="pm-active" className="font-normal">Active</Label>
                </div>
              )}
              {message && <p className="text-sm text-destructive">{message}</p>}
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : editingId ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground">Delete schedule?</h3>
            <p className="text-sm text-muted-foreground mt-2">This action cannot be undone.</p>
            <div className="flex gap-2 mt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
              <Button type="button" className="flex-1" variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
