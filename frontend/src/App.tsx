import { Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { NewQuiz } from './pages/NewQuiz'
import { Quiz } from './pages/Quiz'
import { Results } from './pages/Results'
import { Admin } from './pages/Admin'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<NewQuiz />} />
        <Route path="/quiz/:quizId" element={<Quiz />} />
        <Route path="/quiz/:quizId/results" element={<Results />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </div>
  )
}
