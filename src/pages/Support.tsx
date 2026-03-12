import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Minus, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  getMaintenanceTickets,
  createMaintenanceTicket,
  updateMaintenanceTicket,
  deleteMaintenanceTicket,
  getLocations,
  getChargers,
  type MaintenanceTicket,
} from '../services/api'
import { useAuth } from '../context/AuthContext'
import { canDeleteSupportTicket } from '../lib/permissions'
import { AppSelect } from '../components/shared/AppSelect'
import { EmptyState } from '../components/EmptyState'
import { useTranslation } from '../context/LanguageContext'

export default function Support() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const STATUS_OPTIONS = [
    { value: 'new', label: t('support.new') },
    { value: 'in_progress', label: t('support.inProgress') },
    { value: 'resolved', label: t('support.resolved') },
    { value: 'cancelled', label: t('support.cancelled') },
  ]

  const PRIORITY_OPTIONS = [
    { value: 'low', label: t('support.low') },
    { value: 'medium', label: t('support.medium') },
    { value: 'high', label: t('support.high') },
  ]

  const TEAM_OPTIONS = [
    { value: 'technical', label: t('support.technical') },
    { value: 'financial', label: t('support.financial') },
  ]
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    team: 'technical',
    location_id: '',
    charger_id: '',
    connector_id: '',
  })
  const [autoDetectFault, setAutoDetectFault] = useState(false)
  const [locations, setLocations] = useState<{ location_id: number; name: string }[]>([])
  const [chargers, setChargers] = useState<{ id: number; name: string; locationId: number }[]>([])
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editingTicket, setEditingTicket] = useState<MaintenanceTicket | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'new',
    team: 'technical',
    location_id: '',
    charger_id: '',
    connector_id: '',
  })

  const loadTickets = () => {
    setLoading(true)
    const opts = user?.organization_id != null ? { organization_id: user.organization_id } : undefined
    getMaintenanceTickets(opts)
      .then((r) => {
        if (r.success && r.data) setTickets(Array.isArray(r.data) ? r.data : [])
        else setTickets([])
      })
      .catch(() => setTickets([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTickets()
  }, [user?.organization_id])

  useEffect(() => {
    if (!user?.organization_id) return
    getLocations(user.organization_id).then((r) => {
      const d = (r as { data?: { location_id: number; name: string }[] }).data ?? (r as unknown as { data?: { location_id: number; name: string }[] }).data
      setLocations(Array.isArray(d) ? d : [])
    })
  }, [user?.organization_id])

  const loadChargersForLocation = (locationId: number) => {
    getChargers(locationId).then((r) => {
      const d = (r as { data?: { id: number; name: string; locationId: number }[] }).data ?? (r as unknown as { data?: { id: number; name: string; locationId: number }[] }).data
      setChargers(Array.isArray(d) ? d : [])
    })
  }

  const filteredTickets = tickets

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setMessage('Title is required')
      return
    }
    setSubmitting(true)
    setMessage('')
    createMaintenanceTicket({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      priority: form.priority,
      team: form.team,
      organization_id: user?.organization_id,
      location_id: form.location_id ? Number(form.location_id) : undefined,
      charger_id: form.charger_id ? Number(form.charger_id) : undefined,
      connector_id: form.connector_id.trim() ? Number(form.connector_id) : undefined,
      auto_detect: autoDetectFault,
    })
      .then((r) => {
        if (r.success) {
          setCreateOpen(false)
          setForm({ title: '', description: '', priority: 'medium', team: 'technical', location_id: '', charger_id: '', connector_id: '' })
          loadTickets()
        } else {
          setMessage(r.message || 'Failed to create ticket')
        }
      })
      .catch(() => setMessage('Request failed'))
      .finally(() => setSubmitting(false))
  }

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id)
  }

  const openEdit = (t: MaintenanceTicket) => {
    setEditingTicket(t)
    setEditForm({
      title: t.title || '',
      description: t.description || '',
      priority: (t.priority || 'medium').toLowerCase(),
      status: (t.status || 'new').toLowerCase(),
      team: (t.team || 'technical').toLowerCase(),
      location_id: t.location_id != null ? String(t.location_id) : '',
      charger_id: t.charger_id != null ? String(t.charger_id) : '',
      connector_id: t.connector_id != null ? String(t.connector_id) : '',
    })
    if (t.location_id) loadChargersForLocation(t.location_id)
    else setChargers([])
    setEditOpen(true)
    setMessage('')
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTicket || !editForm.title.trim()) return
    setSubmitting(true)
    setMessage('')
    updateMaintenanceTicket(editingTicket.id, {
      title: editForm.title.trim(),
      description: editForm.description.trim() || undefined,
      priority: editForm.priority,
      status: editForm.status,
      team: editForm.team,
      location_id: editForm.location_id ? Number(editForm.location_id) : undefined,
      charger_id: editForm.charger_id ? Number(editForm.charger_id) : undefined,
      connector_id: editForm.connector_id.trim() ? Number(editForm.connector_id) : undefined,
    })
      .then((r) => {
        if (r.success) {
          setEditOpen(false)
          setEditingTicket(null)
          loadTickets()
        } else {
          setMessage(r.message || 'Failed to update')
        }
      })
      .catch(() => setMessage('Request failed'))
      .finally(() => setSubmitting(false))
  }

  const confirmDelete = () => {
    if (!deleteConfirmId) return
    setUpdatingId(deleteConfirmId)
    deleteMaintenanceTicket(deleteConfirmId)
      .then((r) => {
        if (r.success) {
          setTickets((prev) => prev.filter((t) => t.id !== deleteConfirmId))
          setDeleteConfirmId(null)
        }
      })
      .finally(() => setUpdatingId(null))
  }

  return (
    <div className="space-y-6">
      <Card className="border border-border">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">{t('support.maintenanceTickets')}</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t('support.ticketsDesc')}
                </p>
              </div>
            </div>
            <Button type="button" className="shrink-0" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
              {t('support.createTicket')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin rtl:ml-2 rtl:mr-0" aria-hidden />
              {t('common.loading')}
            </div>
          ) : filteredTickets.length === 0 ? (
            <EmptyState
              icon={
                <div className="relative inline-flex">
                  <FileText className="h-16 w-16 stroke-[1.5]" />
                  <Minus className="absolute bottom-2 left-1/2 h-6 w-6 -translate-x-1/2 stroke-[2]" />
                </div>
              }
              title={t('support.noTickets')}
              description={
                tickets.length === 0
                  ? t('support.noTicketsDesc')
                  : t('support.noTicketsFiltered')
              }
              className="py-12"
            />
          ) : (
            <div className="rounded-xl border border-border overflow-hidden table-wrap">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="text-left py-3 px-4 font-semibold rtl:text-right">{t('support.titleLabel')}</th>
                    <th className="text-left py-3 px-4 font-semibold rtl:text-right">{t('support.priority')}</th>
                    <th className="text-left py-3 px-4 font-semibold rtl:text-right">{t('support.status')}</th>
                    <th className="text-left py-3 px-4 font-semibold rtl:text-right">{t('support.team')}</th>
                    <th className="text-left py-3 px-4 font-semibold rtl:text-right">{t('support.date')}</th>
                    <th className="text-left py-3 px-4 font-semibold rtl:text-right">{t('support.charger')}</th>
                    <th className="text-left py-3 px-4 font-semibold w-36 rtl:text-right">{t('support.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="border-t border-border">
                      <td className="py-3 px-4 font-medium text-foreground">{ticket.title}</td>
                      <td className="py-3 px-4 text-muted-foreground capitalize">{(ticket.priority || '—').toLowerCase()}</td>
                      <td className="py-3 px-4 text-muted-foreground capitalize">{(ticket.status || '—').replace('_', ' ')}</td>
                      <td className="py-3 px-4 text-muted-foreground">{ticket.team ?? '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {ticket.charger_id != null ? `${t('support.charger')} ${ticket.charger_id}` : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => openEdit(ticket)}
                            disabled={updatingId === ticket.id}
                            title={t('support.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {canDeleteSupportTicket(user?.role_name) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(ticket.id)}
                              disabled={updatingId === ticket.id}
                              title={t('support.delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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

      {createOpen && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 min-h-[100dvh] min-h-[100vh] z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="create-ticket-title">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-lg relative max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-4 p-6 pb-0 flex-shrink-0 border-b border-border">
              <div>
                <h3 id="create-ticket-title" className="text-lg font-semibold text-foreground">{t('support.createTicket')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('support.createTicketModalDesc')}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 -mr-2 -mt-1"
                onClick={() => { setCreateOpen(false); setMessage(''); }}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <form onSubmit={handleCreate} className="p-6 pt-5 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                <Label htmlFor="auto-detect" className="cursor-pointer text-sm font-normal">{t('support.autoDetect')}</Label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoDetectFault}
                  id="auto-detect"
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${autoDetectFault ? 'bg-primary' : 'bg-muted'}`}
                  onClick={() => setAutoDetectFault((v) => !v)}
                >
                  <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow ring-0 transition-transform ${autoDetectFault ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-title">{t('support.titleRequired')}</Label>
                <Input
                  id="ticket-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder={t('support.placeholderTitle')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-desc">{t('support.descriptionRequired')}</Label>
                <textarea
                  id="ticket-desc"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t('support.placeholderDesc')}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('support.priority')}</Label>
                <AppSelect
                  options={PRIORITY_OPTIONS}
                  value={form.priority}
                  onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                  placeholder={t('support.medium')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('support.sendTo')}</Label>
                <AppSelect
                  options={TEAM_OPTIONS}
                  value={form.team}
                  onChange={(v) => setForm((f) => ({ ...f, team: v }))}
                  placeholder={t('support.technicalTeam')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('support.organization')}</Label>
                <Input value={user?.organization_id != null ? `${t('support.organization')} ${user.organization_id}` : '—'} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>{t('details.location')}</Label>
                <AppSelect
                  options={[{ value: '', label: t('support.selectLocation') }, ...locations.map((l) => ({ value: String(l.location_id), label: l.name }))]}
                  value={form.location_id}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, location_id: v, charger_id: '' }))
                    if (v) loadChargersForLocation(Number(v))
                    else setChargers([])
                  }}
                  placeholder={t('support.selectLocation')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('support.charger')}</Label>
                <AppSelect
                  options={[{ value: '', label: t('support.selectCharger') }, ...chargers.map((c) => ({ value: String(c.id), label: c.name }))]}
                  value={form.charger_id}
                  onChange={(v) => setForm((f) => ({ ...f, charger_id: v }))}
                  placeholder={form.location_id ? t('support.selectCharger') : t('support.selectLocationFirst')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('support.connectorOptional')}</Label>
                <Input
                  value={form.connector_id}
                  onChange={(e) => setForm((f) => ({ ...f, connector_id: e.target.value }))}
                  placeholder={t('support.connectorId')}
                />
              </div>
              {message && <p className="text-sm text-destructive">{message}</p>}
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setCreateOpen(false); setMessage(''); }} disabled={submitting}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? t('support.creating') : t('support.createTicketButton')}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {editOpen && editingTicket && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 min-h-[100dvh] min-h-[100vh] z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-labelledby="edit-ticket-title">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-lg relative max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-4 p-6 pb-0 flex-shrink-0 border-b border-border">
              <div>
                <h3 id="edit-ticket-title" className="text-lg font-semibold text-foreground">{t('support.editTicket')}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t('support.editTicketDesc')}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 -mr-2 -mt-1"
                onClick={() => { setEditOpen(false); setEditingTicket(null); setMessage(''); }}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 pt-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                <Label htmlFor="edit-ticket-title-input">{t('support.titleRequired')}</Label>
                <Input
                  id="edit-ticket-title-input"
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder={t('support.placeholderTitle')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-ticket-desc">{t('support.descriptionRequired')}</Label>
                <textarea
                  id="edit-ticket-desc"
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t('support.describeIssue')}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('support.priority')}</Label>
                  <AppSelect
                    options={PRIORITY_OPTIONS}
                    value={editForm.priority}
                    onChange={(v) => setEditForm((f) => ({ ...f, priority: v }))}
                    placeholder={t('support.medium')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('support.status')}</Label>
                  <AppSelect
                    options={STATUS_OPTIONS}
                    value={editForm.status}
                    onChange={(v) => setEditForm((f) => ({ ...f, status: v }))}
                    placeholder={t('support.new')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('support.team')}</Label>
                <AppSelect
                  options={TEAM_OPTIONS}
                  value={editForm.team}
                  onChange={(v) => setEditForm((f) => ({ ...f, team: v }))}
                  placeholder={t('support.technical')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('details.location')}</Label>
                <AppSelect
                  options={[{ value: '', label: t('support.selectLocation') }, ...locations.map((l) => ({ value: String(l.location_id), label: l.name }))]}
                  value={editForm.location_id}
                  onChange={(v) => {
                    setEditForm((f) => ({ ...f, location_id: v, charger_id: '' }))
                    if (v) loadChargersForLocation(Number(v))
                    else setChargers([])
                  }}
                  placeholder={t('support.selectLocation')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('support.charger')}</Label>
                <AppSelect
                  options={[{ value: '', label: t('support.selectCharger') }, ...chargers.map((c) => ({ value: String(c.id), label: c.name }))]}
                  value={editForm.charger_id}
                  onChange={(v) => setEditForm((f) => ({ ...f, charger_id: v }))}
                  placeholder={editForm.location_id ? t('support.selectCharger') : t('support.selectLocationFirst')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('support.connectorOptionalShort')}</Label>
                <Input
                  value={editForm.connector_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, connector_id: e.target.value }))}
                  placeholder={t('support.connectorId')}
                />
              </div>
              {message && <p className="text-sm text-destructive">{message}</p>}
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setEditOpen(false); setEditingTicket(null); setMessage(''); }} disabled={submitting}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? t('support.saving') : t('support.saveChanges')}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 min-h-[100dvh] min-h-[100vh] z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-labelledby="delete-ticket-title">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg">
            <h3 id="delete-ticket-title" className="text-lg font-semibold text-foreground">{t('support.deleteConfirmTitle')}</h3>
            <p className="text-sm text-muted-foreground mt-2">{t('support.deleteConfirmDesc')}</p>
            <div className="flex gap-2 mt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDeleteConfirmId(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="button" variant="destructive" className="flex-1" onClick={confirmDelete}>
                {t('support.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
