import { z } from 'zod'

export const ENTRY_TYPES = [
  'experience',
  'credential',
  'accomplishment',
  'skill',
  'education',
] as const

export const ProfileEntrySchema = z.object({
  id: z.string().uuid(),
  type: z.enum(ENTRY_TYPES),
  title: z.string().min(1, 'Title is required'),
  content: z.string(),
  tags: z.array(z.string()),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  created_at: z.string(),
})

export type ProfileEntry = z.infer<typeof ProfileEntrySchema>

export const UserProfileSchema = z.object({
  id: z.number(),
  yoe: z.number().int().nonnegative().nullable(),
  yoe_industry: z.string().nullable(),
  languages: z.array(z.string()),
  citizenship: z.string().nullable(),
  drivers_license: z.boolean(),
})

export const UserQualificationsSchema = z.object({
  yoe_industry: z.string().nullable(),
  languages: z.array(z.string()),
  citizenship: z.string().nullable(),
  drivers_license: z.boolean(),
})

export type UserQualificationsInput = z.infer<typeof UserQualificationsSchema>

export type UserProfile = z.infer<typeof UserProfileSchema>

export const CreateProfileEntrySchema = ProfileEntrySchema.omit({
  id: true,
  created_at: true,
})
export type CreateProfileEntryInput = z.infer<typeof CreateProfileEntrySchema>

export const UpdateProfileEntrySchema = CreateProfileEntrySchema.partial()
export type UpdateProfileEntryInput = z.infer<typeof UpdateProfileEntrySchema>
