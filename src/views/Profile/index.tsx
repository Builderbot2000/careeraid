import React, { useState, useEffect, useCallback } from 'react'
import type {
    ProfileEntry,
    ProfileEntryType,
    UserProfile,
    UserQualificationsInput,
    LanguageItem,
    CitizenshipItem,
    CreateProfileEntryInput,
    UpdateProfileEntryInput,
} from '../../shared/ipc-types'
import { blankForm } from './constants'
import type { FilterType, FormState } from './constants'
import { EntryForm } from './EntryForm'
import { EntryList } from './EntryList'

export default function Profile(): React.ReactElement {
    const [entries, setEntries] = useState<ProfileEntry[]>([])
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
    const [filter, setFilter] = useState<FilterType>('all')
    const [mode, setMode] = useState<'list' | 'form'>('list')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<FormState>(blankForm())
    const [formError, setFormError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [pdfImporting, setPdfImporting] = useState(false)
    const [yoeInput, setYoeInput] = useState('')
    const [qualsIndustries, setQualsIndustries] = useState<string[]>([])
    const [qualsLanguages, setQualsLanguages] = useState<LanguageItem[]>([])
    const [qualsCitizenship, setQualsCitizenship] = useState<CitizenshipItem[]>([])
    const [qualsDriversLicense, setQualsDriversLicense] = useState(false)
    const [statusMsg, setStatusMsg] = useState<string | null>(null)

    function flash(msg: string): void {
        setStatusMsg(msg)
        setTimeout(() => setStatusMsg(null), 3500)
    }

    const load = useCallback(async () => {
        const [ents, profile] = await Promise.all([
            window.api.getProfileEntries(),
            window.api.getUserProfile(),
        ])
        setEntries(ents)
        setUserProfile(profile)
        setYoeInput(profile.yoe !== null ? String(profile.yoe) : '')
        setQualsIndustries(profile.yoe_industry)
        setQualsLanguages(profile.languages)
        setQualsCitizenship(profile.citizenship)
        setQualsDriversLicense(profile.drivers_license)
    }, [])

    useEffect(() => { load() }, [load])

    // ─── Navigation ──────────────────────────────────────────────────────────

    function openAdd(): void {
        const defaultType: ProfileEntryType = (filter !== 'all' && filter !== 'general') ? filter : 'experience'
        setForm(blankForm(defaultType))
        setEditingId(null)
        setFormError(null)
        setMode('form')
    }

    function openEdit(entry: ProfileEntry): void {
        setForm({
            type: entry.type,
            title: entry.title,
            content: entry.content,
            tagsRaw: entry.tags.join(', '),
            start_date: entry.start_date ?? '',
            end_date: entry.end_date ?? '',
        })
        setEditingId(entry.id)
        setFormError(null)
        setMode('form')
    }

    function cancelForm(): void {
        setMode('list')
        setEditingId(null)
        setFormError(null)
    }

    function setField<K extends keyof FormState>(key: K, value: FormState[K]): void {
        setForm((prev) => ({ ...prev, [key]: value }))
        if (formError) setFormError(null)
    }

    // ─── Actions ─────────────────────────────────────────────────────────────

    async function handleSave(): Promise<void> {
        if (!form.title.trim()) { setFormError('Title is required.'); return }
        if (!form.content.trim()) { setFormError('Content is required.'); return }

        setBusy(true)
        setFormError(null)

        const tags = form.tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
        const payload: CreateProfileEntryInput | UpdateProfileEntryInput = {
            type: form.type,
            title: form.title.trim(),
            content: form.content.trim(),
            tags,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
        }

        try {
            if (editingId) {
                const updated = await window.api.updateProfileEntry(editingId, payload as UpdateProfileEntryInput)
                setEntries((prev) => prev.map((e) => (e.id === editingId ? updated : e)))
                flash('Entry updated.')
            } else {
                const created = await window.api.createProfileEntry(payload as CreateProfileEntryInput)
                setEntries((prev) => [created, ...prev])
                flash('Entry added.')
            }
            setMode('list')
            setEditingId(null)
        } catch (e) {
            setFormError(String(e))
        } finally {
            setBusy(false)
        }
    }

    async function handleDelete(id: string): Promise<void> {
        if (!window.confirm('Delete this entry? This cannot be undone.')) return
        await window.api.deleteProfileEntry(id)
        setEntries((prev) => prev.filter((e) => e.id !== id))
        if (editingId === id) { setMode('list'); setEditingId(null) }
        flash('Entry deleted.')
    }

    async function handleSaveYoe(): Promise<void> {
        const trimmed = yoeInput.trim()
        const val = trimmed === '' ? null : parseInt(trimmed, 10)
        if (trimmed !== '' && (isNaN(val as number) || (val as number) < 0)) {
            flash('Years of experience must be a non-negative integer.')
            return
        }
        await window.api.setUserYoe(val)
        setUserProfile((prev) => prev ? { ...prev, yoe: val } : prev)
        flash('YOE saved.')
    }

    async function handleSaveQualifications(): Promise<void> {
        const quals: UserQualificationsInput = {
            yoe_industry: qualsIndustries,
            languages: qualsLanguages,
            citizenship: qualsCitizenship,
            drivers_license: qualsDriversLicense,
        }
        await window.api.setUserQualifications(quals)
        setUserProfile((prev) => prev ? { ...prev, ...quals } : prev)
        flash('General saved.')
    }

    function handleAddIndustry(industry: string): void {
        setQualsIndustries((prev) => [...prev, industry])
    }

    function handleRemoveIndustry(index: number): void {
        setQualsIndustries((prev) => prev.filter((_, i) => i !== index))
    }

    function handleAddLanguage(item: LanguageItem): void {
        setQualsLanguages((prev) => [...prev, item])
    }

    function handleRemoveLanguage(index: number): void {
        setQualsLanguages((prev) => prev.filter((_, i) => i !== index))
    }

    function handleAddCitizenship(item: CitizenshipItem): void {
        setQualsCitizenship((prev) => [...prev, item])
    }

    function handleRemoveCitizenship(index: number): void {
        setQualsCitizenship((prev) => prev.filter((_, i) => i !== index))
    }

    async function handleExport(): Promise<void> {
        const filePath = await window.api.exportProfileMarkdown()
        if (filePath) flash(`Exported to ${filePath}`)
    }

    async function handleImport(): Promise<void> {
        const result = await window.api.importProfileMarkdown()
        if (result) {
            flash(`Import complete — ${result.added} added, ${result.skipped} skipped.`)
            await load()
        }
    }

    async function handleImportResumePdf(): Promise<void> {
        setPdfImporting(true)
        try {
            const result = await window.api.importProfileFromResumePdf()
            if (result) {
                flash(`Resume imported — ${result.added} ${result.added === 1 ? 'entry' : 'entries'} added.`)
                await load()
            }
        } catch (e) {
            flash(`Resume import failed: ${String(e)}`)
        } finally {
            setPdfImporting(false)
        }
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    if (mode === 'form') {
        return (
            <EntryForm
                form={form}
                formError={formError}
                busy={busy}
                editingId={editingId}
                onSave={handleSave}
                onCancel={cancelForm}
                setField={setField}
            />
        )
    }

    return (
        <EntryList
            entries={entries}
            filter={filter}
            statusMsg={statusMsg}
            yoeInput={yoeInput}
            qualsIndustries={qualsIndustries}
            qualsLanguages={qualsLanguages}
            qualsCitizenship={qualsCitizenship}
            qualsDriversLicense={qualsDriversLicense}
            pdfImporting={pdfImporting}
            setFilter={setFilter}
            setYoeInput={setYoeInput}
            setQualsDriversLicense={setQualsDriversLicense}
            onAddIndustry={handleAddIndustry}
            onRemoveIndustry={handleRemoveIndustry}
            onAddLanguage={handleAddLanguage}
            onRemoveLanguage={handleRemoveLanguage}
            onAddCitizenship={handleAddCitizenship}
            onRemoveCitizenship={handleRemoveCitizenship}
            onSaveYoe={handleSaveYoe}
            onSaveQualifications={handleSaveQualifications}
            onAdd={openAdd}
            onEdit={openEdit}
            onDelete={handleDelete}
            onExport={handleExport}
            onImport={handleImport}
            onImportPdf={handleImportResumePdf}
        />
    )
}
