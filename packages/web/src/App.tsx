import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Login } from './pages/Login'
import { ProjectList } from './pages/ProjectList'
import { Workspace } from './pages/Workspace'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProjectList />} />
        <Route path="/project/:id" element={<Workspace />} />
      </Routes>
    </BrowserRouter>
  )
}
