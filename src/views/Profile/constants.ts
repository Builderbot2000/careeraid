import type { ProfileEntryType } from '../../shared/ipc-types'

export const ENTRY_TYPES: ProfileEntryType[] = [
    'experience',
    'credential',
    'accomplishment',
    'skill',
    'education',
]

export const TYPE_LABELS: Record<ProfileEntryType, string> = {
    experience: 'Experience',
    credential: 'Credential',
    accomplishment: 'Accomplishment',
    skill: 'Skill',
    education: 'Education',
}

export const TYPE_COLORS: Record<ProfileEntryType, string> = {
    experience: '#2563eb',
    credential: '#7c3aed',
    accomplishment: '#059669',
    skill: '#d97706',
    education: '#dc2626',
}

export type FilterType = ProfileEntryType | 'all' | 'general'

export interface FormState {
    type: ProfileEntryType
    title: string
    content: string
    tagsRaw: string
    start_date: string
    end_date: string
}

export function blankForm(type: ProfileEntryType = 'experience'): FormState {
    return { type, title: '', content: '', tagsRaw: '', start_date: '', end_date: '' }
}

export function countWords(text: string): number {
    const t = text.trim()
    return t ? t.split(/\s+/).length : 0
}

// ─── General tab reference data ───────────────────────────────────────────────

export const INDUSTRIES: string[] = [
    'Accounting & Auditing',
    'Aerospace & Defense',
    'Agriculture & Farming',
    'Automotive',
    'Banking & Financial Services',
    'Biotechnology',
    'Chemical & Materials',
    'Construction & Real Estate',
    'Consulting & Professional Services',
    'Consumer Goods & Retail',
    'Defense & Government',
    'Education & Training',
    'Energy & Utilities',
    'Entertainment & Media',
    'Environmental Services',
    'Food & Beverage',
    'Healthcare & Life Sciences',
    'Hospitality & Tourism',
    'Information Technology & Software',
    'Insurance',
    'Legal Services',
    'Logistics & Supply Chain',
    'Manufacturing & Industrial',
    'Marketing & Advertising',
    'Non-Profit & Social Services',
    'Pharmaceuticals',
    'Research & Science',
    'Telecommunications',
    'Transportation',
]

export const LANGUAGES: string[] = [
    'Afrikaans',
    'Arabic',
    'Bengali',
    'Bulgarian',
    'Catalan',
    'Croatian',
    'Czech',
    'Danish',
    'Dutch',
    'English',
    'Estonian',
    'Finnish',
    'French',
    'German',
    'Greek',
    'Hebrew',
    'Hindi',
    'Hungarian',
    'Indonesian',
    'Italian',
    'Japanese',
    'Korean',
    'Latvian',
    'Lithuanian',
    'Malay',
    'Mandarin Chinese',
    'Marathi',
    'Norwegian',
    'Persian',
    'Polish',
    'Portuguese',
    'Punjabi',
    'Romanian',
    'Russian',
    'Serbian',
    'Slovak',
    'Slovenian',
    'Spanish',
    'Swahili',
    'Swedish',
    'Tagalog',
    'Tamil',
    'Telugu',
    'Thai',
    'Turkish',
    'Ukrainian',
    'Urdu',
    'Vietnamese',
    'Welsh',
]

export const LANGUAGE_PROFICIENCIES: string[] = [
    'Elementary',
    'Limited Working',
    'Professional Working',
    'Full Professional',
    'Native/Bilingual',
]

export const COUNTRIES: string[] = [
    'Australia',
    'Austria',
    'Belgium',
    'Brazil',
    'Canada',
    'Chile',
    'China',
    'Colombia',
    'Czech Republic',
    'Denmark',
    'Egypt',
    'Finland',
    'France',
    'Germany',
    'Greece',
    'Hong Kong',
    'Hungary',
    'India',
    'Indonesia',
    'Ireland',
    'Israel',
    'Italy',
    'Japan',
    'Kenya',
    'Malaysia',
    'Mexico',
    'Netherlands',
    'New Zealand',
    'Nigeria',
    'Norway',
    'Pakistan',
    'Philippines',
    'Poland',
    'Portugal',
    'Romania',
    'Saudi Arabia',
    'Singapore',
    'South Africa',
    'South Korea',
    'Spain',
    'Sweden',
    'Switzerland',
    'Taiwan',
    'Thailand',
    'Turkey',
    'Ukraine',
    'United Arab Emirates',
    'United Kingdom',
    'United States',
    'Vietnam',
]

export const CITIZENSHIP_STATUSES: string[] = [
    'Citizen',
    'Permanent Resident',
    'Work Authorization (no sponsorship)',
    'EU/EEA Right to Work',
    'Requires Work Visa / Sponsorship',
    'Student Visa',
    'Other',
]
