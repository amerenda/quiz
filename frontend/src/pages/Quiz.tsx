import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuizInfo, useJoinQuiz, useSubmitQuiz, useQuizStatus } from '../hooks/useApi'
import type { Answer } from '../types'

const ANSWER_LABELS: Record<Answer, string> = {
  hard_no: 'Hard No',
  soft_yes: 'Soft Yes',
  emphatic_yes: 'Emphatic Yes',
}

const ANSWER_STYLES: Record<Answer, string> = {
  hard_no: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100',
  soft_yes: 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100',
  emphatic_yes: 'border-green-500 bg-green-100 text-green-800 hover:bg-green-200',
}

const ANSWER_SELECTED: Record<Answer, string> = {
  hard_no: 'border-red-500 bg-red-500 text-white',
  soft_yes: 'border-green-400 bg-green-300 text-green-900',
  emphatic_yes: 'border-green-700 bg-green-700 text-white',
}

export function Quiz() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()

  const tokenKey = `participant_token_${quizId}`
  const submittedKey = `submitted_${quizId}`

  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) ?? '')
  const [submitted, setSubmitted] = useState(() => localStorage.getItem(submittedKey) === 'true')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [joinError, setJoinError] = useState('')

  const quizInfo = useQuizInfo(quizId!)
  const joinQuiz = useJoinQuiz(quizId!)
  const submitQuiz = useSubmitQuiz(quizId!)
  const status = useQuizStatus(quizId!, submitted)

  // Redirect to results when all submitted
  useEffect(() => {
    if (status.data?.all_submitted) {
      navigate(`/quiz/${quizId}/results`, { replace: true })
    }
  }, [status.data?.all_submitted, quizId, navigate])

  if (quizInfo.isLoading) {
    return <Loading />
  }

  if (quizInfo.isError) {
    return <ErrorPage message="Quiz not found or expired." />
  }

  const quiz = quizInfo.data!

  // ── Join form ──────────────────────────────────────────────
  if (!token) {
    const handleJoin = () => {
      setJoinError('')
      joinQuiz.mutate(
        { name: name.trim(), password },
        {
          onSuccess: (data) => {
            localStorage.setItem(tokenKey, data.participant_token)
            setToken(data.participant_token)
          },
          onError: (err: any) => {
            if (err.status === 403) setJoinError('Incorrect password.')
            else if (err.status === 409) setJoinError('This quiz is full.')
            else setJoinError(err.message)
          },
        },
      )
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full">
          <div className="bg-white border border-gray-200 rounded-xl p-8">
            <h1 className="text-xl font-bold text-gray-900 mb-1">Join Quiz</h1>
            <p className="text-gray-500 text-sm mb-6">
              {quiz.categories.length} categories · {quiz.max_participants} participants
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
              </div>

              {quiz.has_password && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter quiz password"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  />
                </div>
              )}

              {joinError && <p className="text-red-600 text-sm">{joinError}</p>}

              <button
                onClick={handleJoin}
                disabled={!name.trim() || joinQuiz.isPending}
                className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {joinQuiz.isPending ? 'Joining…' : 'Join Quiz'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Waiting state ──────────────────────────────────────────
  if (submitted) {
    const s = status.data
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✓</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Submitted</h2>
          {s ? (
            <p className="text-gray-500">
              {s.submitted} of {s.total} submitted
              {!s.all_submitted && ' — waiting for others…'}
            </p>
          ) : (
            <p className="text-gray-400 text-sm">Checking status…</p>
          )}
        </div>
      </div>
    )
  }

  // ── Quiz form ──────────────────────────────────────────────
  const allAnswered = quiz.categories.every((c) => answers[c.id])

  const handleSubmit = () => {
    const responses = quiz.categories.map((c) => ({
      category_id: c.id,
      answer: answers[c.id],
    }))
    submitQuiz.mutate(
      { responses, token },
      {
        onSuccess: (data) => {
          localStorage.setItem(submittedKey, 'true')
          setSubmitted(true)
          if (data.all_submitted) {
            navigate(`/quiz/${quizId}/results`, { replace: true })
          }
        },
        onError: (err: any) => {
          if (err.status === 409) {
            // Already submitted — treat as submitted
            localStorage.setItem(submittedKey, 'true')
            setSubmitted(true)
          }
        },
      },
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Your Responses</h1>
        <p className="text-gray-500 text-sm mb-8">Select one option for each category</p>

        <div className="space-y-4 mb-8">
          {quiz.categories.map((cat) => {
            const selected = answers[cat.id]
            return (
              <div key={cat.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="font-medium text-gray-900 mb-3">{cat.text}</p>
                <div className="flex gap-2">
                  {(['hard_no', 'soft_yes', 'emphatic_yes'] as Answer[]).map((ans) => (
                    <button
                      key={ans}
                      onClick={() => setAnswers({ ...answers, [cat.id]: ans })}
                      className={`flex-1 py-2 px-1 rounded-lg border text-xs font-medium transition-all ${
                        selected === ans ? ANSWER_SELECTED[ans] : ANSWER_STYLES[ans]
                      }`}
                    >
                      {ANSWER_LABELS[ans]}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {submitQuiz.isError && (
          <p className="text-red-600 text-sm mb-3">{submitQuiz.error?.message}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!allAnswered || submitQuiz.isPending}
          className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitQuiz.isPending ? 'Submitting…' : `Submit${!allAnswered ? ` (${Object.keys(answers).length}/${quiz.categories.length})` : ''}`}
        </button>
      </div>
    </div>
  )
}

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading…</p>
    </div>
  )
}

function ErrorPage({ message }: { message: string }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <p className="text-gray-700 mb-4">{message}</p>
      <button onClick={() => navigate('/')} className="text-sm text-gray-500 underline">
        Go home
      </button>
    </div>
  )
}
