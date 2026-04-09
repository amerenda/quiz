import { useParams, useNavigate } from 'react-router-dom'
import { useResults, useQuizStatus } from '../hooks/useApi'
import type { Answer } from '../types'

const ANSWER_BADGE: Record<Answer, string> = {
  hard_no: 'bg-red-100 text-red-700',
  soft_yes: 'bg-green-200 text-green-800',
  emphatic_yes: 'bg-green-700 text-white',
}

const ANSWER_LABEL: Record<Answer, string> = {
  hard_no: 'Hard No',
  soft_yes: 'Soft Yes',
  emphatic_yes: 'Emphatic Yes',
}

export function Results() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()

  const results = useResults(quizId!)
  const status = useQuizStatus(quizId!, !results.data)

  // Still waiting
  if (!results.data && !results.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (results.isError) {
    const s = status.data
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⏳</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Results Pending</h2>
          {s ? (
            <p className="text-gray-500">
              {s.submitted} of {s.total} submitted — check back when everyone's done
            </p>
          ) : (
            <p className="text-gray-500">Waiting for all participants to submit</p>
          )}
          <button
            onClick={() => navigate(`/quiz/${quizId}`)}
            className="mt-6 text-sm text-gray-500 underline hover:text-gray-800"
          >
            Back to quiz
          </button>
        </div>
      </div>
    )
  }

  const { categories } = results.data!

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Results</h1>
        <p className="text-gray-500 text-sm mb-8">
          {categories.length === 0
            ? 'No matches this time.'
            : `${categories.length} match${categories.length === 1 ? '' : 'es'}`}
        </p>

        {categories.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-500">No categories matched. Better luck next time!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map((cat) => (
              <div key={cat.category_id} className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="font-semibold text-gray-900 mb-3">{cat.category_text}</p>
                <div className="flex flex-wrap gap-2">
                  {cat.answers.map((a) => (
                    <span
                      key={a.participant_name}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${ANSWER_BADGE[a.answer as Answer]}`}
                    >
                      {a.participant_name}
                      <span className="opacity-75 text-xs">{ANSWER_LABEL[a.answer as Answer]}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => navigate('/')}
          className="mt-8 text-sm text-gray-500 underline hover:text-gray-800"
        >
          Create a new quiz
        </button>
      </div>
    </div>
  )
}
