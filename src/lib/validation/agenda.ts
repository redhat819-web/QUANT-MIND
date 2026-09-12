import { z } from 'zod'

/** 공백 제거 후 길이를 검증(FR-016, FR-017) */
function trimmedLength(min: number, max: number) {
  return z
    .string()
    .refine((value) => value.trim().length >= min, {
      message: `공백을 제외하고 최소 ${min}자 이상 입력해주세요.`,
    })
    .refine((value) => value.trim().length <= max, {
      message: `공백을 제외하고 최대 ${max}자까지 입력할 수 있습니다.`,
    })
}

export const agendaTitleSchema = trimmedLength(1, 100)
export const agendaBodySchema = trimmedLength(1, 2000)
export const opinionBodySchema = trimmedLength(1, 2000)

export const agendaFormSchema = z.object({
  title: agendaTitleSchema,
  body: agendaBodySchema,
})

export const opinionFormSchema = z.object({
  body: opinionBodySchema,
})

export type AgendaFormInput = z.infer<typeof agendaFormSchema>
export type OpinionFormInput = z.infer<typeof opinionFormSchema>
