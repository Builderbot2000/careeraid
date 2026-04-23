import { z } from 'zod'

export const RESUME_SCHEMA_VERSION = 1

export const ResumeExperienceSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1),
})

export const ResumeSkillsSchema = z.object({
  languages: z.array(z.string()),
  frameworks: z.array(z.string()),
  tools: z.array(z.string()),
})

export const ResumeEducationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  year: z.string().min(1),
})

export const ResumeDataSchema = z.object({
  summary: z.string().min(1),
  experience: z.array(ResumeExperienceSchema).min(1, 'At least one experience entry is required'),
  skills: ResumeSkillsSchema,
  education: z.array(ResumeEducationSchema),
  credentials: z.array(z.string()),
})

export type ResumeData = z.infer<typeof ResumeDataSchema>
export type ResumeExperience = z.infer<typeof ResumeExperienceSchema>
export type ResumeSkills = z.infer<typeof ResumeSkillsSchema>
export type ResumeEducation = z.infer<typeof ResumeEducationSchema>
