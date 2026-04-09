export type Answer = 'hard_no' | 'soft_yes' | 'emphatic_yes'

export interface Category {
  id: string
  quiz_id: string
  text: string
  position: number
}

export interface QuizInfo {
  id: string
  categories: Category[]
  max_participants: number
  participant_count: number
  submitted_count: number
  has_password: boolean
}

export interface QuizStatus {
  submitted: number
  total: number
  all_submitted: boolean
}

export interface ParticipantAnswer {
  participant_name: string
  answer: Answer
}

export interface CategoryResult {
  category_id: string
  category_text: string
  answers: ParticipantAnswer[]
}

export interface ResultsResponse {
  categories: CategoryResult[]
  hidden?: boolean
  reason?: string
}

export interface AdminQuizSummary {
  id: string
  title: string
  hidden: boolean
  created_at: string
  expires_at: string
  max_participants: number
  participant_count: number
  submitted_count: number
  has_password: boolean
}
